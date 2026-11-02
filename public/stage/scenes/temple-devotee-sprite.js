// Phật tử vẽ tay (sprite 2D) đứng trong cảnh 3D: tấm hình luôn quay về camera, chọn khung theo
// động tác + hướng đang đi (lưng / nghiêng trái / nghiêng phải), có bóng mềm dưới chân.
// Trả về cùng "hình dạng" với buildPerson (root, head, hips, hand) nên crowd/nghi thức dùng chung được;
// animatePerson() thấy model.animate thì giao cho nó.
import * as THREE from '/vendor/three/three.module.js';
import { hashOf } from './person-model.js';
import { templeArt } from './temple-art.js';
import { depthScale } from './temple-view.js';
import { createBlendMaterial, layoutFrames } from './temple-sprite-blend-material.js';

const STRIDE = 0.38; // mét mỗi bước: đổi khung chân theo quãng đã đi nên chân không trượt
const TINT = '#e3c8ae'; // ánh nến ấm, hơi tối vì người quay lưng về phía camera
let shadowTexture = null;

function softShadow() {
  if (shadowTexture) return shadowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.75)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.3)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  shadowTexture = new THREE.CanvasTexture(c);
  shadowTexture.userData.shared = true; // dùng chung mọi người: gỡ một người không được huỷ ảnh
  return shadowTexture;
}

// Độ "cúi" 0→1→0 trong một chu kỳ vái/lạy: lên dần, giữ, về dần (đường cong êm, không giật).
function bowAmount(t, period, rise, hold, fall) {
  const u = ((t % period) + period) % period;
  const ease = (x) => x * x * (3 - 2 * x);
  if (u < rise[0]) return 0;
  if (u < rise[1]) return ease((u - rise[0]) / (rise[1] - rise[0]));
  if (u < hold) return 1;
  if (u < fall) return 1 - ease((u - hold) / (fall - hold));
  return 0;
}

/**
 * Khung + biến dạng cho một tư thế (view: 'back' | 'side').
 * Trả { name, squash (co thân trên), lean (nghiêng thân trên, tỉ lệ bề ngang), pivot (độ cao bắt đầu gập) }.
 */
function pickPose(pose, view, cycleT, walkStep, frames) {
  if (pose === 'walk') {
    const name = view === 'back' ? (walkStep % 2 ? 'di-sau-2' : 'di-sau-1') : walkStep % 2 ? 'di-nghieng-2' : 'di-nghieng-1';
    return { name, squash: 1, lean: 0, pivot: 0.5 };
  }
  if (view === 'side') {
    if (pose === 'prayHigh') return { name: 'cam-huong-nghieng', squash: 1, lean: 0, pivot: 0.5 };
    if (pose === 'bowStand') { // vái hương: cúi dần xuống rồi ngẩng lên, đổi khung ở giữa động tác
      const k = bowAmount(cycleT, 1.4, [0.1, 0.55], 0.8, 1.25);
      return { name: k > 0.5 ? 'vai-huong-nghieng' : 'cam-huong-nghieng', squash: 1 - 0.04 * k, lean: 0.07 * k, pivot: 0.48 };
    }
    if (pose === 'idle' || pose === 'pray' || pose === 'offer') return { name: 'dung-nghieng', squash: 1, lean: 0, pivot: 0.5 };
  }
  if (pose === 'idle' || pose === 'prayHigh') return { name: 'dung-sau', squash: 1, lean: 0, pivot: 0.5 };
  if (pose === 'offer') return { name: 'dang-le-sau', squash: 1, lean: 0, pivot: 0.5 };
  if (pose === 'bow' || pose === 'bowStand') { // vái quỳ: hai tay lên trán, thân cúi xuống nhẹ
    const k = bowAmount(cycleT, 1.7, [0.15, 0.6], 1.15, 1.55);
    return { name: k > 0.45 ? 'vai-quy-sau' : 'quy-sau', squash: 1 - 0.08 * k, lean: 0, pivot: 0.3 };
  }
  if (pose === 'prostrate') { // lạy: quỳ → vái → rạp xuống sát đất → về
    const k = bowAmount(cycleT, 2.2, [0.1, 0.8], 1.55, 2.05);
    const lay = frames['lay-sau'] ? 'lay-sau' : 'vai-quy-sau';
    return { name: k < 0.3 ? 'quy-sau' : k < 0.75 ? 'vai-quy-sau' : lay, squash: 1 - (frames['lay-sau'] ? 0.06 : 0.14) * k, lean: 0, pivot: 0.25 };
  }
  return { name: 'quy-sau', squash: 1, lean: 0, pivot: 0.3 }; // kneel, pray (chắp tay quỳ), shake (lắc ống xăm)
}

const isKneel = (f) => f.family === 'kneel' || f.family === 'prostrate';
const smooth = (x) => x * x * (3 - 2 * x);

/** @param {{id:string, gender?:'nam'|'nu'}} opts */
export function buildDevotee({ id, gender }) {
  const art = templeArt();
  const h = hashOf(id);
  const set = gender || (h % 2 ? 'nu' : 'nam');
  const frames = art.devotee[set];
  const personal = 0.95 + ((h >> 5) % 11) / 100; // người cao người thấp một chút
  const breathPhase = (h % 628) / 100;

  const root = new THREE.Group();
  const body = new THREE.Group(); // không xoay theo hướng đi, co theo độ sâu
  root.add(body);
  const material = createBlendMaterial(TINT);
  const sprite = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 16).translate(0, 0.5, 0), material);
  body.add(sprite);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: softShadow(), transparent: true, depthWrite: false, opacity: 0.55 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.004;
  shadow.renderOrder = -1;
  body.add(shadow);
  const head = new THREE.Object3D();
  const hips = new THREE.Object3D();
  const hand = new THREE.Group();
  hand.scale.setScalar(0.8); // đồ lễ dựng cho nhân vật chibi: thu về cỡ thật
  body.add(head, hips, hand);

  const world = new THREE.Vector3();
  const last = new THREE.Vector3(Number.NaN, 0, 0);
  let travelled = 0;
  let mirror = 1;
  // hoà khung: cur đang hiện, next đang hiện dần lên trong fade giây
  let cur = null;
  let next = null;
  let mix = 0;
  let fade = 0.2;
  let lean = 0;
  let squash = 1;
  let turnAt = -99;

  // Quay người (lưng ↔ nghiêng, hay đổi hướng trái/phải): hai dáng khác hẳn nhau nên KHÔNG hoà mờ (thành
  // bóng ma trong suốt) — đổi ngay và bóp ngang tấm hình một nhịp ngắn như nhân vật 2D quay đầu.
  function isTurn(fromName, fromFlip, toName, toFlip) {
    const sideA = frames[fromName].family === 'side';
    const sideB = frames[toName].family === 'side';
    return sideA !== sideB || (sideA && fromFlip !== toFlip);
  }

  function target(name, flip, base, t) {
    const same = (s) => s && s.name === name && s.flip === flip;
    if (!cur) cur = { name, flip, base };
    const shown = next && mix > 0.5 ? next : cur;
    if (!same(shown) && isTurn(shown.name, shown.flip, name, flip)) {
      cur = { name, flip, base };
      next = null;
      mix = 0;
      turnAt = t;
      return;
    }
    if (same(next)) return void (next.base = base);
    if (!next && same(cur)) return void (cur.base = base);
    if (next) { // đổi ý giữa chừng: giữ khung đang trội rồi hoà sang khung mới
      if (mix > 0.5) cur = next;
      next = null;
      mix = 0;
      if (same(cur)) return void (cur.base = base);
    }
    const from = frames[cur.name];
    const to = frames[name];
    // đứng ↔ quỳ: ngồi xuống/đứng dậy chậm; đổi chân khi đi: nhanh; còn lại (vái, quay người): vừa
    fade = isKneel(from) !== isKneel(to) ? 0.26 : from.family === to.family && name.startsWith('di-') ? 0.1 : 0.2;
    next = { name, flip, base };
  }

  const model = {
    root, body, head, hips, hand, sprite, gender: set,
    labelLift: 0.1, // nhãn tên cao hơn đỉnh đầu bao nhiêu (m, trước khi co theo độ sâu)
    seat: null, // {x, z, top}: bồ đoàn của người này (cảnh gán), quỳ đúng chỗ thì gối đặt lên mặt đệm
    animate(pose, t, dt, _seated, cycleT = t) {
      root.getWorldPosition(world);
      if (Number.isNaN(last.x)) last.copy(world);
      travelled += Math.hypot(world.x - last.x, world.z - last.z);
      last.copy(world);
      const scale = depthScale(-world.z) * personal;
      body.scale.setScalar(scale);
      body.rotation.y = -root.rotation.y; // tấm hình luôn quay về camera dù người quay hướng nào

      // nhìn từ camera: mặt hướng vào trong (lưng) hay đi ngang; sprite nghiêng vẽ mặt quay sang phải
      const fx = Math.sin(root.rotation.y);
      const fz = Math.cos(root.rotation.y);
      const view = fz < -0.55 ? 'back' : 'side';
      if (view === 'side' && Math.abs(fx) > 0.08) mirror = fx > 0 ? 1 : -1;
      const want = pickPose(pose, view, cycleT, Math.floor(travelled / STRIDE), frames);
      const wantFrame = frames[want.name] || frames['quy-sau'];
      const seat = model.seat;
      const onCushion = seat && Math.hypot(world.x - seat.x, world.z - seat.z) < 0.2;
      const baseOf = (f) => (isKneel(f) && onCushion ? seat.top / scale : 0);
      target(frames[want.name] ? want.name : 'quy-sau', wantFrame.family === 'side' ? mirror : 1, baseOf(wantFrame), t);
      if (next) {
        mix += dt / fade;
        if (mix >= 1) { cur = next; next = null; mix = 0; }
      }
      const A = frames[cur.name];
      const B = next ? frames[next.name] : A;
      const k = next ? smooth(mix) : 0;
      layoutFrames(sprite, A, cur.flip, cur.base, B, next ? next.flip : cur.flip, next ? next.base : cur.base);

      // chuyển động liên tục giữa các khung: nhún theo bước, lắc nhẹ khi đi, cúi êm, thở khi quỳ yên
      const stepPhase = (travelled / STRIDE) * Math.PI;
      const walking = pose === 'walk';
      const breathing = !walking && isKneel(A) ? Math.sin(t * 1.7 + breathPhase) * 0.008 : 0;
      const wantLean = walking ? (view === 'back' ? Math.sin(stepPhase) * 0.012 : 0.02 * mirror) : want.lean * (cur.flip || 1);
      lean += (wantLean - lean) * Math.min(1, dt * 12);
      squash += (want.squash + breathing - squash) * Math.min(1, dt * 14);
      const u = material.uniforms;
      u.uMix.value = k;
      u.uLean.value = lean;
      u.uSquash.value = squash;
      u.uPivot.value = want.pivot;
      const bob = walking ? Math.abs(Math.sin(stepPhase)) * 0.022 : 0;
      const jitter = pose === 'shake' ? Math.sin(t * 46) * 0.008 : 0;
      sprite.position.x += jitter;
      sprite.position.y += bob;
      const turning = t - turnAt;
      if (turning < 0.2) sprite.scale.x *= 1 - 0.22 * Math.sin(Math.PI * (turning / 0.2)); // nhịp quay người
      sprite.position.z = isKneel(k > 0.5 ? B : A) ? 0.12 : 0;

      const lerp = (a, b) => a + (b - a) * k;
      const baseNow = lerp(cur.base, next ? next.base : cur.base);
      const headNow = lerp(A.head, B.head) * squash;
      shadow.scale.set(lerp(A.w, B.w) * 0.95, Math.min(0.6, lerp(A.w, B.w) * 0.55), 1);
      head.position.set(0, baseNow + headNow + model.labelLift, 0); // nhãn tên co theo người, không treo lơ lửng khi ở gần
      hips.position.y = baseNow + lerp(A.h, B.h) * 0.45;

      // tay cầm đồ lễ: dâng lễ = giữa hai tay giơ cao; lắc xăm = cạnh vai; đi/đứng = trước ngực (khuất sau lưng)
      const shown = k > 0.5 ? (next || cur) : cur;
      const F = frames[shown.name];
      if (shown.name === 'dang-le-sau') hand.position.set(0, F.h - 0.06, -0.02);
      else if (pose === 'shake') hand.position.set(0.17, baseNow + F.head * 0.8, 0.03); // ống xăm ló bên vai, chúi về bàn thờ
      else if (F.family === 'side') hand.position.set(0.18 * shown.flip, F.h * 0.62, 0.02);
      else hand.position.set(0, baseNow + F.head * 0.62, -0.12);
      for (const prop of hand.children) {
        if (pose === 'shake') prop.rotation.set(-0.6 + Math.sin(t * 38) * 0.2, 0, Math.sin(t * 19) * 0.1);
        else prop.rotation.set(0, 0, 0);
        if (prop.userData.tips) prop.visible = false; // nén hương đã vẽ sẵn trong tay ở khung cầm hương
      }
      return undefined;
    }
  };
  return model;
}
