import assert from 'node:assert/strict';
import test from 'node:test';
import { createWelcomeQueue, GROUP_ABOVE, GROUP_SIZE, REGREET_AFTER_MS, welcomePace } from '../src/games/welcome-queue.js';
import { createGameHub } from '../src/games/game-hub.js';
import { createBarClubGame, BAR_SEATS } from '../src/games/bar-club-game.js';
import { createTempleGame, TEMPLE_SLOTS } from '../src/games/temple-game.js';
import { sanitizeLiveEvent } from '../src/live/live-event-schema.js';
import { normalizeConnectorEvent } from '../src/live/normalize-tiktok-connector.js';
import { normalizeTikFinityMessage } from '../src/live/normalize-tikfinity.js';

const user = (n) => ({ id: `u${n}`, uniqueId: `u${n}`, nickname: `Người ${n}`, avatar: '' });
const member = (n) => ({ type: 'member', user: user(n) });
const chat = (n, comment = 'chào') => ({ type: 'chat', user: user(n), comment });

// Chạy tick tới khi hết hàng, trả danh sách thẻ chào theo thứ tự.
function drain(queue, start = 0, stepMs = 100, limitMs = 600000) {
  const cards = [];
  for (let t = start; t < start + limitMs && (queue.backlog() || t === start); t += stepMs) cards.push(...queue.tick(t));
  return cards;
}

test('a small crowd is welcomed one by one, in arrival order', () => {
  const q = createWelcomeQueue();
  for (let i = 1; i <= GROUP_ABOVE; i += 1) assert.deepEqual(q.notice(user(i), 0), []);
  assert.deepEqual(q.pendingIds().slice(0, 2), ['u1', 'u2']);
  const cards = drain(q);
  assert.equal(cards.length, GROUP_ABOVE);
  assert.deepEqual(cards.map((c) => c.nickname), Array.from({ length: GROUP_ABOVE }, (_, i) => `Người ${i + 1}`));
  assert.ok(cards.every((c) => c.mode === 'full'));
  assert.equal(welcomePace(5), 2400);
  assert.equal(welcomePace(15), 1500);
});

test('more than 20 waiting: dozens walk in together as one group, every name kept, then back to one by one', () => {
  const q = createWelcomeQueue();
  for (let i = 1; i <= 100; i += 1) q.notice(user(i), 0);
  const cards = drain(q);
  const groups = cards.filter((c) => c.mode === 'group');
  assert.deepEqual(groups.map((g) => g.people.length), [GROUP_SIZE, GROUP_SIZE]); // 2 đoàn 40 người
  assert.ok(groups.every((g) => g.people.every((p) => p.nickname && p.userId)));
  assert.ok(groups[0].durationMs > 5000); // đoàn đông có thêm thời gian để bước vào
  const welcomed = cards.flatMap((c) => (c.mode === 'group' ? c.people.map((p) => p.nickname) : [c.nickname]));
  assert.deepEqual(welcomed, Array.from({ length: 100 }, (_, i) => `Người ${i + 1}`)); // không sót, đúng thứ tự
  assert.equal(cards.filter((c) => c.mode === 'full').length, 20); // 20 người cuối: chào riêng từng người
});

test('same person is greeted once, again only after coming back 10 minutes later', () => {
  const q = createWelcomeQueue();
  q.notice(user(1), 0);
  q.notice(user(1), 1000); // vào lại ngay / vừa vào vừa bình luận
  assert.equal(drain(q).length, 1);
  q.notice(user(1), REGREET_AFTER_MS - 1);
  assert.equal(q.backlog(), 0);
  q.notice(user(1), REGREET_AFTER_MS + 5000);
  assert.equal(q.backlog(), 1);
});

test('above the viewer threshold each newcomer gets a text line immediately instead of a card', () => {
  const q = createWelcomeQueue({ textAbove: 1000 });
  q.setViewerCount(1000);
  assert.equal(q.notice(user(1), 0).length, 0); // đúng 1000: vẫn chào đầy đủ
  q.setViewerCount(1001);
  const fx = q.notice(user(2), 0);
  assert.equal(fx[0].mode, 'text');
  assert.equal(fx[0].nickname, 'Người 2');
  q.setThreshold(5000);
  assert.equal(q.notice(user(3), 0).length, 0);
});

test('hub: member events and first interactions both welcome; viewer counts switch the mode', () => {
  const hub = createGameHub({ startGame: 'swim' });
  hub.handleEvent(member(1), 0);
  hub.handleEvent(chat(2), 0); // đã ở trong phòng trước khi kết nối, giờ mới lên tiếng
  const names = [...hub.tick(0), ...hub.tick(3000)].filter((f) => f.kind === 'welcome').map((f) => f.nickname);
  assert.deepEqual(names, ['Người 1', 'Người 2']);
  hub.handleEvent({ type: 'viewers', viewerCount: 2500 }, 4000);
  assert.equal(hub.snapshot(4000).viewers.count, 2500);
  const fx = hub.handleEvent(member(3), 4000);
  assert.equal(fx.find((f) => f.kind === 'welcome').mode, 'text');
  hub.setWelcomeThreshold(10000);
  hub.handleEvent(member(4), 4001);
  assert.equal(hub.snapshot(4001).viewers.waiting, 1);
});

test('bar: newcomers take a free seat but never push out someone who is interacting', () => {
  const bar = createBarClubGame({ random: () => 0 });
  for (let i = 0; i < BAR_SEATS; i += 1) bar.handleEvent(chat(i), i);
  assert.equal(bar.handleEvent(member(100), 100).length, 0); // quán đầy người đang chat: không ai bị đẩy
  assert.equal(bar.snapshot(100).patrons.length, BAR_SEATS);
  const bar2 = createBarClubGame({ random: () => 0 });
  for (let i = 0; i < BAR_SEATS; i += 1) bar2.handleEvent(member(i), i);
  const fx = bar2.handleEvent(member(200), 200); // quán đầy người chỉ xem: người xem lâu nhất nhường chỗ
  assert.equal(fx[0].kind, 'leave');
  assert.equal(fx[0].userId, 'u0');
  const fx2 = bar2.handleEvent(chat(300), 300); // người bình luận được ưu tiên chỗ hơn người chỉ xem
  assert.equal(fx2[0].kind, 'leave');
});

test('temple: newcomers walk into the hall; full hall of active devotees is not disturbed', () => {
  const temple = createTempleGame();
  assert.deepEqual(temple.handleEvent(member(1), 0).map((f) => f.kind), ['join']);
  assert.equal(temple.snapshot(0).devotees.length, 1);
  assert.equal(temple.snapshot(0).totals.merit, 0); // vào phòng không cộng điểm
  for (let i = 2; i <= TEMPLE_SLOTS; i += 1) temple.handleEvent(chat(i), i);
  temple.handleEvent(chat(1), 50); // người 1 cũng đã tương tác
  assert.equal(temple.handleEvent(member(999), 100).length, 0);
});

test('viewer counts are read from both TikTok room stats and member events', () => {
  assert.deepEqual(normalizeConnectorEvent('roomUser', { viewerCount: 321 }), { type: 'viewers', viewerCount: 321 });
  assert.equal(normalizeConnectorEvent('member', { memberCount: 77, user: { userId: '1', uniqueId: 'a' } }).viewerCount, 77);
  assert.equal(normalizeTikFinityMessage(JSON.stringify({ event: 'roomUser', data: { viewerCount: 12 } }))[0].viewerCount, 12);
  assert.deepEqual(sanitizeLiveEvent({ type: 'viewers', viewerCount: 'abc' }), null);
  assert.equal(sanitizeLiveEvent({ type: 'viewers', viewerCount: 5 }).viewerCount, 5);
});
