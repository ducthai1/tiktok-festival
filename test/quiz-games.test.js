import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { GAME_IDS, PUBLIC_DIR } from '../src/config.js';
import { createGameHub } from '../src/games/game-hub.js';
import {
  createTieredDeck, loadChoiceQuestions, loadEnglishSets, loadClassroomQuestions, loadEmojiQuestions, loadEnglishQuestions, loadFlagQuestions, loadWordleWords, makeMathQuestion
} from '../src/games/quiz/quiz-bank.js';
import {
  createQuizGame, ENERGY_GOLDEN, ENERGY_LIGHTNING, FOLLOW_GOAL, FOLLOW_POINTS, POINTS, SHARE_ENERGY, SHARE_ENERGY_MAX_PER_USER, scoreWordle
} from '../src/games/quiz/quiz-game.js';
import { createFollowerStore } from '../src/live/follower-store.js';
import { normalizeConnectorEvent } from '../src/live/normalize-tiktok-connector.js';
import { sanitizeLiveEvent } from '../src/live/live-event-schema.js';
import fsp from 'node:fs';
import os from 'node:os';
import { QUIZ_GAME_IDS } from '../src/games/quiz/quiz-games.js';
import { createEnglishSwitcher, filterByLevel } from '../src/games/quiz/english-switcher.js';
import { assignEnglishGifts, englishTargetFor } from '../public/shared/english-sets.js';

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
  const english = loadEnglishQuestions();
  assert.ok(english.length > 1200, `tiếng Anh chỉ có ${english.length} câu`);
  for (const q of english) assert.ok(q.category.startsWith('Tiếng Anh · ') && /^[A-Z][A-Z -]*$/.test(q.answer), JSON.stringify(q));
  const choice = loadChoiceQuestions();
  assert.ok(choice.length > 4000);
  for (const q of choice) assert.equal(new Set([q.right, ...q.wrong]).size, 4, q.prompt);
  for (const f of loadFlagQuestions()) assert.ok(fs.existsSync(path.join(PUBLIC_DIR, 'assets/flags', `${f.flag}.svg`)), f.flag);
  const { answers, allowed } = loadWordleWords();
  assert.ok(answers.length > 300 && answers.every((w) => /^[a-z]{5}$/.test(w) && allowed.has(w)));
  for (let level = 1; level <= 4; level += 1) {
    for (let i = 0; i < 2000; i += 1) {
      const q = makeMathQuestion(level);
      assert.ok(Number(q.answer) >= 0 && Number.isInteger(Number(q.answer)), q.prompt);
    }
  }
});

test('quiz English: every topic word is asked before any of the 176 old basic words, then the cycle repeats', () => {
  const english = loadEnglishQuestions();
  const topics = english.filter((q) => !q.basic).length;
  assert.equal(english.length - topics, 176);
  const deck = createTieredDeck([english.filter((q) => !q.basic), english.filter((q) => q.basic)]);
  const drawn = Array.from({ length: english.length + 5 }, () => deck.next());
  assert.ok(drawn.slice(0, topics).every((q) => !q.basic));
  assert.ok(drawn.slice(topics, english.length).every((q) => q.basic));
  assert.equal(new Set(drawn.slice(0, english.length)).size, english.length); // không câu nào lặp trong một vòng
  assert.ok(drawn.slice(english.length).every((q) => !q.basic)); // vòng mới lại bắt đầu bằng bộ theo chủ đề
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
  assert.equal(game.tick(15000).length, 0); // 2 s chờ + 12 s đếm + 1,5 s nhận bình luận tới trễ
  const fx = game.tick(15600);
  assert.deepEqual(fx[0].winners.map((w) => [w.id, w.points]), [['u2', 10], ['u3', 7]]);
  assert.equal(game.snapshot(15600).rightIndex, right);
});

test('quiz timing: the clock waits 2 s for the live delay, and answers arriving 1.5 s after time-up still count', () => {
  const game = createQuizGame({ id: 't', title: 'T', deck: fixedDeck(textQ('Mèo'), textQ('Chó')), questionMs: 10000 });
  game.tick(0);
  assert.equal(game.snapshot(1000).leadIn, true);
  assert.equal(game.snapshot(1000).msLeft, 10000); // đồng hồ đứng ở mức đầy trong 2 giây đầu
  assert.equal(game.snapshot(7000).msLeft, 5000);
  assert.equal(game.tick(12500).length, 0); // hết giờ ở 12 s nhưng còn nhận thêm
  assert.equal(game.handleEvent(chat(1, 'meo'), 13000)[0].kind, 'quizCorrect');
  assert.ok(kinds(game.tick(13600)).includes('quizReveal'));
});

test('quiz energy: 200 hearts make the next question golden (x2), 400 start a 3-question lightning round with a bonus', () => {
  const qs = Array.from({ length: 10 }, (_, i) => textQ(`Từ${i}`));
  const game = createQuizGame({ id: 't', title: 'T', deck: fixedDeck(...qs) });
  const likes = (n, t) => game.handleEvent({ type: 'like', user: user(9), likeCount: n }, t);
  game.tick(0);
  assert.equal(ENERGY_GOLDEN, 200);
  assert.equal(ENERGY_LIGHTNING, 400);
  assert.deepEqual(kinds(likes(ENERGY_GOLDEN, 10)), ['quizEnergy']);
  assert.equal(game.snapshot(10).energy.goldenPending, true);
  game.command('next', 20);
  assert.equal(game.snapshot(30).golden, false); // câu đang lật đáp án không đổi
  game.command('next', 40);
  assert.equal(game.snapshot(50).golden, true);
  assert.equal(game.handleEvent(chat(1, 'tu1'), 60)[0].points, 20); // nhanh nhất 10 × 2
  const fx = likes(ENERGY_LIGHTNING - ENERGY_GOLDEN, 70);
  assert.deepEqual(fx.map((f) => f.reward), ['lightning']);
  assert.equal(game.snapshot(70).energy.value, 0);
  let t = 100;
  const bolts = [];
  game.command('next', (t += 10)); // lật câu vàng đang hỏi
  for (let i = 0; i < 3; i += 1) {
    game.command('next', (t += 10)); // ra câu chớp nhoáng
    const snap = game.snapshot(t);
    assert.deepEqual(snap.lightning, { index: i + 1, total: 3 });
    assert.equal(snap.totalMs, 8000);
    game.handleEvent(chat(1, `tu${snap.qNumber - 1}`), (t += 10));
    bolts.push(...game.command('next', (t += 10)).filter((f) => f.kind === 'quizLightningEnd'));
  }
  assert.equal(bolts.length, 1);
  assert.deepEqual(bolts[0].perfect.map((p) => p.id), ['u1']);
  assert.equal(game.snapshot(t).board[0].bolts, 1);
  game.command('next', (t += 10));
  assert.equal(game.snapshot(t).lightning, null); // hết 3 câu là về bình thường
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

test('english gifts: only gifts under 20 coins, rose is always easy, assignments stay put when the room gets new gifts', () => {
  const g = (id, name, coins) => ({ id, name, coins, image: '' });
  const room = [g('5655', 'Rose', 1), g('5269', 'TikTok', 1), g('6064', 'GG', 1), g('5827', 'Ice Cream Cone', 1), g('7934', 'Heart Me', 1),
    g('5487', 'Finger Heart', 5), g('5760', 'Weights', 1), g('8913', 'Rosa', 10), g('5658', 'Perfume', 20), g('5879', 'Doughnut', 30), g('6100', 'Cap', 99)];
  const a = assignEnglishGifts(room);
  assert.deepEqual(a.map((x) => x.to), ['easy', 'hard', 'toeic', 'ielts', 'yhoc', 'bongda', 'congnghe']);
  assert.ok(a.every((x) => x.gift.coins < 20));
  assert.equal(a[0].gift.name, 'Rose');
  assert.deepEqual(a.slice(1, 4).map((x) => x.gift.name), ['TikTok', 'GG', 'Ice Cream Cone']); // món quen trước
  const later = assignEnglishGifts([g('9999', 'Aaa New', 1), ...room], a);
  assert.deepEqual(later.map((x) => x.gift.name), a.map((x) => x.gift.name)); // quà mới không xáo bảng
  assert.equal(englishTargetFor(a, { id: '6064', name: 'GG', diamondsEach: 1 }), 'toeic');
  assert.equal(englishTargetFor(a, { id: '', name: 'Rose', diamondsEach: 1 }), 'easy');
  assert.equal(englishTargetFor(a, { id: '5658', name: 'Perfume', diamondsEach: 20 }), null);
  const sets = loadEnglishSets();
  for (const [id, list] of Object.entries(sets)) assert.ok(list.length >= 150, `${id}: ${list.length}`);
});

test('english switcher: a gift changes the set from the next question for 20 questions, never scores the gifter', () => {
  const english = loadEnglishQuestions();
  const sw = createEnglishSwitcher({ general: english.filter((q) => !q.basic), basic: english.filter((q) => q.basic), sets: loadEnglishSets() });
  sw.setCatalog([{ id: '1', name: 'Rose', coins: 1 }, { id: '2', name: 'TikTok', coins: 1 }, { id: '3', name: 'GG', coins: 1 }]);
  const game = createQuizGame({ id: 'english', title: 'E', deck: sw.deck, onGift: (e) => sw.onGift(e), extraState: () => sw.snapshot() });
  game.tick(0);
  assert.equal(game.snapshot(0).control.set, 'general');
  assert.deepEqual(game.snapshot(0).control.rules.map((r) => r.to), ['easy', 'hard', 'toeic']);
  const fx = game.handleEvent({ type: 'gift', user: user(7), gift: { id: '3', name: 'GG', diamondsEach: 1, count: 1, diamonds: 1 } }, 10);
  assert.deepEqual(fx.map((f) => f.kind), ['quizDeck']);
  assert.ok(!game.snapshot(10).category.endsWith('TOEIC')); // câu đang hỏi không bị cắt ngang
  const cats = [];
  let t = 100;
  for (let i = 0; i < 22; i += 1) {
    game.command('next', (t += 10));
    game.command('next', (t += 10));
    cats.push(game.snapshot(t).category);
  }
  assert.ok(cats.slice(0, 20).every((c) => c === 'Tiếng Anh · TOEIC'), cats.join(','));
  assert.ok(cats.slice(20).every((c) => c !== 'Tiếng Anh · TOEIC'));
  assert.equal(game.snapshot(t).control.set, 'general');
  assert.equal(game.snapshot(t).board.length, 0);
  assert.ok(filterByLevel(loadEnglishSets().toeic, 'hard').every((q) => q.level === 3));
});

test('quiz follow: +3 once per person per live, a 💖 for followers (also from earlier lives), every 10 follows a golden question', () => {
  const game = createQuizGame({ id: 't', title: 'T', deck: fixedDeck(textQ('Mèo'), textQ('Chó')) });
  game.tick(0);
  const follow = (n, t) => game.handleEvent({ type: 'follow', user: user(n) }, t);
  assert.deepEqual(kinds(follow(1, 10)), ['quizFollow']);
  assert.equal(follow(1, 20).length, 0); // bỏ follow rồi follow lại: không cộng thêm
  game.handleEvent({ type: 'chat', user: { ...user(2), follower: true }, comment: 'mèo' }, 30); // follow từ buổi trước
  const snap = game.snapshot(40);
  assert.deepEqual(snap.board.map((r) => [r.id, r.points, r.follower]), [['u2', 10, true], ['u1', FOLLOW_POINTS, true]]);
  assert.equal(snap.winners[0].follower, true);
  let fx = [];
  for (let n = 3; n < 3 + FOLLOW_GOAL - 1; n += 1) fx = follow(n, 50 + n);
  assert.deepEqual(fx.map((f) => f.kind), ['quizFollow', 'quizEnergy']);
  assert.equal(game.snapshot(100).energy.goldenPending, true);
  assert.equal(game.snapshot(100).energy.follows, 0);
});

test('quiz share: +20 energy for the first 5 shares per person, ambassadors board ranks sharers', () => {
  const game = createQuizGame({ id: 't', title: 'T', deck: fixedDeck(textQ('Mèo')) });
  game.tick(0);
  const share = (n, t) => game.handleEvent({ type: 'share', user: user(n) }, t);
  for (let i = 0; i < SHARE_ENERGY_MAX_PER_USER + 2; i += 1) share(1, 10 + i);
  share(2, 30);
  const snap = game.snapshot(40);
  assert.equal(snap.energy.value, (SHARE_ENERGY_MAX_PER_USER + 1) * SHARE_ENERGY);
  assert.deepEqual(snap.ambassadors.map((r) => [r.id, r.shares]), [['u1', SHARE_ENERGY_MAX_PER_USER + 2], ['u2', 1]]);
  assert.equal(share(1, 50)[0].energy, 0);
});

test('follower flag: read from TikTok (followInfo / followRole) and kept across lives in data/followers.json; test events are not saved', () => {
  const ev = (user) => sanitizeLiveEvent(normalizeConnectorEvent('chat', { user, comment: 'hi' }));
  assert.equal(ev({ userId: '1', uniqueId: 'a', nickname: 'A', followInfo: { followStatus: 1 } }).user.follower, true);
  assert.equal(ev({ userId: '2', uniqueId: 'b', nickname: 'B', followRole: 2 }).user.follower, true);
  assert.equal(ev({ userId: '3', uniqueId: 'c', nickname: 'C', followInfo: { followStatus: 0 } }).user.follower, false);
  const dir = fsp.mkdtempSync(path.join(os.tmpdir(), 'followers-'));
  const store = createFollowerStore(dir, { saveDelayMs: 0 });
  store.mark({ type: 'follow', user: { id: '42', nickname: 'X' } });
  store.mark({ type: 'chat', user: { id: '7', nickname: 'Y', follower: true } });
  store.mark({ type: 'follow', simulated: true, user: { id: '99', nickname: 'Thử' } });
  store.flush();
  const again = createFollowerStore(dir);
  const later = again.mark({ type: 'chat', user: { id: '42', nickname: 'X', follower: false } });
  assert.equal(later.user.follower, true);
  assert.equal(again.has('7'), true);
  assert.equal(again.has('99'), false);
  fsp.rmSync(dir, { recursive: true, force: true });
});

test('follower flag from TikFinity followRole', async () => {
  const { normalizeTikFinityMessage } = await import('../src/live/normalize-tikfinity.js');
  const [event] = [normalizeTikFinityMessage({ event: 'chat', data: { userId: '5', uniqueId: 'e', nickname: 'E', comment: 'hi', followRole: 1 } })].flat();
  assert.equal(sanitizeLiveEvent(event).user.follower, true);
});
