// Ráp mọi phần: HTTP + WebSocket + kết nối LIVE + 3 game + vòng tick 10 lần/giây.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createAdminCommandHandler } from './admin-command-handler.js';
import { loadOrCreateAdminToken } from './admin-token-store.js';
import { DATA_DIR, PUBLIC_DIR, ROOT_DIR } from './config.js';
import { createGameHub } from './games/game-hub.js';
import { isAllowedHost, safeImageUrl, securityHeaders } from './http/security.js';
import { createSocketHub } from './http/socket-hub.js';
import { createStaticFileServer } from './http/static-file-server.js';
import { createLiveConnectionManager } from './live/live-connection-manager.js';
import { createTtsBridge, TTS_VOICES } from './tts/tts-bridge.js';
import { isVoiceSetting, pickVoice } from '../public/shared/tts-voices.js';
import { thankLine } from '../public/stage/scenes/dance-voice-lines.js';
import { createTikFinityProvider, createTikTokConnectorProvider } from './live/live-providers.js';
import { SAMPLE_GIFTS, tierRepresentatives, withCatalogImages } from '../public/shared/gift-tiers.js';

const DEFAULT_SETTINGS = {
  activeGame: '', provider: 'tiktok', username: '', tts: false, ttsWelcome: false, ttsVoice: TTS_VOICES[0], legend: true, sound: true, volume: 0.6,
  music: true, musicVolume: 0.35, welcomeTextAbove: 1000
};

function loadGiftCatalog(file) {
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(saved.gifts) ? saved.gifts.filter((g) => g && g.name && g.coins > 0)
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
    return settings;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function startApp(config, { dataDir = DATA_DIR, providerFactories, tickMs = 100, voice = false } = {}) {
  fs.mkdirSync(dataDir, { recursive: true });
  const adminToken = loadOrCreateAdminToken(dataDir);
  const settings = loadSettings(dataDir);
  const hub = createGameHub({ startGame: settings.activeGame || config.startGame, welcomeTextAbove: settings.welcomeTextAbove });
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

  const updateSettings = (patch) => {
    Object.assign(settings, patch);
    fs.writeFileSync(path.join(dataDir, 'settings.json'), JSON.stringify(settings, null, 2));
    sockets.broadcast({ t: 'settings', settings: publicSettings() });
  };
  const publicSettings = () => ({
    tts: settings.tts, ttsWelcome: settings.ttsWelcome, ttsVoice: settings.ttsVoice, legend: settings.legend, sound: settings.sound, volume: settings.volume,
    music: settings.music, musicVolume: settings.musicVolume,
    welcomeTextAbove: settings.welcomeTextAbove
  });
  const emitFx = (game, list) => {
    if (list.length) sockets.broadcast({ t: 'fx', game, list });
  };
  const pushState = (force = false) => {
    const text = JSON.stringify({ t: 'state', ...hub.snapshot() });
    if (force || text !== lastStateText) {
      lastStateText = text;
      sockets.broadcast(JSON.parse(text));
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
    sockets.broadcast({ t: 'gifts', tiers: giftTiers, sampleGifts });
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
      emitFx(hub.activeId(), hub.handleEvent(event));
      prefetchFollowThanks(event);
      // quà thật lần đầu thấy (hoặc nay mới có ảnh): đưa vào danh mục để bảng chú thích hiện đúng ảnh quà
      if (event.type === 'gift' && !event.simulated && event.gift.diamondsEach > 0) {
        const known = giftCatalog.find((g) => g.name === event.gift.name);
        if (!known || (!known.image && event.gift.pictureUrl)) {
          mergeCatalog([{ id: event.gift.id, name: event.gift.name, coins: event.gift.diamondsEach, image: event.gift.pictureUrl }]);
        }
      }
      if (event.type === 'viewers') return;
      const text = event.type === 'chat' ? event.comment : event.type === 'gift'
        ? `${event.gift.name} ×${event.gift.count} (${event.gift.diamonds}💎)` : event.type === 'like' ? `${event.likeCount} tim` : '';
      sockets.broadcast({ t: 'log', event: { type: event.type, nickname: event.user.nickname, text, simulated: event.simulated } },
        { adminsOnly: true });
    },
    onStatus(status) {
      sockets.broadcast({ t: 'live', status });
    },
    onCatalog: (list) => mergeCatalog(list)
  });

  const handleAdmin = createAdminCommandHandler({ hub, live, settings, updateSettings, emitFx, pushState, getSampleGifts: () => sampleGifts });
  const sockets = createSocketHub({
    getPort: () => port,
    allowLan: config.allowLan,
    adminToken,
    onAdminMessage: handleAdmin,
    onClientReady(ws) {
      sockets.send(ws, { t: 'hello', role: ws.role, games: hub.list(), settings: publicSettings(), live: live.status(), giftTiers, sampleGifts });
      sockets.send(ws, { t: 'state', ...hub.snapshot() });
      if (ws.role === 'admin') sockets.send(ws, { t: 'adminInfo', provider: settings.provider, username: settings.username });
    }
  });

  const serveStatic = createStaticFileServer({ publicDir: PUBLIC_DIR, rootDir: ROOT_DIR });
  const tts = createTtsBridge({ dataDir });
  // giọng đọc chỉ bật ở server thật (main.js) — test không nạp model ~580 MB
  if (voice && tts.start()) console.log('[tts] đang nạp giọng đọc VieNeu…');
  const server = http.createServer(async (req, res) => {
    const reject = (code, text) => {
      res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', ...securityHeaders(port) });
      res.end(text);
    };
    if (!isAllowedHost(req.headers.host, port, config.allowLan)) return reject(403, 'Forbidden');
    if (req.method !== 'GET' && req.method !== 'HEAD') return reject(405, 'Method not allowed');
    const urlPath = (req.url || '/').split('?')[0];
    if (urlPath === '/') {
      res.writeHead(302, { Location: '/admin', ...securityHeaders(port) });
      return res.end();
    }
    if (urlPath === '/api/tts') return tts.handle(req, res, port);
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
  });
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
      clearInterval(timer);
      tts.stop();
      await live.disconnect();
      sockets.close();
      await new Promise((resolve) => server.close(resolve));
    }
  };
}
