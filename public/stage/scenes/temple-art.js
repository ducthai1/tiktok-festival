// Tải sẵn tranh nền + sprite Phật tử + chuông/mõ của Chùa (public/assets/temple, mô tả trong sprites.json)
// TRƯỚC khi dựng cảnh, để người đầu tiên bước vào đã có hình. Ảnh nào lỗi thì thay bằng ảnh trong
// suốt 1×1: cảnh vẫn chạy, chỉ thiếu hình đó (có ghi lỗi ra console).
import * as THREE from '/vendor/three/three.module.js';

const BASE = '/static/assets/temple/';
let art = null;
let pending = null;

function loadTexture(loader, file, colorSpace = THREE.SRGBColorSpace) {
  return new Promise((resolve) => {
    loader.load(BASE + file, (texture) => {
      texture.colorSpace = colorSpace; // ảnh dữ liệu (lớp hào quang) đọc nguyên giá trị, không đổi màu
      texture.anisotropy = 4;
      texture.userData.shared = true; // dùng chung cho mọi nhân vật / mọi lần vào cảnh
      resolve(texture);
    }, undefined, () => {
      console.error('[temple] không tải được', file);
      const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
      blank.needsUpdate = true;
      blank.userData.shared = true;
      resolve(blank);
    });
  });
}

/** @returns {Promise<object>} { devotee: {nam:{tên:{w,h,ax,head,texture}}, nu:{…}}, props:{mo, chuong}, aura, backdrop } */
export function preloadTempleArt() {
  if (art) return Promise.resolve(art);
  if (pending) return pending;
  pending = (async () => {
    const manifest = await (await fetch(`${BASE}sprites.json`)).json();
    const loader = new THREE.TextureLoader();
    const jobs = [];
    for (const [gender, frames] of Object.entries(manifest.devotee)) {
      for (const [name, frame] of Object.entries(frames)) {
        jobs.push(loadTexture(loader, `devotee/${gender}/${name}.webp`).then((texture) => { frame.texture = texture; }));
      }
    }
    for (const prop of Object.values(manifest.props)) {
      jobs.push(loadTexture(loader, prop.file).then((texture) => { prop.texture = texture; }));
    }
    jobs.push(loadTexture(loader, manifest.backdrop.file).then((texture) => { manifest.backdrop.texture = texture; }));
    jobs.push(loadTexture(loader, manifest.aura.file, THREE.NoColorSpace).then((texture) => { manifest.aura.texture = texture; }));
    await Promise.all(jobs);
    art = manifest;
    return art;
  })().finally(() => { pending = null; });
  return pending;
}

/** Bộ hình đã tải (gọi sau preloadTempleArt). */
export const templeArt = () => art;
