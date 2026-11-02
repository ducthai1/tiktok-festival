// Phần dựng cố định của quán bar: tường kệ rượu, biển neon, quầy, ghế, sàn LED, quả cầu disco.
import * as THREE from '/vendor/three/three.module.js';
import { buildPerson, posePerson } from './person-model.js';

export const STOOL_POSITIONS = [-3.75, -2.25, -0.75, 0.75, 2.25, 3.75].map((x) => new THREE.Vector3(x, 0, -2.15));
export const FLOOR_POSITIONS = [];
for (const z of [-0.7, 0.9, 2.5, 4.1]) for (const x of [-3.3, -1.1, 1.1, 3.3]) FLOOR_POSITIONS.push(new THREE.Vector3(x, 0, z));

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, ...extra });
const glow = (color, intensity = 2.2) => new THREE.MeshStandardMaterial({ color: '#111', emissive: color, emissiveIntensity: intensity });

function neonSign(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.font = '900 150px "Segoe UI", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = '#ff3fa4';
  g.shadowBlur = 40;
  g.strokeStyle = '#ff7ac4';
  g.lineWidth = 10;
  g.strokeText(text, 512, 128);
  g.fillStyle = '#ffe4f3';
  g.fillText(text, 512, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }));
  return mesh;
}

export function buildBarRoom(scene) {
  scene.background = new THREE.Color('#07040d');
  scene.fog = new THREE.Fog('#07040d', 18, 34);
  const room = new THREE.Group();
  scene.add(room);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), std('#140d1c', { roughness: 0.3, metalness: 0.4 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), std('#1a0f22'));
  backWall.position.set(0, 7, -6);
  room.add(floor, backWall);

  // Kệ rượu phát sáng
  const shelfMat = std('#3b2417', { roughness: 0.4 });
  const bottleColors = ['#36d6ff', '#ff5fa8', '#ffcb3d', '#7dff8a', '#b78bff'];
  for (let row = 0; row < 3; row += 1) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(10, 0.12, 0.6), shelfMat);
    shelf.position.set(0, 2.2 + row * 1.1, -5.6);
    room.add(shelf);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(10, 0.04, 0.05), glow('#ffb347', 1.4));
    strip.position.set(0, 2.15 + row * 1.1, -5.28);
    room.add(strip);
    for (let i = 0; i < 16; i += 1) {
      const color = bottleColors[(i * 7 + row * 3) % bottleColors.length];
      const h = 0.55 + ((i * 13 + row) % 4) * 0.08;
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, h, 10), new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.35, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85
      }));
      bottle.position.set(-4.6 + i * 0.61, 2.26 + row * 1.1 + h / 2, -5.6);
      room.add(bottle);
    }
  }
  const sign = neonSign('LIVE BAR');
  sign.position.set(0, 6.0, -5.9);
  room.add(sign);

  // Tủ sau quầy + bartender (cảnh nền, không phải người xem nên không có nhãn tên)
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(10.5, 1.7, 0.7), std('#24131f', { roughness: 0.5 }));
  cabinet.position.set(0, 0.85, -5.5);
  const cabinetGlow = new THREE.Mesh(new THREE.BoxGeometry(10.3, 0.05, 0.05), glow('#36d6ff', 1.6));
  cabinetGlow.position.set(0, 1.62, -5.12);
  room.add(cabinet, cabinetGlow);
  const bartender = buildPerson({ id: 'bartender-npc' });
  bartender.root.position.set(1.6, 0, -4.3);
  room.add(bartender.root);
  const shaker = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.34, 12), std('#e8e8f0', { metalness: 0.95, roughness: 0.2 }));
  shaker.rotation.x = Math.PI;
  bartender.hand.add(shaker);

  // Quầy bar
  const counter = new THREE.Mesh(new THREE.BoxGeometry(9.4, 1.1, 1.1), std('#2a1530', { roughness: 0.35 }));
  counter.position.set(0, 0.55, -3.3);
  counter.castShadow = counter.receiveShadow = true;
  const top = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.12, 1.4), std('#d9c3a5', { roughness: 0.18, metalness: 0.2 }));
  top.position.set(0, 1.16, -3.3);
  top.receiveShadow = true;
  const counterLed = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.06, 0.05), glow('#ff3fa4', 3));
  counterLed.position.set(0, 0.12, -2.73);
  room.add(counter, top, counterLed);

  for (const p of STOOL_POSITIONS) {
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.14, 20), std('#c9364f', { roughness: 0.4 }));
    seat.position.set(p.x, 0.86, p.z);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8), std('#c9c9d6', { metalness: 0.9, roughness: 0.25 }));
    leg.position.set(p.x, 0.4, p.z);
    seat.castShadow = true;
    room.add(seat, leg);
  }

  // Sàn nhảy LED 6×5 ô
  const tiles = [];
  for (let ix = 0; ix < 6; ix += 1) {
    for (let iz = 0; iz < 5; iz += 1) {
      const material = new THREE.MeshStandardMaterial({ color: '#0b0710', emissive: '#ff3fa4', emissiveIntensity: 0.4, roughness: 0.25 });
      const tile = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.06, 1.42), material);
      tile.position.set(-3.75 + ix * 1.5, 0.03, -0.6 + iz * 1.5);
      tile.receiveShadow = true;
      tile.userData.seed = ix * 7 + iz * 3;
      tiles.push(tile);
      room.add(tile);
    }
  }

  // Quả cầu disco
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 2), new THREE.MeshStandardMaterial({
    color: '#dfe6ff', metalness: 1, roughness: 0.12, flatShading: true, emissive: '#8a90c8', emissiveIntensity: 0.9
  }));
  ball.position.set(3.4, 7.2, 0.5);
  room.add(ball);

  scene.add(new THREE.HemisphereLight('#6b55a8', '#120818', 0.55));
  const warm = new THREE.PointLight('#ffb36b', 18, 12, 2);
  warm.position.set(0, 5, -3.6);
  scene.add(warm);
  const key = new THREE.DirectionalLight('#fff0f6', 1.6);
  const fill = new THREE.DirectionalLight('#9fb4ff', 0.5);
  fill.position.set(-6, 4, 10);
  scene.add(fill);
  key.position.set(3, 10, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 8;
  key.shadow.camera.bottom = -8;
  scene.add(key);

  const spots = ['#ff3fa4', '#36d6ff', '#ffcb3d'].map((color, i) => {
    const spot = new THREE.SpotLight(color, 70, 22, 0.38, 0.5, 1.5);
    spot.position.set(-5 + i * 5, 9.5, 3);
    spot.target.position.set(0, 0, 2);
    scene.add(spot, spot.target);
    return spot;
  });

  return { tiles, ball, spots, sign, bartender };
}

export function animateBarRoom(room, t, party) {
  const speed = party ? 3 : 0.8;
  const palette = [0.92, 0.55, 0.78]; // hồng, xanh ngọc, tím xen kẽ
  for (const tile of room.tiles) {
    const wave = Math.sin(t * speed * 2 + tile.userData.seed * 0.7);
    const hue = party ? (t * 0.25 + tile.userData.seed * 0.05) % 1 : palette[tile.userData.seed % 3];
    tile.material.emissive.setHSL(hue, 0.85, 0.5);
    tile.material.emissiveIntensity = party ? 0.9 + wave * 0.5 : 0.16 + Math.max(0, wave) * 0.22;
  }
  room.ball.rotation.y = t * (party ? 1.6 : 0.4);
  room.spots.forEach((spot, i) => {
    spot.target.position.set(Math.sin(t * speed + i * 2.1) * 4, 0, 2 + Math.cos(t * speed * 0.8 + i) * 3);
    spot.intensity = party ? 160 : 70;
  });
  // bartender lắc bình pha chế
  posePerson(room.bartender, 'cheers', t);
  room.bartender.armR.rotation.x = -1.6 + Math.sin(t * 14) * 0.35;
  room.bartender.armL.rotation.set(-1.2 + Math.sin(t * 14 + 1) * 0.3, 0, 0.5);
  room.sign.material.opacity = 0.85 + Math.sin(t * 7) * (party ? 0.15 : 0.04);
}
