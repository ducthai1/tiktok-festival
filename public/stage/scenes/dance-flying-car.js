// XE BAY mọc cánh chở người tặng quà 99–199 💎 bay một vòng quanh sàn (đường bay: dance-car-path.js):
// - mẫu xe 3D Kenney "Starter Kit Racing" (CC0, public/assets/dance/car) — 4 màu xoay vòng, bánh xe quay;
// - đôi cánh neon thật (banners/wings-neon.webp) sau lưng xe, luôn quay về camera, vỗ theo nhịp;
// - vòng sáng neon dưới gầm; vệt KHÓI CẦU VỒNG (ảnh khói Kenney) phả ra từ đuôi xe, nở to rồi tan dần.
// Tối đa 4 xe cùng lúc; khói dùng chung một lưới instanced (nhẹ cho máy live).
import * as THREE from '/vendor/three/three.module.js';
import { GLTFLoader } from '/vendor/three-addons/loaders/GLTFLoader.js';
import { ridePose } from './dance-car-path.js';

const BASE = '/static/assets/dance/car/';
const COLORS = ['red', 'purple', 'yellow', 'green'];
const GLOW = ['#ff4f6d', '#b06bff', '#ffd34d', '#4fffa0'];
const CAR_SCALE = 0.78;
const SMOKE_MAX = 360;
const SMOKE_LIFE = 1.5;
const SMOKE_RATE = 48; // hạt / giây / xe

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function createSmoke(scene) {
  const tex = new THREE.TextureLoader().load(`${BASE}smoke.png`);
  tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.PlaneGeometry(1, 1);
  const alpha = new THREE.InstancedBufferAttribute(new Float32Array(SMOKE_MAX), 1).setUsage(THREE.DynamicDrawUsage);
  const tint = new THREE.InstancedBufferAttribute(new Float32Array(SMOKE_MAX * 3), 3).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aAlpha', alpha);
  geo.setAttribute('aTint', tint);
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex } },
    transparent: true,
    depthWrite: false,
    vertexShader: `attribute float aAlpha; attribute vec3 aTint; varying vec2 vUv; varying float vAlpha; varying vec3 vTint;
      void main() { vUv = uv; vAlpha = aAlpha; vTint = aTint; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vAlpha; varying vec3 vTint;
      void main() { vec4 t = texture2D(map, vUv); float a = t.a * vAlpha; if (a < 0.01) discard; gl_FragColor = vec4(vTint * (0.75 + 0.25 * t.r), a); }`
  });
  const mesh = new THREE.InstancedMesh(geo, mat, SMOKE_MAX);
  mesh.frustumCulled = false;
  mesh.count = 0;
  scene.add(mesh);
  const parts = []; // { pos, vel, age, hue }
  const m = new THREE.Matrix4();
  const s = new THREE.Vector3();
  const color = new THREE.Color();
  return {
    emit(pos, back, hue) {
      if (parts.length >= SMOKE_MAX) parts.shift();
      const vel = back.clone().multiplyScalar(0.6 + Math.random() * 0.5);
      vel.x += (Math.random() - 0.5) * 0.5;
      vel.y += 0.25 + Math.random() * 0.35;
      vel.z += (Math.random() - 0.5) * 0.5;
      parts.push({ pos: pos.clone(), vel, age: 0, hue, spin: Math.random() * Math.PI });
    },
    update(dt, camera) {
      for (let i = parts.length - 1; i >= 0; i -= 1) {
        const p = parts[i];
        p.age += dt;
        if (p.age >= SMOKE_LIFE) parts.splice(i, 1);
        else p.pos.addScaledVector(p.vel, dt);
      }
      parts.forEach((p, i) => {
        const k = p.age / SMOKE_LIFE;
        const size = 0.28 + k * 0.95;
        m.compose(p.pos, camera.quaternion, s.set(size, size, size));
        mesh.setMatrixAt(i, m);
        alpha.setX(i, (k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88) * 0.5);
        color.setHSL((p.hue + k * 0.15) % 1, 0.95, 0.56); // cầu vồng đậm: thành dải khói màu, không phải mây trắng
        tint.setXYZ(i, color.r, color.g, color.b);
      });
      mesh.count = parts.length;
      mesh.instanceMatrix.needsUpdate = true;
      alpha.needsUpdate = true;
      tint.needsUpdate = true;
    },
    dispose() {
      scene.remove(mesh);
      geo.dispose();
      mat.dispose();
    }
  };
}

export function createFlyingCars(scene) {
  const models = [];
  const loader = new GLTFLoader();
  COLORS.forEach((c, i) => loader.load(`${BASE}vehicle-truck-${c}.glb`, (gltf) => { models[i] = gltf.scene; }, undefined, () => {}));
  const wingsTex = new THREE.TextureLoader().load('/static/assets/dance/banners/wings-neon.webp');
  wingsTex.colorSpace = THREE.SRGBColorSpace;
  const glowTex = glowTexture();
  const smoke = createSmoke(scene);
  const cars = new Map(); // id người ngồi → xe
  let serial = 0;
  const back = new THREE.Vector3();
  const exhaust = new THREE.Vector3();
  const toCam = new THREE.Vector3();

  function makeCar() {
    const idx = serial++ % COLORS.length;
    const src = models[idx] || models.find(Boolean);
    if (!src) return null; // mẫu xe chưa tải xong → khung sau
    const group = new THREE.Group();
    const body = src.clone(true);
    body.scale.setScalar(CAR_SCALE);
    const wheels = [];
    body.traverse((o) => { if (o.name.startsWith('wheel')) wheels.push(o); });
    const wings = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.48),
      new THREE.MeshBasicMaterial({ map: wingsTex, transparent: true, depthWrite: false, color: '#d8d8d8', side: THREE.DoubleSide }));
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6),
      new THREE.MeshBasicMaterial({ map: glowTex, color: GLOW[idx], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.05;
    group.add(body, glow);
    scene.add(group, wings);
    return { group, wings, wheels, hue: idx * 0.25, emitDebt: 0 };
  }

  function drop(id) {
    const car = cars.get(id);
    if (!car) return;
    scene.remove(car.group, car.wings);
    car.wings.geometry.dispose();
    car.wings.material.dispose();
    cars.delete(id);
  }

  return {
    /** riders: [{ id, seconds (từ lúc cất cánh), home: {x, z} }] */
    update(dt, now, riders, camera) {
      const active = new Set();
      for (const r of riders) {
        const pose = ridePose(r.seconds, r.home);
        if (pose.done) continue;
        let car = cars.get(r.id);
        if (!car) {
          car = makeCar();
          if (!car) continue;
          cars.set(r.id, car);
        }
        active.add(r.id);
        car.group.position.set(pose.x, pose.y, pose.z);
        car.group.rotation.set(pose.pitch, pose.heading, pose.bank, 'YXZ');
        for (const w of car.wheels) w.rotation.x += dt * 14;
        // cánh: sau lưng xe, hơi cao, luôn quay về camera, vỗ nhịp
        toCam.subVectors(camera.position, car.group.position).normalize();
        car.wings.position.copy(car.group.position).addScaledVector(toCam, -0.55).setY(pose.y + 0.75);
        car.wings.quaternion.copy(camera.quaternion);
        const flap = Math.sin(now * 9 + car.hue * 10);
        car.wings.scale.set(1 + flap * 0.06, 1 + flap * 0.2, 1);
        // khói cầu vồng từ đuôi xe
        back.set(-Math.sin(pose.heading), 0, -Math.cos(pose.heading));
        car.emitDebt += dt * SMOKE_RATE;
        while (car.emitDebt >= 1) {
          car.emitDebt -= 1;
          exhaust.copy(car.group.position).addScaledVector(back, 1.05).setY(pose.y + 0.32);
          smoke.emit(exhaust, back, (car.hue + now * 0.12) % 1);
        }
      }
      for (const id of [...cars.keys()]) if (!active.has(id)) drop(id);
      smoke.update(dt, camera);
    },
    /** Vị trí xe đang chở người `id` (để camera bám theo), null nếu không có. */
    positionOf: (id) => cars.get(id)?.group.position || null,
    dispose() {
      for (const id of [...cars.keys()]) drop(id);
      smoke.dispose();
    }
  };
}
