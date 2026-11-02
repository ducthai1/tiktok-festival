// Bậc quà TikTok — dùng chung cho server (chọn hiệu ứng) và màn hình (bảng "Cách tham gia").
// Hiệu ứng theo GIÁ CỦA MỘT MÓN (xu), không theo tổng: 1 Sư tử khác hẳn 30.000 Hoa hồng. Số lượng
// (combo) chỉ làm hiệu ứng dày hơn. Giá thật lấy từ chính sự kiện quà TikTok gửi (diamondCount),
// nên quà mới / giá theo vùng vẫn vào đúng bậc. Ranh giới bậc đặt ở các mốc giá phổ biến:
//   1   (1–9 xu)        Hoa hồng, TikTok, GG, Kem, Bắn tim
//   2   (10–98)         Rosa, Nước hoa, Bánh donut
//   3   (99–498)        Mũ, Tay tim, Pháo giấy, Kính râm, Corgi
//   4   (499–4.999)     Súng tiền, Thiên nga, Dải ngân hà, Pháo hoa, Mô tô
//   5   (5.000–19.999)  Drama Queen, Siêu xe, Liên hành tinh
//   6   (≥ 20.000)      Tên lửa, Sư tử, Vũ trụ TikTok

export const TIER_MIN = [1, 10, 99, 499, 5000, 20000];

/** Bậc 1..6 theo giá một món (xu / diamondCount của TikTok). */
export function giftTier(coinsEach) {
  const coins = Math.max(1, Number(coinsEach) || 1);
  let tier = 1;
  TIER_MIN.forEach((min, i) => { if (coins >= min) tier = i + 1; });
  return tier;
}

// Quà mẫu cho chế độ thử và bảng chú thích khi chưa nối live (giá phổ biến; có thể lệch theo vùng —
// khi live thật, màn hình dùng danh mục quà của chính phòng đó, có ảnh thật).
export const SAMPLE_GIFTS = [
  { id: 'rose', name: 'Hoa hồng', emoji: '🌹', coins: 1 },
  { id: 'finger-heart', name: 'Bắn tim', emoji: '🫰', coins: 5 },
  { id: 'rosa', name: 'Rosa', emoji: '💐', coins: 10 },
  { id: 'doughnut', name: 'Bánh donut', emoji: '🍩', coins: 30 },
  { id: 'hand-hearts', name: 'Tay tim', emoji: '🫶', coins: 100 },
  { id: 'corgi', name: 'Corgi', emoji: '🐶', coins: 299 },
  { id: 'galaxy', name: 'Dải ngân hà', emoji: '🌌', coins: 1000 },
  { id: 'fireworks', name: 'Pháo hoa', emoji: '🎆', coins: 1088 },
  { id: 'sports-car', name: 'Siêu xe', emoji: '🏎️', coins: 7000 },
  { id: 'rocket', name: 'Tên lửa', emoji: '🚀', coins: 20000 },
  { id: 'lion', name: 'Sư tử', emoji: '🦁', coins: 29999 },
  { id: 'universe', name: 'Vũ trụ', emoji: '🪐', coins: 44999 }
];

// Biểu tượng dự phòng khi quà không có ảnh (tên tiếng Anh/Việt thường gặp → emoji)
const EMOJI = [[/rose|hồng/i, '🌹'], [/heart|tim/i, '💖'], [/donut|doughnut/i, '🍩'], [/corgi|dog|chó/i, '🐶'], [/galaxy|ngân hà/i, '🌌'],
  [/firework|pháo/i, '🎆'], [/car|xe/i, '🏎️'], [/rocket|tên lửa/i, '🚀'], [/lion|sư tử/i, '🦁'], [/universe|vũ trụ/i, '🪐'],
  [/perfume|nước hoa/i, '🧴'], [/cap|mũ/i, '🧢'], [/glass|kính/i, '🕶️'], [/swan|thiên nga/i, '🦢'], [/panda/i, '🐼'], [/ice cream|kem/i, '🍦']];
export function giftEmoji(name) {
  const hit = EMOJI.find(([re]) => re.test(String(name || '')));
  return hit ? hit[1] : '🎁';
}

/**
 * 2 quà đại diện cho mỗi bậc (rẻ nhất trong bậc = hay được tặng nhất).
 * @param {{name:string, coins:number, image?:string}[]} catalog danh mục quà của phòng (hoặc SAMPLE_GIFTS)
 * @returns {{tier:number, gifts:{name:string, coins:number, image?:string, emoji:string}[]}[]}
 */
export function tierRepresentatives(catalog, perTier = 2) {
  const list = (catalog && catalog.length ? catalog : SAMPLE_GIFTS).filter((g) => g && g.coins > 0);
  return TIER_MIN.map((_, i) => {
    const tier = i + 1;
    const gifts = list.filter((g) => giftTier(g.coins) === tier).sort((a, b) => a.coins - b.coins).slice(0, perTier)
      .map((g) => ({ name: g.name, coins: g.coins, image: g.image || '', emoji: g.emoji || giftEmoji(g.name) }));
    return { tier, gifts };
  });
}
