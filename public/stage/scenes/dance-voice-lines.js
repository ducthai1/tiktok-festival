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

// Quà combo: TikTok gửi nhiều lượt (×1, ×2, ×3…) — chỉ lượt ĐẦU thành khoảnh khắc (đọc cảm ơn + hiệu ứng); các lượt sau
// của cùng người + cùng món trong `repeatMs` chỉ cộng số trên thông báo.
export function createComboFilter({ repeatMs = 8000 } = {}) {
  const last = new Map(); // khoá → thời điểm lượt gần nhất
  return {
    isRepeat(fx) {
      const key = `${fx.userId}|${fx.giftName}`;
      const now = performance.now();
      const repeat = now - (last.get(key) ?? -Infinity) < repeatMs;
      last.set(key, now);
      if (last.size > 500) last.delete(last.keys().next().value);
      return repeat;
    },
    clear: () => last.clear()
  };
}
