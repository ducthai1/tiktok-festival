// DANH SÁCH NHẠC NỀN: một hàng đợi có thứ tự, trộn được cả ba nguồn —
//   youtube : tải từ link YouTube (youtube-music.js)
//   file    : chủ kênh tải lên từ máy
//   builtin : nhạc gốc Mixkit đi kèm (public/assets/dance/music/tracks.json)
// Mỗi bài bật/tắt riêng: TẮT là "để sang một bên, chưa dùng" — bài vẫn nằm trong danh sách,
// chỉ không vào vòng phát; muốn bỏ hẳn thì xoá, lúc đó file trên ổ cũng bị xoá theo.
//
// Lưu ở data/music/playlist.json; file nhạc là data/music/<id>.<đuôi>. data/ không lên git.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const MAX_ITEMS = 60;
const KINDS = new Set(['youtube', 'file', 'builtin']);

const newId = () => crypto.randomBytes(6).toString('hex');
const clean = (text, max = 120) => String(text ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

/**
 * @param {string} musicDir thư mục data/music
 * @param {string} builtinDir thư mục nhạc gốc (public/assets/dance/music) — chỉ để biết bài nào còn file
 */
export function createPlaylistStore(musicDir, builtinDir = '') {
  const file = path.join(musicDir, 'playlist.json');
  let items = [];

  const save = () => {
    try {
      fs.mkdirSync(musicDir, { recursive: true });
      fs.writeFileSync(file, `${JSON.stringify({ items }, null, 1)}\n`);
    } catch (error) {
      console.warn('[nhạc] không ghi được danh sách nhạc:', error.message);
    }
  };

  const normalize = (row) => {
    const kind = KINDS.has(row?.kind) ? row.kind : 'file';
    const id = /^[a-z0-9]{6,24}$/.test(String(row?.id || '')) ? row.id : newId();
    return {
      id,
      kind,
      title: clean(row?.title) || 'Không tên',
      // kind file/youtube: tên file trong data/music · kind builtin: tên file trong nhạc gốc
      file: clean(row?.file, 200),
      enabled: row?.enabled !== false,
      at: clean(row?.at, 40) || ''
    };
  };

  const load = () => {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      items = (Array.isArray(data?.items) ? data.items : []).map(normalize).slice(0, MAX_ITEMS);
    } catch {
      items = []; // chưa có danh sách, hoặc file hỏng
    }
    // bỏ bài mà file đã biến mất (xoá tay trong data/music) — khỏi phát ra khoảng lặng
    const before = items.length;
    items = items.filter((it) => it.kind === 'builtin' || fs.existsSync(path.join(musicDir, it.file)));
    if (items.length !== before) save();
    return items;
  };

  const diskPath = (it) => (it.kind === 'builtin' ? path.join(builtinDir, it.file) : path.join(musicDir, it.file));
  /** Địa chỉ màn hình dùng để phát. Nhạc gốc phát thẳng từ public/, nhạc riêng qua /api/music-file/<id>. */
  const urlOf = (it) => (it.kind === 'builtin' ? `/static/assets/dance/music/${it.file}` : `/api/music-file/${it.id}`);

  load();

  return {
    /** Toàn bộ danh sách (kể cả bài đang tắt) — cho trang điều khiển. */
    all: () => items.map((it) => ({ ...it, url: urlOf(it), missing: !fs.existsSync(diskPath(it)) })),
    /** Các bài ĐANG BẬT theo đúng thứ tự — cho màn hình phát. */
    playable: () => items.filter((it) => it.enabled && fs.existsSync(diskPath(it))).map((it) => ({ id: it.id, title: it.title, url: urlOf(it) })),
    find: (id) => items.find((it) => it.id === String(id)) || null,
    filePathOf(id) {
      const it = items.find((x) => x.id === String(id));
      return it && it.kind !== 'builtin' ? path.join(musicDir, it.file) : '';
    },

    /** Thêm một bài vào CUỐI danh sách. `srcFile` là file tạm sẽ được chuyển vào data/music. */
    add({ kind, title, srcFile = '', builtinFile = '' }) {
      if (items.length >= MAX_ITEMS) throw new Error(`Danh sách đã đủ ${MAX_ITEMS} bài — xoá bớt rồi thêm`);
      const id = newId();
      let name = '';
      if (kind === 'builtin') {
        name = clean(builtinFile, 200);
        if (!name || name.includes('/') || name.includes('..')) throw new Error('Tên bài gốc không hợp lệ');
        if (items.some((it) => it.kind === 'builtin' && it.file === name)) throw new Error('Bài gốc này đã có trong danh sách');
      } else {
        const ext = (String(srcFile).match(/\.[^.]+$/) || ['.m4a'])[0].toLowerCase();
        name = `${id}${ext}`;
        fs.mkdirSync(musicDir, { recursive: true });
        fs.renameSync(srcFile, path.join(musicDir, name));
      }
      const row = normalize({ id, kind, title, file: name, enabled: true, at: new Date().toISOString() });
      items.push(row);
      save();
      return row;
    },

    /** Bật / tắt một bài (tắt = để sang một bên, không xoá). */
    toggle(id, on) {
      const it = items.find((x) => x.id === String(id));
      if (!it) throw new Error('Không có bài này');
      it.enabled = on === undefined ? !it.enabled : Boolean(on);
      save();
      return it;
    },

    rename(id, title) {
      const it = items.find((x) => x.id === String(id));
      if (!it) throw new Error('Không có bài này');
      it.title = clean(title) || it.title;
      save();
      return it;
    },

    /** Dời một bài lên / xuống `delta` bậc (−1 là lên một bậc). */
    move(id, delta) {
      const at = items.findIndex((x) => x.id === String(id));
      if (at < 0) throw new Error('Không có bài này');
      const to = Math.max(0, Math.min(items.length - 1, at + (Number(delta) || 0)));
      if (to === at) return items;
      items.splice(to, 0, items.splice(at, 1)[0]);
      save();
      return items;
    },

    /** Xoá hẳn: bỏ khỏi danh sách và xoá luôn file trên ổ (nhạc gốc thì giữ file lại). */
    remove(id) {
      const at = items.findIndex((x) => x.id === String(id));
      if (at < 0) throw new Error('Không có bài này');
      const [it] = items.splice(at, 1);
      if (it.kind !== 'builtin') {
        try { fs.unlinkSync(path.join(musicDir, it.file)); } catch { /* file đã mất thì thôi */ }
      }
      save();
      return it;
    },

    reload: load
  };
}

/** Nhạc gốc đi kèm (tracks.json) — để trang điều khiển cho chọn thêm vào danh sách. */
export function builtinTracks(builtinDir) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(builtinDir, 'tracks.json'), 'utf8'));
    return Object.entries(data).map(([name, t]) => ({
      name, file: String(t?.file || ''), special: String(t?.special || ''),
      has: fs.existsSync(path.join(builtinDir, String(t?.file || '')))
    })).filter((t) => t.file);
  } catch {
    return [];
  }
}
