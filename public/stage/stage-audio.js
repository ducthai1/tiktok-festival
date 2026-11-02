// Âm thanh tự tổng hợp bằng WebAudio (không cần file nhạc có bản quyền) + giọng đọc
// của trình duyệt (speechSynthesis) cho lời khấn/quẻ — không chạy chương trình ngoài nào.
export function createStageAudio() {
  let ctx = null;
  let enabled = true;
  let volume = 0.6;
  let ttsOn = false;
  const speakQueue = [];

  function audio() {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function tone({ freq, type = 'sine', attack = 0.005, decay = 0.4, gain = 0.3, slide = 0, delay = 0 }) {
    if (!enabled) return;
    const a = audio();
    const t = a.currentTime + delay;
    const osc = a.createOscillator();
    const amp = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + decay);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain * volume, t + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    osc.connect(amp).connect(a.destination);
    osc.start(t);
    osc.stop(t + attack + decay + 0.05);
  }

  function noise({ decay = 0.3, gain = 0.2, freq = 1200, delay = 0 }) {
    if (!enabled) return;
    const a = audio();
    const t = a.currentTime + delay;
    const buffer = a.createBuffer(1, Math.ceil(a.sampleRate * decay), a.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
    const src = a.createBufferSource();
    const filter = a.createBiquadFilter();
    const amp = a.createGain();
    src.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    amp.gain.value = gain * volume;
    src.connect(filter).connect(amp).connect(a.destination);
    src.start(t);
  }

  const sounds = {
    pop: () => tone({ freq: 620, type: 'triangle', decay: 0.12, gain: 0.25, slide: 1.6 }),
    clink: () => { tone({ freq: 2600, decay: 0.5, gain: 0.12 }); tone({ freq: 3900, decay: 0.35, gain: 0.08, delay: 0.03 }); },
    whoosh: () => noise({ decay: 0.45, gain: 0.25, freq: 900 }),
    splash: () => noise({ decay: 0.6, gain: 0.35, freq: 500 }),
    crash: () => { noise({ decay: 0.9, gain: 0.5, freq: 260 }); tone({ freq: 90, type: 'sawtooth', decay: 0.5, gain: 0.2, slide: 0.5 }); },
    fanfare: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'triangle', decay: 0.5, gain: 0.22, delay: i * 0.12 })),
    boom: () => { noise({ decay: 1.2, gain: 0.45, freq: 180 }); tone({ freq: 60, decay: 0.8, gain: 0.3, slide: 0.6 }); },
    mo: () => { tone({ freq: 820, type: 'sine', decay: 0.09, gain: 0.5, slide: 0.7 }); noise({ decay: 0.05, gain: 0.25, freq: 2400 }); },
    bell: () => [196, 392.5, 588, 1176].forEach((f, i) => tone({ freq: f, decay: 4 - i * 0.6, gain: 0.32 / (i + 1), attack: 0.004 })),
    chime: () => [1318, 1568, 1976].forEach((f, i) => tone({ freq: f, decay: 1.2, gain: 0.12, delay: i * 0.09 }))
  };

  function speakNext() {
    if (!ttsOn || speechSynthesis.speaking || !speakQueue.length) return;
    const u = new SpeechSynthesisUtterance(speakQueue.shift());
    u.lang = 'vi-VN';
    u.rate = 0.95;
    u.volume = volume;
    const vi = speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith('vi'));
    if (vi) u.voice = vi;
    u.onend = speakNext;
    u.onerror = speakNext;
    speechSynthesis.speak(u);
  }

  return {
    play(name) {
      try {
        sounds[name]?.();
      } catch {
        // trình duyệt chặn âm thanh khi chưa có thao tác — bỏ qua
      }
    },
    speak(text) {
      if (!ttsOn || !('speechSynthesis' in window) || speakQueue.length > 4) return;
      speakQueue.push(String(text).slice(0, 220));
      speakNext();
    },
    configure(settings) {
      enabled = settings.sound !== false;
      volume = Number.isFinite(settings.volume) ? settings.volume : 0.6;
      ttsOn = settings.tts === true;
      if (!ttsOn && 'speechSynthesis' in window) {
        speakQueue.length = 0;
        speechSynthesis.cancel();
      }
    }
  };
}
