// Hội trường sàn nhảy: sàn LED đổi màu theo phách, sân khấu + bục Top 1-2-3, màn LED lớn chạy chữ và cột sóng nhạc,
// giàn đèn moving-head quét chùm sáng, laser khi DROP, quả cầu disco. Mọi thứ dựng bằng code, không tải file ngoài.
import * as THREE from '/vendor/three/three.module.js';
import { DJ_SPOT, PODIUM, STAGE_FRONT_Z, STAGE_TOP_Y } from '/static/shared/dance-floor-layout.js';

// sàn LED phủ kín hội trường: ô to, màu tươi (như các phòng "virtual club")
const TILE = 1.24;
const TILE_COLS = 12;
const TILE_ROWS = 20;
const TILES = TILE_COLS * TILE_ROWS;
const tileAt = (i) => {
  const col = i % TILE_COLS;
  const row = Math.floor(i / TILE_COLS);
  return { col, row, x: (col - (TILE_COLS - 1) / 2) * TILE, z: 17.1 - row * TILE };
};

const NEON = ['#ff4fa3', '#36d6ff', '#ffd21f', '#7dff8a', '#b07cff', '#ff7a2f'];
const BEAM_X = [-5, -3, -1, 1, 3, 5];

function beamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color('#fff') }, strength: { value: 0.5 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 color; uniform float strength; varying float vY; void main(){ gl_FragColor = vec4(color * strength * pow(vY, 1.6), 1.0); }'
  });
}

function screenPainter() {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 400;
  const g = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return {
    texture,
    paint(beat, { title, sub, hue }) {
      const grad = g.createLinearGradient(0, 0, 640, 400);
      grad.addColorStop(0, `hsl(${hue}, 85%, 18%)`);
      grad.addColorStop(1, `hsl(${(hue + 80) % 360}, 85%, 12%)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, 640, 400);
      // cột sóng nhạc nảy theo phách
      for (let i = 0; i < 24; i += 1) {
        const h = 40 + Math.abs(Math.sin(beat * Math.PI + i * 0.7)) * (110 + 60 * Math.sin(i * 1.3 + beat * 0.5));
        g.fillStyle = `hsl(${(hue + i * 9) % 360}, 95%, 60%)`;
        g.fillRect(14 + i * 26, 400 - h, 18, h);
      }
      g.textAlign = 'center';
      g.fillStyle = '#fff';
      g.shadowColor = `hsl(${hue}, 100%, 60%)`;
      g.shadowBlur = 24;
      g.font = '900 70px "Be Vietnam Pro", sans-serif';
      g.fillText(title, 320, 120, 600);
      g.font = '800 40px "Be Vietnam Pro", sans-serif';
      g.fillText(sub, 320, 182, 600);
      g.shadowBlur = 0;
      texture.needsUpdate = true;
    }
  };
}

export function buildDanceHall(scene) {
  const group = new THREE.Group();
  scene.add(group);
  scene.background = new THREE.Color('#05030c');
  scene.fog = new THREE.Fog('#05030c', 22, 48);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: '#1a1030', roughness: 0.32, metalness: 0.3 }));
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  // sàn LED: một ô sáng dưới mỗi chỗ đứng
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE - 0.08, 0.04, TILE - 0.08), new THREE.MeshBasicMaterial({ color: '#fff' }), TILES);
  const m = new THREE.Matrix4();
  for (let i = 0; i < TILES; i += 1) {
    const p = tileAt(i);
    tiles.setMatrixAt(i, m.makeTranslation(p.x, 0.02, p.z));
    tiles.setColorAt(i, new THREE.Color('#000'));
  }
  group.add(tiles);

  // sân khấu + viền neon + bục Top 1-2-3
  const stage = new THREE.Mesh(new THREE.BoxGeometry(13, STAGE_TOP_Y, 4.6), new THREE.MeshStandardMaterial({ color: '#151022', roughness: 0.4, metalness: 0.4 }));
  stage.position.set(0, STAGE_TOP_Y / 2, STAGE_FRONT_Z - 2.3);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(13, 0.07, 0.07), new THREE.MeshBasicMaterial({ color: '#ff4fa3' }));
  edge.position.set(0, STAGE_TOP_Y, STAGE_FRONT_Z);
  group.add(stage, edge);
  const podiums = PODIUM.map((p, i) => {
    const h = p.y - STAGE_TOP_Y;
    const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.8, h, 28), new THREE.MeshStandardMaterial({ color: '#1d1530', roughness: 0.3, metalness: 0.6 }));
    riser.position.set(p.x, STAGE_TOP_Y + h / 2, p.z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: ['#ffd21f', '#e5e7eb', '#f59e0b'][i] }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(p.x, p.y, p.z);
    group.add(riser, ring);
    return ring;
  });

  // màn LED lớn sau sân khấu
  const painter = screenPainter();
  // màn LED lớn 16:9 sau sân khấu (chiếu video DJ nếu có)
  const SCREEN_W = 12.4;
  const SCREEN_H = 7;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), new THREE.MeshBasicMaterial({ map: painter.texture, color: '#bdbdbd', toneMapped: false }));
  screen.position.set(0, STAGE_TOP_Y + 3.9, STAGE_FRONT_Z - 4.7);
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W + 0.5, SCREEN_H + 0.5), new THREE.MeshBasicMaterial({ color: '#1a1030' }));
  frame.position.set(0, STAGE_TOP_Y + 3.9, STAGE_FRONT_Z - 4.72);
  group.add(frame);
  group.add(screen);

  // giàn đèn + chùm moving-head (hình nón cộng sáng, đầu nón ở giàn)
  const truss = new THREE.Mesh(new THREE.BoxGeometry(14, 0.22, 0.22), new THREE.MeshStandardMaterial({ color: '#2a2a35', metalness: 0.8, roughness: 0.3 }));
  truss.position.set(0, 8.2, 0.5);
  group.add(truss);
  const beams = BEAM_X.map((x, i) => {
    const mat = beamMaterial();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.25, 10, 24, 1, true), mat);
    cone.geometry.translate(0, -5, 0); // đỉnh nón ở gốc → xoay quanh đầu đèn
    const pivot = new THREE.Object3D();
    pivot.position.set(x, 8.1, 0.5);
    pivot.add(cone);
    group.add(pivot);
    return { pivot, mat, i };
  });

  // laser: chùm tia mảnh từ hai mép sân khấu, chỉ bật khi DROP / solo lớn
  const lasers = [];
  for (let i = 0; i < 10; i += 1) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 26),
      new THREE.MeshBasicMaterial({ color: NEON[i % NEON.length], transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.geometry.translate(0, 0, 13);
    beam.position.set(i < 5 ? -6 : 6, STAGE_TOP_Y + 0.3, STAGE_FRONT_Z);
    group.add(beam);
    lasers.push(beam);
  }

  // giàn đèn tròn treo trên sân khấu (như các phòng "đi bar online") + bóng đèn nhấp nháy quanh vòng
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.12, 8, 64), new THREE.MeshStandardMaterial({ color: '#3a3a48', metalness: 0.9, roughness: 0.3 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 7.4, STAGE_FRONT_Z - 1.6);
  group.add(ring);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff' }), 24);
  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * Math.PI * 2;
    bulbs.setMatrixAt(i, m.makeTranslation(Math.cos(a) * 3.6, 7.25, STAGE_FRONT_Z - 1.6 + Math.sin(a) * 3.6));
    bulbs.setColorAt(i, new THREE.Color('#fff'));
  }
  group.add(bulbs);
  // bàn DJ (DJ sticker đứng sau bàn)
  const booth = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.85, 0.8), new THREE.MeshStandardMaterial({ color: '#1b1b26', metalness: 0.5, roughness: 0.4, emissive: '#2a0f40' }));
  booth.position.set(DJ_SPOT.x, STAGE_TOP_Y + 0.42, DJ_SPOT.z + 0.75);
  const boothStrip = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.02), new THREE.MeshBasicMaterial({ color: '#36d6ff' }));
  boothStrip.position.set(DJ_SPOT.x, STAGE_TOP_Y + 0.6, DJ_SPOT.z + 1.16);
  group.add(booth, boothStrip);


  // ánh sáng: nền tối, đèn màu trên đám đông nhấp theo phách, đèn rọi solo
  const hemi = new THREE.HemisphereLight('#8ea0ff', '#2a0f2a', 0.9);
  const key = new THREE.DirectionalLight('#ffffff', 1.3);
  key.position.set(2, 9, 10);
  const washes = [-4, 0, 4].map((x, i) => {
    const light = new THREE.PointLight(NEON[i], 20, 14, 1.6);
    light.position.set(x, 4.5, 0);
    group.add(light);
    return light;
  });
  group.add(hemi, key);

  const color = new THREE.Color();
  let lastPaint = -1;
  let videoOn = false;
  return {
    group,
    /** Màn LED sau sân khấu chiếu video DJ (cùng video ở khung trên màn hình). */
    setScreenVideo(video) {
      const map = new THREE.VideoTexture(video);
      map.colorSpace = THREE.SRGBColorSpace;
      // cắt giữa cho đầy màn (video dọc hay ngang đều không bị méo)
      const sa = SCREEN_W / SCREEN_H;
      const va = (video.videoWidth || 16) / (video.videoHeight || 9);
      if (va > sa) { map.repeat.set(sa / va, 1); map.offset.set((1 - sa / va) / 2, 0); } else { map.repeat.set(1, va / sa); map.offset.set(0, (1 - va / sa) / 2); }
      screen.material.map = map;
      screen.material.needsUpdate = true;
      videoOn = true;
    },
    /** state: { drop, dim (0..1, tối sàn khi có solo), screenTitle, screenSub, lasers } */
    update(t, beat, state) {
      const bar = Math.floor(beat / 8);
      const pattern = state.drop ? 4 : bar % 4;
      const hit = Math.pow(1 - (beat % 1), 3);
      // giữ dưới ngưỡng bloom (0.9) để sàn tươi mà không loá trắng cả khung
      const level = (state.drop ? 0.8 : 0.62) * (1 - state.dim * 0.6);
      for (let i = 0; i < TILES; i += 1) {
        const p = tileAt(i);
        let v;
        if (pattern === 0) v = (p.row + p.col + Math.floor(beat)) % 2 ? 0.25 : 1; // bàn cờ đổi mỗi phách
        else if (pattern === 1) v = 0.5 + 0.5 * Math.sin(Math.hypot(p.x, p.z - 0.5) * 1.6 - beat * Math.PI); // sóng tròn từ giữa
        else if (pattern === 2) v = Math.max(0.3, 1 - Math.abs(((beat * 2) % TILE_ROWS) - p.row) * 0.4); // chạy theo hàng
        else if (pattern === 3) v = 0.7 + 0.3 * hit;
        else v = (i * 7 + Math.floor(beat * 4)) % 5 === 0 ? 1.3 : 0.5; // DROP: nhấp nháy loạn
        const hue = pattern === 3 ? (p.col * 0.08 + beat * 0.05) % 1 : ((bar * 0.17 + p.row * 0.02) % 1);
        tiles.setColorAt(i, color.setHSL(hue, 0.95, 0.5).multiplyScalar(Math.min(1.1, Math.max(0.35, v)) * level));
      }
      tiles.instanceColor.needsUpdate = true;
      edge.material.color.setHSL((beat * 0.03) % 1, 1, 0.55);
      podiums.forEach((ring, i) => ring.scale.setScalar(1 + 0.08 * hit * (i === 0 ? 1.5 : 1)));

      for (const b of beams) {
        const swing = state.drop ? 2.2 : 1;
        b.pivot.rotation.z = Math.sin(t * 0.6 * swing + b.i * 0.9) * 0.55;
        b.pivot.rotation.x = 0.35 + Math.sin(t * 0.45 * swing + b.i * 1.7) * 0.4;
        b.mat.uniforms.color.value.set(NEON[(b.i + bar) % NEON.length]);
        b.mat.uniforms.strength.value = (0.16 + 0.22 * hit) * (state.drop ? 1.6 : 1) * (1 - state.dim * 0.7);
      }
      lasers.forEach((beam, i) => {
        const on = state.lasers ? 0.85 : 0;
        beam.material.opacity += (on - beam.material.opacity) * 0.15;
        beam.rotation.y = (i < 5 ? 1 : -1) * (0.35 + 0.12 * (i % 5)) + Math.sin(t * 1.4 + i) * 0.35;
        beam.rotation.x = -0.05 - Math.abs(Math.sin(t * 0.9 + i * 0.5)) * 0.18;
      });
      for (let i = 0; i < 24; i += 1) bulbs.setColorAt(i, color.setHSL(((i + Math.floor(beat * 2)) % 6) / 6, 1, (i + Math.floor(beat * 2)) % 3 ? 0.35 : 0.7));
      bulbs.instanceColor.needsUpdate = true;
      boothStrip.material.color.setHSL((beat * 0.05) % 1, 1, 0.5 + 0.2 * hit);
      washes.forEach((light, i) => {
        light.intensity = (14 + 26 * hit) * (state.drop ? 1.6 : 1) * (1 - state.dim * 0.75);
        light.color.set(NEON[(i * 2 + bar) % NEON.length]);
      });
      hemi.intensity = 0.9 * (1 - state.dim * 0.6);
      screen.material.color.setScalar((videoOn ? 0.86 : 0.74) * (1 - state.dim * 0.45)); // màn LED tối bớt khi có solo để người solo nổi lên
      key.intensity = 1.3 * (1 - state.dim * 0.55);
      // màn LED vẽ lại ~15 lần/giây là đủ mượt
      if (!videoOn && Math.floor(t * 15) !== lastPaint) {
        lastPaint = Math.floor(t * 15);
        painter.paint(beat, { title: state.screenTitle, sub: state.screenSub, hue: (bar * 47) % 360 });
      }
    }
  };
}
