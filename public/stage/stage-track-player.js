// Nhạc nền bằng FILE (bài house/EDM có giấy phép dùng tự do) cho từng game — hiện dùng cho Sàn Nhảy.
// Danh sách ở /static/assets/dance/music/tracks.json: { tên: { file, bpm, firstBeat } }. Không có file thì trả về
// available()=false và game dùng nhạc tổng hợp như cũ. Phát qua musicBus nên âm lượng/tắt nhạc ở trang điều khiển vẫn áp dụng.
// beat() theo đúng thời điểm bài đang phát (BPM + nhịp đầu đã đo sẵn) để nhân vật nhảy khớp nhạc.
const PLAYLISTS = { dance: '/static/assets/dance/music/' };

export function createTrackPlayer(ctx, out) {
  const lists = new Map(); // theme → [{ url, bpm, firstBeat }]
  const audio = new Audio();
  audio.preload = 'auto';
  const source = ctx.createMediaElementSource(audio);
  source.connect(out);
  let theme = '';
  let current = null;
  let order = [];

  async function load(name) {
    if (lists.has(name)) return lists.get(name);
    lists.set(name, []);
    try {
      const base = PLAYLISTS[name];
      const meta = await (await fetch(`${base}tracks.json`)).json();
      lists.set(name, Object.values(meta).map((t) => ({ url: `${base}${t.file}`, bpm: t.bpm, firstBeat: t.firstBeat || 0 })));
    } catch {
      lists.set(name, []);
    }
    return lists.get(name);
  }

  function next() {
    const list = lists.get(theme) || [];
    if (!list.length) return;
    if (!order.length) order = list.map((_, i) => i).sort(() => Math.random() - 0.5); // trộn bài, hết lượt mới lặp lại
    current = list[order.shift()];
    audio.src = current.url;
    audio.play().catch(() => {});
  }
  audio.addEventListener('ended', next);
  audio.addEventListener('error', () => setTimeout(next, 1000));

  return {
    /** Có danh sách nhạc file cho game này không (tải tracks.json lần đầu). */
    async available(name) {
      return Boolean(PLAYLISTS[name]) && (await load(name)).length > 0;
    },
    start(name) {
      if (theme === name && !audio.paused) return;
      theme = name;
      order = [];
      next();
    },
    stop() {
      theme = '';
      current = null;
      audio.pause();
    },
    playing: () => Boolean(current) && !audio.paused,
    beat() {
      if (!current || audio.paused) return null;
      return ((audio.currentTime - current.firstBeat) * current.bpm) / 60;
    }
  };
}
