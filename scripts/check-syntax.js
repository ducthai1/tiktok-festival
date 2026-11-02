// Kiểm cú pháp mọi file .js (server + màn hình + trang điều khiển + test) bằng `node --check`.
// Thoát mã khác 0 nếu có file lỗi — dùng làm cổng trước khi commit.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js')) files.push(full);
  }
}
for (const dir of ['src', 'public', 'test', 'scripts']) walk(path.join(root, dir));

let failed = 0;
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    failed += 1;
    console.error(`✗ ${path.relative(root, file)}\n${error.stderr}`);
  }
}
console.log(`${files.length - failed}/${files.length} file đúng cú pháp`);
process.exit(failed ? 1 : 0);
