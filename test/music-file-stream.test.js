// Live sáng 21/11/2026: bài nhạc YouTube 55,5 MB bị chốt chống treo 20 giây cắt 89/89 lần ("GET
// /api/music-file/8a875e97750f quá 20 giây chưa trả lời → cắt", "mất 40026ms"). Thẻ <audio> tải DẦN
// trong lúc phát và tự ngừng đọc khi đã đệm đủ, nên kết nối đứng yên một lúc là chuyện bình thường —
// nhưng chốt chống treo tưởng server treo nên cắt, nhạc đứt rồi màn hình tải lại, lặp cả buổi.
// Route này còn đọc cả file vào RAM bằng readFileSync (chặn server) và không hỗ trợ Range.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { startApp } from '../src/app.js';

const ID = 'abc123def456';
const config = { port: 0, host: '127.0.0.1', allowLan: false, provider: 'tiktok', startGame: 'bar' };
const fakeProviders = { tiktok: () => ({ start: async () => ({ roomId: '1' }), stop: async () => {} }) };

/** Dựng phòng có sẵn một bài nhạc `size` byte, nội dung biết trước để so từng byte. */
async function phongCoNhac(t, size, opts = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tlg-nhacfile-'));
  const musicDir = path.join(dataDir, 'music');
  fs.mkdirSync(musicDir, { recursive: true });
  const body = Buffer.alloc(size);
  for (let i = 0; i < size; i += 1) body[i] = i % 251; // 251 là số nguyên tố → lệch một byte là lộ ngay
  fs.writeFileSync(path.join(musicDir, `${ID}.mp3`), body);
  fs.writeFileSync(path.join(musicDir, 'playlist.json'),
    JSON.stringify({ items: [{ id: ID, kind: 'youtube', title: 'Bài thử', file: `${ID}.mp3`, enabled: true }] }));
  const app = await startApp(config, { dataDir, providerFactories: fakeProviders, tickMs: 50, ...opts });
  t.after(async () => {
    await app.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  return { app, body };
}

/** GET file nhạc; `dungDocMs` > 0 thì ngừng đọc giữa chừng bấy nhiêu ms — y như thẻ <audio> đã đệm đủ. */
function tai(port, { range = '', dungDocMs = 0 } = {}) {
  return new Promise((resolve) => {
    const headers = range ? { Range: range } : {};
    const req = http.request({ host: '127.0.0.1', port, path: `/api/music-file/${ID}`, headers }, (res) => {
      const parts = [];
      let daDung = false;
      res.on('data', (c) => {
        parts.push(c);
        if (dungDocMs && !daDung) {
          daDung = true;
          res.pause();
          setTimeout(() => res.resume(), dungDocMs);
        }
      });
      const xong = (bi) => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(parts), biCat: bi });
      res.on('end', () => xong(false));
      res.on('aborted', () => xong(true));
      res.on('error', () => xong(true));
    });
    req.on('error', () => resolve({ status: 0, body: Buffer.alloc(0), biCat: true }));
    req.end();
  });
}

test('người xem ngừng đọc lâu hơn mốc chống treo (thẻ <audio> đã đệm đủ) → file vẫn về ĐỦ, không bị cắt', async (t) => {
  // file đủ lớn để không lọt hết vào bộ đệm socket — server phải chờ người xem đọc tiếp
  const SIZE = 8 * 1024 * 1024;
  const { app, body } = await phongCoNhac(t, SIZE, { httpHangMs: 300 });
  const r = await tai(app.port, { dungDocMs: 1200 }); // đứng yên gấp 4 lần mốc chống treo

  assert.equal(r.biCat, false, 'kết nối bị cắt giữa chừng — đây đúng là lỗi làm nhạc đứt sáng 21/11');
  assert.equal(r.status, 200);
  assert.equal(r.body.length, SIZE, `chỉ về ${r.body.length}/${SIZE} byte`);
  assert.ok(r.body.equals(body), 'nội dung file về không khớp');
});

test('hỗ trợ Range: trình duyệt xin từng đoạn, server trả đúng đoạn đó (206)', async (t) => {
  const { app, body } = await phongCoNhac(t, 10000);

  const giua = await tai(app.port, { range: 'bytes=1000-1999' });
  assert.equal(giua.status, 206);
  assert.equal(giua.headers['content-range'], 'bytes 1000-1999/10000');
  assert.equal(giua.headers['content-length'], '1000');
  assert.ok(giua.body.equals(body.subarray(1000, 2000)), 'đoạn giữa sai byte');

  const tuDoToiHet = await tai(app.port, { range: 'bytes=9000-' });
  assert.equal(tuDoToiHet.status, 206);
  assert.equal(tuDoToiHet.headers['content-range'], 'bytes 9000-9999/10000');
  assert.ok(tuDoToiHet.body.equals(body.subarray(9000)), 'đoạn cuối sai byte');

  const cuoi = await tai(app.port, { range: 'bytes=-500' });
  assert.equal(cuoi.status, 206);
  assert.ok(cuoi.body.equals(body.subarray(9500)), '500 byte cuối sai');
});

test('không xin Range thì trả cả file, và báo cho trình duyệt biết là tua được', async (t) => {
  const { app, body } = await phongCoNhac(t, 10000);
  const r = await tai(app.port);
  assert.equal(r.status, 200);
  assert.equal(r.headers['accept-ranges'], 'bytes', 'thiếu Accept-Ranges thì thẻ <audio> không biết tua được');
  assert.ok(r.body.equals(body));
});

test('Range ngoài cỡ file → 416, không treo', async (t) => {
  const { app } = await phongCoNhac(t, 10000);
  const r = await tai(app.port, { range: 'bytes=50000-60000' });
  assert.equal(r.status, 416);
  assert.equal(r.headers['content-range'], 'bytes */10000');
});
