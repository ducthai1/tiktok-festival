// CHẠY MỘT LẦN TRÊN MÁY ĐANG LIVE: gỡ dữ liệu buổi live + log khỏi git nhưng GIỮ NGUYÊN file trên ổ đĩa.
// (data/ và *.log đã nằm trong .gitignore; vài file từng bị `git add -f` nên git vẫn theo dõi → lộ lên repo công khai,
//  và mỗi lần server ghi vào là `git pull` báo xung đột.)
// Dùng: npm run untrack-data  → rồi: git commit -m "chore: stop tracking live data and logs" && git push
// KHÔNG chạy trên máy khác rồi push: máy live pull về sẽ bị XOÁ các file này.
import { execFileSync } from 'node:child_process';

const tracked = execFileSync('git', ['ls-files', '-z', '--', 'data', '*.log'], { encoding: 'utf8' })
  .split('\0').filter((f) => f && f !== 'data/.gitkeep');
if (!tracked.length) {
  console.log('Không còn file dữ liệu / log nào bị git theo dõi. Xong.');
  process.exit(0);
}
execFileSync('git', ['rm', '--cached', '--quiet', '--', ...tracked], { stdio: 'inherit' });
console.log(`Đã gỡ khỏi git (file trên ổ đĩa vẫn giữ nguyên):\n  ${tracked.join('\n  ')}`);
console.log('Tiếp theo: git commit -m "chore: stop tracking live data and logs" && git push');
