// Token mở trang điều khiển. Tạo ngẫu nhiên lần đầu, lưu data/admin-token (chỉ chủ máy
// đọc được) để link đã bookmark vẫn dùng được sau khi khởi động lại.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function loadOrCreateAdminToken(dataDir) {
  const file = path.join(dataDir, 'admin-token');
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (/^[A-Za-z0-9_-]{32,}$/.test(existing)) return existing;
  } catch {
    // chưa có file — tạo mới bên dưới
  }
  const token = crypto.randomBytes(24).toString('base64url');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(file, `${token}\n`, { mode: 0o600 });
  return token;
}
