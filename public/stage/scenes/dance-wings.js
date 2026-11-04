// "Huy hiệu + cánh": đôi cánh sau lưng vẫy theo nhịp (ảnh cánh lửa/băng/neon/tím/năng lượng ở public/assets/dance/banners).
// Mỗi loại cánh một InstancedMesh; luôn quay về camera như sticker, đặt lùi sau lưng nhân vật.
import * as THREE from '/vendor/three/three.module.js';

export function createWingsMesh(scene, capacity, file, aspect = 0.46) {
  const texture = new THREE.TextureLoader().load(`/static/assets/dance/banners/${file}`);
  texture.colorSpace = THREE.SRGBColorSpace;
  const geometry = new THREE.PlaneGeometry(1, aspect);
  geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage));
  const material = new THREE.ShaderMaterial({
    uniforms: { map: { value: texture }, beat: { value: 0 } },
    transparent: true,
    depthWrite: false,
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
        if (c.a < 0.04) discard;
        gl_FragColor = vec4(c.rgb * 0.85, c.a); // dưới ngưỡng bloom: cánh rõ nét, không loá
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
