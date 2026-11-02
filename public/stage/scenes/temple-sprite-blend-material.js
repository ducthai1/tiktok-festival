// Vật liệu vẽ nhân vật 2D mượt: hoà dần giữa 2 khung vẽ (A → B) trên cùng một tấm phẳng, cộng thêm
// biến dạng nhẹ của tấm phẳng (cúi phần thân trên, nghiêng, nhún) để giữa hai khung vẫn có chuyển động
// liên tục — thay cho việc bật thẳng từ hình này sang hình kia.
// Mỗi khung có cỡ/mốc chân riêng nên tấm phẳng phủ "hộp chung" của cả hai; shader tự đổi toạ độ sang
// ảnh của từng khung (ngoài ảnh = trong suốt).
import * as THREE from '/vendor/three/three.module.js';

const VERTEX = `
  uniform float uPivot;   // độ cao (0..1 của hộp) nơi thân trên bắt đầu gập
  uniform float uLean;    // nghiêng phần trên theo chiều ngang (tỉ lệ bề rộng hộp)
  uniform float uSquash;  // co phần trên theo chiều dọc (cúi xuống khi nhìn từ sau)
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float above = max(0.0, uv.y - uPivot);
    float k = above / max(0.001, 1.0 - uPivot);
    p.x += uLean * above * (0.6 + 0.4 * k);
    p.y -= above * (1.0 - uSquash);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;

const FRAGMENT = `
  uniform sampler2D uMapA;
  uniform sampler2D uMapB;
  uniform vec4 uRectA;    // (offsetX, offsetY, scaleX, scaleY): toạ độ hộp → toạ độ ảnh A
  uniform vec4 uRectB;
  uniform float uMix;
  uniform vec3 uTint;
  varying vec2 vUv;
  vec4 sampleFrame(sampler2D map, vec4 rect) {
    vec2 uv = rect.xy + vUv * rect.zw;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
    return texture2D(map, uv);
  }
  void main() {
    vec4 a = sampleFrame(uMapA, uRectA);
    vec4 b = sampleFrame(uMapB, uRectB);
    float alpha = a.a * (1.0 - uMix) + b.a * uMix;
    if (alpha < 0.06) discard;
    vec3 color = (a.rgb * a.a * (1.0 - uMix) + b.rgb * b.a * uMix) / alpha;
    gl_FragColor = vec4(color * uTint, alpha);
  }`;

export function createBlendMaterial(tint) {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uMapA: { value: null }, uMapB: { value: null },
      uRectA: { value: new THREE.Vector4(0, 0, 1, 1) }, uRectB: { value: new THREE.Vector4(0, 0, 1, 1) },
      uMix: { value: 0 }, uTint: { value: new THREE.Color(tint) },
      uPivot: { value: 0.45 }, uLean: { value: 0 }, uSquash: { value: 1 }
    },
    transparent: true,
    side: THREE.DoubleSide
  });
}

/**
 * Đặt tấm phẳng + toạ độ ảnh cho cặp khung A, B (mét, gốc = mốc chân).
 * frame: {w, h, ax, texture}; flip: ±1 (lật ngang); base: độ cao chân (ngồi trên đệm).
 */
export function layoutFrames(mesh, a, flipA, baseA, b, flipB, baseB) {
  const boxOf = (f, flip, base) => {
    const left = flip > 0 ? -f.ax * f.w : -(1 - f.ax) * f.w;
    return { x0: left, x1: left + f.w, y0: base, y1: base + f.h };
  };
  const A = boxOf(a, flipA, baseA);
  const B = boxOf(b, flipB, baseB);
  const x0 = Math.min(A.x0, B.x0);
  const x1 = Math.max(A.x1, B.x1);
  const y0 = Math.min(A.y0, B.y0);
  const y1 = Math.max(A.y1, B.y1);
  const W = x1 - x0;
  const H = y1 - y0;
  mesh.scale.set(W, H, 1);
  mesh.position.x = x0 + W / 2;
  mesh.position.y = y0;
  const rect = (box, f, flip, target) => {
    const sx = W / f.w;
    const ox = (x0 - box.x0) / f.w;
    // lật ngang: u ảnh = 1 - u
    if (flip > 0) target.set(ox, (y0 - box.y0) / f.h, sx, H / f.h);
    else target.set(1 - ox, (y0 - box.y0) / f.h, -sx, H / f.h);
  };
  const u = mesh.material.uniforms;
  rect(A, a, flipA, u.uRectA.value);
  rect(B, b, flipB, u.uRectB.value);
  u.uMapA.value = a.texture;
  u.uMapB.value = b.texture;
}
