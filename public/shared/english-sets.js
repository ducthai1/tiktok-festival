// Tab Từ Vựng Tiếng Anh: quà đổi BỘ ĐỀ hoặc ĐỘ KHÓ cho cả phòng.
// Mọi món dùng để đổi đều dưới 20 xu. Dưới 20 xu chỉ có vài mức giá (1 / 5 / 10) nên gán THEO TỪNG MÓN QUÀ, không theo giá:
// Hoa hồng luôn là "Dễ"; các ô còn lại lấy lần lượt món rẻ nhất trong danh mục quà thật của phòng (ưu tiên món quen).
// Đã gán thì giữ nguyên — phòng có thêm quà mới cũng không xáo lại bảng người xem đã quen.
import { giftEmoji, SAMPLE_GIFTS } from './gift-tiers.js';
import { foldText } from './profanity-filter.js';

/** Đổi xong giữ trong bấy nhiêu câu rồi tự về mặc định (Tổng hợp · Vừa). Tặng lại thì đếm lại từ đầu. */
export const ENGLISH_HOLD_QUESTIONS = 20;
/** Giá cao nhất (xu) của một món quà được dùng để đổi đề. */
export const ENGLISH_MAX_COINS = 19;

export const ENGLISH_TARGETS = {
  // Trang 1: Đại trà & Dễ chơi (hiện 20s) - Mức 1 - 10 xu
  general:   { kind: 'reset', icon: '🌐', label: 'Tổng hợp' },
  easy:      { kind: 'level', icon: '😊', label: 'Dễ' },
  hard:      { kind: 'level', icon: '🔥', label: 'Khó' },
  dongvat:   { kind: 'set',   icon: '🐾', label: 'Động vật' },
  amthuc:    { kind: 'set',   icon: '🍕', label: 'Ẩm thực' },
  truonghoc: { kind: 'set',   icon: '🎒', label: 'Trường học' },
  dovat:     { kind: 'set',   icon: '🏠', label: 'Đồ vật' },

  // Trang 2: Thử thách & Đam mê (hiện 12s) - Mức 15 - 20 xu
  toeic:     { kind: 'set',   icon: '💼', label: 'TOEIC' },
  ielts:     { kind: 'set',   icon: '🎓', label: 'IELTS' },
  congnghe:  { kind: 'set',   icon: '💻', label: 'Công nghệ' },
  bongda:    { kind: 'set',   icon: '⚽', label: 'Thể thao' },
  yhoc:      { kind: 'set',   icon: '🩺', label: 'Y học' },
  dulich:    { kind: 'set',   icon: '✈️', label: 'Du lịch' },
  giaitri:   { kind: 'set',   icon: '🎬', label: 'Giải trí' }
};
export const ENGLISH_DEFAULTS = { set: { icon: '🌐', label: 'Chủ đề: Ngẫu nhiên' }, level: { icon: '⚖️', label: 'Độ khó: Thường' } };
export const ORDER = [
  'general', 'easy', 'hard', 'dongvat', 'amthuc', 'truonghoc', 'dovat',
  'toeic', 'ielts', 'congnghe', 'bongda', 'yhoc', 'dulich', 'giaitri'
];

// Từ điển song ngữ Anh - Việt & ánh xạ ID quà TikTok để không bao giờ bị lệch khi live
const BILINGUAL_ALIASES = {
  rose: ['rose', 'hoa hong', '5655'],
  '5655': ['rose', 'hoa hong', '5655'],
  'finger-heart': ['finger heart', 'ban tim', 'tim ngon tay', '5487'],
  '5487': ['finger heart', 'ban tim', 'tim ngon tay', '5487'],
  'donut-food': ['doughnut', 'donut', 'banh donut', '5879'],
  doughnut: ['doughnut', 'donut', 'banh donut', '5879'],
  '5879': ['doughnut', 'donut', 'banh donut', '5879'],
  'corgi-pet': ['corgi', 'cho corgi', 'gau truc'],
  corgi: ['corgi', 'cho corgi', 'gau truc'],
  'rocket-tech': ['rocket', 'ten lua'],
  '105781': ['spinning soccer', 'soccer', 'bong da', '105781'],
  '15231': ['love you so much', 'love you', '15231'],
  '15232': ["you're awesome", 'you are awesome', 'awesome', '15232'],
  '919346': ['welcome dallah', 'dallah', '919346'],
  '7934': ['heart me', '7934'],
  '5269': ['tiktok', '5269'],
  rosa: ['rosa', 'hoa rosa', '8913'],
  '8913': ['rosa', 'hoa rosa', '8913'],
  '6064': ['gg', 'gamepad', '6064'],
  sunglasses: ['sunglasses', 'kinh ram', 'kinh mat'],
  airplane: ['airplane', 'may bay', 'private jet']
};

// Từ khóa quà tặng tượng trưng đúng chuẩn TikTok cho từng ô (100% link ảnh thật đã kiểm tra 200 OK)
const PREFERRED = {
  general:   ['tiktok', '5269'],
  easy:      ['rose', 'hoa hong', '5655'],
  hard:      ['heart me', '7934'],
  dongvat:   ['corgi', 'gau truc', 'pet'],
  amthuc:    ['donut', 'doughnut', 'kem', 'ice cream', '5879'],
  truonghoc: ['awesome', 'truong hoc', 'hoc', '15232'],
  dovat:     ['rosa', 'hoa rosa', '8913'],
  toeic:     ['love you so much', 'love you', 'bravo', '15231'],
  ielts:     ['finger heart', 'ban tim', 'garland', '5487'],
  congnghe:  ['rocket', 'ten lua', 'gg', '6064'],
  bongda:    ['spinning soccer', 'soccer', 'bong da', 'weights', 'qua ta', '105781'],
  yhoc:      ['welcome dallah', 'dallah', 'candle', 'nen', '919346'],
  dulich:    ['airplane', 'may bay', 'private jet', 'du lich'],
  giaitri:   ['sunglasses', 'kinh ram', 'giai tri', 'phim']
};

export const nameKeys = (g) => {
  const keys = new Set();
  if (g?.id) keys.add(String(g.id).toLowerCase());
  if (g?.name) keys.add(foldText(g.name));
  if (g?.en) keys.add(foldText(g.en));
  for (const k of [...keys]) {
    if (BILINGUAL_ALIASES[k]) {
      for (const a of BILINGUAL_ALIASES[k]) keys.add(a);
    }
  }
  return [...keys];
};
const coinsOf = (g) => Number(g?.diamondsEach ?? g?.coins) || 0;
export const isRoseGift = (g) => String(g?.id || '') === '5655' || nameKeys(g).some((k) => PREFERRED.easy.includes(k));
export const isHeartGift = (g) => nameKeys(g).some((k) => PREFERRED.ielts.includes(k));

/** Cùng một món? Ưu tiên id quà TikTok; thiếu id thì so tên qua từ điển song ngữ. */
export function sameGift(a, b) {
  if (!a || !b) return false;
  if (a.id && b.id && String(a.id) === String(b.id)) return true;
  const keysA = nameKeys(a);
  const keysB = nameKeys(b);
  return keysA.some((k) => keysB.includes(k));
}

/**
 * Gán món quà cho từng ô. catalog: [{ id, name, coins, image, emoji? }] (danh mục thật của phòng, hoặc quà mẫu khi chưa có).
 * previous: bảng gán cũ — món cũ còn trong danh mục thì giữ nguyên ô.
 * → [{ to, icon, label, gift: { id, name, en, coins, image, emoji } }] theo thứ tự ô.
 */
export function assignEnglishGifts(catalog, previous = []) {
  // Gom quà phòng thật + bổ sung quà mẫu TikTok chính thức nếu phòng chưa đủ 14 món.
  const combined = [...(catalog || [])];
  for (const s of (SAMPLE_GIFTS || [])) {
    const existing = combined.find((c) => sameGift(c, s));
    if (!existing) {
      combined.push(s);
    } else if (coinsOf(existing) > ENGLISH_MAX_COINS && coinsOf(s) <= ENGLISH_MAX_COINS) {
      combined.push(s);
    }
  }
  const cheap = combined.filter((g) => coinsOf(g) >= 1 && coinsOf(g) <= ENGLISH_MAX_COINS);
  const used = [];
  const out = new Map();

  for (const old of previous) {
    const still = cheap.find((g) => sameGift(g, old.gift));
    if (still && ENGLISH_TARGETS[old.to]) {
      out.set(old.to, still);
      used.push(still);
    }
  }

  let free = cheap.filter((g) => !used.includes(g))
    .sort((a, b) => coinsOf(a) - coinsOf(b) || Boolean(b.image) - Boolean(a.image) || String(a.name).localeCompare(String(b.name)));

  // Ưu tiên gán đúng món quà tượng trưng theo bảng PREFERRED
  for (const to of ORDER) {
    if (out.has(to)) continue;
    const prefKeys = PREFERRED[to] || [];
    const match = free.find((g) => nameKeys(g).some((k) => prefKeys.some((p) => k.includes(p))));
    if (match) {
      out.set(to, match);
      free.splice(free.indexOf(match), 1);
    }
  }

  // Các ô còn lại lấy quà rẻ nhất còn trống
  for (const to of ORDER) {
    if (!out.has(to) && free.length) {
      out.set(to, free.shift());
    }
  }

  return ORDER.filter((to) => out.has(to)).map((to) => {
    const g = out.get(to);
    return {
      to,
      icon: ENGLISH_TARGETS[to].icon,
      label: ENGLISH_TARGETS[to].label,
      gift: {
        id: String(g.id || ''),
        name: g.name,
        en: g.en || '',
        coins: coinsOf(g) || 1,
        image: g.image || '',
        emoji: g.emoji || giftEmoji(g.name)
      }
    };
  });
}

/** Sự kiện quà → ô được đổi (hoặc null nếu món này không nằm trong bảng). */
export function englishTargetFor(assignments, gift) {
  return assignments.find((a) => sameGift(a.gift, gift))?.to || null;
}
