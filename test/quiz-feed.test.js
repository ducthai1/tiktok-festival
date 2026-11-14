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

test('👑 Bảng vàng loads the whole gift history (data/gifts.log), keeps it through restarts and "Xoá dữ liệu phiên live trước"', () => {
  const log = [
    '[2026-11-10 20:01:02] [GIFT] Người 1 (@u1): Rose x30 (30💎)',
    '[2026-11-10 20:05:00] [GIFT] Tên (có ngoặc) x2 (@u2): Hộp x quà x1 (99💎)',
    'dòng hỏng',
    '[2026-11-11 21:00:00] [GIFT] Người 3 (@u3): Rose x5 (5💎)',
    '[2026-11-12 21:00:00] [GIFT] Người 1 đổi tên (@u1): Rose x80 (80💎)',
    '[2026-11-12 21:01:00] [GIFT] Người 4 (@u4): Rose x1 (1💎)'
  ].join('\n');
  const hub = createGameHub({ startGame: 'lophoc' });
  hub.loadGiftHistory(log);
  hub.tick(0);
  assert.deepEqual(hub.snapshot(10).state.donators.map((d) => [d.nickname, d.diamonds]),
    [['Người 1 đổi tên', 110], ['Tên (có ngoặc) x2', 99], ['Người 3', 5]]);
  // quà mới cộng dồn; người có mặt trong live → có ảnh đại diện
  hub.handleEvent({ type: 'gift', user: { ...user(4), avatar: 'https://a/4.webp' }, gift: { id: 'g', name: 'Q', diamondsEach: 9, count: 1, diamonds: 9 } }, 20);
  assert.deepEqual(hub.snapshot(30).state.donators.map((d) => [d.id, d.diamonds, d.avatar]), [['u1', 110, ''], ['u2', 99, ''], ['u4', 10, 'https://a/4.webp']]);
  // khởi động lại: đọc lại log (đã có dòng quà mới) + bản lưu nóng giữ ảnh
  const again = createGameHub({ startGame: 'lophoc' });
  again.loadGiftHistory(`${log}\n[2026-11-14 20:00:00] [GIFT] Người 4 (@u4): Q x1 (9💎)`);
  again.restore(JSON.parse(JSON.stringify(hub.snapshot(40))));
  assert.deepEqual(again.snapshot(50).state.donators.map((d) => [d.id, d.diamonds, d.avatar]), [['u1', 110, ''], ['u2', 99, ''], ['u4', 10, 'https://a/4.webp']]);
  // quà THỬ chỉ tạm: hiện ngay, "Xoá dữ liệu phiên live trước" bỏ quà thử nhưng giữ lịch sử thật
  again.handleEvent({ type: 'gift', simulated: true, user: user(9), gift: { id: 'g', name: 'Q', diamondsEach: 500, count: 1, diamonds: 500 } }, 60);
  assert.equal(again.snapshot(70).state.donators[0].diamonds, 500);
  again.resetAll();
  assert.deepEqual(again.snapshot(80).state.donators.map((d) => d.diamonds), [110, 99, 10]);
});
