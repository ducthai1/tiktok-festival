import assert from 'node:assert/strict';
import test from 'node:test';
import { accepts, loadEnglishQuestions, loadEnglishSets } from '../src/games/quiz/quiz-bank.js';
import { createEnglishSwitcher, LISTEN_MS, toListenQuestion } from '../src/games/quiz/english-switcher.js';
import { createQuizGame, LEAD_IN_MS } from '../src/games/quiz/quiz-game.js';
import { LISTEN_QUESTIONS } from '../public/shared/english-sets.js';

const word = (answer, prompt = `${answer} tiếng Anh là gì?`, alts = [], level = 2) => ({ kind: 'text', category: 'Tiếng Anh · Thử', answer, prompt, level, accept: accepts(answer, alts) });
const user = (n) => ({ id: `u${n}`, uniqueId: `u${n}`, nickname: `Người ${n}`, avatar: '' });
const doughnut = (n = 1, coins = 30) => ({ type: 'gift', user: user(n), gift: { id: 'd', name: 'Doughnut', diamondsEach: coins, count: 1, diamonds: coins } });

function setup({ ready = () => true, listen = Array.from({ length: 50 }, (_, i) => word(`LISTEN${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`)) } = {}) {
  const prefetched = [];
  const general = Array.from({ length: 200 }, (_, i) => word(`GEN${i}`));
  const sw = createEnglishSwitcher({ general, basic: [], sets: { toeic: general.slice(0, 50) }, listen, listenReady: ready, onPrefetch: (w) => prefetched.push(w) });
  const game = createQuizGame({ id: 'english', title: 'E', deck: sw.deck, onGift: (e) => sw.onGift(e), extraState: () => sw.snapshot(),
    pronounce: (q) => q.answer, speakLine: (q) => (q.listen ? '' : q.prompt) });
  return { sw, game, prefetched };
}

test('listening question: accepts the word, its spellings and homophones — never a synonym; meaning only at reveal', () => {
  const q = toListenQuestion(word('PEAR', 'Quả lê tiếng Anh là gì?'));
  assert.ok(q.listen && q.accept.includes('pear') && q.accept.includes('pair'));
  assert.equal(q.prompt, '🎧 Nghe rồi gõ lại từ tiếng Anh');
  assert.equal(q.revealPrompt, '🇻🇳 Quả lê');
  assert.equal(q.timeMs, LISTEN_MS);
  const colour = toListenQuestion(word('COLOUR', 'Màu sắc tiếng Anh là gì?', ['COLOR', 'HUE']));
  assert.ok(colour.accept.includes('color') && !colour.accept.includes('hue'));
  const acne = toListenQuestion(word('ACNE', 'Mụn trứng cá tiếng Anh là gì?', ['PIMPLES']));
  assert.deepEqual(acne.accept, ['acne']); // nghe "acne" mà gõ "pimples" là không nghe
  assert.ok(toListenQuestion(word('PAYDAY', 'Ngày lĩnh lương tiếng Anh là gì?', ['PAY DAY'])).accept.includes('pay day'));
});

test('listening: a 30-coin Doughnut gives 40 listening questions from the next one, words prepared ahead, then back to general', () => {
  const { game, prefetched } = setup();
  game.tick(0);
  const fx = game.handleEvent(doughnut(), 10);
  assert.deepEqual(fx.map((f) => f.kind), ['quizDeck']);
  assert.equal(fx[0].questions, LISTEN_QUESTIONS);
  assert.equal(prefetched.length, 1); // câu nghe đầu tiên đã được chọn + tạo sẵn giọng trong lúc câu hiện tại còn chạy
  assert.ok(!game.snapshot(10).listen); // câu đang hỏi không bị cắt ngang
  let t = 100;
  const asked = [];
  for (let i = 0; i < LISTEN_QUESTIONS + 2; i += 1) {
    game.command('next', (t += 10));
    const qfx = game.command('next', (t += 10));
    const snap = game.snapshot(t);
    asked.push({ listen: snap.listen, cat: snap.category });
    if (snap.listen) {
      assert.equal(snap.prompt, '🎧 Nghe rồi gõ lại từ tiếng Anh');
      assert.ok(qfx.find((f) => f.kind === 'quizQuestion').listen);
    }
  }
  assert.ok(asked.slice(0, LISTEN_QUESTIONS).every((a) => a.listen && a.cat === 'Tiếng Anh · 🎧 Luyện nghe'));
  assert.ok(asked.slice(LISTEN_QUESTIONS).every((a) => !a.listen));
  assert.equal(game.snapshot(t).control.set, 'general');
  assert.equal(prefetched.length, LISTEN_QUESTIONS); // mỗi câu nghe được chọn trước đúng một lần, không thừa
});

test('listening: the word is read at question start, slowly at ~7 s and again mid-question; reveal shows the meaning', () => {
  const { game } = setup({ listen: [word('PEAR', 'Quả lê tiếng Anh là gì?')] });
  game.tick(0);
  game.handleEvent(doughnut(), 10);
  game.command('next', 20); // lật câu thường đang hỏi
  game.command('next', 1000); // ra câu nghe lúc t = 1000
  const reads = [];
  for (let t = 1000; t <= 1000 + LEAD_IN_MS + LISTEN_MS; t += 100) {
    for (const f of game.tick(t)) if (f.kind === 'quizListen') reads.push([t - 1000, f.word, f.slow]);
    if (game.snapshot(t).phase !== 'question') break;
  }
  assert.deepEqual(reads.map((r) => r[2]), [false, true, false]);
  assert.ok(reads[0][0] <= 400 && reads[1][0] >= 7000 && reads[1][0] <= 7100 && reads[2][0] > 12000);
  assert.ok(reads.every((r) => r[1] === 'PEAR'));
  // ván khác: ô chữ + đồng âm + nghĩa lúc lật
  const { game: g2 } = setup({ listen: [word('PEAR', 'Quả lê tiếng Anh là gì?')] });
  g2.tick(0);
  g2.handleEvent(doughnut(), 10);
  g2.command('next', 20);
  g2.command('next', 1000);
  assert.equal(g2.snapshot(1500).mask.filter((c) => c === '_').length, 3); // 4 ô chữ, mở sẵn chữ đầu → còn 3 ô trống
  assert.equal(g2.snapshot(1500).answer, '');
  const ok = g2.handleEvent({ type: 'chat', user: user(5), comment: 'pair' }, 2500); // đồng âm vẫn đúng
  assert.deepEqual(ok.map((f) => f.kind), ['quizCorrect']);
  g2.command('next', 3000);
  assert.equal(g2.snapshot(3000).prompt, '🇻🇳 Quả lê');
});

test('listening never repeats a word across rounds until the whole pool has been heard', () => {
  const listen = Array.from({ length: 60 }, (_, i) => word(`W${i}`));
  const { sw } = setup({ listen });
  const heard = [];
  for (let round = 0; round < 3; round += 1) {
    sw.command('deck-nghe');
    for (let i = 0; i < LISTEN_QUESTIONS; i += 1) heard.push(sw.deck.next().answer);
  }
  assert.equal(new Set(heard.slice(0, 60)).size, 60); // 60 câu đầu: 60 từ khác nhau (hết kho mới quay vòng)
  assert.equal(new Set(heard.slice(60)).size, 60);
});

test('listening is hidden and refused while the English voice is down, and stops (with a notice) if it breaks mid-way', () => {
  let up = false;
  const { game, sw } = setup({ ready: () => up });
  game.tick(0);
  assert.ok(!game.snapshot(0).control.rules.some((r) => r.to === 'nghe'));
  assert.deepEqual(game.handleEvent(doughnut(), 10).map((f) => f.kind), ['quizGift']); // chỉ cảm ơn
  assert.equal(game.handleEvent(doughnut(2, 1), 11).map((f) => f.kind)[0], 'quizGift'); // món trùng tên rẻ hơn
  up = true;
  assert.ok(game.snapshot(20).control.rules.some((r) => r.to === 'nghe'));
  assert.equal(game.handleEvent(doughnut(), 30)[0].kind, 'quizDeck');
  game.command('next', 40);
  game.command('next', 50);
  assert.ok(game.snapshot(50).listen);
  up = false; // mất mạng / Microsoft chặn
  game.command('next', 60);
  const fx = game.command('next', 70);
  assert.ok(fx.some((f) => f.kind === 'toast' && f.text.includes('tạm dừng Luyện nghe')));
  assert.ok(!game.snapshot(70).listen);
  assert.equal(sw.snapshot().set, 'general');
});

test('listening keeps its 40 questions when others queue sets behind it; a restart resumes it', () => {
  const { sw } = setup();
  sw.command('deck-nghe');
  sw.command('deck-toeic');
  sw.command('deck-toeic');
  assert.equal(sw.snapshot().setLeft, LISTEN_QUESTIONS);
  const saved = JSON.parse(JSON.stringify(sw.snapshot()));
  const { sw: again } = setup();
  again.restore(saved);
  assert.equal(again.snapshot().set, 'nghe');
  assert.ok(again.deck.next().listen);
});

test('Đồ vật is no longer a gift slot: its words are in the general pool', () => {
  assert.ok(!('dovat' in loadEnglishSets()));
  assert.ok(loadEnglishQuestions().some((q) => q.category === 'Tiếng Anh · Đồ vật'));
});
