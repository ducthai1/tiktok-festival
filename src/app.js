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
import { createTikFinityProvider, createTikTokConnectorProvider } from './live/live-providers.js';
import { SAMPLE_GIFTS, tierRepresentatives } from '../public/shared/gift-tiers.js';

const DEFAULT_SETTINGS = {
  activeGame: '', provider: 'tiktok', username: '', tts: false, ttsWelcome: false, legend: true, sound: true, volume: 0.6,
  music: true, musicVolume: 0.35, welcomeTextAbove: 1000
};

function loadSettings(dataDir) {
  try {
    const saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'settings.json'), 'utf8'));
    return { ...DEFAULT_SETTINGS, ...(saved && typeof saved === 'object' ? saved : {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function startApp(config, { dataDir = DATA_DIR, providerFactories, tickMs = 100 } = {}) {
  fs.mkdirSync(dataDir, { recursive: true });
  const adminToken = loadOrCreateAdminToken(dataDir);
  const settings = loadSettings(dataDir);
  const hub = createGameHub({ startGame: settings.activeGame || config.startGame, welcomeTextAbove: settings.welcomeTextAbove });
  let port = config.port;
  let lastStateText = '';
  let giftTiers = tierRepresentatives(SAMPLE_GIFTS, 3); // quà đại diện từng bậc; nối live thì thay bằng quà thật của phòng

  const updateSettings = (patch) => {
    Object.assign(settings, patch);
    fs.writeFileSync(path.join(dataDir, 'settings.json'), JSON.stringify(settings, null, 2));
    sockets.broadcast({ t: 'settings', settings: publicSettings() });
  };
  const publicSettings = () => ({
    tts: settings.tts, ttsWelcome: settings.ttsWelcome, legend: settings.legend, sound: settings.sound, volume: settings.volume,
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

  const live = createLiveConnectionManager({
    providerFactories: providerFactories || {
      tiktok: (opts) => createTikTokConnectorProvider({ ...opts, apiKey: config.eulerApiKey }),
      tikfinity: (opts) => createTikFinityProvider({ ...opts, url: config.tikfinityUrl })
    },
    onEvent(event) {
      emitFx(hub.activeId(), hub.handleEvent(event));
      if (event.type === 'viewers') return;
      const text = event.type === 'chat' ? event.comment : event.type === 'gift'
        ? `${event.gift.name} ×${event.gift.count} (${event.gift.diamonds}💎)` : event.type === 'like' ? `${event.likeCount} tim` : '';
      sockets.broadcast({ t: 'log', event: { type: event.type, nickname: event.user.nickname, text, simulated: event.simulated } },
        { adminsOnly: true });
    },
    onStatus(status) {
      sockets.broadcast({ t: 'live', status });
    },
    onCatalog(list) {
      giftTiers = tierRepresentatives(list.map((g) => ({ ...g, image: safeImageUrl(g.image) })), 3);
      sockets.broadcast({ t: 'gifts', tiers: giftTiers });
    }
  });

  const handleAdmin = createAdminCommandHandler({ hub, live, settings, updateSettings, emitFx, pushState });
  const sockets = createSocketHub({
    getPort: () => port,
    allowLan: config.allowLan,
    adminToken,
    onAdminMessage: handleAdmin,
    onClientReady(ws) {
      sockets.send(ws, { t: 'hello', role: ws.role, games: hub.list(), settings: publicSettings(), live: live.status(), giftTiers, sampleGifts: SAMPLE_GIFTS });
      sockets.send(ws, { t: 'state', ...hub.snapshot() });
      if (ws.role === 'admin') sockets.send(ws, { t: 'adminInfo', provider: settings.provider, username: settings.username });
    }
  });

  const serveStatic = createStaticFileServer({ publicDir: PUBLIC_DIR, rootDir: ROOT_DIR });
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
      await live.disconnect();
      sockets.close();
      await new Promise((resolve) => server.close(resolve));
    }
  };
}
