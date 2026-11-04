// Đám đông sticker trên sàn nhảy: mỗi người xem một nhân vật ảnh động (InstancedMesh theo từng tấm ảnh ghép).
// Trạng thái hình: crowd (nhảy tại ô) · xung (bản nhảy bung — khi camera cận / Top 3 / khổng lồ) · spot (solo).
// Người mới rơi từ trên xuống đúng ô; người đi bay vút lên; đổi chỗ xa thì nhảy vòng cung qua đầu đám đông.
import * as THREE from '/vendor/three/three.module.js';
import { GIANT_SPOTS, PODIUM, SOLO_SPOT, slotPosition } from '/static/shared/dance-floor-layout.js';
import { characterFor, ROSTER, sheetFor } from './dance-roster.js';
import { createSheetMaterial, hashText, spriteGeometry } from './dance-sprite-material.js';

const BASE = '/static/assets/dance/';
const HEIGHT_M = 1.3; // cao của một người ở cỡ 1 (mét)
const RANK_COLORS = ['#ffd21f', '#e5e7eb', '#f59e0b'];
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const NO_TURN = new THREE.Quaternion();

export async function loadDanceSheets() {
  const response = await fetch(`${BASE}sheets.json`);
  if (!response.ok) throw new Error('Không tải được danh sách nhân vật sàn nhảy');
  return response.json();
}

export function createSpriteCrowd(scene, { sheets, capacity }) {
  const loader = new THREE.TextureLoader();
  const textures = new Map(); // tên ảnh → { texture, ready }
  const meshes = new Map(); // tên ảnh → InstancedMesh
  const entities = new Map();
  const freeIndices = Array.from({ length: capacity }, (_, i) => capacity - 1 - i);
  const tmp = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const scaleV = new THREE.Vector3();
  const color = new THREE.Color();
  let highWater = 0;

  function texture(key) {
    let t = textures.get(key);
    if (!t) {
      t = { ready: false, texture: null };
      textures.set(key, t);
      t.texture = loader.load(`${BASE}${sheets[key].file}`, () => { t.ready = true; });
      t.texture.colorSpace = THREE.SRGBColorSpace;
      t.texture.anisotropy = 4;
    }
    return t;
  }
  // ảnh nhảy tại chỗ của mọi nhân vật tải sẵn; bản xung/spot tải khi cần lần đầu
  for (const c of ROSTER) if (sheets[c.crowd]) texture(c.crowd);

  function meshFor(key) {
    let mesh = meshes.get(key);
    if (!mesh) {
      const geometry = spriteGeometry();
      const big = sheets[key].kind === 'crowd';
      const cap = big ? capacity : 6;
      geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('aLight', new THREE.InstancedBufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage));
      mesh = new THREE.InstancedMesh(geometry, createSheetMaterial(texture(key).texture, sheets[key]), cap);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.userData.cap = cap;
      scene.add(mesh);
      meshes.set(key, mesh);
    }
    return mesh;
  }

  // vòng sáng dưới chân (Top 1-2-3, có quà, đang solo)
  const aura = new THREE.InstancedMesh(new THREE.RingGeometry(0.3, 0.52, 36).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }), capacity);
  aura.frustumCulled = false;
  aura.setColorAt(0, color.set('#fff'));
  scene.add(aura);

  function placeFor(info, ctx) {
    if (info.id === ctx.soloId) return { ...SOLO_SPOT, scale: 1.7, vis: 'spot' };
    const giant = ctx.giants.indexOf(info.id);
    if (giant >= 0) return { x: GIANT_SPOTS[giant].x, y: 0, z: GIANT_SPOTS[giant].z, scale: 3, vis: 'xung' };
    if (info.rank >= 1 && info.rank <= 3) return { ...PODIUM[info.rank - 1], scale: PODIUM[info.rank - 1].scale * 1.15, vis: 'xung' };
    const p = slotPosition(info.slot);
    return { x: p.x, y: (info.level || 0) * 0.4, z: p.z, scale: info.aura ? 1.12 : 1, vis: info.id === ctx.closeId ? 'xung' : 'crowd' };
  }

  function flyTo(e, to, duration, height) {
    e.flight = { from: e.pos.clone(), to: to.clone(), t: 0, duration, height };
  }

  return {
    get: (id) => entities.get(id),
    list: () => [...entities.values()],
    sync(dancers, ctx) {
      const seen = new Set();
      for (const info of dancers) {
        seen.add(info.id);
        let e = entities.get(info.id);
        if (!e) {
          if (!freeIndices.length) continue;
          const index = freeIndices.pop();
          highWater = Math.max(highWater, index + 1);
          const target = placeFor(info, ctx);
          e = { id: info.id, index, info, pos: new THREE.Vector3(target.x, target.y + 7, target.z), scale: target.scale,
            anchor: new THREE.Object3D(), phase: hashText(info.id) % 4, leaving: false };
          entities.set(info.id, e);
          flyTo(e, tmp.set(target.x, target.y, target.z), 0.9, 0.2); // rơi từ trên xuống ô của mình
        }
        e.info = info;
        e.character = characterFor(info.id, info.look);
      }
      for (const e of entities.values()) {
        if (!seen.has(e.id) && !e.leaving) {
          e.leaving = true;
          flyTo(e, tmp.copy(e.pos).setY(e.pos.y + 9), 1.1, 0);
        }
      }
    },
    frame(dt, beat, ctx) {
      const groups = new Map();
      for (const e of [...entities.values()]) {
        const target = placeFor(e.info, ctx);
        tmp.set(target.x, target.y, target.z);
        if (e.flight) {
          const f = e.flight;
          f.t = Math.min(1, f.t + dt / f.duration);
          e.pos.lerpVectors(f.from, f.to, f.t * f.t * (3 - 2 * f.t));
          e.pos.y += Math.sin(Math.PI * f.t) * f.height;
          if (f.t >= 1) {
            e.flight = null;
            if (e.leaving) {
              entities.delete(e.id);
              freeIndices.push(e.index);
              aura.setMatrixAt(e.index, HIDDEN);
              continue;
            }
          }
        } else if (!e.leaving) {
          const far = e.pos.distanceTo(tmp);
          if (far > 1.6) flyTo(e, tmp, 0.8 + far * 0.05, 1.8 + far * 0.12);
          else e.pos.lerp(tmp, Math.min(1, dt * 5));
        }
        e.scale += ((e.leaving ? 0.2 : target.scale) - e.scale) * Math.min(1, dt * 4);
        // chọn tấm ảnh: bản cao cấp chưa tải xong thì tạm dùng bản nhảy tại chỗ
        let key = sheetFor(e.character, target.vis);
        if (!sheets[key] || !texture(key).ready) key = e.character.crowd;
        if (!groups.has(key)) groups.set(key, []);
        const hero = target.vis !== 'crowd';
        const hop = e.info.move === 'hype' && !e.flight ? Math.abs(Math.sin(beat * Math.PI)) * 0.3 * e.scale : 0;
        groups.get(key).push({ e, hero, hop });
        e.anchor.position.set(e.pos.x, e.pos.y + hop + HEIGHT_M * e.scale * 1.02, e.pos.z);
        e.anchor.updateMatrixWorld();
        const soloing = e.id === ctx.soloId;
        const ring = e.info.rank ? RANK_COLORS[e.info.rank - 1] : e.info.aura || soloing ? (Math.floor(beat) % 2 ? '#ff4fa3' : '#36d6ff') : '';
        if (ring && !e.flight) {
          const s = e.scale * (1 + 0.15 * Math.abs(Math.sin(beat * Math.PI)));
          aura.setMatrixAt(e.index, matrix.compose(tmp.set(e.pos.x, e.pos.y + 0.03, e.pos.z), NO_TURN, scaleV.setScalar(s)));
          aura.setColorAt(e.index, color.set(ring));
        } else aura.setMatrixAt(e.index, HIDDEN);
      }
      for (const [key, mesh] of meshes) if (!groups.has(key)) mesh.count = 0;
      for (const [key, list] of groups) {
        const mesh = meshFor(key);
        const phase = mesh.geometry.getAttribute('aPhase');
        const light = mesh.geometry.getAttribute('aLight');
        const n = Math.min(list.length, mesh.userData.cap);
        for (let i = 0; i < n; i += 1) {
          const { e, hero, hop } = list[i];
          const h = HEIGHT_M * e.scale * (sheets[key].kind === 'spot' ? 1.25 : 1);
          mesh.setMatrixAt(i, matrix.compose(tmp.set(e.pos.x, e.pos.y + hop, e.pos.z), NO_TURN, scaleV.setScalar(h)));
          phase.setX(i, e.phase);
          light.setX(i, hero ? 1 : 0.92 * (1 - 0.55 * ctx.dim));
        }
        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
        phase.needsUpdate = true;
        light.needsUpdate = true;
      }
      for (const mesh of meshes.values()) mesh.material.uniforms.beat.value = beat;
      aura.count = highWater;
      aura.instanceMatrix.needsUpdate = true;
      if (aura.instanceColor) aura.instanceColor.needsUpdate = true;
    },
    bounds() {
      const box = new THREE.Box3();
      for (const e of entities.values()) if (!e.leaving && !e.info.rank && !e.flight) box.expandByPoint(e.pos);
      if (box.isEmpty()) box.set(new THREE.Vector3(-2.5, 0, -1), new THREE.Vector3(2.5, 0, 3.4));
      return box;
    },
    dispose() {
      for (const mesh of [...meshes.values(), aura]) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        mesh.dispose();
      }
      for (const t of textures.values()) t.texture.dispose();
    }
  };
}
