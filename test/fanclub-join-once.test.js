// Chủ kênh báo: người ĐÃ là fan member rồi, tặng Heart Me lần nữa thì thỉnh thoảng vẫn hiện lại
// màn "vừa vào CLB người hâm mộ". Chỉ được chúc mừng LẦN ĐẦU; những lần sau món quà chỉ chạy tác
// dụng bình thường của nó.
//
// Gốc lỗi: fanClubJoin chỉ dựa vào một Set trong bộ nhớ (fanGreeted) — Set đó bị xoá khi sang phòng
// live mới và mất hẳn khi khởi động lại server, nên fan cũ lại được chúc mừng từ đầu.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameHub } from '../src/games/game-hub.js';

const heartMe = (n, { alreadyFan = false, level = 1 } = {}) => ({
  type: 'gift',
  user: { id: `u${n}`, uniqueId: `u${n}`, nickname: `Người ${n}`, avatar: '', fanClub: true, fanLevel: level, alreadyFan },
  gift: { id: '7934', name: 'Heart Me', count: 1, diamonds: 1, diamondsEach: 1, pictureUrl: '' }
});
const mừng = (fx) => fx.filter((f) => f.kind === 'fanJoin');

test('người mới vào CLB: chúc mừng đúng một lần', () => {
  const hub = createGameHub({ startGame: 'english' });
  assert.equal(mừng(hub.handleEvent(heartMe(1), 1000)).length, 1, 'lần đầu phải chúc mừng');
  assert.equal(mừng(hub.handleEvent(heartMe(1), 2000)).length, 0, 'lần hai không được chúc mừng nữa');
});

test('ĐÃ là member từ trước: không bao giờ chúc mừng, dù vừa đổi phòng hay vừa khởi động lại', () => {
  const hub = createGameHub({ startGame: 'english' });
  // alreadyFan = true: app.js hỏi fanclub-store TRƯỚC khi store học từ chính sự kiện này
  assert.equal(mừng(hub.handleEvent(heartMe(2, { alreadyFan: true, level: 5 }), 1000)).length, 0);

  hub.resetRoom(); // sang phòng live mới — chỗ Set trong bộ nhớ bị xoá
  assert.equal(mừng(hub.handleEvent(heartMe(2, { alreadyFan: true, level: 5 }), 2000)).length, 0,
    'sang phòng mới vẫn không được chúc mừng lại fan cũ');

  const hubMới = createGameHub({ startGame: 'english' }); // khởi động lại server
  assert.equal(mừng(hubMới.handleEvent(heartMe(2, { alreadyFan: true, level: 5 }), 3000)).length, 0,
    'khởi động lại server vẫn không được chúc mừng lại fan cũ');
});

test('quà vẫn chạy tác dụng bình thường cho người đã là member', () => {
  const hub = createGameHub({ startGame: 'english' });
  const fx = hub.handleEvent(heartMe(3, { alreadyFan: true }), 1000);
  assert.equal(mừng(fx).length, 0, 'không chúc mừng');
  assert.ok(fx.some((f) => f.kind === 'quizGift' || f.kind === 'quizDeck' || f.kind === 'toast'),
    'nhưng món quà vẫn phải có tác dụng của nó');
});
