import assert from 'node:assert/strict';
import test from 'node:test';
import { createQuizGame } from '../src/games/quiz/quiz-game.js';
import { createGameHub } from '../src/games/game-hub.js';

const user = (n) => ({ id: `u${n}`, uniqueId: `u${n}`, nickname: `Người ${n}`, avatar: '' });
const word = (answer) => ({ kind: 'text', category: 'T', answer, prompt: '?', accept: [answer.toLowerCase()] });
const deck = () => {
  let i = 0;
  return { next: () => word(`W${(i += 1)}`) };
};

test('💬 comments box: server order, seconds since the question appeared, medals for who answered right (settles "I was first")', () => {
  const game = createQuizGame({ id: 't', title: 'T', deck: deck() });
  game.tick(1000);
  game.handleEvent({ type: 'chat', user: user(1), comment: 'w2' }, 2200); // sai
  game.handleEvent({ type: 'chat', user: user(2), comment: 'w1' }, 3400); // đúng thứ 1
  game.handleEvent({ type: 'chat', user: user(3), comment: '  W1 ' }, 3450); // đúng thứ 2
  game.handleEvent({ type: 'chat', user: { ...user(4), nickname: 'đụ má' }, comment: 'w1' }, 3500);
  const c = game.snapshot(3600).comments;
  assert.deepEqual(c.map((x) => [x.nickname, x.text, x.t, x.rank]),
    [['Người 1', 'w2', 1.2, 0], ['Người 2', 'w1', 2.4, 1], ['Người 3', 'W1', 2.5, 2], ['Người xem', 'w1', 2.5, 3]]);
  assert.ok(c.every((x, i) => i === 0 || x.key > c[i - 1].key)); // khoá tăng dần = đúng thứ tự máy chủ nhận
  for (let i = 0; i < 30; i += 1) game.handleEvent({ type: 'chat', user: user(5), comment: `x${i}` }, 4000 + i);
  assert.equal(game.snapshot(5000).comments.length, 12);
});

test('👑 Bảng vàng counts gifts that switch the English mode too (it used to stay empty on the English tab)', () => {
  const hub = createGameHub({ startGame: 'english' });
  hub.tick(0);
  hub.handleEvent({ type: 'gift', user: user(1), gift: { id: '8913', name: 'Rosa', diamondsEach: 10, count: 1, diamonds: 10 } }, 10); // Rosa → Trường học
  hub.handleEvent({ type: 'gift', user: user(2), gift: { id: 'x', name: 'Cap', diamondsEach: 99, count: 1, diamonds: 99 } }, 20);
  assert.deepEqual(hub.snapshot(30).state.donators.map((d) => [d.id, d.diamonds]), [['u2', 99], ['u1', 10]]);
});

test('👑 Bảng vàng: top 3 by 💎, kept after a restart (hot backup), cleared by "Xoá dữ liệu phiên live trước"', () => {
  const hub = createGameHub({ startGame: 'lophoc' });
  hub.tick(0);
  const gift = (n, d, t) => hub.handleEvent({ type: 'gift', user: user(n), gift: { id: 'g', name: 'Q', diamondsEach: d, count: 1, diamonds: d } }, t);
  gift(1, 30, 10); gift(2, 99, 20); gift(1, 80, 30); gift(3, 5, 40); gift(4, 1, 50);
  const gold = hub.snapshot(60).state.donators;
  assert.deepEqual(gold.map((d) => [d.id, d.diamonds]), [['u1', 110], ['u2', 99], ['u3', 5]]);
  const again = createGameHub({ startGame: 'lophoc' });
  again.restore(JSON.parse(JSON.stringify(hub.snapshot(60))));
  assert.deepEqual(again.snapshot(70).state.donators.map((d) => d.diamonds), [110, 99, 5]);
  hub.resetAll();
  assert.deepEqual(hub.snapshot(80).state.donators, []);
});
