// Cảnh ĐUA BƠI VƯỢT RÀO: một vận động viên bơi giữa biển, người xem gọi trợ thủ đẩy/phá tường.
import * as THREE from '/vendor/three/three.module.js';
import { createMeter, formatNumber } from '../stage-hud.js';
import { createParticleSystem } from './particle-effects.js';
import { buildPerson, disposeObject, posePerson } from './person-model.js';
import { buildHelper, HELPER_LENGTH } from './swim-helper-models.js';
import { animateSwimWorld, buildSwimWorld, buildWall, METER_TO_UNIT } from './swim-world.js';

const WALL_GAP = 2.3; // tường dừng ngay trước đầu người bơi
const APPROACH_S = 0.75;
const LIFE_S = 2.2;

export function createSwimScene({ hud, labels, audio, pipeline }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1080 / 1920, 0.1, 160);
  camera.position.set(0, 5.4, 7.6);
  camera.lookAt(0, 0.2, -8);
  const world = buildSwimWorld(scene);
  const particles = createParticleSystem(scene, 5000);
  pipeline.setBloom({ strength: 0.45, radius: 0.4, threshold: 0.85 });

  const swimmer = buildPerson({ id: 'swimmer-hero-7' });
  swimmer.root.rotation.y = Math.PI;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.35, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: '#ff3b5c', roughness: 0.3 }));
  cap.rotation.x = -0.3;
  swimmer.head.add(cap);
  const goggles = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.04, 8, 24), new THREE.MeshStandardMaterial({ color: '#36d6ff', emissive: '#36d6ff', emissiveIntensity: 0.6 }));
  goggles.position.y = 0.04;
  goggles.rotation.x = Math.PI / 2;
  swimmer.head.add(goggles);
  scene.add(swimmer.root);
  const swimmerAnchor = new THREE.Object3D();
  swimmerAnchor.position.set(0, 1.2, -0.6);
  scene.add(swimmerAnchor);

  const walls = new Map();
  const helpers = [];
  let state = null;
  let shownPos = 0;
  let surge = 0;
  let shake = 0;
  let clock = 0; // giây theo khung hình của cảnh

  hud.setTitle('🏊 ĐUA BƠI VƯỢT RÀO');
  hud.setHint(['Thả tim = ', '*vịt phao*', ' đẩy · bình luận ', '*cố lên*', ' · follow/share = ', '*ván lướt*']);
  const meter = createMeter(hud, { label: '🏁 QUÃNG ĐƯỜNG' });
  const ticks = new Map();

  function syncWalls() {
    for (const w of state.walls) {
      if (!ticks.has(w.at)) {
        const tick = hud.el('div', 'tick');
        tick.style.left = `${(w.at / state.goal) * 100}%`;
        meter.bar.append(tick);
        ticks.set(w.at, tick);
      }
      ticks.get(w.at).classList.toggle('broken', w.hp <= 0);
      let entry = walls.get(w.at);
      if (!entry && w.hp > 0) {
        const group = buildWall();
        const top = new THREE.Object3D();
        top.position.set(0, 1.5, 0);
        group.add(top);
        scene.add(group);
        entry = { group, top, hp: w.hp, exploding: 0 };
        walls.set(w.at, entry);
      }
      if (!entry) continue;
      if (w.hp < entry.hp) shake = Math.max(shake, 0.25);
      if (w.hp <= 0 && !entry.exploding) explode(entry);
      entry.hp = w.hp;
      entry.at = w.at;
    }
    // Chỉ bức tường sắp tới hiện thanh máu; tường xa để trống cho đỡ rối.
    const next = state.walls.find((w) => w.hp > 0 && w.at >= state.position);
    for (const at of walls.keys()) if (!next || at !== next.at) labels.remove(`wall-${at}`);
    if (next && walls.has(next.at)) {
      labels.sync(`wall-${next.at}`, { anchor: walls.get(next.at).top, nickname: `🧱 ${formatNumber(next.hp)} / ${formatNumber(next.maxHp)}`, avatar: null, className: 'wall-hp' });
    }
  }

  function explode(entry) {
    entry.exploding = clock;
    labels.remove(`wall-${entry.at}`);
    audio.play('crash');
    for (const brick of entry.group.userData.bricks) {
      brick.userData.v = new THREE.Vector3((Math.random() - 0.5) * 8, 3 + Math.random() * 6, -2 - Math.random() * 6);
    }
    const p = new THREE.Vector3();
    entry.group.getWorldPosition(p);
    particles.burst({ position: p.setY(1), count: 160, colors: ['#ffffff', '#cfefff', '#c8643f'], speed: 7, gravity: -9, life: 1.4, size: 0.3 });
  }

  function removeWall(at) {
    const entry = walls.get(at);
    if (!entry) return;
    scene.remove(entry.group);
    disposeObject(entry.group);
    labels.remove(`wall-${at}`);
    walls.delete(at);
  }

  function spawnHelper(fx, index, labelEach = false) {
    const group = buildHelper(fx.helper);
    const side = index % 2 ? 1 : -1;
    const length = HELPER_LENGTH[fx.helper] || 2;
    group.position.set(side * 7, 0, -1);
    group.scale.setScalar(fx.helper === 'whale' ? 0.75 : 0.85);
    scene.add(group);
    const id = `helper-${clock.toFixed(3)}-${index}-${Math.random().toString(36).slice(2, 6)}`;
    helpers.push({ id, group, side, born: clock, length, pushed: false, fx });
    if (index === 0 || labelEach) labels.sync(id, { anchor: group, nickname: `${fx.nickname} · ${fx.label}`, avatar: fx.avatar, small: true, offsetY: fx.helper === 'whale' ? 3 : 1.6 });
  }

  function onPush(h) {
    h.pushed = true;
    if (!h.fx.push) {
      audio.play('pop'); // vịt chào người mới: không đẩy, chỉ té nước vui
      particles.burst({ position: h.group.position.clone().setY(0.3), count: 20, colors: ['#ffffff', '#bff3ff'], speed: 3, gravity: -9, life: 0.8, size: 0.18 });
      return;
    }
    surge = Math.min(1.2, surge + 0.35 + Math.min(0.8, h.fx.push / 400));
    audio.play(h.fx.push >= 150 ? 'splash' : 'whoosh');
    particles.burst({ position: new THREE.Vector3(0, 0.3, 0.6), count: 50 + Math.min(150, h.fx.push), colors: ['#ffffff', '#bff3ff'], speed: 5, spread: 0, gravity: -9, life: 1, size: 0.22 });
  }

  return {
    scene,
    camera,
    legend: [['❤', ' Vịt phao +3m'], ['1💎', ' Chân vịt ×1.8'], ['5💎', ' Ván lướt +25'], ['10💎', ' Thuyền +50'],
      ['30💎', ' Cá heo +90'], ['99💎', ' Cá mập +150'], ['199💎', ' Cá voi +350'], ['499💎', ' Tàu ngầm +600']],
    update(snapshot) {
      state = snapshot.state;
      if (state.position < shownPos - 50) {
        shownPos = state.position; // vòng mới: nhảy về vạch xuất phát
        for (const at of [...walls.keys()]) removeWall(at);
      }
      syncWalls();
      const status = state.paused ? ' · TẠM DỪNG' : state.flipperMs > 0 ? ` · chân vịt ${Math.ceil(state.flipperMs / 1000)}s` : '';
      meter.update(state.position / state.goal, `${formatNumber(state.position)} / ${formatNumber(state.goal)} m${status}`);
      hud.setStats([`🏆 ${state.wins} / ${state.winTarget}`, `💎 ${formatNumber(snapshot.totals.diamonds)}`]);
      hud.setBoard('ĐỒNG ĐỘI', state.contributors.map((c) => ({ ...c, score: `${formatNumber(c.meters)} m` })));
    },
    welcome: { line: 'vừa vào đường đua! Thả tim để gọi vịt phao 🦆', speech: (n) => `Chào mừng ${n} đến đường đua!` },
    onFx(fx) {
      if (fx.kind === 'welcome') {
        // Mỗi người mới một chú vịt phao mang tên mình bơi ra chào (không tính vào quãng đường).
        const people = fx.mode === 'group' ? fx.people : [fx];
        people.forEach((person, i) => setTimeout(() => spawnHelper({ helper: 'duck', label: 'vừa vào 👋', push: 0,
          nickname: person.nickname, avatar: person.avatar }, i, true), i * 150));
        return;
      }
      if (fx.kind === 'helper') {
        if (fx.helper === 'flipper') {
          audio.play('chime');
          particles.burst({ position: new THREE.Vector3(0, 0.4, 0.8), count: 80, colors: ['#45e08a', '#b8ffd4'], speed: 3, gravity: 1, life: 1.2 });
          labels.float(swimmerAnchor, `${fx.nickname}: chân vịt ×1.8`);
          return;
        }
        for (let i = 0; i < fx.shownUnits; i += 1) setTimeout(() => spawnHelper(fx, i), i * 160);
        labels.float(new THREE.Vector3((Math.random() - 0.5) * 2.4, 1.6 + Math.random() * 0.8, -1), `+${formatNumber(fx.push)} m`, { className: 'push' });
        if (fx.push >= 90) hud.toast(`${fx.nickname} gọi ${fx.label}${fx.units > 1 ? ` ×${fx.units}` : ''} (+${formatNumber(fx.push)} m)`, { gold: fx.push >= 150, image: fx.avatar });
      } else if (fx.kind === 'wallBreak') {
        hud.banner('💥 PHÁ TƯỜNG!', `Mốc ${fx.at} m`, 1800);
      } else if (fx.kind === 'finish' || fx.kind === 'champion') {
        audio.play('fanfare');
        const champion = fx.kind === 'champion';
        hud.banner(champion ? '🏆 VÔ ĐỊCH!' : '🏁 VỀ ĐÍCH!', fx.mvp ? `Công lớn nhất: ${fx.mvp.nickname}` : `Chiến thắng ${fx.wins}`, 6000);
        for (let i = 0; i < (champion ? 8 : 4); i += 1) {
          setTimeout(() => particles.burst({ position: new THREE.Vector3((Math.random() - 0.5) * 6, 6 + Math.random() * 3, -6), count: 200,
            colors: ['#ff4fa3', '#ffd36b', '#36d6ff', '#7dff8a'], speed: 7, gravity: -4, life: 2, size: 0.32 }), i * 400);
        }
      } else if (fx.kind === 'roundStart') {
        hud.banner('VÒNG MỚI', 'Cùng đẩy về đích 1000 m', 2000);
      }
    },
    frame(dt, t) {
      clock = t;
      if (!state) return;
      shownPos += (state.position - shownPos) * Math.min(1, dt * 5);
      animateSwimWorld(world, t, shownPos * METER_TO_UNIT);
      surge = Math.max(0, surge - dt * 1.5);
      shake = Math.max(0, shake - dt);
      const celebrating = state.celebrating;
      posePerson(swimmer, celebrating ? 'dance' : 'swim', t * (state.blocked ? 1.6 : 1));
      swimmer.root.position.set(Math.sin(t * 1.3) * 0.15, celebrating ? 0 : Math.sin(t * 4) * 0.05, -surge * 0.8);
      camera.position.x = Math.sin(t * 40) * shake * 0.3;
      if (!celebrating && Math.random() < dt * (state.blocked ? 30 : 12)) {
        particles.burst({ position: new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.2, 0.4), count: 4, colors: ['#ffffff'], speed: 2.2, spread: 0, gravity: -8, life: 0.6, size: 0.16 });
      }
      for (const [at, entry] of walls) {
        entry.group.position.z = -(at - shownPos) * METER_TO_UNIT - WALL_GAP;
        entry.group.position.x = entry.exploding ? 0 : Math.sin(t * 60) * shake * 0.15;
        if (entry.exploding) {
          const k = clock - entry.exploding;
          for (const brick of entry.group.userData.bricks) {
            brick.userData.v.y -= 14 * dt;
            brick.position.addScaledVector(brick.userData.v, dt);
            brick.rotation.x += dt * 6;
            brick.material.opacity = Math.max(0, 1 - k / 1.4);
          }
          if (k > 1.5) removeWall(at);
        } else if (entry.group.position.z > 6) removeWall(at);
      }
      for (let i = helpers.length - 1; i >= 0; i -= 1) {
        const h = helpers[i];
        const age = Math.max(0, clock - h.born);
        const k = Math.min(1, age / APPROACH_S);
        const ease = 1 - (1 - k) ** 3;
        // Bơi từ ngoài làn vào sát bên người bơi, rồi cùng lao lên phía trước và lặn xuống.
        const sideX = 1.5 + h.length * 0.12;
        const forward = Math.max(0, age - APPROACH_S);
        h.group.position.x = h.side * THREE.MathUtils.lerp(7, sideX, ease);
        h.group.position.z = THREE.MathUtils.lerp(-1, 0.6, ease) - forward * forward * 6;
        h.group.position.y = Math.sin(age * 6) * 0.08 - Math.max(0, age - 1.5) * 1.8;
        h.group.rotation.y = (1 - ease) * h.side * -0.9;
        if (!h.pushed && k >= 1) onPush(h);
        if (age > LIFE_S) {
          scene.remove(h.group);
          disposeObject(h.group);
          labels.remove(h.id);
          helpers.splice(i, 1);
        }
      }
      particles.update(dt);
    },
    dispose() {
      particles.dispose();
      scene.background?.dispose?.();
      disposeObject(scene);
      hud.clearGame();
      labels.clear();
    }
  };
}
