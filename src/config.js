// Cấu hình đọc từ biến môi trường. Mặc định an toàn: chỉ nghe 127.0.0.1,
// không tự kết nối tới tài khoản nào, không bật giả lập.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

export const GAME_IDS = ['boss', 'temple', 'bar', 'swim'];

export function loadConfig(env = process.env) {
  const port = Number(env.PORT || 3939);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error(`PORT không hợp lệ: ${env.PORT}`);
  const allowLan = env.ALLOW_LAN === '1';
  const provider = String(env.LIVE_PROVIDER || 'tiktok').toLowerCase();
  if (!['tiktok', 'tikfinity'].includes(provider)) throw new Error('LIVE_PROVIDER chỉ nhận "tiktok" hoặc "tikfinity"');
  const startGame = GAME_IDS.includes(env.START_GAME) ? env.START_GAME : 'bar';
  return {
    port,
    // ALLOW_LAN=1 để điều khiển từ điện thoại cùng wifi; trang admin vẫn cần token.
    host: allowLan ? '0.0.0.0' : '127.0.0.1',
    allowLan,
    provider,
    tikfinityUrl: String(env.TIKFINITY_WS_URL || 'ws://127.0.0.1:21213/'),
    eulerApiKey: env.EULER_API_KEY ? String(env.EULER_API_KEY) : undefined,
    tiktokUsername: env.TIKTOK_USERNAME ? String(env.TIKTOK_USERNAME) : '',
    startGame
  };
}
