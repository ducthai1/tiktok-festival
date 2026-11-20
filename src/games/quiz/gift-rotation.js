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
import { ENGLISH_TARGETS, ORDER } from '../../../public/shared/english-sets.js';
import { SAFE_MIN_SENDERS } from '../../live/gift-evidence.js';

/** 20 phút một vòng: đủ lâu để người xem kịp thấy và tặng, buổi 3 tiếng được ~9 vòng. */
export const ROTATE_MS = 20 * 60 * 1000;
/** Heart Me — quà tham gia CLB người hâm mộ (bảng quà TikTok VN). */
export const FANCLUB_GIFT_ID = '7934';
/** Ô độ khó: lối vào của người mới, luôn giữ ≤ 5 xu. */
export const CHEAP_TARGETS = ['general', 'easy', 'normal', 'hard'];
export const CHEAP_MAX_COINS = 5;
/** Quà ở trang 2 và 3 tối thiểu phải là 5 xu (không bao giờ random 1 xu vào, trừ Heart Me hot). */
export const MIN_PAGE_2_3_COINS = 5;
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
/**
 * Quà được phép xoay vào: phải CÓ BẰNG CHỨNG người xem tặng được — tức là đã có ít nhất
 * SAFE_MIN_SENDERS người KHÁC NHAU thật sự tặng món đó (gift-evidence.js).
 *
 * Trước 21/11/2026 chỗ này nhận cả `g.panel` (cờ của API TikTok) và `g.seen` (phòng từng nhận một
 * lần). Cả hai đều yếu: cờ panel chỉ là mặc định chung của vùng, đo thực tế thấy lệch cả hai chiều
 * so với hộp quà thật; còn `seen` một lần có thể chỉ là một người xem ở vùng khác tặng. Vòng xoay
 * vì thế đẩy lên bảng những món nhiều người mở hộp quà ra không có.
 *
 * Chưa đủ bằng chứng thì danh sách này ngắn lại, và ô nào không còn món hợp lệ sẽ GIỮ NGUYÊN quà
 * đang có (xem rotateGifts) — thà không xoay còn hơn xoay vào món không ai tặng được.
 */
const pool = (options, exclude = []) => {
  const ex = new Set((exclude || []).map(String));
  return options.filter((g) => Number(g.senders) >= SAFE_MIN_SENDERS
    && String(g.id) !== FANCLUB_GIFT_ID && !ex.has(String(g.id)) && Number(g.coins) >= 1);
};

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
 * @param {string[]} exclude các id quà loại trừ không luân chuyển vào (vd quà Bật/Tắt nhạc)
 * @returns {{ rules, state, changes: {to,label,from,to_,coins}[] }}
 */
export function rotateGifts({ rules, options, counts = {}, state = emptyRotation(), random = Math.random, exclude = [] }) {
  const next = { ...emptyRotation(), ...state, base: { ...state.base }, away: { ...state.away } };
  // Lần chạy đầu: giá đang có chính là giá gốc của từng ô (ô trang 2 & 3 tối thiểu là 5 xu).
  for (const r of rules) {
    if (next.base[r.to] === undefined) {
      const isP23 = ORDER.indexOf(r.to) >= 7;
      const c = coinsOf(r);
      next.base[r.to] = isP23 ? Math.max(MIN_PAGE_2_3_COINS, c) : c;
    }
  }

  const candidates = pool(options, exclude);
  const heartGift = options.find((g) => String(g.id) === FANCLUB_GIFT_ID)
    || { id: FANCLUB_GIFT_ID, name: 'Heart Me', coins: 1, image: 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/d56945782445b0b8c8658ed44f894c7b~tplv-resize:258:258.webp' };
  const hot = hottestGift(counts);

  // Heart Me: BẮT BUỘC LUÔN LUÔN CÓ MẶT Ở 1 Ô TRÊN BẢNG QUÀ
  // - Nếu có món hot (khác Heart Me) → ô món hot đổi thành Heart Me
  // - Nếu chưa có món hot hoặc món hot chính là Heart Me → giữ Heart Me ở ô đang có, hoặc gán vào ô 'nghe' (hoặc ô bật đầu tiên)
  let heartTo = '';
  if (hot && hot.id !== FANCLUB_GIFT_ID) {
    heartTo = rules.find((r) => r.enabled !== false && idOf(r) === hot.id)?.to || '';
  }
  if (!heartTo) {
    const currentHeartTo = rules.find((r) => r.enabled !== false && idOf(r) === FANCLUB_GIFT_ID)?.to;
    heartTo = currentHeartTo
      || rules.find((r) => r.enabled !== false && r.to === 'nghe')?.to
      || rules.find((r) => r.enabled !== false)?.to
      || '';
  }

  const taken = new Set();
  if (heartTo) taken.add(FANCLUB_GIFT_ID);
  // MỌI ô đều giữ chỗ món hiện tại của mình trước. Ô đang tắt thì giữ vĩnh viễn; ô đang bật chỉ nhả
  // món cũ ra khi nó thật sự đổi được sang món khác. Thiếu chỗ giữ này thì ô nào không tìm được món
  // hợp lệ sẽ quay về giữ món cũ, trong khi món đó vừa bị một ô phía trước chiếm mất → bảng trùng
  // món và normalizeRules ném lỗi. Trước đây hiếm gặp vì danh sách quà còn rộng; từ 21/11/2026 chỉ
  // lấy món có bằng chứng người xem tặng được nên danh sách ngắn hẳn, lỗi nổ ra thường xuyên.
  for (const r of rules) taken.add(idOf(r));
  const changes = [];
  const out = rules.map((r) => {
    if (r.enabled === false || !ENGLISH_TARGETS[r.to]) return r; // ô tắt: giữ nguyên, không chiếm quà
    const isPage2or3 = ORDER.indexOf(r.to) >= 7;
    const base = next.base[r.to] ?? Math.max(isPage2or3 ? MIN_PAGE_2_3_COINS : 0, coinsOf(r));

    if (r.to === heartTo) {
      next.away[r.to] = (next.base[r.to] === 1 ? 0 : MAX_ROUNDS_AWAY); // 1 xu rồi thì coi như đúng giá gốc
      next.heart = r.to;
      if (idOf(r) === FANCLUB_GIFT_ID) return r;
      changes.push({ to: r.to, label: ENGLISH_TARGETS[r.to].label, from: r.gift.name, name: heartGift.name, coins: heartGift.coins, fanclub: true });
      taken.delete(idOf(r)); // đổi sang Heart Me rồi → nhả món cũ cho ô sau dùng
      return { ...r, gift: { id: heartGift.id, name: heartGift.name, coins: heartGift.coins, image: heartGift.image } };
    }

    const cheap = CHEAP_TARGETS.includes(r.to);
    const mustReturn = !cheap && (next.away[r.to] || 0) >= MAX_ROUNDS_AWAY;
    let allowed = candidates.filter((g) => !taken.has(String(g.id)) && String(g.id) !== idOf(r));
    if (cheap) {
      allowed = allowed.filter((g) => Number(g.coins) <= CHEAP_MAX_COINS);
    } else if (isPage2or3) {
      // Trang 2 và 3 ít nhất phải là 5 kim cương, KHÔNG ĐƯỢC random 1 kim cương vào
      allowed = allowed.filter((g) => Number(g.coins) >= MIN_PAGE_2_3_COINS);
      if (mustReturn) allowed = allowed.filter((g) => Number(g.coins) === base);
    } else if (mustReturn) {
      allowed = allowed.filter((g) => Number(g.coins) === base);
    }
    if (!allowed.length) { // không còn món hợp lệ → giữ nguyên ô, lần sau tính lại
      taken.add(idOf(r));
      return r;
    }
    const g = allowed[Math.floor(random() * allowed.length) % allowed.length];
    taken.delete(idOf(r)); // đổi được rồi → nhả món cũ cho ô sau dùng
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
