// Tab Từ Vựng Tiếng Anh: quà đổi BỘ ĐỀ hoặc ĐỘ KHÓ cho cả phòng — dùng chung cho server (áp luật) và màn hình (bảng icon quà).
// Theo giá MỘT món quà (xu). Hệ thống chưa thấy món nào 2–4 xu nên dùng các mức có thật: 1 / 5 / 10 / 20 / 30 / 99.
// Muốn đổi giá: sửa min/max ở ENGLISH_GIFT_RULES, mọi nơi (server, bảng trên màn hình) tự theo.
import { foldText } from './profanity-filter.js';

/** Đổi xong giữ trong bấy nhiêu câu rồi tự về mặc định (Tổng hợp · Vừa). Tặng lại thì đếm lại từ đầu. */
export const ENGLISH_HOLD_QUESTIONS = 20;

export const ENGLISH_TARGETS = {
  easy: { kind: 'level', icon: '😊', label: 'Dễ' },
  hard: { kind: 'level', icon: '🔥', label: 'Khó' },
  toeic: { kind: 'set', icon: '💼', label: 'TOEIC' },
  ielts: { kind: 'set', icon: '🎓', label: 'IELTS' },
  yhoc: { kind: 'set', icon: '🩺', label: 'Y học' },
  bongda: { kind: 'set', icon: '⚽', label: 'Bóng đá' },
  congnghe: { kind: 'set', icon: '💻', label: 'Công nghệ' }
};
export const ENGLISH_DEFAULTS = { set: { icon: '🌐', label: 'Tổng hợp' }, level: { icon: '⚖️', label: 'Vừa' } };

// Hoa hồng (1 xu) → Dễ; quà 1 xu khác (TikTok, GG, Kem…) → Khó; Bắn tim 5 → TOEIC; Rosa 10 → IELTS;
// Nước hoa 20 → Y học; Bánh donut 30 → Bóng đá; Mũ 99 → Công nghệ. Từ 199 xu: chỉ cảm ơn, không đổi.
export const ENGLISH_GIFT_RULES = [
  { to: 'easy', min: 1, max: 1, rose: true },
  { to: 'hard', min: 1, max: 1, rose: false },
  { to: 'toeic', min: 2, max: 9 },
  { to: 'ielts', min: 10, max: 19 },
  { to: 'yhoc', min: 20, max: 29 },
  { to: 'bongda', min: 30, max: 98 },
  { to: 'congnghe', min: 99, max: 198 }
];

const ROSE_NAMES = new Set(['rose', 'hoa hong']);
export const isRoseGift = (gift) => String(gift?.id || '') === '5655' || ROSE_NAMES.has(foldText(gift?.name));

/** gift: sự kiện quà ({ diamondsEach, name, id }) hoặc món trong danh mục ({ coins, name, id }) → luật khớp hoặc null. */
export function englishRuleFor(gift) {
  const coins = Number(gift?.diamondsEach ?? gift?.coins) || 0;
  const rose = isRoseGift(gift);
  return ENGLISH_GIFT_RULES.find((r) => coins >= r.min && coins <= r.max && (r.rose === undefined || r.rose === rose)) || null;
}
