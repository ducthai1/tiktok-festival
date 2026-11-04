// Nhạc nền bằng FILE (bài house/EDM Mixkit, giấy phép dùng tự do) cho từng game — hiện dùng cho Sàn Nhảy.
// Danh sách ở /static/assets/dance/music/tracks.json: { tên: { file, bpm, firstBeat, hot, start?, special? } }. Không có file thì
// available()=false và game dùng nhạc tổng hợp như cũ. Phát qua musicBus nên âm lượng/tắt nhạc ở trang điều khiển vẫn áp dụng.
// - Bài thường: trộn ngẫu nhiên, hết vòng mới lặp lại.
// - Bài "special" (vip / star / festival / drop) KHÔNG phát xoay vòng — chỉ vang lên lúc quà lớn / DROP: chuyển mượt
//   (crossfade) sang đúng ĐOẠN SUNG NHẤT của bài (`hot`, đo sẵn), hết lượt thì chuyển mượt về bài đang phát dở.
// beat() theo đúng bài đang nghe (BPM + nhịp đầu đo sẵn) để nhân vật + đèn nhảy khớp nhạc.
const PLAYLISTS = { dance: '/static/assets/dance/music/' };
const FADE_S = 0.6;

/** Địa chỉ phát từ giây `seconds` (bài thường: `start` bỏ đoạn dạo đầu nhẹ; bài đặc biệt: `hot` đoạn sung nhất). */
export const seekSrc = (url, seconds) => (seconds > 0 ? `${url}#t=${seconds}` : url);

// Máy chủ game không trả từng khúc file (Range) ⇒ Chrome/OBS bỏ qua `#t=` của địa chỉ thường và phát từ 0:00.
// Tải cả file về thành blob (localhost, 2–7 MB) thì tua được. Lỗi tải ⇒ phát thẳng địa chỉ gốc (từ đầu bài, vẫn có nhạc).
async function blobSrc(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    return URL.createObjectURL(await res.blob());
  } catch {
    return url;
  }
}
const release = (src) => { if (src?.startsWith('blob:')) URL.revokeObjectURL(src); };

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
  let special = null; // { kind, timer, serial }
  let mainSrc = ''; // blob của bài thường đang phát (thả ra khi đổi bài)
  let mainSerial = 0; // lượt nạp bài thường mới nhất — lượt cũ tải xong muộn thì bỏ
  let specialSerial = 0;
  const specialSrc = new Map(); // url → Promise<blob> — bài đặc biệt tải sẵn 1 lần, giữ suốt buổi
  const warmSpecial = (url) => {
    if (!specialSrc.has(url)) specialSrc.set(url, blobSrc(url));
    return specialSrc.get(url);
  };

  async function load(name) {
    if (lists.has(name)) return lists.get(name);
    const empty = { normal: [], special: {} };
    lists.set(name, empty);
    try {
      const base = PLAYLISTS[name];
      const meta = await (await fetch(`${base}tracks.json`)).json();
      const all = Object.values(meta).map((t) => ({ url: `${base}${t.file}`, bpm: t.bpm, firstBeat: t.firstBeat || 0, hot: t.hot || 0,
        start: t.start || 0, special: t.special || '' }));
      const special = {};
      for (const t of all) if (t.special) (special[t.special] ||= []).push(t);
      lists.set(name, { normal: all.filter((t) => !t.special), special });
      for (const t of all) if (t.special) void warmSpecial(t.url); // quà lớn tới là nhạc vào ngay
    } catch {
      lists.set(name, empty);
    }
    return lists.get(name);
  }

  async function next() {
    const list = lists.get(theme)?.normal || [];
    if (!list.length) return;
    if (!order.length) order = list.map((_, i) => i).sort(() => Math.random() - 0.5); // trộn bài, hết lượt mới lặp lại
    const track = list[order.shift()];
    const mine = ++mainSerial;
    const src = track.start > 0 ? await blobSrc(track.url) : track.url;
    if (mine !== mainSerial || !theme) return release(src); // đã dừng / đã đổi bài trong lúc tải
    release(mainSrc);
    mainSrc = src;
    main.track = track;
    // OBS chỉ chép LỖI của trang vào log của nó ⇒ ghi tên bài bằng console.error để tra "bài vừa phát là bài nào"
    console.error(`[nhạc] đang phát ${track.url.split('/').pop()}`);
    main.audio.src = seekSrc(src, track.start);
    if (special) return;
    main.audio.play().catch(() => {});
    // vào bài mới (nhất là vào giữa bài) thì mở tiếng nhanh, không bật "bụp"
    main.gain.gain.cancelScheduledValues(ctx.currentTime);
    main.gain.gain.setValueAtTime(0, ctx.currentTime);
    main.gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.25);
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
      void next();
    },
    stop() {
      theme = '';
      mainSerial += 1;
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
      const track = pool[Math.floor(Math.random() * pool.length)];
      const mine = ++specialSerial;
      special = { kind, timer: setTimeout(endSpecial, ms), serial: mine };
      void warmSpecial(track.url).then((src) => {
        if (special?.serial !== mine) return; // lượt này đã hết / bị lượt khác chen trước khi tải xong
        extra.track = track;
        extra.audio.src = seekSrc(src, track.hot);
        extra.audio.play().catch(() => {});
      });
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
