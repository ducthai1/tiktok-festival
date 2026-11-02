// Hai vị sư vẽ tay ở tiền cảnh: sư gõ mõ (góc trái) hiện ra khi có người thả tim và ngồi lại tới khi
// hết tim một lúc; sư thỉnh chuông (góc phải) trồi lên mỗi lần có follow/share, đánh chuông có vòng
// sóng âm vàng rồi lui xuống. Mỗi động tác là đổi khung vẽ (dùi giơ lên / dùi chạm mõ, gỗ chạm chuông).
import * as THREE from '/vendor/three/three.module.js';
import { templeArt } from './temple-art.js';
import { depthScale, floorPoint } from './temple-view.js';

const MO_STAY = 7; // giây ngồi lại sau lần thả tim cuối
const BELL_STAY = 4.6;

function spriteOf(frame, height) {
  const material = new THREE.MeshBasicMaterial({ map: frame.texture, transparent: true, alphaTest: 0.06, color: '#f4e2cf' });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), material);
  mesh.scale.set((frame.w / frame.h) * height, height, 1);
  return mesh;
}

export function createTempleMonks(scene) {
  const art = templeArt().monk;
  // mõ: ngồi sát mép trái hàng trước; chuông: khung chuông đứng mép phải (một phần ra ngoài khung hình)
  // (cao ~12% và ~15% khung hình, sát mép, ngay trên bảng chú thích/gợi ý ở đáy)
  const moSpot = floorPoint(0.13, 0.812);
  const bellSpot = floorPoint(0.805, 0.84);
  const mo = spriteOf(art['go-mo-1'], 0.75 * depthScale(-moSpot.z));
  const bell = spriteOf(art['thinh-chuong-1'], 0.92 * depthScale(-bellSpot.z));
  mo.position.copy(moSpot);
  bell.position.copy(bellSpot);
  mo.visible = bell.visible = false;
  mo.userData.shown = bell.userData.shown = 0;
  scene.add(mo, bell);

  let clock = 0;
  let moLast = -99;
  let moHit = -99;
  let bellAt = -99;
  const hits = [];

  // hiện dần kèm nhích lên một chút / mờ dần rồi ẩn
  function slide(mesh, groundY, target, dt) {
    const k = (mesh.userData.shown += ((target ? 1 : 0) - mesh.userData.shown) * Math.min(1, dt * (target ? 6 : 3)));
    mesh.material.opacity = Math.min(1, k * 1.15);
    mesh.position.y = groundY - (1 - k) * mesh.scale.y * 0.18;
    mesh.visible = k > 0.02;
  }

  return {
    /** Một tiếng mõ (thả tim). */
    strikeMo() {
      moLast = clock;
      if (clock - moHit > 0.22) moHit = clock;
    },
    /** Thỉnh chuông; trả về vị trí quả chuông để vẽ vòng sóng âm. */
    ringBell() {
      bellAt = clock;
      hits.push(clock + 0.35);
    },
    /** Cho trình duyệt tự động kiểm tra: hai vị sư đang hiện không, ở đâu. */
    state: () => Object.fromEntries([['mo', mo], ['bell', bell]].map(([k, m]) => [k, { visible: m.visible, opacity: m.material.opacity, x: m.position.x, y: m.position.y, z: m.position.z, sx: m.scale.x, sy: m.scale.y }])),
    bellCenter: () => new THREE.Vector3(bell.position.x - bell.scale.x * 0.22, bellSpot.y + bell.scale.y * 0.55, bell.position.z),
    moCenter: () => new THREE.Vector3(mo.position.x + mo.scale.x * 0.18, moSpot.y + mo.scale.y * 0.75, mo.position.z),
    frame(t, dt, onBellHit) {
      clock = t;
      slide(mo, moSpot.y, t - moLast < MO_STAY, dt);
      slide(bell, bellSpot.y, t - bellAt < BELL_STAY, dt);
      const moFrame = t - moHit < 0.14 ? 'go-mo-2' : 'go-mo-1';
      if (mo.material.map !== art[moFrame].texture) mo.material.map = art[moFrame].texture;
      for (let i = hits.length - 1; i >= 0; i -= 1) {
        if (t >= hits[i]) {
          hits.splice(i, 1);
          onBellHit?.();
        }
      }
      const bellFrame = t - bellAt > 0.35 && t - bellAt < 1.3 ? 'thinh-chuong-2' : 'thinh-chuong-1';
      if (bell.material.map !== art[bellFrame].texture) bell.material.map = art[bellFrame].texture;
      // chuông vừa bị đánh thì rung nhẹ
      const age = t - bellAt - 0.35;
      bell.rotation.z = age > 0 && age < 2 ? Math.sin(age * 30) * 0.006 * Math.exp(-age * 2) : 0;
    }
  };
}
