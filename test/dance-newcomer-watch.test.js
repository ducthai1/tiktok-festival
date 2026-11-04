import assert from 'node:assert/strict';
import test from 'node:test';
import { createNewcomerWatch } from '../public/stage/scenes/dance-newcomer-watch.js';

const floor = (...ids) => ids.map((id) => ({ id }));

test('the first snapshot after a page load greets nobody', () => {
  const watch = createNewcomerWatch();
  assert.deepEqual(watch.fresh(floor('a', 'b', 'seed:1')), []);
});

test('only real viewers who were not on the floor before count as newcomers', () => {
  const watch = createNewcomerWatch();
  watch.fresh(floor('a', 'seed:1'));
  assert.deepEqual(watch.fresh(floor('a', 'seed:1', 'b', 'seed:2')), ['b']);
  assert.deepEqual(watch.fresh(floor('a', 'b', 'seed:2')), [], 'không ai mới');
  watch.fresh(floor('b'));
  assert.deepEqual(watch.fresh(floor('a', 'b')), ['a'], 'rời rồi vào lại là người mới');
});
