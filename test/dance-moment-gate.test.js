import assert from 'node:assert/strict';
import test from 'node:test';
import { createMomentGate } from '../public/stage/scenes/dance-moment-gate.js';

test('big effects wait for the thank-you voice to start, in order, and never wait forever', async () => {
  const gate = createMomentGate({ maxWaitMs: 40 });
  const ran = [];
  gate.run(() => ran.push('ngay')); // cổng mở → chạy luôn
  const release = gate.hold();
  gate.run(() => ran.push('kèn'));
  gate.run(() => ran.push('pháo hoa'));
  assert.deepEqual(ran, ['ngay']);
  release();
  release(); // gọi lại không tính thêm
  assert.deepEqual(ran, ['ngay', 'kèn', 'pháo hoa']);
  gate.hold(); // giọng lỗi, không bao giờ báo bắt đầu đọc
  gate.run(() => ran.push('DROP'));
  await new Promise((r) => setTimeout(r, 80));
  assert.deepEqual(ran.at(-1), 'DROP');
});
