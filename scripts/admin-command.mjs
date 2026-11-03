// Gửi lệnh tới server game như trang điều khiển (token đọc từ data/admin-token, không in ra).
// Dùng: node scripts/admin-command.mjs <lệnh> [tham số]
//   status                         trạng thái nối live + game đang chạy
//   connect <tên TikTok>           nối phòng live (chưa live thì server tự thử lại tới khi phòng mở)
//   disconnect                     ngắt nối live
//   switch <temple|bar|swim>       đổi game
//   test <chat|like|gift|follow|member> [nội dung]   bơm sự kiện thử (bị chặn khi đang nối live thật)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 3939);
const token = fs.readFileSync(path.join(root, 'data', 'admin-token'), 'utf8').trim();
const [cmd, ...rest] = process.argv.slice(2);

const messages = {
  status: () => [{ t: 'ping' }],
  connect: () => [{ t: 'connect', username: rest[0], provider: 'tiktok' }],
  disconnect: () => [{ t: 'disconnect' }],
  switch: () => [{ t: 'switch', game: rest[0] }],
  test: () => [{ t: 'test', kind: rest[0], viewer: 900, comment: rest.slice(1).join(' ') || 'chào', diamonds: Number(rest[1]) || 1, likes: 5 }]
}[cmd];
if (!messages) {
  console.error('Lệnh: status | connect <tên> | disconnect | switch <temple|bar|swim> | test <loại> [nội dung]');
  process.exit(2);
}

const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: `http://127.0.0.1:${port}` });
const timer = setTimeout(() => { console.error('Server game không trả lời — đã chạy chưa? (curl http://127.0.0.1:3939/api/health)'); process.exit(1); }, 15000);
ws.on('error', (error) => { console.error(`Không nối được server game: ${error.message}`); process.exit(1); });
ws.on('open', () => ws.send(JSON.stringify({ t: 'auth', token })));
ws.on('message', (raw) => {
  const m = JSON.parse(raw);
  if (m.t === 'authFail') { console.error('Sai token'); process.exit(1); }
  if (m.t === 'authOk') messages().forEach((msg, i) => ws.send(JSON.stringify({ id: i + 1, ...msg })));
  if (m.t === 'reply') {
    console.log(JSON.stringify(cmd === 'status' ? { live: m.live, game: m.settings?.activeGame, username: m.settings?.username } : m));
    clearTimeout(timer);
    ws.close();
  }
});
