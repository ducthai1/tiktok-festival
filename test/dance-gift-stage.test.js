import assert from 'node:assert/strict';
import test from 'node:test';
import { createGiftStage } from '../public/stage/scenes/dance-gift-stage.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('a big gift owns the stage: voice first, then its effects; others wait, small gifts stay quiet', async () => {
  const voice = []; // [câu, bắt đầu đọc]
  const stage = createGiftStage({ speak: (line, onStart) => voice.push([line, onStart]), maxWaitMs: 1000 });
  const ran = [];
  const big1 = stage.big({ userId: 'u1', line: 'Đại gia A', effects: [() => ran.push('kèn A')], holdMs: 60 });
  stage.attach(big1, () => ran.push('pháo hoa A')); // hiệu ứng đi kèm cùng gói quà
  stage.run(() => ran.push('solo A'), 'u1'); // solo của chính người tặng → đi cùng khoảnh khắc
  assert.equal(stage.busy(), true); // quà nhỏ lúc này chỉ được hiện thông báo
  stage.big({ userId: 'u2', line: 'Đại gia B', effects: [() => ran.push('kèn B')], holdMs: 30 });
  stage.run(() => ran.push('DROP thanh quẩy')); // DROP do thanh Độ Quẩy: xếp hàng sau
  assert.deepEqual(ran, []); // chưa ai đọc → chưa hiệu ứng nào
  assert.deepEqual(voice.map(([l]) => l), ['Đại gia A']); // quà B chưa được đọc chen ngang
  voice[0][1](); // giọng A bắt đầu đọc
  assert.deepEqual(ran, ['kèn A', 'pháo hoa A', 'solo A']);
  stage.attach(big1, () => ran.push('trễ A')); // gắn sau khi đã diễn → chạy luôn
  await wait(20);
  assert.deepEqual(voice.map(([l]) => l), ['Đại gia A']); // A còn giữ sân khấu
  await wait(60);
  assert.deepEqual(voice.map(([l]) => l), ['Đại gia A', 'Đại gia B']); // hết lượt A mới tới B
  voice[1][1]();
  await wait(60);
  assert.deepEqual(ran, ['kèn A', 'pháo hoa A', 'solo A', 'trễ A', 'kèn B', 'DROP thanh quẩy']);
  assert.equal(stage.busy(), false);
});

test('an idle stage plays small moments at once, and a silent voice never blocks the effects', async () => {
  const stage = createGiftStage({ speak: () => {}, maxWaitMs: 30 }); // giọng không bao giờ báo bắt đầu
  const ran = [];
  const m = stage.now({ userId: 'u9', line: 'Cảm ơn', effects: [() => ran.push('xu')] });
  stage.run(() => ran.push('solo u9'), 'u9');
  assert.equal(stage.busy(), false);
  assert.deepEqual(ran, []);
  await wait(60);
  assert.deepEqual(ran, ['xu', 'solo u9']);
  stage.run(() => ran.push('ngay')); // rảnh → chạy luôn
  assert.deepEqual(ran.at(-1), 'ngay');
  assert.equal(m.started, true);
});
