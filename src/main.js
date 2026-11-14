// Điểm chạy: `npm start`. In ra 2 đường link — màn hình OBS và trang điều khiển.
import { startApp } from './app.js';
import { DATA_DIR, loadConfig } from './config.js';
import { startHealthMonitor } from './health-monitor.js';
import { closeLogging, log, setupLogging } from './logger.js';

const logDir = setupLogging(DATA_DIR); // từ đây mọi dòng log có giờ + ghi ra data/logs/YYYY-MM-DD.log
// Lỗi lọt ra ngoài: ghi đủ chi tiết, server vẫn chạy tiếp (đang live — tắt server là mất cả buổi)
process.on('unhandledRejection', (reason) => log.error('process', 'promise bị từ chối không ai bắt (server vẫn chạy):', reason));
process.on('uncaughtException', (error) => log.error('process', 'lỗi không bắt được (server vẫn chạy):', error));

const config = loadConfig();
log.info('server', `khởi động — node ${process.version}, pid ${process.pid}, cổng ${config.port}, nguồn ${config.provider}`
  + `, tự kết nối ${config.tiktokUsername || '(không)'}, EULER_API_KEY ${config.eulerApiKey ? 'CÓ' : 'KHÔNG CÓ'}, dữ liệu ở ${DATA_DIR}, log ở ${logDir}`);
if (!config.eulerApiKey) log.warn('server', 'chưa có EULER_API_KEY trong .env — TikTok dễ chặn / giới hạn kết nối (xem .env.example)');
const app = await startApp(config, { voice: true }).catch((error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`Cổng ${config.port} đang bị chương trình khác dùng. Đặt PORT=khác rồi chạy lại.`);
  } else {
    console.error('Không khởi động được:', error?.message || error);
  }
  process.exit(1);
});

const stopHealth = startHealthMonitor({ extra: () => ({ 'live': app.live.status().state }) });
const base = `http://127.0.0.1:${app.port}`;
console.log('\n  TikTok Live Games đã chạy');
console.log(`  • Màn hình OBS (Browser Source 1080×1920): ${base}/stage`);
console.log(`  • Trang điều khiển (giữ kín link này):     ${base}/admin#token=${app.adminToken}`);
if (config.allowLan) console.log('  ⚠ ALLOW_LAN=1: máy khác cùng mạng mở được trang (vẫn cần token để điều khiển).');
console.log('  Nhấn Ctrl+C để tắt.\n');

let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  log.info('server', `tắt server (${signal})`);
  stopHealth();
  await app.close().catch((error) => log.error('server', 'lỗi khi tắt:', error));
  closeLogging();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('exit', (code) => log.info('server', `tiến trình thoát, mã ${code}`));
