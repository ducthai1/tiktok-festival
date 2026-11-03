import assert from 'node:assert/strict';
import test from 'node:test';
import { createTempleGame } from '../src/games/temple-game.js';

const user = (n) => ({ id: `u${n}`, uniqueId: `u${n}`, nickname: `Người ${n}`, avatar: '' });
const chat = (n, comment) => ({ type: 'chat', user: user(n), comment });
const kinds = (fx) => fx.map((f) => f.kind).filter((k) => k !== 'join');

test('commenting "mõ" strikes the wooden fish for free, once per few seconds per viewer', () => {
  const temple = createTempleGame();
  assert.deepEqual(kinds(temple.handleEvent(chat(1, 'mõ'), 0)), ['mo']);
  assert.deepEqual(kinds(temple.handleEvent(chat(1, 'Gõ mõ'), 1000)), []); // chống spam
  assert.deepEqual(kinds(temple.handleEvent(chat(1, 'gõ mõ'), 3000)), ['mo']);
  assert.equal(temple.snapshot().totals.mo, 2);
  // chữ khác có "mở"/"mơ" trong câu không bị coi là gõ mõ
  assert.ok(!kinds(temple.handleEvent(chat(2, 'mở thêm game đi'), 5000)).includes('mo'));
});

test('commenting "a di đà phật" (any spelling) makes that viewer bow to the Buddha and shows the words', () => {
  const temple = createTempleGame();
  assert.deepEqual(kinds(temple.handleEvent(chat(1, 'A Di Đà Phật 🙏'), 0)), ['bow', 'say']);
  assert.deepEqual(kinds(temple.handleEvent(chat(1, 'adidaphat'), 2000)), []); // trong 6 giây: không vái lại, bong bóng cũng chờ
  assert.deepEqual(kinds(temple.handleEvent(chat(1, 'adidaphat'), 6500)), ['bow', 'say']);
  assert.deepEqual(kinds(temple.handleEvent(chat(2, 'nam mô a di da phat'), 0)), ['bow', 'say']);
  assert.deepEqual(kinds(temple.handleEvent(chat(3, 'vái 3 vái'), 0)), ['bow', 'say']);
  // chữ "lạy" (có nghĩa lóng xấu) không còn là lệnh
  assert.ok(!kinds(temple.handleEvent(chat(4, 'lạy hồn'), 0)).includes('bow'));
});

test('a prayer comment is free and shows with a praying hand', () => {
  const temple = createTempleGame();
  const fx = temple.handleEvent(chat(1, 'cầu cho gia đình bình an'), 0);
  const say = fx.find((f) => f.kind === 'say');
  assert.equal(say.prayer, true);
  assert.equal(say.text, 'cầu cho gia đình bình an');
});
