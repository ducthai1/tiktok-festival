// Chủ kênh báo: "câu hỏi ra thì đợi cả buổi mới nhận".
//
// Người xem KHÔNG thấy đề cùng lúc với máy chủ: OBS → TikTok → điện thoại mất vài giây, bình luận
// đi ngược lại mất thêm vài giây. Câu trả lời ĐÚNG vì thế hay về tới sau khi đề đã đóng — trước đây
// bị vứt thẳng (`if (phase !== 'question') return`). Nay giữ đề vừa đóng sống thêm `lateMs`.
import assert from 'node:assert/strict';
import test from 'node:test';
import { POINTS, createQuizGame } from '../src/games/quiz/quiz-game.js';

const user = (n) => ({ id: `u${n}`, uniqueId: `u${n}`, nickname: `Người ${n}`, avatar: '' });
const word = (answer) => ({ kind: 'text', category: 'T', answer, prompt: '?', accept: [answer.toLowerCase()] });
const deck = () => {
  let i = 0;
  return { next: () => word(`W${(i += 1)}`) };
};
const chat = (game, n, text, at) => game.handleEvent({ type: 'chat', user: user(n), comment: text }, at);
const điểm = (game, n, at) => game.snapshot(at).board.find((r) => r.id === `u${n}`)?.points || 0;
/** Chạy đồng hồ tới lúc đề đóng (hiện đáp án) và trả về đúng mốc đó — đề có lead-in đọc đề nên
 *  không đoán cứng được. */
function tớiLúcĐóng(game, từ = 0, bước = 250) {
  for (let t = từ; t < từ + 60000; t += bước) {
    game.tick(t);
    if (game.snapshot(t).phase === 'reveal') return t;
  }
  throw new Error('đề không bao giờ đóng');
}

test('trả lời đúng về TRỄ (sau khi đã hiện đáp án) vẫn được tính điểm', () => {
  const game = createQuizGame({ id: 't', title: 'T', deck: deck(), questionMs: 5000, revealMs: 20000, lateMs: 9000 });
  const đóng = tớiLúcĐóng(game); // hết giờ → hiện đáp án, đề W1 đóng lúc này

  // người xem mới thấy đề W1 cách đây vài giây, giờ mới gõ xong
  const fx = chat(game, 1, 'w1', đóng + 3000);
  assert.ok(fx.some((f) => f.kind === 'quizCorrect' && f.late), 'phải báo đúng-nhưng-trễ');
  assert.equal(điểm(game, 1, đóng + 3100), POINTS[POINTS.length - 1], 'về trễ thì nhận mức điểm thấp nhất');
});

test('quá cửa sổ trễ thì thôi, không nhận nữa', () => {
  const game = createQuizGame({ id: 't', title: 'T', deck: deck(), questionMs: 5000, revealMs: 30000, lateMs: 9000 });
  const đóng = tớiLúcĐóng(game);
  chat(game, 2, 'w1', đóng + 9500); // trễ 9,5 giây — quá 9 giây
  assert.equal(điểm(game, 2, đóng + 9600), 0);
});

test('lateMs = 0 thì tắt hẳn (giữ nguyên nếp cũ)', () => {
  const game = createQuizGame({ id: 't', title: 'T', deck: deck(), questionMs: 5000, revealMs: 20000, lateMs: 0 });
  const đóng = tớiLúcĐóng(game);
  chat(game, 3, 'w1', đóng + 1000);
  assert.equal(điểm(game, 3, đóng + 1100), 0);
});

test('đã sang đề MỚI: gõ đáp án đề CŨ vẫn được tính, gõ đúng đề mới vẫn ăn điểm đầy đủ', () => {
  const game = createQuizGame({ id: 't', title: 'T', deck: deck(), questionMs: 5000, revealMs: 1000, lateMs: 9000 });
  const đóng = tớiLúcĐóng(game); // đóng W1
  let t = đóng;
  for (; t < đóng + 20000; t += 250) { // chạy tới khi sang đề W2
    game.tick(t);
    if (game.snapshot(t).phase === 'question') break;
  }
  assert.ok(t - đóng < 9000, 'đề mới phải ra trong lúc cửa sổ trễ còn mở');

  chat(game, 4, 'w1', t + 100); // người xem còn đang nhìn W1
  assert.equal(điểm(game, 4, t + 200), POINTS[POINTS.length - 1], 'đáp án đề cũ phải được tính');

  chat(game, 5, 'w2', t + 300); // người xem đã kịp thấy W2
  assert.equal(điểm(game, 5, t + 400), POINTS[0], 'đáp án đề đang hỏi vẫn ăn điểm hạng nhất');
});

test('người đã thắng câu đó rồi thì không được cộng thêm lần nữa', () => {
  const game = createQuizGame({ id: 't', title: 'T', deck: deck(), questionMs: 5000, revealMs: 20000, lateMs: 9000 });
  game.tick(0);
  chat(game, 6, 'w1', 3000); // đúng ngay trong giờ, hạng 1
  const trước = điểm(game, 6, 3100);
  assert.equal(trước, POINTS[0]);

  const đóng = tớiLúcĐóng(game, 3100);
  chat(game, 6, 'w1', đóng + 2000); // gõ lại lần nữa khi đã hiện đáp án
  assert.equal(điểm(game, 6, đóng + 2100), trước, 'không được cộng chồng');
});

test('báo cáo độ trễ thật để biết nên đặt bao nhiêu giây', () => {
  const game = createQuizGame({ id: 't', title: 'T', deck: deck(), questionMs: 5000, revealMs: 20000, lateMs: 9000 });
  const đóng = tớiLúcĐóng(game);
  chat(game, 7, 'w1', đóng + 4000); // trễ 4 giây
  chat(game, 8, 'w1', đóng + 6000); // trễ 6 giây
  const r = game.lateReport();
  assert.equal(r.count, 2);
  assert.equal(r.avgMs, 5000, 'trễ trung bình phải là 5 giây');
});
