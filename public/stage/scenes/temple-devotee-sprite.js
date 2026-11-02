// Phật tử vẽ tay (sprite 2D) đứng trong cảnh 3D: tấm hình luôn quay về camera, chọn khung theo
// động tác + hướng đang đi (lưng / nghiêng trái / nghiêng phải), có bóng mềm dưới chân.
// Trả về cùng "hình dạng" với buildPerson (root, head, hips, hand) nên crowd/nghi thức dùng chung được;
// animatePerson() thấy model.animate thì giao cho nó.
import * as THREE from '/vendor/three/three.module.js';
import { hashOf } from './person-model.js';
import { templeArt } from './temple-art.js';
import { depthScale } from './temple-view.js';

const STRIDE = 0.38; // mét mỗi bước: đổi khung chân theo quãng đã đi nên chân không trượt
const TINT = new THREE.Color('#e3c8ae'); // ánh nến ấm, hơi tối vì người quay lưng về phía camera
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

// [khung, thời điểm bắt đầu trong chu kỳ] — chu kỳ tính bằng giây
const CYCLES = {
  bow: { period: 1.7, keys: [['quy-sau', 0], ['vai-quy-sau', 0.45], ['quy-sau', 1.4]] },
  prostrate: { period: 2.2, keys: [['quy-sau', 0], ['vai-quy-sau', 0.3], ['lay-sau', 0.75], ['vai-quy-sau', 1.75], ['quy-sau', 2.05]] },
  bowIncense: { period: 1.4, keys: [['cam-huong-nghieng', 0], ['vai-huong-nghieng', 0.5], ['cam-huong-nghieng', 1.15]] }
};

function cycleFrame(name, cycleT) {
  const { period, keys } = CYCLES[name];
  const u = ((cycleT % period) + period) % period;
  let frame = keys[0][0];
  for (const [f, at] of keys) if (u >= at) frame = f;
  return frame;
}

/** Khung + dáng phụ cho một tư thế (view: 'back' | 'side'). */
function pick(pose, view, cycleT, walkStep) {
  if (pose === 'walk') return view === 'back' ? (walkStep % 2 ? 'di-sau-2' : 'di-sau-1') : walkStep % 2 ? 'di-nghieng-2' : 'di-nghieng-1';
  if (view === 'side') {
    if (pose === 'prayHigh') return 'cam-huong-nghieng';
    if (pose === 'bowStand') return cycleFrame('bowIncense', cycleT);
    if (pose === 'idle' || pose === 'pray' || pose === 'offer') return 'dung-nghieng';
  }
  if (pose === 'idle' || pose === 'prayHigh') return 'dung-sau';
  if (pose === 'offer') return 'dang-le-sau';
  if (pose === 'bow' || pose === 'bowStand') return cycleFrame('bow', cycleT); // đặt lễ xong thì quỳ xuống vái
  if (pose === 'prostrate') return cycleFrame('prostrate', cycleT);
  return 'quy-sau'; // kneel, pray (chắp tay quỳ), shake (lắc ống xăm)
}

/** @param {{id:string, gender?:'nam'|'nu'}} opts */
export function buildDevotee({ id, gender }) {
  const art = templeArt();
  const h = hashOf(id);
  const set = gender || (h % 2 ? 'nu' : 'nam');
  const frames = art.devotee[set];
  const personal = 0.95 + ((h >> 5) % 11) / 100; // người cao người thấp một chút

  const root = new THREE.Group();
  const body = new THREE.Group(); // không xoay theo hướng đi, co theo độ sâu
  root.add(body);
  const material = new THREE.MeshBasicMaterial({ map: frames['dung-sau'].texture, color: TINT, transparent: true, alphaTest: 0.06, side: THREE.DoubleSide });
  const geometry = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const sprite = new THREE.Mesh(geometry, material);
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
      const name = pick(pose, view, cycleT, Math.floor(travelled / STRIDE));
      const frame = frames[name] || frames['quy-sau'];
      const flip = frame.family === 'side' ? mirror : 1;
      if (material.map !== frame.texture) material.map = frame.texture;

      // vái quỳ cúi sâu thay cho lạy ở bộ hình không có khung lạy
      const deep = pose === 'prostrate' && !frames['lay-sau'] && name === 'vai-quy-sau' ? 0.9 : 1;
      const kneeling = frame.family === 'kneel' || frame.family === 'prostrate';
      const seat = model.seat;
      const onCushion = seat && Math.hypot(world.x - seat.x, world.z - seat.z) < 0.2;
      const base = kneeling && onCushion ? seat.top / scale : 0;
      const bob = pose === 'walk' ? Math.abs(Math.sin((travelled / STRIDE) * Math.PI)) * 0.018 : 0;
      const jitter = pose === 'shake' ? Math.sin(t * 46) * 0.008 : 0;
      sprite.scale.set(frame.w * flip, frame.h * deep, 1);
      sprite.position.set((0.5 - frame.ax) * frame.w * flip + jitter, base + bob, kneeling ? 0.12 : 0);
      shadow.scale.set(frame.w * 0.95, Math.min(0.6, frame.w * 0.55), 1);
      head.position.set(0, base + frame.head * deep + model.labelLift, 0); // nhãn tên co theo người, không treo lơ lửng khi ở gần
      hips.position.y = base + frame.h * 0.45;

      // tay cầm đồ lễ: dâng lễ = giữa hai tay giơ cao; lắc xăm = cạnh vai; đi/đứng = trước ngực (khuất sau lưng)
      if (name === 'dang-le-sau') hand.position.set(0, frame.h - 0.06, -0.02);
      else if (pose === 'shake') hand.position.set(0.17, base + frame.head * 0.8, 0.03); // ống xăm ló bên vai, chúi về bàn thờ
      else if (frame.family === 'side') hand.position.set(0.18 * flip, frame.h * 0.62, 0.02);
      else hand.position.set(0, base + frame.head * 0.62, -0.12);
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
