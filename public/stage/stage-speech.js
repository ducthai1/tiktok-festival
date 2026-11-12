// Giọng đọc trên màn hình: hỏi máy chủ /api/tts (VieNeu-TTS chạy ngay trên máy) → phát qua WebAudio nên OBS thu được.
// - Tải giọng NGAY khi nhận câu (song song), phát LẦN LƯỢT — câu sau không phải chờ câu trước đọc xong mới bắt đầu tạo giọng.
// - onStart: gọi đúng lúc giọng bắt đầu đọc (hoặc ngay nếu câu bị bỏ / không có giọng) — để hiệu ứng chạy cùng lúc làm nền.
// - Trong lúc đọc: nhạc nền lặng còn 20 %, tiếng hiệu ứng còn một nửa → giọng nổi hẳn lên.
// Máy chủ chưa có giọng đọc (503) → thử giọng của trình duyệt (Windows có giọng Việt; OBS trên Linux thì không có).
// Hàng chờ tối đa 5 câu (quà dồn không đọc trễ cả phút).
// Đáp án tiếng Anh: /api/tts-en (giọng bản xứ Mỹ / Anh / Úc, máy chủ đã tạo sẵn lúc ra đề); không có thì giọng Anh của trình
// duyệt nếu có, không thì bỏ qua — không bao giờ chặn hàng chờ quá vài giây.
import { pickVoice } from '../shared/tts-voices.js';

const QUEUE_MAX = 5;
const LATE = Symbol('late');
const EN_WAIT_MS = 4000; // máy chủ chưa đọc xong sau 4 giây thì bỏ, không bắt câu sau chờ
const EN_GAP_MS = 350; // nghỉ giữa lần đọc thường và lần đọc chậm

// Giọng Microsoft để ~0,2 giây lặng ở đầu và 1–1,4 giây lặng ở cuối mỗi từ → cắt bớt (chừa chút đệm) cho đọc gọn.
export function audibleRange(buffer) {
  const data = buffer.getChannelData(0);
  let start = 0;
  let end = data.length - 1;
  while (start < end && Math.abs(data[start]) < 0.01) start += 1;
  while (end > start && Math.abs(data[end]) < 0.01) end -= 1;
  const rate = buffer.sampleRate;
  const offset = Math.max(0, start / rate - 0.04);
  return { offset, duration: Math.min(buffer.duration - offset, end / rate + 0.15 - offset) };
}

export function createSpeech({ context, output, duck, options }) {
  const queue = [];
  let busy = false;

  async function fetchClip(text) {
    try {
      const voice = pickVoice(options().voice, text); // "random" → mỗi câu một giọng (theo nội dung, khớp câu tạo sẵn)
      const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice)}`);
      if (!res.ok) return null;
      return await context().decodeAudioData(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  async function fetchEnglish(word, slow) {
    const abort = new AbortController(); // (không dùng AbortSignal.timeout: OBS bản cũ chưa có)
    const timer = setTimeout(() => abort.abort(), EN_WAIT_MS);
    try {
      const res = await fetch(`/api/tts-en?text=${encodeURIComponent(word)}${slow ? '&slow=1' : ''}`, { signal: abort.signal });
      if (!res.ok) return null;
      return await context().decodeAudioData(await res.arrayBuffer());
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  function englishInBrowser(word, slow) {
    return new Promise((resolve) => {
      const voices = 'speechSynthesis' in window ? speechSynthesis.getVoices() : [];
      const en = voices.find((v) => /^en[-_](US|GB)/i.test(v.lang || '')) || voices.find((v) => /^en/i.test(v.lang || ''));
      if (!en) return resolve(); // OBS trên Linux không có giọng nào → im lặng, không chờ
      const u = new SpeechSynthesisUtterance(word.toLowerCase());
      u.voice = en;
      u.lang = en.lang;
      u.rate = slow ? 0.6 : 0.95;
      u.volume = Math.min(1, options().gain);
      u.onend = resolve;
      u.onerror = resolve;
      speechSynthesis.speak(u);
      setTimeout(resolve, 5000);
    });
  }

  function playClip(buffer, { trim = false } = {}) {
    const ctx = context();
    const { offset, duration } = trim ? audibleRange(buffer) : { offset: 0, duration: buffer.duration };
    return new Promise((resolve) => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const level = ctx.createGain();
      level.gain.value = options().gain;
      source.connect(level).connect(output());
      source.onended = resolve;
      duck(0.2, duration + 0.3);
      duck(0.5, duration + 0.3, 'sfx');
      source.start(0, offset, duration);
    });
  }

  function viaBrowser(text) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'vi-VN';
      u.rate = 0.95;
      u.volume = Math.min(1, options().gain);
      const vi = speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith('vi'));
      if (vi) u.voice = vi;
      u.onend = resolve;
      u.onerror = resolve;
      speechSynthesis.speak(u);
      setTimeout(resolve, 15000); // trình duyệt không có giọng thì không bao giờ báo xong
    });
  }

  async function next() {
    if (busy || !queue.length) return;
    busy = true;
    const item = queue.shift();
    let buffer = await item.clip;
    if (buffer === LATE) buffer = await fetchClip(item.fallback); // câu có tên chưa kịp có → câu dự phòng (đã tạo sẵn)
    item.onStart?.();
    try {
      if (buffer) await playClip(buffer, { trim: item.english });
      else if (item.english) await englishInBrowser(item.text, item.slow);
      else await viaBrowser(item.text);
      if (item.english) await new Promise((r) => setTimeout(r, EN_GAP_MS));
    } catch {
      // câu lỗi thì bỏ qua, đọc câu sau
    }
    busy = false;
    next();
  }

  return {
    /** fallback + waitMs: câu `text` chưa có giọng sau waitMs thì đọc câu `fallback` (đã tạo sẵn) cho kịp hiệu ứng. */
    say(text, { onStart, fallback = '', waitMs = 0 } = {}) {
      if (queue.length >= QUEUE_MAX) {
        onStart?.();
        return;
      }
      const clean = String(text).slice(0, 200);
      let clip = fetchClip(clean);
      if (fallback) clip = Promise.race([clip, new Promise((r) => setTimeout(() => r(LATE), waitMs))]);
      queue.push({ text: clean, onStart, clip, fallback });
      next();
    },
    /** Từ tiếng Anh giọng bản xứ (slow: đọc chậm để người xem nghe rõ từng âm). */
    sayEnglish(word, { slow = false } = {}) {
      if (queue.length >= QUEUE_MAX) return;
      const text = String(word).slice(0, 60);
      queue.push({ text, clip: fetchEnglish(text, slow), english: true, slow });
      next();
    },
    clear() {
      for (const item of queue.splice(0)) item.onStart?.();
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    }
  };
}
