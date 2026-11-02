// Camera của Chùa được khớp với phối cảnh của tranh nền chánh điện (đơn vị: mét, sàn y = 0).
// Đo trên tranh: hai mép thảm đỏ hội tụ ở đường chân trời cao 56,3% từ trên xuống; chân bàn thờ
// nằm ở 64,5% và ở đó 1 m ≈ 90 điểm ảnh (bề ngang tranh 572) ⇒ camera cao 0,93 m, nhìn thẳng,
// ống kính dịch dọc (cột trong tranh đứng thẳng, không chụm). Đổi tranh nền thì đo lại 3 số này.
import * as THREE from '/vendor/three/three.module.js';

export const CAMERA_HEIGHT = 0.93;
const FOV = 52;
const ASPECT = 1080 / 1920;
const HORIZON = 0.563; // tỉ lệ từ mép trên khung xuống
const SHIFT = 2 * HORIZON - 1; // lệch ống kính theo chiều dọc (NDC)
const P11 = 1 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const P00 = P11 / ASPECT;
/** Độ sâu (m, tính từ camera) của chân bàn thờ trong tranh. */
export const ALTAR_DEPTH = 11.6;

export function createTempleCamera() {
  const camera = new THREE.PerspectiveCamera(FOV, ASPECT, 0.05, 60);
  camera.position.set(0, CAMERA_HEIGHT, 0);
  camera.lookAt(0, CAMERA_HEIGHT, -1);
  setZoom(camera, 1);
  return camera;
}

/** Phóng to đều cả tranh lẫn cảnh 3D (đại lễ Kim Liên) — đổi góc nhìn chứ không dời camera. */
export function setZoom(camera, zoom) {
  camera.zoom = zoom;
  camera.updateProjectionMatrix();
  camera.projectionMatrix.elements[9] = SHIFT; // dịch ống kính: chân trời rơi đúng chỗ của tranh
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}

/** Điểm 3D nằm đúng chỗ (sx, sy) trên khung hình (0..1 từ trái/trên) ở độ sâu depth mét. */
export function screenPoint(sx, sy, depth) {
  const ny = 1 - 2 * sy;
  return new THREE.Vector3(((2 * sx - 1) * depth) / P00, CAMERA_HEIGHT + ((ny + SHIFT) * depth) / P11, -depth);
}

/** Độ sâu của điểm sàn hiện ở hàng sy của khung hình. */
export const floorDepth = (sy) => (P11 * CAMERA_HEIGHT) / 2 / (sy - HORIZON);

/** Điểm trên sàn hiện ở (sx, sy) của khung hình. */
export function floorPoint(sx, sy) {
  const p = screenPoint(sx, sy, floorDepth(sy));
  p.y = 0;
  return p;
}

/** Bề ngang nửa khung hình (m) ở độ sâu depth. */
export const halfWidthAt = (depth) => depth / P00;

/**
 * Tranh vẽ góc máy rất thấp: theo đúng phối cảnh, người ở hàng đầu to gấp 3–4 lần người cạnh bàn thờ
 * và che kín bàn thờ. Nên người/đồ vật ở gần camera được thu nhỏ bớt theo căn bậc hai độ sâu
 * (cạnh bàn thờ giữ đúng cỡ thật để khớp với lư hương, bàn thờ trong tranh).
 */
export const depthScale = (depth) => Math.min(1, Math.max(0.3, Math.sqrt(depth / ALTAR_DEPTH)));

/** Gắn tranh nền vào camera, phủ kín khung hình ở mọi mức phóng (vẽ trước mọi thứ, không ghi độ sâu). */
export function attachBackdrop(camera, texture, distance = 40) {
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry((2 * distance) / P00, (2 * distance) / P11),
    new THREE.MeshBasicMaterial({ map: texture, depthTest: false, depthWrite: false, fog: false })
  );
  plane.position.set(0, (SHIFT * distance) / P11, -distance);
  plane.renderOrder = -10;
  camera.add(plane);
  return plane;
}
