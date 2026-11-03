// Bộ tiếng hiệu ứng tổng hợp: mỗi tiếng mô phỏng đúng vật thể (chuông đồng nhiều bội âm ngân dài,
// mõ gỗ tắt nhanh, ly thuỷ tinh, nút sâm panh, rót nước, pháo hoa nổ lách tách…).
export function createSynth(ctx, out) {
  function tone(freq, { type = 'sine', attack = 0.004, decay = 0.4, gain = 0.3, slide = 0, delay = 0, detune = 0, lowpass = 0 } = {}) {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.detune.value = detune;
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + attack + decay);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    let node = osc.connect(amp);
    if (lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      node = node.connect(f);
    }
    node.connect(out);
    osc.start(t);
    osc.stop(t + attack + decay + 0.05);
  }

  function noise({ decay = 0.3, gain = 0.2, type = 'bandpass', freq = 1200, toFreq = 0, q = 1, delay = 0, attack = 0.002 } = {}) {
    const t = ctx.currentTime + delay;
    const length = Math.ceil(ctx.sampleRate * (decay + attack));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    src.buffer = buffer;
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, t);
    if (toFreq) filter.frequency.exponentialRampToValueAtTime(toFreq, t + decay);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    src.connect(filter).connect(amp).connect(out);
    src.start(t);
  }

  // Chuông đồng: bội âm không hài hoà (tỉ lệ của chuông thật), mỗi bội âm tắt một nhịp khác nhau.
  function bell(base, { gain = 0.3, length = 5, delay = 0 } = {}) {
    [[0.5, 1], [1, 0.8], [1.19, 0.5], [1.5, 0.45], [2, 0.35], [2.51, 0.25], [2.66, 0.2], [3.01, 0.15], [4.1, 0.08]]
      .forEach(([ratio, level], i) => {
        tone(base * ratio, { gain: gain * level, decay: length * (1 - i * 0.08), delay, detune: (i % 2 ? 4 : -4) });
      });
  }

  const SOUNDS = {
    pop: () => { tone(500, { type: 'triangle', decay: 0.14, gain: 0.3, slide: 2.2 }); noise({ decay: 0.04, gain: 0.08, freq: 3000 }); },
    clink: () => [2637, 3951, 5274, 6645].forEach((f, i) => tone(f, { decay: 0.9 - i * 0.15, gain: 0.12 / (i + 1), detune: i * 7 })),
    whoosh: () => noise({ decay: 0.55, gain: 0.3, freq: 300, toFreq: 2400, q: 2 }),
    splash: () => {
      noise({ decay: 0.8, gain: 0.4, type: 'lowpass', freq: 2500, toFreq: 400 });
      for (let i = 0; i < 6; i += 1) tone(600 + Math.random() * 900, { decay: 0.08, gain: 0.05, slide: 1.8, delay: 0.1 + i * 0.07 });
    },
    crash: () => {
      tone(70, { decay: 0.6, gain: 0.45, slide: 0.5 });
      for (let i = 0; i < 8; i += 1) noise({ decay: 0.18, gain: 0.25, freq: 400 + Math.random() * 1600, delay: i * 0.06 });
    },
    fanfare: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => {
      tone(f, { type: 'sawtooth', decay: i > 3 ? 0.9 : 0.35, gain: 0.09, delay: i * 0.13, lowpass: 2600 });
      tone(f * 2, { type: 'triangle', decay: 0.3, gain: 0.04, delay: i * 0.13 });
    }),
    boom: () => {
      tone(55, { decay: 1.1, gain: 0.5, slide: 0.6 });
      noise({ decay: 1.2, gain: 0.35, type: 'lowpass', freq: 900, toFreq: 120 });
      for (let i = 0; i < 26; i += 1) noise({ decay: 0.03, gain: 0.12, freq: 3000 + Math.random() * 4000, delay: 0.35 + Math.random() * 1.3 });
    },
    // mõ gỗ: hai cộng hưởng gỗ tắt rất nhanh + tiếng gõ
    mo: () => { tone(790, { decay: 0.11, gain: 0.45, slide: 0.92 }); tone(1270, { decay: 0.06, gain: 0.18 }); noise({ decay: 0.025, gain: 0.25, freq: 2500, q: 3 }); },
    bell: () => bell(196, { gain: 0.32, length: 6 }),
    smallBell: () => bell(880, { gain: 0.12, length: 2.2 }),
    gong: () => { bell(98, { gain: 0.38, length: 8 }); noise({ decay: 2.5, gain: 0.06, type: 'lowpass', freq: 400 }); },
    chime: () => [1318, 1568, 1976, 2637].forEach((f, i) => tone(f, { decay: 1.4, gain: 0.08, delay: i * 0.09 })),
    // người vào phòng: rất nhỏ (~1/5 bản cũ) vì người ra vào liên tục — kêu to dễ nhức đầu (user chốt 03/11)
    welcome: () => {
      [784, 988, 1175, 1568].forEach((f, i) => tone(f, { type: 'triangle', decay: 0.7, gain: 0.026, delay: i * 0.08 }));
      [2349, 3136].forEach((f, i) => tone(f, { decay: 0.9, gain: 0.008, delay: 0.32 + i * 0.05 }));
    },
    // nút sâm panh bật + bọt xèo
    cork: () => { tone(900, { decay: 0.08, gain: 0.35, slide: 0.4 }); noise({ decay: 0.06, gain: 0.3, freq: 1800 }); noise({ decay: 1.4, gain: 0.08, type: 'highpass', freq: 5000, delay: 0.08 }); },
    pour: () => { for (let i = 0; i < 14; i += 1) tone(500 + i * 40 + Math.random() * 120, { decay: 0.07, gain: 0.05, slide: 1.4, delay: i * 0.07 }); noise({ decay: 1.1, gain: 0.06, freq: 900, q: 4 }); },
    magic: () => [523, 659, 784, 988, 1175, 1319, 1568, 1976].forEach((f, i) => tone(f, { decay: 0.5, gain: 0.06, delay: i * 0.05 })),
    // ống xăm lắc: que tre va nhau lách cách
    rattle: () => { for (let i = 0; i < 3; i += 1) noise({ decay: 0.025, gain: 0.18, freq: 2200 + Math.random() * 1800, q: 6, delay: i * 0.035 }); },
    horn: () => { tone(98, { type: 'sawtooth', attack: 0.08, decay: 1.2, gain: 0.22, lowpass: 600 }); tone(147, { type: 'sawtooth', attack: 0.08, decay: 1.2, gain: 0.12, lowpass: 600 }); },
    chirp: () => tone(2600 + Math.random() * 600, { decay: 0.08, gain: 0.08, slide: 1.4 }),
    coin: () => { tone(1568, { type: 'square', decay: 0.08, gain: 0.05 }); tone(2093, { type: 'square', decay: 0.25, gain: 0.05, delay: 0.07 }); }
  };

  return {
    play(name) {
      SOUNDS[name]?.();
    },
    tone,
    noise,
    bell
  };
}
