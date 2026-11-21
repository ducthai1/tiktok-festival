// Buổi live sáng 21/11/2026: 07:22 @Trân Lê tặng Hand Heart → server ghi "TẮT NHẠC NỀN", không ai tặng
// quà bật lại, vậy mà nhạc vẫn kêu.
//
// Log cho thấy chủ kênh đã bấm vài ô cài đặt khi đang ở game Tiếng Anh (20/11 00:47, 00:49; 21/11 00:34
// ngay sau khi thêm bài nhạc YouTube). Mỗi lần chỉnh âm thanh, updateGameAudio chép CẢ BỐN khoá
// (sound / volume / music / musicVolume) vào bộ âm thanh riêng của game đó — nên chỉ cần kéo thanh âm
// lượng một lần là cờ music của game đó bị "đóng băng" ở giá trị lúc ấy (đang bật).
//
// Quà tắt nhạc khi ấy chỉ ghi settings.music CHUNG, mà màn hình lại đọc bộ RIÊNG của game đang chạy
// (audioFor), bộ riêng thắng → server phát đi music: true, nhạc không tắt.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import WebSocket from 'ws';
import { startApp } from '../src/app.js';

async function dungPhong(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tlg-nhac-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  let phat = null;
  const app = await startApp({ port: 0, host: '127.0.0.1', allowLan: false, provider: 'tiktok', startGame: 'english' }, {
    dataDir, tickMs: 50,
    providerFactories: { tiktok: (opts) => { phat = opts.emit; return { start: async () => ({ roomId: 'phong-1' }), stop: async () => {} }; } }
  });
  t.after(() => app.close());
  await app.live.connect('tester', 'tiktok');

  const ws = new WebSocket(`ws://127.0.0.1:${app.port}/ws`, { origin: `http://127.0.0.1:${app.port}` });
  t.after(() => ws.close());
  const tin = [];
  ws.on('message', (raw) => tin.push(JSON.parse(raw)));
  await new Promise((r) => ws.once('open', r));
  ws.send(JSON.stringify({ t: 'auth', token: app.adminToken }));
  for (let i = 0; i < 100 && !tin.some((m) => m.t === 'hello'); i += 1) await new Promise((r) => setTimeout(r, 20));

  const caiDatCuoi = () => tin.filter((m) => m.t === 'settings').at(-1)?.settings;
  const doi = async (dk) => { for (let i = 0; i < 100 && !dk(); i += 1) await new Promise((r) => setTimeout(r, 20)); };
  let so = 0;
  const tangQua = (id, name) => phat({ type: 'gift', id: `g-${(so += 1)}`, user: { id: `u${so}`, nickname: `Khách ${so}`, uniqueId: `u${so}` },
    giftRaw: { id, name, diamondsEach: 5, repeatCount: 1, repeatEnd: 1 } });
  return { ws, tin, caiDatCuoi, doi, tangQua };
}

test('chủ kênh từng chỉnh âm lượng ở game đang chạy → quà TẮT nhạc vẫn phải tắt được', async (t) => {
  const { ws, tin, caiDatCuoi, doi, tangQua } = await dungPhong(t);

  // Chủ kênh kéo thanh âm lượng nhạc ở tab Tiếng Anh — y như 00:34 sáng 21/11 sau khi thêm bài YouTube.
  // Lúc này nhạc đang bật, nên bộ riêng của game Tiếng Anh bị chép luôn music: true.
  const truoc = tin.length;
  ws.send(JSON.stringify({ t: 'settings', musicVolume: 0.5 }));
  await doi(() => tin.slice(truoc).some((m) => m.t === 'settings'));
  assert.equal(caiDatCuoi()?.music, true, 'chưa ai tắt thì nhạc đang bật');

  tangQua('19445', 'Name shoutout'); // quà TẮT nhạc mặc định
  await doi(() => tin.some((m) => m.t === 'fx' && m.list?.some((f) => f.text?.includes('TẮT NHẠC NỀN'))));
  await doi(() => caiDatCuoi()?.music === false);

  assert.equal(caiDatCuoi()?.music, false,
    'màn hình phải nhận music: false — nếu nhận true là bộ âm thanh riêng của game đã đè mất lệnh tắt');
});

test('quà BẬT nhạc cũng phải thắng bộ âm thanh riêng của game', async (t) => {
  const { ws, tin, caiDatCuoi, doi, tangQua } = await dungPhong(t);

  // chủ kênh tự tắt nhạc ở tab Tiếng Anh → bộ riêng ghi music: false
  ws.send(JSON.stringify({ t: 'settings', music: false }));
  await doi(() => caiDatCuoi()?.music === false);

  tangQua('1137702', 'Encore Ticket'); // quà BẬT nhạc mặc định
  await doi(() => tin.some((m) => m.t === 'fx' && m.list?.some((f) => f.text?.includes('BẬT NHẠC NỀN'))));
  await doi(() => caiDatCuoi()?.music === true);

  assert.equal(caiDatCuoi()?.music, true, 'người xem đã trả tiền bật nhạc thì nhạc phải bật');
});
