// Rà Quán Bar + Sàn Nhảy ngày 21/11/2026 — chủ kênh chốt từ trước: "kim cương sẽ được tính chung hết cho các game".
// Nhưng bục Top 1-2-3 (Sàn Nhảy) và ghế VIP (Quán Bar) mỗi game tự đếm 💎 riêng, CHỈ phần tặng lúc đang ở game đó.
// Cả hai game còn không có resetRoom, nên bục / ghế VIP / người trên sàn của buổi live trước sống sang buổi sau.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameHub } from '../src/games/game-hub.js';
import { createBarClubGame } from '../src/games/bar-club-game.js';

const nguoi = (k) => ({ id: `u${k}`, uniqueId: `khach${k}`, nickname: `Khách ${k}`, avatar: '' });
const qua = (k, coins) => ({ type: 'gift', user: nguoi(k), gift: { id: '9', name: 'Quà', count: 1, diamonds: coins, diamondsEach: coins, pictureUrl: '' } });
const noi = (k, text = 'chào cả nhà') => ({ type: 'chat', user: nguoi(k), comment: text });
const bucSanNhay = (hub, t) => Object.fromEntries(hub.snapshot(t).state.dancers.filter((d) => d.rank).map((d) => [d.nickname, d.rank]));
const vipQuanBar = (hub, t) => hub.snapshot(t).state.patrons.filter((p) => p.vip).map((p) => p.nickname).sort();

test('Sàn Nhảy: 💎 tặng ở game Tiếng Anh vẫn được tính lên bục Top 1-2-3', () => {
  const hub = createGameHub({ startGame: 'english' });
  let t = 1000;
  hub.handleEvent(qua(1, 500), (t += 10)); // Khách 1 tặng 500 💎 lúc đang chơi Tiếng Anh

  hub.switchTo('dance');
  hub.handleEvent(noi(1), (t += 10)); // Khách 1 vào sàn
  hub.handleEvent(qua(2, 10), (t += 10)); // Khách 2 tặng 10 💎 ngay ở Sàn Nhảy

  assert.deepEqual(bucSanNhay(hub, t), { 'Khách 1': 1, 'Khách 2': 2 },
    'người tặng 500 💎 phải đứng hạng 1 — trước đây Sàn Nhảy không biết món đó vì nó được tặng ở game khác');
});

test('Sàn Nhảy: sang buổi live mới thì bục và sàn của buổi trước phải trống', () => {
  const hub = createGameHub({ startGame: 'dance' });
  let t = 1000;
  hub.handleEvent(qua(1, 300), (t += 10));
  hub.handleEvent(qua(2, 200), (t += 10));
  assert.equal(Object.keys(bucSanNhay(hub, t)).length, 2);

  hub.resetRoom(); // phòng live mới
  hub.handleEvent(qua(3, 5), (t += 10)); // buổi mới mới có Khách 3 tặng 5 💎
  const that = hub.snapshot(t).state.dancers.filter((d) => !/^seed/.test(d.id));
  assert.deepEqual(that.map((d) => d.nickname), ['Khách 3'], 'người của buổi trước vẫn còn trên sàn');
  assert.deepEqual(bucSanNhay(hub, t), { 'Khách 3': 1 }, 'bục vẫn giữ người tặng của buổi trước');
});

test('Quán Bar: 💎 tặng ở game khác vẫn được tính lên ghế VIP', () => {
  const hub = createGameHub({ startGame: 'english' });
  let t = 1000;
  hub.handleEvent(qua(1, 500), (t += 10));

  hub.switchTo('bar');
  hub.handleEvent(noi(1), (t += 10));
  hub.handleEvent(noi(2), (t += 10)); // chưa tặng gì
  assert.deepEqual(vipQuanBar(hub, t), ['Khách 1']);
});

test('Quán Bar: sang buổi live mới thì khách và ghế VIP của buổi trước phải đi', () => {
  const hub = createGameHub({ startGame: 'bar' });
  let t = 1000;
  hub.handleEvent(qua(1, 300), (t += 10));
  assert.deepEqual(vipQuanBar(hub, t), ['Khách 1']);

  hub.resetRoom();
  assert.equal(hub.snapshot(t).state.patrons.length, 0, 'khách của buổi trước vẫn ngồi trong quán');
  hub.handleEvent(noi(9), (t += 10));
  assert.deepEqual(vipQuanBar(hub, t), [], 'ghế VIP vẫn tính 💎 của buổi trước');
});

test('Quán Bar: ba người tặng nhiều nhất đã rời quán thì người tặng nhiều thứ tư đang ngồi phải được VIP', () => {
  const bar = createBarClubGame({ random: () => 0 });
  const t0 = 1000;
  bar.handleEvent(qua(1, 400), t0);
  bar.handleEvent(qua(2, 300), t0);
  bar.handleEvent(qua(3, 200), t0);
  const sau = t0 + 7 * 60 * 1000; // quá 6 phút không tương tác thì rời quán
  bar.handleEvent(qua(4, 100), sau);
  bar.tick(sau); // Khách 1-2-3 ngồi im quá lâu → rời quán

  const conNgoi = bar.snapshot(sau).patrons;
  assert.deepEqual(conNgoi.map((p) => p.nickname), ['Khách 4']);
  assert.equal(conNgoi[0].vip, true, 'trước đây VIP tính trên cả người đã đi → quán không còn ai mang VIP');
});
