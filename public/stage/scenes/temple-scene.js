// Cảnh CHÙA ONLINE: Phật tử (người xem) quỳ trong chánh điện. Mỗi tương tác là một nghi thức có
// diễn biến riêng (xem temple-rituals.js); quà càng lớn lễ càng trang trọng.
import * as THREE from '/vendor/three/three.module.js';
import { formatNumber } from '../stage-hud.js';
import { createCrowd, gridSpot, sideDoorSpot } from './crowd-characters.js';
import { createParticleSystem } from './particle-effects.js';
import { animatePerson, buildPerson, disposeObject } from './person-model.js';
import { animateTempleHall, buildTempleHall } from './temple-hall.js';
import { createTempleRituals } from './temple-rituals.js';

const VIP_X = [-3.75, -2.25, -0.75, 0.75, 2.25, 3.75];
const ROW_X = [-4.7, -3.4, -2.1, 2.1, 3.4, 4.7];
const ROBE = '#8796b5';
const PETALS = ['#c2416f', '#d9668f', '#c9902a', '#b85a7a'];
const CAMERA_Z = 15.2;

function slotPosition(slot) {
  if (slot < 6) return new THREE.Vector3(VIP_X[slot], 0.12, -0.4);
  const n = slot - 6;
  return new THREE.Vector3(ROW_X[n % 6], 0, 1.3 + Math.floor(n / 6) * 1.55);
}

export function createTempleScene({ hud, labels, audio, pipeline }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1080 / 1920, 0.1, 80);
  const hall = buildTempleHall(scene);
  const particles = createParticleSystem(scene, 7000);
  pipeline.setBloom({ strength: 0.6, radius: 0.55, threshold: 0.78 });
  for (const x of VIP_X) {
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.24, 1.1), new THREE.MeshStandardMaterial({ color: '#c42a1a', roughness: 0.6 }));
    cushion.position.set(x, 0.12, -0.4);
    scene.add(cushion);
  }

  const bowUntil = new Map();
  const lanterns = [];
  const waves = [];
  let clock = 0;
  let bellAt = -99;
  let moAt = -99;
  let lastMoSound = 0;
  let lastMoFloat = 0;
  let haloUntil = 0;
  let bowAll = { pose: 'bow', start: 0, until: 0 };

  hud.setTitle('🪷 CHÙA ONLINE');
  hud.setHint(['Thả tim = ', '*gõ mõ*', ' · gõ ', '*thắp hương*', ' · ', '*cầu ...*', ' thả hoa đăng · ', '*xin xăm*', ' gieo quẻ']);

  // Phật tử vào chánh điện rồi đi lên chỗ quỳ, mặt hướng về bàn thờ.
  const crowd = createCrowd({
    scene,
    labels,
    build: (id) => buildPerson({ id, robe: ROBE }),
    place: (info) => slotPosition(info.slot),
    // 1 người: đi từ cổng dọc thảm đỏ; cả đoàn: vào từ hai cửa hông để không che màn hình
    entrance: (i, count) => (count <= 1 ? new THREE.Vector3(0, 0, 9.5) : sideDoorSpot(i, { x: 6.8, z: 0.5, dz: 1 })),
    visitSpot: (i, count) => gridSpot(new THREE.Vector3(0, 0, count > 1 ? 0.9 : 1.6), i, count, { maxCols: 4, dx: 0.75, dz: 0.8 }),
    pose: (model, info, t, walking, dt) => {
      if (walking) return animatePerson(model, 'walk', t, dt);
      if (t < bowAll.until) return animatePerson(model, bowAll.pose, t, dt, false, t - bowAll.start); // cả chánh điện lạy cùng nhịp
      return animatePerson(model, t < (bowUntil.get(info.id) || 0) ? 'bow' : 'kneel', t, dt);
    },
    // Nhãn so le cao/thấp để hàng ngồi sát nhau không đè chữ lên nhau.
    labelFor: (info) => ({ vip: info.vip, small: true, offsetY: info.slot % 2 ? 1.15 : 0.45 }),
    facing: Math.PI,
    speed: 2.6
  });

  const bowOne = (userId, seconds) => bowUntil.set(userId, clock + seconds);
  const helpers = {
    bowAll: (pose, seconds) => { bowAll = { pose, start: clock, until: clock + seconds }; },
    boostHalo: (seconds) => { haloUntil = Math.max(haloUntil, clock + seconds); },
    // Chuông lắc + vòng sóng âm vàng lan ra từ quả chuông.
    swingBell: () => {
      bellAt = clock;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 8, 48), new THREE.MeshBasicMaterial({ color: '#ffd36b', transparent: true, toneMapped: false }));
      ring.position.set(-4.4, 2.7, -3.2);
      scene.add(ring);
      waves.push({ born: clock, mesh: ring });
    },
    petals: (count) => particles.burst({ position: new THREE.Vector3(0, 11, 0), box: new THREE.Vector3(12, 1, 10), count, colors: PETALS,
      speed: 0.6, spread: 1, gravity: -0.9, life: 7, size: 0.26, damping: 0.995 }),
    addIncense(n) {
      for (let i = 0; i < n; i += 1) {
        const stick = new THREE.Group();
        stick.add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.1, 5), new THREE.MeshStandardMaterial({ color: '#b5462a' })));
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshBasicMaterial({ color: '#ff5a1f', toneMapped: false }));
        tip.position.y = 0.56;
        stick.add(tip);
        stick.position.set((Math.random() - 0.5) * 0.9, 0.55, (Math.random() - 0.5) * 0.5);
        stick.rotation.z = (Math.random() - 0.5) * 0.25;
        hall.sticks.add(stick);
      }
      while (hall.sticks.children.length > 27) disposeObject(hall.sticks.children[0].removeFromParent());
      particles.burst({ position: new THREE.Vector3(0, 1.9, -2.7), count: 40, colors: ['#ffb347', '#ffd36b'], speed: 1.5, gravity: 1, life: 1.2, size: 0.18 });
    },
    releaseLantern(fx, from) {
      const lantern = hall.lotus(0.28);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffd27a', toneMapped: false }));
      glow.position.y = 0.2;
      lantern.add(glow);
      lantern.position.copy(from);
      scene.add(lantern);
      lanterns.push({ lantern, born: clock, drift: (Math.random() - 0.5) * 0.6 });
      labels.float(lantern, `🪷 ${fx.nickname}: ${fx.text}`, { ms: 6500, rise: 30, className: 'prayer' });
      audio.play('chime');
      audio.speak(`${fx.nickname} nguyện cầu: ${fx.text}`);
    }
  };
  const rituals = createTempleRituals({ scene, crowd, hall, particles, labels, audio, hud, helpers });

  return {
    scene,
    camera,
    legend: [['❤', ' Gõ mõ'], ['Follow', ' Thỉnh chuông'], ['1💎', ' Hoa sen'], ['5💎', ' Đèn lưu ly'], ['30💎', ' Mâm ngũ quả'], ['100💎', ' Đại lễ'], ['500💎', ' Kim Liên']],
    welcome: { line: 'đã vào chánh điện 🙏 Gõ “thắp hương” để dâng hương', speech: (n) => `A Di Đà Phật, chào mừng ${n} đến chánh điện` },
    probe: (id) => crowd.probe(id),
    update(snapshot) {
      const { state } = snapshot;
      const t = state.totals;
      hud.setStats([`✨ ${formatNumber(t.merit)} công đức`, `🔥 ${formatNumber(t.incense)} nén hương · 🪵 ${formatNumber(t.mo)} mõ`]);
      hud.setBoard('TẤM LÒNG THÀNH', state.board.map((b) => ({ ...b, score: formatNumber(b.points) })));
      crowd.sync(state.devotees, new Set(snapshot.viewers?.pending || []));
    },
    onFx(fx) {
      if (fx.kind === 'welcome') {
        const people = fx.mode === 'group' ? fx.people : [fx];
        for (const entry of crowd.welcome(people)) {
          labels.flash(entry.id, 'welcomed', fx.durationMs || 2600);
          bowOne(entry.id, 3.2); // tới chỗ thì vái chào
        }
        particles.burst({ position: new THREE.Vector3(0, 0.5, 9.8), box: new THREE.Vector3(2.4, 0.4, 1.4), count: 90 + people.length * 20,
          colors: ['#ffd36b', '#fff1c9'], speed: 0.8, spread: 0, gravity: 2.2, life: 2.4, size: 0.24 });
        if (fx.mode === 'group') helpers.petals(160);
      } else if (fx.kind === 'mo') {
        moAt = clock;
        if (clock - lastMoSound > 0.15) { audio.play('mo'); lastMoSound = clock; }
        if (clock - lastMoFloat > 0.6) {
          labels.float(new THREE.Vector3(4.3, 2.2, -2.8), `+${fx.count} ✨`, { ms: 1400, rise: 70 });
          lastMoFloat = clock;
        }
        if (!crowd.busy(fx.userId)) bowOne(fx.userId, 1.6);
      } else if (fx.kind === 'bell') {
        helpers.swingBell();
        helpers.bowAll('bow', 3.2);
        audio.play('bell');
        hud.toast(`🔔 ${fx.nickname} thỉnh chuông — cả chánh điện cùng vái`);
      } else if (fx.kind === 'incense') rituals.incense(fx);
      else if (fx.kind === 'prayer') rituals.prayer(fx);
      else if (fx.kind === 'fortune') rituals.fortune(fx);
      else if (fx.kind === 'offering') rituals.offering(fx);
    },
    frame(dt, t) {
      clock = t;
      animateTempleHall(hall, t, { bellAt, moAt, haloBoost: t < haloUntil });
      const push = rituals.cameraPush();
      camera.position.set(0, 6.6 - push * 0.35, CAMERA_Z - push);
      camera.lookAt(0, 3.6 + push * 0.15, -2.5);
      if (Math.random() < dt * 3) {
        particles.burst({ position: new THREE.Vector3(0, 5, -1), box: new THREE.Vector3(12, 8, 10), count: 1, colors: ['#ffd36b'], speed: 0.2, gravity: 0.05, life: 5, size: 0.1 });
      }
      if (hall.sticks.children.length && Math.random() < dt * 10) {
        particles.burst({ position: new THREE.Vector3((Math.random() - 0.5) * 0.6, 2.5, -2.7), count: 1, colors: ['#8a8a8a', '#bdbdbd'], speed: 0.3, spread: 0, gravity: 0.6, life: 3.5, size: 0.35, damping: 0.99 });
      }
      for (let i = waves.length - 1; i >= 0; i -= 1) {
        const w = waves[i];
        const age = t - w.born;
        w.mesh.scale.setScalar(1 + age * 9);
        w.mesh.material.opacity = Math.max(0, 1 - age / 1.6);
        if (age > 1.6) disposeObject(waves.splice(i, 1)[0].mesh.removeFromParent());
      }
      crowd.frame(dt, t);
      rituals.frame(t, dt);
      for (let i = lanterns.length - 1; i >= 0; i -= 1) {
        const l = lanterns[i];
        const age = t - l.born;
        l.lantern.position.y += dt * 0.9;
        l.lantern.position.z -= dt * 0.5;
        l.lantern.position.x += Math.sin(age * 1.5) * dt * l.drift;
        if (age > 7) disposeObject(lanterns.splice(i, 1)[0].lantern.removeFromParent());
      }
      particles.update(dt);
    },
    dispose() {
      crowd.clear();
      particles.dispose();
      disposeObject(scene);
      hud.clearGame();
      labels.clear();
    }
  };
}
