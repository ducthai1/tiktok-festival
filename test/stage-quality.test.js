import assert from 'node:assert/strict';
import test from 'node:test';
import { createFrameLimiter, LITE_MAX_FPS, LITE_PIXEL_RATIO, stageQuality } from '../public/stage/stage-quality.js';

// Đếm số khung được vẽ trong `seconds` giây trên màn có tần số `hz` (khung đến hơi lệch nhịp như máy thật).
function drawnPerSecond(maxFps, hz, seconds = 3) {
  const draw = createFrameLimiter(maxFps);
  let drawn = 0;
  const frames = hz * seconds;
  for (let i = 0; i < frames; i += 1) {
    const jitter = (i % 3) - 1; // ±1 ms
    if (draw(1000 + (i * 1000) / hz + jitter)) drawn += 1;
  }
  return drawn / seconds;
}

test('the stage stays at full quality unless lite is asked for', () => {
  for (const search of ['', '?fps=1', '?preview=1', '?lite=0', '?lite=false']) {
    const q = stageQuality(search);
    assert.equal(q.lite, false, search);
    assert.deepEqual([q.antialias, q.shadows, q.bloom, q.glass, q.maxPixelRatio, q.maxFps], [true, true, true, true, 1, 0], search);
  }
});

test('lite mode draws fewer pixels with no costly effects', () => {
  for (const search of ['?lite=1', '?lite', '?fps=1&lite=1']) {
    const q = stageQuality(search);
    assert.equal(q.lite, true, search);
    assert.deepEqual([q.antialias, q.shadows, q.bloom, q.glass], [false, false, false, false], search);
    assert.equal(q.maxPixelRatio, LITE_PIXEL_RATIO);
    assert.equal(q.maxFps, LITE_MAX_FPS);
  }
  // 1080×1920 × 2/3 = 720×1280: đúng 720p, khung chữ nhật không méo
  assert.equal(Math.round(1080 * LITE_PIXEL_RATIO), 720);
  assert.equal(Math.round(1920 * LITE_PIXEL_RATIO), 1280);
});

test('the frame limiter holds 30 fps on 60 and 120 Hz screens and never drops a slower screen', () => {
  assert.equal(drawnPerSecond(30, 60), 30);
  assert.equal(drawnPerSecond(30, 120), 30);
  assert.equal(drawnPerSecond(30, 30), 30); // máy chỉ kịp 30: vẽ đủ, không bỏ khung nào
  assert.equal(drawnPerSecond(30, 24), 24);
  assert.equal(drawnPerSecond(0, 60), 60); // không chặn trần = vẽ mọi khung như cũ
});
