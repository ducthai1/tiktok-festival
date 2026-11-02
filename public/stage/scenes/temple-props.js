// Đạo cụ nghi lễ chùa: nén hương, hoa sen, đèn lưu ly, mâm ngũ quả, ống xăm + chỗ bày lễ trên bàn thờ.
import * as THREE from '/vendor/three/three.module.js';
import { disposeObject } from './person-model.js';

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...extra });

// Đồ cầm tay được dựng "đứng thẳng" theo trục +y; xoay về đúng tay bằng holdAngle (góc nâng tay của tư thế).
function held(group, holdAngle) {
  group.rotation.x = -holdAngle;
  return group;
}

export function incenseBundle(holdAngle = -2.05) {
  const g = new THREE.Group();
  const tips = [];
  [-0.05, 0, 0.05].forEach((x) => {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.85, 6), std('#c0452a'));
    stick.position.set(x * 1.4, 0.35, 0);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: '#5a2a1a', toneMapped: false }));
    tip.position.set(x * 1.4, 0.78, 0);
    g.add(stick, tip);
    tips.push(tip);
  });
  g.userData.tips = tips;
  g.userData.light = () => tips.forEach((tip) => tip.material.color.set('#ff5a1f'));
  return held(g, holdAngle);
}

export function lotusFlower(lotus, holdAngle = -2.55) {
  const g = new THREE.Group();
  const flower = lotus(0.16);
  flower.position.y = 0.12;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 5), std('#3f7a3a'));
  g.add(flower, stem);
  return held(g, holdAngle);
}

export function lampProp(holdAngle = -2.55) {
  const g = new THREE.Group();
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.07, 0.14, 14), std('#d9a43b', { metalness: 0.8, roughness: 0.3 }));
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.16, 14, 1, true),
    new THREE.MeshStandardMaterial({ color: '#ffe2a0', transparent: true, opacity: 0.35, emissive: '#ffb347', emissiveIntensity: 0.6 }));
  glass.position.y = 0.14;
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd27a', toneMapped: false }));
  flame.scale.y = 1.8;
  flame.position.y = 0.15;
  g.add(cup, glass, flame);
  return held(g, holdAngle);
}

export function fruitTray(holdAngle = -2.55) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.06, 20), std('#c9902a', { metalness: 0.7, roughness: 0.35 })));
  [['#ff8a1f', 0, 0.12, 0], ['#e8342a', 0.16, 0.1, 0.05], ['#ffd23f', -0.15, 0.1, 0.06], ['#7ab547', 0.05, 0.1, -0.15], ['#ff8a1f', -0.07, 0.1, 0.15], ['#e8342a', 0.03, 0.24, 0.02]]
    .forEach(([color, x, y, z]) => {
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), std(color, { roughness: 0.35 }));
      fruit.position.set(x, y, z);
      g.add(fruit);
    });
  return held(g, holdAngle);
}

export function fortuneTube(holdAngle = -1.25) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.42, 14, 1, true), std('#c9a15a', { side: THREE.DoubleSide })));
  for (let i = 0; i < 9; i += 1) {
    const stick = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.5, 0.008), std('#e8c98a'));
    stick.position.set(Math.cos(i * 0.7) * 0.05, 0.1 + (i % 3) * 0.02, Math.sin(i * 0.7) * 0.05);
    g.add(stick);
  }
  return held(g, holdAngle);
}

// Đồ lễ đặt lên bậc đầu của bàn thờ: bay từ tay người dâng tới chỗ trống, giữ tối đa 10 món.
export function createAltarTable(scene) {
  const placed = [];
  const flights = [];
  const slotOf = (i) => new THREE.Vector3(-3.1 + (i % 10) * 0.69, 0.62, -4.45);
  let next = 0;
  return {
    place(prop, clock) {
      scene.attach(prop); // giữ nguyên vị trí đang thấy, rời khỏi tay
      const target = slotOf(next);
      next += 1;
      flights.push({ prop, from: prop.position.clone(), fromRot: prop.rotation.x, to: target, start: clock });
      placed.push(prop);
      if (placed.length > 10) {
        const old = placed.shift();
        scene.remove(old);
        disposeObject(old);
      }
    },
    frame(clock) {
      for (let i = flights.length - 1; i >= 0; i -= 1) {
        const f = flights[i];
        const k = Math.min(1, (clock - f.start) / 0.9);
        const e = k * k * (3 - 2 * k);
        f.prop.position.lerpVectors(f.from, f.to, e);
        f.prop.position.y += Math.sin(Math.PI * k) * 0.6; // bay vòng cung
        f.prop.rotation.set(f.fromRot * (1 - e), 0, 0);
        if (k >= 1) flights.splice(i, 1);
      }
    }
  };
}

// Dãy 9 đèn lưu ly trên bậc thứ hai, sáng lần lượt khi có người dâng đèn.
export function createLampRow(scene) {
  const lamps = [];
  for (let i = 0; i < 9; i += 1) {
    const lamp = lampProp(0);
    lamp.rotation.x = 0;
    lamp.position.set(-2.4 + i * 0.6, 1.22, -4.75);
    const flame = lamp.children[2];
    flame.visible = false;
    scene.add(lamp);
    lamps.push({ flame, until: 0 });
  }
  return {
    light(clock, seconds = 40) {
      lamps.forEach((lamp, i) => { lamp.lightAt = clock + i * 0.18; lamp.until = clock + seconds; });
    },
    frame(clock) {
      for (const lamp of lamps) {
        lamp.flame.visible = clock >= (lamp.lightAt || 0) && clock < lamp.until;
        if (lamp.flame.visible) lamp.flame.scale.set(1, 1.8 + Math.sin(clock * 15 + lamp.lightAt * 9) * 0.25, 1);
      }
    }
  };
}
