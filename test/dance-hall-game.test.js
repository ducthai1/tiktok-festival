import assert from 'node:assert/strict';
import test from 'node:test';
import { DANCE_FILL_ORDER, DANCE_SLOTS, slotPosition } from '../public/shared/dance-floor-layout.js';
import { createDanceHallGame, faceForComment, HYPE_GOAL } from '../src/games/dance-hall-game.js';

const user = (n) => ({ id: `u${n}`, uniqueId: `u${n}`, nickname: `Người ${n}`, avatar: '' });
const chat = (n, comment) => ({ type: 'chat', user: user(n), comment });
const gift = (n, diamondsEach, count = 1) => ({ type: 'gift', user: user(n),
  gift: { name: 'Quà', pictureUrl: '', diamondsEach, count, diamonds: diamondsEach * count } });
const kinds = (fx) => fx.map((f) => f.kind);
const dancer = (game, id, now = 0) => game.snapshot(now).dancers.find((d) => d.id === id);

test('the floor holds a big crowd and the first comers stand near the camera, in the middle', () => {
  assert.ok(DANCE_SLOTS >= 100);
  assert.equal(new Set(DANCE_FILL_ORDER).size, DANCE_SLOTS);
  const first = slotPosition(DANCE_FILL_ORDER[0]);
  const last = slotPosition(DANCE_FILL_ORDER[DANCE_SLOTS - 1]);
  assert.equal(first.row, 0);
  assert.ok(Math.abs(first.x) < 0.8);
  assert.ok(last.z < first.z);
});

test('anyone who comments gets a dancer, and keeps the same spot while others come and go', () => {
  const game = createDanceHallGame({ random: () => 0.5 });
  game.handleEvent(chat(1, 'hello'), 0);
  game.handleEvent(chat(2, 'xin chào'), 0);
  const slot2 = dancer(game, 'u2').slot;
  game.command('clear', 0);
  game.handleEvent(chat(2, 'quay lại nè'), 10);
  game.handleEvent(chat(3, 'hi'), 20);
  assert.equal(game.snapshot().dancers.length, 2);
  assert.equal(dancer(game, 'u2').slot, DANCE_FILL_ORDER[0]);
  assert.ok(Number.isInteger(slot2));
});

test('free comments: "quẩy" dances hard, "chào" waves, "đổi đồ" changes the outfit, emoji changes the face', () => {
  const game = createDanceHallGame({ random: () => 0.5 });
  game.handleEvent(chat(1, 'quẩy lên'), 0);
  assert.equal(dancer(game, 'u1').move, 'hype');
  game.handleEvent(chat(2, 'chào cả nhà'), 0);
  assert.equal(dancer(game, 'u2').move, 'wave');
  const look = dancer(game, 'u2').look;
  assert.ok(kinds(game.handleEvent(chat(2, 'đổi đồ đi'), 4000)).includes('look'));
  assert.notEqual(dancer(game, 'u2', 4000).look, look);
  game.handleEvent(chat(3, 'haha 😂'), 0);
  assert.equal(dancer(game, 'u3').face, 'laugh');
  assert.equal(faceForComment('đẹp quá idol'), 'star');
  assert.equal(faceForComment('ngủ ngon'), 'sleepy');
  assert.equal(faceForComment('ok'), '');
});

test('"nhảy" jumps once, "đi vòng" walks a loop, "to lên"/"nhỏ lại" resize within limits, 1k hearts puts you on camera', () => {
  const game = createDanceHallGame({ random: () => 0.5 });
  game.handleEvent(chat(1, 'nhảy 1 cái'), 0);
  assert.equal(dancer(game, 'u1').move, 'jump');
  assert.equal(dancer(game, 'u1', 2000).move, '');
  game.handleEvent(chat(2, 'đi vòng'), 0);
  assert.equal(dancer(game, 'u2', 5000).move, 'walk');
  for (let i = 0; i < 6; i += 1) game.handleEvent(chat(3, 'to lên'), i * 4000);
  assert.equal(dancer(game, 'u3', 30000).size, 1.6);
  for (let i = 0; i < 9; i += 1) game.handleEvent(chat(3, 'nhỏ lại'), 40000 + i * 4000);
  assert.equal(dancer(game, 'u3', 90000).size, 0.6);
  let fx = [];
  for (let i = 0; i < 40; i += 1) fx = fx.concat(game.handleEvent({ type: 'like', user: user(4), likeCount: 30 }, i * 100));
  assert.equal(fx.filter((f) => f.kind === 'camera').length, 1);
  assert.equal(dancer(game, 'u4', 4000).wings, true); // 1k tim có cánh
  game.handleEvent(gift(5, 1), 0);
  assert.equal(dancer(game, 'u5').wings, true);
});

test('likes fill the hype meter and a full meter drops the beat for everyone', () => {
  const game = createDanceHallGame();
  let fx = [];
  for (let i = 0; i * 30 < HYPE_GOAL; i += 1) fx = fx.concat(game.handleEvent({ type: 'like', user: user(i), likeCount: 30 }, i));
  assert.ok(kinds(fx).includes('drop'));
  const snap = game.snapshot(HYPE_GOAL);
  assert.ok(snap.dropMs > 0);
  assert.ok(snap.dancers.every((d) => d.move === 'hype'));
});

test('a rose gives an aura but no solo; bigger gifts get a solo on stage, best gift first', () => {
  const game = createDanceHallGame();
  const fx = game.handleEvent(gift(1, 1), 0);
  assert.ok(!kinds(fx).includes('solo'));
  assert.equal(dancer(game, 'u1').aura, true);
  assert.equal(game.snapshot().solo, null);
  const first = game.handleEvent(gift(2, 99), 0);
  assert.ok(kinds(first).includes('solo'));
  game.handleEvent(gift(3, 10), 100); // bậc 2 vào hàng chờ
  game.handleEvent(gift(4, 500), 200); // bậc 4 chen lên trước bậc 2
  assert.equal(dancer(game, 'u4').giant, true);
  const after = game.tick(9000 + 1);
  const next = after.find((f) => f.kind === 'solo');
  assert.equal(next.userId, 'u4');
  assert.ok(kinds(after).includes('soloEnd'));
});

test('the biggest gifts launch fireworks and drop the beat, and top gifters keep their place when the floor is full', () => {
  const game = createDanceHallGame();
  const fx = game.handleEvent(gift(1, 20000), 0);
  assert.ok(kinds(fx).includes('fireworks'));
  assert.ok(kinds(fx).includes('drop'));
  for (let i = 2; i <= DANCE_SLOTS + 5; i += 1) game.handleEvent(chat(i, 'hello'), 1000 + i);
  const snap = game.snapshot(5000);
  assert.equal(snap.dancers.length, DANCE_SLOTS);
  assert.equal(dancer(game, 'u1').rank, 1);
});

test('watchers leave after 5 quiet minutes, people who took part after 10', () => {
  const game = createDanceHallGame();
  game.handleEvent({ type: 'member', user: user(1) }, 0);
  game.handleEvent(chat(2, 'hello'), 0);
  const leftAt = (min) => game.tick(min * 60000).filter((f) => f.kind === 'leave').map((f) => f.userId);
  assert.deepEqual(leftAt(5.1), ['u1']);
  assert.deepEqual(leftAt(9.9), []);
  assert.deepEqual(leftAt(10.1), ['u2']);
});

test('neighbouring dancers never share a character and the floor is mostly Chinese meme stickers', async () => {
  const fs = await import('node:fs');
  const { buildPool, characterForSlot } = await import('../public/stage/scenes/dance-roster.js');
  const sheets = JSON.parse(fs.readFileSync(new URL('../public/assets/dance/sheets.json', import.meta.url), 'utf8'));
  const pool = buildPool(sheets);
  const ids = Array.from({ length: DANCE_SLOTS }, (_, s) => characterForSlot(pool, s, 0).id);
  for (let s = 0; s < DANCE_SLOTS; s += 1) {
    const p = slotPosition(s);
    for (let t = s + 1; t < DANCE_SLOTS; t += 1) {
      const q = slotPosition(t);
      if (Math.abs(p.x - q.x) < 0.9 && Math.abs(p.z - q.z) < 0.7) assert.notEqual(ids[s], ids[t], `ô ${s} và ${t} trùng nhân vật`);
    }
  }
  assert.ok(ids.filter((id) => !id.startsWith('nv')).length / DANCE_SLOTS > 0.7);
});

test('a handful of dancers spread over the whole floor instead of huddling in the middle', async () => {
  const { spreadSlotPosition, DANCE_FILL_ORDER: order } = await import('../public/shared/dance-floor-layout.js');
  const xs = order.slice(0, 10).map((slot) => spreadSlotPosition(slot, 10));
  const width = Math.max(...xs.map((p) => p.x)) - Math.min(...xs.map((p) => p.x));
  const depth = Math.max(...xs.map((p) => p.z)) - Math.min(...xs.map((p) => p.z));
  assert.ok(width > 5, `10 người chỉ trải ${width.toFixed(1)} m ngang`);
  assert.ok(depth > 5, `10 người chỉ trải ${depth.toFixed(1)} m sâu`);
  const full = order.map((slot) => spreadSlotPosition(slot, DANCE_SLOTS));
  assert.deepEqual(full[0], slotPosition(order[0])); // sàn đầy thì về đúng lưới gốc
});

test('a new follower or a share gets the camera on them', () => {
  const game = createDanceHallGame();
  const fx = game.handleEvent({ type: 'follow', user: user(7) }, 0);
  const cam = fx.find((f) => f.kind === 'camera');
  assert.equal(cam.userId, 'u7');
  assert.equal(cam.reason, 'follow');
  assert.ok(game.handleEvent({ type: 'share', user: user(8) }, 0).some((f) => f.kind === 'camera' && f.userId === 'u8'));
});
