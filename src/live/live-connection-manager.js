// Giữ một kết nối LIVE: tự nối lại khi rớt, chống trùng tin, tách combo quà,
// chuẩn hoá rồi mới đẩy sự kiện cho game. Nguồn được tiêm vào để test không cần mạng.
//
// Sự cố 11/11 và 12/11 (khoảng 16h–17h30, cả hai ngày): mất hết bình luận / quà / số mắt xem. Phòng các nguyên nhân:
// - TikTok báo "streamEnd" cả khi live chỉ TẠM DỪNG (mạng máy phát chập chờn, thoát app) → trước đây dừng hẳn,
//   không nối lại. Giờ: tạm dừng → nối lại nhanh; kết thúc thật → vẫn chờ live mới nhưng thưa hơn.
// - Kết nối chết im lặng (socket không đóng nhưng không còn dữ liệu) → CANH CHỪNG: 90 giây không có gì là nối lại.
// - Mỗi lần kết nối tốn lượt ký của Euler; nối lại dồn dập dễ hết hạn mức → nhịp nối lại theo loại lỗi,
//   lỗi giới hạn / bị chặn thì giãn ra, và log đếm số lần kết nối trong ngày để biết có cạn hạn mức không.
// - Lệnh kết nối có thể treo → giới hạn 25 giây.
import { log } from '../logger.js';
import { createEventDeduper, createGiftStreakTracker } from './gift-streak-tracker.js';
import { sanitizeLiveEvent } from './live-event-schema.js';

const USERNAME_RE = /^[A-Za-z0-9._]{2,24}$/;
export const CONNECT_TIMEOUT_MS = 25000;
export const WATCHDOG_MS = 90000; // phòng đang live luôn có số người xem / tim gửi về định kỳ
// 2 phút đầu sau mỗi lần kết nối: 30 giây không có gì là nối lại ngay (hay gặp: vừa mở live mới mà TikTok vẫn trả phòng cũ)
export const PROBATION_WATCHDOG_MS = 30000;
const PROBATION_MS = 120000;
const WATCHDOG_CHECK_MS = 10000;
const STATS_MS = 60000;
const SLOW_EVENT_MS = 50;

export function parseTikTokUsername(input) {
  let text = String(input ?? '').trim();
  const fromUrl = text.match(/tiktok\.com\/@([A-Za-z0-9._]+)/i);
  if (fromUrl) text = fromUrl[1];
  text = text.replace(/^@/, '');
  return USERNAME_RE.test(text) ? text : '';
}

/** Loại lỗi khi kết nối thất bại → quyết định nhịp nối lại + câu báo cho người vận hành. */
export function classifyConnectError(error) {
  const text = `${error?.name || ''} ${error?.constructor?.name || ''} ${error?.message || error || ''}`;
  if (/offline|not live|isn't online|UserOffline/i.test(text)) return 'offline';
  if (/rate ?limit|too many requests|\b429\b|SignatureRateLimit/i.test(text)) return 'ratelimit';
  if (/Failed to retrieve Room ID|InvalidResponseComposite|SignAPI|Failed to sign|PremiumFeature|captcha|\b403\b/i.test(text)) return 'blocked';
  if (/timeout|timed out|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|socket hang up/i.test(text)) return 'network';
  return 'error';
}

/** Chờ bao lâu rồi thử lại. sinceMs: đã mất kết nối bao lâu; failures: số lần thử thất bại liên tiếp. */
export function retryDelay(kind, sinceMs, failures) {
  if (kind === 'suspended' || kind === 'dropped' || kind === 'stalled' || kind === 'network') {
    return sinceMs < 3 * 60000 ? 4000 : sinceMs < 15 * 60000 ? 15000 : 60000;
  }
  if (kind === 'ended' || kind === 'offline') return sinceMs < 10 * 60000 ? 20000 : 120000;
  if (kind === 'ratelimit' || kind === 'blocked') return Math.min(5 * 60000, 30000 * 2 ** Math.min(Math.max(0, failures - 1), 4));
  return Math.min(60000, 3000 * 2 ** Math.min(Math.max(0, failures - 1), 5));
}

const REASON_TEXT = {
  offline: (u) => `@${u} chưa lên live`,
  ended: (u) => `Live @${u} đã kết thúc — chờ live mới`,
  suspended: (u) => `Live @${u} tạm dừng (mạng máy phát / thoát app)`,
  dropped: () => 'Mất kết nối TikTok',
  stalled: () => 'Không nhận được dữ liệu gì từ TikTok 90 giây',
  ratelimit: () => 'Hết lượt ký Euler (giới hạn) — giãn nhịp thử lại',
  blocked: () => 'TikTok / Euler từ chối kết nối — kiểm tra EULER_API_KEY trong .env',
  network: () => 'Lỗi mạng khi kết nối'
};

export function createLiveConnectionManager({ providerFactories, onEvent, onStatus, onCatalog = () => {}, timers = globalThis, now = () => Date.now() }) {
  const isDuplicate = createEventDeduper();
  const streaks = createGiftStreakTracker();
  let status = { state: 'idle', provider: '', username: '', message: 'Chưa kết nối' };
  let provider = null;
  let attempt = 0;
  let retryTimer = null;
  let failures = 0;
  let downSince = 0; // lúc bắt đầu mất kết nối (0 = đang ổn)
  let lastDataAt = 0;
  let watchTimer = null;
  let statsTimer = null;
  let counts = {};
  let connectsDay = '';
  let connectsToday = 0;
  let lastSlowLog = 0;
  let connectedAt = 0;
  let roomId = '';
  let endedRoomId = ''; // phòng TikTok vừa báo KẾT THÚC — được trả lại phòng này nghĩa là chưa thấy live mới

  function setStatus(patch) {
    const before = `${status.state}|${status.message}`;
    status = { ...status, ...patch, since: now() };
    if (`${status.state}|${status.message}` !== before) {
      (status.state === 'connected' || status.state === 'idle' || status.state === 'connecting' ? log.info : log.warn)(
        'live', `trạng thái → ${status.state}: ${status.message}`);
    }
    onStatus(status);
  }

  function ingest(raw, { simulated = false } = {}) {
    if (!raw) return null;
    if (!simulated) {
      lastDataAt = now();
      counts[raw.type] = (counts[raw.type] || 0) + 1;
    }
    if (raw.id && isDuplicate(`${raw.type}:${raw.id}`)) return null;
    const event = { type: raw.type, id: raw.id, user: raw.user, comment: raw.comment, likeCount: raw.likeCount,
      viewerCount: raw.viewerCount, simulated };
    if (raw.type === 'gift') {
      const g = raw.giftRaw || {};
      const count = streaks.delta({ userId: raw.user?.id, giftId: g.id, groupId: g.groupId,
        repeatCount: g.repeatCount, repeatEnd: g.repeatEnd, streakable: g.streakable });
      event.gift = { id: g.id, name: g.name, pictureUrl: g.pictureUrl, diamondsEach: g.diamondsEach, count };
    }
    const safe = sanitizeLiveEvent(event);
    if (safe) {
      const t0 = performance.now();
      try {
        onEvent(safe);
      } catch (error) {
        log.error('game', `lỗi xử lý sự kiện ${safe.type} (bỏ qua sự kiện này, kết nối vẫn giữ):`, error);
      }
      // phòng đông mà một sự kiện xử lý lâu là server sắp nghẽn — báo (tối đa 1 lần / 10 giây)
      const took = performance.now() - t0;
      if (took > SLOW_EVENT_MS && now() - lastSlowLog > 10000) {
        lastSlowLog = now();
        log.warn('game', `xử lý sự kiện ${safe.type} mất ${Math.round(took)}ms (chậm)`);
      }
    }
    return safe;
  }

  function clearRetry() {
    if (retryTimer) timers.clearTimeout(retryTimer);
    retryTimer = null;
  }

  async function stopProvider() {
    const current = provider;
    provider = null;
    if (current) await current.stop().catch((error) => log.warn('live', 'đóng kết nối cũ lỗi:', error?.message || error));
  }

  // ---- canh chừng + thống kê mỗi phút (chỉ chạy khi đang có kết nối / đang thử kết nối) ----
  function startTimers() {
    if (!watchTimer) {
      watchTimer = timers.setInterval(() => {
        if (status.state !== 'connected' || !provider) return;
        const silent = now() - lastDataAt;
        const limit = now() - connectedAt < PROBATION_MS ? PROBATION_WATCHDOG_MS : WATCHDOG_MS;
        if (silent < limit) return;
        log.warn('live', `canh chừng: ${Math.round(silent / 1000)} giây không có dữ liệu dù đang "đã kết nối" → nối lại`);
        lost(attempt, 'stalled');
      }, WATCHDOG_CHECK_MS);
    }
    if (!statsTimer) {
      statsTimer = timers.setInterval(() => {
        const parts = Object.entries(counts).map(([type, n]) => `${type} ${n}`).join(' · ') || 'không có dữ liệu';
        log.info('live', `60 giây qua: ${parts} — trạng thái ${status.state}, kết nối hôm nay ${connectsToday} lần`);
        counts = {};
      }, STATS_MS);
    }
  }

  function stopTimers() {
    if (watchTimer) timers.clearInterval(watchTimer);
    if (statsTimer) timers.clearInterval(statsTimer);
    watchTimer = null;
    statsTimer = null;
  }

  /** Kết nối đang dùng mất (rớt / tạm dừng / kết thúc / im lặng) hoặc lần kết nối thất bại → hẹn thử lại. */
  function lost(myAttempt, kind, detail = '') {
    if (myAttempt !== attempt) return;
    if (!downSince) downSince = now();
    failures += 1;
    const delay = retryDelay(kind, now() - downSince, failures);
    const text = (REASON_TEXT[kind] || (() => `Lỗi: ${detail}`))(status.username);
    setStatus({ state: 'reconnecting', reason: kind, message: `${text} — thử lại sau ${Math.round(delay / 1000)} giây` });
    if (detail && REASON_TEXT[kind]) log.warn('live', `chi tiết (${kind}):`, detail);
    clearRetry();
    // kết nối im lặng / tạm dừng: đóng hẳn kết nối cũ ngay, không để nó còn treo
    if (kind === 'stalled' || kind === 'suspended' || kind === 'ended') void stopProvider();
    retryTimer = timers.setTimeout(() => void open(myAttempt), delay);
  }

  function countConnect() {
    const day = new Date(now()).toDateString();
    if (day !== connectsDay) {
      connectsDay = day;
      connectsToday = 0;
    }
    connectsToday += 1;
    return connectsToday;
  }

  async function open(myAttempt) {
    if (myAttempt !== attempt) return;
    await stopProvider();
    const factory = providerFactories[status.provider];
    const n = countConnect();
    log.info('live', `kết nối @${status.username} qua ${status.provider} — lần ${n} trong ngày (mỗi lần tốn lượt ký Euler)`);
    let ended = false; // streamEnd và disconnected cùng bắn: chỉ tính một lần
    const instance = factory({
      username: status.username,
      emit: (raw) => myAttempt === attempt && ingest(raw),
      onActivity: () => {
        if (myAttempt === attempt) lastDataAt = now();
      },
      onCatalog: (list) => myAttempt === attempt && onCatalog(list), // danh mục quà thật của phòng
      onDisconnected: (reason) => {
        if (myAttempt !== attempt || provider !== instance || ended) return;
        log.warn('live', 'TikTok đóng kết nối:', reason);
        lost(myAttempt, 'dropped', reason);
      },
      onEnded: (kind = 'ended') => {
        if (myAttempt !== attempt || provider !== instance || ended) return;
        ended = true;
        log.warn('live', `TikTok báo ${kind === 'suspended' ? 'live TẠM DỪNG' : 'live KẾT THÚC'} (phòng ${roomId || '?'})`);
        if (kind !== 'suspended') endedRoomId = roomId;
        lost(myAttempt, kind === 'suspended' ? 'suspended' : 'ended');
      }
    });
    provider = instance;
    let timeout = null;
    try {
      const info = await Promise.race([
        instance.start(),
        new Promise((_, reject) => {
          timeout = timers.setTimeout(() => reject(new Error(`kết nối quá ${CONNECT_TIMEOUT_MS / 1000} giây không phản hồi (timeout)`)), CONNECT_TIMEOUT_MS);
        })
      ]);
      timers.clearTimeout(timeout);
      if (myAttempt !== attempt) return void instance.stop().catch(() => {});
      const newRoom = String(info?.roomId || '');
      if (newRoom && newRoom === endedRoomId) {
        // TikTok vẫn trả về phòng vừa kết thúc (trang kênh chưa cập nhật live mới) → bỏ, tra lại
        log.warn('live', `TikTok vẫn trả về phòng cũ ${newRoom} đã kết thúc — chưa thấy live mới, tra lại`);
        if (provider === instance) await stopProvider();
        return lost(myAttempt, 'ended');
      }
      roomId = newRoom;
      endedRoomId = '';
      connectedAt = now();
      if (downSince) log.info('live', `nối lại được sau ${Math.round((now() - downSince) / 1000)} giây mất kết nối`);
      failures = 0;
      downSince = 0;
      lastDataAt = now();
      setStatus({ state: 'connected', reason: '', message: `Đã kết nối @${status.username}`, roomId: info?.roomId || '' });
      log.info('live', `phòng ${info?.roomId || '?'} — đang nhận dữ liệu`);
    } catch (error) {
      timers.clearTimeout(timeout);
      if (myAttempt !== attempt) return;
      if (provider === instance) await stopProvider();
      const kind = classifyConnectError(error);
      log.warn('live', `kết nối thất bại (${kind}):`, error?.name || '', error?.message || error);
      lost(myAttempt, kind, error?.message || String(error));
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
      downSince = 0;
      clearRetry();
      startTimers();
      setStatus({ state: 'connecting', provider: providerName, username, reason: '', message: `Đang kết nối @${username}...` });
      await open(attempt);
    },
    async disconnect() {
      attempt += 1;
      clearRetry();
      stopTimers();
      await stopProvider();
      setStatus({ state: 'idle', reason: '', message: 'Đã ngắt kết nối' });
    }
  };
}
