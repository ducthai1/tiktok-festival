/**
 * Graceful restart: đọc hot-backup, rebalance adaptive queue,
 * chờ câu hỏi hiện tại kết thúc, patch backup rồi gửi SIGTERM.
 * Dùng: node scripts/graceful-restart.mjs [PID]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { assignEnglishGifts } from '../public/shared/english-sets.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BACKUP = path.join(ROOT, 'data', 'hot-backup.json');
const HOLD_QUESTIONS = 20;
const MIN_QUESTIONS = 2;

function adaptiveQ(totalSlots) {
  return Math.max(MIN_QUESTIONS, Math.floor(HOLD_QUESTIONS / Math.max(1, totalSlots)));
}

function rebalanceBackup() {
  const raw = fs.readFileSync(BACKUP, 'utf8');
  const data = JSON.parse(raw);
  const ctrl = data.state?.control;
  if (!ctrl) { console.log('[restart] Không tìm thấy control state.'); return data; }

  const q = ctrl.deckQueue || [];
  const totalSlots = (ctrl.set !== 'general' ? 1 : 0) + q.length;

  if (totalSlots <= 1) {
    console.log('[restart] Queue ngắn, không cần rebalance.');
    return data;
  }

  const newQ = adaptiveQ(totalSlots);
  console.log(`[restart] Rebalance: ${totalSlots} slots → ${newQ} câu/topic`);

  // Rút setLeft của topic đang chạy (không tăng lên)
  if (ctrl.set !== 'general') {
    ctrl.setLeft = Math.min(ctrl.setLeft || newQ, newQ);
  }
  // Rebalance toàn bộ queue
  for (const item of q) item.questions = newQ;

  try {
    const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'gift-catalog.json'), 'utf8'));
    ctrl.rules = assignEnglishGifts(cat.gifts);
    console.log(`[restart] Đã gán 12 món quà thật cho 12 ô!`);
  } catch (e) {
    console.warn(`[restart] Lỗi load gift-catalog:`, e.message);
  }

  fs.writeFileSync(BACKUP, JSON.stringify(data));
  console.log(`[restart] Đã patch backup: setLeft=${ctrl.setLeft}, queue=${q.length} phần tử × ${newQ} câu`);
  return data;
}

async function run() {
  const pid = parseInt(process.argv[2]) || null;
  if (!pid) { console.error('Dùng: node scripts/graceful-restart.mjs <PID>'); process.exit(1); }

  // Đọc msLeft hiện tại từ backup
  const data = JSON.parse(fs.readFileSync(BACKUP, 'utf8'));
  const msLeft = data.state?.msLeft ?? 0;
  const phase  = data.state?.phase ?? '';
  const waitMs = phase === 'question' ? Math.max(0, msLeft) + 500 : 500;

  console.log(`[restart] Phase: ${phase} | msLeft: ${msLeft}ms → chờ ${waitMs}ms trước khi restart`);

  await new Promise(r => setTimeout(r, waitMs));

  // Patch backup sau khi câu hết giờ
  rebalanceBackup();

  // Gửi SIGTERM → main.js gọi app.close() → backup lần cuối rồi exit
  console.log(`[restart] Gửi SIGTERM → PID ${pid}`);
  process.kill(pid, 'SIGTERM');
  console.log('[restart] Xong. npm start sẽ restore từ backup đã patch.');
}

run().catch(e => { console.error(e); process.exit(1); });
