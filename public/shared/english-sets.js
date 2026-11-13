// Tab Từ Vựng Tiếng Anh: quà đổi BỘ ĐỀ hoặc ĐỘ KHÓ cho cả phòng. Mọi món tối đa 20 xu.
// Mỗi ô gắn CỐ ĐỊNH một món quà có thật ở TikTok Việt Nam, ghi ĐÚNG giá thật (public/shared/tiktok-gifts-vn.js).
// Trước 13/11/2026 bảng lấy giá từ quà mẫu bị sửa sai (vd "You're awesome" ghi 5 xu, thật 1 xu) → người xem tặng món 1 xu
// mà đổi được ô "5 xu". Giờ: giá trên bảng = giá thật, và máy chủ còn chặn: món nhận được rẻ hơn giá ghi trên bảng thì
// KHÔNG đổi (TikTok có món trùng tên khác giá, vd "Love you" 1 xu và 199 xu) — chỉ cảm ơn.
import { giftEmoji } from './gift-tiers.js';
import { foldText } from './profanity-filter.js';
import { VN_GIFTS_UP_TO_20 } from './tiktok-gifts-vn.js';

/** Đổi xong giữ trong bấy nhiêu câu rồi tự về mặc định (Tổng hợp · Vừa). Tặng lại thì đếm lại từ đầu. */
export const ENGLISH_HOLD_QUESTIONS = 20;
/** Giá cao nhất (xu) của một món quà được dùng để đổi đề. */
export const ENGLISH_MAX_COINS = 20;

/**
 * Ô → món quà (tên đúng như TikTok VN). Giá lấy từ bảng giá thật, không ghi tay ở đây.
 * Vùng VN tới 20 xu chỉ có các mức 1 / 2 / 5 / 6 / 9 / 10 / 15 / 20 xu; chỉ 4 món 15 xu → 3 ô trang 2 dùng món 20 xu (13/11/2026).
 * Muốn đổi món / giá: sửa tên ở đây (phải có trong tiktok-gifts-vn.js), chạy npm run gate.
 */
export const ENGLISH_GIFT_PLAN = {
  general: 'TikTok', easy: 'Rose', hard: 'Heart Me', dongvat: 'Brown Paw', amthuc: 'Peach', truonghoc: 'Finger Heart', dovat: 'Rosa',
  toeic: 'Bravo!', ielts: 'Kudos for My Star', congnghe: 'Lyric Mail', bongda: 'Rage Mode', yhoc: 'Perfume',
  dulich: 'Live Up Earth', giaitri: 'LOL'
};

export const ENGLISH_TARGETS = {
  // Trang 1: Đại trà & Dễ chơi (hiện 20s) — quà 1 / 5 / 10 xu
  general:   { kind: 'reset', icon: '🌐', label: 'Tổng hợp' },
  easy:      { kind: 'level', icon: '😊', label: 'Dễ' },
  hard:      { kind: 'level', icon: '🔥', label: 'Khó' },
  dongvat:   { kind: 'set',   icon: '🐾', label: 'Động vật' },
  amthuc:    { kind: 'set',   icon: '🍕', label: 'Ẩm thực' },
  truonghoc: { kind: 'set',   icon: '🎒', label: 'Trường học' },
  dovat:     { kind: 'set',   icon: '🏠', label: 'Đồ vật' },

  // Trang 2: Thử thách & Đam mê (hiện 12s) — quà 15 / 20 xu
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

const coinsOf = (g) => Number(g?.diamondsEach ?? g?.coins) || 0;
const sameName = (a, b) => Boolean(a && b) && foldText(a) === foldText(b);
// Mã ảnh quà (32 ký tự hex trong link ảnh TikTok) — giống nhau dù TikTok gửi tên tiếng Anh hay tiếng Việt
const imageKey = (url) => String(url || '').match(/[0-9a-f]{32}/)?.[0] || '';
const sameImage = (a, b) => Boolean(imageKey(a)) && imageKey(a) === imageKey(b);
const sameGift = (planned, g) => sameName(planned.name, g.name) || sameName(planned.name, g.en) || sameImage(planned.image, g.image || g.pictureUrl);

/**
 * Gán quà cho từng ô theo ENGLISH_GIFT_PLAN. catalog: quà thật phòng đã nhận [{ id, name, coins, image }] — có món cùng tên
 * thì lấy id + ảnh + GIÁ TikTok báo (TikTok đổi giá thì bảng hiện giá mới); không có thì dùng bảng giá thật vùng VN.
 * → [{ to, icon, label, gift: { id, name, en, coins, image, emoji } }] theo thứ tự ô.
 */
export function assignEnglishGifts(catalog = []) {
  return ORDER.map((to) => {
    const want = VN_GIFTS_UP_TO_20.find((g) => g.name === ENGLISH_GIFT_PLAN[to]);
    if (!want) return null;
    // phòng đã nhận món cùng tên (tối đa 20 xu) → theo id + giá TikTok báo; món trùng tên mà trên 20 xu là món khác → bỏ
    const room = (catalog || []).find((g) => sameGift(want, g) && coinsOf(g) >= 1 && coinsOf(g) <= ENGLISH_MAX_COINS);
    return {
      to,
      icon: ENGLISH_TARGETS[to].icon,
      label: ENGLISH_TARGETS[to].label,
      gift: {
        id: String(room?.id || ''),
        name: want.name,
        en: want.name,
        coins: room ? coinsOf(room) : want.coins,
        image: room?.image || want.image,
        emoji: giftEmoji(want.name)
      }
    };
  }).filter(Boolean);
}

/**
 * Sự kiện quà → ô được đổi, hoặc null (món không có trên bảng, hoặc RẺ HƠN giá ghi trên bảng — món trùng tên khác giá).
 * Giá lấy từ chính sự kiện TikTok gửi (diamondsEach) nên không bao giờ đổi được ô đắt bằng món rẻ.
 */
export function englishTargetFor(assignments, gift) {
  if (!gift) return null;
  const hit = assignments.find((a) => (a.gift.id && gift.id && a.gift.id === String(gift.id)) || sameGift(a.gift, gift));
  if (!hit || coinsOf(gift) < hit.gift.coins) return null;
  return hit.to;
}
