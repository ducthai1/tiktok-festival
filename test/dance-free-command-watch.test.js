import assert from 'node:assert/strict';
import test from 'node:test';
import { createFreeCommandWatch } from '../public/stage/scenes/dance-free-command-watch.js';

const dancer = (patch = {}) => ({ id: 'u1', look: 0, size: 1, move: '', ...patch });

test('a real viewer who changes look or size, or starts a command move, gets the camera', () => {
  for (const patch of [{ look: 3 }, { size: 1.2 }, { size: 0.8 }, { move: 'jump' }, { move: 'hype' }, { move: 'wave' }]) {
    const watch = createFreeCommandWatch();
    assert.equal(watch.used(dancer(), false), false, 'lần đầu thấy người này: chưa có gì để so');
    assert.equal(watch.used(dancer(patch), false), true, JSON.stringify(patch));
  }
});

test('nothing changed, a move ending, a flying car, a DROP or a seed dancer never moves the camera', () => {
  const watch = createFreeCommandWatch();
  watch.used(dancer({ move: 'hype' }), false);
  assert.equal(watch.used(dancer({ move: 'hype' }), false), false, 'vẫn đang quẩy, không phải lệnh mới');
  assert.equal(watch.used(dancer(), false), false, 'hết quẩy');
  assert.equal(watch.used(dancer({ move: 'ride' }), false), false, 'xe bay là quà, đã có camera riêng');
  assert.equal(watch.used(dancer({ move: 'hype' }), true), false, 'DROP: cả sàn cùng quẩy');

  const seeds = createFreeCommandWatch();
  seeds.used(dancer({ id: 'seed:3' }), false);
  assert.equal(seeds.used(dancer({ id: 'seed:3', look: 5, move: 'jump' }), false), false);
});

test('a viewer who left and came back starts fresh', () => {
  const watch = createFreeCommandWatch();
  watch.used(dancer(), false);
  watch.keepOnly(new Map());
  assert.equal(watch.used(dancer({ look: 9 }), false), false);
});
