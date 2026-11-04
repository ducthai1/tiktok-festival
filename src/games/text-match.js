// So khớp lệnh chat tiếng Việt: bỏ dấu, đ→d, chữ thường, rồi so theo TỪ NGUYÊN VẸN
// (không dùng \b vì \b của JS chỉ hiểu ASCII, "cụng" sẽ bị cắt sai biên).
// foldText + bộ lọc từ bẩn nằm ở public/shared/profanity-filter.js (dùng chung với màn hình — giọng đọc).
import { foldText, isCleanForDisplay } from '../../public/shared/profanity-filter.js';

export { foldText, isCleanForDisplay };

// phrases: danh sách cụm từ đã gập dấu sẵn, ví dụ ['cung ly', 'cheers'].
export function containsPhrase(text, phrases) {
  const padded = ` ${foldText(text)} `;
  return phrases.some((phrase) => padded.includes(` ${phrase} `));
}

export function startsWithPhrase(text, phrases) {
  const folded = `${foldText(text)} `;
  return phrases.some((phrase) => folded.startsWith(`${phrase} `));
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
