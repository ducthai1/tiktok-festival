import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import WebSocket from 'ws';
import { startApp } from '../src/app.js';

const config = { port: 0, host: '127.0.0.1', allowLan: false, provider: 'tiktok', startGame: 'bar' };
const fakeProviders = {
  tiktok: () => ({ start: async () => ({ roomId: '1' }), stop: async () => {} }),
  tikfinity: () => ({ start: async () => ({ roomId: 't' }), stop: async () => {} })
};

function get(port, urlPath, host = `127.0.0.1:${port}`) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: urlPath, headers: { Host: host } }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on('error', reject);
  });
}

function openSocket(port, origin = `http://127.0.0.1:${port}`) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin });
    const inbox = [];
    ws.on('message', (raw) => inbox.push(JSON.parse(raw.toString())));
    ws.once('open', () => resolve({ ws, inbox }));
    ws.once('unexpected-response', (_req, res) => reject(new Error(`HTTP ${res.statusCode}`)));
    ws.once('error', reject);
  });
}

const waitFor = async (inbox, predicate, ms = 2000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const hit = inbox.find(predicate);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('timeout');
};

test('HTTP and WebSocket refuse foreign hosts/origins; stage is read-only; admin needs token', async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tlg-'));
  const app = await startApp(config, { dataDir, providerFactories: fakeProviders, tickMs: 50 });
  t.after(async () => {
    await app.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  const { port } = app;

  const page = await get(port, '/stage');
  assert.equal(page.status, 200);
  assert.match(page.headers['content-security-policy'], /script-src 'self';/);
  assert.equal((await get(port, '/stage', 'evil.com')).status, 403);
  assert.equal((await get(port, '/static/../package.json')).status, 404);
  assert.equal((await get(port, '/static/%2e%2e/src/app.js')).status, 404);
  assert.equal((await get(port, '/vendor/three-addons/../../package.json')).status, 404);
  const addon = await get(port, '/vendor/three-addons/postprocessing/UnrealBloomPass.js');
  assert.equal(addon.status, 200);
  assert.doesNotMatch(addon.body, /from\s+'three'/);
  assert.equal(fs.statSync(path.join(dataDir, 'admin-token')).mode & 0o077, 0);

  await assert.rejects(openSocket(port, 'http://evil.com'), /403/);
  await assert.rejects(openSocket(port, `http://127.0.0.1:${port + 1}`), /403/);

  const stage = await openSocket(port);
  await waitFor(stage.inbox, (m) => m.t === 'hello' && m.role === 'stage');
  stage.ws.send(JSON.stringify({ t: 'switch', game: 'swim' }));
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(app.hub.activeId(), 'bar'); // màn hình OBS không ra lệnh được

  const admin = await openSocket(port);
  admin.ws.send(JSON.stringify({ t: 'auth', token: 'sai' }));
  await waitFor(admin.inbox, (m) => m.t === 'authFail');
  admin.ws.send(JSON.stringify({ t: 'auth', token: app.adminToken }));
  await waitFor(admin.inbox, (m) => m.t === 'authOk');
  admin.ws.send(JSON.stringify({ t: 'switch', id: 1, game: 'temple' }));
  await waitFor(admin.inbox, (m) => m.t === 'reply' && m.id === 1 && m.ok);
  assert.equal(app.hub.activeId(), 'temple');
  await waitFor(stage.inbox, (m) => m.t === 'state' && m.game === 'temple');

  admin.ws.send(JSON.stringify({ t: 'test', id: 2, kind: 'like', viewer: 3, likes: 4 }));
  await waitFor(admin.inbox, (m) => m.t === 'reply' && m.id === 2 && m.ok);
  const fx = await waitFor(stage.inbox, (m) => m.t === 'fx' && m.list.some((f) => f.kind === 'mo'));
  assert.equal(fx.game, 'temple');
  await waitFor(stage.inbox, (m) => m.t === 'state' && m.testMode === true);

  admin.ws.send(JSON.stringify({ t: 'connect', id: 3, username: '@streamer_vn', provider: 'tiktok' }));
  await waitFor(admin.inbox, (m) => m.t === 'reply' && m.id === 3 && m.ok);
  admin.ws.send(JSON.stringify({ t: 'test', id: 4, kind: 'chat', comment: 'hi' }));
  const refused = await waitFor(admin.inbox, (m) => m.t === 'reply' && m.id === 4);
  assert.equal(refused.ok, false); // đang live thật thì không cho bơm sự kiện giả

  const bad = await openSocket(port);
  for (let i = 0; i < 3; i += 1) bad.ws.send(JSON.stringify({ t: 'auth', token: `x${i}` }));
  await new Promise((resolve) => bad.ws.once('close', resolve)); // sai 3 lần thì bị ngắt

  stage.ws.close();
  admin.ws.close();
});
