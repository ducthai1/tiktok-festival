// Giọng đọc trên màn hình: hỏi máy chủ /api/tts (VieNeu-TTS chạy ngay trên máy) → phát qua WebAudio nên OBS thu được.
// - Tải giọng NGAY khi nhận câu (song song), phát LẦN LƯỢT — câu sau không phải chờ câu trước đọc xong mới bắt đầu tạo giọng.
// - onStart: gọi đúng lúc giọng bắt đầu đọc (hoặc ngay nếu câu bị bỏ / không có giọng) — để hiệu ứng chạy cùng lúc làm nền.
// - Trong lúc đọc: nhạc nền lặng còn 20 %, tiếng hiệu ứng còn một nửa → giọng nổi hẳn lên.
// Máy chủ chưa có giọng đọc (503) → thử giọng của trình duyệt (Windows có giọng Việt; OBS trên Linux thì không có).
// Hàng chờ tối đa 5 câu (quà dồn không đọc trễ cả phút).
import { pickVoice } from '../shared/tts-voices.js';

const QUEUE_MAX = 5;

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

  function playClip(buffer) {
    const ctx = context();
    return new Promise((resolve) => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const level = ctx.createGain();
      level.gain.value = options().gain;
      source.connect(level).connect(output());
      source.onended = resolve;
      duck(0.2, buffer.duration + 0.3);
      duck(0.5, buffer.duration + 0.3, 'sfx');
      source.start();
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
    const buffer = await item.clip;
    item.onStart?.();
    try {
      if (buffer) await playClip(buffer);
      else await viaBrowser(item.text);
    } catch {
      // câu lỗi thì bỏ qua, đọc câu sau
    }
    busy = false;
    next();
  }

  return {
    say(text, { onStart } = {}) {
      if (queue.length >= QUEUE_MAX) {
        onStart?.();
        return;
      }
      const clean = String(text).slice(0, 200);
      queue.push({ text: clean, onStart, clip: fetchClip(clean) });
      next();
    },
    clear() {
      for (const item of queue.splice(0)) item.onStart?.();
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    }
  };
}
