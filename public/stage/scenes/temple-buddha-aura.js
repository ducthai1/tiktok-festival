// Hào quang tượng Phật: phủ một lớp sáng cộng lên đúng vùng tượng trong tranh nền.
// - viền sáng ôm sát dáng tượng + quầng rộng, "thở" sáng/tối như ánh đèn
// - tia sáng toả từ vầng hào quang sau đầu, hai lớp xoay ngược chiều rất chậm (không phủ lên mặt tượng)
// - cứ ~4 giây một vòng sáng lan ra từ đầu tượng
// Dáng tượng lấy từ phat-hao-quang.png (R = viền, G = quầng, B = mặt nạ tượng), xem
// scripts/temple-art/buddha_glow_layer.py. Có lễ lớn (boost) thì mọi lớp rực lên.
import * as THREE from '/vendor/three/three.module.js';
import { screenPoint } from './temple-view.js';

const DEPTH = 13.6; // độ sâu đặt lớp phủ; nằm sau mọi người/đồ lễ, phủ khít vùng tranh theo mọi mức phóng

const FRAGMENT = `
  uniform sampler2D uMap;
  uniform float uTime;
  uniform float uBoost;
  uniform vec2 uCenter;
  uniform float uAspect;
  varying vec2 vUv;
  void main() {
    vec3 d = texture2D(uMap, vUv).rgb; // r: viền, g: quầng, b: mặt nạ tượng
    vec2 p = (vUv - uCenter) * vec2(uAspect, 1.0);
    float r = length(p);
    float a = atan(p.y, p.x);
    float breath = 0.5 + 0.5 * sin(uTime * 1.25);
    float shimmer = 0.5 + 0.5 * sin(uTime * 3.3 + a * 4.0);
    float outside = 1.0 - d.b;
    float rays = pow(0.5 + 0.5 * sin(a * 22.0 + uTime * 0.35), 8.0) * 0.65
               + pow(0.5 + 0.5 * sin(a * 13.0 - uTime * 0.22), 10.0) * 0.5;
    rays *= smoothstep(0.08, 0.17, r) * smoothstep(0.5, 0.17, r) * outside * (0.75 + 0.25 * breath);
    float wave = fract(uTime * 0.25);
    float ring = smoothstep(0.025, 0.0, abs(r - (0.12 + wave * 0.45))) * (1.0 - wave) * outside;
    vec2 e = smoothstep(vec2(0.0), vec2(0.1), vUv) * smoothstep(vec2(1.0), vec2(0.9), vUv); // mép vùng cắt mờ dần
    float k = (1.0 + uBoost * 1.1) * e.x * e.y;
    vec3 gold = vec3(1.0, 0.8, 0.45);
    float glow = d.r * (0.26 + 0.16 * breath + 0.06 * shimmer) + d.g * (0.09 + 0.05 * breath);
    // trên thân tượng chỉ ửng rất nhẹ, giữ rõ mặt và nếp áo; sáng dồn ra mép và nền phía sau
    vec3 col = gold * (glow * mix(1.0, 0.12, d.b) + rays * 0.15 + ring * 0.2) * k;
    gl_FragColor = vec4(col, 1.0);
  }`;

export function createBuddhaAura(scene, aura) {
  const [x0, y0, x1, y1] = aura.rect;
  const topLeft = screenPoint(x0, y0, DEPTH);
  const bottomRight = screenPoint(x1, y1, DEPTH);
  const width = bottomRight.x - topLeft.x;
  const height = topLeft.y - bottomRight.y;
  const material = new THREE.ShaderMaterial({
    fragmentShader: FRAGMENT,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    uniforms: {
      uMap: { value: aura.texture },
      uTime: { value: 0 },
      uBoost: { value: 0 },
      uCenter: { value: new THREE.Vector2(...aura.center) },
      uAspect: { value: ((x1 - x0) * 1080) / ((y1 - y0) * 1920) }
    },
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.position.set(topLeft.x + width / 2, bottomRight.y + height / 2, -DEPTH);
  mesh.renderOrder = -5; // ngay sau tranh nền, trước người và đồ lễ
  scene.add(mesh);
  const [cx, cy] = aura.center;
  return {
    /** Tâm vầng hào quang sau đầu tượng (toạ độ 3D) — nơi hạt sáng của quà lớn toả ra. */
    center: screenPoint(x0 + cx * (x1 - x0), y0 + (1 - cy) * (y1 - y0), DEPTH),
    /** Điểm ngẫu nhiên quanh thân tượng (cho bụi vàng bay lên). */
    randomPoint: () => screenPoint(0.5 + (Math.random() - 0.5) * 0.36, 0.2 + Math.random() * 0.2, DEPTH - 0.4),
    update(t, boost) {
      material.uniforms.uTime.value = t;
      material.uniforms.uBoost.value += ((boost ? 1 : 0) - material.uniforms.uBoost.value) * 0.04;
    }
  };
}
