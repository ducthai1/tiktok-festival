// Cảnh CHÙA ONLINE: tranh chánh điện vẽ tay làm nền, Phật tử (người xem) là nhân vật vẽ tay quỳ trên
// bồ đoàn theo hàng, quay lưng về camera hướng lên bàn thờ. Mỗi tương tác là một nghi thức có diễn
// biến riêng (temple-rituals.js); quà càng lớn lễ càng trang trọng. Đơn vị: mét (temple-view.js).
import * as THREE from '/vendor/three/three.module.js';
import { formatNumber } from '../stage-hud.js';
import { createCrowd, gridSpot, sideDoorSpot } from './crowd-characters.js';
import { createParticleSystem } from './particle-effects.js';
import { animatePerson, disposeObject } from './person-model.js';
import { buildDevotee } from './temple-devotee-sprite.js';
import { createTempleMonks } from './temple-monks.js';
import { addCushion, animatePaintedHall, buildPaintedHall } from './temple-painted-hall.js';
import { lotus } from './temple-props.js';
import { createTempleRituals } from './temple-rituals.js';
import { createTempleCamera, setZoom } from './temple-view.js';

// Hàng quỳ (độ sâu tính từ camera) — hàng đầu là 6 người nhiều điểm nhất, chừa lối giữa theo thảm đỏ.
const ROWS = [
  { depth: 9.0, xs: [0.85, 1.45, 2.05] },
  { depth: 7.5, xs: [0.8, 1.3, 1.8] },
  { depth: 6.2, xs: [0.77, 1.22, 1.67] },
  { depth: 5.2, xs: [0.75, 1.16, 1.57] },
  { depth: 4.4, xs: [0.73, 1.11, 1.49] }
];
const SLOTS = ROWS.flatMap(({ depth, xs }) => [...xs].reverse().map((x) => -x).concat(xs).map((x) => new THREE.Vector3(x, 0, -depth)));
const PETALS = ['#c2416f', '#d9668f', '#e0a840', '#b85a7a'];

export function createTempleScene({ hud, labels, audio, pipeline }) {
  const scene = new THREE.Scene();
  const camera = createTempleCamera();
  const hall = buildPaintedHall(scene, camera);
  const particles = createParticleSystem(scene, 7000);
  const monks = createTempleMonks(scene);
  pipeline.setBloom({ strength: 0.42, radius: 0.5, threshold: 0.86 });
  const seats = SLOTS.map((p, i) => ({ x: p.x, z: p.z, top: addCushion(scene, p, i < 6) }));

  const bowUntil = new Map();
  const lanterns = [];
  const waves = [];
  let clock = 0;
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
    build: (id) => buildDevotee({ id }),
    place: (info) => SLOTS[info.slot] || SLOTS[SLOTS.length - 1],
    // 1 người: từ cổng (dưới khung hình) đi dọc thảm đỏ; cả đoàn: vào từ hai cửa hông ngoài khung
    entrance: (i, count) => (count <= 1 ? new THREE.Vector3(0, 0, -1.9) : sideDoorSpot(i, { x: 3.4, z: -5.2, dz: -0.55 })),
    visitSpot: (i, count) => gridSpot(new THREE.Vector3(0, 0, -8.3), i, count, { maxCols: 3, dx: 0.4, dz: 0.6 }),
    pose: (model, info, t, walking, dt) => {
      model.seat = seats[info.slot] || null;
      model.labelLift = info.slot % 2 ? 0.42 : 0.1;
      if (walking) return animatePerson(model, 'walk', t, dt);
      if (t < bowAll.until) return animatePerson(model, bowAll.pose, t, dt, false, t - bowAll.start); // cả chánh điện lạy cùng nhịp
      return animatePerson(model, t < (bowUntil.get(info.id) || 0) ? 'bow' : 'kneel', t, dt);
    },
    // Nhãn so le cao/thấp để hàng quỳ sát nhau không đè chữ lên nhau.
    labelFor: (info) => ({ vip: info.vip, small: true }),
    facing: Math.PI,
    speed: 2 // m/s; nghi thức đi 80% tốc độ này
  });

  const bowOne = (userId, seconds) => bowUntil.set(userId, clock + seconds);
  const helpers = {
    bowAll: (pose, seconds) => { bowAll = { pose, start: clock, until: clock + seconds }; },
    boostHalo: (seconds) => { haloUntil = Math.max(haloUntil, clock + seconds); },
    // Sư thỉnh chuông ở góc phải; lúc gỗ chạm chuông thì vòng sóng âm vàng lan ra (bellWave).
    swingBell: () => monks.ringBell(),
    petals: (count) => particles.burst({ position: new THREE.Vector3(0, 3.4, -7.2), box: new THREE.Vector3(5, 1.6, 6.5), count, colors: PETALS,
      speed: 0.25, spread: 1, gravity: -0.25, life: 8, size: 0.085, damping: 0.985 }),
    addIncense(n) {
      for (let i = 0; i < n; i += 1) {
        const stick = new THREE.Group();
        stick.add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.1, 5), new THREE.MeshStandardMaterial({ color: '#b5462a' })));
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshBasicMaterial({ color: '#ff5a1f' }));
        tip.position.y = 0.56;
        stick.add(tip);
        stick.position.set((Math.random() - 0.5) * 0.9, 0.5, (Math.random() - 0.5) * 0.4);
        stick.rotation.z = (Math.random() - 0.5) * 0.25;
        hall.sticks.add(stick);
      }
      while (hall.sticks.children.length > 27) disposeObject(hall.sticks.children[0].removeFromParent());
      particles.burst({ position: hall.urnTop.clone().setY(hall.urnTop.y + 0.25), count: 40, colors: ['#ffb347', '#ffd36b'], speed: 0.7, gravity: 0.4, life: 1.2, size: 0.07 });
    },
    releaseLantern(fx, from) {
      const lantern = lotus(0.16);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffd27a' }));
      glow.position.y = 0.12;
      lantern.add(glow);
      lantern.position.copy(from);
      scene.add(lantern);
      lanterns.push({ lantern, born: clock, drift: (Math.random() - 0.5) * 0.3 });
      labels.float(lantern, `🪷 ${fx.nickname}: ${fx.text}`, { ms: 6500, rise: 30, className: 'prayer' });
      audio.play('chime');
      audio.speak(`${fx.nickname} nguyện cầu: ${fx.text}`);
    }
  };
  const rituals = createTempleRituals({ scene, crowd, hall, particles, labels, audio, hud, helpers });

  function bellWave() {
    audio.play('bell');
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.012, 8, 48), new THREE.MeshBasicMaterial({ color: '#ffd36b', transparent: true, depthWrite: false }));
    ring.position.copy(monks.bellCenter());
    scene.add(ring);
    waves.push({ born: clock, mesh: ring });
  }

  return {
    scene,
    camera,
    toneMapping: THREE.NoToneMapping, // tranh vẽ đã có màu chuẩn: không nắn lại màu
    legend: [['❤', ' Gõ mõ'], ['Follow', ' Thỉnh chuông'], ['1💎', ' Hoa sen'], ['5💎', ' Đèn lưu ly'], ['30💎', ' Mâm ngũ quả'], ['100💎', ' Đại lễ'], ['500💎', ' Kim Liên']],
    welcome: { line: 'đã vào chánh điện 🙏 Gõ “thắp hương” để dâng hương', speech: (n) => `A Di Đà Phật, chào mừng ${n} đến chánh điện` },
    probe: (id) => (id === '__monks' ? monks.state() : crowd.probe(id)),
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
          bowOne(entry.id, 3.4); // tới chỗ thì vái chào
        }
        particles.burst({ position: new THREE.Vector3(0, 0.25, -2.6), box: new THREE.Vector3(1.2, 0.3, 0.8), count: 70 + people.length * 15,
          colors: ['#ffd36b', '#fff1c9'], speed: 0.35, spread: 0, gravity: 0.6, life: 2.4, size: 0.07 });
        if (fx.mode === 'group') helpers.petals(160);
      } else if (fx.kind === 'mo') {
        monks.strikeMo();
        if (clock - lastMoSound > 0.15) { audio.play('mo'); lastMoSound = clock; }
        if (clock - lastMoFloat > 0.6) {
          labels.float(monks.moCenter(), `+${fx.count} ✨`, { ms: 1400, rise: 70 });
          lastMoFloat = clock;
        }
        if (!crowd.busy(fx.userId)) bowOne(fx.userId, 1.7);
      } else if (fx.kind === 'bell') {
        helpers.swingBell();
        helpers.bowAll('bow', 3.4);
        hud.toast(`🔔 ${fx.nickname} thỉnh chuông — cả chánh điện cùng vái`);
      } else if (fx.kind === 'incense') rituals.incense(fx);
      else if (fx.kind === 'prayer') rituals.prayer(fx);
      else if (fx.kind === 'fortune') rituals.fortune(fx);
      else if (fx.kind === 'offering') rituals.offering(fx);
    },
    frame(dt, t) {
      clock = t;
      animatePaintedHall(hall, t, { haloBoost: t < haloUntil });
      monks.frame(t, dt, bellWave);
      setZoom(camera, 1 + rituals.cameraPush() * 0.09);
      if (Math.random() < dt * 2.5) { // bụi vàng lơ lửng trong ánh nến
        particles.burst({ position: new THREE.Vector3(0, 2.4, -8), box: new THREE.Vector3(5, 3.5, 7), count: 1, colors: ['#ffd36b'], speed: 0.08, gravity: 0.02, life: 5, size: 0.035 });
      }
      if (hall.sticks.children.length && Math.random() < dt * 9) {
        particles.burst({ position: hall.urnTop.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.45, 0)), count: 1, colors: ['#8a8a8a', '#bdbdbd'],
          speed: 0.12, spread: 0, gravity: 0.15, life: 3.5, size: 0.14, damping: 0.99 });
      }
      for (let i = waves.length - 1; i >= 0; i -= 1) {
        const w = waves[i];
        const age = t - w.born;
        w.mesh.scale.setScalar(1 + age * 4.5);
        w.mesh.material.opacity = Math.max(0, 1 - age / 1.3) * 0.85;
        if (age > 1.3) disposeObject(waves.splice(i, 1)[0].mesh.removeFromParent());
      }
      crowd.frame(dt, t);
      rituals.frame(t, dt);
      for (let i = lanterns.length - 1; i >= 0; i -= 1) {
        const l = lanterns[i];
        const age = t - l.born;
        l.lantern.position.y += dt * 0.42;
        l.lantern.position.z -= dt * 0.35;
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
