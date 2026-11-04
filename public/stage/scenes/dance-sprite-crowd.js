// Đám đông sticker trên sàn nhảy: mỗi người xem một nhân vật ảnh động (InstancedMesh theo từng tấm ảnh ghép).
// Trạng thái hình: crowd (nhảy tại ô) · xung (bản nhảy bung — khi camera cận / Top 3 / khổng lồ) · spot (solo).
// Người mới rơi từ trên xuống đúng ô; người đi bay vút lên; đổi chỗ xa thì nhảy vòng cung qua đầu đám đông.
import * as THREE from '/vendor/three/three.module.js';
import { DJ_SPOT, FRONT_Z, GIANT_SPOTS, PODIUM, SLOT_DZ, DANCE_ROWS, SOLO_SPOT, spreadSlotPosition } from '/static/shared/dance-floor-layout.js';
import { buildPool, characterForSlot, DJ_CHARACTER, sheetFor } from './dance-roster.js';
import { createWingsMesh } from './dance-wings.js';
import { createSheetMaterial, hashText, spriteGeometry } from './dance-sprite-material.js';

const BASE = '/static/assets/dance/';
const HEIGHT_M = 1.05; // cao của một người ở cỡ 1 (mét) — sticker nhỏ, đứng kín sàn
const FLOOR_MID_Z = FRONT_Z - ((DANCE_ROWS - 1) * SLOT_DZ) / 2;
const WALK_S = 9; // "đi vòng": một vòng elip quanh sàn trong 9 giây
const JUMP_S = 1.3;
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
      if (sheets[key].kind === 'crowd') { // vài trăm ảnh đám đông: bỏ mipmap cho nhẹ bộ nhớ card đồ hoạ (sticker nhỏ trên màn)
        t.texture.generateMipmaps = false;
        t.texture.minFilter = THREE.LinearFilter;
      } else t.texture.anisotropy = 4;
    }
    return t;
  }
  // ảnh chỉ tải khi có người dùng tới (kho vài trăm nhân vật — tải sẵn hết thì nặng card đồ hoạ)
  const pool = buildPool(sheets);
  // cánh theo hạng: Top 1 tím hoàng gia, Top 2 băng, Top 3 lửa, người solo/khổng lồ neon, người có cánh (1k tim, quà) năng lượng
  const WING_FILES = { top1: 'player-wings.webp', top2: 'wings-ice.webp', top3: 'wings-fire.webp', star: 'wings-neon.webp', basic: 'energy-wings-v2.webp' };
  // cánh neon: người đang solo, khổng lồ VIP và fan mới follow (10 phút) — nhiều người cùng lúc nên sức chứa lớn hơn cánh Top
  const WING_CAP = { basic: capacity, star: 40 };
  const wingCap = (kind) => WING_CAP[kind] || 4;
  const wingMeshes = Object.fromEntries(Object.entries(WING_FILES).map(([k, f]) => [k, createWingsMesh(scene, wingCap(k), f)]));
  const wingKind = (e, ctx) => (e.info.rank ? `top${e.info.rank}` : e.id === ctx.soloId || e.info.giant || e.info.fan ? 'star' : e.info.wings ? 'basic' : '');

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

  function placeFor(info, ctx, e) {
    if (info.dj) return { ...DJ_SPOT, scale: 1.4, vis: 'xung' };
    if (info.id === ctx.soloId) return { ...SOLO_SPOT, scale: 2.1, vis: 'spot' };
    const giant = ctx.giants.indexOf(info.id);
    if (giant >= 0) return { x: GIANT_SPOTS[giant].x, y: 0, z: GIANT_SPOTS[giant].z, scale: 3, vis: 'xung' };
    if (info.rank >= 1 && info.rank <= 3) return { ...PODIUM[info.rank - 1], scale: PODIUM[info.rank - 1].scale * 1.15, vis: 'xung' };
    const p = spreadSlotPosition(info.slot, ctx.floorCount || 0); // ít người thì dàn đều cả sàn
    const scale = (info.aura ? 1.12 : 1) * (info.size || 1);
    if (e?.walkStart !== undefined) { // đi một vòng elip quanh sàn, bắt đầu từ phía ô của mình
      const a = Math.atan2(p.z - FLOOR_MID_Z, p.x) + ((ctx.now - e.walkStart) / WALK_S) * Math.PI * 2;
      return { x: Math.cos(a) * 4.6, y: 0, z: FLOOR_MID_Z + Math.sin(a) * 5.2, scale, vis: 'crowd' };
    }
    return { x: p.x, y: (info.level || 0) * 0.4, z: p.z, scale, vis: info.id === ctx.closeId ? 'xung' : 'crowd' };
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
          if (info.dj) {
            e = { id: info.id, index, info, pos: new THREE.Vector3(target.x, target.y, target.z), scale: target.scale, anchor: new THREE.Object3D(), phase: 0, leaving: false };
            entities.set(info.id, e);
            e.character = DJ_CHARACTER;
            continue;
          }
          e = { id: info.id, index, info, pos: new THREE.Vector3(target.x, target.y + 7, target.z), scale: target.scale,
            anchor: new THREE.Object3D(), phase: hashText(info.id) % 4, leaving: false };
          entities.set(info.id, e);
          flyTo(e, tmp.set(target.x, target.y, target.z), 0.9, 0.2); // rơi từ trên xuống ô của mình
        }
        if (info.move === 'walk' && e.info.move !== 'walk') e.walkStart = ctx.now;
        if (info.move !== 'walk') delete e.walkStart;
        if (info.move === 'jump' && e.info.move !== 'jump') e.jumpStart = ctx.now;
        e.info = info;
        e.character = info.dj ? DJ_CHARACTER : characterForSlot(pool, info.slot, info.look);
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
        const target = placeFor(e.info, ctx, e);
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
        if (!sheets[key] || !texture(key).ready) continue; // ảnh đang tải: khung sau mới hiện
        if (!groups.has(key)) groups.set(key, []);
        const hero = target.vis !== 'crowd';
        const jt = e.jumpStart !== undefined ? (ctx.now - e.jumpStart) / JUMP_S : 1;
        const hop = e.flight ? 0 : jt < 1 ? Math.sin(Math.PI * jt) * 0.9 * e.scale // "nhảy 1 cái"
          : e.info.move === 'hype' ? Math.abs(Math.sin(beat * Math.PI)) * 0.3 * e.scale
            : e.info.move === 'walk' ? Math.abs(Math.sin(beat * Math.PI * 2)) * 0.08 : 0;
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
      // cánh sau lưng, ngang vai, lùi xa camera một chút
      const used = Object.fromEntries(Object.keys(wingMeshes).map((k) => [k, 0]));
      for (const list of groups.values()) {
        for (const { e, hop } of list) {
          const kind = wingKind(e, ctx);
          const mesh = wingMeshes[kind];
          if (!mesh || e.flight || used[kind] >= wingCap(kind)) continue;
          const h = HEIGHT_M * e.scale;
          tmp.set(e.pos.x, e.pos.y + hop + h * 0.62, e.pos.z).addScaledVector(scaleV.subVectors(tmp, ctx.camPos).setY(0).normalize(), 0.12);
          mesh.setMatrixAt(used[kind], matrix.compose(tmp, NO_TURN, scaleV.setScalar(h * (kind === 'basic' ? 1.6 : 2))));
          mesh.geometry.getAttribute('aPhase').setX(used[kind], e.phase * 0.25);
          used[kind] += 1;
        }
      }
      for (const [kind, mesh] of Object.entries(wingMeshes)) {
        mesh.count = used[kind];
        mesh.instanceMatrix.needsUpdate = true;
        mesh.geometry.getAttribute('aPhase').needsUpdate = true;
        mesh.material.uniforms.beat.value = beat;
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
          // sticker meme phần lớn màu trắng: giữ dưới ngưỡng bloom (0.9) kẻo người đứng gần camera loá trắng cả màn
          light.setX(i, hero ? 0.86 : 0.82 * (1 - 0.55 * ctx.dim));
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
      for (const e of entities.values()) if (!e.leaving && !e.info.rank && !e.info.dj && !e.flight) box.expandByPoint(e.pos);
      if (box.isEmpty()) box.set(new THREE.Vector3(-2.5, 0, -1), new THREE.Vector3(2.5, 0, 3.4));
      return box;
    },
    dispose() {
      for (const mesh of [...meshes.values(), aura, ...Object.values(wingMeshes)]) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        mesh.dispose();
      }
      for (const t of textures.values()) t.texture.dispose();
    }
  };
}
