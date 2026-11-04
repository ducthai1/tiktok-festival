// Câu giọng đọc cảm ơn ở Sàn Nhảy — quà càng to câu càng "VIP" (chỉ đọc từ quà 99 💎 trở lên + follow, quà nhỏ không đọc
// để khỏi ồn). Tên người xem / tên quà qua speakableName: tên có từ tục tĩu / miệt thị (kể cả viết lách) đọc thành "bạn",
// emoji + chữ không phải Latin bị bỏ (giọng Việt đọc vấp).
import { speakableName } from '../../shared/profanity-filter.js';

export function thankLine(fx) {
  const name = speakableName(fx.nickname);
  if (fx.kind === 'follow') return `Cảm ơn ${name} đã follow sàn nhảy! Mời bạn lên sân khấu!`;
  const gift = `${fx.count > 1 ? `${fx.count} ` : ''}${speakableName(fx.giftName, 'quà')}`;
  if (fx.tier >= 6) return `Đại gia ${name} vừa tặng ${gift}! Đại nhạc hội bắt đầu! Cả sàn cháy hết mình nào!`;
  if (fx.tier >= 5) return `Siêu sao ${name} vừa tặng ${gift}! Cả sàn quẩy lên nào!`;
  if (fx.tier >= 4) return `Quá đỉnh! ${name} tặng ${gift}! Mời VIP lên sân khấu!`;
  return `Cảm ơn ${name} đã tặng ${gift}!`;
}
