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
  createQuizGame, ENERGY_GOLDEN, ENERGY_LIGHTNING, FOLLOW_GOAL, FOLLOW_POINTS, POINTS, SHARE_ENERGY, SHARE_ENERGY_MAX_PER_USER, scoreWordle, questionTimeMs } from '../src/games/quiz/quiz-game.js';
import { foldText } from '../public/shared/profanity-filter.js';
import { createFollowerStore } from '../src/live/follower-store.js';
import { normalizeConnectorEvent } from '../src/live/normalize-tiktok-connector.js';
import { sanitizeLiveEvent } from '../src/live/live-event-schema.js';
import fsp from 'node:fs';
import os from 'node:os';
import { QUIZ_GAME_IDS } from '../src/games/quiz/quiz-games.js';
import { createEnglishSwitcher, filterByLevel } from '../src/games/quiz/english-switcher.js';
import { assignEnglishGifts, ENGLISH_GIFT_PLAN, englishTargetFor, ORDER, STREAMER_SEEN_GIFTS } from '../public/shared/english-sets.js';
import { VN_GIFTS_UP_TO_30 } from '../public/shared/tiktok-gifts-vn.js';

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

test('english: no Vietnamese answer is accepted — the clue would give it away', () => {
  // Gợi ý hiện trên màn hình là tiếng Việt. Nhận thêm alias tiếng Việt thì người xem chỉ cần
  // chép lại chữ vừa đọc là thắng (ATOM | "Hạt nguyên tử…" ← gõ "nguyên tử"). 2161 alias như vậy
  // đã bị gỡ 17/11/2026; test này chặn chúng quay lại.
  const VN = /[\u00e0-\u00e3\u00e8-\u00ea\u00ec\u00ed\u00f2-\u00f5\u00f9\u00fa\u00fd\u0103\u0111\u0129\u0169\u01b0\u1ea0-\u1ef9]/i;
  for (const q of [...loadEnglishQuestions(), ...Object.values(loadEnglishSets()).flat()]) {
    for (const a of q.accept) assert.ok(!VN.test(a), `${q.answer} nhận "${a}"`);
  }
});

test('english sets: a word lives in exactly one gift set (luật ở docs/bank-trung-cheo.md)', () => {
  const owner = new Map();
  for (const [id, list] of Object.entries(loadEnglishSets())) {
    for (const q of list) {
      const key = foldText(q.answer);
      const prev = owner.get(key);
      assert.equal(prev, undefined, `"${q.answer}" nằm ở cả ${prev} lẫn ${id}`);
      owner.set(key, id);
    }
  }
  assert.ok(owner.size > 6000, `chỉ còn ${owner.size} từ`);
});

test('quiz banks: every question is answerable and A/B/C/D options are distinct', () => {
  const text = [...loadClassroomQuestions(), ...loadEnglishQuestions(), ...loadEmojiQuestions(), ...loadFlagQuestions()];
  assert.ok(text.length > 3000);
  for (const q of text) assert.ok(q.answer && q.accept.length && q.accept.every(Boolean), JSON.stringify(q));
  const english = [...loadEnglishQuestions(), ...Object.values(loadEnglishSets()).flat()]; // Tổng hợp = từ chung + mọi bộ đề
  assert.ok(english.length > 6000, `tiếng Anh chỉ có ${english.length} câu`);
  for (const q of english) assert.ok(q.category.startsWith('Tiếng Anh · ') && /^[A-Z0-9][A-Z0-9 '&.-]*$/.test(q.answer), JSON.stringify(q));
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
  // Một số từ basic trùng với bộ đề riêng (tieng-anh-bo) đã bị lọc ra — chấp nhận <= 176
  assert.ok(english.length - topics <= 176, `basic words: ${english.length - topics} > 176`);
  const deck = createTieredDeck([english.filter((q) => !q.basic), english.filter((q) => q.basic)]);
  const drawn = Array.from({ length: english.length + 5 }, () => deck.next());
  assert.ok(drawn.slice(0, topics).every((q) => !q.basic));
  assert.ok(drawn.slice(topics, english.length).every((q) => q.basic));
  assert.equal(new Set(drawn.slice(0, english.length)).size, english.length); // không câu nào lặp trong một vòng
  assert.ok(drawn.slice(english.length).every((q) => !q.basic)); // vòng mới lại bắt đầu bằng bộ theo chủ đề
});

test('quiz text: accent-free answers count, 6 fastest get 10/7/5/3/3/3, reveal 5 s after the first correct', () => {
  const game = createQuizGame({ id: 't', title: 'T', deck: fixedDeck(textQ('Ngủ nướng'), textQ('Mèo')) });
  game.tick(0);
  assert.equal(game.snapshot(0).phase, 'question');
  game.handleEvent(chat(9, 'ngủ say'), 100); // sai
  const scored = [1, 2, 3, 4, 5, 6].map((n) => game.handleEvent(chat(n, n % 2 ? 'ngu nuong' : 'NGỦ NƯỚNG!!'), 200 + n));
  assert.deepEqual(scored.map((fx) => fx[0].points), POINTS);
  // Người thứ 7 trả lời ĐÚNG: vẫn được ghi nhận và hiện tên, nhưng không có điểm (chỉ 6 bạn nhanh nhất có điểm).
  // Trước đây đủ 6 người là thôi dò luôn nên người thứ 7 bị ghi là SAI — chủ kênh yêu cầu đổi 20/11/2026.
  const thu7 = game.handleEvent(chat(7, 'ngu nuong'), 210);
  assert.equal(thu7[0].kind, 'quizCorrect');
  assert.equal(thu7[0].points, 0);
  assert.equal(thu7[0].extra, true);
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
  const game = createQuizGame({ id: 't', title: 'T', deck: fixedDeck(textQ('Mèo'), textQ('Chó')) });
  game.tick(0);
  // Giờ mỗi câu tính theo độ dài đáp án + bậc khó (questionTimeMs), không còn một con số chết
  const tong = questionTimeMs('Mèo', 1, 25000); // tab không truyền questionMs → mặc định 25s
  assert.equal(game.snapshot(0).totalMs, tong);
  assert.equal(game.snapshot(1000).leadIn, true);
  assert.equal(game.snapshot(1000).msLeft, tong); // đồng hồ đứng ở mức đầy trong 2 giây đầu
  assert.equal(game.snapshot(7000).msLeft, tong - 5000);
  assert.equal(game.tick(2000 + tong + 500).length, 0); // hết giờ nhưng còn nhận thêm 1,5 giây
  assert.equal(game.handleEvent(chat(1, 'meo'), 2000 + tong + 1000)[0].kind, 'quizCorrect');
  assert.ok(kinds(game.tick(2000 + tong + 1600)).includes('quizReveal'));
});

test('quiz timing: long question text waits for TTS reading to finish before countdown starts', () => {
  const longPrompt = 'Câu Vàng, nhân đôi điểm! Con hà mã tiếng Anh là gì?';
  const q = { kind: 'text', category: 'Tiếng Anh', answer: 'HIPPO', prompt: longPrompt, accept: ['hippo'] };
  const game = createQuizGame({ id: 't', title: 'T', deck: fixedDeck(q) });
  game.tick(0);
  const tong = questionTimeMs('HIPPO', 1, 25000);
  // Câu dài 12 từ + dấu phẩy/chấm/hỏi: leadIn kéo dài ~4 giây để đọc xong
  assert.equal(game.snapshot(1000).leadIn, true);
  assert.equal(game.snapshot(2500).leadIn, true);
  assert.equal(game.snapshot(2500).msLeft, tong); // vẫn giữ nguyên thời gian đầy
  // Sau khi đọc xong (~4s): đồng hồ mới bắt đầu đếm ngược
  assert.equal(game.snapshot(4500).leadIn, false);
  assert.ok(game.snapshot(4500).msLeft < tong);
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

test('english gifts: every slot shows a real VN gift at its REAL price (≤ 30 coins), one gift per slot', () => {
  const a = assignEnglishGifts([]);
  assert.deepEqual(a.map((x) => x.to), ORDER);
  for (const x of a) {
    const real = VN_GIFTS_UP_TO_30.filter((g) => g.name === ENGLISH_GIFT_PLAN[x.to]);
    assert.equal(real.length, 1, `${x.to}: món phải có thật và không trùng tên`);
    assert.equal(x.gift.coins, real[0].coins, x.to);
    assert.equal(x.gift.image, real[0].image, x.to);
    assert.ok(x.gift.coins <= 30);
  }
  assert.equal(new Set(a.map((x) => x.gift.name)).size, a.length);
  // mọi món phải có trong hộp quà mà người xem thấy (13/11 từng gán quà không có trong hộp quà → không ai tặng được)
  for (const x of a) {
    const listed = VN_GIFTS_UP_TO_30.some((g) => g.name === x.gift.name && g.panel);
    assert.ok(listed || STREAMER_SEEN_GIFTS.includes(x.gift.name), `${x.to}: ${x.gift.name} không có trong hộp quà TikTok`);
  }
  assert.equal(a.find((x) => x.to === 'easy').gift.name, 'Rose');
  const sets = loadEnglishSets();
  // bộ đang soạn (chưa có file) thì ô tự ẩn; bộ đã có câu phải đủ dùng
  for (const [id, list] of Object.entries(sets)) if (list.length) assert.ok(list.length >= 150, `${id}: ${list.length}`);
});

test('english gifts: a gift cheaper than the price on the panel never switches (the 1-coin "5-coin" loss)', () => {
  const a = assignEnglishGifts([]);
  const slot = (to) => a.find((x) => x.to === to).gift;
  assert.equal(englishTargetFor(a, { name: 'Friendship Necklace', diamondsEach: 10 }), 'toeic');
  assert.equal(englishTargetFor(a, { name: 'Friendship Necklace', diamondsEach: 1 }), null);
  assert.equal(englishTargetFor(a, { name: 'Doughnut', diamondsEach: 30 }), 'nghe'); // trùng tên mà rẻ hơn → không đổi
  assert.equal(englishTargetFor(a, { name: 'Rosa', diamondsEach: 10 }), 'truonghoc');
  assert.equal(englishTargetFor(a, { name: 'Finger Heart', diamondsEach: 5 }), 'dongvat');
  assert.equal(englishTargetFor(a, { name: "You're awesome", diamondsEach: 1 }), 'hard'); // giờ ghi đúng giá thật 1 xu (13/11 từng ghi 5 xu)
  assert.equal(englishTargetFor(a, { id: '9947', name: 'Vòng cổ tình bạn', diamondsEach: 10 }), 'toeic'); // tên tiếng Việt: nhận theo id quà thật
  assert.equal(englishTargetFor(a, { name: 'Love in Scent', diamondsEach: 5 }), 'tinhyeu');
  assert.equal(englishTargetFor(a, { name: 'Wink wink', diamondsEach: 1 }), null);
  assert.equal(englishTargetFor(a, { name: 'Ice Cream Cone', diamondsEach: 1 }), 'normal'); // ⚖️ về độ khó Thường
  assert.equal(englishTargetFor(a, { name: 'GG', diamondsEach: 1 }), null);
  assert.equal(englishTargetFor(a, { name: 'Brown Paw', diamondsEach: 0 }), null); // không rõ giá → không đổi
  // TikTok gửi tên tiếng Việt: nhận theo mã ảnh quà
  assert.equal(englishTargetFor(a, { id: 'x', name: 'Hoa hồng', diamondsEach: 1, pictureUrl: slot('easy').image.replace('.webp', '.png') }), 'easy');
  // danh mục quà của phòng KHÔNG đổi giá trên bảng (13/11 danh mục trên máy live có "Finger Heart 15 xu" từ quà thử — thật 5 xu)
  const sw = createEnglishSwitcher({ general: [], basic: [], sets: { dongvat: [{ kind: 'text', answer: 'CAT', prompt: '?', level: 1, accept: ['cat'] }] } });
  sw.setCatalog([{ id: '5487', name: 'Finger Heart', coins: 15 }]);
  const fh = sw.snapshot().rules.find((r) => r.to === 'dongvat').gift;
  assert.deepEqual([fh.id, fh.coins], ['5487', 5]);
  assert.equal(englishTargetFor(a, { id: '5487', name: 'Bắn tim', diamondsEach: 5 }), 'dongvat'); // tên tiếng Việt: nhận theo id
});

test('english switcher: a gift waits for current question to finish, then switches to the new set on next question, never scores the gifter', () => {
  const english = loadEnglishQuestions();
  const sets = loadEnglishSets();
  const sw = createEnglishSwitcher({ general: english.filter((q) => !q.basic), basic: english.filter((q) => q.basic), sets });
  sw.setCatalog([{ id: '1', name: 'Rose', coins: 1 }, { id: '2', name: 'TikTok', coins: 1 }, { id: '3', name: 'Friendship Necklace', coins: 10 }, { id: '5', name: "You're awesome", coins: 1 }]);
  const game = createQuizGame({ id: 'english', title: 'E', deck: sw.deck, onGift: (e) => sw.onGift(e), extraState: () => sw.snapshot() });
  const gift = (n, id, name, coins, t) => game.handleEvent({ type: 'gift', user: user(n), gift: { id, name, diamondsEach: coins, count: 1, diamonds: coins } }, t);
  game.tick(0);
  assert.equal(game.snapshot(0).control.set, 'general');
  // chưa có giọng đọc → ẩn ô 🎧; bộ chưa có câu hỏi → ẩn ô
  assert.deepEqual(game.snapshot(0).control.rules.map((r) => r.to), ORDER.filter((to) => to !== 'nghe' && (!(to in sets) || sets[to].length)));
  assert.deepEqual(gift(8, '4', 'Wink wink', 1, 5).map((f) => f.kind), ['quizGift']); // món 1 xu: chỉ cảm ơn, không đổi bộ đề
  const q1 = game.snapshot(5).qNumber;
  const fx = gift(7, '3', 'Friendship Necklace', 10, 10);
  assert.deepEqual(fx.map((f) => f.kind), ['quizDeck']); // không cắt ngang: đợi hết câu hiện tại
  assert.equal(game.snapshot(10).qNumber, q1); // câu hiện tại vẫn giữ nguyên
  // hết câu hiện tại -> câu sau vào TOEIC:
  game.command('next', 20);
  game.command('next', 30);
  assert.equal(game.snapshot(30).category, 'Tiếng Anh · TOEIC');
  assert.equal(game.snapshot(30).qNumber, q1 + 1);
  assert.deepEqual(gift(9, '3', 'Friendship Necklace', 10, 40).map((f) => f.kind), ['quizDeck']); // đang TOEIC: chỉ đếm lại, không nhảy câu
  const cats = [game.snapshot(40).category];
  let t = 100;
  for (let i = 0; i < 21; i += 1) {
    game.command('next', (t += 10));
    game.command('next', (t += 10));
    cats.push(game.snapshot(t).category);
  }
  // câu đang hỏi + 20 câu đếm lại từ lần tặng thứ hai, rồi về Tổng hợp
  assert.ok(cats.slice(0, 21).every((c) => c === 'Tiếng Anh · TOEIC'), cats.join(','));
  assert.ok(cats.slice(21).every((c) => c !== 'Tiếng Anh · TOEIC'));
  assert.equal(game.snapshot(t).control.set, 'general');
  assert.equal(game.snapshot(t).board.length, 0);
  // đang TOEIC, người khác tặng You're awesome (Khó) → đổi độ khó câu sau; tặng Rose (Dễ) → đổi sang Dễ; tặng TikTok → về Tổng hợp · Dễ
  gift(7, '3', 'Friendship Necklace', 10, (t += 10));
  game.command('next', (t += 10));
  game.command('next', (t += 10));
  assert.equal(game.snapshot(t).control.set, 'toeic');
  gift(5, '5', "You're awesome", 1, (t += 10));
  assert.equal(sw.snapshot().level, 'hard');
  gift(5, '1', 'Rose', 1, (t += 10));
  assert.equal(sw.snapshot().level, 'easy');
  gift(6, '2', 'TikTok', 1, (t += 10));
  assert.deepEqual([sw.snapshot().set, sw.snapshot().level], ['general', 'easy']);
  assert.ok(filterByLevel(loadEnglishSets().toeic, 'hard').every((q) => q.level === 3));
});

test('english switcher: a gift during a golden question waits for it to end, then next question switches set', () => {
  const english = loadEnglishQuestions();
  const sw = createEnglishSwitcher({ general: english.filter((q) => !q.basic), basic: [], sets: loadEnglishSets() });
  const game = createQuizGame({ id: 'english', title: 'E', deck: sw.deck, onGift: (e) => sw.onGift(e), extraState: () => sw.snapshot() });
  game.tick(0);
  game.handleEvent({ type: 'like', user: user(1), likeCount: 200 }, 5);
  game.command('next', 10);
  game.command('next', 20);
  assert.equal(game.snapshot(20).golden, true); // câu vàng đang hỏi
  game.handleEvent({ type: 'gift', user: user(2), gift: { name: 'Friendship Necklace', diamondsEach: 10, count: 1, diamonds: 10 } }, 30);
  // câu vàng đang hỏi không bị cắt ngang:
  assert.equal(game.snapshot(30).golden, true);
  assert.notEqual(game.snapshot(30).category, 'Tiếng Anh · TOEIC');
  // kết thúc câu vàng, câu tiếp theo chuyển sang TOEIC:
  game.command('next', 40);
  game.command('next', 50);
  assert.equal(game.snapshot(50).category, 'Tiếng Anh · TOEIC');
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

test('english rotation: general → set → back to general never repeats a word, survives a restart, and only a fully used pool starts over', async () => {
  const { foldText } = await import('../src/games/text-match.js');
  const key = (q) => foldText(q.answer).replace(/ /g, '');
  const english = loadEnglishQuestions();
  const sets = loadEnglishSets();
  let saved = [];
  const progress = { load: () => [...saved], save: (list) => { saved = [...list]; } };
  const make = () => createEnglishSwitcher({ general: english.filter((q) => !q.basic), basic: english.filter((q) => q.basic), sets, progress });
  const asked = [];
  let sw = make();
  for (let i = 0; i < 100; i += 1) asked.push(key(sw.deck.next())); // Tổng hợp câu 1..100
  const firstSet = Object.keys(sets).find((id) => sets[id].length);
  sw.command(`deck-${firstSet}`);
  for (let i = 0; i < 25; i += 1) asked.push(key(sw.deck.next())); // bộ riêng rồi tự quay về Tổng hợp
  sw.command('deck-hard');
  for (let i = 0; i < 25; i += 1) asked.push(key(sw.deck.next())); // đổi độ khó
  sw = make(); // khởi động lại server: đọc sổ đã lưu
  for (let i = 0; i < 100; i += 1) asked.push(key(sw.deck.next()));
  assert.equal(new Set(asked).size, asked.length, 'có từ bị hỏi lặp');
  // bộ nhỏ: hỏi hết thì vòng mới, không kẹt
  const tiny = createEnglishSwitcher({ general: english.slice(0, 3), basic: [], sets: {} });
  const round = Array.from({ length: 6 }, () => key(tiny.deck.next()));
  assert.equal(new Set(round.slice(0, 3)).size, 3);
  assert.equal(new Set(round.slice(3)).size, 3);
});

test('english topics resume where they left off (A 40, B 10, C 2 → back to A goes on), whatever the level, no word twice', async () => {
  const { foldText } = await import('../src/games/text-match.js');
  const key = (q) => foldText(q.answer).replace(/ /g, '');
  const english = loadEnglishQuestions();
  const sets = loadEnglishSets();
  const sw = createEnglishSwitcher({ general: english.filter((q) => !q.basic), basic: english.filter((q) => q.basic), sets });
  const asked = [];
  const ask = (to, n) => {
    sw.command(`deck-${to}`);
    const keys = new Set(['easy', 'normal', 'hard'].includes(to) ? [] : (to === 'general' ? english : sets[to]).map(key));
    for (let i = 0; i < n; i += 1) {
      const k = key(sw.deck.next());
      if (keys.size) assert.ok(keys.has(k), `${to}: câu ${i + 1} không thuộc bộ`);
      asked.push(k);
    }
  };
  ask('toeic', 20); ask('toeic', 20); // A: 40 câu
  ask('ielts', 10); // B: 10
  ask('dongvat', 2); // C: 2
  ask('easy', 0); ask('toeic', 15); // quay lại A, độ khó Dễ: câu 41…
  ask('normal', 0); ask('ielts', 10); // B, Thường: câu 11…
  ask('hard', 0); ask('dongvat', 10); ask('general', 30); // C Khó, rồi Tổng hợp
  assert.equal(new Set(asked).size, asked.length, 'đổi bộ / độ khó mà bị hỏi lại từ cũ');
});

test('special questions: Hoang Sa Truong Sa question validator and priority queue', async () => {
  const { checkVietNamAnswer, createHoangSaTruongSaQuestions } = await import('../src/games/quiz/special-questions.js');
  // Chấp nhận: viết hoa chữ cái đầu (V), hoa cả 2 từ, hoặc hoa toàn bộ
  assert.equal(checkVietNamAnswer('Viet Nam'), true);
  assert.equal(checkVietNamAnswer('Việt Nam'), true);
  assert.equal(checkVietNamAnswer('VIET NAM'), true);
  assert.equal(checkVietNamAnswer('VIỆT NAM'), true);
  assert.equal(checkVietNamAnswer('VietNam'), true);
  assert.equal(checkVietNamAnswer('ViệtNam'), true);
  assert.equal(checkVietNamAnswer('VIETNAM'), true);
  assert.equal(checkVietNamAnswer('VIỆTNAM'), true);
  assert.equal(checkVietNamAnswer('Việt nam'), true);
  assert.equal(checkVietNamAnswer('Viet nam'), true);
  assert.equal(checkVietNamAnswer('Việt Nam 🇻🇳'), true);
  assert.equal(checkVietNamAnswer('🇻🇳 Việt Nam'), true);

  // Không chấp nhận: viết thường chữ cái đầu (v)
  assert.equal(checkVietNamAnswer('viet nam'), false);
  assert.equal(checkVietNamAnswer('việt nam'), false);
  assert.equal(checkVietNamAnswer('vietnam'), false);
  assert.equal(checkVietNamAnswer('việtnam'), false);
  assert.equal(checkVietNamAnswer('viet Nam'), false);
  assert.equal(checkVietNamAnswer('việt Nam'), false);
  assert.equal(checkVietNamAnswer('Trung Quoc'), false);
  assert.equal(checkVietNamAnswer(''), false);

  const qs = createHoangSaTruongSaQuestions();
  assert.equal(qs.length, 2);
  assert.equal(qs[0].prompt, 'Hoàng Sa, Trường Sa là của đất nước nào?');
  assert.equal(qs[1].prompt, 'Lại một lần nữa nè Hoàng Sa, Trường Sa là của đất nước nào?');
  assert.equal(qs[0].answer, 'Việt Nam');
  assert.equal(qs[1].answer, 'Việt Nam');

  // Test game queuePriority
  const game = createQuizGame({ id: 'test_vn', title: 'Test VN', deck: fixedDeck(textQ('NORMAL1'), textQ('NORMAL2')) });
  game.tick(1000); // bắt đầu câu NORMAL1
  assert.equal(game.snapshot().qNumber, 1);

  // Nạp 2 câu đặc biệt
  game.queuePriority(qs);

  // Kết thúc câu 1
  game.command('next', 1000); // reveal
  game.tick(20000); // sang câu tiếp theo

  const snap2 = game.snapshot();
  assert.equal(snap2.prompt, 'Hoàng Sa, Trường Sa là của đất nước nào?');

  // Thử trả lời sai: chữ thường 'viet nam' -> không trúng
  const fxFail = game.handleEvent(chat(1, 'viet nam'), 21000);
  assert.ok(!fxFail.some(f => f.kind === 'quizCorrect'));

  // Trả lời đúng: 'Việt Nam' -> trúng
  const fxOk = game.handleEvent(chat(2, 'Việt Nam'), 22000);
  assert.ok(fxOk.some(f => f.kind === 'quizCorrect'));

  // Sang câu tiếp theo
  game.command('next', 23000); // reveal
  game.tick(35000);

  const snap3 = game.snapshot();
  assert.equal(snap3.prompt, 'Lại một lần nữa nè Hoàng Sa, Trường Sa là của đất nước nào?');

  // Sau khi hết 2 câu đặc biệt, câu kế tiếp quay lại deck bình thường
  game.command('next', 36000);
  game.tick(50000);
  const snap4 = game.snapshot();
  assert.equal(snap4.category, 'Thử'); // quay lại NORMAL2
});
