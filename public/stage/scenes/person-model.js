// Nhân vật chibi dựng bằng hình khối (không cần file model): dùng cho khách bar,
// vận động viên bơi và Phật tử. Màu áo/tóc suy ra từ id người xem nên mỗi người một vẻ.
import * as THREE from '/vendor/three/three.module.js';

const SKINS = ['#f6d3b3', '#eec19a', '#d9a27a', '#b97f57', '#f3c9a6'];
const HAIRS = ['#1d1612', '#3a2418', '#6b3b1f', '#c9a15a', '#2b2b3a', '#8a2b4a'];

export function hashOf(text) {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}

export function colorsFor(id) {
  const h = hashOf(id);
  return {
    shirt: new THREE.Color().setHSL((h % 360) / 360, 0.65, 0.55),
    pants: new THREE.Color().setHSL(((h >> 9) % 360) / 360, 0.35, 0.28),
    skin: new THREE.Color(SKINS[(h >> 4) % SKINS.length]),
    hair: new THREE.Color(HAIRS[(h >> 7) % HAIRS.length])
  };
}

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.05, ...extra });

function limb(radius, length, material) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 10), material);
  mesh.position.y = -length / 2 - radius * 0.6;
  mesh.castShadow = true;
  const pivot = new THREE.Group();
  pivot.add(mesh);
  return pivot;
}

/** @param {{id:string, robe?:THREE.ColorRepresentation}} opts robe = áo tràng dài (chùa) */
export function buildPerson({ id, robe } = {}) {
  const c = colorsFor(id || 'x');
  const shirtMat = mat(robe || c.shirt);
  const pantsMat = mat(robe || c.pants);
  const skinMat = mat(c.skin, { roughness: 0.75 });
  const hairMat = mat(c.hair, { roughness: 0.85 });

  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.9;
  root.add(hips);

  const torso = new THREE.Group();
  hips.add(torso);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.42, 6, 14), shirtMat);
  body.position.y = 0.4;
  body.castShadow = true;
  torso.add(body);
  const head = new THREE.Group();
  head.position.y = 1.0;
  torso.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 18), skinMat);
  skull.castShadow = true;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.335, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), hairMat);
  hair.rotation.x = -0.25;
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#1a1020' });
  const eyes = [-0.11, 0.11].map((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), eyeMat);
    eye.position.set(x, 0.02, 0.29);
    return eye;
  });
  const blushMat = new THREE.MeshBasicMaterial({ color: '#ff8aa0', transparent: true, opacity: 0.55 });
  const blush = [-0.19, 0.19].map((x) => {
    const b = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), blushMat);
    b.position.set(x, -0.07, 0.3);
    return b;
  });
  head.add(skull, hair, ...eyes, ...blush);

  const armL = limb(0.09, 0.42, shirtMat);
  const armR = limb(0.09, 0.42, shirtMat);
  armL.position.set(-0.4, 0.66, 0);
  armR.position.set(0.4, 0.66, 0);
  // bàn tay thật (cầu da) ở cuối mỗi cánh tay; đồ vật (ly, nén hương, hoa…) gắn vào tay phải
  const hand = new THREE.Group();
  hand.position.y = -0.62;
  armR.add(hand);
  for (const arm of [armL, armR]) {
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), skinMat);
    palm.position.y = -0.6;
    arm.add(palm);
  }
  torso.add(armL, armR);

  const legL = limb(0.12, 0.5, pantsMat);
  const legR = limb(0.12, 0.5, pantsMat);
  legL.position.set(-0.15, 0, 0);
  legR.position.set(0.15, 0, 0);
  hips.add(legL, legR);

  if (robe) {
    // tóc búi sau gáy (một nửa số người) + cổ áo tràng sẫm màu
    if (hashOf(id) % 2) {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), hairMat);
      bun.position.set(0, 0.12, -0.3);
      head.add(bun);
    }
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 18), mat('#4b5a78'));
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.82;
    torso.add(collar);
    // áo tràng: vạt áo hình nón phủ chân khi quỳ
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.62, 0.7, 18, 1, true), pantsMat);
    skirt.position.y = 0.05;
    skirt.castShadow = true;
    hips.add(skirt);
  }

  return { root, hips, torso, head, armL, armR, legL, legR, hand, phase: (hashOf(id) % 1000) / 159 };
}

export { animatePerson, posePerson, walkTowards } from './person-poses.js';

export function disposeObject(object) {
  object.traverse((node) => {
    node.geometry?.dispose();
    const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
    for (const m of materials) {
      m.map?.dispose();
      m.dispose();
    }
  });
}
