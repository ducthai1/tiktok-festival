// Phần dựng cố định của cảnh bơi: trời hoàng hôn, mặt biển có sóng, đảo xa, dây phao, tường gạch.
import * as THREE from '/vendor/three/three.module.js';

export const METER_TO_UNIT = 0.3; // 1 mét đường đua = 0.3 đơn vị 3D
const LANE_HALF = 3.2;
const BUOY_SPACING = 1.2;

function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 512;
  const g = canvas.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#1b2a6b');
  grad.addColorStop(0.45, '#6a5bb0');
  grad.addColorStop(0.7, '#ff9a76');
  grad.addColorStop(1, '#ffd6a0');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const WATER_VERTEX = `
  uniform float uTime;
  uniform float uScroll;
  varying vec3 vWorld;
  varying float vWave;
  void main() {
    vec3 p = position;
    float z = p.y + uScroll;
    float w = sin(p.x * 0.6 + uTime * 1.2) * 0.1 + sin(z * 0.8 - uTime * 1.6) * 0.09 + sin((p.x + z) * 1.9 + uTime * 2.4) * 0.03;
    p.z += w;
    vWave = w;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }`;
const WATER_FRAGMENT = `
  uniform float uTime;
  uniform float uScroll;
  varying vec3 vWorld;
  varying float vWave;
  void main() {
    float dist = clamp(-vWorld.z / 70.0, 0.0, 1.0);
    vec3 deep = vec3(0.01, 0.13, 0.3);
    vec3 shallow = vec3(0.02, 0.36, 0.55);
    vec3 sunset = vec3(1.0, 0.62, 0.42);
    vec3 col = mix(shallow, deep, smoothstep(0.0, 0.55, dist));
    col = mix(col, sunset, smoothstep(0.55, 1.0, dist) * 0.65);
    float crest = smoothstep(0.1, 0.17, vWave);
    float glint = pow(max(0.0, sin(vWorld.x * 3.0 + (vWorld.z - uScroll) * 2.2 + uTime * 1.5)), 40.0) * (1.0 - dist);
    col += vec3(0.8, 0.92, 1.0) * (crest * 0.18 + glint * 0.45);
    gl_FragColor = vec4(col, 1.0);
  }`;

export function buildSwimWorld(scene) {
  scene.background = skyTexture();
  scene.fog = new THREE.Fog('#ffb38a', 45, 95);
  scene.add(new THREE.HemisphereLight('#bcd8ff', '#1a4a6a', 1.3));
  const sunLight = new THREE.DirectionalLight('#ffe2c0', 2.2);
  sunLight.position.set(-6, 12, -10);
  sunLight.castShadow = true;
  scene.add(sunLight);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 130, 90, 160),
    new THREE.ShaderMaterial({ vertexShader: WATER_VERTEX, fragmentShader: WATER_FRAGMENT, uniforms: { uTime: { value: 0 }, uScroll: { value: 0 } } })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.z = -45;
  scene.add(water);

  const sun = new THREE.Mesh(new THREE.CircleGeometry(3.2, 40), new THREE.MeshBasicMaterial({ color: '#fff1c9', toneMapped: false, fog: false }));
  sun.position.set(-5, 6.5, -100);
  scene.add(sun);

  const islandMat = new THREE.MeshStandardMaterial({ color: '#2f6b3c', flatShading: true, roughness: 0.9, fog: false });
  const sandMat = new THREE.MeshStandardMaterial({ color: '#d9b97a', flatShading: true, fog: false });
  [[-24, -88, 5], [20, -92, 7], [-40, -96, 4], [36, -84, 3.5]].forEach(([x, z, r]) => {
    const hill = new THREE.Mesh(new THREE.ConeGeometry(r, r * 0.8, 7), islandMat);
    hill.position.set(x, r * 0.35, z);
    const beach = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.1, r * 1.2, 0.4, 9), sandMat);
    beach.position.set(x, 0, z);
    scene.add(hill, beach);
  });

  // Dây phao hai bên làn bơi: dùng InstancedMesh, cuộn theo quãng đường
  const buoyCount = 70;
  const buoys = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.4 }), buoyCount * 2);
  const red = new THREE.Color('#ff4a3d');
  const white = new THREE.Color('#ffffff');
  for (let i = 0; i < buoyCount * 2; i += 1) buoys.setColorAt(i, (Math.floor(i / 2) % 4 < 2) ? red : white);
  scene.add(buoys);

  return { water, buoys, buoyCount };
}

const dummy = new THREE.Object3D();

export function animateSwimWorld(world, t, distanceUnits) {
  world.water.material.uniforms.uTime.value = t;
  world.water.material.uniforms.uScroll.value = distanceUnits;
  const shift = distanceUnits % (BUOY_SPACING * 4);
  for (let i = 0; i < world.buoyCount; i += 1) {
    const z = 8 - i * BUOY_SPACING + shift;
    for (const side of [0, 1]) {
      dummy.position.set(side ? LANE_HALF : -LANE_HALF, 0.05 + Math.sin(t * 2 + i) * 0.05, z);
      dummy.updateMatrix();
      world.buoys.setMatrixAt(i * 2 + side, dummy.matrix);
    }
  }
  world.buoys.instanceMatrix.needsUpdate = true;
}

// Tường gạch chắn ngang làn bơi; trả về group có userData.bricks để làm hiệu ứng vỡ.
export function buildWall() {
  const wall = new THREE.Group();
  const colors = ['#b5523b', '#c8643f', '#9e4532'];
  const bricks = [];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const brick = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.42, 0.5),
        new THREE.MeshStandardMaterial({ color: colors[(row + col) % 3], roughness: 0.85, transparent: true }));
      brick.position.set(-3.1 + col * 0.8 + (row % 2) * 0.4 - 0.2, 0.1 + row * 0.44, 0);
      brick.castShadow = true;
      brick.userData.home = brick.position.clone();
      wall.add(brick);
      bricks.push(brick);
    }
  }
  wall.userData.bricks = bricks;
  return wall;
}
