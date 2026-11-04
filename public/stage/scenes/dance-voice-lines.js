// Câu giọng đọc cảm ơn ở Sàn Nhảy — MỌI quà tốn kim cương đều được cảm ơn (quà combo gộp thành một câu), quà càng to câu
// càng "VIP". Sau TÊN có dấu phẩy ("Cảm ơn Bé Na, đã tặng…") để giọng đọc ngắt một nhịp — tên không trôi tuột giữa câu
// (user không muốn kiểu gọi "… ơi"). Tên qua speakableName (chuẩn hoá để đọc rõ; có từ bẩn thì không đọc tên).
import { speakableGift, speakableName } from '../../shared/spoken-name.js';

export function thankLine(fx) {
  const name = speakableName(fx.nickname, '');
  const thanks = name ? `Cảm ơn ${name},` : 'Cảm ơn bạn';
  if (fx.kind === 'follow') return `${thanks} đã follow sàn nhảy! Mời bạn lên sân khấu!`;
  const gift = `${fx.count > 1 ? `${fx.count} ` : ''}${speakableGift(fx.giftName)}`;
  if (fx.tier >= 6) return `${name ? `Đại gia ${name}! Cảm ơn bạn` : 'Cảm ơn đại gia'} đã tặng ${gift}! Đại nhạc hội bắt đầu! Cả sàn cháy hết mình nào!`;
  if (fx.tier >= 5) return `${name ? `Siêu sao ${name}! Cảm ơn bạn` : 'Cảm ơn siêu sao'} đã tặng ${gift}! Cả sàn quẩy lên nào!`;
  if (fx.tier >= 4) return `Quá đỉnh! ${thanks} đã tặng ${gift}! Mời VIP lên sân khấu!`;
  return `${thanks} đã tặng ${gift}!`;
}

// Quà combo: TikTok gửi nhiều lượt (×1, ×2, ×3…) — đọc MỘT câu ngay ở lượt đầu (bắt đầu tạo giọng liền, không chờ gộp —
// câu cảm ơn phải tới cùng lúc với hiệu ứng), các lượt sau của cùng người + cùng món trong `repeatMs` thì không đọc lại.
// onStart(fx): gọi lúc giọng bắt đầu đọc (hoặc ngay khi lượt đó không đọc) — nơi gọi dùng để mở cổng hiệu ứng.
export function createGiftVoice(say, { repeatMs = 8000 } = {}) {
  const lastSaid = new Map(); // khoá → thời điểm đọc
  return {
    add(fx, onStart) {
      const key = `${fx.userId}|${fx.giftName}`;
      const now = performance.now();
      if (now - (lastSaid.get(key) ?? -Infinity) < repeatMs) {
        lastSaid.set(key, now);
        onStart?.();
        return;
      }
      lastSaid.set(key, now);
      if (lastSaid.size > 500) lastSaid.delete(lastSaid.keys().next().value);
      say(thankLine(fx), onStart);
    },
    clear() {
      lastSaid.clear();
    }
  };
}
