import assert from 'node:assert/strict';
import test from 'node:test';
import { createBarClubGame, BAR_SEATS, VIBE_GOAL, drinkForGift } from '../src/games/bar-club-game.js';
import { createSwimPushGame, GOAL_METERS, WIN_TARGET, helperForGift } from '../src/games/swim-push-game.js';
import { createTempleGame, offeringForGift, TEMPLE_SLOTS } from '../src/games/temple-game.js';
import { giftTier, tierRepresentatives, SAMPLE_GIFTS } from '../public/shared/gift-tiers.js';
import { createGameHub } from '../src/games/game-hub.js';
import { FORTUNES } from '../src/games/temple-fortunes.js';

const user = (n) => ({ id: `u${n}`, uniqueId: `u${n}`, nickname: `Người ${n}`, avatar: '' });
const chat = (n, comment) => ({ type: 'chat', user: user(n), comment });
const gift = (n, diamondsEach, count = 1) => ({ type: 'gift', user: user(n),
  gift: { id: 'g', name: 'Quà', diamondsEach, count, diamonds: diamondsEach * count } });
const like = (n, likeCount = 5) => ({ type: 'like', user: user(n), likeCount });
const kinds = (fx) => fx.map((f) => f.kind);

test('bar: chat joins, seats are unique, full bar evicts the idlest non-VIP', () => {
  const bar = createBarClubGame({ random: () => 0.5 });
  bar.handleEvent(gift(0, 50), 0); // u0 là VIP
  for (let i = 1; i < BAR_SEATS; i += 1) bar.handleEvent(chat(i, 'xin chào'), i);
  const seats = bar.snapshot(100).patrons.map((p) => p.seat);
  assert.equal(new Set(seats).size, BAR_SEATS);
  const fx = bar.handleEvent(chat(99, 'cho vào với'), 1000);
  assert.deepEqual(kinds(fx).slice(0, 2), ['leave', 'join']);
  assert.equal(fx[0].userId, 'u1'); // u1 im lâu nhất, u0 là VIP nên được giữ
  assert.equal(bar.handleEvent(like(200), 1001).length, 0); // thả tim không đuổi ai
});

test('bar: drinks by gift value, dance command, vibe fills into a party', () => {
  // Hoa hồng, Bánh donut, Corgi, Dải ngân hà, Siêu xe, Sư tử
  assert.deepEqual([1, 30, 299, 1000, 7000, 29999].map(drinkForGift), ['beer', 'cocktail', 'champagne', 'tower', 'party', 'party']);
  const bar = createBarClubGame();
  bar.handleEvent(chat(1, 'Nhảy đi mọi người'), 0);
  assert.equal(bar.snapshot(100).patrons[0].dancing, true);
  assert.equal(bar.snapshot(9000).patrons[0].dancing, false);
  const fx = bar.handleEvent(gift(2, 1, VIBE_GOAL / 10), 10);
  assert.ok(kinds(fx).includes('party'));
  assert.ok(bar.snapshot(20).patrons.every((p) => p.dancing));
  assert.equal(bar.snapshot(20).vibe, 0);
});

test('bar: dirty chat is not shown as a bubble', () => {
  const bar = createBarClubGame();
  assert.ok(!kinds(bar.handleEvent(chat(1, 'đm quán'), 0)).includes('bubble'));
  assert.ok(kinds(bar.handleEvent(chat(1, 'quán xịn quá'), 10000)).includes('bubble'));
});

test('swim: walls stop the swimmer until helpers break them', () => {
  assert.equal(helperForGift(1).helper, 'flipper');
  assert.equal(helperForGift(30).helper, 'dolphin');
  assert.equal(helperForGift(5000).helper, 'submarine');
  const swim = createSwimPushGame();
  swim.tick(0);
  // 2 m/s: tới tường 200 m sau 100 giây, rồi tự đập tường 2 máu/giây
  for (let t = 1000; t <= 120000; t += 1000) swim.tick(t);
  let s = swim.snapshot(120000);
  assert.equal(s.position, 200);
  assert.equal(s.blocked, true);
  assert.equal(s.walls[0].hp, 80);
  const fx = swim.handleEvent(gift(1, 99, 1), 120001); // cá mập 150 > 80 máu còn lại
  assert.ok(kinds(fx).includes('wallBreak'));
  s = swim.snapshot(120001);
  assert.equal(s.walls[0].hp, 0);
  assert.equal(s.position, 270);
  assert.equal(s.contributors[0].meters, 150);
});

test('swim: finishing counts a win, resets the round, champion resets wins', () => {
  const swim = createSwimPushGame();
  let now = 0;
  for (let win = 1; win <= WIN_TARGET; win += 1) {
    const fx = swim.handleEvent(gift(1, 499, 20), (now += 10));
    assert.ok(kinds(fx).includes(win === WIN_TARGET ? 'champion' : 'finish'));
    assert.equal(swim.snapshot(now).position, GOAL_METERS);
    assert.equal(swim.handleEvent(gift(1, 499), now + 1).length, 0); // đang ăn mừng thì bỏ qua
    assert.ok(kinds(swim.tick((now += 9000))).includes('roundStart'));
    assert.equal(swim.snapshot(now).position, 0);
  }
  assert.equal(swim.snapshot(now).wins, 0);
});

test('swim: likes send ducks, cheering has a cooldown, flippers speed up', () => {
  const swim = createSwimPushGame();
  assert.equal(swim.handleEvent(like(1, 15), 0)[0].units, 3);
  assert.equal(swim.handleEvent(chat(2, 'cố lên!!'), 0).length, 1);
  assert.equal(swim.handleEvent(chat(2, 'cố lên!!'), 1000).length, 0);
  swim.handleEvent(gift(3, 1, 1), 0);
  swim.tick(0);
  const before = swim.snapshot(0).position;
  swim.tick(1000);
  assert.equal(Math.round((swim.snapshot(1000).position - before) * 10) / 10, 3.6);
});

test('temple: likes strike the wooden fish; incense / fortune only by gift, chat just gets a hint', () => {
  const temple = createTempleGame({ random: () => 0 });
  assert.deepEqual(kinds(temple.handleEvent(like(1, 7), 0)), ['join', 'mo']);
  assert.equal(temple.snapshot(0).totals.mo, 7);
  // gõ chữ không mở nghi thức (chống nhiều người spam), chỉ nhắc tặng quà — mỗi người 1 lần / 30 giây
  assert.deepEqual(kinds(temple.handleEvent(chat(1, 'Thắp hương cầu an'), 1)), ['hint']);
  assert.deepEqual(kinds(temple.handleEvent(chat(1, 'thắp hương'), 2)), []);
  temple.handleEvent(chat(4, 'xin xăm'), 2);
  assert.equal(temple.snapshot(3).fortuneQueue, 0);
  // Hoa hồng ×5 → thắp hương (tối đa 9 nén); Bánh donut → một quẻ
  const incense = temple.handleEvent(gift(1, 1, 5), 3).find((f) => f.kind === 'incense');
  assert.equal(incense.sticks, 9);
  assert.equal(incense.count, 5);
  temple.handleEvent(gift(4, 30), 4);
  assert.equal(temple.snapshot(4).fortuneQueue, 1);
  const shown = temple.tick(5).find((f) => f.kind === 'fortune');
  assert.equal(shown.number, 1);
  assert.equal(shown.poem.length, 4);
  assert.ok(FORTUNES.every((f) => f.poem.length === 4 && f.meaning && f.rank));
  // bình luận chỉ thành bong bóng chữ (lời cầu có đánh dấu); chữ bậy không hiện
  const say = temple.handleEvent(chat(2, 'cầu cho gia đình bình an'), 10).find((f) => f.kind === 'say');
  assert.equal(say.prayer, true);
  assert.equal(kinds(temple.handleEvent(chat(2, 'chào cả nhà'), 11)).includes('say'), false); // mỗi người 1 bong bóng / 4 giây
  assert.equal(kinds(temple.handleEvent(chat(3, 'cầu đm'), 20)).includes('say'), false);
  // tặng quà từ bậc 3 (Corgi) thì hoa đăng mang đúng lời cầu đó, dùng một lần
  const lamp = temple.handleEvent(gift(2, 299), 30).find((f) => f.kind === 'offering');
  assert.equal(lamp.wish, 'cầu cho gia đình bình an');
  assert.equal(temple.handleEvent(gift(2, 299), 40).find((f) => f.kind === 'offering').wish, '');
});

test('temple: gift tiers map to rituals (6 tiers by the price of ONE gift)', () => {
  assert.deepEqual([1, 30, 299, 1000, 7000, 29999].map(offeringForGift), ['incense', 'fortune', 'lamp', 'fruit', 'ceremony', 'grand']);
  assert.deepEqual([9, 98, 498, 4999, 19999].map(offeringForGift), ['incense', 'fortune', 'lamp', 'fruit', 'ceremony']);
});

test('temple: seats stay put, newcomers take free seats, full hall evicts non-VIP', () => {
  const temple = createTempleGame();
  for (let i = 0; i < TEMPLE_SLOTS; i += 1) temple.handleEvent(chat(i, 'chào'), i);
  const seatOf = (snap, id) => snap.devotees.find((d) => d.id === id).slot;
  assert.equal(seatOf(temple.snapshot(50), 'u29'), 29);
  temple.handleEvent(gift(29, 100), 100);
  const snap = temple.snapshot(100);
  assert.equal(seatOf(snap, 'u29'), 29); // nhiều tâm thành: nhãn VIP, nhưng KHÔNG đổi chỗ
  assert.equal(snap.devotees.find((d) => d.id === 'u29').vip, true);
  assert.equal(snap.board[0].points, 1001); // 1 bình luận (+1) + quà 100 xu (+1000)
  const fx = temple.handleEvent(chat(500, 'chào'), 200);
  assert.equal(fx[0].kind, 'leave');
  assert.notEqual(fx[0].userId, 'u29');
  const after = temple.snapshot(200);
  assert.equal(seatOf(after, 'u500'), seatOf(snap, fx[0].userId)); // người mới ngồi đúng chỗ vừa trống
  for (const d of snap.devotees) if (d.id !== fx[0].userId) assert.equal(seatOf(after, d.id), d.slot); // ai cũng giữ chỗ
});

test('hub: only the active game gets events; switching keeps the other game state', () => {
  const hub = createGameHub({ startGame: 'bar' });
  hub.handleEvent(chat(1, 'hello'), 0);
  hub.switchTo('swim');
  hub.handleEvent(gift(1, 30), 1);
  assert.equal(hub.snapshot(1).game, 'swim');
  assert.equal(hub.snapshot(1).state.position, 90);
  hub.switchTo('bar');
  assert.equal(hub.snapshot(2).state.patrons.length, 1);
  assert.equal(hub.snapshot(2).top[0].diamonds, 30);
  assert.throws(() => hub.switchTo('casino'));
  hub.handleEvent({ ...chat(2, 'x'), simulated: true }, 5);
  assert.equal(hub.snapshot(6).testMode, true);
  assert.equal(hub.snapshot(30000).testMode, false);
});

test('bậc quà theo giá MỘT món: 30 Hoa hồng vẫn là quà nhỏ, 1 Sư tử là bậc cao nhất', () => {
  assert.deepEqual([1, 5, 9, 10, 98, 99, 498, 499, 4999, 5000, 19999, 20000, 44999].map(giftTier), [1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
  const temple = createTempleGame({ random: () => 0.5 });
  const roses = temple.handleEvent(gift(1, 1, 30), 0).find((f) => f.kind === 'incense');
  const lion = temple.handleEvent(gift(2, 29999, 1), 10).find((f) => f.kind === 'offering');
  assert.equal(roses.sticks, 9); // 30 Hoa hồng vẫn chỉ là thắp hương (cộng dồn nén)
  assert.equal(roses.count, 30);
  assert.equal(lion.offering, 'grand');
  assert.equal(lion.tier, 6);
});

test('quà đại diện mỗi bậc: Hoa hồng cho bậc 1, các bậc khác là món dễ nhận ra giá gần mốc trên', () => {
  const reps = tierRepresentatives(SAMPLE_GIFTS, 2);
  assert.equal(reps.length, 6);
  assert.deepEqual(reps.map((r) => r.gifts[0].name), ['Hoa hồng', 'Bánh donut', 'Corgi', 'Máy bay riêng', 'Chim ưng', 'Sư tử']);
  // danh mục thật của phòng (tên tiếng Việt, không có tên tiếng Anh) vẫn nhận ra món chọn sẵn
  const real = [{ name: 'Máy bay riêng', coins: 4888, image: 'https://p16-webcast.tiktokcdn.com/img/x.webp' },
    { name: 'Quà lạ', coins: 4999, image: 'https://p16-webcast.tiktokcdn.com/img/y.webp' }];
  assert.equal(tierRepresentatives(real, 1)[3].gifts[0].name, 'Máy bay riêng');
  // giá vùng khác đẩy món chọn sẵn sang bậc khác → bậc đó dùng món giá gần mốc trên
  assert.equal(tierRepresentatives([{ name: 'Private Jet', coins: 6000 }, { name: 'Swan', coins: 699 }, { name: 'Train', coins: 899 }], 1)[3].gifts[0].name, 'Train');
  assert.ok(reps.every((r) => r.gifts.length > 0));
  assert.ok(reps[5].gifts.every((g) => g.coins >= 20000));
  // ảnh quà mẫu là ảnh chính thức trên máy chủ ảnh TikTok (được phép trong CSP img-src)
  assert.ok(SAMPLE_GIFTS.every((g) => /^https:\/\/p16-webcast\.tiktokcdn\.com\//.test(g.image)));
});
