// Chuông đồng treo bên phải chánh điện, mõ gỗ đặt ở đầu phải bàn thờ ngay dưới chuông (ảnh tách từ tranh sư thỉnh
// chuông / gõ mõ). Cả hai ở cột bên PHẢI: trên điện thoại, TikTok cho quà bay vào ở nửa trái (y ~900–1150)
// và bình luận ở 70% trái (y ~1150–1700), còn hai mép bị cắt ~108px mỗi bên (màn 20:9) — mõ ở đầu trái
// bàn thờ như trước bị quà che mất.
// - Thỉnh chuông: chuông lắc như con lắc thật (tắt dần), ánh vàng loé ra từ thân chuông, hạt sáng bắn ra.
// - Gõ mõ: dùi gõ xuống, mõ nảy nhẹ, loé sáng nhỏ.
import * as THREE from '/vendor/three/three.module.js';
import { templeArt } from './temple-art.js';
import { glowSprite } from './temple-painted-hall.js';
import { screenPoint } from './temple-view.js';

const BELL = { x: 0.83, top: 0.36, depth: 10.5, height: 1.3 }; // móc treo ở (x, top); mép phải chuông < 972px (vùng điện thoại không cắt)
const MO = { x: 0.74, table: 0.522, depth: 12.3, width: 0.9 }; // mõ trên bậc trên bàn thờ, đầu phải (cạnh bình sen), ngay dưới chuông — cao hơn hàng người quỳ
const SWING = 0.17; // biên độ lắc (rad) khi bị đánh

function spriteMesh(prop, width, height, anchorX, anchorY) {
  const material = new THREE.MeshBasicMaterial({ map: prop.texture, transparent: true, alphaTest: 0.05, color: '#fff4e6' });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height).translate((0.5 - anchorX) * width, (0.5 - anchorY) * height, 0), material);
  return mesh;
}

export function createBellAndMo(scene) {
  const { props } = templeArt();

  // chuông: treo bằng dây thừng từ trần (dây chạy lên quá mép trên khung hình)
  const pivot = new THREE.Group();
  pivot.position.copy(screenPoint(BELL.x, BELL.top, BELL.depth));
  const bellH = BELL.height;
  const bellW = (bellH * props.chuong.px[0]) / props.chuong.px[1];
  const bell = spriteMesh(props.chuong, bellW, bellH, props.chuong.pivot[0], 1);
  pivot.add(bell);
  const ceiling = screenPoint(BELL.x, -0.05, BELL.depth);
  const ropeLength = ceiling.y - pivot.position.y;
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, ropeLength, 6), new THREE.MeshStandardMaterial({ color: '#4a2c14', roughness: 0.9 }));
  rope.position.set(0, ropeLength / 2 + 0.02, -0.01);
  pivot.add(rope);
  const bellGlow = glowSprite(bellW * 2.6, 0);
  bellGlow.position.set(0, -bellH * 0.55, 0.05);
  pivot.add(bellGlow);
  scene.add(pivot);

  // mõ + dùi (dùi dựng 3D: cán gỗ, đầu bọc vải sáng màu như trong tranh)
  const moW = MO.width;
  const moH = (moW * props.mo.px[1]) / props.mo.px[0];
  const moGroup = new THREE.Group();
  moGroup.position.copy(screenPoint(MO.x, MO.table, MO.depth));
  const mo = spriteMesh(props.mo, moW, moH, 0.5, 0);
  moGroup.add(mo);
  const mallet = new THREE.Group();
  mallet.position.set(moW * 0.62, moH * 1.05, 0.06);
  mallet.scale.setScalar(moW / 0.56);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.36, 8), new THREE.MeshStandardMaterial({ color: '#9a6630', roughness: 0.6 }));
  handle.rotation.z = Math.PI / 2;
  handle.position.x = -0.18;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), new THREE.MeshStandardMaterial({ color: '#efdcb4', roughness: 0.85 }));
  head.position.x = -0.37;
  mallet.add(handle, head);
  moGroup.add(mallet);
  const moGlow = glowSprite(moW * 1.6, 0);
  moGlow.position.set(0, moH * 0.7, 0.04);
  moGroup.add(moGlow);
  scene.add(moGroup);

  let clock = 0;
  let bellAt = -99;
  let moAt = -99;
  const pending = [];

  return {
    /** Một tiếng mõ (thả tim) — gõ dồn dập thì dùi vẫn kịp nhấc lên giữa hai nhát. */
    strikeMo() {
      if (clock - moAt > 0.2) moAt = clock;
    },
    /** Thỉnh chuông: 0,25 giây sau (lúc đánh) gọi onHit để phát tiếng + hiệu ứng. */
    ringBell() {
      pending.push(clock + 0.25);
    },
    bellCenter: () => bell.localToWorld(new THREE.Vector3(0, -bellH * 0.55, 0)),
    moTop: () => moGroup.localToWorld(new THREE.Vector3(0, moH * 1.05, 0)),
    state: () => ({ bell: { x: pivot.position.x, y: pivot.position.y, swing: pivot.rotation.z }, mo: { x: moGroup.position.x, y: moGroup.position.y, mallet: mallet.rotation.z } }),
    frame(t, onBellHit) {
      clock = t;
      for (let i = pending.length - 1; i >= 0; i -= 1) {
        if (t < pending[i]) continue;
        pending.splice(i, 1);
        bellAt = t;
        onBellHit?.();
      }
      // con lắc tắt dần sau mỗi lần đánh + đung đưa rất nhẹ lúc yên
      const age = t - bellAt;
      const ring = age < 7 ? SWING * Math.sin(age * 4.2) * Math.exp(-age * 0.55) : 0;
      pivot.rotation.z = ring + Math.sin(t * 0.9) * 0.008;
      bellGlow.material.opacity = age < 1.8 ? 0.95 * Math.exp(-age * 2) : 0;
      bellGlow.scale.setScalar(bellW * (2.2 + Math.min(1, age) * 1.2));
      // dùi: nhấc cao lúc nghỉ, gõ xuống trong 0,07 giây rồi nhấc lại
      const m = t - moAt;
      const down = m < 0.07 ? m / 0.07 : m < 0.26 ? 1 - (m - 0.07) / 0.19 : 0;
      mallet.rotation.z = -0.55 + down * 0.66;
      mo.scale.set(1 + (m < 0.12 ? (1 - m / 0.12) * 0.04 : 0), 1 - (m < 0.12 ? (1 - m / 0.12) * 0.05 : 0), 1);
      moGlow.material.opacity = m < 0.35 ? 0.75 * (1 - m / 0.35) : 0;
    }
  };
}
