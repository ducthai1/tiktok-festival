// Điểm chạy: `npm start`. In ra 2 đường link — màn hình OBS và trang điều khiển.
import { startApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = await startApp(config, { voice: true }).catch((error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`Cổng ${config.port} đang bị chương trình khác dùng. Đặt PORT=khác rồi chạy lại.`);
  } else {
    console.error('Không khởi động được:', error?.message || error);
  }
  process.exit(1);
});

const base = `http://127.0.0.1:${app.port}`;
console.log('\n  TikTok Live Games đã chạy');
console.log(`  • Màn hình OBS (Browser Source 1080×1920): ${base}/stage`);
console.log(`  • Trang điều khiển (giữ kín link này):     ${base}/admin#token=${app.adminToken}`);
if (config.allowLan) console.log('  ⚠ ALLOW_LAN=1: máy khác cùng mạng mở được trang (vẫn cần token để điều khiển).');
console.log('  Nhấn Ctrl+C để tắt.\n');

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  await app.close().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
