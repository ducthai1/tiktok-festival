// Bậc quà TikTok — dùng chung cho server (chọn hiệu ứng) và màn hình (bảng "Cách tham gia").
// Hiệu ứng theo GIÁ CỦA MỘT MÓN (xu), không theo tổng: 1 Sư tử khác hẳn 30.000 Hoa hồng. Số lượng
// (combo) chỉ làm hiệu ứng dày hơn. Giá thật lấy từ chính sự kiện quà TikTok gửi (diamondCount),
// nên quà mới / giá theo vùng vẫn vào đúng bậc. Ranh giới bậc đặt ở các mốc giá phổ biến:
//   1   (1–9 xu)        Hoa hồng, TikTok, GG, Kem, Bắn tim
//   2   (10–98)         Rosa, Nước hoa, Bánh donut
//   3   (99–498)        Mũ, Tay tim, Pháo giấy, Kính râm, Corgi
//   4   (499–4.999)     Súng tiền, Thiên nga, Dải ngân hà, Pháo hoa, Mô tô, Máy bay riêng
//   5   (5.000–19.999)  Drama Queen, Siêu xe, Liên hành tinh, Chim ưng
//   6   (≥ 20.000)      Tên lửa, Sư tử, Vũ trụ TikTok

export const TIER_MIN = [1, 10, 99, 499, 5000, 20000];

/** Khoảng giá (kc) của một bậc, viết gọn cho bảng chú thích: "1–9", "499–4,9K", "20K+". */
export function tierRangeLabel(tier) {
  const fmt = (n) => (n >= 1000 ? `${String(Math.floor(n / 100) / 10).replace('.', ',')}K` : String(n)); // làm tròn XUỐNG: 4.999 → 4,9K
  const min = TIER_MIN[tier - 1];
  const next = TIER_MIN[tier];
  return next ? `${fmt(min)}–${fmt(next - 1)}` : `${fmt(min)}+`;
}

/** Bậc 1..6 theo giá một món (xu / diamondCount của TikTok). */
export function giftTier(coinsEach) {
  const coins = Math.max(1, Number(coinsEach) || 1);
  let tier = 1;
  TIER_MIN.forEach((min, i) => { if (coins >= min) tier = i + 1; });
  return tier;
}

// Quà mẫu cho chế độ thử và bảng chú thích (giá phổ biến; có thể lệch theo vùng). Ảnh là ảnh CHÍNH THỨC
// của TikTok trên máy chủ ảnh của TikTok (tiktokcdn.com) — người xem nhận ra đúng món để tặng. Nối live thì
// quà nhận được (tên, giá, ảnh thật của phòng) được gom thêm vào danh mục.
const CDN = 'https://p16-webcast.tiktokcdn.com/img/';
export const SAMPLE_GIFTS = [
  { id: 'rose', name: 'Hoa hồng', en: 'Rose', emoji: '🌹', coins: 1, image: `${CDN}maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.webp` },
  { id: 'finger-heart', name: 'Bắn tim', en: 'Finger Heart', emoji: '🫰', coins: 5, image: `${CDN}maliva/webcast-va/a4c4dc437fd3a6632aba149769491f49.png~tplv-obj.webp` },
  { id: 'rosa', name: 'Rosa', en: 'Rosa', emoji: '💐', coins: 10, image: `${CDN}maliva/webcast-va/eb77ead5c3abb6da6034d3cf6cfeb438~tplv-obj.webp` },
  { id: 'doughnut', name: 'Bánh donut', en: 'Doughnut', emoji: '🍩', coins: 30, image: `${CDN}maliva/webcast-va/4e7ad6bdf0a1d860c538f38026d4e812~tplv-obj.webp` },
  { id: 'cap', name: 'Mũ lưỡi trai', en: 'Cap', emoji: '🧢', coins: 99, image: `${CDN}maliva/webcast-va/6c2ab2da19249ea570a2ece5e3377f04~tplv-obj.webp` },
  { id: 'corgi', name: 'Corgi', en: 'Corgi', emoji: '🐶', coins: 299, image: `${CDN}maliva/webcast-va/148eef0884fdb12058d1c6897d1e02b9~tplv-obj.webp` },
  { id: 'galaxy', name: 'Dải ngân hà', en: 'Galaxy', emoji: '🌌', coins: 1000, image: `${CDN}maliva/webcast-va/resource/79a02148079526539f7599150da9fd28.png~tplv-obj.webp` },
  { id: 'fireworks', name: 'Pháo hoa', en: 'Fireworks', emoji: '🎆', coins: 1088, image: `${CDN}maliva/webcast-va/9494c8a0bc5c03521ef65368e59cc2b8~tplv-obj.webp` },
  { id: 'private-jet', name: 'Máy bay riêng', en: 'Private Jet', emoji: '✈️', coins: 4888, image: `${CDN}alisg/webcast-sg/airplane_icon_gold.png~tplv-obj.webp` },
  { id: 'sports-car', name: 'Siêu xe', en: 'Sports Car', emoji: '🏎️', coins: 7000, image: `${CDN}maliva/webcast-va/resource/201304005bf8f86b533b97ffa88f1abe.png~tplv-obj.webp` },
  { id: 'interstellar', name: 'Liên hành tinh', en: 'Interstellar', emoji: '🚀', coins: 10000, image: `${CDN}maliva/webcast-va/8520d47b59c202a4534c1560a355ae06~tplv-obj.webp` },
  { id: 'falcon', name: 'Chim ưng', en: 'Falcon', emoji: '🦅', coins: 10999, image: `${CDN}maliva/webcast-va/6026505eea9b9bce071dd699253abf6a~tplv-obj.webp` },
  { id: 'lion', name: 'Sư tử', en: 'Lion', emoji: '🦁', coins: 29999, image: `${CDN}maliva/webcast-va/4fb89af2082a290b37d704e20f4fe729~tplv-obj.webp` },
  { id: 'universe', name: 'Vũ trụ TikTok', en: 'TikTok Universe', emoji: '🪐', coins: 44999, image: `${CDN}maliva/webcast-va/8f471afbcebfda3841a6cc515e381f58~tplv-obj.webp` }
];

/**
 * Gắn ảnh/giá/tên thật từ danh mục quà TikTok (đã lưu lúc nối live) vào quà mẫu, để chạy thử cũng
 * hiện đúng ảnh quà người xem nhìn thấy. Khớp theo tên tiếng Anh hoặc tên Việt.
 */
export function withCatalogImages(samples, catalog) {
  const byName = new Map((catalog || []).map((g) => [String(g.name).toLowerCase(), g]));
  return samples.map((s) => {
    const real = byName.get(s.en.toLowerCase()) || byName.get(s.name.toLowerCase());
    return real ? { ...s, image: real.image || s.image, coins: real.coins || s.coins, realName: real.name } : s;
  });
}

// Biểu tượng dự phòng khi quà không có ảnh (tên tiếng Anh/Việt thường gặp → emoji)
const EMOJI = [[/rose|hồng/i, '🌹'], [/heart|tim/i, '💖'], [/donut|doughnut/i, '🍩'], [/corgi|dog|chó/i, '🐶'], [/galaxy|ngân hà/i, '🌌'],
  [/firework|pháo/i, '🎆'], [/car|xe/i, '🏎️'], [/rocket|tên lửa/i, '🚀'], [/lion|sư tử/i, '🦁'], [/universe|vũ trụ/i, '🪐'],
  [/perfume|nước hoa/i, '🧴'], [/cap|mũ/i, '🧢'], [/glass|kính/i, '🕶️'], [/swan|thiên nga/i, '🦢'], [/panda/i, '🐼'], [/ice cream|kem/i, '🍦']];
export function giftEmoji(name) {
  const hit = EMOJI.find(([re]) => re.test(String(name || '')));
  return hit ? hit[1] : '🎁';
}

// Món làm ICON cho từng bậc trên bảng "Cách tham gia": giá GẦN MỐC TRÊN của bậc (tặng món này là chắc vào bậc đó)
// + hình dễ nhận ra ở cỡ nhỏ + quà cố định lâu năm của TikTok (bảng quà VN có, không phải quà sự kiện/vùng khác).
// Bậc 1 giữ Hoa hồng (1 xu) — món tiêu biểu nhất của phiên tặng quà. Bậc 6 không có mốc trên → Sư tử, hình rõ nhất.
// Tinh vân Rosa (15.000) gần mốc bậc 5 hơn nhưng nhỏ lại trông như bông hồng bậc 1 → dùng Chim ưng.
const LEGEND_PICK = { 1: 'Rose', 2: 'Doughnut', 3: 'Corgi', 4: 'Private Jet', 5: 'Falcon', 6: 'Lion' };
const PICK_BY_EN = new Map(SAMPLE_GIFTS.map((g) => [g.en.toLowerCase(), g]));
const isPick = (g, tier) => {
  const pick = PICK_BY_EN.get(String(LEGEND_PICK[tier]).toLowerCase());
  if (!pick) return false;
  const names = [g.en, g.name, g.realName].filter(Boolean).map((n) => String(n).toLowerCase());
  return names.includes(pick.en.toLowerCase()) || names.includes(pick.name.toLowerCase());
};

/**
 * Quà đại diện cho mỗi bậc: món chọn sẵn (LEGEND_PICK) đứng đầu — nếu giá thật của phòng vẫn nằm trong bậc đó —
 * rồi tới các món giá gần mốc trên của bậc.
 * @param {{name:string, coins:number, image?:string}[]} catalog danh mục quà của phòng (hoặc SAMPLE_GIFTS)
 * @returns {{tier:number, gifts:{name:string, coins:number, image?:string, emoji:string}[]}[]}
 */
export function tierRepresentatives(catalog, perTier = 2) {
  const list = (catalog && catalog.length ? catalog : SAMPLE_GIFTS).filter((g) => g && g.coins > 0);
  return TIER_MIN.map((_, i) => {
    const tier = i + 1;
    // món chọn sẵn → có ảnh thật của TikTok → giá cao trong bậc (gần mốc trên)
    const gifts = list.filter((g) => giftTier(g.coins) === tier)
      .sort((a, b) => isPick(b, tier) - isPick(a, tier) || Boolean(b.image) - Boolean(a.image) || b.coins - a.coins).slice(0, perTier)
      .map((g) => ({ name: g.name, coins: g.coins, image: g.image || '', emoji: g.emoji || giftEmoji(g.name) }));
    return { tier, gifts };
  });
}
