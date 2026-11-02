// Chánh điện = tranh vẽ (public/assets/temple/chua-nen.webp) + vài lớp 3D đặt khớp lên tranh:
// hào quang rực lên khi có lễ lớn, lửa nến lung linh, chân hương cắm trên lư, bồ đoàn dưới gối,
// đèn và ánh sáng cho đồ lễ 3D. Toạ độ lấy theo vị trí trên tranh (tỉ lệ khung) + độ sâu.
import * as THREE from '/vendor/three/three.module.js';
import { templeArt } from './temple-art.js';
import { attachBackdrop, depthScale, halfWidthAt, screenPoint } from './temple-view.js';

const HALO_FRAGMENT = `
  uniform float uTime;
  uniform float uPower;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    float a = atan(p.y, p.x);
    float rays = 0.5 + 0.5 * sin(a * 28.0 + uTime * 0.6);
    float glow = smoothstep(1.0, 0.25, r) * smoothstep(0.0, 0.35, r);
    float ring = smoothstep(0.05, 0.0, abs(r - 0.5)) * 0.8;
    vec3 gold = vec3(1.0, 0.8, 0.42);
    float v = (glow * 0.32 + rays * smoothstep(1.0, 0.45, r) * smoothstep(0.3, 0.5, r) * 0.3 + ring * 0.4) * uPower;
    gl_FragColor = vec4(gold * v, v);
  }`;

// Vị trí các nguồn sáng vẽ trong tranh (tỉ lệ khung) và độ sâu ước lượng
const FLAMES = [[0.369, 0.474, 12.6, 0.05], [0.629, 0.474, 12.6, 0.05], [0.255, 0.539, 11.7, 0.09], [0.745, 0.539, 11.7, 0.09]];
const HALO = { x: 0.5, y: 0.262, depth: 13.6, size: 0.62 };
export const URN = { x: 0.5, rimY: 0.548, depth: 11.6 }; // miệng lư hương

let glowTexture = null;
export function glowMap() {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,240,200,1)');
  grad.addColorStop(0.25, 'rgba(255,200,110,0.55)');
  grad.addColorStop(1, 'rgba(255,150,60,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTexture = new THREE.CanvasTexture(c);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  glowTexture.userData.shared = true;
  return glowTexture;
}

export function glowSprite(size, opacity = 1) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity }));
  sprite.scale.setScalar(size);
  return sprite;
}

export function buildPaintedHall(scene, camera) {
  const art = templeArt();
  scene.background = new THREE.Color('#120604');
  scene.add(camera);
  const backdrop = attachBackdrop(camera, art.backdrop.texture);
  backdrop.material.map.userData.shared = true;

  scene.add(new THREE.HemisphereLight('#ffd9a8', '#3a140a', 1.1));
  const top = new THREE.DirectionalLight('#ffe6c0', 1.4);
  top.position.set(1.5, 6, 1);
  scene.add(top);
  const altarLight = new THREE.PointLight('#ffb060', 18, 9, 1.4);
  altarLight.position.copy(screenPoint(0.5, 0.5, 10.8));
  scene.add(altarLight);

  // hào quang phủ lên hào quang vẽ sẵn: bình thường chỉ "thở" rất nhẹ, có lễ lớn thì rực lên
  const haloCenter = screenPoint(HALO.x, HALO.y, HALO.depth);
  const haloSize = halfWidthAt(HALO.depth) * 2 * HALO.size;
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(haloSize, haloSize), new THREE.ShaderMaterial({
    fragmentShader: HALO_FRAGMENT,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    uniforms: { uTime: { value: 0 }, uPower: { value: 0 } },
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending
  }));
  halo.position.copy(haloCenter);
  halo.renderOrder = -5;
  scene.add(halo);
  const breath = glowSprite(haloSize * 0.8, 0.1);
  breath.position.copy(haloCenter);
  breath.renderOrder = -5;
  scene.add(breath);

  const flames = FLAMES.map(([x, y, depth, size], i) => {
    const s = glowSprite(halfWidthAt(depth) * 2 * size, 0.55);
    s.position.copy(screenPoint(x, y, depth));
    s.renderOrder = -4;
    s.userData = { base: s.scale.x, i };
    scene.add(s);
    return s;
  });

  // chân hương: nén mới thắp cắm vào miệng lư vẽ trong tranh
  const sticks = new THREE.Group();
  sticks.position.copy(screenPoint(URN.x, URN.rimY, URN.depth));
  sticks.scale.setScalar(0.42);
  scene.add(sticks);

  return { halo, breath, flames, sticks, haloCenter, urnTop: sticks.position.clone() };
}

/** Bồ đoàn đỏ (VIP: viền vàng) dưới chỗ quỳ; trả về độ cao mặt đệm để sprite quỳ lên trên. */
export function addCushion(scene, position, vip) {
  const s = depthScale(-position.z);
  const g = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 14), new THREE.MeshStandardMaterial({ color: vip ? '#a3201a' : '#7d1a12', roughness: 0.78 }));
  pad.scale.set(0.72, 0.13, 0.52);
  pad.position.y = 0.06;
  g.add(pad);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.022, 8, 40), new THREE.MeshStandardMaterial(
    vip ? { color: '#e3b04b', metalness: 0.75, roughness: 0.3, emissive: '#5a3a08', emissiveIntensity: 0.4 } : { color: '#4a0e08', roughness: 0.8 }));
  trim.rotation.x = Math.PI / 2;
  trim.scale.set(0.72, 0.52, 1);
  trim.position.y = 0.07;
  g.add(trim);
  g.position.copy(position);
  g.scale.setScalar(s);
  scene.add(g);
  return 0.1 * s;
}

// Chuyển động thường trực: hào quang thở / rực khi có lễ lớn, lửa nến lung linh.
export function animatePaintedHall(hall, t, { haloBoost }) {
  const u = hall.halo.material.uniforms;
  u.uTime.value = t;
  u.uPower.value += ((haloBoost ? 0.75 : 0) - u.uPower.value) * 0.04;
  hall.breath.material.opacity = 0.08 + Math.sin(t * 0.8) * 0.03 + u.uPower.value * 0.25;
  for (const f of hall.flames) {
    const k = 1 + Math.sin(t * 13 + f.userData.i * 2.3) * 0.07 + Math.sin(t * 5.1 + f.userData.i) * 0.05;
    f.scale.setScalar(f.userData.base * k);
    f.material.opacity = 0.45 + (k - 1) * 1.5;
  }
}
