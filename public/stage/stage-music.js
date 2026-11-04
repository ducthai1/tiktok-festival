// Nhạc nền tự tổng hợp theo game (không dùng bài hát có bản quyền), lên lịch trước 120 ms
// theo đồng hồ của AudioContext nên nhịp đều kể cả khi trang bận vẽ 3D.
import { createSynth } from './stage-sfx.js';

const BAR_ROOTS = [55, 43.65, 65.41, 49];
const BAR_CHORDS = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]];
const PENTA = [523, 587, 659, 784, 880, 1047, 880, 784];
const DANCE_ROOTS = [55, 65.41, 49, 58.27];
const DANCE_CHORDS = [[440, 523.3, 659.3], [523.3, 659.3, 784], [392, 493.9, 587.3], [466.2, 587.3, 698.5]];
const DANCE_ARP = [880, 1046.5, 1318.5, 1046.5, 1568, 1318.5, 1046.5, 784];

export function createMusic(ctx, out) {
  const s = createSynth(ctx, out);
  let theme = '';
  let timer = null;
  let step = 0;
  let nextTime = 0;
  let startedAt = 0;
  let drones = [];
  const at = (time) => Math.max(0, time - ctx.currentTime);

  const THEMES = {
    bar: {
      bpm: 122,
      play(i, time) {
        const d = at(time);
        const bar = Math.floor(i / 16) % 4;
        const k = i % 16;
        if (k % 4 === 0) s.tone(150, { decay: 0.28, gain: 0.6, slide: 0.3, delay: d });
        if (k % 4 === 2) s.noise({ decay: 0.06, gain: 0.12, type: 'highpass', freq: 7000, delay: d });
        else s.noise({ decay: 0.03, gain: 0.03, type: 'highpass', freq: 9000, delay: d });
        if (k === 4 || k === 12) s.noise({ decay: 0.14, gain: 0.2, freq: 1500, q: 0.8, delay: d });
        if ([0, 3, 6, 8, 11, 14].includes(k)) {
          s.tone(BAR_ROOTS[bar] * (k === 6 || k === 14 ? 2 : 1), { type: 'sawtooth', decay: 0.2, gain: 0.16, lowpass: 420, delay: d });
        }
        if (k === 2 || k === 10) BAR_CHORDS[bar].forEach((f) => s.tone(f, { type: 'triangle', decay: 0.3, gain: 0.045, lowpass: 1800, delay: d }));
      }
    },
    // Sàn nhảy: EDM 128 BPM — trống bốn phách, hi-hat lệch phách, bass nảy, hợp âm stab; cứ 8 ô nhịp có một đoạn dồn.
    dance: {
      bpm: 128,
      play(i, time) {
        const d = at(time);
        const k = i % 16;
        const bar = Math.floor(i / 16) % 8;
        const build = bar === 7;
        if (k % 4 === 0 && !(build && k >= 8)) s.tone(160, { decay: 0.3, gain: 0.75, slide: 0.25, delay: d });
        if (k % 4 === 2) s.noise({ decay: 0.09, gain: 0.14, type: 'highpass', freq: 8000, delay: d });
        if (k === 4 || k === 12) s.noise({ decay: 0.16, gain: 0.2, freq: 1800, q: 0.9, delay: d });
        if (build && k % 2 === 0) s.noise({ decay: 0.05, gain: 0.04 + k * 0.008, freq: 2200 + k * 300, q: 1.2, delay: d });
        if (k % 4 === 2) s.tone(DANCE_ROOTS[Math.floor(bar / 2) % 4], { type: 'sawtooth', decay: 0.17, gain: 0.2, lowpass: 520, delay: d });
        if ([0, 3, 6, 10].includes(k) && !build) DANCE_CHORDS[Math.floor(bar / 2) % 4].forEach((f) => s.tone(f, { type: 'square', decay: 0.12, gain: 0.03, lowpass: 2400, delay: d }));
        if (k % 2 === 1 && bar % 2 === 1) s.tone(DANCE_ARP[(i >> 1) % DANCE_ARP.length], { type: 'triangle', decay: 0.12, gain: 0.035, delay: d });
      }
    },
    swim: {
      bpm: 110,
      play(i, time) {
        const d = at(time);
        const k = i % 16;
        if (k === 0 || k === 8) s.noise({ attack: 1.2, decay: 2.6, gain: 0.12, type: 'lowpass', freq: 380, delay: d }); // sóng vỗ
        s.noise({ decay: 0.04, gain: k % 2 ? 0.035 : 0.015, type: 'highpass', freq: 6000, delay: d }); // lắc
        if ([0, 6, 10].includes(k)) s.tone(180, { decay: 0.14, gain: 0.25, slide: 0.8, delay: d }); // trống conga
        if (k % 2 === 0) s.tone(PENTA[(i / 2) % PENTA.length], { type: 'triangle', decay: 0.28, gain: 0.045, delay: d }); // marimba
      }
    },
    temple: {
      bpm: 60,
      play(i, time) {
        const d = at(time);
        if (i % 4 === 0) s.tone(760, { decay: 0.1, gain: 0.07, slide: 0.92, delay: d }); // mõ tụng kinh, mỗi phách
        if (i % 64 === 0) s.bell(392, { gain: 0.07, length: 4, delay: d }); // chuông nhỏ ngân thưa
      },
      // nền ngân trầm liên tục, lên xuống chậm
      drone() {
        return [110, 164.8, 220].map((f, i) => {
          const osc = ctx.createOscillator();
          const amp = ctx.createGain();
          const lfo = ctx.createOscillator();
          const depth = ctx.createGain();
          osc.frequency.value = f;
          amp.gain.value = 0.035 / (i + 1);
          lfo.frequency.value = 0.07 + i * 0.03;
          depth.gain.value = 0.02 / (i + 1);
          lfo.connect(depth).connect(amp.gain);
          osc.connect(amp).connect(out);
          osc.start();
          lfo.start();
          return [osc, lfo];
        }).flat();
      }
    }
  };

  function schedule() {
    const t = THEMES[theme];
    if (!t) return;
    while (nextTime < ctx.currentTime + 0.12) {
      t.play(step, nextTime);
      nextTime += 60 / t.bpm / 4;
      step += 1;
    }
  }

  return {
    start(name) {
      if (theme === name || !THEMES[name]) return;
      this.stop();
      theme = name;
      step = 0;
      nextTime = ctx.currentTime + 0.08;
      startedAt = nextTime;
      drones = THEMES[name].drone ? THEMES[name].drone() : [];
      timer = setInterval(schedule, 25);
    },
    // Phách hiện tại của nhạc đang chơi (để nhân vật nhảy khớp nhịp); null khi không có nhạc.
    beat() {
      const t = THEMES[theme];
      return t ? ((ctx.currentTime - startedAt) * t.bpm) / 60 : null;
    },
    stop() {
      clearInterval(timer);
      timer = null;
      for (const node of drones) node.stop();
      drones = [];
      theme = '';
    }
  };
}
