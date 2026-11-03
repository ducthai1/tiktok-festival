// Camera của Chùa được khớp với phối cảnh của tranh nền chánh điện (đơn vị: mét, sàn y = 0).
// Các hằng số đo trên tranh + phép chiếu thuần toán nằm ở /static/shared/temple-camera.js (server và test
// dùng chung để tính chỗ quỳ); file này dựng camera three.js từ đúng các số đó.
import * as THREE from '/vendor/three/three.module.js';
import { ALTAR_DEPTH, ASPECT, CAMERA_HEIGHT, FOV, HORIZON, P00, P11, SHIFT, depthScale } from '/static/shared/temple-camera.js';

export { ALTAR_DEPTH, CAMERA_HEIGHT, depthScale };

export function createTempleCamera() {
  const camera = new THREE.PerspectiveCamera(FOV, ASPECT, 0.05, 60);
  camera.position.set(0, CAMERA_HEIGHT, 0);
  camera.lookAt(0, CAMERA_HEIGHT, -1);
  setZoom(camera, 1);
  return camera;
}

/** Phóng to đều cả tranh lẫn cảnh 3D (điều ước lớn nhất) — đổi góc nhìn chứ không dời camera. */
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
