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

test('entering the live puts the viewer on the floor without typing anything', () => {
  const game = createDanceHallGame();
  const fx = game.handleEvent({ type: 'member', user: { ...user(1), avatar: 'https://example.test/a.webp' } }, 0);
  assert.ok(fx.some((f) => f.kind === 'join' && f.userId === 'u1'));
  const d = dancer(game, 'u1');
  assert.equal(d.nickname, 'Người 1');
  assert.equal(d.avatar, 'https://example.test/a.webp');
  assert.ok(d.slot >= 0);
  // sàn đầy người đã tham gia: người chỉ vào xem không đẩy ai ra; còn người im lặng thì nhường chỗ cho người mới
  const full = createDanceHallGame();
  for (let i = 1; i <= DANCE_SLOTS; i += 1) full.handleEvent(chat(i, 'hello'), i);
  full.handleEvent({ type: 'member', user: user(9001) }, 9000);
  assert.equal(dancer(full, 'u9001'), undefined);
  const mixed = createDanceHallGame();
  mixed.handleEvent({ type: 'member', user: user(1) }, 0);
  for (let i = 2; i <= DANCE_SLOTS; i += 1) mixed.handleEvent(chat(i, 'hello'), i);
  mixed.handleEvent({ type: 'member', user: user(9001) }, 9000);
  assert.ok(dancer(mixed, 'u9001'));
  assert.equal(dancer(mixed, 'u1'), undefined);
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

test('a first follow gets the full package: big card, a stage solo, neon fan wings — shares get the camera', () => {
  const game = createDanceHallGame();
  const fx = game.handleEvent({ type: 'follow', user: user(7) }, 0);
  assert.ok(fx.some((f) => f.kind === 'follow' && f.userId === 'u7'));
  assert.ok(kinds(fx).includes('fireworks'));
  assert.ok(fx.some((f) => f.kind === 'solo' && f.userId === 'u7'));
  const fan = dancer(game, 'u7');
  assert.equal(fan.fan, true);
  assert.equal(fan.wings, true);
  assert.equal(fan.aura, true);
  assert.equal(dancer(game, 'u7', 10 * 60000 + 1).fan, false);
  // quà bậc 2+ vẫn diễn trước người follow đang chờ
  const busy = createDanceHallGame();
  busy.handleEvent(gift(1, 100), 0);
  busy.handleEvent({ type: 'follow', user: user(2) }, 10);
  busy.handleEvent(gift(3, 20), 20);
  const order = [];
  for (let t = 0; t < 60000; t += 500) for (const f of busy.tick(t)) if (f.kind === 'solo') order.push(f.userId);
  assert.deepEqual(order, ['u3', 'u2']);
  // follow lại (bỏ follow rồi follow) chỉ được lên camera, không solo/thẻ lần nữa
  const again = game.handleEvent({ type: 'follow', user: user(7) }, 30000);
  assert.ok(again.some((f) => f.kind === 'camera' && f.reason === 'follow'));
  assert.ok(!again.some((f) => f.kind === 'follow' || (f.kind === 'solo' && f.userId === 'u7')));
  // share: lên camera mỗi lần, không giới hạn
  for (let i = 0; i < 5; i += 1) {
    assert.ok(game.handleEvent({ type: 'share', user: user(8) }, 40000 + i).some((f) => f.kind === 'camera' && f.userId === 'u8'));
  }
});

test('an empty floor gets a few made-up dancers, and real viewers take their spots one by one', () => {
  const game = createDanceHallGame({ seedCount: 10 });
  game.tick(0);
  const seeds = () => game.snapshot(0).dancers.filter((d) => d.id.startsWith('seed:'));
  assert.equal(seeds().length, 10);
  assert.equal(new Set(seeds().map((d) => d.nickname)).size, 10);
  const best = seeds().sort((a, b) => DANCE_FILL_ORDER.indexOf(a.slot) - DANCE_FILL_ORDER.indexOf(b.slot))[0].slot;
  // người thật vào: thay đúng chỗ đẹp nhất của một người ảo
  const fx = game.handleEvent({ type: 'member', user: user(1) }, 100);
  assert.equal(fx.filter((f) => f.kind === 'leave' && f.userId.startsWith('seed:')).length, 1);
  assert.equal(dancer(game, 'u1').slot, best);
  assert.equal(seeds().length, 9);
  for (let i = 2; i <= 12; i += 1) game.handleEvent(chat(i, 'hello'), 200 + i);
  game.tick(1000);
  assert.equal(seeds().length, 0);
  // người ảo không tự rời sau 5 phút im lặng; người thật rời hết thì người ảo quay lại
  const quiet = createDanceHallGame({ seedCount: 4 });
  quiet.tick(0);
  quiet.tick(30 * 60000);
  assert.equal(quiet.snapshot(30 * 60000).dancers.length, 4);
  game.command('clear', 2000);
  game.tick(2100);
  assert.equal(seeds().length, 10);
  // người ảo không vào Top, không solo; tắt được từ trang điều khiển
  assert.ok(seeds().every((d) => d.rank === 0));
  game.command('seeds', 3000);
  assert.equal(seeds().length, 0);
  game.tick(3100);
  assert.equal(seeds().length, 0);
});

test('without a seed count the floor starts empty', () => {
  const game = createDanceHallGame();
  game.tick(0);
  assert.equal(game.snapshot(0).dancers.length, 0);
});
