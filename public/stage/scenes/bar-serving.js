// Phục vụ đồ uống theo bậc quà — mỗi bậc một màn riêng, quà càng lớn màn càng hoành tráng:
// bia: bartender rót, cốc bay tới tay khách · cocktail: lắc bình mạnh, rót dòng màu · champagne: bật nút,
// bọt vàng phun, đèn rọi khách · tháp ly: xếp tháp rồi rót tràn tầng tầng, cả quán nâng ly ·
// mở tiệc: pháo giấy hai bên, laser quét, đèn chớp, pháo hoa (laser chạy suốt lúc tiệc).
import * as THREE from '/vendor/three/three.module.js';
import { disposeObject } from './person-model.js';

const glassMat = () => new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, roughness: 0.05 });

export function drinkMesh(kind) {
  const group = new THREE.Group();
  if (kind === 'beer') {
    group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.28, 12), new THREE.MeshStandardMaterial({ color: '#f2a516', emissive: '#7a4a00', emissiveIntensity: 0.4 })));
    const foam = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.06, 12), new THREE.MeshStandardMaterial({ color: '#fffaf0' }));
    foam.position.y = 0.16;
    group.add(foam);
  } else {
    const color = kind === 'cocktail' ? '#ff4fa3' : '#ffd36b';
    const cup = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.22, 16, 1, true), glassMat());
    cup.rotation.x = Math.PI;
    cup.position.y = 0.2;
    const liquid = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.16, 16), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2 }));
    liquid.rotation.x = Math.PI;
    liquid.position.y = 0.22;
    group.add(cup, liquid, new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.2, 6), glassMat()));
  }
  group.rotation.x = Math.PI; // tay buông xuống: lật ly cho thẳng
  return group;
}

const from = new THREE.Vector3();
const to = new THREE.Vector3();

export function createBarServing({ scene, room, crowd, particles, audio, focus }) {
  const flights = [];
  const delivering = new Set();
  let clock = 0;
  let action = { kind: '', until: 0 };
  let tower = null;
  const lasers = ['#ff3fa4', '#36d6ff', '#7dff8a', '#ffcb3d', '#b78bff', '#ff3fa4'].map((color, i) => {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 26, 6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, toneMapped: false }));
    beam.geometry.translate(0, -13, 0);
    beam.position.set(i < 3 ? -6 : 6, 9.5, -2 + (i % 3) * 3);
    beam.visible = false;
    scene.add(beam);
    return beam;
  });
  const strobe = new THREE.PointLight('#ffffff', 0, 30, 1);
  strobe.position.set(0, 8, 3);
  scene.add(strobe);

  function bartenderDoes(kind, seconds) {
    action = { kind, start: clock, until: clock + seconds };
  }

  function launch(fx, kind, delay) {
    delivering.add(fx.userId);
    flights.push({ userId: fx.userId, kind, start: clock + delay, mesh: null });
  }

  function buildTower() {
    if (tower) disposeObject(tower.removeFromParent());
    tower = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: '#ffd36b', emissive: '#ffb300', emissiveIntensity: 1.2, transparent: true, opacity: 0.85 });
    let order = 0;
    for (let level = 0; level < 4; level += 1) {
      const n = 4 - level;
      for (let i = 0; i < n; i += 1) {
        const g = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.24, 14, 1, true), gold);
        g.rotation.x = Math.PI;
        g.position.set((i - (n - 1) / 2) * 0.34, 1.35 + level * 0.3, -3.3);
        g.scale.setScalar(0.01);
        g.userData.appear = clock + (order += 1) * 0.16; // xếp tháp từng ly một
        tower.add(g);
      }
    }
    tower.userData.until = clock + 22;
    scene.add(tower);
  }

  return {
    isDelivering: (id) => delivering.has(id),
    serve(fx) {
      const kind = fx.drink;
      if (kind === 'beer') {
        bartenderDoes('pour', 1.4);
        audio.play('pour');
        launch(fx, 'beer', 1.2);
      } else if (kind === 'cocktail') {
        bartenderDoes('shakeHard', 1.6);
        for (let i = 0; i < 8; i += 1) setTimeout(() => audio.play('rattle'), i * 170);
        setTimeout(() => audio.play('pour'), 1500);
        launch(fx, 'cocktail', 1.9);
      } else if (kind === 'champagne') {
        bartenderDoes('pop', 2.2);
        setTimeout(() => {
          audio.play('cork');
          room.bartender.hand.getWorldPosition(from);
          particles.burst({ position: from.clone().setY(from.y + 0.6), count: 220, colors: ['#ffe9a8', '#ffd36b', '#ffffff'], speed: 6, spread: 0.2, gravity: -7, life: 1.6, size: 0.16 });
        }, 700);
        launch(fx, 'champagne', 1.8);
        const entry = crowd.get(fx.userId);
        if (entry) focus(entry, 5);
      } else {
        // tháp ly + mở tiệc: xếp tháp, rót tràn, cả quán nâng ly
        bartenderDoes('pop', 3.5);
        buildTower();
        setTimeout(() => audio.play('cork'), 600);
        setTimeout(() => audio.play('pour'), 1900);
        setTimeout(() => audio.play('clink'), 2700);
        for (const entry of crowd.all()) if (!entry.transient) crowd.perform(entry.id, [{ pose: 'cheers', seconds: 3.2 }]);
        launch(fx, 'champagne', 2.4);
        if (kind === 'party') {
          audio.play('fanfare');
          [-1, 1].forEach((side) => particles.burst({ position: new THREE.Vector3(side * 5.5, 0.5, 4), count: 700,
            colors: ['#ff4fa3', '#ffd36b', '#36d6ff', '#7dff8a', '#ffffff', '#b78bff'], speed: 13, spread: 0.15, gravity: -6, life: 3.2, size: 0.2 }));
        }
      }
    },
    frame(t, dt, party) {
      clock = t;
      // bartender: rót / lắc mạnh / bật champagne; xong thì về lắc nhẹ (animateBarRoom)
      const b = room.bartender;
      if (t < action.until) {
        const u = t - action.start;
        if (action.kind === 'pour') { b.armR.rotation.set(-1.35, 0, -0.1 + Math.sin(u * 2) * 0.05); b.armL.rotation.set(-0.2, 0, 0.12); }
        if (action.kind === 'shakeHard') { b.armR.rotation.set(-2.4 + Math.sin(u * 30) * 0.45, 0, -0.3); b.armL.rotation.set(-2.4 + Math.sin(u * 30 + 0.5) * 0.45, 0, 0.3); }
        if (action.kind === 'pop') { const up = u < 0.7 ? -2.6 : -1.9; b.armR.rotation.set(up, 0, -0.2); b.armL.rotation.set(up, 0, 0.2); }
        if (action.kind === 'pop' && u > 1.6 && tower) {
          particles.burst({ position: new THREE.Vector3((Math.random() - 0.5) * 1.2, 2.4 - Math.random() * 0.9, -3.3), count: 3, colors: ['#ffe08a', '#ffd36b'], speed: 0.6, gravity: -5, life: 0.8, size: 0.12 });
        }
      }
      // ly bay từ tay bartender tới tay khách theo vòng cung
      for (let i = flights.length - 1; i >= 0; i -= 1) {
        const f = flights[i];
        if (t < f.start) continue;
        const entry = crowd.get(f.userId);
        if (!f.mesh) {
          f.mesh = drinkMesh(f.kind);
          f.mesh.rotation.x = 0;
          room.bartender.hand.getWorldPosition(f.from = new THREE.Vector3());
          scene.add(f.mesh);
        }
        const k = Math.min(1, (t - f.start) / 1.1);
        if (entry) entry.model.hand.getWorldPosition(to);
        else to.copy(f.from);
        f.mesh.position.lerpVectors(f.from, to, k * k * (3 - 2 * k));
        f.mesh.position.y += Math.sin(Math.PI * k) * 1.6;
        f.mesh.rotation.y += dt * 8;
        if (Math.random() < 0.5) particles.burst({ position: f.mesh.position, count: 1, colors: ['#ffd36b', '#ffffff'], speed: 0.3, gravity: 0, life: 0.5, size: 0.1 });
        if (k >= 1) {
          disposeObject(f.mesh.removeFromParent());
          delivering.delete(f.userId);
          flights.splice(i, 1);
          if (entry && !crowd.busy(entry.id)) crowd.perform(entry.id, [{ pose: 'cheers', seconds: 2.4 }]);
          audio.play('clink');
        }
      }
      if (tower) {
        for (const g of tower.children) g.scale.setScalar(t > g.userData.appear ? Math.min(1, g.scale.x + dt * 6) : 0.01);
        if (t > tower.userData.until) {
          disposeObject(tower.removeFromParent());
          tower = null;
        }
      }
      // laser quét + đèn chớp trong lúc tiệc
      lasers.forEach((beam, i) => {
        beam.visible = party;
        if (party) beam.rotation.set(Math.sin(t * 1.3 + i) * 0.5, 0, (i < 3 ? 1 : -1) * (0.5 + Math.sin(t * 0.9 + i * 1.7) * 0.35));
      });
      // đèn chớp nhẹ ~2 lần/giây (không chớp gắt, tránh gây khó chịu cho người xem nhạy sáng)
      strobe.intensity = party ? 18 + Math.max(0, Math.sin(t * 13)) * 28 : 0;
    }
  };
}
