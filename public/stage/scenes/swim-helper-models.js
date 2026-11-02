// Mô hình "trợ thủ" dựng bằng hình khối: vịt phao, ván lướt, thuyền, cá heo, cá mập, cá voi, tàu ngầm.
import * as THREE from '/vendor/three/three.module.js';
import { buildPerson } from './person-model.js';

const m = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, ...extra });

function mesh(geometry, material, [x = 0, y = 0, z = 0] = [], [rx = 0, ry = 0, rz = 0] = [], [sx = 1, sy = 1, sz = 1] = []) {
  const node = new THREE.Mesh(geometry, material);
  node.position.set(x, y, z);
  node.rotation.set(rx, ry, rz);
  node.scale.set(sx, sy, sz);
  node.castShadow = true;
  return node;
}

function fish({ body, belly, length, fin = 0.5, tail = 0.6 }) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(0.5, 20, 14), m(body), [0, 0, 0], [0, 0, 0], [0.7, 0.62, length]));
  g.add(mesh(new THREE.SphereGeometry(0.5, 16, 10), m(belly), [0, -0.12, 0], [0, 0, 0], [0.55, 0.4, length * 0.85]));
  g.add(mesh(new THREE.ConeGeometry(0.22, fin, 4), m(body), [0, 0.42 + fin * 0.3, 0.1], [-0.35, 0, 0]));
  g.add(mesh(new THREE.ConeGeometry(0.3, tail, 4), m(body), [0, 0.05, length * 0.5 + tail * 0.3], [Math.PI / 2, 0, 0], [1.6, 1, 0.5]));
  const eye = new THREE.MeshBasicMaterial({ color: '#111' });
  g.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), eye, [0.24, 0.08, -length * 0.36]));
  g.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), eye, [-0.24, 0.08, -length * 0.36]));
  return g;
}

const BUILDERS = {
  duck() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.TorusGeometry(0.42, 0.2, 12, 24), m('#ffd23f'), [0, 0.05, 0], [Math.PI / 2, 0, 0]));
    g.add(mesh(new THREE.SphereGeometry(0.24, 14, 10), m('#ffd23f'), [0, 0.42, -0.38]));
    g.add(mesh(new THREE.ConeGeometry(0.09, 0.22, 8), m('#ff8a1f'), [0, 0.4, -0.64], [-Math.PI / 2, 0, 0]));
    return g;
  },
  surfer() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CapsuleGeometry(0.35, 2, 4, 12), m('#36d6ff'), [0, 0, 0], [Math.PI / 2, 0, 0], [1, 1, 0.18]));
    const rider = buildPerson({ id: 'surfer-npc' });
    rider.root.scale.setScalar(0.75);
    rider.root.position.y = 0.05;
    rider.armL.rotation.z = 1.3;
    rider.armR.rotation.z = -1.3;
    g.add(rider.root);
    return g;
  },
  boat() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(1.4, 0.6, 2.8), m('#ffffff'), [0, 0.2, 0]));
    g.add(mesh(new THREE.ConeGeometry(0.99, 1.2, 4), m('#ffffff'), [0, 0.2, -1.95], [-Math.PI / 2, Math.PI / 4, 0], [1, 1, 0.43]));
    g.add(mesh(new THREE.BoxGeometry(1.42, 0.12, 2.82), m('#e8423a'), [0, -0.05, 0]));
    g.add(mesh(new THREE.BoxGeometry(0.9, 0.6, 1), m('#36a2ff', { metalness: 0.3 }), [0, 0.8, 0.3]));
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), m('#999'), [0, 1.3, 0.9]));
    g.add(mesh(new THREE.PlaneGeometry(0.5, 0.3), m('#ffcc00', { side: THREE.DoubleSide }), [0.25, 1.75, 0.9]));
    return g;
  },
  dolphin: () => fish({ body: '#6aa8d8', belly: '#e9f3fb', length: 2.2 }),
  shark: () => fish({ body: '#7b8794', belly: '#f2f2f2', length: 2.8, fin: 0.9, tail: 0.8 }),
  whale() {
    const g = fish({ body: '#2f4f8a', belly: '#c9d8ec', length: 5, fin: 0.4, tail: 1.2 });
    return g;
  },
  submarine() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CapsuleGeometry(0.75, 3, 6, 18), m('#ffcf2e', { metalness: 0.4, roughness: 0.3 }), [0, 0, 0], [Math.PI / 2, 0, 0]));
    g.add(mesh(new THREE.BoxGeometry(0.6, 0.7, 1), m('#ffcf2e', { metalness: 0.4 }), [0, 0.95, 0.2]));
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8), m('#666'), [0, 1.6, 0.4]));
    for (const z of [-0.8, 0, 0.8]) {
      g.add(mesh(new THREE.CircleGeometry(0.18, 16), new THREE.MeshStandardMaterial({ color: '#9ef0ff', emissive: '#4fd8ff', emissiveIntensity: 1.5 }), [0.76, 0.1, z], [0, Math.PI / 2, 0]));
    }
    g.add(mesh(new THREE.TorusGeometry(0.4, 0.06, 8, 16), m('#555'), [0, 0, 2.3]));
    return g;
  }
};

export function buildHelper(kind) {
  const g = (BUILDERS[kind] || BUILDERS.duck)();
  g.userData.kind = kind;
  return g;
}

// Kích cỡ để đặt trợ thủ phía sau người bơi mà không chui vào nhau.
export const HELPER_LENGTH = { duck: 1, surfer: 2.2, boat: 3.5, dolphin: 2.4, shark: 3, whale: 8, submarine: 4.4 };
