import assert from 'node:assert/strict';
import test from 'node:test';
import { depthScale, screenXPx } from '../public/shared/temple-camera.js';
import { CROWD_SCALE, LABEL_HEIGHT, LABEL_KEEP_OUT, LABEL_OVERLAP_MAX, LABEL_WIDTH, SAFE_X, TEMPLE_SEATS, VIP_SEATS, seatLabelBox } from '../public/shared/temple-seats.js';
import { createTempleGame, TEMPLE_SLOTS } from '../src/games/temple-game.js';

const area = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

test('the temple has more kneeling places than before and the server uses the same count', () => {
  // trước đây 30 chỗ nhưng 14 chỗ nằm ngoài phần điện thoại thấy được (chỉ ~16 chỗ lộ người)
  assert.ok(TEMPLE_SEATS.length >= 31, `chỉ có ${TEMPLE_SEATS.length} chỗ`);
  assert.equal(TEMPLE_SLOTS, TEMPLE_SEATS.length);
});

test('every kneeling person and name tag stays inside what a long phone screen shows', () => {
  for (const [i, seat] of TEMPLE_SEATS.entries()) {
    const label = seatLabelBox(seat);
    assert.ok(label.left >= SAFE_X - 0.5 && label.right <= 1080 - SAFE_X + 0.5, `nhãn chỗ ${i} ra ngoài: ${label.left}–${label.right}`);
    assert.ok(label.top >= 860, `nhãn chỗ ${i} che lên tượng Phật: ${label.top}`);
    // tâm người khớp chỗ đã tính bằng đúng phép chiếu của camera
    assert.ok(Math.abs(screenXPx(seat.x, seat.depth) - seat.screenX) < 1, `chỗ ${i} lệch phép chiếu`);
    const halfBody = (0.25 * depthScale(seat.depth) * CROWD_SCALE * (screenXPx(1, seat.depth) - 540));
    assert.ok(seat.screenX - halfBody >= SAFE_X && seat.screenX + halfBody <= 1080 - SAFE_X, `người ở chỗ ${i} bị cắt`);
  }
});

test('name tags never cover the how-to panel or the bell and wooden fish', () => {
  for (const [i, seat] of TEMPLE_SEATS.entries()) {
    const label = seatLabelBox(seat);
    for (const zone of LABEL_KEEP_OUT) assert.equal(area(label, zone), 0, `nhãn chỗ ${i} đè vùng cấm`);
  }
});

test('nobody kneels on the red carpet aisle and every place is used once', () => {
  for (const seat of TEMPLE_SEATS) assert.ok(Math.abs(seat.x) >= 0.72, `chỗ ${seat.x} nằm trên thảm`);
  const keys = new Set(TEMPLE_SEATS.map((s) => `${s.x}|${s.z}`));
  assert.equal(keys.size, TEMPLE_SEATS.length);
});

test('name tags overlap at most a little so every name stays readable', () => {
  const boxes = TEMPLE_SEATS.map(seatLabelBox);
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = 0; j < i; j += 1) {
      assert.ok(area(boxes[i], boxes[j]) <= LABEL_OVERLAP_MAX * LABEL_WIDTH * LABEL_HEIGHT + 1, `nhãn ${i} đè nhãn ${j}`);
    }
  }
});

test('the front row by the altar is the first to fill (it is for the most devoted)', () => {
  const front = Math.max(...TEMPLE_SEATS.map((s) => s.depth));
  for (const seat of TEMPLE_SEATS.slice(0, VIP_SEATS)) assert.equal(seat.depth, front);
});

test('a viewer who only watched leaves after 5 quiet minutes, one who took part stays 10', () => {
  const temple = createTempleGame({ random: () => 0.5 });
  const user = (n) => ({ id: `u${n}`, uniqueId: `u${n}`, nickname: `Người ${n}`, avatar: '' });
  temple.handleEvent({ type: 'member', user: user(1) }, 0);
  temple.handleEvent({ type: 'like', user: user(2), likeCount: 3 }, 0);
  const leftAt = (minutes) => temple.tick(minutes * 60000).filter((f) => f.kind === 'leave').map((f) => f.userId);
  assert.deepEqual(leftAt(4.9), []);
  assert.deepEqual(leftAt(5.1), ['u1']);
  assert.deepEqual(leftAt(9.9), []);
  assert.deepEqual(leftAt(10.1), ['u2']);
});
