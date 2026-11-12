// Cài (hoặc cài lại) giọng đọc tiếng Anh: npm run setup-tts-en
// Server cũng tự cài lần đầu; chạy tay khi log [tts-en] báo cài thất bại, hoặc để kiểm tra mạng có đọc được không.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_EN_ENV, setupEnglishVoice } from '../src/tts/english-voice-setup.js';
import { createEnglishTts, EN_VOICES } from '../src/tts/english-tts.js';

const envDir = process.env.TTS_EN_ENV || DEFAULT_EN_ENV;
try {
  const version = await setupEnglishVoice({ envDir, log: (line) => console.log(`→ ${line}`) });
  console.log(`✓ edge-tts ${version} — ${envDir}`);
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exit(1);
}

// Đọc thử một từ với cả 8 giọng (cần mạng) — lưu đệm vào thư mục tạm, không đụng data/
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-en-'));
const tts = createEnglishTts({ dataDir: dir, envDir });
let ok = 0;
for (const v of EN_VOICES) {
  const t0 = Date.now();
  const mp3 = await tts.clip('pronunciation', { voice: v.id });
  console.log(`${mp3 ? '✓' : '✗'} ${v.label.padEnd(24)} ${mp3 ? `${mp3.length} byte, ${Date.now() - t0} ms` : 'không đọc được (xem dòng [tts-en] phía trên)'}`);
  if (mp3) ok += 1;
}
fs.rmSync(dir, { recursive: true, force: true });
console.log(ok === EN_VOICES.length ? '✓ Giọng tiếng Anh sẵn sàng — khởi động lại server (hoặc chờ: server đang chạy tự nhận).' : `✗ ${EN_VOICES.length - ok} giọng lỗi`);
process.exit(ok ? 0 : 1);
