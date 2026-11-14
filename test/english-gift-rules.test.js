import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import WebSocket from 'ws';
import { startApp } from '../src/app.js';
import { giftOptions, normalizeRules } from '../src/games/quiz/english-gift-rules.js';
import { createEnglishSwitcher } from '../src/games/quiz/english-switcher.js';
import { createQuizGame } from '../src/games/quiz/quiz-game.js';
import { accepts } from '../src/games/quiz/quiz-bank.js';
import { defaultEnglishRules } from '../public/shared/english-sets.js';

const word = (answer) => ({ kind: 'text', category: 'Tiếng Anh · Thử', answer, prompt: `${answer} tiếng Anh là gì?`, level: 2, accept: accepts(answer) });
const user = (n) => ({ id: `u${n}`, uniqueId: `u${n}`, nickname: `Người ${n}`, avatar: '' });
const options = giftOptions([]);
const opt = (name) => options.find((g) => g.name === name && g.panel) || options.find((g) => g.name === name);

test('gift rules: the server takes name / REAL price / image from the TikTok gift list, never from the admin page', () => {
  const rules = normalizeRules([{ to: 'nghe', giftId: opt('Heart Me').id, questions: 10, gift: { coins: 999, name: 'Hack' } }], options);
  assert.deepEqual(rules[0].gift, { id: opt('Heart Me').id, name: 'Heart Me', coins: 1, image: opt('Heart Me').image });
  assert.equal(rules[0].questions, 10);
  assert.throws(() => normalizeRules([{ to: 'nghe', giftId: '999999999' }], options), /chọn lại món quà/);
  assert.throws(() => normalizeRules([{ to: 'xxx', giftId: opt('Rose').id }], options), /chế độ không hợp lệ/);
  assert.throws(() => normalizeRules([{ to: 'easy', giftId: opt('Rose').id }, { to: 'hard', giftId: opt('Rose').id }], options), /mỗi món quà chỉ một chế độ/);
  assert.equal(normalizeRules([{ to: 'toeic', giftId: opt('Rosa').id, questions: 'abc' }], options)[0].questions, 20); // mặc định
  // quà thật phòng đã nhận (id số) được thêm vào danh sách chọn; quà thử / quà mẫu (id chữ) thì không
  const withRoom = giftOptions([{ id: '7777777', name: 'Quà Lạ', coins: 99 }, { id: 'corgi-pet', name: 'Corgi', coins: 5 }]);
  assert.ok(withRoom.some((g) => g.id === '7777777' && g.seen) && !withRoom.some((g) => g.id === 'corgi-pet'));
});

test('default rules: every slot enabled + a disabled promo (Heart Me 1 coin → 10 listening questions)', () => {
  const rules = defaultEnglishRules();
  const promo = rules.find((r) => r.gift.name === 'Heart Me');
  assert.deepEqual([promo.to, promo.questions, promo.enabled, promo.gift.coins], ['nghe', 10, false, 1]);
  assert.ok(rules.filter((r) => r !== promo).every((r) => r.enabled));
});

test('listening tiers: Heart Me 1 coin → 10 questions (all 10 protected), Doughnut 30 → 40; a cheaper tier never shortens a running round', () => {
  const sw = createEnglishSwitcher({ general: Array.from({ length: 80 }, (_, i) => word(`GEN${i}`)), basic: [], sets: { toeic: [word('MEMO')] },
    listen: Array.from({ length: 120 }, (_, i) => word(`HEAR${i}`)), listenReady: () => true });
  sw.setRules(normalizeRules([
    { to: 'nghe', giftId: opt('Heart Me').id, questions: 10 }, { to: 'nghe', giftId: opt('Doughnut').id, questions: 40 },
    { to: 'toeic', giftId: opt('Friendship Necklace').id }
  ], options));
  const game = createQuizGame({ id: 'english', title: 'E', deck: sw.deck, onGift: (e) => sw.onGift(e), extraState: () => sw.snapshot() });
  const gift = (n, name, coins, t) => game.handleEvent({ type: 'gift', user: user(n), gift: { name, diamondsEach: coins, count: 1, diamonds: coins } }, t);
  game.tick(0);
  const chips = game.snapshot(0).control.rules.filter((r) => r.to === 'nghe').map((r) => [r.gift.coins, r.questions]);
  assert.deepEqual(chips, [[1, 10], [30, 40]]);
  assert.equal(gift(1, 'Heart Me', 1, 10)[0].questions, 10);
  assert.equal(game.snapshot(10).listen, true);
  assert.equal(gift(2, 'Friendship Necklace', 10, 20)[0].after, 9); // lượt 10 câu: giữ cả 10 câu rồi mới đổi
  let t = 100;
  for (let i = 0; i < 9; i += 1) {
    game.command('next', (t += 10));
    game.command('next', (t += 10));
  }
  assert.equal(game.snapshot(t).listen, true);
  game.command('next', (t += 10));
  game.command('next', (t += 10));
  assert.equal(sw.snapshot().set, 'toeic');
  // lượt 40 câu đang chạy: tặng thêm Heart Me (10 câu) không làm ngắn lượt
  gift(3, 'Doughnut', 30, (t += 10));
  assert.equal(sw.snapshot().setLeft, 39);
  gift(4, 'Heart Me', 1, (t += 10));
  assert.equal(sw.snapshot().setLeft, 39);
});

test('admin "🎁 Quà" tab: saving rules applies them to the screen at once, survives a restart, reset restores defaults', async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tlg-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  const config = { port: 0, host: '127.0.0.1', allowLan: false, provider: 'tiktok', startGame: 'english' };
  const providerFactories = { tiktok: () => ({ start: async () => ({ roomId: '1' }), stop: async () => {} }) };
  let app = await startApp(config, { dataDir, tickMs: 50, providerFactories });
  const request = async (msg) => {
    const ws = new WebSocket(`ws://127.0.0.1:${app.port}/ws`, { origin: `http://127.0.0.1:${app.port}` });
    const inbox = [];
    ws.on('message', (raw) => inbox.push(JSON.parse(raw)));
    await new Promise((r) => ws.once('open', r));
    ws.send(JSON.stringify({ t: 'auth', token: app.adminToken }));
    ws.send(JSON.stringify({ ...msg, id: 7 }));
    for (let i = 0; i < 100 && !inbox.some((m) => m.t === 'reply'); i += 1) await new Promise((r) => setTimeout(r, 20));
    ws.close();
    return inbox.find((m) => m.t === 'reply');
  };
  const view = await request({ t: 'englishGifts' });
  assert.ok(view.ok && view.rules.length && view.options.length && view.targets.some((x) => x.to === 'nghe'));
  const saved = await request({ t: 'saveEnglishGifts', rules: [{ to: 'easy', giftId: opt('Rose').id }, { to: 'toeic', giftId: opt('Doughnut').id, questions: 15 }] });
  assert.ok(saved.ok, saved.message);
  const rulesOnScreen = () => app.hub.snapshot().state.control.rules.map((r) => `${r.gift.name}>${r.to}:${r.questions}`);
  assert.deepEqual(rulesOnScreen(), ['Rose>easy:20', 'Doughnut>toeic:15']);
  const bad = await request({ t: 'saveEnglishGifts', rules: [{ to: 'easy', giftId: 'nope' }] });
  assert.equal(bad.ok, false);
  await app.close();
  app = await startApp(config, { dataDir, tickMs: 50, providerFactories }); // khởi động lại: vẫn bảng đã lưu
  assert.deepEqual(rulesOnScreen(), ['Rose>easy:20', 'Doughnut>toeic:15']);
  const reset = await request({ t: 'resetEnglishGifts' });
  assert.ok(reset.ok && !reset.custom);
  assert.ok(rulesOnScreen().length >= 13);
  await app.close();
});
