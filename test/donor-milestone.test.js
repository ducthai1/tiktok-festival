import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameHub, DONOR_STEP } from '../src/games/game-hub.js';

const user = (n) => ({ id: `u${n}`, uniqueId: `u${n}`, nickname: `Người ${n}`, avatar: '' });
const gift = (n, diamonds) => ({ type: 'gift', user: user(n), gift: { id: 'g', name: 'Quà', diamondsEach: diamonds, count: 1, diamonds } });
const milestones = (fx) => fx.filter((f) => f.kind === 'donorMilestone').map((f) => [f.userId, f.milestone, f.total]);

test('donor celebration: every 100 💎 a person gives in this live room → one big celebration; one huge gift → its highest milestone', () => {
  assert.equal(DONOR_STEP, 100);
  const hub = createGameHub({ startGame: 'english' });
  hub.tick(0);
  assert.deepEqual(milestones(hub.handleEvent(gift(1, 60), 10)), []);
  assert.deepEqual(milestones(hub.handleEvent(gift(1, 50), 20)), [['u1', 100, 110]]); // 60 + 50 cộng dồn
  assert.deepEqual(milestones(hub.handleEvent(gift(1, 80), 30)), []); // 190
  assert.deepEqual(milestones(hub.handleEvent(gift(1, 10), 40)), [['u1', 200, 200]]);
  assert.deepEqual(milestones(hub.handleEvent(gift(1, 350), 50)), [['u1', 500, 550]]); // vượt 3 mốc: một màn, mốc cao nhất
  assert.deepEqual(milestones(hub.handleEvent(gift(2, 99), 60)), []); // người khác tính riêng
  assert.deepEqual(milestones(hub.handleEvent({ type: 'like', user: user(2), likeCount: 500 }, 70)), []);
  hub.resetRoom(); // phòng live mới: đếm lại từ 0
  assert.deepEqual(milestones(hub.handleEvent(gift(1, 99), 80)), []);
  assert.deepEqual(milestones(hub.handleEvent(gift(2, 1), 90)), []);
});
