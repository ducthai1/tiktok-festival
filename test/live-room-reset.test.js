import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRoomTracker } from '../src/live/room-tracker.js';
import { createGameHub } from '../src/games/game-hub.js';
import { createQuizGame, ENERGY_GOLDEN, FOLLOW_POINTS, INACTIVE_MS, SHARE_ENERGY } from '../src/games/quiz/quiz-game.js';

const user = (n) => ({ id: `u${n}`, uniqueId: `u${n}`, nickname: `Người ${n}`, avatar: '' });
const word = (answer) => ({ kind: 'text', category: 'T', answer, prompt: '?', accept: [answer.toLowerCase()] });
const deck = () => {
  let i = 0;
  return { next: () => word(`W${(i += 1)}`) };
};

test('leaderboard + ambassadors: 2 hours without ANY interaction removes a person; coming back starts from 0', () => {
  const game = createQuizGame({ id: 't', title: 'T', deck: deck() });
  game.tick(0);
  game.handleEvent({ type: 'chat', user: user(1), comment: 'w1' }, 100); // An đúng
  game.handleEvent({ type: 'chat', user: user(2), comment: 'w1' }, 200); // Bình đúng
  game.handleEvent({ type: 'share', user: user(1) }, 300);
  game.handleEvent({ type: 'share', user: user(2) }, 300);
  assert.equal(game.snapshot(400).board.length, 2);
  // Bình vẫn thả tim mỗi tiếng → còn trên bảng; An im lặng
  game.handleEvent({ type: 'like', user: user(2), likeCount: 1 }, 3600000);
  game.tick(INACTIVE_MS + 1000);
  const snap = game.snapshot(INACTIVE_MS + 1000);
  assert.deepEqual(snap.board.map((r) => r.id), ['u2']);
  assert.deepEqual(snap.ambassadors.map((a) => a.id), ['u2']);
  game.handleEvent({ type: 'share', user: user(1) }, INACTIVE_MS + 2000); // An quay lại: tính từ 0
  assert.equal(game.snapshot(INACTIVE_MS + 2000).ambassadors.find((a) => a.id === 'u1').shares, 1);
});

test('new live room: energy, follow goal, follow bonus and share energy reset — scores and ambassadors stay', () => {
  const game = createQuizGame({ id: 't', title: 'T', deck: deck() });
  game.tick(0);
  game.handleEvent({ type: 'chat', user: user(1), comment: 'w1' }, 10);
  game.handleEvent({ type: 'like', user: user(9), likeCount: ENERGY_GOLDEN + 50 }, 20);
  game.handleEvent({ type: 'follow', user: user(3) }, 30);
  for (let i = 0; i < 5; i += 1) game.handleEvent({ type: 'share', user: user(4) }, 40 + i);
  const before = game.snapshot(50);
  assert.ok(before.energy.goldenPending && before.energy.follows === 1);
  game.resetRoom();
  const after = game.snapshot(60);
  assert.deepEqual([after.energy.value, after.energy.goldenPending, after.energy.follows], [0, false, 0]);
  assert.equal(after.board[0].id, 'u1');
  assert.equal(after.ambassadors[0].shares, 5);
  // phòng mới: follow lại được +3, share lại nạp năng lượng
  assert.equal(game.handleEvent({ type: 'follow', user: user(3) }, 70).find((f) => f.kind === 'quizFollow').points, FOLLOW_POINTS);
  assert.equal(game.handleEvent({ type: 'share', user: user(4) }, 80).find((f) => f.kind === 'quizShare').energy, SHARE_ENERGY);
});

test('new live room: the English tab drops the old room mode (listening / set / level) through the hub', () => {
  const hub = createGameHub({ startGame: 'english', englishListenReady: () => true });
  hub.tick(0);
  hub.command('english', 'deck-toeic', 10);
  hub.command('english', 'deck-hard', 20);
  assert.deepEqual([hub.snapshot(30).state.control.set, hub.snapshot(30).state.control.level], ['toeic', 'hard']);
  hub.resetRoom();
  assert.deepEqual([hub.snapshot(40).state.control.set, hub.snapshot(40).state.control.level], ['general', 'normal']);
});

test('room tracker: same room after a reconnect or restart is not new; another room id is, and it is remembered on disk', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'room-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'live-room.json');
  const a = createRoomTracker(file);
  assert.equal(a.isNew('111'), true); // lần đầu chưa biết phòng nào
  assert.equal(a.isNew('111'), false); // mất kết nối rồi nối lại cùng phòng
  assert.equal(a.isNew(''), false);
  const restarted = createRoomTracker(file); // khởi động lại server giữa buổi
  assert.equal(restarted.isNew('111'), false);
  assert.equal(restarted.isNew('222'), true); // tắt live, mở live mới
  assert.equal(createRoomTracker(file).last(), '222');
});

test('"Xoá dữ liệu phiên live trước": every game starts over (question count, scores, energy, mode), gift rules + asked words are kept', () => {
  const saved = [];
  let stored = []; // giống data/english-seen.json: lưu gì thì nạp lại đúng thế
  const progress = { load: () => stored, save: (list) => { stored = list; saved.push(list.length); }, flush: () => {} };
  const hub = createGameHub({ startGame: 'english', englishProgress: progress, englishListenReady: () => true });
  const rules = [{ to: 'toeic', gift: { id: '9947', name: 'Friendship Necklace', coins: 10, image: '' }, questions: 15, enabled: true }];
  hub.setEnglishRules(rules);
  hub.tick(0);
  for (let i = 0; i < 6; i += 1) hub.command('english', 'next', 10 + i);
  hub.handleEvent({ type: 'like', user: user(9), likeCount: 250 }, 20);
  hub.handleEvent({ type: 'gift', user: user(2), gift: { id: '9947', name: 'Friendship Necklace', diamondsEach: 10, count: 1, diamonds: 10 } }, 30);
  hub.handleEvent({ type: 'chat', user: user(3), comment: 'hello' }, 40);
  const before = hub.snapshot(50).state;
  assert.ok(before.qNumber >= 3 && before.energy.value === 250 && before.control.set === 'toeic');
  const askedBefore = saved.at(-1);
  hub.resetAll();
  hub.tick(60);
  const after = hub.snapshot(60);
  assert.deepEqual([after.state.qNumber, after.state.energy.value, after.state.control.set, after.state.board.length, after.top.length], [1, 0, 'general', 0, 0]);
  assert.deepEqual(after.state.control.rules.map((r) => `${r.gift.name}>${r.to}:${r.questions}`), ['Friendship Necklace>toeic:15']); // bảng quà giữ nguyên
  assert.ok(saved.at(-1) >= askedBefore); // sổ từ đã hỏi không bị xoá
  assert.equal(hub.activeId(), 'english');
});
