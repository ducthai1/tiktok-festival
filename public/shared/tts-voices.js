// Giọng đọc VieNeu dùng cho live — dùng chung cho máy chủ (kiểm tham số) và màn hình (chọn giọng mỗi câu).
// Cài đặt `ttsVoice` là tên một giọng, hoặc "random" = mỗi câu một giọng — chọn THEO NỘI DUNG câu (cùng câu luôn cùng giọng)
// để máy chủ tạo sẵn đúng giọng mà màn hình sẽ hỏi (câu cảm ơn follow tạo trước → follow là đọc ngay).
export const TTS_VOICES = ['Ngọc Huyền', 'Trúc Ly', 'Hải Đăng'];
export const RANDOM_VOICE = 'random';

export const isVoiceSetting = (value) => value === RANDOM_VOICE || TTS_VOICES.includes(value);

function hashText(text) {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}

/** Giọng cho câu `text` theo cài đặt (sai / đã bỏ → giọng đầu). */
export function pickVoice(setting, text = '') {
  if (setting === RANDOM_VOICE) return TTS_VOICES[hashText(text) % TTS_VOICES.length];
  return TTS_VOICES.includes(setting) ? setting : TTS_VOICES[0];
}
