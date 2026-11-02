// So khớp lệnh chat tiếng Việt: bỏ dấu, đ→d, chữ thường, rồi so theo TỪ NGUYÊN VẸN
// (không dùng \b vì \b của JS chỉ hiểu ASCII, "cụng" sẽ bị cắt sai biên).
export function foldText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// phrases: danh sách cụm từ đã gập dấu sẵn, ví dụ ['cung ly', 'cheers'].
export function containsPhrase(text, phrases) {
  const padded = ` ${foldText(text)} `;
  return phrases.some((phrase) => padded.includes(` ${phrase} `));
}

export function startsWithPhrase(text, phrases) {
  const folded = `${foldText(text)} `;
  return phrases.some((phrase) => folded.startsWith(`${phrase} `));
}

// Từ thô tục so trên chữ CÒN DẤU: gập dấu thì "lớn", "các", "buổi", "đeo" trùng từ bẩn.
const BAD_TOKENS = new Set([
  'đm', 'dm', 'đcm', 'dcm', 'đmm', 'dmm', 'vcl', 'vkl', 'vl', 'clm', 'cmm', 'địt', 'đjt', 'djt', 'lồn', 'loz',
  'cặc', 'buồi', 'đéo', 'đếch', 'đĩ', 'cứt', 'fuck', 'fck', 'shit', 'bitch'
]);
const BAD_PHRASES = ['đụ má', 'đù má', 'con đĩ', 'óc chó', 'thằng chó', 'mẹ mày', 'bố mày'];
const URL_OR_PHONE = /(https?:\/\/|www\.|\.com\b|\.vn\b|\b0\d{8,10}\b|zalo|telegram)/i;

export function isCleanForDisplay(text) {
  if (!text || URL_OR_PHONE.test(text)) return false;
  const tokens = String(text).normalize('NFC').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (tokens.some((token) => BAD_TOKENS.has(token))) return false;
  const joined = ` ${tokens.join(' ')} `;
  return !BAD_PHRASES.some((phrase) => joined.includes(` ${phrase} `));
}

export function createCooldown(ms) {
  const last = new Map();
  return (key, now) => {
    const previous = last.get(key);
    if (previous !== undefined && now - previous < ms) return false;
    last.set(key, now);
    if (last.size > 5000) last.delete(last.keys().next().value);
    return true;
  };
}
