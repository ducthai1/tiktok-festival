// "Huy hiệu + cánh": đôi cánh xanh phát sáng vẫy theo nhịp trên lưng người có quà (giống trend "đi bar online").
// Vẽ bằng canvas, cộng sáng (additive) nên không đè bẩn lên mặt sticker; luôn quay về camera như sticker.
import * as THREE from '/vendor/three/three.module.js';

function wingsTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  for (const side of [-1, 1]) {
    g.save();
    g.translate(128, 64);
    g.scale(side, 1);
    const grad = g.createRadialGradient(30, -10, 4, 50, -6, 80);
    grad.addColorStop(0, 'rgba(120,215,255,1)');
    grad.addColorStop(0.4, 'rgba(30,140,255,0.95)');
    grad.addColorStop(1, 'rgba(20,60,255,0)');
    g.fillStyle = grad;
    g.beginPath(); // cánh trên
    g.moveTo(6, 0);
    g.bezierCurveTo(30, -70, 120, -66, 118, -24);
    g.bezierCurveTo(112, 4, 50, 8, 6, 0);
    g.fill();
    g.beginPath(); // cánh dưới
    g.moveTo(6, 4);
    g.bezierCurveTo(40, 10, 96, 30, 82, 56);
    g.bezierCurveTo(60, 70, 20, 40, 6, 4);
    g.fill();
    g.strokeStyle = 'rgba(140,230,255,0.9)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(10, -2); g.bezierCurveTo(40, -40, 90, -50, 110, -28);
    g.stroke();
    g.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createWingsMesh(scene, capacity) {
  const geometry = new THREE.PlaneGeometry(1, 0.5);
  geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage));
  const material = new THREE.ShaderMaterial({
    uniforms: { map: { value: wingsTexture() }, beat: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aPhase;
      uniform float beat;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 center = instanceMatrix[3].xyz;
        float w = length(instanceMatrix[0].xyz);
        float flap = 0.75 + 0.25 * abs(sin((beat + aPhase) * 3.14159));
        vec3 right = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
        vec3 world = center + right * position.x * w * flap + vec3(0.0, position.y * w, 0.0);
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D map;
      varying vec2 vUv;
      void main() {
        vec4 c = texture2D(map, vUv);
        gl_FragColor = vec4(c.rgb * c.a * 0.6, 1.0); // nhạt bớt để cộng sáng không bệt thành trắng
        #include <colorspace_fragment>
      }`
  });
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.renderOrder = 2;
  scene.add(mesh);
  return mesh;
}
