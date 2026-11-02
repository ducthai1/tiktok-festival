// Giữ một kết nối LIVE: tự nối lại khi rớt, chống trùng tin, tách combo quà,
// chuẩn hoá rồi mới đẩy sự kiện cho game. Nguồn được tiêm vào để test không cần mạng.
import { createEventDeduper, createGiftStreakTracker } from './gift-streak-tracker.js';
import { sanitizeLiveEvent } from './live-event-schema.js';

const USERNAME_RE = /^[A-Za-z0-9._]{2,24}$/;

export function parseTikTokUsername(input) {
  let text = String(input ?? '').trim();
  const fromUrl = text.match(/tiktok\.com\/@([A-Za-z0-9._]+)/i);
  if (fromUrl) text = fromUrl[1];
  text = text.replace(/^@/, '');
  return USERNAME_RE.test(text) ? text : '';
}

export function createLiveConnectionManager({ providerFactories, onEvent, onStatus, onCatalog = () => {}, timers = globalThis }) {
  const isDuplicate = createEventDeduper();
  const streaks = createGiftStreakTracker();
  let status = { state: 'idle', provider: '', username: '', message: 'Chưa kết nối' };
  let provider = null;
  let attempt = 0;
  let retryTimer = null;
  let failures = 0;

  function setStatus(patch) {
    status = { ...status, ...patch, since: Date.now() };
    onStatus(status);
  }

  function ingest(raw, { simulated = false } = {}) {
    if (!raw || (raw.id && isDuplicate(`${raw.type}:${raw.id}`))) return null;
    const event = { type: raw.type, id: raw.id, user: raw.user, comment: raw.comment, likeCount: raw.likeCount,
      viewerCount: raw.viewerCount, simulated };
    if (raw.type === 'gift') {
      const g = raw.giftRaw || {};
      const count = streaks.delta({ userId: raw.user?.id, giftId: g.id, groupId: g.groupId,
        repeatCount: g.repeatCount, repeatEnd: g.repeatEnd, streakable: g.streakable });
      event.gift = { id: g.id, name: g.name, pictureUrl: g.pictureUrl, diamondsEach: g.diamondsEach, count };
    }
    const safe = sanitizeLiveEvent(event);
    if (safe) onEvent(safe);
    return safe;
  }

  function clearRetry() {
    if (retryTimer) timers.clearTimeout(retryTimer);
    retryTimer = null;
  }

  async function stopProvider() {
    const current = provider;
    provider = null;
    if (current) await current.stop().catch(() => {});
  }

  function scheduleRetry(myAttempt, reason) {
    if (myAttempt !== attempt) return;
    failures += 1;
    const delay = Math.min(60000, 2000 * 2 ** Math.min(failures - 1, 5));
    setStatus({ state: 'reconnecting', message: `${reason} — thử lại sau ${Math.round(delay / 1000)} giây` });
    clearRetry();
    retryTimer = timers.setTimeout(() => void open(myAttempt), delay);
  }

  async function open(myAttempt) {
    if (myAttempt !== attempt) return;
    await stopProvider();
    const factory = providerFactories[status.provider];
    const instance = factory({
      username: status.username,
      emit: (raw) => myAttempt === attempt && ingest(raw),
      onCatalog: (list) => myAttempt === attempt && onCatalog(list), // danh mục quà thật của phòng
      onDisconnected: (reason) => {
        if (myAttempt === attempt && provider === instance) scheduleRetry(myAttempt, reason);
      },
      onEnded: () => {
        if (myAttempt !== attempt) return;
        attempt += 1; // live kết thúc: dừng hẳn, không nối lại
        clearRetry();
        void stopProvider();
        setStatus({ state: 'ended', message: `Live @${status.username} đã kết thúc` });
      }
    });
    provider = instance;
    try {
      const info = await instance.start();
      if (myAttempt !== attempt) return void instance.stop().catch(() => {});
      failures = 0;
      setStatus({ state: 'connected', message: `Đã kết nối @${status.username}`, roomId: info?.roomId || '' });
    } catch (error) {
      if (myAttempt !== attempt) return;
      const offline = /offline|not live|UserOffline/i.test(`${error?.name} ${error?.message}`);
      scheduleRetry(myAttempt, offline ? `@${status.username} chưa lên live` : `Lỗi: ${error?.message || error}`);
    }
  }

  return {
    status: () => status,
    isLive: () => status.state === 'connected',
    ingest,
    async connect(usernameInput, providerName) {
      const username = providerName === 'tikfinity' ? parseTikTokUsername(usernameInput) || 'tikfinity'
        : parseTikTokUsername(usernameInput);
      if (!username) throw new Error('Tên TikTok không hợp lệ (2–24 ký tự chữ, số, dấu chấm, gạch dưới)');
      if (!providerFactories[providerName]) throw new Error('Nguồn không hợp lệ');
      attempt += 1;
      failures = 0;
      clearRetry();
      setStatus({ state: 'connecting', provider: providerName, username, message: `Đang kết nối @${username}...` });
      await open(attempt);
    },
    async disconnect() {
      attempt += 1;
      clearRetry();
      await stopProvider();
      setStatus({ state: 'idle', message: 'Đã ngắt kết nối' });
    }
  };
}
