// Tab Từ Vựng Tiếng Anh: quà đổi BỘ ĐỀ hoặc ĐỘ KHÓ cho cả phòng.
// Mọi món dùng để đổi đều dưới 20 xu. Dưới 20 xu chỉ có vài mức giá (1 / 5 / 10) nên gán THEO TỪNG MÓN QUÀ, không theo giá:
// Hoa hồng luôn là "Dễ"; các ô còn lại lấy lần lượt món rẻ nhất trong danh mục quà thật của phòng (ưu tiên món quen).
// Đã gán thì giữ nguyên — phòng có thêm quà mới cũng không xáo lại bảng người xem đã quen.
import { giftEmoji } from './gift-tiers.js';
import { foldText } from './profanity-filter.js';

/** Đổi xong giữ trong bấy nhiêu câu rồi tự về mặc định (Tổng hợp · Vừa). Tặng lại thì đếm lại từ đầu. */
export const ENGLISH_HOLD_QUESTIONS = 20;
/** Giá cao nhất (xu) của một món quà được dùng để đổi đề. */
export const ENGLISH_MAX_COINS = 19;

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
const ORDER = ['easy', 'hard', 'toeic', 'ielts', 'yhoc', 'bongda', 'congnghe'];

// Món quen, ai cũng thấy ở hàng quà rẻ — được chọn trước (tên tiếng Anh / tiếng Việt, đã gập dấu).
const ROSE = ['rose', 'hoa hong'];
const FAMILIAR = [['tiktok'], ['gg'], ['ice cream cone', 'ice cream', 'kem', 'oc que kem'], ['finger heart', 'ban tim', 'tim ngon tay'],
  ['rosa'], ['heart me'], ['thumbs up'], ['love you']];

const nameKeys = (g) => [foldText(g?.name), foldText(g?.en)].filter(Boolean);
const coinsOf = (g) => Number(g?.diamondsEach ?? g?.coins) || 0;
export const isRoseGift = (g) => String(g?.id || '') === '5655' || nameKeys(g).some((k) => ROSE.includes(k));
const familiarRank = (g) => {
  const i = FAMILIAR.findIndex((names) => nameKeys(g).some((k) => names.includes(k)));
  return i < 0 ? FAMILIAR.length : i;
};

/** Cùng một món? Ưu tiên id quà TikTok; thiếu id thì so tên. */
export function sameGift(a, b) {
  if (a?.id && b?.id && !/^[a-z-]+$/.test(String(a.id)) && !/^[a-z-]+$/.test(String(b.id))) return String(a.id) === String(b.id);
  const keys = new Set(nameKeys(a));
  return nameKeys(b).some((k) => keys.has(k));
}

/**
 * Gán món quà cho từng ô. catalog: [{ id, name, coins, image, emoji? }] (danh mục thật của phòng, hoặc quà mẫu khi chưa có).
 * previous: bảng gán cũ — món cũ còn trong danh mục thì giữ nguyên ô.
 * → [{ to, gift: { id, name, coins, image, emoji } }] theo thứ tự ô.
 */
export function assignEnglishGifts(catalog, previous = []) {
  const cheap = (catalog || []).filter((g) => coinsOf(g) >= 1 && coinsOf(g) <= ENGLISH_MAX_COINS);
  const used = [];
  const out = new Map();
  for (const old of previous) {
    const still = cheap.find((g) => sameGift(g, old.gift));
    if (still && ENGLISH_TARGETS[old.to]) {
      out.set(old.to, still);
      used.push(still);
    }
  }
  const free = cheap.filter((g) => !used.includes(g))
    // rẻ trước → món quen trước → món có ảnh thật trước (ô không có ảnh khó nhận ra trên màn hình)
    .sort((a, b) => coinsOf(a) - coinsOf(b) || familiarRank(a) - familiarRank(b) || Boolean(b.image) - Boolean(a.image)
      || String(a.name).localeCompare(String(b.name)));
  if (!out.has('easy')) {
    const rose = free.find(isRoseGift);
    if (rose) {
      out.set('easy', rose);
      free.splice(free.indexOf(rose), 1);
    }
  }
  for (const to of ORDER) if (!out.has(to) && to !== 'easy' && free.length) out.set(to, free.shift());
  return ORDER.filter((to) => out.has(to)).map((to) => {
    const g = out.get(to);
    return { to, gift: { id: String(g.id || ''), name: g.name, coins: coinsOf(g), image: g.image || '', emoji: g.emoji || giftEmoji(g.name) } };
  });
}

/** Sự kiện quà → ô được đổi (hoặc null nếu món này không nằm trong bảng). */
export function englishTargetFor(assignments, gift) {
  return assignments.find((a) => sameGift(a.gift, gift))?.to || null;
}
