// Nhớ ai là Fan Club của kênh qua các buổi live (data/fanclub.json) — để khi vào phòng hoặc bình luận,
// người xem vẫn luôn được chào với khung Fan CLB và đúng cấp (fanLevel), kể cả khi sự kiện TikTok
// không gửi kèm cờ fanClub. Sự kiện giả lập không được ghi vào file.
import fs from 'node:fs';
import path from 'node:path';

const MAX_FANS = 10000;

export function createFanClubStore(dataDir, { saveDelayMs = 2000 } = {}) {
  const file = path.join(dataDir, 'fanclub.json');
  // fans: Map<id, { fanClub: true, fanLevel: number, nickname?: string }>
  const fans = new Map();
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (saved && typeof saved.fans === 'object') {
      for (const [id, f] of Object.entries(saved.fans)) {
        if (f && f.fanClub) {
          fans.set(String(id), {
            fanClub: true,
            fanLevel: Math.max(1, Number(f.fanLevel) || 1),
            nickname: f.nickname || ''
          });
        }
      }
    }
  } catch {
    // chưa có file
  }

  let timer = null;
  const save = () => {
    timer = null;
    try {
      const obj = {};
      for (const [id, f] of fans) obj[id] = f;
      fs.writeFileSync(file, JSON.stringify({ savedAt: new Date().toISOString(), fans: obj }, null, 2));
    } catch (error) {
      console.warn('[fanclub] không lưu được:', error.message);
    }
  };

  // Lưu file ban đầu nếu chưa có
  if (!fs.existsSync(file)) save();

  return {
    has: (id) => fans.has(String(id)),
    get: (id) => fans.get(String(id)),
    size: () => fans.size,
    /**
     * Gắn thông tin Fan Club vào sự kiện người xem.
     * Tự động học nếu TikTok gửi fanClub = true hoặc fanLevel > 0 hoặc sự kiện vào fanclub.
     */
    mark(event) {
      const user = event?.user;
      if (!user?.id) return event;
      const id = String(user.id);
      const isFan = user.fanClub === true || Number(user.fanLevel) > 0;
      if (!event.simulated && isFan) {
        const current = fans.get(id);
        const newLevel = Math.max(1, Number(user.fanLevel) || current?.fanLevel || 1);
        if (!current || current.fanLevel < newLevel) {
          fans.set(id, { fanClub: true, fanLevel: newLevel, nickname: user.nickname || '' });
          if (!timer) timer = setTimeout(save, saveDelayMs);
        }
      }
      const savedFan = fans.get(id);
      if (savedFan) {
        user.fanClub = true;
        user.fanLevel = Math.max(Number(user.fanLevel) || 0, savedFan.fanLevel);
      }
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
