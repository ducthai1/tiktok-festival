// Trang trí "VIRTUAL CLUB" cho hội trường sàn nhảy: thanh neon trần nhà, khung trần vàng, quả cầu disco lớn có
// tia sáng + đốm phản chiếu chạy khắp tường, tường hai bên có chữ neon, bảng "DJ STAGE", và BỤC TOP 1-2-3 đẹp:
// cột sáng theo hạng, vòng hào quang xoay, số hạng phát sáng, vương miện lơ lửng trên đầu Top 1.
import * as THREE from '/vendor/three/three.module.js';
import { DJ_SPOT, PODIUM, STAGE_FRONT_Z, STAGE_TOP_Y } from '/static/shared/dance-floor-layout.js';

const NEON = ['#36d6ff', '#ff4fa3', '#ffd21f', '#b07cff', '#7dff8a'];
const RANK = ['#ffd21f', '#dfe7f5', '#ff9a3c'];
const additive = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

function textTexture(text, { w = 1024, h = 160, font = '900 96px "Be Vietnam Pro", sans-serif', color = '#fff', glow = '#ff4fa3', frame = '' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (frame) { // khung vàng kiểu bảng tên
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#3a2205'); grad.addColorStop(1, '#120a02');
    g.fillStyle = grad; g.strokeStyle = frame; g.lineWidth = 8;
    g.beginPath(); g.roundRect(6, 6, w - 12, h - 12, 18); g.fill(); g.stroke();
  }
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = glow; g.shadowBlur = 28; g.fillStyle = color;
  g.fillText(text, w / 2, h / 2, w - 40);
  g.shadowBlur = 0; g.fillText(text, w / 2, h / 2, w - 40);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildHallDecor(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // tường hai bên + chữ neon
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(22, 11), new THREE.MeshStandardMaterial({ color: '#0b0716', roughness: 0.6, metalness: 0.2 }));
    wall.position.set(side * 8.2, 5.5, -1);
    wall.rotation.y = -side * Math.PI / 2;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.9), new THREE.MeshBasicMaterial({ map: textTexture('VIRTUAL CLUB • SÀN NHẢY LIVE', { glow: side < 0 ? '#36d6ff' : '#ff4fa3' }), transparent: true, toneMapped: false }));
    sign.position.set(side * 8.1, 6.6, -1);
    sign.rotation.y = -side * Math.PI / 2;
    group.add(wall, sign);
  }

  // trần: khung vàng + các thanh neon chạy ngang
  const gold = new THREE.MeshStandardMaterial({ color: '#c9a34a', metalness: 1, roughness: 0.35, emissive: '#3a2a08' });
  const bars = [];
  for (let i = 0; i < 8; i += 1) {
    const z = 7 - i * 2.2;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(15.5, 0.1, 0.1), gold);
    beam.position.set(0, 9.6, z);
    const neon = new THREE.Mesh(new THREE.BoxGeometry(14, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: NEON[i % NEON.length] }));
    neon.position.set(0, 9.42, z + 0.5);
    group.add(beam, neon);
    bars.push(neon);
  }
  for (const x of [-7.6, 7.6]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 18), gold);
    rail.position.set(x, 9.6, -1);
    group.add(rail);
  }

  // quả cầu disco lớn: tia sáng toả xuống + đốm phản chiếu quay khắp phòng
  const ballPos = new THREE.Vector3(0, 8.3, 0.5);
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 3), new THREE.MeshStandardMaterial({ color: '#e8e8f0', metalness: 1, roughness: 0.12, flatShading: true, emissive: '#555566' }));
  ball.position.copy(ballPos);
  const rays = new THREE.Group();
  rays.position.copy(ballPos);
  for (let i = 0; i < 12; i += 1) {
    // tia ngắn (4,5 m): camera solo đứng thấp không bao giờ lọt vào trong nón (lọt vào là cả màn bị phủ trắng)
    const ray = new THREE.Mesh(new THREE.ConeGeometry(0.3, 4.5, 10, 1, true).translate(0, -2.25, 0), additive(NEON[i % NEON.length], 0.09));
    ray.rotation.set(0.55 + (i % 3) * 0.22, 0, 0);
    const holder = new THREE.Object3D();
    holder.rotation.y = (i / 12) * Math.PI * 2;
    holder.add(ray);
    rays.add(holder);
  }
  const spotsGeo = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < 260; i += 1) {
    const u = Math.random() * 2 - 1;
    const a = Math.random() * Math.PI * 2;
    const r = 10 + Math.random() * 3;
    pts.push(Math.sqrt(1 - u * u) * Math.cos(a) * r, -Math.abs(u) * r * 0.8, Math.sqrt(1 - u * u) * Math.sin(a) * r);
  }
  spotsGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const spots = new THREE.Points(spotsGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.16, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  spots.position.copy(ballPos);
  group.add(ball, rays, spots);

  // hai tấm LED chấm hai bên màn chính (chấm sáng chạy sóng + cột nhạc)
  const dots = document.createElement('canvas');
  dots.width = 48;
  dots.height = 80;
  const dg = dots.getContext('2d');
  const dotsTex = new THREE.CanvasTexture(dots);
  dotsTex.magFilter = THREE.NearestFilter;
  dotsTex.colorSpace = THREE.SRGBColorSpace;
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 4.4), new THREE.MeshBasicMaterial({ map: dotsTex, toneMapped: false }));
    panel.position.set(side * 7.4, STAGE_TOP_Y + 2.6, STAGE_FRONT_Z - 4.4);
    group.add(panel);
  }
  let lastDots = -1;

  // bảng "DJ STAGE" khung vàng cạnh bàn DJ
  const djPlate = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture('DJ STAGE', { w: 640, h: 170, frame: '#e6c26a', color: '#ffe7a3', glow: '#ffb000', font: '900 86px "Be Vietnam Pro", sans-serif' }), toneMapped: false }));
  djPlate.scale.set(2.4, 0.64, 1);
  djPlate.position.set(DJ_SPOT.x, STAGE_TOP_Y + 3.6, DJ_SPOT.z + 0.4);
  group.add(djPlate);

  // bục Top 1-2-3: cột sáng + vòng hào quang xoay + số hạng
  const podiums = PODIUM.map((p, i) => {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 7, 28, 1, true), additive(RANK[i], 0.12));
    pillar.position.set(p.x, p.y + 3.5, p.z);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.04, 8, 48), additive(RANK[i], 0.9));
    halo.position.set(p.x, p.y + 0.15, p.z);
    halo.rotation.x = Math.PI / 2;
    const trim = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 1.05, 0.18, 32), new THREE.MeshStandardMaterial({ color: RANK[i], metalness: 1, roughness: 0.25, emissive: RANK[i], emissiveIntensity: 0.25 }));
    trim.position.set(p.x, STAGE_TOP_Y + 0.09, p.z);
    const number = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(String(i + 1), { w: 256, h: 256, font: '900 200px "Be Vietnam Pro", sans-serif', glow: RANK[i], color: RANK[i] }), toneMapped: false }));
    number.scale.set(0.9, 0.9, 1);
    number.position.set(p.x, (STAGE_TOP_Y + p.y) / 2, p.z + 0.95);
    group.add(pillar, halo, trim, number);
    return { pillar, halo };
  });

  // vương miện lơ lửng trên đầu Top 1 (ảnh vương miện của bộ sticker; chưa tải xong thì ẩn)
  const crownTex = new THREE.TextureLoader().load('/static/assets/dance/prop-crown.webp', (t) => { t.colorSpace = THREE.SRGBColorSpace; });
  const crown = new THREE.Sprite(new THREE.SpriteMaterial({ map: crownTex, transparent: true, depthWrite: false }));
  crown.scale.set(0.95, 0.85, 1);
  crown.visible = false;
  group.add(crown);

  return {
    /** top1: vị trí đỉnh đầu Top 1 (Vector3) hoặc null */
    update(t, beat, { top1Head, dim }) {
      const hit = Math.pow(1 - (beat % 1), 3);
      bars.forEach((bar, i) => bar.material.color.set(NEON[(i + Math.floor(beat / 2)) % NEON.length]).multiplyScalar(0.55 + 0.45 * (i % 2 ? hit : 1 - hit)));
      ball.rotation.y = t * 0.5;
      rays.rotation.y = t * 0.5;
      spots.rotation.y = t * 0.5;
      for (const holder of rays.children) holder.children[0].material.opacity = 0.05 + 0.06 * hit * (1 - dim * 0.6);
      podiums.forEach(({ pillar, halo }, i) => {
        pillar.material.opacity = (0.05 + 0.05 * Math.abs(Math.sin(t * 1.4 + i))) * (i === 0 ? 1.4 : 1);
        halo.rotation.z = t * (i % 2 ? -1.2 : 1.2);
        halo.position.y = PODIUM[i].y + 0.15 + Math.abs(Math.sin(t * 2 + i)) * 0.25;
      });
      if (Math.floor(t * 15) !== lastDots) {
        lastDots = Math.floor(t * 15);
        dg.fillStyle = '#05040a';
        dg.fillRect(0, 0, 48, 80);
        for (let y = 0; y < 20; y += 1) {
          for (let x = 0; x < 12; x += 1) {
            const eq = 20 - y < 6 + 12 * Math.abs(Math.sin(beat * Math.PI * 0.5 + x * 0.7));
            const wave = Math.sin(x * 0.6 + y * 0.35 - t * 4) > 0.55;
            const v = eq ? 1 : wave ? 0.45 : 0.08;
            dg.fillStyle = eq ? `hsla(${(200 + y * 6 + beat * 20) % 360},100%,${40 + v * 40}%,1)` : `rgba(255,255,255,${v})`;
            dg.fillRect(x * 4 + 1, y * 4 + 1, 2, 2);
          }
        }
        dotsTex.needsUpdate = true;
      }
      crown.visible = false; // khung danh hiệu hoàng gia của Top 1 đã có vương miện — không chồng thêm
      if (top1Head) crown.position.set(top1Head.x, top1Head.y + 0.35 + Math.sin(t * 2.4) * 0.08, top1Head.z);
    }
  };
}
