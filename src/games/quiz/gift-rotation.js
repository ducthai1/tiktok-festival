// Tự luân chuyển giá quà trên bảng quà tab tiếng Anh, 20 phút một vòng.
//
// Vì sao: để một món quà đứng yên ở một ô cả buổi thì người xem tặng chán, và ô đang hot
// cũng không giúp kéo thêm thành viên CLB. Mỗi vòng:
//   1. Ô đang giữ món ĐƯỢC TẶNG NHIỀU NHẤT buổi này → đổi thành Heart Me (1 xu) — đây là quà
//      tham gia CLB người hâm mộ, nên ô hot nhất vừa rẻ nhất vừa đẻ ra fan club.
//   2. Bốn ô độ khó (Tổng hợp / Dễ / Thường / Khó) LUÔN ≤ 5 xu — đây là lối vào của người mới,
//      đắt lên là mất người chơi.
//   3. Các ô còn lại đổi tự do, nhưng lệch khỏi giá gốc quá 2 vòng thì vòng thứ 3 BẮT BUỘC
//      quay về đúng giá gốc (ô 10 xu về lại 10 xu). Không có chốt này giá sẽ trôi mãi.
//
// Chỉ chọn quà người xem TÌM ĐƯỢC: món ai cũng thấy trong hộp quà (panel), hoặc phòng đã từng
// nhận (seen). Riêng Heart Me nằm ngoài hộp quà chung nhưng chủ kênh chủ động chọn nên vẫn dùng.
import { ENGLISH_TARGETS } from '../../../public/shared/english-sets.js';

/** 20 phút một vòng: đủ lâu để người xem kịp thấy và tặng, buổi 3 tiếng được ~9 vòng. */
export const ROTATE_MS = 20 * 60 * 1000;
/** Heart Me — quà tham gia CLB người hâm mộ (bảng quà TikTok VN). */
export const FANCLUB_GIFT_ID = '7934';
/** Ô độ khó: lối vào của người mới, luôn giữ ≤ 5 xu. */
export const CHEAP_TARGETS = ['general', 'easy', 'normal', 'hard'];
export const CHEAP_MAX_COINS = 5;
/** Lệch khỏi giá gốc quá bấy nhiêu vòng thì vòng sau phải quay về. */
export const MAX_ROUNDS_AWAY = 2;

const coinsOf = (r) => Number(r?.gift?.coins) || 0;
const idOf = (r) => String(r?.gift?.id || '');

/** Trạng thái rỗng. `base` ghi giá gốc từng ô, `away` đếm số vòng ô đó đang lệch khỏi giá gốc. */
export const emptyRotation = () => ({ round: 0, at: 0, base: {}, away: {}, heart: '', hot: null });

/**
 * Quà được phép xoay vào: người xem phải tìm được (trong hộp quà chung, hoặc phòng đã nhận),
 * và không lấy chính Heart Me — món đó để dành riêng cho ô hot.
 */
const pool = (options) => options.filter((g) => (g.panel || g.seen) && String(g.id) !== FANCLUB_GIFT_ID && Number(g.coins) >= 1);

/** Món được tặng nhiều LƯỢT nhất buổi này. counts: { [giftId]: số lượt }. */
export function hottestGift(counts = {}) {
  let best = null;
  for (const [id, n] of Object.entries(counts)) {
    if (Number(n) > 0 && (!best || Number(n) > best.count)) best = { id: String(id), count: Number(n) };
  }
  return best;
}

/**
 * Tính bảng quà cho vòng kế tiếp. Hàm THUẦN: không đọc giờ, không ghi file — app.js truyền vào.
 *
 * @param {object[]} rules luật quà đang dùng [{ to, gift:{id,name,coins,image}, questions, enabled }]
 * @param {object[]} options danh sách quà chọn được (giftOptions())
 * @param {object} counts { [giftId]: số lượt tặng trong buổi live này }
 * @param {object} state trạng thái xoay vòng (emptyRotation() lần đầu)
 * @param {() => number} random bơm vào để test ra kết quả xác định
 * @returns {{ rules, state, changes: {to,label,from,to_,coins}[] }}
 */
export function rotateGifts({ rules, options, counts = {}, state = emptyRotation(), random = Math.random }) {
  const next = { ...emptyRotation(), ...state, base: { ...state.base }, away: { ...state.away } };
  // Lần chạy đầu: giá đang có chính là giá gốc của từng ô.
  for (const r of rules) if (next.base[r.to] === undefined) next.base[r.to] = coinsOf(r);

  const candidates = pool(options);
  const heartGift = options.find((g) => String(g.id) === FANCLUB_GIFT_ID);
  const hot = hottestGift(counts);
  // Ô đang giữ món hot → ô đó nhận Heart Me vòng này. Món hot chính là Heart Me thì không phải đổi.
  const heartTo = hot && heartGift && hot.id !== FANCLUB_GIFT_ID
    ? rules.find((r) => r.enabled !== false && idOf(r) === hot.id)?.to || '' : '';

  const taken = new Set();
  if (heartTo) taken.add(FANCLUB_GIFT_ID);
  // ô đang tắt vẫn GIỮ món của nó: phải chiếm chỗ trước, không thì vòng này gán món đó cho ô khác
  // và normalizeRules sẽ chặn vì "mỗi món quà chỉ một chế độ".
  for (const r of rules) if (r.enabled === false || !ENGLISH_TARGETS[r.to]) taken.add(idOf(r));
  const changes = [];
  const out = rules.map((r) => {
    if (r.enabled === false || !ENGLISH_TARGETS[r.to]) return r; // ô tắt: giữ nguyên, không chiếm quà
    const base = next.base[r.to] ?? coinsOf(r);

    if (r.to === heartTo) {
      next.away[r.to] = (next.base[r.to] === 1 ? 0 : MAX_ROUNDS_AWAY); // 1 xu rồi thì coi như đúng giá gốc
      next.heart = r.to;
      if (idOf(r) === FANCLUB_GIFT_ID) return r;
      changes.push({ to: r.to, label: ENGLISH_TARGETS[r.to].label, from: r.gift.name, name: heartGift.name, coins: heartGift.coins, fanclub: true });
      return { ...r, gift: { id: heartGift.id, name: heartGift.name, coins: heartGift.coins, image: heartGift.image } };
    }

    const cheap = CHEAP_TARGETS.includes(r.to);
    const mustReturn = !cheap && (next.away[r.to] || 0) >= MAX_ROUNDS_AWAY;
    let allowed = candidates.filter((g) => !taken.has(String(g.id)) && String(g.id) !== idOf(r));
    if (cheap) allowed = allowed.filter((g) => Number(g.coins) <= CHEAP_MAX_COINS);
    else if (mustReturn) allowed = allowed.filter((g) => Number(g.coins) === base);
    if (!allowed.length) { // không còn món hợp lệ → giữ nguyên ô, lần sau tính lại
      taken.add(idOf(r));
      return r;
    }
    const g = allowed[Math.floor(random() * allowed.length) % allowed.length];
    taken.add(String(g.id));
    next.away[r.to] = Number(g.coins) === base ? 0 : (next.away[r.to] || 0) + 1;
    if (next.heart === r.to) next.heart = '';
    changes.push({ to: r.to, label: ENGLISH_TARGETS[r.to].label, from: r.gift.name, name: g.name, coins: g.coins, fanclub: false });
    return { ...r, gift: { id: g.id, name: g.name, coins: g.coins, image: g.image } };
  });

  next.round += 1;
  next.hot = hot && { id: hot.id, count: hot.count, name: rules.find((r) => idOf(r) === hot.id)?.gift?.name || '' };
  return { rules: out, state: next, changes };
}
