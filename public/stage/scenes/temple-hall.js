// Phần dựng cố định của chánh điện: tường sơn son, cột đỏ, đèn lồng, thảm đỏ, bàn thờ đài sen
// có hào quang, lư hương, chuông đồng, mõ gỗ. Có thể thay đài sen bằng ảnh bàn thờ của riêng bạn:
// đặt file public/assets/temple/altar.png (ảnh bạn có quyền dùng) rồi tải lại màn hình.
import * as THREE from '/vendor/three/three.module.js';

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, ...extra });
const GOLD = { color: '#d9a43b', metalness: 0.85, roughness: 0.3 };
const BRONZE = { color: '#8a5a2b', metalness: 0.9, roughness: 0.35 };

const HALO_FRAGMENT = `
  uniform float uTime;
  uniform float uPower;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    float a = atan(p.y, p.x);
    float rays = 0.5 + 0.5 * sin(a * 28.0 + uTime * 0.6);
    float glow = smoothstep(1.0, 0.05, r);
    float ring = smoothstep(0.04, 0.0, abs(r - 0.62)) * 0.8;
    vec3 gold = vec3(1.0, 0.78, 0.36);
    float v = (glow * 0.55 + rays * smoothstep(1.0, 0.35, r) * 0.35 + ring) * uPower;
    gl_FragColor = vec4(gold * v, v);
  }`;

function lotus(scale = 1) {
  const g = new THREE.Group();
  const rings = [[8, 0.55, 0.35, '#ff9ec4'], [10, 0.85, 0.75, '#ffc2d9'], [12, 1.15, 1.1, '#ffe0ea']];
  rings.forEach(([count, radius, tilt, color], ri) => {
    const material = std(color, { emissive: '#ff6fa5', emissiveIntensity: 0.25 - ri * 0.05, roughness: 0.4 });
    for (let i = 0; i < count; i += 1) {
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), material);
      const angle = (i / count) * Math.PI * 2 + ri * 0.3;
      petal.scale.set(0.42, 0.14, 0.95);
      petal.position.set(Math.cos(angle) * radius * 0.6, 0.25 - ri * 0.1, Math.sin(angle) * radius * 0.6);
      petal.rotation.set(0, -angle + Math.PI / 2, 0);
      petal.rotateX(-tilt);
      g.add(petal);
    }
  });
  g.scale.setScalar(scale);
  return g;
}

export function buildTempleHall(scene) {
  scene.background = new THREE.Color('#0d0503');
  scene.fog = new THREE.Fog('#160804', 20, 38);
  scene.add(new THREE.HemisphereLight('#ffd7a0', '#2a0a04', 0.75));
  const key = new THREE.DirectionalLight('#ffe2b0', 1.2);
  key.position.set(2, 12, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);
  const altarLight = new THREE.PointLight('#ffc070', 60, 16, 1.6);
  altarLight.position.set(0, 6, -3);
  scene.add(altarLight);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 34), std('#3a1d10', { roughness: 0.35, metalness: 0.2 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 22), std('#9e1b1b', { roughness: 0.9 }));
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(0, 0.01, 4);
  carpet.receiveShadow = true;
  for (const x of [-1.25, 1.25]) {
    const border = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 22), std('#e0b04a', { metalness: 0.6 }));
    border.rotation.x = -Math.PI / 2;
    border.position.set(x, 0.015, 4);
    scene.add(border);
  }
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 18), std('#5a1208', { roughness: 0.7 }));
  wall.position.set(0, 9, -9);
  scene.add(floor, carpet, wall);

  for (const x of [-6.2, -3.6, 3.6, 6.2]) {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 14, 20), std('#a3150f', { roughness: 0.35 }));
    column.position.set(x, 7, x * x > 20 ? 1.5 : -6.5);
    column.castShadow = true;
    scene.add(column);
    for (const y of [0.3, 13.6]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.5, 20), std(GOLD.color, GOLD));
      band.position.set(column.position.x, y, column.position.z);
      scene.add(band);
    }
  }

  const lanterns = [];
  for (const [x, z] of [[-4.9, -2], [4.9, -2], [-4.9, 3.5], [4.9, 3.5]]) {
    const lantern = new THREE.Group();
    lantern.add(new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 14), new THREE.MeshStandardMaterial({ color: '#ff3a1a', emissive: '#ff4a1a', emissiveIntensity: 1.6 })));
    lantern.children[0].scale.y = 1.2;
    for (const y of [0.66, -0.66]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.14, 12), std(GOLD.color, GOLD));
      cap.position.y = y;
      lantern.add(cap);
    }
    lantern.position.set(x, 7.6, z);
    scene.add(lantern);
    lanterns.push(lantern);
  }

  // Bàn thờ bậc + đài sen + hào quang
  [[8, 0.6, 3.2, 0.3], [6, 0.6, 2.6, 0.9], [4.2, 0.7, 2, 1.55]].forEach(([w, h, d, y], i) => {
    const step = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(i % 2 ? '#7a1a0e' : '#a3291a', { roughness: 0.4 }));
    step.position.set(0, y, -5.8);
    step.castShadow = step.receiveShadow = true;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.08, d + 0.04), std(GOLD.color, GOLD));
    trim.position.set(0, y + h / 2, -5.8);
    scene.add(step, trim);
  });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.ShaderMaterial({
    fragmentShader: HALO_FRAGMENT,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    uniforms: { uTime: { value: 0 }, uPower: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  halo.position.set(0, 6.4, -7.6);
  scene.add(halo);
  const altarPiece = new THREE.Group();
  altarPiece.position.set(0, 1.9, -5.8);
  const bigLotus = lotus(2.1);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.75, 32, 24), new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffcc66', emissiveIntensity: 2.2 }));
  orb.position.y = 1.5;
  altarPiece.add(bigLotus, orb);
  scene.add(altarPiece);
  new THREE.TextureLoader().load('/static/assets/temple/altar.png', (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    const ratio = texture.image.width / texture.image.height;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(6.5 * ratio, 6.5), new THREE.MeshBasicMaterial({ map: texture, transparent: true }));
    plane.position.set(0, 5, -7.2);
    scene.add(plane);
    altarPiece.visible = false;
  }, undefined, () => {});

  const candles = [-2.6, 2.6].map((x) => {
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 12), std('#fff1d6'));
    candle.position.set(x, 2.3, -5.6);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffd27a', toneMapped: false }));
    flame.scale.y = 1.8;
    flame.position.set(x, 2.85, -5.6);
    const light = new THREE.PointLight('#ffb050', 6, 6, 2);
    light.position.copy(flame.position);
    scene.add(candle, flame, light);
    return { flame, light };
  });

  // Lư hương
  const burner = new THREE.Group();
  burner.add(new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.55, 0.7, 24), std(BRONZE.color, BRONZE)));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.07, 8, 24), std(GOLD.color, GOLD));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.35;
  burner.add(rim);
  for (let i = 0; i < 3; i += 1) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.6, 8), std(BRONZE.color, BRONZE));
    leg.position.set(Math.cos(i * 2.1) * 0.45, -0.55, Math.sin(i * 2.1) * 0.45);
    burner.add(leg);
  }
  burner.position.set(0, 0.95, -2.7);
  const sticks = new THREE.Group();
  sticks.position.set(0, 1.3, -2.7);
  scene.add(burner, sticks);

  // Chuông đồng bên trái (khung gỗ + quả chuông xoay quanh điểm treo)
  const bellFrame = new THREE.Group();
  for (const x of [-0.9, 0.9]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4, 0.18), std('#5a2a12'));
    post.position.set(x, 2, 0);
    bellFrame.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.22, 0.24), std('#5a2a12'));
  beam.position.y = 4;
  bellFrame.add(beam);
  const bellPivot = new THREE.Group();
  bellPivot.position.y = 3.9;
  const profile = [[0, -1.5], [0.85, -1.5], [0.8, -1.3], [0.62, -0.6], [0.55, 0], [0.3, 0.12], [0, 0.15]].map(([x, y]) => new THREE.Vector2(x, y));
  const bell = new THREE.Mesh(new THREE.LatheGeometry(profile, 28), std('#b07a2a', { metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide }));
  bell.castShadow = true;
  bellPivot.add(bell);
  bellFrame.add(bellPivot);
  bellFrame.position.set(-4.4, 0, -3.2);
  scene.add(bellFrame);

  // Mõ gỗ bên phải + dùi gõ
  const mo = new THREE.Group();
  const moBody = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 18), std('#8a4a1c', { roughness: 0.45 }));
  moBody.scale.set(1.15, 0.85, 1);
  const slit = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.3), new THREE.MeshBasicMaterial({ color: '#1a0802' }));
  slit.position.set(0, -0.05, 0.55);
  const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.22, 20), std('#c42a1a'));
  cushion.position.y = -0.6;
  const malletPivot = new THREE.Group();
  malletPivot.position.set(0.9, 0.2, 0.2);
  const mallet = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), std('#c99a5b'));
  mallet.rotation.z = Math.PI / 2;
  mallet.position.x = -0.45;
  const malletHead = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), std('#c99a5b'));
  malletHead.position.x = -0.9;
  malletPivot.add(mallet, malletHead);
  mo.add(moBody, slit, cushion, malletPivot);
  mo.position.set(4.3, 1.3, -2.8);
  scene.add(mo);

  return { halo, orb, lanterns, candles, sticks, bellPivot, bellFrame, mo, moBody, malletPivot, lotus };
}
