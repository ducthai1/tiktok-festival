import assert from 'node:assert/strict';
import test from 'node:test';
import { nextPhraseBeat } from '../public/stage/stage-dj-hype.js';

test('DJ moments land on the next 16-bar downbeat, never inside the first phrase of a track', () => {
  assert.equal(nextPhraseBeat(0), 64);
  assert.equal(nextPhraseBeat(30.5), 64);
  assert.equal(nextPhraseBeat(64), 128, 'đã tới phách đầu câu thì tính câu kế tiếp');
  assert.equal(nextPhraseBeat(64.01), 128);
  assert.equal(nextPhraseBeat(127.9), 128);
});

