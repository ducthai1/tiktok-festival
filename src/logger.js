// Nhật ký toàn bộ server: mọi dòng có giờ (giờ máy, kèm múi giờ), mức độ và khu vực, in ra màn hình + ghi file
// data/logs/YYYY-MM-DD.log (mỗi ngày một file, giữ 14 ngày). Dùng để truy lại sự cố: lúc nào mất dữ liệu,
// lỗi gì, đã nối lại bao nhiêu lần. data/ không đưa lên git (xem .gitignore) — log có tên người xem.
import fs from 'node:fs';
import path from 'node:path';
import { inspect } from 'node:util';

const KEEP_DAYS = 14;
let logDir = '';
let stream = null;
let streamDay = '';
const original = { log: console.log, info: console.info, warn: console.warn, error: console.error };

const pad = (n, w = 2) => String(n).padStart(w, '0');
/** "2026-11-12 16:05:03.124 +07:00" — giờ địa phương của máy chạy live. */
export function timestamp(date = new Date()) {
  const off = -date.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:`
    + `${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)} ${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}

const dayOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function fileStream(date) {
  if (!logDir) return null;
  const day = dayOf(date);
  if (stream && streamDay === day) return stream;
  stream?.end();
  streamDay = day;
  stream = fs.createWriteStream(path.join(logDir, `${day}.log`), { flags: 'a' });
  stream.on('error', (error) => original.error('[logger] không ghi được file log:', error.message));
  prune();
  return stream;
}

function prune() {
  try {
    const cutoff = Date.now() - KEEP_DAYS * 86400000;
    for (const name of fs.readdirSync(logDir)) {
      if (!/^\d{4}-\d{2}-\d{2}\.log$/.test(name)) continue;
      const full = path.join(logDir, name);
      if (fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full);
    }
  } catch {
    // dọn log cũ không được thì thôi
  }
}

const render = (args) => args.map((a) => (typeof a === 'string' ? a : a instanceof Error ? (a.stack || a.message) : inspect(a, { depth: 4, breakLength: 160 })))
  .join(' ');

function write(level, args) {
  const now = new Date();
  const line = `${timestamp(now)} ${level.padEnd(5)} ${render(args)}`;
  // khi chạy test (node --test) không in ra màn hình cho gọn
  if (!process.env.NODE_TEST_CONTEXT) (level === 'ERROR' ? original.error : level === 'WARN' ? original.warn : original.log)(line);
  fileStream(now)?.write(`${line.replace(/token=[A-Za-z0-9_-]+/g, 'token=***')}\n`);
}

/** Bật ghi file + gắn giờ cho mọi console.log/warn/error sẵn có trong code. Gọi một lần lúc khởi động. */
export function setupLogging(dataDir) {
  logDir = path.join(dataDir, 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  console.log = (...args) => write('INFO', args);
  console.info = (...args) => write('INFO', args);
  console.warn = (...args) => write('WARN', args);
  console.error = (...args) => write('ERROR', args);
  return logDir;
}

/** log.info('live', 'đã kết nối', { roomId }) → "… INFO  [live] đã kết nối { roomId: … }" */
export const log = {
  info: (area, ...args) => write('INFO', [`[${area}]`, ...args]),
  warn: (area, ...args) => write('WARN', [`[${area}]`, ...args]),
  error: (area, ...args) => write('ERROR', [`[${area}]`, ...args])
};

export function closeLogging() {
  stream?.end();
  stream = null;
}
