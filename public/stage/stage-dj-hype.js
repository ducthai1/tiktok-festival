// Lớp "DJ" phủ lên nhạc nền file (Sàn Nhảy) cho giống live bar: bass dày + nhạc "bơm" theo từng phách (kiểu sidechain),
// và cứ 16 ô nhịp có một khoảnh khắc xoay vòng: giọng MC cổ động (VieNeu, có vang) · vút lên rồi nổ + hò reo · giật cắt
// nhạc + cào đĩa · kèn hơi. Chỉ dùng tiếng tự tổng hợp / Mixkit / VieNeu có sẵn — không dùng nhạc có bản quyền.
// Khoảnh khắc bị bỏ qua khi đang có giọng cảm ơn / hiệu ứng quà (nhạc đang bị hạ) hoặc đang phát nhạc riêng của quà lớn.
export const SHOUTS = ['Quẩy lên nào!', 'Cả sàn giơ tay lên!', 'Lên lên lên!', 'Bass đâu rồi!', 'Anh em đâu rồi!',
  'Không say không về!', 'Nhảy hết mình đi!', 'Sàn nhảy cháy lên nào!'];
const MC_VOICE = 'Hải Đăng';
const PHRASE_BEATS = 64; // 16 ô nhịp
const MOMENTS = ['shout', 'drop', 'shout', 'stutter', 'shout', 'horn'];
const PUMP_DEPTH = 0.26; // mỗi phách nhạc hụt xuống 74 % rồi dâng lại
const LOOKAHEAD_S = 0.45;
const BASS_DB = 5;
const TRIM = 0.5;
const SHOUT_RATE = 1.15; // nhanh + cao hơn giọng đọc thường → nghe hăng như MC

/** Phách đầu câu nhạc 16 ô kế tiếp (bỏ câu đầu bài — đoạn vào bài để nhạc tự chạy). */
export function nextPhraseBeat(beat) {
  return Math.max(PHRASE_BEATS, Math.ceil((beat + 1e-6) / PHRASE_BEATS) * PHRASE_BEATS);
}

export function createDjHype(ctx, { input, output, voiceOut, play, duck, quietUntil, groove, shoutsOn, active }) {
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
  // bộ nén của trình duyệt TỰ BÙ âm lượng (đo OBS: nhạc -19 → -12 dB, to hơn cả giọng cảm ơn) → hạ lại 6 dB,
  // còn to hơn bản gốc ~1,5 dB cho bass đập
  const trim = ctx.createGain();
  trim.gain.value = TRIM;
  const pump = ctx.createGain();
  // Sàn Nhảy đi đường DJ; game khác (chùa / bơi / bar) đi thẳng, không qua nén
  const wetPath = ctx.createGain();
  const dryPath = ctx.createGain();
  wetPath.gain.value = 0;
  input.connect(bass).connect(glue).connect(trim).connect(pump).connect(wetPath).connect(output);
  input.connect(dryPath).connect(output);

  // giọng MC: chủ yếu giọng khô, chỉ một tiếng vọng ngắn và nhỏ (user 05/11: "đừng vọng quá" — bản vang lặp 0,33 bị chê)
  // tông cổ vũ mạnh + cao (user 05/11): nâng cao độ (phát nhanh hơn ~2,5 nửa cung), đẩy dải 3 kHz cho giọng sắc và
  // nén mạnh cho chắc tiếng; giới hạn đỉnh ở master vẫn chặn vỡ tiếng
  const voice = ctx.createGain();
  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 3000;
  presence.Q.value = 0.9;
  presence.gain.value = 5;
  const punch = ctx.createDynamicsCompressor();
  punch.threshold.value = -26;
  punch.knee.value = 4;
  punch.ratio.value = 4;
  punch.attack.value = 0.003;
  punch.release.value = 0.1;
  const shoutOut = ctx.createGain();
  shoutOut.gain.value = 0.9; // đo OBS ở 0,6: câu hô chỉ ngang giọng cảm ơn (-15 dB) → nâng ~3,5 dB cho nổi hẳn trên nhạc
  presence.connect(punch).connect(shoutOut).connect(voiceOut);
  const echo = ctx.createDelay(1);
  echo.delayTime.value = 0.18;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.1;
  const wet = ctx.createBiquadFilter();
  wet.type = 'highpass';
  wet.frequency.value = 900;
  const wetLevel = ctx.createGain();
  wetLevel.gain.value = 0.25;
  voice.connect(presence);
  voice.connect(echo).connect(wet).connect(feedback).connect(echo);
  wet.connect(wetLevel).connect(voiceOut);

  const shouts = new Map(); // câu → AudioBuffer (tải dần, máy chủ tạo + giữ sẵn)
  let warmIndex = 0;
  let scheduledUntil = 0; // giờ (ctx) của phách cuối đã đặt lịch "bơm"
  let plannedPhrase = ''; // câu nhạc đã đặt khoảnh khắc (bpm:phách)
  let lastBeat = 0;
  let moment = 0;

  async function warmNextShout() {
    if (warmIndex >= SHOUTS.length || !shoutsOn()) return;
    const text = SHOUTS[warmIndex++];
    try {
      const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(MC_VOICE)}`);
      if (res.ok) shouts.set(text, await ctx.decodeAudioData(await res.arrayBuffer()));
    } catch {
      // chưa có giọng — lần sau thử câu khác
    }
  }

  function shoutAt(at) {
    const ready = [...shouts.values()];
    if (!ready.length || !shoutsOn()) return false;
    const buffer = ready[Math.floor(Math.random() * ready.length)];
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = SHOUT_RATE;
    src.connect(voice);
    src.start(at);
    const wait = Math.max(0, at - ctx.currentTime);
    setTimeout(() => duck(0.45, buffer.duration / SHOUT_RATE + 0.4), wait * 1000); // nhạc lùi cho câu hô nổi hẳn lên
    return true;
  }

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
    let kind = MOMENTS[moment++ % MOMENTS.length];
    if (kind === 'shout' && !shouts.size) kind = 'drop'; // câu hô chưa tải xong
    console.error(`[dj] ${kind}`); // OBS chỉ chép lỗi của trang vào log → tra được khoảnh khắc nào đã vang
    const lead = downbeat - ctx.currentTime;
    if (kind === 'shout' && shoutAt(downbeat)) return;
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
  setInterval(() => void warmNextShout(), 6000); // tải dần từng câu hô, không dồn máy chủ giọng đọc
  void warmNextShout();
}
