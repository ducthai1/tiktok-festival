// Nhạc nền tự tổng hợp theo game (không dùng bài hát có bản quyền), lên lịch trước 120 ms
// theo đồng hồ của AudioContext nên nhịp đều kể cả khi trang bận vẽ 3D.
import { createSynth } from './stage-sfx.js';

const BAR_ROOTS = [55, 43.65, 65.41, 49];
const BAR_CHORDS = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]];
const PENTA = [523, 587, 659, 784, 880, 1047, 880, 784];
const DANCE_ROOTS = [55, 65.41, 49, 58.27];
const DANCE_CHORDS = [[440, 523.3, 659.3], [523.3, 659.3, 784], [392, 493.9, 587.3], [466.2, 587.3, 698.5]];
const DANCE_ARP = [880, 1046.5, 1318.5, 1046.5, 1568, 1318.5, 1046.5, 784];

// 🎄 Nhạc Giáng sinh: giai điệu dân gian ĐÃ HẾT bản quyền (Jingle Bells 1857, We Wish You a Merry Christmas, Deck the Halls),
// tự chơi bằng chuông + bass nhẹ + lục lạc xe tuần lộc — không dùng bản thu âm của ai. [nốt MIDI, số phách]
const XMAS_SONGS = [
  { root: 48, notes: [[76, 1], [76, 1], [76, 2], [76, 1], [76, 1], [76, 2], [76, 1], [79, 1], [72, 1.5], [74, 0.5], [76, 4],
    [77, 1], [77, 1], [77, 1.5], [77, 0.5], [77, 1], [76, 1], [76, 1], [76, 0.5], [76, 0.5], [76, 1], [74, 1], [74, 1], [76, 1], [74, 2], [79, 2],
    [76, 1], [76, 1], [76, 2], [76, 1], [76, 1], [76, 2], [76, 1], [79, 1], [72, 1.5], [74, 0.5], [76, 4],
    [77, 1], [77, 1], [77, 1.5], [77, 0.5], [77, 1], [76, 1], [76, 1], [76, 0.5], [76, 0.5], [79, 1], [79, 1], [77, 1], [74, 1], [72, 4]] },
  { root: 43, notes: [[74, 1], [79, 1], [79, 0.5], [81, 0.5], [79, 0.5], [78, 0.5], [76, 1], [72, 1], [76, 1], [81, 1], [81, 0.5], [83, 0.5],
    [81, 0.5], [79, 0.5], [78, 1], [74, 1], [74, 1], [83, 1], [83, 0.5], [84, 0.5], [83, 0.5], [81, 0.5], [79, 1], [76, 1], [74, 0.5], [74, 0.5],
    [76, 1], [81, 1], [78, 1], [79, 3]] },
  { root: 48, notes: [[79, 1.5], [77, 0.5], [76, 1], [74, 1], [72, 1], [74, 1], [76, 1], [72, 1], [74, 0.5], [76, 0.5], [77, 0.5], [74, 0.5],
    [76, 1.5], [74, 0.5], [72, 1], [71, 1], [72, 2], [74, 1.5], [76, 0.5], [77, 1], [74, 1], [76, 1.5], [77, 0.5], [79, 1], [74, 1],
    [76, 0.5], [78, 0.5], [79, 1], [81, 0.5], [83, 0.5], [84, 1], [83, 1], [81, 1], [79, 2], [79, 1.5], [77, 0.5], [76, 1], [74, 1],
    [72, 1], [74, 1], [76, 1], [72, 1], [81, 0.5], [81, 0.5], [81, 0.5], [81, 0.5], [79, 1.5], [77, 0.5], [76, 1], [74, 1], [72, 4]] }
];
// 💐 20/11: giai điệu hộp nhạc nhẹ nhàng TỰ SOẠN (ngũ cung, nhịp 3/4) — không phải bài hát của ai
const TEACHER_SONGS = [
  { root: 48, notes: [[76, 1], [79, 1], [81, 1], [79, 2], [76, 1], [74, 1], [76, 1], [79, 1], [72, 3], [76, 1], [79, 1], [84, 1], [81, 2], [79, 1],
    [76, 1], [74, 1], [72, 1], [74, 3], [79, 1], [81, 1], [84, 1], [86, 2], [84, 1], [81, 1], [79, 1], [76, 1], [79, 3],
    [81, 1], [79, 1], [76, 1], [74, 2], [76, 1], [79, 1], [76, 1], [74, 1], [72, 3]] }
];
const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);
// dàn thành từng ô 1/16 phách: ô nào bắt đầu nốt nào, bài nào (để bass theo đúng giọng), nghỉ 1 ô nhịp giữa các bài
const buildSteps = (songs) => {
  const steps = [];
  for (const song of songs) {
    for (const [note, beats] of song.notes) {
      const len = Math.round(beats * 4);
      steps.push({ note, len, root: song.root });
      for (let i = 1; i < len; i += 1) steps.push({ root: song.root });
    }
    for (let i = 0; i < 16; i += 1) steps.push({ root: song.root });
  }
  return steps;
};
const XMAS_STEPS = buildSteps(XMAS_SONGS);
const TEACHER_STEPS = buildSteps(TEACHER_SONGS);

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
    xmas: {
      bpm: 116,
      play(i, time) {
        const d = at(time);
        const step = XMAS_STEPS[i % XMAS_STEPS.length];
        if (step.note) {
          s.bell(midiHz(step.note), { gain: 0.06, length: Math.min(2.4, 0.35 + step.len * 0.12), delay: d }); // chuông giai điệu
          s.tone(midiHz(step.note + 12), { type: 'triangle', decay: 0.12, gain: 0.012, delay: d }); // hộp nhạc lấp lánh
        }
        const k = i % 8;
        if (k === 0) s.tone(midiHz(step.root), { type: 'triangle', decay: 0.5, gain: 0.09, lowpass: 600, delay: d }); // bass giọng của bài
        if (k === 4) s.tone(midiHz(step.root + 7), { type: 'triangle', decay: 0.4, gain: 0.06, lowpass: 600, delay: d });
        if (i % 2 === 0) s.noise({ decay: 0.05, gain: k % 4 === 2 ? 0.05 : 0.02, type: 'highpass', freq: 8500, delay: d }); // lục lạc
      }
    },
    teacher: {
      bpm: 92,
      play(i, time) {
        const d = at(time);
        const step = TEACHER_STEPS[i % TEACHER_STEPS.length];
        if (step.note) {
          s.bell(midiHz(step.note), { gain: 0.05, length: Math.min(2.6, 0.5 + step.len * 0.14), delay: d }); // hộp nhạc
          s.tone(midiHz(step.note - 12), { type: 'triangle', decay: 0.3, gain: 0.015, delay: d });
        }
        const k = i % 12; // 3/4: mỗi ô nhịp 12 ô 1/16
        if (k === 0) [0, 7, 16].forEach((n) => s.tone(midiHz(step.root + n), { type: 'triangle', decay: 1.1, gain: 0.04, lowpass: 900, delay: d }));
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
      if (theme === name) return;
      this.stop(); // game không có nhạc tổng hợp (đố vui) → tắt nhạc của game trước
      if (!THEMES[name]) return;
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
