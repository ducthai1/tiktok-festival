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
    /** Phát `name` sau `delay` giây, âm lượng `gain`. false = game này không có file đó. */
    play(name, { gain = 1, delay = 0 } = {}) {
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
        src.start(Math.max(ctx.currentTime, at));
      });
      return true;
    }
  };
}
