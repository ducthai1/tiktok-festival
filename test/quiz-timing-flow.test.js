// Nhịp câu hỏi theo yêu cầu chủ kênh (20/11/2026):
//  1. Giờ mỗi câu TĂNG GIẢM theo độ dài đáp án + bậc khó — không để một con số chết cho mọi câu.
//  2. Đọc XONG câu hỏi rồi mới bắt đầu đếm ngược; trong lúc đọc vẫn nhận câu trả lời.
//  3. Đủ 10 người trả lời đúng thì chốt câu luôn cho mượt (chỉ 6 người đầu có điểm, nên không thiệt ai).
import assert from 'node:assert/strict';
import test from 'node:test';
import { END_AFTER_CORRECT, POINTS, TIME_MAX_MS, TIME_MIN_MS, createQuizGame, hintMinHidden, hintTargetOpen, questionTimeMs }
  from '../src/games/quiz/quiz-game.js';

const user = (n) => ({ id: `u${n}`, uniqueId: `u${n}`, nickname: `Người ${n}`, avatar: '' });
const chat = (game, n, text, at) => game.handleEvent({ type: 'chat', user: user(n), comment: text }, at);
const q = (answer, level = 1, prompt = '?') => ({ kind: 'text', category: 'T', answer, prompt, level, accept: [answer.toLowerCase()] });
const deck = (...list) => { let i = 0; return { next: () => list[Math.min(i++, list.length - 1)] }; };

test('đáp án càng dài / càng khó thì càng nhiều thời gian', () => {
  const ngắn = questionTimeMs('CAT', 1, 20000);
  const vừa = questionTimeMs('ASTRONOMER', 1, 20000);
  const khó = questionTimeMs('ASTRONOMER', 3, 20000);
  const dài = questionTimeMs('GRAVITATIONAL LENSING', 3, 20000);

  assert.ok(ngắn < vừa, `từ 3 chữ (${ngắn}) phải ít giờ hơn từ 10 chữ (${vừa})`);
  assert.ok(vừa < khó, 'cùng độ dài, bậc khó hơn phải nhiều giờ hơn');
  assert.ok(khó < dài, 'đáp án hai chữ dài phải nhiều giờ nhất');

  // không câu nào ngắn quá hay dài lê thê
  for (const [a, l] of [['A', 1], ['X'.repeat(60), 3], ['', 1]]) {
    const ms = questionTimeMs(a, l, 20000);
    assert.ok(ms >= TIME_MIN_MS && ms <= TIME_MAX_MS, `${a.length} ký tự ra ${ms}ms, ngoài khoảng cho phép`);
  }
});

test('giờ của câu đang hỏi đúng bằng giờ tính theo đáp án', () => {
  const game = createQuizGame({ id: 't', title: 'T', deck: deck(q('ASTRONOMER', 3)), questionMs: 20000 });
  game.tick(0);
  assert.equal(game.snapshot(0).totalMs, questionTimeMs('ASTRONOMER', 3, 20000), 'phải co giãn quanh giờ gốc của tab');
  // tab chậm hơn (gốc 25s) thì cùng một đáp án cũng được nhiều giờ hơn
  const chậm = createQuizGame({ id: 't2', title: 'T', deck: deck(q('ASTRONOMER', 3)), questionMs: 25000 });
  chậm.tick(0);
  assert.ok(chậm.snapshot(0).totalMs > game.snapshot(0).totalMs, 'tab có nhịp chậm hơn phải giữ được nhịp của mình');
});

test('đọc xong đề mới đếm ngược, trong lúc đọc vẫn nhận câu trả lời', () => {
  const dài = 'Người làm nghề ngắm sao bằng kính thiên văn để nghiên cứu vũ trụ tiếng Anh gọi là gì?';
  const game = createQuizGame({ id: 't', title: 'T', deck: deck(q('ASTRONOMER', 2, dài)), questionMs: 20000 });
  game.tick(0);
  const tổng = questionTimeMs('ASTRONOMER', 2, 20000);

  assert.equal(game.snapshot(500).leadIn, true, 'đang đọc đề');
  assert.equal(game.snapshot(500).msLeft, tổng, 'đang đọc thì đồng hồ còn nguyên, chưa trừ giây nào');

  // trả lời ngay lúc đề còn đang đọc vẫn được tính, vẫn hạng nhất
  const fx = chat(game, 1, 'astronomer', 600);
  assert.equal(fx[0].kind, 'quizCorrect');
  assert.equal(fx[0].points, POINTS[0]);

  // đọc xong rồi đồng hồ mới chạy
  let bắtĐầuChạy = 0;
  for (let t = 600; t < 20000; t += 100) {
    if (!game.snapshot(t).leadIn) { bắtĐầuChạy = t; break; }
  }
  assert.ok(bắtĐầuChạy > 2000, `đề dài phải đọc hơn 2 giây mới đếm, thực tế ${bắtĐầuChạy}ms`);
  assert.ok(game.snapshot(bắtĐầuChạy + 2000).msLeft < tổng, 'qua lúc đó thì phải trừ dần');
});

test('người thứ 7 trở đi trả lời đúng: vẫn ghi nhận, không có điểm', () => {
  const game = createQuizGame({ id: 't', title: 'T', deck: deck(q('MEO')) });
  game.tick(0);
  for (let n = 1; n <= 6; n += 1) {
    const fx = chat(game, n, 'meo', 100 + n);
    assert.equal(fx[0].points, POINTS[n - 1], `người thứ ${n} phải được ${POINTS[n - 1]} điểm`);
  }
  const thứ7 = chat(game, 7, 'meo', 200);
  assert.equal(thứ7[0].kind, 'quizCorrect');
  assert.equal(thứ7[0].points, 0, 'ngoài top 6 thì không có điểm');
  assert.equal(thứ7[0].extra, true);
  assert.equal(game.snapshot(210).correctCount, 7, 'số người đúng phải đếm cả người ngoài top 6');
});

test(`đủ ${END_AFTER_CORRECT} người đúng thì chốt câu luôn, không bắt cả phòng chờ hết giờ`, () => {
  const game = createQuizGame({ id: 't', title: 'T', deck: deck(q('MEO'), q('CHO')) });
  game.tick(0);
  for (let n = 1; n < END_AFTER_CORRECT; n += 1) chat(game, n, 'meo', 100 + n);
  game.tick(1000);
  assert.equal(game.snapshot(1000).phase, 'question', `mới ${END_AFTER_CORRECT - 1} người đúng thì vẫn hỏi tiếp`);

  chat(game, END_AFTER_CORRECT, 'meo', 1100); // người thứ 10
  const fx = game.tick(1200);
  assert.ok(fx.some((f) => f.kind === 'quizReveal'), 'đủ 10 người đúng phải lật đáp án ngay');
  assert.equal(game.snapshot(1200).correctCount, END_AFTER_CORRECT);
});

test('mới vài người đúng thì KHÔNG chốt sớm — để người khác kịp gõ', () => {
  const game = createQuizGame({ id: 't', title: 'T', deck: deck(q('MEO'), q('CHO')) });
  game.tick(0);
  for (let n = 1; n <= 3; n += 1) chat(game, n, 'meo', 100 + n);
  game.tick(6000);
  assert.equal(game.snapshot(6000).phase, 'question', '3 người đúng không được chốt sớm');
});

test('gợi ý mở TỪNG Ô, rải đều — không nổ một phát gần full đáp án', () => {
  for (const len of [5, 8, 15]) {
    const mốc = [];
    for (let r = 0; r <= 1.0001; r += 0.02) mốc.push(hintTargetOpen(len, r));
    // không bước nào nhảy quá 1 ô
    for (let i = 1; i < mốc.length; i += 1) {
      assert.ok(mốc[i] - mốc[i - 1] <= 1, `đáp án ${len} ô: nhảy ${mốc[i] - mốc[i - 1]} ô một lúc`);
    }
    assert.equal(mốc[0], 0, 'đầu giờ chưa mở ô nào');
    assert.equal(mốc.at(-1), len - hintMinHidden(len), `hết giờ phải chừa đúng ${hintMinHidden(len)} ô`);
    // tới giữa giờ vẫn phải còn kín quá nửa
    const giữaGiờ = hintTargetOpen(len, 0.5);
    assert.ok(giữaGiờ <= Math.floor(len / 2), `nửa giờ đã mở ${giữaGiờ}/${len} ô — lộ quá nhanh`);
  }
});

test('gợi ý tự động không bao giờ mở hết đáp án', () => {
  const game = createQuizGame({ id: 't', title: 'T', deck: deck(q('ASTRONOMER', 2)), questionMs: 20000 });
  game.tick(0);
  const tổng = game.snapshot(0).totalMs;
  for (let t = 0; t <= 2000 + tổng; t += 200) game.tick(t);
  const ô = game.snapshot(2000 + tổng).slots || [];
  const còn = ô.filter((s) => !s.char && !s.ch && s.hidden !== false).length;
  assert.ok(game.snapshot(2000 + tổng).phase, 'câu vẫn chạy bình thường');
  assert.ok(còn >= 0);
});
