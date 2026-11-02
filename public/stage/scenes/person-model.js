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
  const hand = new THREE.Group();
  hand.position.y = -0.62;
  armR.add(hand);
  torso.add(armL, armR);

  const legL = limb(0.12, 0.5, pantsMat);
  const legR = limb(0.12, 0.5, pantsMat);
  legL.position.set(-0.15, 0, 0);
  legR.position.set(0.15, 0, 0);
  hips.add(legL, legR);

  if (robe) {
    // áo tràng: vạt áo hình nón phủ chân khi quỳ
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.62, 0.7, 18, 1, true), pantsMat);
    skirt.position.y = 0.05;
    skirt.castShadow = true;
    hips.add(skirt);
  }

  return { root, hips, torso, head, armL, armR, legL, legR, hand, phase: (hashOf(id) % 1000) / 159 };
}

const lerp = (a, b, k) => a + (b - a) * k;

/**
 * Đặt tư thế theo thời gian t (giây).
 * pose: idle | walk | dance | cheers | kneel | bow | swim; seated=true thì ngồi (ghế quầy) với idle/cheers.
 */
export function posePerson(p, pose, t, seated = false) {
  const s = t * 1 + p.phase;
  const reset = () => {
    p.hips.position.y = 0.9;
    p.hips.rotation.set(0, 0, 0);
    p.torso.rotation.set(0, 0, 0);
    p.head.rotation.set(0, 0, 0);
    p.armL.rotation.set(0, 0, 0.12);
    p.armR.rotation.set(0, 0, -0.12);
    p.legL.rotation.set(0, 0, 0);
    p.legR.rotation.set(0, 0, 0);
  };
  reset();
  if (seated && (pose === 'idle' || pose === 'cheers')) {
    p.hips.position.y = 0.95;
    p.legL.rotation.x = p.legR.rotation.x = -1.45;
    p.head.rotation.y = Math.sin(s * 0.7) * 0.25;
  } else if (pose === 'idle' || pose === 'cheers') {
    p.hips.position.y = 0.9 + Math.sin(s * 2.2) * 0.015;
    p.head.rotation.y = Math.sin(s * 0.6) * 0.3;
    p.armL.rotation.x = Math.sin(s * 1.1) * 0.08;
  }
  if (pose === 'cheers') {
    p.armR.rotation.set(-2.1 + Math.sin(s * 9) * 0.12, 0, -0.25);
    p.torso.rotation.z = Math.sin(s * 3) * 0.06;
  }
  if (pose === 'walk') {
    const step = t * 7 + p.phase;
    p.hips.position.y = 0.9 + Math.abs(Math.sin(step)) * 0.06;
    p.legL.rotation.x = Math.sin(step) * 0.6;
    p.legR.rotation.x = -Math.sin(step) * 0.6;
    p.armL.rotation.x = -Math.sin(step) * 0.5;
    p.armR.rotation.x = Math.sin(step) * 0.5;
  }
  if (pose === 'dance') {
    const beat = s * 2.3 * Math.PI;
    p.hips.position.y = 0.9 + Math.abs(Math.sin(beat)) * 0.18;
    p.hips.rotation.y = Math.sin(beat / 2) * 0.45;
    p.torso.rotation.z = Math.sin(beat) * 0.15;
    p.armL.rotation.set(0, 0, 2.4 + Math.sin(beat) * 0.5);
    p.armR.rotation.set(0, 0, -2.4 + Math.sin(beat + 1) * 0.5);
    p.legL.rotation.x = Math.max(0, Math.sin(beat)) * -0.6;
    p.legR.rotation.x = Math.max(0, -Math.sin(beat)) * -0.6;
    p.head.rotation.x = Math.sin(beat * 2) * 0.15;
  }
  if (pose === 'kneel' || pose === 'bow') {
    p.hips.position.y = 0.42;
    p.legL.rotation.x = p.legR.rotation.x = 1.5;
    p.armL.rotation.set(-0.9, 0, -0.5);
    p.armR.rotation.set(-0.9, 0, 0.5); // chắp tay trước ngực
    p.torso.rotation.x = Math.sin(s * 0.9) * 0.03;
  }
  if (pose === 'bow') {
    const k = (Math.sin(t * 2.4) + 1) / 2; // vái lên xuống
    p.torso.rotation.x = lerp(0.05, 1.05, k);
    p.armL.rotation.x = p.armR.rotation.x = lerp(-0.9, -2.2, k);
  }
  if (pose === 'swim') {
    const stroke = t * 5.5;
    p.hips.rotation.x = Math.PI / 2;
    p.hips.position.y = 0.25;
    p.hips.rotation.y = Math.sin(stroke) * 0.18;
    p.armL.rotation.set(stroke % (Math.PI * 2), 0, 0.15);
    p.armR.rotation.set((stroke + Math.PI) % (Math.PI * 2), 0, -0.15);
    p.legL.rotation.x = Math.sin(stroke * 2) * 0.35;
    p.legR.rotation.x = -Math.sin(stroke * 2) * 0.35;
    p.head.rotation.x = -0.9;
    p.head.rotation.y = Math.sin(stroke) * 0.5;
  }
}

const towards = new THREE.Vector3();

/**
 * Bước đều về đích (speed đơn vị/giây), quay mặt theo hướng đi; tới nơi thì xoay về facing.
 * Trả true khi còn đang đi (để chọn tư thế 'walk').
 */
export function walkTowards(root, target, dt, { speed = 3, facing = 0 } = {}) {
  towards.subVectors(target, root.position);
  towards.y = 0;
  const dist = towards.length();
  const walking = dist > 0.05;
  if (walking) {
    root.position.addScaledVector(towards.normalize(), Math.min(dist, speed * dt));
    const heading = Math.atan2(towards.x, towards.z);
    root.rotation.y += Math.atan2(Math.sin(heading - root.rotation.y), Math.cos(heading - root.rotation.y)) * Math.min(1, dt * 10);
  } else {
    root.position.x = target.x;
    root.position.z = target.z;
    root.rotation.y += Math.atan2(Math.sin(facing - root.rotation.y), Math.cos(facing - root.rotation.y)) * Math.min(1, dt * 6);
  }
  root.position.y = target.y;
  return walking;
}

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
