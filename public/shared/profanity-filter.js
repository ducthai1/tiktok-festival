// Bộ lọc từ ngữ tục tĩu / miệt thị / vi phạm tiêu chuẩn cộng đồng — dùng chung cho server (bong bóng chat, /api/tts) và màn
// hình (giọng đọc). Ba cách bắt, vì tên TikTok hay viết lách:
//   1. TỪ còn dấu (BAD_TOKENS): "lồn", "đéo"… — so trên chữ CÒN DẤU vì gập dấu thì "lớn", "các", "đeo" trùng từ bẩn.
//   2. CỤM từ còn dấu (BAD_PHRASES): "đụ má", "óc chó"…
//   3. GỐC viết liền (BAD_ROOTS): bỏ dấu + bỏ mọi ký tự không phải chữ/số + gộp chữ lặp, rồi tìm chuỗi con — bắt "Đ.ị.t mẹ",
//      "fuuuck", "XxBitchxX", "ditme123". Gốc chỉ gồm chuỗi KHÔNG trùng tên/từ thường (không có "lon", "cac", "cu"…).
const BAD_TOKENS = new Set([
  'đm', 'dm', 'đcm', 'dcm', 'đmm', 'dmm', 'đkm', 'dkm', 'vcl', 'vkl', 'vl', 'clm', 'cmm', 'clgt', 'địt', 'đjt', 'djt', 'đụ',
  'lồn', 'loz', 'lìn', 'cặc', 'kặc', 'buồi', 'dái', 'đéo', 'đếch', 'đĩ', 'điếm', 'phò', 'cave', 'cứt', 'nứng', 'chịch', 'xoạc',
  'bede', 'pede', 'khựa', 'fuck', 'fck', 'fuk', 'shit', 'bitch', 'dick', 'pussy', 'cock', 'cunt', 'slut', 'whore', 'porn',
  'sex', 'xxx', 'nigga', 'nigger', 'faggot', 'asshole', 'motherfucker', 'dume', 'duma', 'occho'
]);
const BAD_PHRASES = ['đụ má', 'đù má', 'đụ mẹ', 'địt mẹ', 'con đĩ', 'óc chó', 'thằng chó', 'con chó', 'mẹ mày', 'bố mày',
  'cái lồn', 'con cặc', 'đầu buồi', 'vãi lồn', 'vãi cả lồn', 'ba que', 'bê đê'];
// KHÔNG thêm gốc trùng tên thật khi viết liền: "bich" (Ngọc Bích), "ocho" (Ngọc Hồng), "duma" (Du Mai), "fuk" (Fukuda),
// "concac" (Con Cá Chép), "daubuoi" (Dâu Bưởi), "vailon" (Vai Long), "cailon" (Cái Lò Nướng)… — những từ đó để ở
// BAD_TOKENS / BAD_PHRASES (chỉ bắt khi đứng riêng, còn dấu).
const BAD_ROOTS = ['fuck', 'bitch', 'shit', 'pusy', 'dick', 'cunt', 'nig', 'fagot', 'porn', 'slut', 'whore',
  'dit', 'ditme', 'dcm', 'dkm', 'dmm', 'vcl', 'vkl', 'clgt'];
const URL_OR_PHONE = /(https?:\/\/|www\.|\.com\b|\.vn\b|\b0\d{8,10}\b|zalo|telegram)/i;

/** Bỏ dấu, đ→d, chữ thường, chỉ giữ a-z0-9 và khoảng trắng. */
export function foldText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// gốc ngắn chỉ tính khi đứng ĐẦU một chữ (tránh "edit", "credit", "Edit Me" → "editme", "Dita")
const SHORT_ROOT = { dit: /(^|[^a-z])dit($|[^a-z]|me|may|con)/, ditme: /(^|[^a-z])ditme/, nig: /(^|[^a-z])nig(ga|ger|g)/ };

// "đ.ị.t mẹ", "d i t" → ghép các chữ cái lẻ đứng liền nhau thành một từ: "dit me"
function joinSpelledOut(folded) {
  const out = [];
  let prevSingle = false;
  for (const token of folded.split(' ')) {
    const single = token.length === 1;
    if (single && prevSingle) out[out.length - 1] += token;
    else out.push(token);
    prevSingle = single;
  }
  return out.join(' ');
}

function hasBadRoot(text) {
  const folded = foldText(text);
  const joined = joinSpelledOut(folded);
  const compact = folded.replace(/[^a-z]/g, '');
  const squeezed = compact.replace(/([a-z])\1+/g, '$1'); // "fuuuck" → "fuck", "bitchhh" → "bitch"
  return BAD_ROOTS.some((root) => {
    if (SHORT_ROOT[root]) return SHORT_ROOT[root].test(joined) || SHORT_ROOT[root].test(joined.replace(/ /g, ''));
    return compact.includes(root) || squeezed.includes(root);
  });
}

/** true = không có từ tục tĩu / miệt thị (không xét link / số điện thoại). */
export function isCleanText(text) {
  const raw = String(text ?? '').normalize('NFC').toLowerCase();
  const tokens = raw.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (tokens.some((token) => BAD_TOKENS.has(token))) return false;
  const joined = ` ${tokens.join(' ')} `;
  if (BAD_PHRASES.some((phrase) => joined.includes(` ${phrase} `))) return false;
  return !hasBadRoot(raw);
}

/** Được hiện / đọc: sạch từ ngữ + không chứa link / số điện thoại / mời sang app khác. */
export function isCleanForDisplay(text) {
  if (!text || URL_OR_PHONE.test(text)) return false;
  return isCleanText(text);
}

/**
 * Tên để GIỌNG ĐỌC đọc: bỏ emoji / ký hiệu / chữ không phải Latin (giọng Việt đọc vấp), tối đa 24 ký tự.
 * Tên có từ bẩn (kể cả viết lách) → đọc `fallback` ("bạn") thay vì đọc tên.
 */
export function speakableName(name, fallback = 'bạn') {
  if (!isCleanForDisplay(name)) return fallback;
  const clean = String(name).normalize('NFC').replace(/[^\p{Script=Latin}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  return clean.slice(0, 24).trim() || fallback;
}
