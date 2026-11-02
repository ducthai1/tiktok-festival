import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cleanText, isAllowedHost, isAllowedOrigin, safeImageUrl, tokensEqual, createRateLimiter, securityHeaders
} from '../src/http/security.js';
import { createEventDeduper, createGiftStreakTracker } from '../src/live/gift-streak-tracker.js';
import { sanitizeLiveEvent } from '../src/live/live-event-schema.js';
import { normalizeConnectorEvent } from '../src/live/normalize-tiktok-connector.js';
import { normalizeTikFinityMessage } from '../src/live/normalize-tikfinity.js';
import { parseTikTokUsername } from '../src/live/live-connection-manager.js';
import { isCleanForDisplay, containsPhrase } from '../src/games/text-match.js';

test('cleanText strips control, bidi-override and zero-width chars but keeps emoji', () => {
  assert.equal(cleanText('A‮B​C\nD', 50), 'A B C D');
  assert.equal(cleanText('👨‍👩‍👧 vui', 50), '👨‍👩‍👧 vui');
  assert.equal(cleanText('😀😀😀', 2), '😀😀'); // cắt theo ký tự, không cắt đôi emoji
});

test('only TikTok CDN https images pass', () => {
  assert.ok(safeImageUrl('https://p16-sign-va.tiktokcdn.com/a.jpeg?x=1'));
  assert.equal(safeImageUrl('http://p16.tiktokcdn.com/a.jpg'), '');
  assert.equal(safeImageUrl('https://evil.example/tiktokcdn.com.jpg'), '');
  assert.equal(safeImageUrl('https://tiktokcdn.com.evil.io/a.jpg'), '');
  assert.equal(safeImageUrl('javascript:alert(1)'), '');
});

test('Host and Origin checks block other sites and DNS rebinding', () => {
  assert.ok(isAllowedHost('127.0.0.1:3939', 3939));
  assert.ok(isAllowedHost('localhost:3939', 3939));
  assert.equal(isAllowedHost('evil.com:3939', 3939), false);
  assert.equal(isAllowedHost('127.0.0.1:80', 3939), false);
  assert.ok(isAllowedOrigin('http://127.0.0.1:3939', '127.0.0.1:3939', 3939));
  assert.equal(isAllowedOrigin('http://127.0.0.1:5173', '127.0.0.1:3939', 3939), false);
  assert.equal(isAllowedOrigin('https://evil.com', '127.0.0.1:3939', 3939), false);
  assert.equal(isAllowedOrigin('', '127.0.0.1:3939', 3939), false);
  assert.ok(isAllowedOrigin('http://192.168.1.5:3939', '192.168.1.5:3939', 3939, true));
  assert.equal(isAllowedOrigin('http://evil.com:3939', '192.168.1.5:3939', 3939, true), false);
});

test('tokens compare exactly and rate limiter caps bursts', () => {
  assert.ok(tokensEqual('abc', 'abc'));
  assert.equal(tokensEqual('abc', 'abd'), false);
  assert.equal(tokensEqual('', ''), false);
  const allow = createRateLimiter(3, 1000);
  assert.deepEqual([allow(0), allow(1), allow(2), allow(3), allow(1001)], [true, true, true, false, true]);
  assert.match(securityHeaders(3939)['Content-Security-Policy'], /script-src 'self'(;|$)/);
});

test('gift streak counts only the increase and never double-counts the final event', () => {
  const tracker = createGiftStreakTracker();
  const base = { userId: 'u', giftId: 'rose', groupId: 'g1', streakable: true };
  const deltas = [1, 3, 7].map((repeatCount) => tracker.delta({ ...base, repeatCount, repeatEnd: false }));
  deltas.push(tracker.delta({ ...base, repeatCount: 7, repeatEnd: true }));
  assert.deepEqual(deltas, [1, 2, 4, 0]);
  assert.equal(tracker.size(), 0);
  // nguồn không có groupId/repeatEnd: combo mới bắt đầu lại từ 1 thì vẫn được tính
  const loose = { userId: 'u', giftId: 'rose', streakable: true, repeatEnd: false };
  assert.deepEqual([5, 1, 2].map((repeatCount) => tracker.delta({ ...loose, repeatCount })), [5, 1, 1]);
  assert.equal(tracker.delta({ userId: 'u', giftId: 'lion', repeatCount: 1, repeatEnd: true, streakable: false }), 1);
});

test('deduper drops repeated message ids', () => {
  const isDup = createEventDeduper(3);
  assert.deepEqual(['a', 'a', 'b', 'c', 'd', 'e', ''].map((id) => isDup(id, 0)), [false, true, false, false, false, false, false]);
});

test('connector gift payload normalizes and sanitizes', () => {
  const raw = normalizeConnectorEvent('gift', {
    common: { msgId: '77' }, giftId: 5655, repeatCount: 3, repeatEnd: false, groupId: '9',
    giftDetails: { giftName: 'Rose', giftType: 1, diamondCount: 1 },
    user: { userId: '1', uniqueId: 'an_nguyen', nickname: 'An‮', profilePicture: { url: ['https://p16-sign.tiktokcdn.com/x.webp'] } }
  });
  assert.equal(raw.giftRaw.streakable, true);
  const event = sanitizeLiveEvent({ ...raw, gift: { ...raw.giftRaw, count: 3 } });
  assert.equal(event.user.nickname, 'An');
  assert.equal(event.gift.diamonds, 3);
  assert.equal(event.user.avatar, 'https://p16-sign.tiktokcdn.com/x.webp');
  assert.equal(sanitizeLiveEvent({ type: 'chat', user: { id: 'x' }, comment: '   ' }), null);
  assert.equal(sanitizeLiveEvent({ type: 'hack', user: { id: 'x' } }), null);
});

test('TikFinity messages: arrays, junk and missing repeatEnd', () => {
  const events = normalizeTikFinityMessage(JSON.stringify([
    { event: 'chat', data: { uniqueId: 'b', nickname: 'Bé', comment: 'hi', msgId: 1 } },
    { event: 'gift', data: { uniqueId: 'b', giftId: 1, giftName: 'Rose', repeatCount: 2, diamondCount: 1, giftType: 1 } },
    { event: 'unknown' }
  ]));
  assert.equal(events.length, 2);
  assert.equal(events[1].giftRaw.repeatEnd, false);
  assert.deepEqual(normalizeTikFinityMessage('{not json'), []);
});

test('username parsing accepts @name and live links only', () => {
  assert.equal(parseTikTokUsername('@an.nguyen_1'), 'an.nguyen_1');
  assert.equal(parseTikTokUsername('https://www.tiktok.com/@ban_toi/live'), 'ban_toi');
  assert.equal(parseTikTokUsername('a b'), '');
  assert.equal(parseTikTokUsername('x'.repeat(30)), '');
});

test('chat filters: diacritic-aware profanity, URLs, whole-word commands', () => {
  assert.equal(isCleanForDisplay('cầu cho mẹ khoẻ'), true);
  assert.equal(isCleanForDisplay('các bạn buổi tối lớn lên đeo kính'), true);
  assert.equal(isCleanForDisplay('đm cái này'), false);
  assert.equal(isCleanForDisplay('vào zalo 0912345678'), false);
  assert.ok(containsPhrase('Cụng ly nào!!', ['cung ly']));
  assert.equal(containsPhrase('gogo', ['go']), false);
});

test('danh mục quà của phòng: đọc tên + giá thật + ảnh, bỏ món thiếu tên/giá và món trùng', async () => {
  const { normalizeGiftCatalog } = await import('../src/live/normalize-tiktok-connector.js');
  const list = normalizeGiftCatalog({ gifts: [
    { id: 5655, name: 'Rose', diamond_count: 1, image: { url_list: ['https://p16-webcast.tiktokcdn.com/rose.png'] } },
    { id: 6369, name: 'Lion', diamond_count: 29999, image: { url_list: ['https://p16-webcast.tiktokcdn.com/lion.png'] } },
    { id: 1, name: '', diamond_count: 5 },
    { id: 2, name: 'Free', diamond_count: 0 },
    { id: 5655, name: 'Rose', diamond_count: 1 }
  ] });
  assert.deepEqual(list.map((g) => [g.name, g.coins]), [['Rose', 1], ['Lion', 29999]]);
  assert.equal(list[1].image, 'https://p16-webcast.tiktokcdn.com/lion.png');
});
