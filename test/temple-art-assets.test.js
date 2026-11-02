// Tranh của Chùa: mọi khung mà cảnh có thể chọn phải có file thật và số đo hợp lệ,
// thiếu một khung là nhân vật biến mất giữa lúc diễn nghi thức.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve('public/assets/temple');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'sprites.json'), 'utf8'));
// các khung temple-devotee-sprite.js dùng (lay-sau chỉ bắt buộc với bộ có khung lạy)
const NEEDED = ['dung-sau', 'di-sau-1', 'di-sau-2', 'quy-sau', 'vai-quy-sau', 'dang-le-sau', 'dung-nghieng',
  'di-nghieng-1', 'di-nghieng-2', 'cam-huong-nghieng', 'vai-huong-nghieng'];
const sizeOk = (f) => f.w > 0.2 && f.w < 3 && f.h > 0.3 && f.h < 3 && f.ax > 0 && f.ax < 1;

test('mỗi bộ Phật tử có đủ khung cho mọi tư thế, file tồn tại, cỡ thật hợp lý', () => {
  for (const gender of ['nam', 'nu']) {
    const frames = manifest.devotee[gender];
    for (const name of NEEDED) assert.ok(frames[name], `${gender} thiếu khung ${name}`);
    for (const [name, f] of Object.entries(frames)) {
      assert.ok(fs.existsSync(path.join(root, 'devotee', gender, `${name}.webp`)), `${gender}/${name}.webp`);
      assert.ok(sizeOk(f), `${gender}/${name} cỡ lạ: ${JSON.stringify(f)}`);
      assert.ok(f.head > 0 && f.head <= f.h + 1e-6, `${gender}/${name} đỉnh đầu ngoài khung`);
    }
    // người đứng cao 1,5–1,8 m, quỳ thấp hơn đứng
    assert.ok(frames['dung-sau'].h > 1.5 && frames['dung-sau'].h < 1.8);
    assert.ok(frames['quy-sau'].h < frames['dung-sau'].h * 0.8);
  }
});

test('sư gõ mõ / thỉnh chuông đủ hai khung, nền chánh điện đúng khổ 9:16', () => {
  for (const name of ['go-mo-1', 'go-mo-2', 'thinh-chuong-1', 'thinh-chuong-2']) {
    assert.ok(manifest.monk[name], name);
    assert.ok(fs.existsSync(path.join(root, 'monk', `${name}.webp`)), name);
  }
  assert.ok(fs.existsSync(path.join(root, manifest.backdrop.file)));
  // lớp hào quang của tượng: file có thật, vùng phủ nằm trong khung hình, tâm nằm trong vùng phủ
  assert.ok(fs.existsSync(path.join(root, manifest.aura.file)));
  const [x0, y0, x1, y1] = manifest.aura.rect;
  assert.ok(x0 >= 0 && y0 >= 0 && x1 <= 1 && y1 <= 1 && x0 < x1 && y0 < y1);
  assert.ok(manifest.aura.center.every((v) => v > 0 && v < 1));
  assert.equal(manifest.backdrop.w * 16, manifest.backdrop.h * 9);
});
