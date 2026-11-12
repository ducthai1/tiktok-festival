// Token mở trang điều khiển. Tạo ngẫu nhiên lần đầu, lưu data/admin-token (chỉ chủ máy
// đọc được) để link đã bookmark vẫn dùng được sau khi khởi động lại.
// Đổi token: `npm run rotate-token` rồi khởi động lại server. Khi token cũ bị lộ (vd lọt lên git), tăng TOKEN_ROTATION:
// mọi máy chạy bản code mới sẽ tự đổi token MỘT LẦN lúc khởi động (ghi dấu ở data/admin-token.rotation).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// 12/11/2026: link có token lọt lên repo công khai qua server.log → bắt buộc đổi.
export const TOKEN_ROTATION = '2026-11-12-leak';

export function createAdminToken(dataDir) {
  const token = crypto.randomBytes(24).toString('base64url');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'admin-token'), `${token}\n`, { mode: 0o600 });
  return token;
}

export function loadOrCreateAdminToken(dataDir, { onRotate = () => {} } = {}) {
  const file = path.join(dataDir, 'admin-token');
  const marker = path.join(dataDir, 'admin-token.rotation');
  let existing = '';
  let rotation = '';
  try {
    existing = fs.readFileSync(file, 'utf8').trim();
  } catch {
    // chưa có file
  }
  try {
    rotation = fs.readFileSync(marker, 'utf8').trim();
  } catch {
    // chưa từng đổi
  }
  const valid = /^[A-Za-z0-9_-]{32,}$/.test(existing);
  if (valid && rotation === TOKEN_ROTATION) return existing;
  const token = createAdminToken(dataDir);
  fs.writeFileSync(marker, `${TOKEN_ROTATION}\n`);
  if (valid) onRotate(); // có token cũ mà chưa qua đợt đổi này → đã đổi
  return token;
}
