// Luật quà tab tiếng Anh do chủ kênh chỉnh ở trang điều khiển (tab 🎁 Quà): [{ to, gift, questions, enabled }].
// Máy chủ KHÔNG tin giá / ảnh trang điều khiển gửi lên: chỉ nhận id quà, rồi lấy tên + GIÁ THẬT + ảnh từ bảng quà TikTok
// (tiktok-gifts-vn.js) hoặc quà thật phòng đã nhận. Lưu ở data/settings.json (englishGifts).
import { ENGLISH_TARGETS, defaultQuestionsFor } from '../../../public/shared/english-sets.js';
import { VN_GIFTS_UP_TO_30 } from '../../../public/shared/tiktok-gifts-vn.js';

export const MAX_RULES = 40;
export const MAX_RULE_QUESTIONS = 200;

/**
 * Quà để chọn ở tab 🎁 Quà: bảng quà TikTok VN (giá thật; panel = ai cũng thấy trong hộp quà, pos = vị trí) + quà THẬT phòng đã
 * nhận (id số của TikTok — bỏ quà thử / quà mẫu). seen = phòng đã nhận món này ít nhất một lần.
 */
export function giftOptions(catalog = []) {
  const out = VN_GIFTS_UP_TO_30.map((g) => ({ id: g.id, name: g.name, coins: g.coins, image: g.image, panel: g.panel, pos: g.pos, seen: false }));
  const byId = new Map(out.map((g) => [g.id, g]));
  for (const c of catalog || []) {
    const id = String(c?.id || '');
    if (!/^\d+$/.test(id) || !(Number(c.coins) >= 1)) continue;
    if (byId.has(id)) byId.get(id).seen = true;
    else {
      const g = { id, name: String(c.name || '').slice(0, 40), coins: Number(c.coins), image: c.image || '', panel: false, pos: 0, seen: true };
      out.push(g);
      byId.set(id, g);
    }
  }
  // ai cũng thấy (theo vị trí trong hộp quà) → phòng đã nhận → còn lại theo giá
  return out.sort((a, b) => (b.panel - a.panel) || (a.panel ? a.pos - b.pos : 0) || (b.seen - a.seen) || a.coins - b.coins || a.name.localeCompare(b.name));
}

/** Kiểm tra + chuẩn hoá luật từ trang điều khiển. Sai → ném lỗi tiếng Việt (trang điều khiển hiện ra). */
export function normalizeRules(raw, options) {
  if (!Array.isArray(raw) || !raw.length) throw new Error('Cần ít nhất một món quà');
  if (raw.length > MAX_RULES) throw new Error(`Tối đa ${MAX_RULES} món`);
  const byId = new Map(options.map((g) => [g.id, g]));
  const used = new Set();
  return raw.map((r, i) => {
    if (!ENGLISH_TARGETS[r?.to]) throw new Error(`Dòng ${i + 1}: chế độ không hợp lệ`);
    const g = byId.get(String(r.giftId ?? r.gift?.id ?? ''));
    if (!g) throw new Error(`Dòng ${i + 1}: chọn lại món quà (không có trong danh sách quà TikTok)`);
    if (used.has(g.id)) throw new Error(`"${g.name}" đang gán cho 2 dòng — mỗi món quà chỉ một chế độ`);
    used.add(g.id);
    const q = Math.round(Number(r.questions));
    const questions = Number.isFinite(q) && q >= 1 ? Math.min(MAX_RULE_QUESTIONS, q) : defaultQuestionsFor(r.to);
    return { to: r.to, gift: { id: g.id, name: g.name, coins: g.coins, image: g.image }, questions, enabled: r.enabled !== false };
  });
}
