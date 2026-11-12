// Cấu hình đọc từ biến môi trường. Mặc định an toàn: chỉ nghe 127.0.0.1,
// không tự kết nối tới tài khoản nào, không bật giả lập.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

function parseDotEnv(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf8');
    const env = {};
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        env[key] = val;
      }
    }
    return env;
  } catch {
    return {};
  }
}

export const GAME_IDS = ['boss', 'temple', 'bar', 'dance', 'swim', 'lophoc', 'dovui', 'english', 'emoji', 'flag', 'math', 'wordle'];

export function loadConfig(envInput = process.env) {
  const dotenv = parseDotEnv(path.join(ROOT_DIR, '.env'));
  const env = { ...dotenv, ...envInput };
  const port = Number(env.PORT || 3939);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error(`PORT không hợp lệ: ${env.PORT}`);
  const allowLan = env.ALLOW_LAN === '1';
  const provider = String(env.LIVE_PROVIDER || 'tiktok').toLowerCase();
  if (!['tiktok', 'tikfinity'].includes(provider)) throw new Error('LIVE_PROVIDER chỉ nhận "tiktok" hoặc "tikfinity"');
  const startGame = GAME_IDS.includes(env.START_GAME) ? env.START_GAME : 'boss';
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
