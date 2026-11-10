// Nhớ ai đã follow kênh qua các buổi live (data/followers.json) — để người follow từ buổi trước vẫn hiện 💖 ngay,
// kể cả khi sự kiện TikTok không kèm trạng thái follow. Sự kiện giả lập (thử) không được ghi vào file.
import fs from 'node:fs';
import path from 'node:path';

const MAX_IDS = 50000;

export function createFollowerStore(dataDir, { saveDelayMs = 2000 } = {}) {
  const file = path.join(dataDir, 'followers.json');
  let ids = new Set();
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Array.isArray(saved.ids)) ids = new Set(saved.ids.map(String).slice(-MAX_IDS));
  } catch {
    // chưa có file: bắt đầu trống
  }
  let timer = null;
  const save = () => {
    timer = null;
    try {
      fs.writeFileSync(file, JSON.stringify({ savedAt: new Date().toISOString(), ids: [...ids].slice(-MAX_IDS) }));
    } catch (error) {
      console.warn('[followers] không lưu được:', error.message);
    }
  };

  return {
    has: (id) => ids.has(String(id)),
    size: () => ids.size,
    /** Ghi nhận + gắn cờ follower cho sự kiện (sửa tại chỗ). */
    mark(event) {
      const user = event?.user;
      if (!user?.id) return event;
      const id = String(user.id);
      if (!event.simulated && (event.type === 'follow' || user.follower) && !ids.has(id)) {
        ids.add(id);
        if (!timer) timer = setTimeout(save, saveDelayMs);
      }
      if (ids.has(id) || event.type === 'follow') user.follower = true;
      return event;
    },
    flush() {
      if (timer) {
        clearTimeout(timer);
        save();
      }
    }
  };
}
