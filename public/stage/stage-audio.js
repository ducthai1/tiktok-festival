// Âm thanh tự tổng hợp bằng WebAudio (không dùng file nhạc có bản quyền): hiệu ứng + nhạc nền theo game,
// cộng giọng đọc (stage-speech.js: VieNeu-TTS của máy chủ, dự phòng giọng trình duyệt) cho lời cảm ơn/khấn/quẻ/chào.
import { createMusic } from './stage-music.js';
import { createTrackPlayer } from './stage-track-player.js';
import { createSamplePlayer } from './stage-sample-player.js';
import { createSpeech } from './stage-speech.js';
import { isCleanForDisplay } from '../shared/profanity-filter.js';
import { createSynth } from './stage-sfx.js';

export function createStageAudio() {
  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let analyser = null;
  let synth = null;
  let music = null;
  let tracks = null; // nhạc file (Sàn Nhảy); không có thì dùng nhạc tổng hợp
  let samples = null; // tiếng hiệu ứng thu sẵn (Sàn Nhảy); thiếu file thì dùng tiếng tổng hợp
  let duckGain = null; // hạ nhỏ nhạc nền tạm thời (thẻ quà lớn, giọng đọc) mà không đụng mức âm lượng cài đặt
  let duckLevel = 1;
  let duckUntil = 0;
  let theme = '';
  const opts = { sound: true, volume: 0.6, music: true, musicVolume: 0.35, tts: false, ttsWelcome: false, ttsVoice: 'Ngọc Huyền' };

  function audio() {
    if (!ctx) {
      ctx = new AudioContext();
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.ratio.value = 6;
      master = ctx.createGain();
      sfxBus = ctx.createGain();
      musicBus = ctx.createGain();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      duckGain = ctx.createGain();
      sfxBus.connect(master);
      musicBus.connect(duckGain).connect(master);
      master.connect(limiter).connect(analyser).connect(ctx.destination);
      synth = createSynth(ctx, sfxBus);
      music = createMusic(ctx, musicBus);
      tracks = createTrackPlayer(ctx, musicBus);
      samples = createSamplePlayer(ctx, sfxBus);
      if (theme) samples.setTheme(theme);
      applyLevels();
    }
    if (ctx.state === 'suspended') ctx.resume().then(applyLevels).catch(() => {});
    return ctx;
  }

  function applyLevels() {
    if (!ctx) return;
    const t = ctx.currentTime;
    sfxBus.gain.setTargetAtTime(opts.sound ? opts.volume : 0, t, 0.05);
    musicBus.gain.setTargetAtTime(opts.sound && opts.music ? opts.musicVolume : 0, t, 0.3);
    const wanted = () => theme && opts.sound && opts.music && ctx.state === 'running';
    if (!wanted()) {
      music.stop();
      tracks.stop();
      return;
    }
    const name = theme;
    tracks.available(name).then((has) => {
      if (!wanted() || theme !== name) return;
      if (has) {
        music.stop();
        tracks.start(name);
      } else {
        tracks.stop();
        music.start(name);
      }
    });
  }

  /** Hạ nhạc nền còn `level` (0..1) trong `seconds` giây rồi trả lại — để tiếng kèn / giọng đọc nổi lên. */
  function duck(level = 0.35, seconds = 3) {
    if (!duckGain) return;
    const t = ctx.currentTime;
    // hai lần hạ chồng nhau (tiếng quà rồi thẻ quà): giữ mức NHỎ hơn tới lúc kết thúc MUỘN hơn
    duckLevel = t < duckUntil ? Math.min(level, duckLevel) : level;
    duckUntil = Math.max(duckUntil, t + seconds);
    duckGain.gain.cancelScheduledValues(t);
    duckGain.gain.setTargetAtTime(duckLevel, t, 0.08);
    duckGain.gain.setTargetAtTime(1, duckUntil, 0.4);
  }

  const speech = createSpeech({ context: audio, output: () => master, duck,
    options: () => ({ voice: opts.ttsVoice, gain: Math.min(1, opts.volume + 0.3) }) });

  return {
    // Trình duyệt thường chặn âm thanh tới khi người dùng bấm vào trang; OBS thì không chặn.
    unlock() {
      try {
        audio();
        ctx.resume().then(applyLevels).catch(() => {});
        if ('speechSynthesis' in window) speechSynthesis.speak(new SpeechSynthesisUtterance(''));
      } catch {
        // không có WebAudio — bỏ qua
      }
    },
    play(name, options = {}) {
      if (!opts.sound) return;
      try {
        audio();
        if (samples.play(name, options)) return;
        if (options.delay) setTimeout(() => synth.play(name), options.delay * 1000);
        else synth.play(name);
      } catch {
        // âm thanh bị chặn khi chưa có thao tác — bỏ qua
      }
    },
    duck,
    /** Nhạc riêng cho khoảnh khắc lớn (vip / star / festival / drop) trong `ms` — false nếu không có / nhạc đang tắt. */
    special(kind, ms) {
      if (!tracks || !opts.sound || !opts.music || ctx?.state !== 'running') return false;
      return tracks.special(kind, ms);
    },
    // Nhạc nền theo game (bar / swim / temple); đổi game là đổi nhạc.
    setTheme(name) {
      theme = name;
      if (ctx) {
        samples.setTheme(name);
        applyLevels();
      }
    },
    // Phách của nhạc nền đang phát (null khi tắt tiếng / chưa có nhạc) — cảnh tự đếm nhịp riêng khi null.
    beat() {
      if (!music || ctx?.state !== 'running') return null;
      return tracks.playing() ? tracks.beat() : music.beat();
    },
    speak(text, channel = 'story') {
      const allowed = channel === 'welcome' ? opts.ttsWelcome : opts.tts;
      if (!allowed || !opts.sound) return;
      if (!isCleanForDisplay(text)) return; // câu còn sót từ tục tĩu / link / số điện thoại thì không đọc
      speech.say(text);
    },
    configure(settings) {
      Object.assign(opts, {
        sound: settings.sound !== false,
        volume: Number.isFinite(settings.volume) ? settings.volume : 0.6,
        music: settings.music !== false,
        musicVolume: Number.isFinite(settings.musicVolume) ? settings.musicVolume : 0.35,
        tts: settings.tts === true,
        ttsWelcome: settings.ttsWelcome === true,
        ttsVoice: typeof settings.ttsVoice === 'string' ? settings.ttsVoice : 'Ngọc Huyền'
      });
      if (!opts.tts && !opts.ttsWelcome) speech.clear();
      applyLevels();
    },
    // Đo mức âm thật đang phát ra (0..1) — để kiểm tra "có tiếng" bằng máy, không phải đoán.
    level() {
      if (!analyser) return 0;
      const data = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(data);
      return Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);
    },
    state: () => (ctx ? ctx.state : 'none'),
    specialKind: () => tracks?.specialKind() || ''
  };
}
