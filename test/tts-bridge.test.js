import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createTtsBridge } from '../src/tts/tts-bridge.js';

const call = async (bridge, query) => {
  const res = { code: 0, headers: {}, body: null, writeHead(code, headers) { this.code = code; this.headers = headers; }, end(body) { this.body = body; } };
  await bridge.handle({ url: `/api/tts?${query}`, method: 'GET' }, res, 3939);
  return res;
};

test('/api/tts refuses dirty or overlong lines and answers 503 until the voice is installed', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-'));
  const bridge = createTtsBridge({ dataDir, python: path.join(dataDir, 'no-python') });
  assert.equal(bridge.start(), false);
  assert.deepEqual(bridge.status(), { installed: false, ready: false });
  assert.equal((await call(bridge, `text=${encodeURIComponent('Cảm ơn Đ.ị.t mẹ đã tặng quà')}`)).code, 400);
  assert.equal((await call(bridge, `text=${encodeURIComponent('gọi 0912345678 nhé')}`)).code, 400);
  assert.equal((await call(bridge, `text=${'a'.repeat(201)}`)).code, 400);
  assert.equal((await call(bridge, 'text=')).code, 400);
  assert.equal((await call(bridge, `text=${encodeURIComponent('Cảm ơn Bé Na đã tặng 5 Hoa hồng!')}&voice=x`)).code, 503);
  // câu đã đọc trước đó (đệm đĩa) vẫn phát được dù giọng đọc chưa chạy
  const wav = Buffer.from('RIFF....WAVEfmt ');
  const key = (await import('node:crypto')).createHash('sha1').update('Ngọc Huyền|Xin chào').digest('hex');
  fs.mkdirSync(path.join(dataDir, 'tts-cache'));
  fs.writeFileSync(path.join(dataDir, 'tts-cache', `${key}.wav`), wav);
  const hit = await call(bridge, `text=${encodeURIComponent('Xin chào')}&voice=${encodeURIComponent('Ngọc Huyền')}`);
  assert.equal(hit.code, 200);
  assert.equal(hit.headers['Content-Type'], 'audio/wav');
  assert.deepEqual(hit.body, wav);
});
