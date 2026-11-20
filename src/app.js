// Ráp mọi phần: HTTP + WebSocket + kết nối LIVE + 3 game + vòng tick 10 lần/giây.
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createAdminCommandHandler } from './admin-command-handler.js';
import { loadOrCreateAdminToken } from './admin-token-store.js';
import { DATA_DIR, PUBLIC_DIR, ROOT_DIR } from './config.js';
import { createGameHub } from './games/game-hub.js';
import { isAllowedHost, safeImageUrl, securityHeaders, tokensEqual } from './http/security.js';
import { createSocketHub } from './http/socket-hub.js';
import { createStaticFileServer } from './http/static-file-server.js';
import { createLiveConnectionManager } from './live/live-connection-manager.js';
import { log } from './logger.js';
import { createSessionLog } from './session-log.js';
import { MAX_MB, cleanYoutubeUrl, fetchYoutubeAudio } from './music/youtube-music.js';
import { builtinTracks, createPlaylistStore } from './music/playlist-store.js';
import { createFollowerStore } from './live/follower-store.js';
import { createFanClubStore } from './live/fanclub-store.js';
import { createRoomTracker } from './live/room-tracker.js';
import { createProgressStore } from './games/quiz/progress-store.js';
import { createTtsBridge, TTS_VOICES } from './tts/tts-bridge.js';
import { createEnglishTts } from './tts/english-tts.js';
import { giftOptions, normalizeRules } from './games/quiz/english-gift-rules.js';
import { ROTATE_MS, emptyRotation, rotateGifts } from './games/quiz/gift-rotation.js';
import { ORDER_VERSION, defaultEnglishRules, defaultMusicGifts, upgradeSavedRules } from '../public/shared/english-sets.js';
import { isVoiceSetting, pickVoice } from '../public/shared/tts-voices.js';
import { FOLLOW_FALLBACK_LINE, thankLine } from '../public/stage/scenes/dance-voice-lines.js';
import { createTikFinityProvider, createTikTokConnectorProvider } from './live/live-providers.js';
import { SAMPLE_GIFTS, tierRepresentatives, withCatalogImages } from '../public/shared/gift-tiers.js';
import { createAnswersLogger } from './games/quiz/answers-logger.js';

/**
 * "Phiên bản giao diện": dấu vân tay các file js/css/html trong public/. Màn hình OBS mở liền nhiều giờ, server khởi động lại
 * với code mới thì nó chỉ nối lại WebSocket mà vẫn chạy code cũ (mất hiệu ứng mới) → thấy phiên bản khác là tự tải lại trang.
 */
function frontendVersion(dir) {
  const hash = crypto.createHash('sha1');
  const walk = (folder) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'assets' && entry.name !== 'fonts') walk(full);
      } else if (/\.(js|css|html)$/.test(entry.name)) {
        const st = fs.statSync(full);
        hash.update(`${path.relative(dir, full)}:${st.size}:${Math.round(st.mtimeMs)}|`);
      }
    }
  };
  try {
    walk(dir);
  } catch (error) {
    log.warn('app', 'không tính được phiên bản giao diện:', error.message);
  }
  return hash.digest('hex').slice(0, 12);
}

const DEFAULT_SETTINGS = {
  activeGame: '', provider: 'tiktok', username: '', tts: false, ttsWelcome: false, ttsVoice: TTS_VOICES[0], ttsEnglish: true, legend: true, sound: true, volume: 0.6,
  music: true, musicVolume: 0.35, welcomeTextAbove: 1000,
  season: '', // chủ đề mùa: 'christmas' 🎄 Giáng sinh · 'teacher' 💐 20/11 (màn hình + nhạc + trang điều khiển), chọn ở thanh trên trang điều khiển
  englishRotateMinutes: 20,
  musicGifts: defaultMusicGifts()
};

function loadGiftCatalog(file) {
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    // chỉ quà THẬT của TikTok (id số) — bản cũ từng ghi lẫn quà thử / quà mẫu với giá bịa (vd "Finger Heart 15 xu", "corgi-pet")
    return Array.isArray(saved.gifts) ? saved.gifts.filter((g) => g && g.name && g.coins > 0 && /^\d+$/.test(String(g.id || '')))
      .map((g) => ({ id: String(g.id || ''), name: String(g.name).slice(0, 40), coins: Number(g.coins), image: safeImageUrl(g.image) })) : [];
  } catch {
    return [];
  }
}

function loadSettings(dataDir) {
  try {
    const saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'settings.json'), 'utf8'));
    const settings = { ...DEFAULT_SETTINGS, ...(saved && typeof saved === 'object' ? saved : {}) };
    if (!isVoiceSetting(settings.ttsVoice)) settings.ttsVoice = TTS_VOICES[0]; // giọng đã bỏ / gõ sai → giọng mặc định
    if (!Number.isFinite(settings.englishRotateMinutes) || settings.englishRotateMinutes < 1) settings.englishRotateMinutes = 20;
    if (!settings.musicGifts) settings.musicGifts = defaultMusicGifts();
    return settings;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function startApp(config, { dataDir = DATA_DIR, providerFactories, tickMs = 100, voice = false, englishSynth = null } = {}) {
  fs.mkdirSync(dataDir, { recursive: true });
  const adminToken = loadOrCreateAdminToken(dataDir, {
    onRotate: () => log.warn('admin', 'ĐÃ ĐỔI token trang điều khiển (token cũ bị lộ, không dùng được nữa) — mở link mới in khi khởi động')
  });
  const settings = loadSettings(dataDir);
  const followers = createFollowerStore(dataDir); // ai đã follow kênh (qua mọi buổi live) → 💖 cạnh tên
  const fanClubs = createFanClubStore(dataDir); // ai là Fan CLB → luôn chào khung Fan Cấp tương ứng
  const rooms = createRoomTracker(path.join(dataDir, 'live-room.json')); // phòng live gần nhất → biết khi nào sang phòng mới
  const sessions = createSessionLog(path.join(dataDir, 'logs')); // mỗi buổi live một file log riêng, giữ lâu hơn log ngày
  sessions.setup();
  // số LƯỢT tặng từng món trong buổi live này (không tính kim cương) → biết món nào đang được chọn nhiều nhất.
  // Chỉ trong bộ nhớ, xoá khi sang phòng live mới: "đang hot" phải là hot của buổi này.
  let giftCounts = Object.create(null);
  let rotateAt = 0;
  const rotateIntervalMs = () => {
    const mins = Number(settings.englishRotateMinutes);
    const valid = Number.isFinite(mins) && mins >= 1 && mins <= 180 ? Math.round(mins) : 20;
    return valid * 60 * 1000;
  };
  // tab tiếng Anh nhớ từ đã hỏi qua các lần khởi động lại → xoay vòng hết mọi từ mới lặp
  const englishProgress = createProgressStore(path.join(dataDir, 'english-seen.json'));
  // đọc đáp án tiếng Anh giọng bản xứ: server thật tự cài + gọi edge-tts; test truyền englishSynth giả (không gọi mạng)
  const englishTts = voice || englishSynth ? createEnglishTts({ dataDir, synthesize: englishSynth }) : null;
  const answersLogger = createAnswersLogger(dataDir);
  const hub = createGameHub({
    startGame: settings.activeGame || config.startGame, welcomeTextAbove: settings.welcomeTextAbove, englishProgress,
    onEnglishAnswer: englishTts && ((word) => settings.ttsEnglish !== false && englishTts.prefetch(word)),
    // 🎧 Luyện nghe chỉ mở khi màn hình đang đọc tiếng Anh và giọng đọc vừa đọc được (không lỗi liên tiếp)
    englishListenReady: () => Boolean(englishTts) && settings.ttsEnglish !== false && englishTts.status().ok,
    dataDir,
    answersLogger
  });
  let port = config.port;
  let lastStateText = '';
  // Danh mục quà THẬT của TikTok (tên, giá, ảnh chính thức) lưu lại từ lần nối live gần nhất, để lúc chạy thử
  // chưa live bảng chú thích vẫn hiện đúng ảnh quà người xem nhìn thấy.
  const catalogFile = path.join(dataDir, 'gift-catalog.json');
  let giftCatalog = loadGiftCatalog(catalogFile);
  let sampleGifts = withCatalogImages(SAMPLE_GIFTS, giftCatalog);
  // quà thật đã gom (có ảnh) + quà mẫu cho những bậc chưa gom được, để bảng chú thích luôn đủ 6 bậc
  const legendSource = () => [...giftCatalog, ...sampleGifts.filter((s) => !giftCatalog.some((g) => g.name === (s.realName || s.name)))];
  let giftTiers = tierRepresentatives(legendSource(), 3);
  hub.setGiftCatalog(giftCatalog);
  // thứ tự ô mặc định vừa đổi (vd TOEIC, IELTS lên trang 1) → bảng quà ĐÃ LƯU cũng xếp lại theo thứ tự mới, MỘT lần (giữ nguyên quà /
  // số câu chủ kênh chọn); sau đó chủ kênh vẫn tự đổi chỗ bằng ▲▼ ở tab 🎁 Quà (lưu lại thì không xếp nữa)
  if (settings.englishGifts?.length && settings.englishGiftsOrder !== ORDER_VERSION) {
    settings.englishGifts = upgradeSavedRules(settings.englishGifts, Number(settings.englishGiftsOrder) || 1);
    settings.englishGiftsOrder = ORDER_VERSION;
    try {
      fs.writeFileSync(path.join(dataDir, 'settings.json'), JSON.stringify(settings, null, 2));
      log.info('admin', 'đã xếp lại bảng quà tab tiếng Anh theo thứ tự ô mới + thêm ô mới (quà đã chọn giữ nguyên)');
    } catch (error) {
      log.warn('admin', `không lưu được bảng quà đã xếp lại: ${error.message}`);
    }
  }
  // luật quà tab tiếng Anh đã chỉnh ở tab 🎁 Quà (chưa chỉnh → mặc định); quà đã lưu mà nay không còn trong bảng quà → mặc định
  try {
    hub.setEnglishRules(settings.englishGifts?.length ? normalizeRules(settings.englishGifts, giftOptions(giftCatalog)) : defaultEnglishRules());
  } catch (error) {
    log.warn('admin', `luật quà tab tiếng Anh đã lưu không dùng được (${error.message}) → dùng bảng mặc định`);
    hub.setEnglishRules(defaultEnglishRules());
  }

  const hotBackupFile = path.join(dataDir, 'hot-backup.json');
  if (fs.existsSync(hotBackupFile)) {
    try {
      const backup = JSON.parse(fs.readFileSync(hotBackupFile, 'utf8'));
      hub.restore(backup);
      console.log('[app] Đã khôi phục dữ liệu từ backup nóng.');
    } catch (e) {
      console.warn('[app] Lỗi khôi phục backup:', e.message);
    }
  }

  let backupTimer = null;
  // ghi KHÔNG chặn (phòng đông, server không được đứng chờ ổ cứng); lúc tắt server thì ghi đồng bộ cho chắc
  let backupWriting = false;
  const saveBackupAsync = () => {
    if (backupWriting) return;
    backupWriting = true;
    fs.writeFile(hotBackupFile, JSON.stringify(hub.snapshot()), (error) => {
      backupWriting = false;
      if (error) log.warn('app', 'lỗi ghi backup nóng:', error.message);
    });
  };
  const saveBackup = () => {
    try {
      fs.writeFileSync(hotBackupFile, JSON.stringify(hub.snapshot()));
    } catch (e) {
      console.warn('[app] Lỗi ghi backup nóng:', e.message);
    }
  };
  const updateSettings = (patch) => {
    Object.assign(settings, patch);
    fs.writeFileSync(path.join(dataDir, 'settings.json'), JSON.stringify(settings, null, 2));
    sockets.broadcast({ t: 'settings', settings: publicSettings() });
  };
  // ÂM THANH RIÊNG TỪNG GAME. Trước đây chỉ có một bộ chung, nên chỉnh ở tab tiếng Anh là đè luôn
  // cài đặt của Quán Bar / Sàn Nhảy. Nay mỗi game giữ bộ của mình trong settings.gameAudio[<game>];
  // chưa chỉnh bao giờ thì rơi về bộ chung cũ (settings.sound/volume/music/musicVolume) nên không ai mất gì.
  const AUDIO_KEYS = ['sound', 'volume', 'music', 'musicVolume'];
  const audioFor = (game) => {
    const base = { sound: settings.sound, volume: settings.volume, music: settings.music, musicVolume: settings.musicVolume };
    const own = settings.gameAudio?.[game] || {};
    for (const k of AUDIO_KEYS) if (own[k] !== undefined) base[k] = own[k];
    return base;
  };
  const publicSettings = () => ({
    tts: settings.tts, ttsWelcome: settings.ttsWelcome, ttsVoice: settings.ttsVoice, ttsEnglish: settings.ttsEnglish !== false,
    legend: settings.legend, ...audioFor(hub.activeId()), audioGame: hub.activeId(),
    welcomeTextAbove: settings.welcomeTextAbove, season: settings.season || '',
    obsAutoRefresh: settings.obsAutoRefresh || { enabled: true, intervalMs: 7200000, lagDetect: true },
    musicGifts: settings.musicGifts || defaultMusicGifts()
  });
  /** Chỉnh âm thanh ở trang điều khiển: ghi vào bộ RIÊNG của game đang chạy. */
  const updateGameAudio = (patch) => {
    const game = hub.activeId();
    const gameAudio = { ...(settings.gameAudio || {}) };
    gameAudio[game] = { ...audioFor(game), ...patch };
    updateSettings({ gameAudio });
  };
  const emitFx = (game, list) => {
    if (list.length) sockets.broadcast({ t: 'fx', game, list });
  };
  let lastPushAt = 0;
  const pushState = (force = false) => {
    const now = Date.now();
    if (!force && lastStateText && now - lastPushAt < 200) return;
    const snap = hub.snapshot(now);
    const text = JSON.stringify({ t: 'state', ...snap });
    if (force || text !== lastStateText) {
      lastStateText = text;
      lastPushAt = now;
      sockets.broadcast(JSON.parse(text));
      if (!backupTimer) {
        backupTimer = setTimeout(() => {
          backupTimer = null;
          saveBackupAsync();
        }, 3000);
      }
    }
  };

  // Gộp quà thật (danh mục của phòng, hoặc từng quà nhận được) vào danh mục đã lưu; báo màn hình + trang điều khiển.
  function mergeCatalog(list) {
    const fresh = list.map((g) => ({ id: g.id, name: g.name, coins: g.coins, image: safeImageUrl(g.image) }));
    // gộp với danh mục đã có (quà mới thêm vào, quà cũ cập nhật ảnh/giá)
    const byName = new Map(giftCatalog.map((g) => [g.name, g]));
    for (const g of fresh) byName.set(g.name, { ...byName.get(g.name), ...g, image: g.image || byName.get(g.name)?.image || '' });
    giftCatalog = [...byName.values()];
    sampleGifts = withCatalogImages(SAMPLE_GIFTS, giftCatalog);
    giftTiers = tierRepresentatives(legendSource(), 3);
    try {
      fs.writeFileSync(catalogFile, JSON.stringify({ savedAt: new Date().toISOString(), gifts: giftCatalog }));
    } catch (error) {
      console.warn('[app] không lưu được danh mục quà:', error.message);
    }
    hub.setGiftCatalog(giftCatalog);
    sockets.broadcast({ t: 'gifts', tiers: giftTiers, sampleGifts });
  }

  /**
   * Một vòng luân chuyển giá quà (20 phút / vòng, chỉ khi chủ kênh bật ở tab 🎁 Quà).
   * Luật nằm trong gift-rotation.js; ở đây chỉ lo lấy dữ liệu, lưu, và báo ra màn hình.
   * Bọc try/catch: đang live thì một lỗi ở đây KHÔNG được làm chết server.
   */
  function runGiftRotation() {
    rotateAt = Date.now() + rotateIntervalMs();
    try {
      const options = giftOptions(giftCatalog);
      const current = settings.englishGifts?.length ? settings.englishGifts : defaultEnglishRules();
      const mg = settings.musicGifts || defaultMusicGifts();
      const exclude = mg && mg.enabled !== false ? [mg.on?.id, mg.off?.id].filter(Boolean) : [];
      const { rules, state, changes } = rotateGifts({ rules: current, options, counts: giftCounts,
        state: settings.englishRotation || emptyRotation(), exclude });
      if (!changes.length) {
        updateSettings({ englishRotation: state });
        return;
      }
      const normalized = normalizeRules(rules, options, mg); // chốt an toàn: bảng trùng món thì ném lỗi, không áp dụng
      updateSettings({ englishGifts: normalized, englishGiftsOrder: ORDER_VERSION, englishRotation: state });
      hub.setEnglishRules(normalized);
      pushState(true);
      const heart = changes.find((c) => c.fanclub);
      emitFx(hub.activeId(), [{ kind: 'toast', text: heart
        ? `🎁 Bảng quà vừa đổi · ${heart.label} giờ chỉ ${heart.coins} xu (${heart.name})`
        : '🎁 Bảng quà vừa đổi giá — xem lại bảng bên dưới!' }]);
      log.info('quà', `luân chuyển vòng ${state.round}: ${changes.map((c) => `${c.label} ${c.from}→${c.name} ${c.coins}xu`).join(', ')}`
        + (state.hot ? ` · hot nhất buổi: ${state.hot.name || state.hot.id} (${state.hot.count} lượt)` : ' · chưa ai tặng quà'));
    } catch (error) {
      console.warn('[quà] không luân chuyển được bảng quà:', error.message);
    }
  }

  // Người xem vừa xuất hiện (vào phòng / bình luận / tim…) ở Sàn Nhảy → tạo sẵn câu "Cảm ơn <tên>, đã follow!" bằng đúng
  // giọng màn hình sẽ dùng → lúc họ follow, giọng đọc phát ngay cùng hiệu ứng thay vì trễ 3–4 giây chờ tạo giọng.
  const followPrepared = new Set();
  function prefetchFollowThanks(event) {
    const user = event.user;
    if (!settings.tts || hub.activeId() !== 'dance' || !user?.id || event.type === 'follow' || followPrepared.has(user.id)) return;
    followPrepared.add(user.id);
    if (followPrepared.size > 3000) followPrepared.delete(followPrepared.values().next().value);
    const text = thankLine({ kind: 'follow', nickname: user.nickname });
    tts.prefetch(text, pickVoice(settings.ttsVoice, text));
  }

  const live = createLiveConnectionManager({
    providerFactories: providerFactories || {
      tiktok: (opts) => createTikTokConnectorProvider({ ...opts, apiKey: config.eulerApiKey }),
      tikfinity: (opts) => createTikFinityProvider({ ...opts, url: config.tikfinityUrl })
    },
    onEvent(event) {
      followers.mark(event);
      fanClubs.mark(event);
      emitFx(hub.activeId(), hub.handleEvent(event));
      prefetchFollowThanks(event);
      // quà thật lần đầu thấy (hoặc nay mới có ảnh): đưa vào danh mục để bảng chú thích hiện đúng ảnh quà
      if (event.type === 'gift' && !event.simulated && event.gift.diamondsEach > 0) {
        const gid = String(event.gift.id || '');
        if (gid) giftCounts[gid] = (giftCounts[gid] || 0) + (Number(event.gift.count) || 1);
        const known = giftCatalog.find((g) => g.name === event.gift.name);
        // món mới, món nay mới có ảnh, hoặc giá TikTok báo khác giá đã lưu (giá thật thắng)
        if (!known || (!known.image && event.gift.pictureUrl) || known.coins !== event.gift.diamondsEach) {
          mergeCatalog([{ id: event.gift.id, name: event.gift.name, coins: event.gift.diamondsEach, image: event.gift.pictureUrl }]);
        }
      }
      if (event.type === 'viewers') return;
      const text = event.type === 'chat' ? event.comment : event.type === 'gift'
        ? `${event.gift.name} ×${event.gift.count} (${event.gift.diamonds}💎)` : event.type === 'like' ? `${event.likeCount} tim` : '';
      sockets.broadcast({ t: 'log', event: { type: event.type, nickname: event.user.nickname, text, simulated: event.simulated } },
        { adminsOnly: true });
      // 🎵 Bật / Tắt nhạc nền bằng quà tặng (cấu hình trong tab 🎁 Quà):
      if (event.type === 'gift') {
        const mg = settings.musicGifts || defaultMusicGifts();
        if (mg && mg.enabled !== false) {
          const gid = String(event.gift?.id || '');
          const gname = String(event.gift?.name || '').toLowerCase();
          const onId = String(mg.on?.id || '');
          const onName = String(mg.on?.name || '').toLowerCase();
          const offId = String(mg.off?.id || '');
          const offName = String(mg.off?.name || '').toLowerCase();

          const isOn = (onId && gid === onId) || (onName && gname === onName);
          const isOff = (offId && gid === offId) || (offName && gname === offName);

          if (isOn) {
            updateSettings({ music: true });
            emitFx(hub.activeId(), [{ kind: 'toast', text: `🎵 @${event.user?.nickname || 'Khách'} tặng ${event.gift?.name || mg.on?.name || 'quà'} → BẬT NHẠC NỀN! 🔊` }]);
            log.info('music', `@${event.user?.nickname} tặng ${event.gift?.name} (${event.gift?.diamondsEach} xu) → BẬT NHẠC NỀN`);
          } else if (isOff) {
            updateSettings({ music: false });
            emitFx(hub.activeId(), [{ kind: 'toast', text: `🔇 @${event.user?.nickname} tặng ${event.gift?.name || mg.off?.name || 'quà'} → TẮT NHẠC NỀN! 🛑` }]);
            log.info('music', `@${event.user?.nickname} tặng ${event.gift?.name} (${event.gift?.diamondsEach} xu) → TẮT NHẠC NỀN`);
          }
        }
      }
      // Ghi log quà tặng vào ổ cứng (bất đồng bộ để tránh chặn event loop)
      if (event.type === 'gift' && !event.simulated) {
        const logLine = `[${new Date().toLocaleString('sv-SE')}] [GIFT] ${event.user.nickname} (@${event.user.uniqueId || event.user.id}): ${event.gift.name} x${event.gift.count} (${event.gift.diamonds}💎)\n`;
        fs.appendFile(path.join(dataDir, 'gifts.log'), logLine, (err) => {
          if (err) console.error('[app] Không ghi được log quà:', err.message);
        });
      }
    },
    onStatus(status) {
      sockets.broadcast({ t: 'live', status });
      // Mở / đóng file log riêng của buổi live. Gọi thẳng theo trạng thái, KHÔNG dựa vào rooms.isNew():
      // khởi động lại server giữa buổi thì isNew() là false, nhưng vẫn cần ghi tiếp vào đúng file buổi đó.
      // 'reconnecting' cố ý không đóng — mất sóng vài phút vẫn là một buổi.
      if (status.state === 'connected') sessions.start(status.roomId, { reason: `@${status.username || ''}` });
      else if (status.state === 'idle') sessions.end('ngắt kết nối');
      // nối vào PHÒNG LIVE MỚI (room id khác phòng trước) → tự xoá thông số phòng cũ; giữ bảng xếp hạng (tự xoá người im lặng 2 tiếng)
      if (status.state === 'connected' && rooms.isNew(status.roomId)) {
        hub.resetRoom();
        giftCounts = Object.create(null); // "món hot" tính lại từ đầu cho buổi mới
        rotateAt = Date.now() + rotateIntervalMs();
        log.info('live', `phòng live MỚI ${status.roomId} → đã xoá thông số phòng cũ (năng lượng tim, câu vàng/chớp nhoáng chờ, mốc follow,`
          + ' lượt share, chế độ đề) — giữ bảng xếp hạng + đại sứ share');
        emitFx(hub.activeId(), [{ kind: 'toast', text: '🔴 Phòng live mới — năng lượng & thử thách bắt đầu lại!' }]);
        pushState(true);
        saveBackup();
      }
    },
    onCatalog: (list) => mergeCatalog(list)
  });

  // tạo một lần, lúc có lệnh đầu tiên (cần `sockets` — tạo ngay bên dưới)
  let adminHandler = null;
  const handleAdmin = async (msg) => {
    adminHandler ??= createAdminCommandHandler({ hub, live, settings, updateSettings, updateGameAudio, emitFx, pushState, getSampleGifts: () => sampleGifts, sockets,
      getGiftCatalog: () => giftCatalog, saveBackup, getGiftCounts: () => giftCounts, rotateGiftsNow: runGiftRotation,
      playlist, pushPlaylist, builtinMusic: () => builtinTracks(builtinMusicDir), answersLogger,
      resetRotateTimer: () => { rotateAt = Date.now() + rotateIntervalMs(); } });
    // nhật ký thao tác người vận hành (kết nối / ngắt / đổi game / lệnh…), không ghi token, không ghi từng lần bấm thử
    if (msg?.t && msg.t !== 'test' && msg.t !== 'auth') {
      log.info('admin', `lệnh ${msg.t}${msg.game ? ` game=${msg.game}` : ''}${msg.name ? ` name=${msg.name}` : ''}${msg.username ? ` user=${msg.username}` : ''}${msg.provider ? ` nguồn=${msg.provider}` : ''}`);
    }
    try {
      return await adminHandler(msg);
    } catch (error) {
      log.warn('admin', `lệnh ${msg?.t} lỗi:`, error?.message || error);
      throw error;
    }
  };
  const version = frontendVersion(PUBLIC_DIR);
  log.info('app', `phiên bản giao diện ${version}`);
  // Tình trạng từng màn hình (OBS / khung xem trước): code bản nào, FPS, GPU — log [stage] + gửi trang điều khiển
  const stageList = () => [...sockets.clients()].filter((ws) => ws.stage).map((ws) => ws.stage);
  const sendStages = (ws = null) => {
    const message = { t: 'stages', version, list: stageList() };
    if (ws) sockets.send(ws, message);
    else sockets.broadcast(message, { adminsOnly: true });
  };
  function stageInfo(ws, info) {
    const clean = {
      version: /^[0-9a-f]{6,40}$/.test(info.version) ? info.version : '',
      obs: info.obs === true || /\bOBS\//.test(ws.userAgent), preview: info.preview === true, lite: info.lite === true,
      fps: Number.isFinite(info.fps) ? Math.max(0, Math.min(500, Math.round(info.fps))) : 0,
      gpu: String(info.gpu || '').replace(/[^\w .,:;()/+@-]/g, '').slice(0, 120), hidden: info.hidden === true
    };
    if (Number.isFinite(info.uptimeMs)) clean.uptimeMs = Math.max(0, Math.round(info.uptimeMs));
    if (typeof info.pendingReload === 'boolean') clean.pendingReload = info.pendingReload;
    clean.stale = clean.version !== version;
    clean.software = /swiftshader|llvmpipe|softpipe|software|microsoft basic/i.test(clean.gpu);
    const first = !ws.stage;
    const prev = ws.stage;
    ws.stage = clean;
    clearTimeout(ws.infoTimer);
    if (!clean.preview) {
      const who = clean.obs ? 'màn hình OBS' : 'màn hình';
      if (first) {
        log.info('stage', `${who}: code ${clean.version || '?'} (${clean.stale ? 'CŨ' : 'đúng bản mới'})`
          + `${clean.fps ? ` · ${clean.fps} khung/giây` : ''} · GPU: ${clean.gpu || '?'}${clean.lite ? ' · ?lite=1' : ''}`);
      }
      // FPS thấp: CSS mờ dần 0,7 giây chỉ còn 1–3 khung → trông như lật trang tức thì / giật (khung xem trước trên trình duyệt vẫn mượt)
      const now = Date.now();
      if (clean.fps && clean.fps < 20 && now - (ws.lowFpsWarnAt || 0) > 10 * 60000) {
        ws.lowFpsWarnAt = now;
        log.warn('stage', `${who} chỉ vẽ ${clean.fps} khung/giây${clean.software ? ' — đang vẽ bằng CPU (không có GPU)' : ''}`
          + ' → hiệu ứng mờ dần / lật trang sẽ giật hoặc mất. OBS: Cài đặt → Nâng cao → bật "Tăng tốc phần cứng cho nguồn trình duyệt"'
          + ' rồi khởi động lại OBS; hoặc thêm ?lite=1 vào link màn hình');
      }
      if (clean.hidden && !prev?.hidden) log.warn('stage', `${who} báo trang đang ẨN (OBS không hiển thị nguồn) → trình duyệt hãm đồng hồ, hiệu ứng có thể đứng`);
    }
    sendStages();
    return undefined;
  }

  const sockets = createSocketHub({
    getPort: () => port,
    allowLan: config.allowLan,
    adminToken,
    onAdminMessage: handleAdmin,
    onStageInfo: (ws, info) => stageInfo(ws, info),
    onClientClose(ws) {
      clearTimeout(ws.infoTimer);
      if (ws.stage) {
        if (!ws.stage.preview) log.info('stage', `${ws.stage.obs ? 'màn hình OBS' : 'màn hình'} đã ngắt`);
        ws.stage = null;
        sendStages();
      }
    },
    onClientReady(ws) {
      log.info('ws', `${ws.role === 'admin' ? 'trang điều khiển' : 'màn hình'} đã nối`);
      if (ws.role === 'admin') sendStages(ws);
      // màn hình mở từ trước bản 13/11 không biết tự báo → đang chạy code CŨ (OBS không tự tải lại khi server khởi động lại)
      if (ws.role === 'stage') {
        ws.infoTimer = setTimeout(() => {
          if (ws.stage || ws.readyState !== ws.OPEN || ws.role !== 'stage') return;
          ws.stage = { stale: true, obs: /\bOBS\//.test(ws.userAgent), preview: false, version: '', fps: 0, gpu: '' };
          log.warn('stage', `${ws.stage.obs ? 'màn hình OBS' : 'một màn hình'} đang chạy code CŨ (không báo phiên bản) → hiệu ứng mới`
            + ' (vd mờ dần khi lật trang bảng quà) sẽ không có. Trong OBS: chuột phải nguồn trình duyệt → Làm mới (Refresh) một lần');
          sendStages();
        }, 12000);
      }
      sockets.send(ws, { t: 'hello', role: ws.role, version, games: hub.list(), settings: publicSettings(), live: live.status(), giftTiers, sampleGifts });
      sockets.send(ws, { t: 'state', ...hub.snapshot() });
      sockets.send(ws, { t: 'musicList', tracks: playlist.playable() }); // danh sách nhạc nền đang bật, đúng thứ tự
      if (ws.role === 'admin') {
        sockets.send(ws, { t: 'adminInfo', provider: settings.provider, username: settings.username });
        sockets.send(ws, { t: 'musicAdmin', items: playlist.all(), builtin: builtinTracks(builtinMusicDir) });
      }
    }
  });

  answersLogger.setOnEntry((entry) => {
    sockets.broadcast({ t: 'quizAnswerLog', entry }, { adminsOnly: true });
  });

  const MUSIC_MAX_BYTES = MAX_MB * 1024 * 1024; // thừa cho một bài nhạc nền
  const musicDir = path.join(dataDir, 'music');
  const builtinMusicDir = path.join(PUBLIC_DIR, 'assets', 'dance', 'music');
  const playlist = createPlaylistStore(musicDir, builtinMusicDir);
  /** Màn hình nhận danh sách bài ĐANG BẬT theo đúng thứ tự; trang điều khiển nhận cả bài đang tắt. */
  const pushPlaylist = () => {
    sockets.broadcast({ t: 'musicList', tracks: playlist.playable() });
    sockets.broadcast({ t: 'musicAdmin', items: playlist.all(), builtin: builtinTracks(builtinMusicDir) }, { adminsOnly: true });
  };
  let ytBusy = false; // một lượt tải YouTube tại một thời điểm — tránh hai lần tải ghi đè nhau
  const serveStatic = createStaticFileServer({ publicDir: PUBLIC_DIR, rootDir: ROOT_DIR });
  const tts = createTtsBridge({ dataDir });
  // giọng đọc chỉ bật ở server thật (main.js) — test không nạp model ~580 MB
  if (voice && tts.start()) console.log('[tts] đang nạp giọng đọc VieNeu…');
  if (voice) englishTts.start(); // chưa có edge-tts thì tự cài nền (lần đầu ~30 giây)
  // giọng sẵn sàng → tạo sẵn câu follow dự phòng cho cả 3 giọng (khán giả mới tinh follow ngay vẫn có giọng tức thì)
  const warmFollow = voice ? setInterval(() => {
    if (!tts.status().ready) return;
    clearInterval(warmFollow);
    for (const v of TTS_VOICES) tts.prefetch(FOLLOW_FALLBACK_LINE, v);
  }, 2000) : null;
  const server = http.createServer(async (req, res) => {
    const reject = (code, text) => {
      if (res.headersSent || res.writableEnded) return undefined;
      res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', ...securityHeaders(port) });
      return res.end(text);
    };
    // CHỐT AN TOÀN: không request nào được treo vô hạn.
    // Handler là hàm async mà trước đây KHÔNG có try/catch — một lỗi ném ra giữa chừng thành
    // unhandledRejection: server vẫn sống, nhưng res không bao giờ được end. Trình duyệt giữ luôn
    // kết nối đó; mỗi nguồn chỉ được 6 kết nối HTTP/1.1 nên vài lần như vậy là cả tab đứng hình,
    // quay vòng mãi không tải nổi gì nữa — phải mở tab mới. Nay: lỗi → 500, quá hạn → 503.
    const t0 = Date.now();
    res.setTimeout(20000, () => {
      log.warn('http', `${req.method} ${(req.url || '').split('?')[0]} quá 20 giây chưa trả lời → cắt để không giữ kết nối của trình duyệt`);
      reject(503, 'Server xử lý quá lâu');
      res.destroy();
    });
    res.on('finish', () => {
      const ms = Date.now() - t0;
      if (ms > 3000) log.warn('http', `${req.method} ${(req.url || '').split('?')[0]} mất ${ms}ms (chậm)`);
    });
    try {
      await handleRequest(req, res, reject);
    } catch (error) {
      log.error('http', `${req.method} ${(req.url || '').split('?')[0]} lỗi:`, error);
      reject(500, 'Lỗi máy chủ');
    }
  });

  async function handleRequest(req, res, reject) {
    if (!isAllowedHost(req.headers.host, port, config.allowLan)) return reject(403, 'Forbidden');

    // ── Upload nhạc nền 20/11 (POST /api/music-upload) ────────────────────────
    const urlPath = (req.url || '/').split('?')[0];
    if (req.method === 'POST' && urlPath === '/api/music-upload') {
      const tok = req.headers['x-admin-token'] || '';
      if (!tokensEqual(adminToken, tok)) return reject(403, 'Forbidden');
      const EXT_OK = /\.(mp3|ogg|wav|m4a|aac|flac|opus|webm)$/i;
      // Nhận theo ĐUÔI FILE, không theo Content-Type: trình duyệt đoán kiểu rất lung tung — .m4a có máy
      // báo video/mp4, có máy báo application/octet-stream hoặc để trống → trước đây đều bị chặn 415.
      // lấy tên file từ header (mã hoá URI đẻ tránh ký tự tiếng Việt ngoài ISO-8859-1)
      let fnHeader = req.headers['x-filename'] || 'custom.mp3';
      try { fnHeader = decodeURIComponent(fnHeader); } catch {}
      const rawName = fnHeader.replace(/[^a-z0-9._\-]/gi, '_');
      const ext = (rawName.match(/\.[^.]+$/) || ['.mp3'])[0].toLowerCase();
      if (!EXT_OK.test(ext)) return reject(415, 'Định dạng không hỗ trợ (nhận .mp3 .ogg .wav .m4a .aac .flac .opus .webm)');
      fs.mkdirSync(musicDir, { recursive: true });
      const dest = path.join(musicDir, `.tai-${Date.now()}${ext}`); // tải vào file tạm, xong mới đưa vào danh sách
      const out = fs.createWriteStream(dest);
      // Chặn file quá lớn: một bản .wav dài có thể cả GB, tải lên giữa buổi live là nghẽn luôn server.
      // Trả lời 413 TRƯỚC rồi mới ngắt kết nối — ngắt trước thì trình duyệt không nhận được thông báo nào.
      let got = 0;
      let tooBig = false;
      const done = new Promise((resolve) => {
        req.on('data', (chunk) => {
          got += chunk.length;
          if (got <= MUSIC_MAX_BYTES || tooBig) return;
          tooBig = true;
          req.unpipe(out);
          out.destroy();
          resolve('big');
        });
        out.on('finish', () => resolve('ok'));
        out.on('error', () => resolve('err'));
        req.on('error', () => resolve('err'));
      });
      req.pipe(out);
      const how = await done;
      if (how !== 'ok') {
        try { fs.unlinkSync(dest); } catch { /**/ }
        reject(tooBig ? 413 : 400, tooBig ? `File quá lớn (tối đa ${MAX_MB} MB) — cắt ngắn bài hoặc dùng link YouTube` : 'Tải lên lỗi giữa chừng');
        if (tooBig) setImmediate(() => req.destroy()); // bỏ nốt phần còn lại, sau khi đã gửi xong câu trả lời
        return;
      }
      let added;
      try {
        added = playlist.add({ kind: 'file', title: rawName.replace(/\.[^.]+$/, ''), srcFile: dest });
      } catch (error) {
        try { fs.unlinkSync(dest); } catch { /**/ }
        return reject(400, error.message);
      }
      log.info('music', `thêm vào danh sách nhạc: "${added.title}" (tải lên, ${ext})`);
      pushPlaylist();
      res.writeHead(200, { 'Content-Type': 'application/json', ...securityHeaders(port) });
      return res.end(JSON.stringify({ ok: true, item: added }));
    }
    // ── Lấy nhạc nền từ link YouTube (POST /api/music-youtube { url }) ────────
    if (req.method === 'POST' && urlPath === '/api/music-youtube') {
      const tok = req.headers['x-admin-token'] || '';
      if (!tokensEqual(adminToken, tok)) return reject(403, 'Forbidden');
      let body = '';
      try {
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 4096) throw new Error('quá dài');
        }
      } catch {
        return reject(400, 'Link không hợp lệ');
      }
      let link = '';
      try { link = cleanYoutubeUrl(JSON.parse(body || '{}').url); } catch { link = ''; }
      if (!link) return reject(400, `Link không phải YouTube. Dán dạng https://www.youtube.com/watch?v=… hoặc https://youtu.be/…`);
      if (ytBusy) return reject(409, 'Đang tải một bài khác — chờ xong đã');
      ytBusy = true;
      try {
        const out = await fetchYoutubeAudio(link, musicDir, { log: (line) => log.info('music', line), keepName: true });
        const added = playlist.add({ kind: 'youtube', title: out.title, srcFile: out.file });
        log.info('music', `thêm vào danh sách nhạc: "${out.title}" (YouTube, ${Math.round(out.bytes / 1048576 * 10) / 10} MB)`);
        pushPlaylist();
        res.writeHead(200, { 'Content-Type': 'application/json', ...securityHeaders(port) });
        return res.end(JSON.stringify({ ok: true, item: added }));
      } catch (error) {
        log.warn('music', `không lấy được nhạc YouTube: ${error.message}`);
        return reject(502, `Không tải được: ${error.message}`);
      } finally {
        ytBusy = false;
      }
    }
    // ── Phát một bài trong danh sách (GET /api/music-file/<id>) ───────────────
    if (req.method === 'GET' || req.method === 'HEAD') {
      const hit = urlPath.match(/^\/api\/music-file\/([a-z0-9]{6,24})$/);
      if (hit) {
        const fpath = playlist.filePathOf(hit[1]);
        if (!fpath || !fs.existsSync(fpath)) return reject(404, 'Không có bài này');
        const ext = (fpath.match(/\.[^.]+$/) || ['.mp3'])[0].toLowerCase();
        const buf = fs.readFileSync(fpath);
        const mime = { '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac',
          '.flac': 'audio/flac', '.opus': 'audio/ogg', '.webm': 'audio/webm' }[ext] || 'audio/mpeg';
        res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache', 'Content-Length': String(buf.length), ...securityHeaders(port) });
        return res.end(req.method === 'HEAD' ? undefined : buf);
      }
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return reject(405, 'Method not allowed');
    if (urlPath === '/') {
      res.writeHead(302, { Location: '/admin', ...securityHeaders(port) });
      return res.end();
    }
    if (urlPath === '/api/tts') return await tts.handle(req, res, port);
    if (urlPath === '/api/tts-en') {
      if (englishTts) return await englishTts.handle(req, res, port);
      return reject(503, 'Giọng tiếng Anh chỉ bật khi chạy npm start');
    }
    if (urlPath === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...securityHeaders(port) });
      return res.end(JSON.stringify({ ok: true, game: hub.activeId(), live: live.status().state }));
    }
    const file = await serveStatic(urlPath);
    if (!file) return reject(404, 'Not found');
    // Trang /stage được nhúng làm khung xem trước trong /admin (cùng nguồn), nơi khác không nhúng được.
    res.writeHead(200, {
      'Content-Type': file.type,
      'Cache-Control': file.isHtml ? 'no-store' : 'no-cache',
      ...securityHeaders(port, { framePreview: urlPath === '/stage' })
    });
    return res.end(req.method === 'HEAD' ? undefined : file.body);
  }
  server.requestTimeout = 10000;
  server.headersTimeout = 5000;
  server.on('upgrade', sockets.handleUpgrade);

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, resolve);
  });
  port = server.address().port;

  const timer = setInterval(() => {
    emitFx(hub.activeId(), hub.tick());
    pushState();
    // luân chuyển giá quà: chỉ chạy khi chủ kênh đã bật VÀ đang thật sự live (phòng vắng thì đổi vô nghĩa)
    if (settings.englishRotate && live.status().state === 'connected') {
      const interval = rotateIntervalMs();
      const now = Date.now();
      if (!rotateAt) rotateAt = now + interval;
      else if (now >= rotateAt) {
        runGiftRotation();
      }
    }
  }, tickMs);

  if (config.tiktokUsername) {
    live.connect(config.tiktokUsername, config.provider).catch((e) => console.warn('[live]', e.message));
  }

  return {
    port,
    adminToken,
    hub,
    live,
    async close() {
      saveBackup();
      clearInterval(timer);
      clearInterval(warmFollow);
      followers.flush();
      englishProgress.flush();
      tts.stop();
      await live.disconnect();
      await sessions.close();
      sockets.close();
      await new Promise((resolve) => server.close(resolve));
    }
  };
}
