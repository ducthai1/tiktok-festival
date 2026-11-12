// Đổi token trang điều khiển: `npm run rotate-token`. Token cũ hết hiệu lực khi KHỞI ĐỘNG LẠI server.
// Dùng khi link /admin#token=… bị lộ (dán nhầm lên chat, git, ảnh chụp màn hình…).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAdminToken } from '../src/admin-token-store.js';

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const token = createAdminToken(dataDir);
const port = Number(process.env.PORT) || 3939;
console.log('Đã tạo token mới trong data/admin-token.');
console.log('→ Khởi động lại server (Ctrl+C rồi npm start) để token cũ hết hiệu lực.');
console.log(`→ Link mới (giữ kín, KHÔNG dán vào git/chat): http://127.0.0.1:${port}/admin#token=${token}`);
