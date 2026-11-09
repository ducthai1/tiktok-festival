import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { GAME_IDS, PUBLIC_DIR } from '../src/config.js';
import { createGameHub } from '../src/games/game-hub.js';
import {
  loadChoiceQuestions, loadClassroomQuestions, loadEmojiQuestions, loadEnglishQuestions, loadFlagQuestions, loadWordleWords, makeMathQuestion
} from '../src/games/quiz/quiz-bank.js';
import { createQuizGame, POINTS, scoreWordle } from '../src/games/quiz/quiz-game.js';
import { QUIZ_GAME_IDS } from '../src/games/quiz/quiz-games.js';

const user = (n) => ({ id: `u${n}`, uniqueId: `u${n}`, nickname: `Người ${n}`, avatar: '' });
const chat = (n, comment) => ({ type: 'chat', user: user(n), comment });
const gift = (n, diamondsEach = 1) => ({ type: 'gift', user: user(n), gift: { id: 'g', name: 'Quà', diamondsEach, count: 1, diamonds: diamondsEach } });
const fixedDeck = (...items) => ({ next: () => items.shift() ?? items[0] });
const textQ = (answer, alts = []) => ({ kind: 'text', category: 'Thử', answer, prompt: 'Đố?', accept: [answer, ...alts].map((s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()) });
const kinds = (fx) => fx.map((f) => f.kind);

test('quiz: every tab is registered in the hub and allowed as START_GAME', () => {
  const ids = createGameHub().list().map((g) => g.id);
  for (const id of QUIZ_GAME_IDS) {
    assert.ok(ids.includes(id), id);
    assert.ok(GAME_IDS.includes(id), id);
  }
});

test('quiz banks: every question is answerable and A/B/C/D options are distinct', () => {
  const text = [...loadClassroomQuestions(), ...loadEnglishQuestions(), ...loadEmojiQuestions(), ...loadFlagQuestions()];
  assert.ok(text.length > 3000);
  for (const q of text) assert.ok(q.answer && q.accept.length && q.accept.every(Boolean), JSON.stringify(q));
  const choice = loadChoiceQuestions();
  assert.ok(choice.length > 4000);
  for (const q of choice) assert.equal(new Set([q.right, ...q.wrong]).size, 4, q.prompt);
  for (const f of loadFlagQuestions()) assert.ok(fs.existsSync(path.join(PUBLIC_DIR, 'assets/flags', `${f.flag}.svg`)), f.flag);
  const { answers, allowed } = loadWordleWords();
  assert.ok(answers.length > 300 && answers.every((w) => /^[a-z]{5}$/.test(w) && allowed.has(w)));
  for (let level = 1; level <= 4; level += 1) {
    for (let i = 0; i < 50; i += 1) {
      const q = makeMathQuestion(level);
      assert.ok(Number(q.answer) >= 0 && Number.isInteger(Number(q.answer)), q.prompt);
    }
  }
});

test('quiz text: accent-free answers count, 5 fastest get 10/7/5/3/3, reveal 5 s after the first correct', () => {
  const game = createQuizGame({ id: 't', title: 'T', deck: fixedDeck(textQ('Ngủ nướng'), textQ('Mèo')) });
  game.tick(0);
  assert.equal(game.snapshot(0).phase, 'question');
  game.handleEvent(chat(9, 'ngủ say'), 100); // sai
  const scored = [1, 2, 3, 4, 5, 6].map((n) => game.handleEvent(chat(n, n % 2 ? 'ngu nuong' : 'NGỦ NƯỚNG!!'), 200 + n));
  assert.deepEqual(scored.map((fx) => fx[0].points), [...POINTS, 1]);
  assert.equal(game.handleEvent(chat(1, 'ngu nuong'), 300).length, 0); // đã đúng thì không cộng lần hai
  assert.equal(game.snapshot(1000).answer, ''); // chưa lật đáp án khi còn đang hỏi
  assert.equal(game.tick(4000).length, 0);
  assert.deepEqual(kinds(game.tick(5300)), ['quizReveal']);
  const snap = game.snapshot(5300);
  assert.equal(snap.answer, 'Ngủ nướng');
  assert.equal(snap.board[0].points, 10);
});

test('quiz text: at most 6 guesses per person per question', () => {
  const game = createQuizGame({ id: 't', title: 'T', deck: fixedDeck(textQ('Mèo')) });
  game.tick(0);
  for (let i = 0; i < 6; i += 1) game.handleEvent(chat(1, 'chó'), 10 + i);
  assert.equal(game.handleEvent(chat(1, 'mèo'), 20).length, 0);
});

test('quiz: an inactive tab freezes its clock and does not start questions', () => {
  const game = createQuizGame({ id: 't', title: 'T', deck: fixedDeck(textQ('Mèo')), questionMs: 10000 });
  assert.equal(game.tick(0, false).length, 0);
  assert.equal(game.snapshot(0).phase, 'idle');
  game.tick(1000);
  game.tick(2000);
  game.tick(60000, false); // đổi sang tab khác lâu
  assert.equal(game.tick(61000).length, 0); // quay lại: còn ~8 giây, chưa lật
  assert.ok(game.snapshot(61000).msLeft > 7000);
});

test('quiz gifts never give the gifter points; they open hints for everyone and keep one letter hidden', () => {
  const game = createQuizGame({ id: 't', title: 'T', deck: fixedDeck(textQ('Hà Nội')), firstLetter: false, autoHints: false });
  game.tick(0);
  for (let i = 0; i < 20; i += 1) game.handleEvent(gift(1, 1000), 10 + i);
  const snap = game.snapshot(100);
  assert.equal(snap.board.length, 0);
  assert.equal(snap.mask.filter((c) => c === '_').length, 1);
});

test('quiz A/B/C/D: first vote counts, fastest correct voters scored at reveal, gifts remove at most two wrong options', () => {
  const q = { kind: 'abcd', category: 'Thử', prompt: 'Thủ đô Pháp?', right: 'Paris', wrong: ['Lyon', 'Nice', 'Lille'], level: 1 };
  const game = createQuizGame({ id: 'a', title: 'A', kind: 'abcd', deck: fixedDeck(q), random: () => 0 });
  game.tick(0);
  const right = game.snapshot(0).options.findIndex((o) => o.text === 'Paris');
  const letter = 'abcd'[right];
  const wrongLetter = 'abcd'[(right + 1) % 4];
  game.handleEvent(chat(1, wrongLetter), 100);
  game.handleEvent(chat(1, letter), 150); // đổi ý không được tính
  game.handleEvent(chat(2, `Đáp án ${letter.toUpperCase()}`), 200);
  game.handleEvent(chat(3, letter), 300);
  for (let i = 0; i < 5; i += 1) game.handleEvent(gift(4), 400 + i);
  const snap = game.snapshot(500);
  assert.equal(snap.options.filter((o) => o.removed).length, 2);
  assert.equal(snap.options[right].removed, false);
  const fx = game.tick(13000);
  assert.deepEqual(fx[0].winners.map((w) => [w.id, w.points]), [['u2', 10], ['u3', 7]]);
  assert.equal(game.snapshot(13000).rightIndex, right);
});

test('quiz likes add time, capped per question', () => {
  const game = createQuizGame({ id: 't', title: 'T', deck: fixedDeck(textQ('Mèo')), questionMs: 10000 });
  game.tick(0);
  const fx = game.handleEvent({ type: 'like', user: user(1), likeCount: 1000 }, 10);
  assert.equal(fx.filter((f) => f.kind === 'quizTime').length, 3);
  for (let i = 0; i < 20; i += 1) game.handleEvent({ type: 'like', user: user(1), likeCount: 1000 }, 20 + i);
  assert.equal(game.snapshot(100).totalMs, 25000);
});

test('wordle: colours handle repeated letters; only dictionary words count', () => {
  assert.equal(scoreWordle('apple', 'apple'), 'ggggg');
  assert.equal(scoreWordle('eerie', 'apple'), 'xxxxg');
  assert.equal(scoreWordle('lapel', 'apple'), 'yygyx');
  const wordle = { allowed: new Set(['apple', 'house', 'water']) };
  const game = createQuizGame({ id: 'w', title: 'W', kind: 'wordle', deck: fixedDeck('apple'), wordle, questionMs: 150000 });
  game.tick(0);
  assert.equal(game.handleEvent(chat(1, 'xyzzy'), 10).length, 0); // không có trong từ điển
  assert.equal(game.handleEvent(chat(1, 'water'), 20).length, 0); // không trúng ô xanh nào
  const snap = game.snapshot(30);
  assert.equal(snap.guesses[0].marks, 'xyxyx');
  assert.deepEqual([snap.keyboard.a, snap.keyboard.e, snap.keyboard.w], [1, 1, 0]);
});

test('wordle: a winner ends the round with the answer shown', () => {
  const wordle = { allowed: new Set(['apple', 'house']) };
  const game = createQuizGame({ id: 'w', title: 'W', kind: 'wordle', deck: fixedDeck('apple'), wordle });
  game.tick(0);
  game.handleEvent(chat(1, 'house'), 10);
  assert.deepEqual(kinds(game.handleEvent(chat(2, 'Apple'), 20)), ['quizCorrect', 'quizReveal']);
  const snap = game.snapshot(30);
  assert.equal(snap.answer, 'APPLE');
  assert.deepEqual(snap.guesses.map((g) => g.word), ['HOUSE', 'APPLE']);
});
