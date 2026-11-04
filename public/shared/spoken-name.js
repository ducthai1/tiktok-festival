// Tên người xem để GIỌNG ĐỌC đọc rõ: tên TikTok hay viết kiểu giọng Việt đọc vấp / đọc dính — chuẩn hoá trước khi đọc.
//   - có từ tục tĩu / miệt thị (kể cả viết lách) → `fallback` ("bạn"), không đọc tên
//   - emoji, ký hiệu, chữ không phải Latin, "_" "." → khoảng trắng
//   - "BeNaCute" → "Be Na Cute", "Tuấn2k5" → "Tuấn 2k5" (tách chữ hoa dính liền, chữ dính số)
//   - "NGUYEN VAN A" → "Nguyen Van A" (viết hoa hết bị đánh vần như chữ viết tắt)
//   - "Naaaa" → "Na" (chữ kéo dài)
//   - bỏ trang trí / đuôi năm sinh: "xX", "Xx", "official", "2k5", "2005", "1999"
//   - tối đa 3 chữ, 22 ký tự — tên ngắn gọn thì đọc rõ hơn
import { isCleanForDisplay } from './profanity-filter.js';

const DECOR = new Set(['xx', 'x', 'official', 'offical', 'real', 'tiktok', 'tik', 'tok']);
const YEAR_TAG = /^(\d{1,2}k\d{0,2}|(19|20)\d{2}|\d{3,})$/i; // 2k5, 2k, 2005, 1999, 123…

export function speakableName(name, fallback = 'bạn') {
  if (!isCleanForDisplay(name)) return fallback;
  // bỏ trang trí / đuôi năm sinh cả TRƯỚC lẫn SAU khi tách chữ dính ("2k5" phải bỏ trước, "Tuấn2005" bỏ sau)
  const tidy = (text) => {
    const all = text.split(/\s+/).filter(Boolean);
    return all.filter((w) => !DECOR.has(w.toLowerCase()) && !(all.length > 1 && YEAR_TAG.test(w))).join(' ');
  };
  const base = tidy(String(name).normalize('NFC').replace(/[^\p{Script=Latin}\p{M}\p{N}\s]/gu, ' '));
  const split = base
    .replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2')
    .replace(/(\p{L})(\p{N})/gu, '$1 $2')
    .replace(/(\p{L})\1{2,}/gu, '$1');
  const words = tidy(split).split(' ').filter(Boolean)
    .map((w) => (w.length >= 3 && w === w.toUpperCase() && /\p{Lu}/u.test(w) ? w[0] + w.slice(1).toLowerCase() : w));
  let out = '';
  for (const w of words.slice(0, 3)) {
    if ((out ? `${out} ${w}` : w).length > 22) break;
    out = out ? `${out} ${w}` : w;
  }
  return out || fallback;
}

/** Tên quà để đọc: chỉ bỏ emoji / ký hiệu / chữ không phải Latin (giữ nguyên "TikTok Universe"); bẩn thì `fallback`. */
export function speakableGift(name, fallback = 'quà') {
  if (!isCleanForDisplay(name)) return fallback;
  const clean = String(name).normalize('NFC').replace(/[^\p{Script=Latin}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  return clean.slice(0, 30).trim() || fallback;
}
