// Quả cầu disco "thật": hàng trăm mảnh gương vuông nhỏ ốp theo các vòng vĩ tuyến (như cầu gương ngoài đời), mỗi mảnh
// nghiêng lệch một chút; vật liệu kim loại phản chiếu môi trường là các đèn màu của phòng nên khi quay mảnh nào hướng
// về đèn thì loé sáng — lấp lánh tự nhiên. Kèm tia sáng thể tích toả xuống (shader đèn rọi drei) và đốm sáng chạy trên tường.
import * as THREE from '/vendor/three/three.module.js';
import { beamCone, createBeamMaterial, syncBeamOrigin } from './dance-volumetric-beam.js';

const BEAM_COLORS = ['#ffffff', '#ff5fc8', '#5fd8ff', '#ffe27a', '#b98cff', '#7dffb0'];

// Môi trường để gương phản chiếu: nền tối + các đốm đèn màu (6 mặt hộp lập phương vẽ bằng canvas).
function clubEnvironment() {
  const faces = [];
  for (let f = 0; f < 6; f += 1) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    // nền bạc xám (gương thật phản chiếu cả trần/tường sáng mờ) — nền quá tối thì mảnh gương đen, không ra chất bạc
    const base = g.createLinearGradient(0, 0, 0, 128);
    base.addColorStop(0, f === 2 ? '#c9cede' : '#8c92aa');
    base.addColorStop(1, f === 3 ? '#2a2d3a' : '#4b5066');
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 11; i += 1) {
      const x = ((f * 37 + i * 53) % 112) + 8;
      const y = ((f * 71 + i * 29) % 112) + 8;
      const r = 6 + ((f + i) % 3) * 4;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.4, BEAM_COLORS[(f + i) % BEAM_COLORS.length]);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    faces.push(c);
  }
  const cube = new THREE.CubeTexture(faces);
  cube.colorSpace = THREE.SRGBColorSpace;
  cube.needsUpdate = true;
  return cube;
}

export function buildDiscoBall(scene, position, radius = 0.95) {
  const group = new THREE.Group();
  group.position.copy(position);
  scene.add(group);

  const spinner = new THREE.Group();
  group.add(spinner);
  // lõi tối lấp khe giữa các mảnh gương
  spinner.add(new THREE.Mesh(new THREE.SphereGeometry(radius * 0.97, 32, 20), new THREE.MeshStandardMaterial({ color: '#1b1b22', metalness: 0.6, roughness: 0.5 })));

  // mảnh gương theo vòng vĩ tuyến
  const tile = radius * 0.13;
  const placements = [];
  for (let lat = -82; lat <= 82; lat += 7.6) {
    const phi = THREE.MathUtils.degToRad(lat);
    const ring = Math.max(6, Math.round((2 * Math.PI * radius * Math.cos(phi)) / (tile * 1.08)));
    for (let k = 0; k < ring; k += 1) placements.push([phi, (k / ring) * Math.PI * 2 + (lat % 2) * 0.1]);
  }
  const mirrors = new THREE.InstancedMesh(new THREE.PlaneGeometry(tile, tile),
    new THREE.MeshStandardMaterial({ color: '#f2f4f8', metalness: 1, roughness: 0.08, envMap: clubEnvironment(), envMapIntensity: 1.25 }), placements.length);
  const dummy = new THREE.Object3D();
  placements.forEach(([phi, theta], i) => {
    dummy.position.set(Math.cos(phi) * Math.cos(theta), Math.sin(phi), Math.cos(phi) * Math.sin(theta)).multiplyScalar(radius);
    dummy.lookAt(dummy.position.clone().multiplyScalar(2));
    dummy.rotateX((((i * 7919) % 13) - 6) * 0.012); // mỗi mảnh lệch nhẹ → loé không đều như gương thật
    dummy.rotateY((((i * 104729) % 11) - 5) * 0.012);
    dummy.updateMatrix();
    mirrors.setMatrixAt(i, dummy.matrix);
  });
  spinner.add(mirrors);

  // dây treo
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.4, 6), new THREE.MeshStandardMaterial({ color: '#444', metalness: 0.8 }));
  wire.position.y = radius + 0.7;
  group.add(wire);

  // tia sáng thể tích toả xuống đám đông
  const beams = BEAM_COLORS.concat(BEAM_COLORS).map((color, i) => {
    const head = new THREE.Object3D();
    head.rotation.set(0.5 + (i % 4) * 0.18, (i / 12) * Math.PI * 2, 0, 'YXZ');
    // tia ngắn 5,5 m: đầu tia luôn cao hơn camera thấp nhất → camera không lọt vào trong tia (lọt vào là phủ màu cả màn)
    const cone = beamCone(5.5, 0.45, createBeamMaterial({ color, attenuation: 5.5, anglePower: 5, opacity: 0.55 }));
    head.add(cone);
    spinner.add(head);
    return cone;
  });

  // đốm sáng phản chiếu chạy trên tường / sàn
  const spotsGeo = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < 320; i += 1) {
    const u = Math.random() * 2 - 1;
    const a = Math.random() * Math.PI * 2;
    const r = 9 + Math.random() * 4;
    pts.push(Math.sqrt(1 - u * u) * Math.cos(a) * r, -Math.abs(u) * r * 0.85, Math.sqrt(1 - u * u) * Math.sin(a) * r);
  }
  spotsGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const spots = new THREE.Points(spotsGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.12, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
  spinner.add(spots);

  return {
    update(t, beat, dim) {
      spinner.rotation.y = t * 0.45;
      const hit = Math.pow(1 - (beat % 1), 3);
      for (const cone of beams) {
        syncBeamOrigin(cone);
        cone.material.uniforms.opacity.value = (0.18 + 0.12 * hit) * (1 - dim * 0.6);
      }
      spots.material.opacity = 0.35 + 0.15 * hit;
    }
  };
}
