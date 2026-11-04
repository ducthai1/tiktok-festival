import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { playOrder, seekSrc } from '../public/stage/stage-track-player.js';

const tracks = JSON.parse(fs.readFileSync(new URL('../public/assets/dance/music/tracks.json', import.meta.url), 'utf8'));
const SPECIAL_KINDS = ['drop', 'vip', 'star', 'festival'];

test('the dance playlist keeps enough rotation tracks and one track per big moment', () => {
  const entries = Object.values(tracks);
  const normal = entries.filter((t) => !t.special);
  assert.ok(normal.length >= 6, `chỉ còn ${normal.length} bài xoay vòng`);
  for (const kind of SPECIAL_KINDS) assert.ok(entries.some((t) => t.special === kind), `thiếu nhạc ${kind}`);
  for (const t of entries) {
    assert.match(t.file, /^[a-z0-9-]+\.mp3$/);
    assert.ok(t.bpm >= 100 && t.bpm <= 160, `${t.file} bpm ${t.bpm}`);
    assert.ok(t.firstBeat >= 0 && t.firstBeat < 60 / t.bpm + 0.01, `${t.file} firstBeat ${t.firstBeat}`);
    if (t.special) assert.ok(SPECIAL_KINDS.includes(t.special), t.special);
  }
});

test('a skipped intro lands on a beat inside the first minute', () => {
  const skipped = Object.values(tracks).filter((t) => t.start);
  assert.ok(skipped.length > 0);
  for (const t of skipped) {
    assert.equal(t.special, undefined, `${t.file}: nhạc khoảnh khắc lớn phát từ "hot", không dùng start`);
    assert.ok(t.start > 0 && t.start < 60, `${t.file} start ${t.start}`);
    const beats = (t.start - t.firstBeat) / (60 / t.bpm);
    assert.ok(Math.abs(beats - Math.round(beats)) < 0.01, `${t.file} start lệch phách`);
  }
});

test('a track plays from its measured offset, or from the top when it has none', () => {
  assert.equal(seekSrc('blob:http://x/1', 12.5), 'blob:http://x/1#t=12.5');
  assert.equal(seekSrc('/m/a.mp3', 0), '/m/a.mp3');
  assert.equal(seekSrc('/m/a.mp3', undefined), '/m/a.mp3');
});

test('the hand-picked opener plays first, then every other track once in shuffled order', () => {
  const list = [{ url: 'a' }, { url: 'b' }, { url: 'c', opener: true }, { url: 'd' }];
  for (let seed = 0; seed < 20; seed += 1) {
    let x = seed + 1;
    const order = playOrder(list, () => ((x = (x * 9301 + 49297) % 233280) / 233280));
    assert.equal(order[0], 2);
    assert.deepEqual([...order].sort(), [0, 1, 2, 3]);
  }
  assert.deepEqual([...playOrder([{ url: 'a' }, { url: 'b' }])].sort(), [0, 1]);
  assert.equal(Object.values(tracks).filter((t) => t.opener && !t.special).length, 1, 'đúng một bài mở màn');
});
