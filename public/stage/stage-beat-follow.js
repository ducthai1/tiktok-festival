// Bám nhịp bài nhạc ĐANG PHÁT trên một thẻ <audio> để nhân vật Sàn Nhảy (và lớp DJ) đánh đúng phách.
// - Bài chủ kênh tự thêm (link YouTube / tải lên): không có số đo sẵn ⇒ nghe ~8 giây là khoá nhịp; lần sau phát lại bài đó
//   thì nhớ sẵn (localStorage). Trước khi khoá được (hoặc bài không có trống rõ) beat() = null ⇒ cảnh dùng đồng hồ cũ.
// - Nhạc gốc: lấy số đo sẵn trong tracks.json làm điểm xuất phát rồi tự chỉnh. Đo lại 21/11/2026 bằng hai cách độc lập
//   (bộ dò này + khớp lưới tiếng kick): 6/10 bài ghi lệch 0,5–1,45 BPM — lệch 1 BPM là sau một phút trôi hẳn một phách.
// Phách tính theo GIÂY TRONG BÀI (audio.currentTime) như nhạc gốc xưa nay; chỉnh nhịp thì trượt dần, không giật khung.
import { CENTER_BPM, createBeatLock, estimateBeat } from './stage-beat-core.js';

const WINDOW_S = 24; // đo trên 24 giây nghe gần nhất
const FIRST_S = 8; // nghe liền 8 giây mới đo lần đầu
const EVERY_S = 3;
const LOCK_CONF = 2; // khoá lần đầu / đổi sang nhịp khác: phách phải rõ (nhạc có trống ~2,5–4; không trống / ồn < 2)
const KEEP_CONF = 1.5; // đã khoá: lần đo rõ vừa phải cũng đủ để chỉnh mịn
const NEAR = 0.04; // đo lại trong ±4 % nhịp đang khoá = vẫn bài đó, chỉ chỉnh mịn
const CHANGE_AFTER = 3; // nhịp khác hẳn phải lặp lại 3 lần liền (~9 s) mới đổi — video dài nhiều bài nối nhau
const REMEMBER_UNTIL_S = 90; // chỉ nhớ nhịp đo ở đầu bài (bài sau đổi nhịp thì lần sau vẫn vào đúng từ đầu)
const STORE_PREFIX = 'nhip:';

const modules = new WeakMap(); // AudioContext → Promise nạp worklet (mỗi ngữ cảnh một lần)
function loadWorklet(ctx) {
  if (!ctx.audioWorklet || typeof AudioWorkletNode === 'undefined') return null;
  if (!modules.has(ctx)) modules.set(ctx, ctx.audioWorklet.addModule(new URL('./stage-beat-worklet.js', import.meta.url).href));
  return modules.get(ctx);
}

function pageStorage() {
  try {
    return globalThis.localStorage || null; // trang bị chặn lưu trữ thì truy cập cũng ném lỗi
  } catch {
    return null;
  }
}

const median = (list) => {
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[sorted.length >> 1];
};
const sameTempo = (a, b, tolerance) => Math.abs(a / b - 1) <= tolerance;
// Nhịp "họ hàng" của nhịp đang khoá (gấp đôi, một nửa, 3/2, 2/3): thường vẫn là bài đó, chỉ là nghe theo cách chia
// phách khác (hi-hat / bass chia ba làm 132 BPM nghe như 88). Chỉ đổi sang nếu nó gần nhịp nhảy thường gặp hơn — sửa
// lần khoá đầu bị lệch (88 → 132) nhưng không bao giờ bỏ nhịp đúng (132, hay số đo sẵn) để chạy theo cách nghe lệch.
const kinOf = (a, b) => [2, 0.5, 1.5, 2 / 3].some((m) => sameTempo(a, b * m, 0.02));
const nearerCenter = (a, b) => Math.abs(Math.log2(a / CENTER_BPM)) < Math.abs(Math.log2(b / CENTER_BPM)) - 0.05;

/**
 * @param ctx AudioContext · @param source nút nguồn của thẻ audio (createMediaElementSource) · @param media thẻ audio
 * @param key () → tên bài đang phát (đổi = bài mới) · @param seed () → { bpm, firstBeat } đo sẵn của bài, hoặc null
 */
export function createBeatFollower(ctx, source, media, { key, seed = () => null, storage = pageStorage() } = {}) {
  const lock = createBeatLock();
  let current = null;
  let segment = null; // đoạn nghe liền mạch hiện tại: { at0 (giờ âm thanh khung đầu), rate, values }
  const offsets = []; // giờ âm thanh − giây trong bài, mỗi lô một lần đo
  let nextAt = 0;
  let firstGuess = null; // lần đo rõ đầu tiên của bài chưa khoá — chờ lần sau xác nhận
  let other = null; // { bpm, n }: nhịp khác hẳn đang chờ đủ số lần
  let last = null; // lần đo gần nhất (để kiểm tra)
  let measures = 0; // số lần đã đo bài này (để kiểm tra)
  let measured = false; // đã khoá bằng chính tai nghe (không chỉ số đo sẵn / nhớ lại)

  const remembered = (name) => {
    try {
      const saved = JSON.parse(storage?.getItem(STORE_PREFIX + name) || 'null');
      return saved?.bpm > 0 && Number.isFinite(saved.firstBeat) ? saved : null;
    } catch {
      return null;
    }
  };
  const remember = (value) => {
    try {
      storage?.setItem(STORE_PREFIX + current, JSON.stringify({ bpm: +value.bpm.toFixed(3), firstBeat: +value.firstBeat.toFixed(4) }));
    } catch {
      // trình duyệt chặn lưu — lần sau đo lại từ đầu
    }
  };

  function syncTrack() {
    const name = key() || '';
    if (name === current) return;
    current = name;
    lock.clear();
    segment = null;
    offsets.length = 0;
    nextAt = 0;
    firstGuess = null;
    other = null;
    last = null;
    measures = 0;
    measured = false;
    const start = name ? remembered(name) || seed() : null;
    if (start?.bpm > 0) lock.set(start, media.currentTime, { smooth: false });
  }

  function accept(result, offset, at0) {
    const value = { bpm: result.bpm, firstBeat: at0 + result.phase - offset };
    lock.set(value, media.currentTime, { smooth: Boolean(lock.get()) });
    measured = true;
    other = null;
    if (media.currentTime < REMEMBER_UNTIL_S) remember(value);
  }

  function measure(offset) {
    const rate = segment.rate;
    const values = segment.values.slice(-Math.round(WINDOW_S * rate));
    const at0 = segment.at0 + (segment.values.length - values.length) / rate;
    const free = estimateBeat(values, rate);
    last = free;
    measures += 1;
    const held = lock.get();
    if (!held) {
      if (!free || free.confidence < LOCK_CONF) return;
      // khoá lần đầu: rất rõ thì nhận luôn, không thì chờ lần đo sau (3 s) ra cùng nhịp
      if (free.confidence >= 3 || (firstGuess && sameTempo(free.bpm, firstGuess.bpm, 0.015))) accept(free, offset, at0);
      else firstGuess = free;
      return;
    }
    const near = estimateBeat(values, rate, { minBpm: held.bpm * (1 - NEAR), maxBpm: held.bpm * (1 + NEAR), centerBpm: held.bpm });
    const changed = free && free.confidence >= LOCK_CONF && !sameTempo(free.bpm, held.bpm, NEAR)
      && (!kinOf(free.bpm, held.bpm) || nearerCenter(free.bpm, held.bpm));
    if (changed) {
      other = other && sameTempo(free.bpm, other.bpm, 0.015) ? { bpm: free.bpm, n: other.n + 1 } : { bpm: free.bpm, n: 1 };
      if (other.n >= CHANGE_AFTER) accept(free, offset, at0);
      return;
    }
    other = null;
    if (near && near.confidence >= KEEP_CONF) accept(near, offset, at0);
  }

  function onFrames({ at, rate, values }) {
    if (media.paused || media.seeking || media.ended || ctx.state !== 'running') {
      segment = null;
      offsets.length = 0;
      return;
    }
    syncTrack();
    if (!current) return;
    const offset = ctx.currentTime - media.currentTime;
    offsets.push(offset);
    if (offsets.length > 31) offsets.shift();
    const mid = median(offsets);
    if (Math.abs(offset - mid) > 0.15) { // tua / đứng hình / vừa phát lại: bắt đầu đoạn nghe mới
      segment = null;
      offsets.length = 0;
      offsets.push(offset);
      return;
    }
    if (!segment || Math.abs(at - (segment.at0 + segment.values.length / rate)) > 0.5 / rate) segment = { at0: at, rate, values: [] };
    segment.values.push(...values);
    const keep = Math.round(WINDOW_S * rate);
    if (segment.values.length > keep * 1.5) {
      const drop = segment.values.length - keep;
      segment.values.splice(0, drop);
      segment.at0 += drop / rate;
    }
    if (segment.values.length >= FIRST_S * rate && ctx.currentTime >= nextAt) {
      nextAt = ctx.currentTime + EVERY_S;
      measure(mid);
    }
  }

  // nối nguồn → bộ dò trong luồng âm thanh → (câm) → loa, để trình duyệt chịu chạy nút này
  const ready = loadWorklet(ctx);
  ready?.then(() => {
    const node = new AudioWorkletNode(ctx, 'beat-onset', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(node);
    node.connect(mute).connect(ctx.destination);
    node.port.onmessage = (event) => onFrames(event.data);
  }).catch((error) => console.error('[nhịp] không chạy được bộ dò nhịp:', error?.message || error));

  return {
    /** Phách hiện tại theo nhịp đã khoá (null = chưa khoá / đang dừng). */
    beat() {
      if (media.paused) return null;
      syncTrack();
      return lock.beat(media.currentTime);
    },
    bpm: () => lock.get()?.bpm ?? null,
    /** Để kiểm tra: nhịp đang khoá, đã tự nghe chưa, lần đo gần nhất. */
    info: () => ({ ...lock.get(), measured, measures, last: last && { bpm: +last.bpm.toFixed(2), confidence: +last.confidence.toFixed(2) } }),
    onFrames // kiểm thử Node đẩy thẳng khung vào, không qua worklet
  };
}
