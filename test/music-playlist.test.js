import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createPlaylistStore } from '../src/music/playlist-store.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nhac-'));
/** Tạo một file nhạc giả để "tải lên". */
const fakeUpload = (dir, name) => {
  const p = path.join(dir, name);
  fs.writeFileSync(p, 'giả vờ là nhạc');
  return p;
};
const titles = (store) => store.all().map((i) => i.title);

test('thêm bài vào cuối, đổi thứ tự bằng ▲▼', () => {
  const dir = tmp();
  const store = createPlaylistStore(path.join(dir, 'music'));
  fs.mkdirSync(path.join(dir, 'music'), { recursive: true });

  for (const n of ['Bài A', 'Bài B', 'Bài C']) {
    store.add({ kind: 'youtube', title: n, srcFile: fakeUpload(dir, `${n}.m4a`) });
  }
  assert.deepEqual(titles(store), ['Bài A', 'Bài B', 'Bài C']);

  const c = store.all()[2];
  store.move(c.id, -1);
  assert.deepEqual(titles(store), ['Bài A', 'Bài C', 'Bài B']);
  store.move(c.id, -1);
  assert.deepEqual(titles(store), ['Bài C', 'Bài A', 'Bài B']);
  store.move(c.id, -1); // đã ở đầu, dời nữa cũng đứng yên
  assert.deepEqual(titles(store), ['Bài C', 'Bài A', 'Bài B']);
  store.move(c.id, +99); // dời quá cuối thì kẹp lại ở cuối
  assert.deepEqual(titles(store), ['Bài A', 'Bài B', 'Bài C']);
});

test('tắt một bài = để sang một bên: vẫn trong danh sách, không vào vòng phát', () => {
  const dir = tmp();
  const store = createPlaylistStore(path.join(dir, 'music'));
  fs.mkdirSync(path.join(dir, 'music'), { recursive: true });
  for (const n of ['A', 'B']) store.add({ kind: 'file', title: n, srcFile: fakeUpload(dir, `${n}.mp3`) });

  const a = store.all()[0];
  store.toggle(a.id, false);
  assert.equal(store.all().length, 2, 'bài tắt vẫn phải còn trong danh sách');
  assert.deepEqual(store.playable().map((t) => t.title), ['B'], 'bài tắt không được vào vòng phát');

  store.toggle(a.id, true);
  assert.deepEqual(store.playable().map((t) => t.title), ['A', 'B']);
});

test('xoá hẳn thì file trên ổ cũng mất; nhạc gốc thì giữ file lại', () => {
  const dir = tmp();
  const musicDir = path.join(dir, 'music');
  const builtinDir = path.join(dir, 'goc');
  fs.mkdirSync(musicDir, { recursive: true });
  fs.mkdirSync(builtinDir, { recursive: true });
  fs.writeFileSync(path.join(builtinDir, 'goc.mp3'), 'nhạc gốc');
  const store = createPlaylistStore(musicDir, builtinDir);

  const up = store.add({ kind: 'youtube', title: 'Tải về', srcFile: fakeUpload(dir, 'x.m4a') });
  const bi = store.add({ kind: 'builtin', title: 'Bài gốc', builtinFile: 'goc.mp3' });
  assert.ok(fs.existsSync(path.join(musicDir, up.file)));

  store.remove(up.id);
  assert.ok(!fs.existsSync(path.join(musicDir, up.file)), 'xoá bài tải về phải xoá luôn file');
  store.remove(bi.id);
  assert.ok(fs.existsSync(path.join(builtinDir, 'goc.mp3')), 'xoá bài gốc KHÔNG được xoá file gốc');
});

test('bài gốc không thêm trùng; địa chỉ phát đúng nguồn', () => {
  const dir = tmp();
  const musicDir = path.join(dir, 'music');
  const builtinDir = path.join(dir, 'goc');
  fs.mkdirSync(musicDir, { recursive: true });
  fs.mkdirSync(builtinDir, { recursive: true });
  fs.writeFileSync(path.join(builtinDir, 'gear.mp3'), 'x');
  const store = createPlaylistStore(musicDir, builtinDir);

  store.add({ kind: 'builtin', title: 'gear', builtinFile: 'gear.mp3' });
  assert.throws(() => store.add({ kind: 'builtin', title: 'gear', builtinFile: 'gear.mp3' }), /đã có trong danh sách/);
  assert.throws(() => store.add({ kind: 'builtin', title: 'x', builtinFile: '../../etc/passwd' }), /không hợp lệ/);

  const up = store.add({ kind: 'file', title: 'Tải lên', srcFile: fakeUpload(dir, 'y.mp3') });
  const urls = store.playable().map((t) => t.url);
  assert.deepEqual(urls, ['/static/assets/dance/music/gear.mp3', `/api/music-file/${up.id}`]);
});

test('danh sách sống sót qua khởi động lại; bài mất file tự rụng', () => {
  const dir = tmp();
  const musicDir = path.join(dir, 'music');
  fs.mkdirSync(musicDir, { recursive: true });
  const store = createPlaylistStore(musicDir);
  const a = store.add({ kind: 'youtube', title: 'Còn', srcFile: fakeUpload(dir, 'a.m4a') });
  const b = store.add({ kind: 'youtube', title: 'Sẽ mất', srcFile: fakeUpload(dir, 'b.m4a') });
  store.toggle(a.id, false);

  fs.unlinkSync(path.join(musicDir, b.file)); // ai đó xoá tay trong data/music
  const lai = createPlaylistStore(musicDir); // server khởi động lại
  assert.deepEqual(lai.all().map((i) => i.title), ['Còn'], 'bài mất file phải tự rụng khỏi danh sách');
  assert.equal(lai.all()[0].enabled, false, 'trạng thái bật/tắt phải giữ qua khởi động lại');
});
