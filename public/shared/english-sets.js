// Tab Từ Vựng Tiếng Anh: quà đổi BỘ ĐỀ hoặc ĐỘ KHÓ cho cả phòng. Mọi món tối đa 30 xu.
// Mỗi ô gắn CỐ ĐỊNH một món quà có thật ở TikTok Việt Nam, ghi ĐÚNG giá thật (public/shared/tiktok-gifts-vn.js).
// Trước 13/11/2026 bảng lấy giá từ quà mẫu bị sửa sai (vd "You're awesome" ghi 5 xu, thật 1 xu) → người xem tặng món 1 xu
// mà đổi được ô "5 xu". Giờ: giá trên bảng = giá thật, và máy chủ còn chặn: món nhận được rẻ hơn giá ghi trên bảng thì
// KHÔNG đổi (TikTok có món trùng tên khác giá, vd "Love you" 1 xu và 199 xu) — chỉ cảm ơn.
import { giftEmoji } from './gift-tiers.js';
import { foldText } from './profanity-filter.js';
import { VN_GIFTS_UP_TO_30 } from './tiktok-gifts-vn.js';

/** Đổi xong giữ trong bấy nhiêu câu rồi tự về mặc định (Tổng hợp · Vừa). Tặng lại thì đếm lại từ đầu. */
export const ENGLISH_HOLD_QUESTIONS = 20;
/** Luyện nghe (quà 30 xu): bấy nhiêu câu nghe giọng bản xứ rồi gõ lại từ — không bị rút ngắn khi nhiều người chờ đổi bộ. */
export const LISTEN_QUESTIONS = 40;
/** Luyện nghe chạy ít nhất bấy nhiêu câu: quà đổi bộ khác trong lúc đó chờ đủ số câu này mới đổi (chủ kênh chốt 13/11/2026). */
export const LISTEN_MIN_QUESTIONS = 20;
/** Giá cao nhất (xu) của một món quà được dùng để đổi đề. */
export const ENGLISH_MAX_COINS = 30;

/**
 * Ô → món quà (tên đúng như TikTok VN). Giá lấy từ bảng giá thật, không ghi tay ở đây.
 * CHỈ dùng món có trong hộp quà mà mọi người xem đều thấy (panel: true ở tiktok-gifts-vn.js — test kiểm tra), trừ món chủ kênh
 * đã xác nhận thấy trong hộp quà của phòng (STREAMER_SEEN_GIFTS). 13/11 từng gán Heart Me, Brown Paw, Capybara, Tiny Diny, Squirrel,
 * Cheer You Up — có trên trang liệt kê quà nhưng KHÔNG có trong hộp quà → người xem không tìm thấy để tặng.
 * Muốn đổi món / giá: sửa tên ở đây (phải có trong tiktok-gifts-vn.js), chạy npm run gate.
 */
export const ENGLISH_GIFT_PLAN = {
  general: 'TikTok', easy: 'Rose', hard: "You're awesome", dongvat: 'Finger Heart', amthuc: 'Peach', truonghoc: 'Rosa', nghe: 'Doughnut',
  // trang 2 (chủ kênh 14/11/2026: hạ giá về 10 xu): hộp quà chỉ có 6 món 10 xu ai cũng thấy (Rosa dùng ở trang 1)
  toeic: 'Friendship Necklace', ielts: 'I Like What I See', congnghe: 'Curious Twinkle', bongda: 'Spinning Soccer', yhoc: 'Slow motion',
  dulich: 'Journey Pass', giaitri: 'Divine Fingers'
};
/** Món không có trong hộp quà chung (panel:false) nhưng chủ kênh đã thấy trong hộp quà của phòng (ảnh chụp 14/11/2026). */
export const STREAMER_SEEN_GIFTS = ['Peach'];

export const ENGLISH_TARGETS = {
  // Trang 1: Đại trà & Dễ chơi (hiện 20s) — quà 1 / 5 / 10 / 30 xu (Đồ vật đã gộp vào Tổng hợp)
  general:   { kind: 'reset', icon: '🌐', label: 'Tổng hợp' },
  easy:      { kind: 'level', icon: '😊', label: 'Dễ' },
  hard:      { kind: 'level', icon: '🔥', label: 'Khó' },
  dongvat:   { kind: 'set',   icon: '🐾', label: 'Động vật' },
  amthuc:    { kind: 'set',   icon: '🍕', label: 'Ẩm thực' },
  truonghoc: { kind: 'set',   icon: '🎒', label: 'Trường học' },
  // 🎧 nghe từ (giọng Mỹ / Anh / Úc) rồi gõ lại — chỉ hiện khi giọng đọc tiếng Anh đang chạy tốt (english-switcher.js)
  nghe:      { kind: 'listen', icon: '🎧', label: 'Luyện nghe' },

  // Trang 2: Thử thách & Đam mê (hiện 12s) — quà 5 / 6 / 10 xu
  toeic:     { kind: 'set',   icon: '💼', label: 'TOEIC' },
  ielts:     { kind: 'set',   icon: '🎓', label: 'IELTS' },
  congnghe:  { kind: 'set',   icon: '💻', label: 'Công nghệ' },
  bongda:    { kind: 'set',   icon: '⚽', label: 'Thể thao' },
  yhoc:      { kind: 'set',   icon: '🩺', label: 'Y học' },
  dulich:    { kind: 'set',   icon: '✈️', label: 'Du lịch' },
  giaitri:   { kind: 'set',   icon: '🎬', label: 'Giải trí' }
};
export const ENGLISH_DEFAULTS = { set: { icon: '🌐', label: 'Chủ đề: Ngẫu nhiên' }, level: { icon: '⚖️', label: 'Độ khó: Thường' } };
// thứ tự ô trên bảng quà (7 ô / trang): trang 1 có TOEIC, IELTS (Động vật, Trường học sang trang 2)
export const ORDER = [
  'general', 'easy', 'hard', 'amthuc', 'toeic', 'ielts', 'nghe',
  'dongvat', 'truonghoc', 'congnghe', 'bongda', 'yhoc', 'dulich', 'giaitri'
];
// ĐỔI ORDER thì tăng số này: bảng quà chủ kênh đã lưu (data/settings.json) được xếp lại MỘT lần theo thứ tự mới lúc khởi động (app.js)
export const ORDER_VERSION = 2;
/** Xếp luật quà theo thứ tự ô ORDER (giữ nguyên quà / số câu; nhiều món cùng một ô giữ thứ tự cũ). */
export const sortByOrder = (rules) => rules.map((r, i) => [r, i])
  .sort(([a, i], [b, j]) => ((ORDER.indexOf(a.to) + 1 || 99) - (ORDER.indexOf(b.to) + 1 || 99)) || i - j).map(([r]) => r);

const coinsOf = (g) => Number(g?.diamondsEach ?? g?.coins) || 0;
const sameName = (a, b) => Boolean(a && b) && foldText(a) === foldText(b);
// Mã ảnh quà (32 ký tự hex trong link ảnh TikTok) — giống nhau dù TikTok gửi tên tiếng Anh hay tiếng Việt
const imageKey = (url) => String(url || '').match(/[0-9a-f]{32}/)?.[0] || '';
const sameImage = (a, b) => Boolean(imageKey(a)) && imageKey(a) === imageKey(b);
const sameGift = (planned, g) => sameName(planned.name, g.name) || sameName(planned.name, g.en) || sameImage(planned.image, g.image || g.pictureUrl);

/** Số câu mặc định của một ô khi luật quà không ghi: Luyện nghe 40, bộ đề / độ khó 20. */
export const defaultQuestionsFor = (to) => (ENGLISH_TARGETS[to]?.kind === 'listen' ? LISTEN_QUESTIONS : ENGLISH_HOLD_QUESTIONS);

function fromTable(name) {
  const named = VN_GIFTS_UP_TO_30.filter((g) => g.name === name);
  const g = named.find((x) => x.panel) || named[0];
  return g && { id: g.id, name: g.name, coins: g.coins, image: g.image };
}

/**
 * Luật quà mặc định (khi chưa chỉnh ở tab 🎁 Quà của trang điều khiển): mỗi ô một món theo ENGLISH_GIFT_PLAN, cộng một luật
 * KHUYẾN MÃI tắt sẵn — Heart Me 1 xu (quà tham gia fan club) → Luyện nghe 10 câu.
 * Luật: { to, gift: { id, name, coins, image }, questions, enabled }.
 */
export function defaultEnglishRules() {
  const rules = ORDER.map((to) => {
    const gift = fromTable(ENGLISH_GIFT_PLAN[to]);
    return gift && { to, gift, questions: defaultQuestionsFor(to), enabled: true };
  }).filter(Boolean);
  const heart = fromTable('Heart Me');
  if (heart) rules.splice(ORDER.indexOf('nghe') + 1, 0, { to: 'nghe', gift: heart, questions: 10, enabled: false });
  return rules;
}

/**
 * Luật đang bật → bảng hiện trên màn hình + dùng để nhận quà: [{ to, icon, label, questions, gift: { id, name, en, coins, image, emoji } }].
 * Giá lấy từ luật (bảng giá thật TikTok lúc chọn quà) — KHÔNG lấy từ danh mục quà của phòng (13/11 danh mục có giá sai từ quà thử).
 */
export function buildEnglishRules(rules) {
  return (rules || []).filter((r) => r && r.enabled !== false && ENGLISH_TARGETS[r.to] && r.gift?.name).map((r) => ({
    to: r.to,
    icon: ENGLISH_TARGETS[r.to].icon,
    label: ENGLISH_TARGETS[r.to].label,
    questions: Number(r.questions) || defaultQuestionsFor(r.to),
    gift: { id: String(r.gift.id || ''), name: r.gift.name, en: r.gift.name, coins: Number(r.gift.coins) || 1, image: r.gift.image || '',
      emoji: giftEmoji(r.gift.name) }
  }));
}

/** Bảng mặc định (giữ cho code / test cũ). */
export function assignEnglishGifts() {
  return buildEnglishRules(defaultEnglishRules());
}

/**
 * Sự kiện quà → luật được áp dụng, hoặc null (món không có trên bảng, hoặc RẺ HƠN giá ghi trên bảng — món trùng tên khác giá).
 * Giá lấy từ chính sự kiện TikTok gửi (diamondsEach) nên không bao giờ đổi được ô đắt bằng món rẻ.
 */
export function englishRuleFor(assignments, gift) {
  if (!gift) return null;
  const hit = assignments.find((a) => (a.gift.id && gift.id && a.gift.id === String(gift.id)))
    || assignments.find((a) => sameGift(a.gift, gift));
  if (!hit || coinsOf(gift) < hit.gift.coins) return null;
  return hit;
}

export function englishTargetFor(assignments, gift) {
  return englishRuleFor(assignments, gift)?.to || null;
}
