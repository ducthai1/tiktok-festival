import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameHub, DONOR_STEP } from '../src/games/game-hub.js';

const user = (n) => ({ id: `u${n}`, uniqueId: `u${n}`, nickname: `Người ${n}`, avatar: '' });
const gift = (n, diamonds) => ({ type: 'gift', user: user(n), gift: { id: 'g', name: 'Quà', diamondsEach: diamonds, count: 1, diamonds } });
const milestones = (fx) => fx.filter((f) => f.kind === 'donorMilestone').map((f) => [f.userId, f.milestone, f.total]);

test('donor celebration: every 50 💎 a person gives in this live room → one big celebration; one huge gift → its highest milestone', () => {
  assert.equal(DONOR_STEP, 50);
  const hub = createGameHub({ startGame: 'english' });
  hub.tick(0);
  assert.deepEqual(milestones(hub.handleEvent(gift(1, 30), 10)), []);
  assert.deepEqual(milestones(hub.handleEvent(gift(1, 25), 20)), [['u1', 50, 55]]); // 30 + 25 cộng dồn
  assert.deepEqual(milestones(hub.handleEvent(gift(1, 40), 30)), []); // 95
  assert.deepEqual(milestones(hub.handleEvent(gift(1, 10), 40)), [['u1', 100, 105]]);
  assert.deepEqual(milestones(hub.handleEvent(gift(1, 150), 50)), [['u1', 250, 255]]); // vượt nhiều mốc: một màn, mốc cao nhất
  assert.deepEqual(milestones(hub.handleEvent(gift(2, 49), 60)), []); // người khác tính riêng
  assert.deepEqual(milestones(hub.handleEvent({ type: 'like', user: user(2), likeCount: 500 }, 70)), []);
  hub.resetRoom(); // phòng live mới: đếm lại từ 0
  assert.deepEqual(milestones(hub.handleEvent(gift(1, 49), 80)), []);
  assert.deepEqual(milestones(hub.handleEvent(gift(2, 1), 90)), []);
});
