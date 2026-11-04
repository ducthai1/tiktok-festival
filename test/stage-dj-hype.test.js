import assert from 'node:assert/strict';
import test from 'node:test';
import { nextPhraseBeat, SHOUTS } from '../public/stage/stage-dj-hype.js';
import { isCleanForDisplay } from '../public/shared/profanity-filter.js';

test('DJ moments land on the next 16-bar downbeat, never inside the first phrase of a track', () => {
  assert.equal(nextPhraseBeat(0), 64);
  assert.equal(nextPhraseBeat(30.5), 64);
  assert.equal(nextPhraseBeat(64), 128, 'đã tới phách đầu câu thì tính câu kế tiếp');
  assert.equal(nextPhraseBeat(64.01), 128);
  assert.equal(nextPhraseBeat(127.9), 128);
});

test('every MC shout is short and clean enough to be read on stream', () => {
  assert.ok(SHOUTS.length >= 6);
  for (const line of SHOUTS) {
    assert.ok(line.length <= 30, line);
    assert.ok(isCleanForDisplay(line), line);
  }
});
