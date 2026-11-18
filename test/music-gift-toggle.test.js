import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import WebSocket from 'ws';
import { startApp } from '../src/app.js';

test('gifting 5-coin Finger Heart or Spinning Soccer toggles background music on and off', async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tlg-music-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  let emitRaw = null;
  const config = { port: 0, host: '127.0.0.1', allowLan: false, provider: 'tiktok', startGame: 'english' };
  const providerFactories = {
    tiktok: (opts) => {
      emitRaw = opts.emit;
      return {
        start: async () => ({ roomId: 'test-room-1' }),
        stop: async () => {}
      };
    }
  };

  const app = await startApp(config, { dataDir, tickMs: 50, providerFactories });
  t.after(() => app.close());

  // Connect live
  await app.live.connect('tester', 'tiktok');

  const ws = new WebSocket(`ws://127.0.0.1:${app.port}/ws`, { origin: `http://127.0.0.1:${app.port}` });
  const messages = [];
  ws.on('message', (raw) => messages.push(JSON.parse(raw)));
  await new Promise((r) => ws.once('open', r));
  ws.send(JSON.stringify({ t: 'auth', token: app.adminToken }));

  // Wait for initial hello
  for (let i = 0; i < 50 && !messages.some((m) => m.t === 'hello'); i += 1) {
    await new Promise((r) => setTimeout(r, 20));
  }

  // Initial state: music is true
  // Test turning OFF music with Spinning Soccer (id 105781, 5 coins)
  emitRaw({
    type: 'gift',
    id: 'g-test-1',
    user: { id: 'u1', nickname: 'Khách Một', uniqueId: 'u1' },
    giftRaw: {
      id: '105781',
      name: 'Spinning Soccer',
      diamondsEach: 5,
      repeatCount: 1,
      repeatEnd: 1
    }
  });

  for (let i = 0; i < 50 && !messages.some((m) => m.t === 'settings' && m.settings?.music === false); i += 1) {
    await new Promise((r) => setTimeout(r, 20));
  }

  const offSettingsMsg = messages.find((m) => m.t === 'settings' && m.settings?.music === false);
  assert.ok(offSettingsMsg, 'Settings should broadcast music: false');

  // Verify toast fx was sent
  const offFx = messages.find((m) => m.t === 'fx' && m.list?.some((f) => f.text?.includes('TẮT NHẠC NỀN')));
  assert.ok(offFx, 'Fx should include TẮT NHẠC NỀN toast');

  // Test turning ON music with Finger Heart (id 5487, 5 coins)
  emitRaw({
    type: 'gift',
    id: 'g-test-2',
    user: { id: 'u2', nickname: 'Khách Hai', uniqueId: 'u2' },
    giftRaw: {
      id: '5487',
      name: 'Finger Heart',
      diamondsEach: 5,
      repeatCount: 1,
      repeatEnd: 1
    }
  });

  for (let i = 0; i < 50 && !messages.some((m) => m.t === 'settings' && m.settings?.music === true); i += 1) {
    await new Promise((r) => setTimeout(r, 20));
  }

  const onSettingsMsg = messages.filter((m) => m.t === 'settings').at(-1);
  assert.equal(onSettingsMsg?.settings?.music, true, 'Settings should broadcast music: true');

  const onFx = messages.find((m) => m.t === 'fx' && m.list?.some((f) => f.text?.includes('BẬT NHẠC NỀN')));
  assert.ok(onFx, 'Fx should include BẬT NHẠC NỀN toast');

  ws.close();
});
