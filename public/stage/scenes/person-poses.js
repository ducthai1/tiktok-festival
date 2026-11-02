// Tư thế + chuyển động của nhân vật. Các tư thế lễ chùa: chắp tay (pray), nâng hương lên trán (prayHigh),
// vái đứng (bowStand), dâng lễ hai tay (offer), quỳ (kneel), vái quỳ (bow), lạy sát đất (prostrate),
// lắc ống xăm (shake). cycleT = thời gian tính từ lúc bắt đầu động tác, để "vái 3 vái" đúng 3 lần.
import * as THREE from '/vendor/three/three.module.js';

const lerp = (a, b, k) => a + (b - a) * k;
const cycle = (t, period) => (1 - Math.cos((t * Math.PI * 2) / period)) / 2; // 0 → 1 → 0, bắt đầu từ 0

// Hai bàn tay chắp vào nhau: tay trái nghiêng vào trong (+z), tay phải (-z), rồi nâng lên.
function joinHands(p, raise) {
  p.armL.rotation.set(raise, 0, 0.62);
  p.armR.rotation.set(raise, 0, -0.62);
}

function kneel(p, s) {
  p.hips.position.y = 0.42;
  p.legL.rotation.x = p.legR.rotation.x = 1.5;
  p.torso.rotation.x = Math.sin(s * 0.9) * 0.03;
  joinHands(p, -1.0);
}

/**
 * Đặt tư thế theo thời gian t (giây).
 * pose: idle | walk | dance | cheers | kneel | bow | prostrate | shake | pray | prayHigh | bowStand | offer | swim
 * seated=true thì ngồi (ghế quầy) với idle/cheers.
 */
export function posePerson(p, pose, t, seated = false, cycleT = t) {
  const s = t + p.phase;
  p.hips.position.y = 0.9;
  p.hips.rotation.set(0, 0, 0);
  p.torso.rotation.set(0, 0, 0);
  p.head.rotation.set(0, 0, 0);
  p.armL.rotation.set(0, 0, 0.12);
  p.armR.rotation.set(0, 0, -0.12);
  p.legL.rotation.set(0, 0, 0);
  p.legR.rotation.set(0, 0, 0);
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
  if (pose === 'pray') joinHands(p, -1.0);
  if (pose === 'prayHigh') joinHands(p, -2.05);
  if (pose === 'bowStand') {
    const k = cycle(cycleT, 1.4); // vái: cúi người, tay chắp lên trán
    joinHands(p, -2.05);
    p.torso.rotation.x = 0.85 * k;
    p.head.rotation.x = 0.25 * k;
  }
  if (pose === 'offer') {
    // dâng lễ: hai tay nâng đồ lễ lên cao quá đầu (thấy được cả khi đứng quay lưng về camera)
    const lift = -2.55 + Math.sin(cycleT * 2) * 0.05;
    p.armL.rotation.set(lift, 0, 0.32);
    p.armR.rotation.set(lift, 0, -0.32);
    p.head.rotation.x = -0.25;
  }
  if (pose === 'kneel' || pose === 'bow' || pose === 'prostrate' || pose === 'shake') kneel(p, s);
  if (pose === 'bow') {
    const k = cycle(cycleT, 1.6);
    p.torso.rotation.x = lerp(0.05, 1.0, k);
    joinHands(p, lerp(-1.0, -2.2, k));
  }
  if (pose === 'prostrate') {
    // lạy: rạp người sát đất, hai tay vươn ra trước
    const k = cycle(cycleT, 2.2);
    p.hips.position.y = lerp(0.42, 0.36, k);
    p.torso.rotation.x = lerp(0.05, 1.42, k);
    p.head.rotation.x = lerp(0, 0.3, k);
    joinHands(p, lerp(-1.0, -3.0, k));
  }
  if (pose === 'shake') {
    // lắc ống xăm: hai tay đưa ra trước, rung nhanh
    joinHands(p, -1.25 + Math.sin(cycleT * 28) * 0.16);
    p.torso.rotation.x = 0.15;
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

// Khớp được trộn khi đổi tư thế, để đi → quỳ / ngồi xuống / đứng dậy là một chuyển động liền, không giật.
const JOINTS = [['hips', 'position', 'y'], ...['hips', 'torso', 'head', 'armL', 'armR'].flatMap((j) => ['x', 'y', 'z'].map((a) => [j, 'rotation', a])),
  ['legL', 'rotation', 'x'], ['legR', 'rotation', 'x']];
const BLEND_SECONDS = 0.8;

/**
 * Như posePerson nhưng đổi tư thế thì chuyển dần trong BLEND_SECONDS theo đường cong chậm–nhanh–chậm
 * (bắt đầu từ đúng dáng đang có), nên quỳ xuống / ngồi xuống / đứng dậy là một động tác liền mạch.
 */
export function animatePerson(p, pose, t, dt, seated = false, cycleT = t) {
  const key = `${pose}|${seated}`;
  if (p.poseKey !== key) {
    p.poseKey = key;
    p.blendStart = t;
    p.blendFrom = JOINTS.map(([j, prop, axis]) => p[j][prop][axis]);
  }
  posePerson(p, pose, t, seated, cycleT);
  const u = (t - p.blendStart) / BLEND_SECONDS;
  if (!p.blendFrom || u >= 1) return;
  const k = u <= 0 ? 0 : u * u * (3 - 2 * u);
  JOINTS.forEach(([j, prop, axis], i) => {
    p[j][prop][axis] = p.blendFrom[i] + (p[j][prop][axis] - p.blendFrom[i]) * k;
  });
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
  const walking = dist > 0.02;
  if (walking) {
    // chậm dần ở đoạn cuối (khoảng 1 đơn vị) để dừng lại tự nhiên rồi mới ngồi/quỳ
    const pace = speed * Math.min(1, 0.3 + dist / 1.1);
    root.position.addScaledVector(towards.normalize(), Math.min(dist, pace * dt));
    const heading = Math.atan2(towards.x, towards.z);
    root.rotation.y += Math.atan2(Math.sin(heading - root.rotation.y), Math.cos(heading - root.rotation.y)) * Math.min(1, dt * 10);
  } else {
    root.position.x = target.x;
    root.position.z = target.z;
    root.rotation.y += Math.atan2(Math.sin(facing - root.rotation.y), Math.cos(facing - root.rotation.y)) * Math.min(1, dt * 6);
  }
  root.position.y += (target.y - root.position.y) * Math.min(1, dt * 6);
  return walking;
}

