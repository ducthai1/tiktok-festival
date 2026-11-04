// Nhạc nền bằng FILE (bài house/EDM Mixkit, giấy phép dùng tự do) cho từng game — hiện dùng cho Sàn Nhảy.
// Danh sách ở /static/assets/dance/music/tracks.json: { tên: { file, bpm, firstBeat, hot, special? } }. Không có file thì
// available()=false và game dùng nhạc tổng hợp như cũ. Phát qua musicBus nên âm lượng/tắt nhạc ở trang điều khiển vẫn áp dụng.
// - Bài thường: trộn ngẫu nhiên, hết vòng mới lặp lại.
// - Bài "special" (vip / star / festival / drop) KHÔNG phát xoay vòng — chỉ vang lên lúc quà lớn / DROP: chuyển mượt
//   (crossfade) sang đúng ĐOẠN SUNG NHẤT của bài (`hot`, đo sẵn), hết lượt thì chuyển mượt về bài đang phát dở.
// beat() theo đúng bài đang nghe (BPM + nhịp đầu đo sẵn) để nhân vật + đèn nhảy khớp nhạc.
const PLAYLISTS = { dance: '/static/assets/dance/music/' };
const FADE_S = 0.6;
// lượt đặc biệt cao hơn được chen ngang lượt thấp hơn đang phát (quà to cắt nhạc của DROP, không có chiều ngược lại)
const RANK = { drop: 1, vip: 2, star: 3, festival: 4 };

function deck(ctx, out) {
  const audio = new Audio();
  audio.preload = 'auto';
  const gain = ctx.createGain();
  ctx.createMediaElementSource(audio).connect(gain).connect(out);
  return { audio, gain, track: null };
}

export function createTrackPlayer(ctx, out) {
  const lists = new Map(); // theme → { normal: [...], special: { kind: [...] } }
  const main = deck(ctx, out);
  const extra = deck(ctx, out);
  extra.gain.gain.value = 0;
  extra.audio.loop = true; // lượt đặc biệt dài hơn phần còn lại của bài thì vòng lại, không im giữa chừng
  let theme = '';
  let order = [];
  let special = null; // { kind, until, timer }

  async function load(name) {
    if (lists.has(name)) return lists.get(name);
    const empty = { normal: [], special: {} };
    lists.set(name, empty);
    try {
      const base = PLAYLISTS[name];
      const meta = await (await fetch(`${base}tracks.json`)).json();
      const all = Object.values(meta).map((t) => ({ url: `${base}${t.file}`, bpm: t.bpm, firstBeat: t.firstBeat || 0, hot: t.hot || 0, special: t.special || '' }));
      const special = {};
      for (const t of all) if (t.special) (special[t.special] ||= []).push(t);
      lists.set(name, { normal: all.filter((t) => !t.special), special });
    } catch {
      lists.set(name, empty);
    }
    return lists.get(name);
  }

  function next() {
    const list = lists.get(theme)?.normal || [];
    if (!list.length) return;
    if (!order.length) order = list.map((_, i) => i).sort(() => Math.random() - 0.5); // trộn bài, hết lượt mới lặp lại
    main.track = list[order.shift()];
    main.audio.src = main.track.url;
    if (!special) main.audio.play().catch(() => {});
  }
  main.audio.addEventListener('ended', next);
  main.audio.addEventListener('error', () => setTimeout(next, 1000));

  function fade(gainNode, to) {
    const t = ctx.currentTime;
    gainNode.gain.cancelScheduledValues(t);
    gainNode.gain.setValueAtTime(gainNode.gain.value, t);
    gainNode.gain.linearRampToValueAtTime(to, t + FADE_S);
  }

  function endSpecial() {
    if (!special) return;
    clearTimeout(special.timer);
    special = null;
    fade(extra.gain, 0);
    setTimeout(() => { if (!special) extra.audio.pause(); }, FADE_S * 1000 + 50);
    if (theme && main.track) main.audio.play().catch(() => {});
    fade(main.gain, 1);
  }

  const beatOf = (d) => ((d.audio.currentTime - d.track.firstBeat) * d.track.bpm) / 60;

  return {
    /** Có danh sách nhạc file cho game này không (tải tracks.json lần đầu). */
    async available(name) {
      return Boolean(PLAYLISTS[name]) && (await load(name)).normal.length > 0;
    },
    start(name) {
      if (theme === name && (special || !main.audio.paused)) return; // đang phát nhạc VIP thì giữ nguyên bài thường đang dở
      theme = name;
      order = [];
      main.gain.gain.value = 1;
      next();
    },
    stop() {
      theme = '';
      main.track = null;
      if (special) clearTimeout(special.timer);
      special = null;
      main.audio.pause();
      extra.audio.pause();
      extra.gain.gain.value = 0;
    },
    /**
     * Phát bài đặc biệt `kind` trong `ms` mili-giây, từ đoạn sung nhất. Lượt thấp hơn không chen được lượt cao hơn đang
     * phát (chỉ kéo dài nếu cùng loại). Trả false nếu game không có bài loại đó / nhạc đang tắt.
     */
    special(kind, ms) {
      const pool = lists.get(theme)?.special[kind];
      if (!theme || !pool?.length) return false;
      if (special) {
        if (special.kind === kind) {
          clearTimeout(special.timer);
          special.timer = setTimeout(endSpecial, ms);
          return true;
        }
        if (RANK[special.kind] > RANK[kind]) return false;
        clearTimeout(special.timer);
      }
      extra.track = pool[Math.floor(Math.random() * pool.length)];
      extra.audio.src = `${extra.track.url}#t=${extra.track.hot}`;
      extra.audio.play().catch(() => {});
      special = { kind, timer: setTimeout(endSpecial, ms) };
      fade(extra.gain, 1);
      fade(main.gain, 0);
      setTimeout(() => { if (special) main.audio.pause(); }, FADE_S * 1000 + 50); // bài thường dừng tại chỗ, lát quay lại nghe tiếp
      return true;
    },
    specialKind: () => special?.kind || '',
    playing: () => (special ? !extra.audio.paused : Boolean(main.track) && !main.audio.paused),
    beat() {
      if (special && extra.track && !extra.audio.paused) return beatOf(extra);
      if (!main.track || main.audio.paused) return null;
      return beatOf(main);
    }
  };
}
