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

// Hoạt hình kiểu 2D: mỗi động tác là một chuỗi khung vẽ đổi dứt khoát (không hoà mờ, không lắc lư).
// [tên khung, thời điểm bắt đầu trong chu kỳ (giây)]; khung nào bộ hình không có thì giữ khung trước đó.
const SEQUENCES = {
  bow: { period: 1.8, keys: [['quy-sau', 0], ['vai-quy-sau', 0.3], ['quy-cui', 0.55], ['vai-quy-sau', 1.25], ['quy-sau', 1.5]] },
  prostrate: { period: 2.4, keys: [['quy-sau', 0], ['vai-quy-sau', 0.25], ['quy-cui', 0.5], ['lay-sau', 0.75], ['quy-cui', 1.75], ['vai-quy-sau', 2.0], ['quy-sau', 2.2]] },
  bowIncense: { period: 1.4, keys: [['cam-huong-nghieng', 0], ['vai-huong-giua', 0.3], ['vai-huong-nghieng', 0.5], ['vai-huong-giua', 0.95], ['cam-huong-nghieng', 1.15]] }
};
const TRANSITION_S = 0.22; // đứng ↔ quỳ: hiện khung "một gối chạm đất" ở giữa

function sequenceFrame(name, cycleT, frames) {
  const { period, keys } = SEQUENCES[name];
  const u = ((cycleT % period) + period) % period;
  let frame = keys[0][0];
  for (const [f, at] of keys) if (u >= at && frames[f]) frame = f;
  return frame;
}

// Chu kỳ đi 4 nhịp theo quãng đường (mỗi nhịp nửa bước): bước – giữa bước – bước chân kia – giữa bước.
// Nhìn từ sau thì khung giữa bước lật ngang thành chân kia (dáng sau lưng đối xứng).
function walkFrame(view, quarter, frames) {
  if (view === 'back') {
    if (!frames['di-sau-giua']) return { name: quarter % 2 ? 'di-sau-2' : 'di-sau-1', flip: 1 };
    return [{ name: 'di-sau-1', flip: 1 }, { name: 'di-sau-giua', flip: 1 }, { name: 'di-sau-2', flip: 1 }, { name: 'di-sau-giua', flip: -1 }][quarter % 4];
  }
  const cycle = frames['di-nghieng-giua'] ? ['di-nghieng-1', 'di-nghieng-giua', 'di-nghieng-2', 'di-nghieng-giua']
    : frames['di-nghieng-dat'] ? ['di-nghieng-1', 'di-nghieng-2', 'di-nghieng-dat', 'di-nghieng-2']
      : ['di-nghieng-1', 'di-nghieng-2', 'di-nghieng-1', 'di-nghieng-2'];
  return { name: cycle[quarter % 4], flip: 0 };
}

/** Khung cho một tư thế (view: 'back' | 'side'); flip 0 = theo hướng đi (khung nghiêng). */
function pickPose(pose, view, cycleT, quarter, frames) {
  if (pose === 'walk') return walkFrame(view, quarter, frames);
  if (view === 'side') {
    if (pose === 'prayHigh') return { name: 'cam-huong-nghieng', flip: 0 };
    if (pose === 'bowStand') return { name: sequenceFrame('bowIncense', cycleT, frames), flip: 0 };
    if (pose === 'idle' || pose === 'pray' || pose === 'offer') return { name: 'dung-nghieng', flip: 0 };
  }
  if (pose === 'idle' || pose === 'prayHigh') return { name: 'dung-sau', flip: 1 };
  if (pose === 'offer') return { name: 'dang-le-sau', flip: 1 };
  if (pose === 'bow' || pose === 'bowStand') return { name: sequenceFrame('bow', cycleT, frames), flip: 1 }; // đặt lễ xong thì quỳ xuống vái
  if (pose === 'prostrate') return { name: sequenceFrame('prostrate', cycleT, frames), flip: 1 };
  return { name: 'quy-sau', flip: 1 }; // kneel, pray (chắp tay quỳ), shake (lắc ống xăm)
}

const isKneel = (f) => f.family === 'kneel' || f.family === 'prostrate';

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
  const sprite = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), material);
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
  let shownKneel = null; // khung đang hiện là quỳ hay đứng (để chen khung "một gối" khi đổi)
  let transitionUntil = -1;

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
      let { name, flip } = pickPose(pose, view, cycleT, Math.floor(travelled / (STRIDE / 2)), frames);
      if (!frames[name]) name = 'quy-sau';
      let frame = frames[name];
      // đứng ↔ quỳ: chen khung "một gối chạm đất" một nhịp ngắn
      const kneelNow = isKneel(frame);
      if (shownKneel !== null && kneelNow !== shownKneel && frames['quy-xuong']) transitionUntil = t + TRANSITION_S;
      shownKneel = kneelNow;
      if (t < transitionUntil) { name = 'quy-xuong'; frame = frames[name]; flip = 1; }
      if (!flip) flip = mirror;
      if (material.map !== frame.texture) material.map = frame.texture;

      const seat = model.seat;
      const onCushion = seat && Math.hypot(world.x - seat.x, world.z - seat.z) < 0.2;
      const base = (isKneel(frame) || name === 'quy-xuong') && onCushion ? seat.top / scale : 0;
      const jitter = pose === 'shake' ? Math.sin(t * 46) * 0.008 : 0;
      sprite.scale.set(frame.w * flip, frame.h, 1);
      sprite.position.set((0.5 - frame.ax) * frame.w * flip + jitter, base, isKneel(frame) ? 0.12 : 0);
      shadow.scale.set(frame.w * 0.95, Math.min(0.6, frame.w * 0.55), 1);
      head.position.set(0, base + frame.head + model.labelLift, 0); // nhãn tên co theo người, không treo lơ lửng khi ở gần
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
