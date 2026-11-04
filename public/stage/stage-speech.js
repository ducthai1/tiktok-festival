// Giọng đọc trên màn hình: hỏi máy chủ /api/tts (VieNeu-TTS chạy ngay trên máy) → phát qua WebAudio nên OBS thu được,
// nhạc nền nhỏ lại trong lúc đọc. Máy chủ chưa có giọng đọc (503) → thử giọng có sẵn của trình duyệt (Windows có giọng
// Việt; OBS trên Linux thì không có giọng nào). Đọc lần lượt, hàng chờ tối đa 5 câu (quà dồn không đọc trễ cả phút).
import { pickVoice } from '../shared/tts-voices.js';

const QUEUE_MAX = 5;

export function createSpeech({ context, output, duck, options }) {
  const queue = [];
  let busy = false;

  async function viaServer(text) {
    const { gain } = options();
    const voice = pickVoice(options().voice); // "random" → mỗi câu một giọng
    const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice)}`);
    if (!res.ok) return false;
    const ctx = context();
    const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
    await new Promise((resolve) => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const level = ctx.createGain();
      level.gain.value = gain;
      source.connect(level).connect(output());
      source.onended = resolve;
      duck(0.3, buffer.duration + 0.3);
      source.start();
    });
    return true;
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
    const text = queue.shift();
    try {
      if (!(await viaServer(text))) await viaBrowser(text);
    } catch {
      await viaBrowser(text);
    }
    busy = false;
    next();
  }

  return {
    say(text) {
      if (queue.length >= QUEUE_MAX) return;
      queue.push(String(text).slice(0, 200));
      next();
    },
    clear() {
      queue.length = 0;
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    }
  };
}
