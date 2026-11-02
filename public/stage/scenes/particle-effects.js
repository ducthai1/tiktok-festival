// Hệ hạt dùng chung (pháo hoa, hoa giấy, cánh sen, bọt nước, khói hương) — một khối Points,
// một lần vẽ cho hàng nghìn hạt nên nhẹ cho máy stream.
import * as THREE from '/vendor/three/three.module.js';

const VERTEX = `
  attribute vec3 color;
  attribute float size;
  attribute float alpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = color;
    vAlpha = alpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (900.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const FRAGMENT = `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vColor, vAlpha * smoothstep(0.5, 0.1, d));
  }`;

export function createParticleSystem(scene, max = 4000) {
  const geometry = new THREE.BufferGeometry();
  const position = new Float32Array(max * 3);
  const color = new Float32Array(max * 3);
  const size = new Float32Array(max);
  const alpha = new Float32Array(max);
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color', new THREE.BufferAttribute(color, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  const vel = new Float32Array(max * 3);
  const life = new Float32Array(max);
  const maxLife = new Float32Array(max);
  const grav = new Float32Array(max);
  const drag = new Float32Array(max);
  const baseSize = new Float32Array(max);
  let cursor = 0;
  const tmpColor = new THREE.Color();

  return {
    /**
     * opts: position(Vector3), count, colors[], speed, spread(0..1 hình nón hướng lên), gravity, life, size, damping (cản không khí/khung hình), box(Vector3 rải trong hộp)
     */
    burst({ position: at, count = 60, colors = ['#ffffff'], speed = 6, spread = 1, gravity = -6, life: lifetime = 1.6, size: pointSize = 0.25, damping = 0.98, box = null, up = 0 }) {
      for (let n = 0; n < count; n += 1) {
        const i = cursor;
        cursor = (cursor + 1) % max;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(1 - Math.random() * (1 + spread));
        const v = speed * (0.4 + Math.random() * 0.6);
        position[i * 3] = at.x + (box ? (Math.random() - 0.5) * box.x : 0);
        position[i * 3 + 1] = at.y + (box ? (Math.random() - 0.5) * box.y : 0);
        position[i * 3 + 2] = at.z + (box ? (Math.random() - 0.5) * box.z : 0);
        vel[i * 3] = Math.sin(phi) * Math.cos(theta) * v;
        vel[i * 3 + 1] = Math.cos(phi) * v + up;
        vel[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * v;
        tmpColor.set(colors[Math.floor(Math.random() * colors.length)]);
        color[i * 3] = tmpColor.r;
        color[i * 3 + 1] = tmpColor.g;
        color[i * 3 + 2] = tmpColor.b;
        maxLife[i] = lifetime * (0.7 + Math.random() * 0.6);
        life[i] = maxLife[i];
        grav[i] = gravity;
        drag[i] = damping;
        baseSize[i] = pointSize * (0.6 + Math.random() * 0.8);
      }
    },
    update(dt) {
      for (let i = 0; i < max; i += 1) {
        if (life[i] <= 0) {
          alpha[i] = 0;
          continue;
        }
        life[i] -= dt;
        const k = Math.max(0, life[i] / maxLife[i]);
        vel[i * 3 + 1] += grav[i] * dt;
        const d = drag[i] ** (dt * 60);
        vel[i * 3] *= d;
        vel[i * 3 + 1] *= d;
        vel[i * 3 + 2] *= d;
        position[i * 3] += vel[i * 3] * dt;
        position[i * 3 + 1] += vel[i * 3 + 1] * dt;
        position[i * 3 + 2] += vel[i * 3 + 2] * dt;
        alpha[i] = Math.min(1, k * 2.5);
        size[i] = baseSize[i] * (0.4 + 0.6 * k);
      }
      for (const name of ['position', 'color', 'size', 'alpha']) geometry.attributes[name].needsUpdate = true;
    },
    dispose() {
      scene.remove(points);
      geometry.dispose();
      material.dispose();
    }
  };
}
