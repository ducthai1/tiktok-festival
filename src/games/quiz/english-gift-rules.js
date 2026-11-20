// Luật quà tab tiếng Anh do chủ kênh chỉnh ở trang điều khiển (tab 🎁 Quà): [{ to, gift, questions, enabled }].
// Máy chủ KHÔNG tin giá / ảnh trang điều khiển gửi lên: chỉ nhận id quà, rồi lấy tên + GIÁ THẬT + ảnh từ bảng quà TikTok
// (tiktok-gifts-vn.js) hoặc quà thật phòng đã nhận. Lưu ở data/settings.json (englishGifts).
import { ENGLISH_TARGETS, STREAMER_SEEN_GIFTS, defaultQuestionsFor } from '../../../public/shared/english-sets.js';
import { VN_GIFTS_UP_TO_30 } from '../../../public/shared/tiktok-gifts-vn.js';

export const MAX_RULES = 40;
export const MAX_RULE_QUESTIONS = 200;

/**
 * Quà để chọn ở tab 🎁 Quà: bảng quà TikTok VN (giá thật; panel = cờ "ai cũng thấy" của API, pos = vị trí) + quà THẬT phòng đã
 * nhận (id số của TikTok — bỏ quà thử / quà mẫu). seen = phòng đã nhận món này ít nhất một lần.
 *
 * senders = SỐ NGƯỜI KHÁC NHAU đã thật sự tặng được món đó (gift-evidence.js). Đây là tín hiệu đáng tin duy nhất:
 * cờ panel của API chỉ là mặc định chung của vùng, đo 21/11/2026 thấy lệch cả hai chiều so với hộp quà thật —
 * có món API bảo ai cũng thấy mà chủ kênh không có, và ngược lại. Xem src/live/gift-evidence.js.
 *
 * @param {object[]} catalog quà thật phòng đã nhận
 * @param {object} senders { [giftId]: số người khác nhau đã tặng } — giftEvidence.counts()
 */
export function giftOptions(catalog = [], senders = {}) {
  const soNguoi = (id) => Math.max(0, Number(senders?.[String(id)]) || 0);
  // chủ kênh tự nhìn hộp quà của mình rồi xác nhận — đáng tin hơn hẳn cờ panel của API
  const daXacNhan = new Set(STREAMER_SEEN_GIFTS.map((n) => n.toLowerCase()));
  const chuKenhThay = (name) => daXacNhan.has(String(name || '').toLowerCase());
  const out = VN_GIFTS_UP_TO_30.map((g) => ({ id: g.id, name: g.name, coins: g.coins, image: g.image, panel: g.panel, pos: g.pos, seen: false, senders: soNguoi(g.id), streamerSeen: chuKenhThay(g.name) }));
  const byId = new Map(out.map((g) => [g.id, g]));
  for (const c of catalog || []) {
    const id = String(c?.id || '');
    if (!/^\d+$/.test(id) || !(Number(c.coins) >= 1)) continue;
    if (byId.has(id)) byId.get(id).seen = true;
    else {
      const g = { id, name: String(c.name || '').slice(0, 40), coins: Number(c.coins), image: c.image || '', panel: false, pos: 0, seen: true, senders: soNguoi(id), streamerSeen: chuKenhThay(c.name) };
      out.push(g);
      byId.set(id, g);
    }
  }
  // nhiều người thật tặng được nhất lên đầu (bằng chứng chắc chắn) → rồi mới tới cờ panel của API → phòng đã nhận → giá
  // người thật tặng được nhiều nhất → chủ kênh xác nhận thấy tận mắt → cờ panel của API → phòng đã nhận → giá
  return out.sort((a, b) => (b.senders - a.senders) || (b.streamerSeen - a.streamerSeen) || (b.panel - a.panel)
    || (a.panel ? a.pos - b.pos : 0) || (b.seen - a.seen) || a.coins - b.coins || a.name.localeCompare(b.name));
}

/** Kiểm tra + chuẩn hoá quà Bật / Tắt nhạc nền. Không được trùng nhau và không được trùng với quà đổi đề tiếng Anh. */
export function normalizeMusicGifts(raw, options, englishRules = []) {
  if (!raw || typeof raw !== 'object') return null;
  const enabled = raw.enabled !== false;
  const byId = new Map(options.map((g) => [String(g.id), g]));

  const resolveGift = (giftRef, label) => {
    const id = String(giftRef?.id || giftRef?.giftId || '');
    const g = byId.get(id);
    if (!g) throw new Error(`${label}: chọn lại món quà (không có trong danh sách quà TikTok)`);
    return { id: g.id, name: g.name, coins: g.coins, image: g.image };
  };

  const on = resolveGift(raw.on, 'Quà BẬT nhạc');
  const off = resolveGift(raw.off, 'Quà TẮT nhạc');

  if (on.id === off.id) {
    throw new Error('Quà BẬT nhạc và Quà TẮT nhạc không được trùng nhau');
  }

  if (Array.isArray(englishRules)) {
    for (const r of englishRules) {
      if (!r || r.enabled === false) continue;
      const rid = String(r.gift?.id ?? r.giftId ?? '');
      if (rid === on.id) {
        throw new Error(`Món "${on.name}" đang dùng ở bảng quà đổi chế độ — không được gán làm quà BẬT nhạc`);
      }
      if (rid === off.id) {
        throw new Error(`Món "${off.name}" đang dùng ở bảng quà đổi chế độ — không được gán làm quà TẮT nhạc`);
      }
    }
  }

  return { enabled, on, off };
}

/** Kiểm tra + chuẩn hoá luật từ trang điều khiển. Sai → ném lỗi tiếng Việt (trang điều khiển hiện ra). */
export function normalizeRules(raw, options, musicGifts = null) {
  if (!Array.isArray(raw) || !raw.length) throw new Error('Cần ít nhất một món quà');
  if (raw.length > MAX_RULES) throw new Error(`Tối đa ${MAX_RULES} món`);
  const byId = new Map(options.map((g) => [g.id, g]));
  const used = new Set();
  const mgOnId = musicGifts?.enabled !== false ? String(musicGifts?.on?.id ?? musicGifts?.on?.giftId ?? '') : '';
  const mgOffId = musicGifts?.enabled !== false ? String(musicGifts?.off?.id ?? musicGifts?.off?.giftId ?? '') : '';

  return raw.map((r, i) => {
    if (!ENGLISH_TARGETS[r?.to]) throw new Error(`Dòng ${i + 1}: chế độ không hợp lệ`);
    const g = byId.get(String(r.giftId ?? r.gift?.id ?? ''));
    if (!g) throw new Error(`Dòng ${i + 1}: chọn lại món quà (không có trong danh sách quà TikTok)`);
    if (used.has(g.id)) throw new Error(`"${g.name}" đang gán cho 2 dòng — mỗi món quà chỉ một chế độ`);
    if (r.enabled !== false) {
      if (mgOnId && g.id === mgOnId) throw new Error(`"${g.name}" đang được dùng làm quà BẬT nhạc — không được gán cho đổi chế độ`);
      if (mgOffId && g.id === mgOffId) throw new Error(`"${g.name}" đang được dùng làm quà TẮT nhạc — không được gán cho đổi chế độ`);
    }
    used.add(g.id);
    const q = Math.round(Number(r.questions));
    const questions = Number.isFinite(q) && q >= 1 ? Math.min(MAX_RULE_QUESTIONS, q) : defaultQuestionsFor(r.to);
    return { to: r.to, gift: { id: g.id, name: g.name, coins: g.coins, image: g.image }, questions, enabled: r.enabled !== false };
  });
}
