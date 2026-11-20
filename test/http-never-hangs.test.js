// Trang điều khiển ở máy live thỉnh thoảng "đơ, xoay mãi": handler HTTP là hàm async mà KHÔNG có
// try/catch, nên một lỗi ném ra giữa chừng thành unhandledRejection — server vẫn sống nhưng res
// không bao giờ được end. Trình duyệt giữ luôn kết nối đó; mỗi nguồn chỉ được 6 kết nối HTTP/1.1
// nên vài lần như vậy là cả tab đứng hình. Test này khoá lại: MỌI request đều phải có câu trả lời.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { startApp } from '../src/app.js';

const config = { port: 0, host: '127.0.0.1', allowLan: false, provider: 'tiktok', startGame: 'bar' };
const fakeProviders = {
  tiktok: () => ({ start: async () => ({ roomId: '1' }), stop: async () => {} }),
  tikfinity: () => ({ start: async () => ({ roomId: 't' }), stop: async () => {} })
};

/** Gửi request và BẮT BUỘC có phản hồi trong `ms`; hết giờ coi như treo. */
function ask(port, { method = 'GET', urlPath = '/', headers = {}, body = null, ms = 4000 } = {}) {
  return new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port, path: urlPath, method, headers }, (res) => {
      let text = '';
      res.on('data', (c) => { text += c; });
      res.on('end', () => resolve({ status: res.statusCode, text }));
    });
    req.on('error', () => resolve({ status: 0, text: 'lỗi kết nối' }));
    req.setTimeout(ms, () => { req.destroy(); resolve({ status: -1, text: 'TREO — không có phản hồi' }); });
    if (body) req.write(body);
    req.end();
  });
}

test('handler ném lỗi vẫn phải trả lời (không bỏ treo kết nối của trình duyệt)', async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tlg-hang-'));
  // Bẫy: đặt một FILE tên "music" ở chỗ server muốn tạo THƯ MỤC → fs.mkdirSync ném lỗi giữa handler.
  fs.writeFileSync(path.join(dataDir, 'music'), 'không phải thư mục');
  const app = await startApp(config, { dataDir, providerFactories: fakeProviders, tickMs: 50 });
  t.after(async () => {
    await app.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  const res = await ask(app.port, {
    method: 'POST', urlPath: '/api/music-upload',
    headers: { 'Content-Type': 'audio/mpeg', 'x-admin-token': app.adminToken, 'x-filename': 'a.mp3' },
    body: 'xxxxx'
  });
  assert.notEqual(res.status, -1, 'request bị treo — đúng lỗi làm trang điều khiển đơ');
  assert.equal(res.status, 500, `phải trả 500 khi handler ném lỗi, nhận ${res.status} (${res.text})`);
});

test('đường dẫn lạ vẫn trả lời ngay, không đường nào bỏ lửng', async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tlg-hang2-'));
  const app = await startApp(config, { dataDir, providerFactories: fakeProviders, tickMs: 50 });
  t.after(async () => {
    await app.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  for (const urlPath of ['/', '/admin', '/stage', '/api/health', '/api/music-info', '/khong-co-gi',
    '/static/../../etc/passwd', '/api/tts?text=', '/api/music-custom.mp3', '/%ZZ']) {
    const res = await ask(app.port, { urlPath });
    assert.notEqual(res.status, -1, `${urlPath} bị treo`);
    assert.ok(res.status >= 200 && res.status < 600, `${urlPath} trả mã lạ: ${res.status}`);
  }

  // POST không có token: phải bị từ chối ngay chứ không ngồi đọc hết thân request
  const noToken = await ask(app.port, { method: 'POST', urlPath: '/api/music-youtube', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(noToken.status, 403);
});
