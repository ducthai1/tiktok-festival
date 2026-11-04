// Tiếng hiệu ứng THU SẴN (file mp3 Mixkit, giấy phép miễn phí kể cả thương mại): kèn đồng, đám đông hò reo, còi jackpot,
// pháo hoa, trực thăng… Danh sách từng game ở /static/assets/<game>/sfx/sfx.json { tên: file }. Nạp + giải mã sẵn khi vào
// game (lần phát đầu không bị trễ), giữ trong bộ nhớ. Game không có file nào thì play() trả false → nơi gọi dùng tiếng
// tổng hợp (stage-sfx.js) như cũ.
const MANIFESTS = { dance: '/static/assets/dance/sfx/' };

export function createSamplePlayer(ctx, out) {
  const files = new Map(); // tên → url
  const buffers = new Map(); // url → Promise<AudioBuffer | null>
  let theme = '';

  function buffer(url) {
    if (!buffers.has(url)) {
      buffers.set(url, fetch(url).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)).catch(() => null));
    }
    return buffers.get(url);
  }

  return {
    async setTheme(name) {
      if (name === theme) return;
      theme = name;
      files.clear();
      const base = MANIFESTS[name];
      if (!base) return;
      try {
        const list = await (await fetch(`${base}sfx.json`)).json();
        if (theme !== name) return;
        for (const [key, file] of Object.entries(list)) files.set(key, base + file);
        for (const url of files.values()) buffer(url);
      } catch {
        files.clear();
      }
    },
    has: (name) => files.has(name),
    /**
     * Phát `name` sau `delay` giây, âm lượng `gain`. false = game này không có file đó.
     * loop + duration: phát lặp trong `duration` giây rồi nhỏ dần tắt; rates: [[giây, tốc độ], …] đổi tốc độ (= cao độ)
     * theo thời gian — tiếng động cơ rồ lên / hạ xuống.
     */
    play(name, { gain = 1, delay = 0, loop = false, duration = 0, rates = null } = {}) {
      const url = files.get(name);
      if (!url) return false;
      const at = ctx.currentTime + delay;
      buffer(url).then((buf) => {
        if (!buf) return;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const level = ctx.createGain();
        level.gain.value = gain;
        src.connect(level).connect(out);
        const start = Math.max(ctx.currentTime, at);
        src.loop = loop;
        if (rates?.length) {
          src.playbackRate.setValueAtTime(rates[0][1], start);
          for (const [sec, rate] of rates.slice(1)) src.playbackRate.linearRampToValueAtTime(rate, start + sec);
        }
        src.start(start);
        if (duration) {
          level.gain.setValueAtTime(gain, start + Math.max(0, duration - 0.9));
          level.gain.linearRampToValueAtTime(0, start + duration);
          src.stop(start + duration + 0.05);
        }
      });
      return true;
    }
  };
}
