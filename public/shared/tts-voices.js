// Giọng đọc VieNeu dùng cho live — dùng chung cho máy chủ (kiểm tham số) và màn hình (chọn giọng mỗi câu).
// Cài đặt `ttsVoice` là tên một giọng, hoặc "random" = mỗi câu bốc ngẫu nhiên một trong các giọng.
export const TTS_VOICES = ['Ngọc Huyền', 'Trúc Ly', 'Hải Đăng'];
export const RANDOM_VOICE = 'random';

export const isVoiceSetting = (value) => value === RANDOM_VOICE || TTS_VOICES.includes(value);

/** Giọng cho câu sắp đọc theo cài đặt (sai / đã bỏ → giọng đầu). */
export function pickVoice(setting, random = Math.random) {
  if (setting === RANDOM_VOICE) return TTS_VOICES[Math.floor(random() * TTS_VOICES.length)];
  return TTS_VOICES.includes(setting) ? setting : TTS_VOICES[0];
}
