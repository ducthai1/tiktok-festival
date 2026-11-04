// Vật liệu "sticker" cho sàn nhảy: tấm ảnh luôn quay mặt về camera (chỉ xoay quanh trục đứng), chân chạm sàn,
// phát lần lượt các khung trong ảnh ghép theo PHÁCH nhạc (vòng nhảy khớp số phách gần nhất) nên cả sàn nhún đúng nhịp.
import * as THREE from '/vendor/three/three.module.js';

export const BPM = 128;

export function hashText(text) {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}

/** Một vòng animation dài bao nhiêu phách (≥1) với tốc độ gốc của ảnh động. */
export function loopBeatsFor(meta) {
  const seconds = meta.frames / (meta.fps || 8);
  return Math.max(1, Math.round(seconds / (60 / BPM)));
}

/** Tấm phẳng cao 1 (đáy ở y=0), rộng theo tỉ lệ khung: dùng cho InstancedMesh, mỗi bản sao = một người. */
export function spriteGeometry() {
  return new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
}

export function createSheetMaterial(texture, meta) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: texture },
      beat: { value: 0 },
      frames: { value: meta.frames },
      loopBeats: { value: loopBeatsFor(meta) },
      cols: { value: meta.cols },
      sheet: { value: new THREE.Vector2(meta.sheetW, meta.sheetH) },
      cell: { value: new THREE.Vector2(meta.cellW, meta.cellH) },
      frame: { value: new THREE.Vector2(meta.frameW, meta.frameH) },
      aspect: { value: meta.frameW / meta.frameH }
    },
    vertexShader: `
      attribute float aPhase;
      attribute float aLight;
      uniform float beat, frames, loopBeats, cols, aspect;
      uniform vec2 sheet, cell, frame;
      varying vec2 vUv;
      varying float vLight;
      void main() {
        vec3 center = instanceMatrix[3].xyz;
        float h = length(instanceMatrix[1].xyz);
        float f = floor(mod((beat + aPhase) / loopBeats * frames, frames));
        float c = mod(f, cols);
        float r = floor(f / cols);
        vec2 local = vec2(position.x + 0.5, position.y);
        vec2 px = vec2(c * cell.x + 1.0 + local.x * frame.x, r * cell.y + 1.0 + (1.0 - local.y) * frame.y);
        vUv = vec2(px.x / sheet.x, 1.0 - px.y / sheet.y);
        vLight = aLight;
        vec3 right = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
        vec3 world = center + right * position.x * aspect * h + vec3(0.0, position.y * h, 0.0);
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D map;
      varying vec2 vUv;
      varying float vLight;
      void main() {
        vec4 c = texture2D(map, vUv);
        if (c.a < 0.45) discard;
        gl_FragColor = vec4(c.rgb * vLight, 1.0);
        #include <colorspace_fragment>
      }`
  });
}
