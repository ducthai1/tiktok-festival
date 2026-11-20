import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameHub } from '../src/games/game-hub.js';
import { cleanYoutubeUrl } from '../src/music/youtube-music.js';

const user = (n) => ({ id: `u${n}`, uniqueId: `u${n}`, nickname: `Người ${n}`, avatar: '' });
const gift = (diamonds) => ({ type: 'gift', user: user(1), gift: { id: '1', name: 'Rose', count: 1, diamonds, diamondsEach: diamonds } });

test('xoá bảng kim cương KHÔNG đụng điểm game, đại sứ share hay danh sách đã chào', () => {
  const hub = createGameHub({ startGame: 'english' });
  hub.handleEvent(gift(50), 1000);
  hub.handleEvent({ type: 'share', user: user(2) }, 1100);
  hub.handleEvent({ type: 'chat', user: user(2), comment: 'xin chào' }, 1200);
  assert.ok(hub.snapshot(1300).top.length, 'bảng phiên phải có người trước khi xoá');

  const before = hub.snapshot(1400);
  const ambBefore = before.state?.ambassadors?.length || 0;
  hub.resetBoard();
  const after = hub.snapshot(1500);

  assert.equal(after.top.length, 0, 'bảng xếp hạng phiên phải trống');
  assert.equal(after.state?.ambassadors?.length || 0, ambBefore, 'đại sứ share bị xoá lây');
  // đã chào rồi thì không chào lại — resetBoard không được đụng danh sách đã chào
  assert.equal(hub.handleEvent({ type: 'chat', user: user(2), comment: 'lại nữa' }, 1600).filter((f) => f.kind === 'welcome').length, 0);
});

test('xoá bảng điểm game KHÔNG đụng đại sứ share', () => {
  const hub = createGameHub({ startGame: 'english' });
  hub.handleEvent({ type: 'share', user: user(3) }, 1000);
  const amb = hub.snapshot(1100).state?.ambassadors?.length || 0;
  assert.ok(amb > 0, 'cần có đại sứ share để test');

  hub.command('english', 'resetScores');
  assert.equal(hub.snapshot(1200).state?.ambassadors?.length || 0, amb, 'resetScores không được xoá đại sứ');

  hub.command('english', 'resetAmbassadors');
  assert.equal(hub.snapshot(1300).state?.ambassadors?.length || 0, 0, 'resetAmbassadors phải xoá đại sứ');
});

test('cleanYoutubeUrl: chỉ nhận YouTube, bỏ mọi tham số thừa', () => {
  const want = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
  assert.equal(cleanYoutubeUrl('https://www.youtube.com/watch?v=jNQXAC9IVRw&list=PL1&t=42'), want, 'phải cắt danh sách phát + mốc thời gian');
  assert.equal(cleanYoutubeUrl('https://youtu.be/jNQXAC9IVRw?si=abc'), want);
  assert.equal(cleanYoutubeUrl('https://m.youtube.com/watch?v=jNQXAC9IVRw'), want);
  assert.equal(cleanYoutubeUrl('https://music.youtube.com/watch?v=jNQXAC9IVRw'), want);
  assert.equal(cleanYoutubeUrl('https://www.youtube.com/shorts/jNQXAC9IVRw'), want);

  for (const bad of ['', 'không phải link', 'https://example.com/watch?v=jNQXAC9IVRw', 'https://youtube.com.kẻ-giả.com/watch?v=abc123',
    'file:///etc/passwd', 'https://www.youtube.com/watch?v=', 'javascript:alert(1)']) {
    assert.equal(cleanYoutubeUrl(bad), '', `phải từ chối: ${bad}`);
  }
});
