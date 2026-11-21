// Dò nhịp cho bài nhạc chủ kênh tự thêm (link YouTube / tải lên). Nhạc gốc của Sàn Nhảy có BPM + nhịp đầu đo sẵn
// (tracks.json), bài tự thêm thì không ⇒ trước đây nhân vật nhảy theo đồng hồ giả 128 BPM, lệch hẳn bài đang nghe.
// Máy live không có ffmpeg để đo trước trên server, còn giải mã cả file 1 tiếng trong trình duyệt tốn ~1,3 GB RAM ⇒ đo
// NGAY LÚC PHÁT: tiếng nhạc → điểm bật (onset: trống, bass, hi-hat đánh vào) → tự tương quan tìm nhịp/phút → "răng lược"
// tìm đúng vị trí phách. File này chỉ tính toán (không DOM / WebAudio): chạy trong AudioWorklet lẫn kiểm thử Node.

const TARGET_SR = 11025; // dưới ~5 kHz là đủ thấy trống / bass / hi-hat — hạ tần số mẫu cho nhẹ
const FFT_N = 512; // cửa sổ ~46 ms
const BANDS = 24;
const F_LO = 30;
const F_HI = 5000;
// Đỉnh độ bật đến SỚM hơn tâm cửa sổ (nén log: tiếng trống vừa lọt vào nửa sau cửa sổ đã làm log vọt lên) — bù lại để
// phách tính ra trùng lúc trống đánh. Đo 21/11/2026: trống tổng hợp + tiếng kick của 9 bài Mixkit thật, còn lệch < 10 ms.
const ONSET_BIAS_S = 0.005;
// nhịp nhảy thường gặp: hai cách nghe ngang nhau (127 hay 85, 146 hay 73) thì nghiêng về cách gần nhịp này hơn
export const CENTER_BPM = 120;

function fftTables(n) {
  const bits = Math.log2(n);
  const rev = new Uint16Array(n);
  for (let i = 0; i < n; i += 1) {
    let r = 0;
    for (let b = 0; b < bits; b += 1) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  const cos = new Float64Array(n / 2);
  const sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i += 1) {
    cos[i] = Math.cos((2 * Math.PI * i) / n);
    sin[i] = -Math.sin((2 * Math.PI * i) / n);
  }
  return { rev, cos, sin };
}

function fft(re, im, { rev, cos, sin }) {
  const n = re.length;
  for (let i = 0; i < n; i += 1) {
    const j = rev[i];
    if (j > i) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let size = 2; size <= n; size *= 2) {
    const halfSize = size / 2;
    const step = n / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < halfSize; k += 1) {
        const a = start + k;
        const b = a + halfSize;
        const wr = cos[k * step];
        const wi = sin[k * step];
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}

/**
 * Bộ dò điểm bật: nhận mẫu âm thanh mono (từng khúc bao nhiêu cũng được), trả độ "bật" ~100 lần/giây = tổng phần TĂNG
 * của năng lượng (thang log) trên 24 dải tần từ 30 Hz đến 5 kHz. Khung thứ k ứng với giây timeOf(k) tính từ mẫu đầu tiên.
 */
export function createOnsetDetector(sampleRate) {
  const down = Math.max(1, Math.round(sampleRate / TARGET_SR));
  const sr = sampleRate / down;
  const hop = Math.round(sr / 100);
  const rate = sr / hop;
  const tables = fftTables(FFT_N);
  const win = Float64Array.from({ length: FFT_N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FFT_N));
  const edges = [];
  for (let b = 0; b <= BANDS; b += 1) {
    const bin = Math.round((F_LO * (F_HI / F_LO) ** (b / BANDS)) / (sr / FFT_N));
    edges.push(Math.max(bin, (edges[b - 1] ?? 0) + 1)); // dải trầm hẹp hơn 1 ô tần số thì nới ra 1 ô
  }
  const ring = new Float64Array(FFT_N);
  const re = new Float64Array(FFT_N);
  const im = new Float64Array(FFT_N);
  const level = new Float64Array(BANDS);
  let pos = 0; // chỗ ghi kế tiếp trong vòng đệm = mẫu cũ nhất
  let acc = 0;
  let accN = 0;
  let sinceFrame = 0;
  let primed = false;

  function frame() {
    for (let i = 0; i < FFT_N; i += 1) {
      re[i] = ring[(pos + i) % FFT_N] * win[i];
      im[i] = 0;
    }
    fft(re, im, tables);
    let flux = 0;
    for (let b = 0; b < BANDS; b += 1) {
      let e = 0;
      for (let k = edges[b]; k < edges[b + 1]; k += 1) e += re[k] * re[k] + im[k] * im[k];
      const l = Math.log1p(e);
      if (primed) flux += Math.max(0, l - level[b]);
      level[b] = l;
    }
    primed = true;
    return flux / BANDS;
  }

  return {
    rate,
    /** Giây (tính từ mẫu đầu tiên) của khung thứ k: tâm cửa sổ, đã bù độ sớm của điểm bật. */
    timeOf: (k) => ((k + 1) * hop - FFT_N / 2) / sr + ONSET_BIAS_S,
    push(samples) {
      const out = [];
      for (let i = 0; i < samples.length; i += 1) {
        acc += samples[i];
        accN += 1;
        if (accN < down) continue;
        ring[pos] = acc / down;
        pos = (pos + 1) % FFT_N;
        acc = 0;
        accN = 0;
        sinceFrame += 1;
        if (sinceFrame === hop) {
          sinceFrame = 0;
          out.push(frame());
        }
      }
      return out;
    }
  };
}

const lerpAt = (x, i) => {
  const a = Math.floor(i);
  const f = i - a;
  return a + 1 < x.length ? x[a] * (1 - f) + x[a + 1] * f : x[a] || 0;
};

/**
 * Nhịp/phút + vị trí phách từ chuỗi độ bật `env` (đều `rate` khung/giây). Trả null nếu không thấy nhịp nào.
 * - phase: giây (tính từ env[0]) của phách đầu tiên trong đoạn
 * - confidence: phách rõ cỡ nào (độ bật trung bình ĐÚNG phách cao hơn trung bình chung bao nhiêu độ lệch chuẩn);
 *   bài có trống ~2-5, tiếng ồn / nhạc không trống < 1
 */
export function estimateBeat(env, rate, { minBpm = 72, maxBpm = 180, centerBpm = CENTER_BPM } = {}) {
  const n = env.length;
  const minLag = Math.floor((rate * 60) / maxBpm);
  const maxLag = Math.ceil((rate * 60) / minBpm);
  if (n < maxLag * 4) return null;
  // 1) bỏ nền: trừ trung bình trượt ±0,25 s, chỉ giữ phần nhô lên (cú đánh)
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i += 1) pre[i + 1] = pre[i] + env[i];
  const h = Math.round(rate * 0.25);
  const x = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const a = Math.max(0, i - h);
    const b = Math.min(n, i + h + 1);
    x[i] = Math.max(0, env[i] - (pre[b] - pre[a]) / (b - a));
  }
  // 2) tự tương quan: trễ bao nhiêu khung thì chuỗi trùng chính nó nhất = một phách. Giữ 3 đỉnh mạnh nhất làm ứng viên.
  const r = new Float64Array(maxLag + 2);
  for (let lag = minLag - 1; lag <= maxLag + 1; lag += 1) {
    let s = 0;
    for (let i = 0; i + lag < n; i += 1) s += x[i] * x[i + lag];
    r[lag] = s / (n - lag);
  }
  const prior = (bpm) => Math.exp(-0.5 * (Math.log2(bpm / centerBpm) / 0.9) ** 2);
  const peaks = [];
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    if (r[lag] < r[lag - 1] || r[lag] < r[lag + 1] || !(r[lag] > 0)) continue;
    const [ra, rb, rc] = [r[lag - 1], r[lag], r[lag + 1]];
    const bend = ra - 2 * rb + rc;
    const exact = lag + (bend < 0 ? Math.max(-0.5, Math.min(0.5, (ra - rc) / (2 * bend))) : 0);
    peaks.push({ lag: exact, score: r[lag] * prior((60 * rate) / lag) });
  }
  if (!peaks.length) return null;
  peaks.sort((a, b) => b.score - a.score);
  // 3) "răng lược": với mỗi ứng viên, thử chu kỳ ±2 % và mọi vị trí phách, xem các răng rơi trúng cú đánh tới đâu.
  //    Tự tương quan hay lẫn nhịp thật với nhịp 2/3 (127 ↔ 85 BPM: hi-hat / bass chia ba) — khi đó lược của nhịp sai chỉ
  //    trúng trống kick ở một nửa số răng, nên CHỌN THEO LƯỢC (đo thật 21/11/2026 trên nhạc Mixkit: hết lẫn).
  const xs = new Float64Array(n);
  for (let i = 0; i < n; i += 1) xs[i] = 0.5 * x[i] + 0.25 * ((x[i - 1] ?? x[i]) + (x[i + 1] ?? x[i]));
  let mean = 0;
  for (let i = 0; i < n; i += 1) mean += xs[i];
  mean /= n;
  let variance = 0;
  for (let i = 0; i < n; i += 1) variance += (xs[i] - mean) ** 2;
  const std = Math.sqrt(variance / n) || 1e-9;
  const last = (n - 1) / rate;
  const tooth = (period, phase) => {
    let s = 0;
    let m = 0;
    for (let t = phase; t <= last; t += period) {
      s += lerpAt(xs, t * rate);
      m += 1;
    }
    return m ? s / m : -Infinity;
  };
  // thô rồi mịn: bước chu kỳ 0,2 % · vị trí 10 ms, rồi quanh chỗ tốt nhất bước 0,05 % · 2,5 ms
  function comb(base) {
    let best = { period: base, phase: 0, value: -Infinity };
    for (let f = -0.02; f <= 0.02 + 1e-9; f += 0.002) {
      const period = base * (1 + f);
      for (let phase = 0; phase < period; phase += 1 / rate) {
        const value = tooth(period, phase);
        if (value > best.value) best = { period, phase, value };
      }
    }
    const coarse = best;
    for (let f = -0.002; f <= 0.002 + 1e-9; f += 0.0005) {
      const period = coarse.period * (1 + f);
      for (let d = -1 / rate; d <= 1 / rate + 1e-9; d += 0.25 / rate) {
        const phase = (((coarse.phase + d) % period) + period) % period;
        const value = tooth(period, phase);
        if (value > best.value) best = { period, phase, value };
      }
    }
    return best;
  }
  let chosen = null;
  for (const peak of peaks.slice(0, 3)) {
    const found = comb(peak.lag / rate);
    const contrast = (found.value - mean) / std;
    const score = contrast * prior(60 / found.period);
    if (!chosen || score > chosen.score) chosen = { ...found, contrast, score };
  }
  return { bpm: 60 / chosen.period, phase: chosen.phase, confidence: chosen.contrast };
}

/**
 * Phách liên tục cho cảnh: khoá theo { bpm, firstBeat } (giây trong bài). Đo lại ra kết quả hơi khác thì KHÔNG nhảy cóc:
 * giữ nguyên số phách lúc đổi rồi trượt dần về lưới phách mới trong `glideS` giây — nhân vật không giật khung.
 */
export function createBeatLock({ glideS = 2 } = {}) {
  let lock = null; // { bpm, firstBeat, shift }
  let slew = null; // { from, at }: lệch thêm `from` phách lúc `at`, giảm dần về 0
  const raw = (t) => ((t - lock.firstBeat) * lock.bpm) / 60 + lock.shift;
  const beat = (t) => {
    if (!lock) return null;
    let b = raw(t);
    if (slew) {
      const k = (t - slew.at) / glideS;
      if (k < 0 || k >= 1) slew = null; // trượt xong / người xem tua ngược
      else b += slew.from * (1 - k);
    }
    return b;
  };
  return {
    beat,
    /** Khoá nhịp mới tại giây `t` của bài; smooth=false (bài mới) thì nhận luôn, không trượt. */
    set({ bpm, firstBeat }, t, { smooth = true } = {}) {
      const before = smooth ? beat(t) : null;
      lock = { bpm, firstBeat, shift: 0 };
      slew = null;
      if (before === null) return;
      const fresh = raw(t);
      lock.shift = Math.round(before - fresh);
      const gap = before - (fresh + lock.shift); // trong khoảng ±0,5 phách
      if (Math.abs(gap) > 1e-6) slew = { from: gap, at: t };
    },
    clear() {
      lock = null;
      slew = null;
    },
    get: () => (lock ? { bpm: lock.bpm, firstBeat: lock.firstBeat } : null)
  };
}
