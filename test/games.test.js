import assert from 'node:assert/strict';
import test from 'node:test';
import { createBarClubGame, BAR_SEATS, VIBE_GOAL, drinkForDiamonds } from '../src/games/bar-club-game.js';
import { createSwimPushGame, GOAL_METERS, WIN_TARGET, helperForGift } from '../src/games/swim-push-game.js';
import { createTempleGame, TEMPLE_SLOTS } from '../src/games/temple-game.js';
import { createGameHub } from '../src/games/game-hub.js';
import { FORTUNES } from '../src/games/temple-fortunes.js';

const user = (n) => ({ id: `u${n}`, uniqueId: `u${n}`, nickname: `Người ${n}`, avatar: '' });
const chat = (n, comment) => ({ type: 'chat', user: user(n), comment });
const gift = (n, diamondsEach, count = 1) => ({ type: 'gift', user: user(n),
  gift: { id: 'g', name: 'Quà', diamondsEach, count, diamonds: diamondsEach * count } });
const like = (n, likeCount = 5) => ({ type: 'like', user: user(n), likeCount });
const kinds = (fx) => fx.map((f) => f.kind);

test('bar: chat joins, seats are unique, full bar evicts the idlest non-VIP', () => {
  const bar = createBarClubGame({ random: () => 0.5 });
  bar.handleEvent(gift(0, 50), 0); // u0 là VIP
  for (let i = 1; i < BAR_SEATS; i += 1) bar.handleEvent(chat(i, 'xin chào'), i);
  const seats = bar.snapshot(100).patrons.map((p) => p.seat);
  assert.equal(new Set(seats).size, BAR_SEATS);
  const fx = bar.handleEvent(chat(99, 'cho vào với'), 1000);
  assert.deepEqual(kinds(fx).slice(0, 2), ['leave', 'join']);
  assert.equal(fx[0].userId, 'u1'); // u1 im lâu nhất, u0 là VIP nên được giữ
  assert.equal(bar.handleEvent(like(200), 1001).length, 0); // thả tim không đuổi ai
});

test('bar: drinks by gift value, dance command, vibe fills into a party', () => {
  assert.deepEqual([1, 5, 30, 100, 500].map(drinkForDiamonds), ['beer', 'cocktail', 'champagne', 'tower', 'party']);
  const bar = createBarClubGame();
  bar.handleEvent(chat(1, 'Nhảy đi mọi người'), 0);
  assert.equal(bar.snapshot(100).patrons[0].dancing, true);
  assert.equal(bar.snapshot(9000).patrons[0].dancing, false);
  const fx = bar.handleEvent(gift(2, 1, VIBE_GOAL / 10), 10);
  assert.ok(kinds(fx).includes('party'));
  assert.ok(bar.snapshot(20).patrons.every((p) => p.dancing));
  assert.equal(bar.snapshot(20).vibe, 0);
});

test('bar: dirty chat is not shown as a bubble', () => {
  const bar = createBarClubGame();
  assert.ok(!kinds(bar.handleEvent(chat(1, 'đm quán'), 0)).includes('bubble'));
  assert.ok(kinds(bar.handleEvent(chat(1, 'quán xịn quá'), 10000)).includes('bubble'));
});

test('swim: walls stop the swimmer until helpers break them', () => {
  assert.equal(helperForGift(1).helper, 'flipper');
  assert.equal(helperForGift(30).helper, 'dolphin');
  assert.equal(helperForGift(5000).helper, 'submarine');
  const swim = createSwimPushGame();
  swim.tick(0);
  // 2 m/s: tới tường 200 m sau 100 giây, rồi tự đập tường 2 máu/giây
  for (let t = 1000; t <= 120000; t += 1000) swim.tick(t);
  let s = swim.snapshot(120000);
  assert.equal(s.position, 200);
  assert.equal(s.blocked, true);
  assert.equal(s.walls[0].hp, 80);
  const fx = swim.handleEvent(gift(1, 99, 1), 120001); // cá mập 150 > 80 máu còn lại
  assert.ok(kinds(fx).includes('wallBreak'));
  s = swim.snapshot(120001);
  assert.equal(s.walls[0].hp, 0);
  assert.equal(s.position, 270);
  assert.equal(s.contributors[0].meters, 150);
});

test('swim: finishing counts a win, resets the round, champion resets wins', () => {
  const swim = createSwimPushGame();
  let now = 0;
  for (let win = 1; win <= WIN_TARGET; win += 1) {
    const fx = swim.handleEvent(gift(1, 499, 20), (now += 10));
    assert.ok(kinds(fx).includes(win === WIN_TARGET ? 'champion' : 'finish'));
    assert.equal(swim.snapshot(now).position, GOAL_METERS);
    assert.equal(swim.handleEvent(gift(1, 499), now + 1).length, 0); // đang ăn mừng thì bỏ qua
    assert.ok(kinds(swim.tick((now += 9000))).includes('roundStart'));
    assert.equal(swim.snapshot(now).position, 0);
  }
  assert.equal(swim.snapshot(now).wins, 0);
});

test('swim: likes send ducks, cheering has a cooldown, flippers speed up', () => {
  const swim = createSwimPushGame();
  assert.equal(swim.handleEvent(like(1, 15), 0)[0].units, 3);
  assert.equal(swim.handleEvent(chat(2, 'cố lên!!'), 0).length, 1);
  assert.equal(swim.handleEvent(chat(2, 'cố lên!!'), 1000).length, 0);
  swim.handleEvent(gift(3, 1, 1), 0);
  swim.tick(0);
  const before = swim.snapshot(0).position;
  swim.tick(1000);
  assert.equal(Math.round((swim.snapshot(1000).position - before) * 10) / 10, 3.6);
});

test('temple: likes strike the wooden fish, chat rituals, fortune queue with cooldown', () => {
  const temple = createTempleGame({ random: () => 0 });
  assert.deepEqual(kinds(temple.handleEvent(like(1, 7), 0)), ['join', 'mo']);
  assert.equal(temple.snapshot(0).totals.mo, 7);
  assert.ok(kinds(temple.handleEvent(chat(1, 'Thắp hương cầu an'), 1)).includes('incense'));
  assert.ok(kinds(temple.handleEvent(chat(2, 'cầu cho gia đình bình an'), 1)).includes('prayer'));
  assert.ok(!kinds(temple.handleEvent(chat(3, 'cầu đm'), 1)).includes('prayer'));
  temple.handleEvent(chat(4, 'xin xăm'), 2);
  temple.handleEvent(chat(4, 'xin xăm'), 3); // trong thời gian chờ: không vào hàng
  assert.equal(temple.snapshot(3).fortuneQueue, 1);
  const shown = temple.tick(4).find((f) => f.kind === 'fortune');
  assert.equal(shown.number, 1);
  assert.equal(shown.poem.length, 4);
  assert.ok(FORTUNES.every((f) => f.poem.length === 4 && f.meaning && f.rank));
});

test('temple: top merit kneels in front, full hall evicts non-VIP', () => {
  const temple = createTempleGame();
  for (let i = 0; i < TEMPLE_SLOTS; i += 1) temple.handleEvent(chat(i, 'chào'), i);
  temple.handleEvent(gift(29, 100), 100);
  const snap = temple.snapshot(100);
  assert.equal(snap.devotees[0].id, 'u29');
  assert.equal(snap.devotees[0].vip, true);
  assert.equal(snap.board[0].points, 1000);
  const fx = temple.handleEvent(chat(500, 'chào'), 200);
  assert.equal(fx[0].kind, 'leave');
  assert.notEqual(fx[0].userId, 'u29');
});

test('hub: only the active game gets events; switching keeps the other game state', () => {
  const hub = createGameHub({ startGame: 'bar' });
  hub.handleEvent(chat(1, 'hello'), 0);
  hub.switchTo('swim');
  hub.handleEvent(gift(1, 30), 1);
  assert.equal(hub.snapshot(1).game, 'swim');
  assert.equal(hub.snapshot(1).state.position, 90);
  hub.switchTo('bar');
  assert.equal(hub.snapshot(2).state.patrons.length, 1);
  assert.equal(hub.snapshot(2).top[0].diamonds, 30);
  assert.throws(() => hub.switchTo('casino'));
  hub.handleEvent({ ...chat(2, 'x'), simulated: true }, 5);
  assert.equal(hub.snapshot(6).testMode, true);
  assert.equal(hub.snapshot(30000).testMode, false);
});
