import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { addLogSink, setupLogging } from '../src/logger.js';
import { KEEP_SESSIONS, createSessionLog } from '../src/session-log.js';

// setupLogging() mới là thứ cắm console.log vào logger — không gọi thì sink không nhận được gì.
const tmp = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-log-'));
  setupLogging(dir);
  return dir;
};
const read = (dir, file) => fs.readFileSync(path.join(dir, 'sessions', file), 'utf8');
const HOUR = 3600 * 1000;

test('mỗi phòng live một file; mất sóng nối lại vẫn cùng file, phòng khác thì sang file mới', async () => {
  const dir = tmp();
  let clock = Date.parse('2026-11-18T20:00:00Z');
  const sessions = createSessionLog(path.join(dir, 'logs'), { now: () => clock });
  sessions.setup();

  const a = sessions.start('phong-1');
  assert.ok(a.endsWith('_phong-1.log'), a);
  console.log('câu 1 trong buổi một');

  // nối lại cùng phòng (mất sóng rồi có lại): không mở file mới
  clock += 5 * 60 * 1000;
  assert.equal(sessions.start('phong-1'), a);
  console.log('câu 2 trong buổi một');

  // sang phòng khác → đóng buổi cũ, mở file mới
  clock += 2 * HOUR;
  const b = sessions.start('phong-2');
  assert.notEqual(b, a);
  console.log('câu đầu buổi hai');
  await sessions.close('hết test');

  const one = read(path.join(dir, 'logs'), a);
  assert.match(one, /BẮT ĐẦU phiên live · phòng phong-1/);
  assert.match(one, /câu 1 trong buổi một/);
  assert.match(one, /câu 2 trong buổi một/);
  assert.doesNotMatch(one, /câu đầu buổi hai/); // buổi hai không lọt vào file buổi một
  assert.match(one, /KẾT THÚC phiên · phòng phong-1 · dài 2 giờ 5 phút/);
  assert.match(read(path.join(dir, 'logs'), b), /câu đầu buổi hai/);
});

test('khởi động lại server giữa buổi: ghi TIẾP vào file cũ, không cắt thành hai buổi', async () => {
  const dir = tmp();
  let clock = Date.parse('2026-11-18T20:00:00Z');
  const first = createSessionLog(path.join(dir, 'logs'), { now: () => clock });
  first.setup();
  const file = first.start('phong-1');
  console.log('trước khi khởi động lại');
  await first.close('tắt server');

  clock += 10 * 60 * 1000; // bật lại sau 10 phút, vẫn đang live phòng đó
  const second = createSessionLog(path.join(dir, 'logs'), { now: () => clock });
  second.setup();
  assert.equal(second.start('phong-1'), file, 'phải ghi tiếp vào đúng file buổi đang dở');
  console.log('sau khi khởi động lại');
  await second.close('xong');

  const text = read(path.join(dir, 'logs'), file);
  assert.match(text, /trước khi khởi động lại/);
  assert.match(text, /GHI TIẾP phiên live/);
  assert.match(text, /sau khi khởi động lại/);

  // quá 12 tiếng thì coi là buổi mới, dù cùng phòng
  clock += 20 * HOUR;
  const later = createSessionLog(path.join(dir, 'logs'), { now: () => clock });
  later.setup();
  assert.notEqual(later.start('phong-1'), file);
  await later.close();
});

test('token trang điều khiển bị che trong file phiên', async () => {
  const dir = tmp();
  const sessions = createSessionLog(path.join(dir, 'logs'));
  sessions.setup();
  const file = sessions.start('phong-1');
  console.log('mở /admin#token=abc123XYZ-_ rồi điều khiển');
  await sessions.close();
  const text = read(path.join(dir, 'logs'), file);
  assert.match(text, /token=\*\*\*/);
  assert.doesNotMatch(text, /abc123XYZ/);
});

test('chỉ giữ KEEP_SESSIONS buổi gần nhất, xoá dần buổi cũ nhất', async () => {
  const dir = tmp();
  let clock = Date.parse('2026-01-01T00:00:00Z');
  const sessions = createSessionLog(path.join(dir, 'logs'), { now: () => clock });
  sessions.setup();
  for (let i = 0; i < KEEP_SESSIONS + 5; i += 1) {
    sessions.start(`phong-${i}`);
    clock += 24 * HOUR; // mỗi buổi một ngày → không bao giờ rơi vào cửa sổ ghi tiếp
  }
  await sessions.close();
  const files = fs.readdirSync(path.join(dir, 'logs', 'sessions')).filter((f) => f.endsWith('.log'));
  assert.equal(files.length, KEEP_SESSIONS);
  assert.ok(files.some((f) => f.endsWith(`_phong-${KEEP_SESSIONS + 4}.log`)), 'buổi mới nhất phải còn');
  assert.ok(!files.some((f) => f.endsWith('_phong-0.log')), 'buổi cũ nhất phải bị xoá');
  assert.equal(sessions.list().length, KEEP_SESSIONS);
});

test('đóng xong thì không chép log nữa; lỗi ở nơi nhận không làm chết việc ghi log', async () => {
  const dir = tmp();
  const sessions = createSessionLog(path.join(dir, 'logs'));
  sessions.setup();
  const file = sessions.start('phong-1');
  await sessions.close();
  console.log('dòng sau khi đã đóng');
  assert.doesNotMatch(read(path.join(dir, 'logs'), file), /dòng sau khi đã đóng/);
  assert.equal(sessions.current(), null);

  const off = addLogSink(() => { throw new Error('nơi nhận hỏng'); });
  assert.doesNotThrow(() => console.log('vẫn phải ghi được'));
  off();
});
