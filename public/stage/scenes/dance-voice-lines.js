// Câu giọng đọc cảm ơn ở Sàn Nhảy — quà càng to câu càng "VIP" (chỉ đọc từ quà 99 💎 trở lên + follow, quà nhỏ không đọc
// để khỏi ồn). TÊN được gọi lên ĐẦU câu kiểu MC ("Bé Na ơi! Cảm ơn bạn…"): tên đứng riêng, có chỗ ngắt nên nghe rõ, thay vì
// trôi tuột giữa câu. Tên qua speakableName (chuẩn hoá để đọc rõ; có từ bẩn thì bỏ, không gọi tên).
import { speakableGift, speakableName } from '../../shared/spoken-name.js';

export function thankLine(fx) {
  const name = speakableName(fx.nickname, '');
  const call = name ? `${name} ơi! ` : '';
  if (fx.kind === 'follow') return `${call}Cảm ơn bạn đã follow sàn nhảy! Mời bạn lên sân khấu!`;
  const gift = `${fx.count > 1 ? `${fx.count} ` : ''}${speakableGift(fx.giftName)}`;
  if (fx.tier >= 6) return `${name ? `Đại gia ${name}! Cảm ơn bạn` : 'Cảm ơn đại gia'} đã tặng ${gift}! Đại nhạc hội bắt đầu! Cả sàn cháy hết mình nào!`;
  if (fx.tier >= 5) return `${name ? `Siêu sao ${name}! Cảm ơn bạn` : 'Cảm ơn siêu sao'} đã tặng ${gift}! Cả sàn quẩy lên nào!`;
  if (fx.tier >= 4) return `Quá đỉnh! ${call}Cảm ơn bạn đã tặng ${gift}! Mời VIP lên sân khấu!`;
  return `${call}Cảm ơn bạn đã tặng ${gift}!`;
}
