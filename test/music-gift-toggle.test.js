import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import WebSocket from 'ws';
import { startApp } from '../src/app.js';
import { defaultEnglishRules, defaultMusicGifts } from '../public/shared/english-sets.js';
import { normalizeMusicGifts, normalizeRules, giftOptions } from '../src/games/quiz/english-gift-rules.js';

test('default music gifts do not overlap with default English rules', () => {
  const mg = defaultMusicGifts();
  const rules = defaultEnglishRules();
  const ruleGiftIds = new Set(rules.map((r) => String(r.gift?.id)));

  assert.ok(mg.on?.id && mg.off?.id);
  assert.notEqual(mg.on.id, mg.off.id, 'Quà bật và tắt nhạc không được trùng nhau');
  assert.ok(!ruleGiftIds.has(String(mg.on.id)), 'Quà bật nhạc không được trùng với quà tiếng Anh');
  assert.ok(!ruleGiftIds.has(String(mg.off.id)), 'Quà tắt nhạc không được trùng với quà tiếng Anh');
});

test('normalizeMusicGifts validates duplicate with English rules and each other', () => {
  const options = giftOptions([]);
  const opt = (name) => options.find((g) => g.name === name);
  const mg = {
    enabled: true,
    on: { id: opt('Encore Ticket').id },
    off: { id: opt('Name shoutout').id }
  };
  const normalized = normalizeMusicGifts(mg, options, []);
  assert.equal(normalized.on.name, 'Encore Ticket');
  assert.equal(normalized.off.name, 'Name shoutout');

  // Trùng quà bật và tắt
  assert.throws(() => normalizeMusicGifts({ enabled: true, on: { id: opt('Rose').id }, off: { id: opt('Rose').id } }, options, []), /trùng nhau/);

  // Trùng với quà tiếng Anh
  const engRules = [{ gift: { id: opt('Encore Ticket').id, name: 'Encore Ticket' }, enabled: true }];
  assert.throws(() => normalizeMusicGifts(mg, options, engRules), /bảng quà đổi chế độ/);

  // normalizeRules phát hiện trùng với quà nhạc
  assert.throws(() => normalizeRules([{ to: 'easy', giftId: opt('Encore Ticket').id }], options, normalized), /quà BẬT nhạc/);
});

test('gifting default 5-coin Encore Ticket or Name shoutout toggles music', async (t) => {
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

  await app.live.connect('tester', 'tiktok');

  const ws = new WebSocket(`ws://127.0.0.1:${app.port}/ws`, { origin: `http://127.0.0.1:${app.port}` });
  const messages = [];
  ws.on('message', (raw) => messages.push(JSON.parse(raw)));
  await new Promise((r) => ws.once('open', r));
  ws.send(JSON.stringify({ t: 'auth', token: app.adminToken }));

  for (let i = 0; i < 50 && !messages.some((m) => m.t === 'hello'); i += 1) {
    await new Promise((r) => setTimeout(r, 20));
  }

  // TẮT NHẠC với Name shoutout (19445, 5💎)
  emitRaw({
    type: 'gift',
    id: 'g-test-1',
    user: { id: 'u1', nickname: 'Khách Một', uniqueId: 'u1' },
    giftRaw: {
      id: '19445',
      name: 'Name shoutout',
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

  const offFx = messages.find((m) => m.t === 'fx' && m.list?.some((f) => f.text?.includes('TẮT NHẠC NỀN')));
  assert.ok(offFx, 'Fx should include TẮT NHẠC NỀN toast');

  // BẬT NHẠC với Encore Ticket (1137702, 5💎)
  emitRaw({
    type: 'gift',
    id: 'g-test-2',
    user: { id: 'u2', nickname: 'Khách Hai', uniqueId: 'u2' },
    giftRaw: {
      id: '1137702',
      name: 'Encore Ticket',
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
