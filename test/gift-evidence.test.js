// Chủ kênh báo: bảng quà trên màn hình hiện những món mà nhiều người xem mở hộp quà ra không có.
// Điều tra 21/11/2026: cờ is_displayed_on_panel của API TikTok chỉ là mặc định CHUNG của vùng, lệch
// cả hai chiều so với hộp quà thật; truyền room_id vào API cũng trả y hệt. Không API nào biết được
// hộp quà riêng của từng người xem.
//
// Nên chuyển sang tín hiệu duy nhất chắc chắn: đã có người THẬT tặng được món đó.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { SAFE_MIN_SENDERS, SAFE_WINDOW_DAYS, createGiftEvidence } from '../src/live/gift-evidence.js';

const NGAY = 24 * 60 * 60 * 1000;
const thuMuc = () => fs.mkdtempSync(path.join(os.tmpdir(), 'qua-'));
const qua = (uid, id = '5655', name = 'Rose', coins = 1) => ({
  type: 'gift', user: { id: uid, uniqueId: uid, nickname: uid }, gift: { id, name, count: 1, diamonds: coins, diamondsEach: coins }
});

test('một người tặng trăm lượt vẫn chỉ là MỘT bằng chứng — đếm người, không đếm lượt', () => {
  const kho = createGiftEvidence(thuMuc(), { saveDelayMs: 1 });
  for (let i = 0; i < 100; i += 1) kho.record(qua('u1'));
  assert.equal(kho.senderCount('5655'), 1);
  assert.equal(kho.isSafe('5655'), false, 'một người tặng không chứng minh được cả phòng đều có món này');

  for (let n = 2; n <= SAFE_MIN_SENDERS; n += 1) kho.record(qua(`u${n}`));
  assert.equal(kho.senderCount('5655'), SAFE_MIN_SENDERS);
  assert.equal(kho.isSafe('5655'), true, `${SAFE_MIN_SENDERS} người khác nhau tặng được thì món này an toàn`);
});

test('quà giả lập (nút thử ở trang điều khiển) không được tính là bằng chứng', () => {
  const kho = createGiftEvidence(thuMuc(), { saveDelayMs: 1 });
  for (let n = 1; n <= SAFE_MIN_SENDERS + 5; n += 1) kho.record({ ...qua(`u${n}`), simulated: true });
  assert.equal(kho.senderCount('5655'), 0, 'bấm thử không chứng minh người xem nào có món đó');
  assert.equal(kho.isSafe('5655'), false);
});

test('bằng chứng cũ hơn cửa sổ thì hết hiệu lực — hộp quà TikTok đổi theo mùa', () => {
  let gio = Date.parse('2026-11-21T00:00:00Z');
  const kho = createGiftEvidence(thuMuc(), { now: () => gio, saveDelayMs: 1 });
  for (let n = 1; n <= SAFE_MIN_SENDERS; n += 1) kho.record(qua(`u${n}`));
  assert.equal(kho.isSafe('5655'), true);

  gio += (SAFE_WINDOW_DAYS + 1) * NGAY; // cả phòng đã tặng, nhưng từ hơn một tháng trước
  assert.equal(kho.senderCount('5655'), 0);
  assert.equal(kho.isSafe('5655'), false, 'quá hạn thì không còn chứng minh được hộp quà bây giờ vẫn có');
});

test('hasSent: biết CHẮC CHẮN một người cụ thể có món đó vì chính họ đã tặng', () => {
  const kho = createGiftEvidence(thuMuc(), { saveDelayMs: 1 });
  kho.record(qua('an', '5269', 'TikTok'));
  assert.equal(kho.hasSent('an', '5269'), true);
  assert.equal(kho.hasSent('binh', '5269'), false, 'người khác tặng không nói lên người này có');
  assert.equal(kho.hasSent('an', '5655'), false, 'tặng món này không nói lên họ có món kia');
});

test('nhớ qua các lần khởi động lại server', () => {
  const dir = thuMuc();
  const kho = createGiftEvidence(dir, { saveDelayMs: 1 });
  for (let n = 1; n <= SAFE_MIN_SENDERS; n += 1) kho.record(qua(`u${n}`));
  kho.stop(); // ghi file ngay

  const sau = createGiftEvidence(dir, { saveDelayMs: 1 });
  assert.equal(sau.senderCount('5655'), SAFE_MIN_SENDERS);
  assert.equal(sau.isSafe('5655'), true);
});

test('nạp lịch sử từ gifts.log để bảng quà có bằng chứng ngay buổi live đầu', () => {
  const dir = thuMuc();
  const gio = Date.parse('2026-11-21T12:00:00Z');
  const hom = (n) => new Date(gio - n * NGAY).toISOString().slice(0, 19).replace('T', ' ');
  fs.writeFileSync(path.join(dir, 'gifts.log'), [
    `[${hom(1)}] [GIFT] An (@an): Rose x5 (5💎)`,
    `[${hom(2)}] [GIFT] Bình (@binh): Rose x1 (1💎)`,
    `[${hom(3)}] [GIFT] Chi (@chi): Rose x2 (2💎)`,
    `[${hom(3)}] [GIFT] An (@an): Rose x9 (9💎)`,          // người cũ: không cộng thêm bằng chứng
    `[${hom(SAFE_WINDOW_DAYS + 5)}] [GIFT] Dũng (@dung): Rose x1 (1💎)`, // quá hạn
    `[${hom(1)}] [GIFT] Em (@em): Món Lạ x1 (1💎)`,        // không tra được id
    'dòng rác không đúng định dạng'
  ].join('\n'));

  const kho = createGiftEvidence(dir, { now: () => gio, saveDelayMs: 1 });
  const them = kho.seedFromLog(path.join(dir, 'gifts.log'), new Map([['rose', { id: '5655', coins: 1 }]]));
  assert.equal(them, 3, 'chỉ An, Bình, Chi trong hạn và tra được id');
  assert.equal(kho.senderCount('5655'), 3);
  assert.equal(kho.hasSent('an', '5655'), true);
  assert.equal(kho.hasSent('dung', '5655'), false, 'bằng chứng quá hạn không được nạp');
});
