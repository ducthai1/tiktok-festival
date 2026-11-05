// Lớp "DJ" phủ lên nhạc nền file (Sàn Nhảy) cho giống live bar: bass dày + nhạc "bơm" theo từng phách (kiểu sidechain),
// và cứ 16 ô nhịp có một khoảnh khắc xoay vòng: vút lên rồi nổ + hò reo · giật cắt nhạc + cào đĩa · kèn hơi.
// Chỉ dùng tiếng tự tổng hợp / Mixkit có sẵn — không dùng nhạc có bản quyền.
// KHÔNG có giọng MC tự hô (user bỏ 05/11: TikTok hạn chế live vì "máy móc, tự động, thiếu tương tác").
// Khoảnh khắc bị bỏ qua khi đang có giọng cảm ơn / hiệu ứng quà (nhạc đang bị hạ) hoặc đang phát nhạc riêng của quà lớn.
const PHRASE_BEATS = 64; // 16 ô nhịp
const MOMENTS = ['drop', 'stutter', 'horn'];
const PUMP_DEPTH = 0.26; // mỗi phách nhạc hụt xuống 74 % rồi dâng lại
const LOOKAHEAD_S = 0.45;
const BASS_DB = 5;
const TRIM = 0.5;

/** Phách đầu câu nhạc 16 ô kế tiếp (bỏ câu đầu bài — đoạn vào bài để nhạc tự chạy). */
export function nextPhraseBeat(beat) {
  return Math.max(PHRASE_BEATS, Math.ceil((beat + 1e-6) / PHRASE_BEATS) * PHRASE_BEATS);
}

export function createDjHype(ctx, { input, output, play, quietUntil, groove, active }) {
  const bass = ctx.createBiquadFilter();
  bass.type = 'lowshelf';
  bass.frequency.value = 110;
  bass.gain.value = BASS_DB;
  const glue = ctx.createDynamicsCompressor(); // nén nhẹ: bass dày mà không vỡ, nhạc đều tay
  glue.threshold.value = -20;
  glue.knee.value = 6;
  glue.ratio.value = 3;
  glue.attack.value = 0.01;
  glue.release.value = 0.12;
  // bộ nén của trình duyệt TỰ BÙ âm lượng (đo OBS: nhạc -19 → -12 dB, to hơn cả giọng cảm ơn) → hạ lại 6 dB
  const trim = ctx.createGain();
  trim.gain.value = TRIM;
  const pump = ctx.createGain();
  // Sàn Nhảy đi đường DJ; game khác (chùa / bơi / bar) đi thẳng, không qua nén
  const wetPath = ctx.createGain();
  const dryPath = ctx.createGain();
  wetPath.gain.value = 0;
  input.connect(bass).connect(glue).connect(trim).connect(pump).connect(wetPath).connect(output);
  input.connect(dryPath).connect(output);

  let scheduledUntil = 0; // giờ (ctx) của phách cuối đã đặt lịch "bơm"
  let plannedPhrase = ''; // câu nhạc đã đặt khoảnh khắc (bpm:phách)
  let lastBeat = 0;
  let moment = 0;

  function stutterAt(downbeat, spb) {
    const q = spb / 4; // 4 nhát cắt trong phách cuối trước câu mới
    for (let i = 0; i < 4; i += 1) {
      const t = downbeat - spb + i * q;
      pump.gain.setValueAtTime(0.08, t + q * 0.5);
      pump.gain.setValueAtTime(1, t + q);
    }
    play('scratch', { delay: Math.max(0, downbeat - spb - ctx.currentTime), gain: 0.7 });
  }

  function planMoment(downbeat, spb) {
    if (quietUntil() > ctx.currentTime || downbeat - ctx.currentTime < 0.05) return;
    const kind = MOMENTS[moment++ % MOMENTS.length];
    console.error(`[dj] ${kind}`); // OBS chỉ chép lỗi của trang vào log → tra được khoảnh khắc nào đã vang
    const lead = downbeat - ctx.currentTime;
    if (kind === 'stutter') return stutterAt(downbeat, spb);
    if (kind === 'horn') {
      play('airhorn', { delay: lead });
      play('airhorn', { delay: lead + spb * 2 });
      return;
    }
    play('riser-short', { delay: Math.max(0, lead - 1.5), gain: 0.8 }); // 'drop'
    play('impact-big', { delay: lead, gain: 0.8 });
    play('cheer-small', { delay: lead + 0.05, gain: 0.8 });
  }

  let boosted = false;
  function tick() {
    const now = ctx.currentTime;
    if (active() !== boosted) { // chỉ Sàn Nhảy đi đường DJ; nhạc chùa / bơi / bar giữ nguyên
      boosted = active();
      wetPath.gain.setTargetAtTime(boosted ? 1 : 0, now, 0.2);
      dryPath.gain.setTargetAtTime(boosted ? 0 : 1, now, 0.2);
    }
    const g = boosted ? groove() : null;
    if (!g || !Number.isFinite(g.beat) || !g.bpm) {
      scheduledUntil = now;
      return;
    }
    const spb = 60 / g.bpm;
    if (g.beat < lastBeat - 1) scheduledUntil = now; // sang bài mới
    lastBeat = g.beat;
    // "bơm" theo phách: hụt xuống đúng lúc phách vào rồi dâng lại trong nửa phách
    for (let k = Math.ceil(g.beat + 1e-6); ; k += 1) {
      const t = now + (k - g.beat) * spb;
      if (t > now + LOOKAHEAD_S) break;
      if (t <= scheduledUntil + 0.01) continue;
      pump.gain.setValueAtTime(1 - PUMP_DEPTH, t);
      pump.gain.linearRampToValueAtTime(1, t + spb * 0.55);
      scheduledUntil = t;
    }
    // khoảnh khắc đầu câu 16 ô: đặt lịch trước ~2 phách (đủ chỗ cho tiếng vút lên / nhát cắt)
    const phrase = nextPhraseBeat(g.beat);
    const key = `${g.bpm}:${phrase}`;
    const lead = (phrase - g.beat) * spb;
    if (key !== plannedPhrase && lead <= spb * 2 + LOOKAHEAD_S && lead > spb) {
      plannedPhrase = key;
      planMoment(now + lead, spb);
    }
  }

  setInterval(tick, 150);
}
