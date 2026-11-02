// Cảnh CHÙA ONLINE: Phật tử (người xem) quỳ trong chánh điện; gõ mõ, thỉnh chuông, thắp hương,
// thả hoa đăng mang lời cầu, gieo quẻ, dâng hoa/đèn/đại lễ theo quà.
import * as THREE from '/vendor/three/three.module.js';
import { formatNumber } from '../stage-hud.js';
import { createParticleSystem } from './particle-effects.js';
import { createCrowd, ENTRANCE_SPREAD, gridSpot } from './crowd-characters.js';
import { buildPerson, disposeObject, posePerson } from './person-model.js';
import { buildTempleHall } from './temple-hall.js';

const VIP_X = [-3.75, -2.25, -0.75, 0.75, 2.25, 3.75];
const ROW_X = [-4.7, -3.4, -2.1, 2.1, 3.4, 4.7];
const ROBE = '#8796b5';
const PETALS = ['#c2416f', '#d9668f', '#c9902a', '#b85a7a'];

function slotPosition(slot) {
  if (slot < 6) return new THREE.Vector3(VIP_X[slot], 0.12, -0.4);
  const n = slot - 6;
  return new THREE.Vector3(ROW_X[n % 6], 0, 1.3 + Math.floor(n / 6) * 1.55);
}

export function createTempleScene({ hud, labels, audio, pipeline }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1080 / 1920, 0.1, 80);
  camera.position.set(0, 6.6, 15.2);
  camera.lookAt(0, 3.6, -2.5);
  const hall = buildTempleHall(scene);
  const particles = createParticleSystem(scene, 6000);
  pipeline.setBloom({ strength: 0.6, radius: 0.55, threshold: 0.78 });

  for (const x of VIP_X) {
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.24, 1.1), new THREE.MeshStandardMaterial({ color: '#c42a1a', roughness: 0.6 }));
    cushion.position.set(x, 0.12, -0.4);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.05, 1.14), new THREE.MeshStandardMaterial({ color: '#e0b04a', metalness: 0.7, roughness: 0.3 }));
    trim.position.set(x, 0.25, -0.4);
    scene.add(cushion, trim);
  }

  const bowUntil = new Map();
  const lanterns = [];
  let state = null;
  let clock = 0;
  let bellAt = -99;
  let moAt = -99;
  let bowAllUntil = 0;
  let haloBoostUntil = 0;
  let lastMoSound = 0;

  hud.setTitle('🪷 CHÙA ONLINE');
  hud.setHint(['Thả tim = ', '*gõ mõ*', ' · gõ ', '*thắp hương*', ' · ', '*cầu ...*', ' thả hoa đăng · ', '*xin xăm*', ' gieo quẻ']);

  // Phật tử vào từ cổng (phía người xem), đi dọc thảm đỏ lên chỗ quỳ, mặt hướng về bàn thờ.
  const crowd = createCrowd({
    scene,
    labels,
    build: (id) => buildPerson({ id, robe: ROBE }),
    place: (info) => slotPosition(info.slot),
    entrance: (i, count) => ENTRANCE_SPREAD(new THREE.Vector3(0, 0, 10.5), i, count),
    visitSpot: (i, count) => gridSpot(new THREE.Vector3(0, 0, count > 1 ? 0.9 : 1.6), i, count, { maxCols: 4, dx: 0.75, dz: 0.8 }),
    pose: (model, info, t, walking) => {
      posePerson(model, walking ? 'walk' : t < Math.max(bowUntil.get(info.id) || 0, bowAllUntil) ? 'bow' : 'kneel', t);
    },
    // Nhãn so le cao/thấp để hàng ngồi sát nhau không đè chữ lên nhau.
    labelFor: (info) => ({ vip: info.vip, small: true, offsetY: info.slot % 2 ? 1.15 : 0.45 }),
    facing: Math.PI,
    speed: 2.6
  });

  function bowOne(userId, seconds) {
    bowUntil.set(userId, clock + seconds);
    if (bowUntil.size > 500) bowUntil.delete(bowUntil.keys().next().value);
  }

  function petalRain(count) {
    particles.burst({ position: new THREE.Vector3(0, 11, 0), box: new THREE.Vector3(12, 1, 10), count, colors: PETALS,
      speed: 0.6, spread: 1, gravity: -0.9, life: 7, size: 0.26, damping: 0.995 });
  }

  function addIncense(n) {
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
    while (hall.sticks.children.length > 27) {
      const old = hall.sticks.children[0];
      hall.sticks.remove(old);
      disposeObject(old);
    }
  }

  function releaseLantern(fx) {
    const d = crowd.get(fx.userId);
    const lantern = hall.lotus(0.28);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffd27a', toneMapped: false }));
    glow.position.y = 0.2;
    lantern.add(glow);
    lantern.position.copy(d ? d.model.root.position : new THREE.Vector3(0, 0, 3)).setY(1.8);
    scene.add(lantern);
    lanterns.push({ lantern, born: clock, drift: (Math.random() - 0.5) * 0.6 });
    labels.float(lantern, `🪷 ${fx.nickname}: ${fx.text}`, { ms: 6500, rise: 30, className: 'prayer' });
    audio.speak(`${fx.nickname} nguyện cầu: ${fx.text}`);
  }

  return {
    scene,
    camera,
    legend: [['❤', ' Gõ mõ'], ['Follow', ' Thỉnh chuông'], ['1💎', ' Dâng hoa sen'], ['5💎', ' Đèn lưu ly'], ['100💎', ' Đại lễ']],
    update(snapshot) {
      state = snapshot.state;
      const t = state.totals;
      hud.setStats([`✨ ${formatNumber(t.merit)} công đức`, `🔥 ${formatNumber(t.incense)} nén hương · 🪵 ${formatNumber(t.mo)} mõ`]);
      hud.setBoard('TẤM LÒNG THÀNH', state.board.map((b) => ({ ...b, score: formatNumber(b.points) })));
      crowd.sync(state.devotees, new Set(snapshot.viewers?.pending || []));
    },
    welcome: { line: 'đã vào chánh điện 🙏 Gõ “thắp hương” để dâng hương', speech: (n) => `A Di Đà Phật, chào mừng ${n} đến chánh điện` },
    onFx(fx) {
      if (fx.kind === 'welcome') {
        const people = fx.mode === 'group' ? fx.people : [fx];
        for (const entry of crowd.welcome(people)) {
          labels.flash(entry.id, 'welcomed', fx.durationMs || 2600);
          bowOne(entry.id, 3); // tới chỗ thì vái chào
        }
        // cột hào quang ở cổng + cánh sen nhẹ
        particles.burst({ position: new THREE.Vector3(0, 0.5, 9.8), box: new THREE.Vector3(2.4, 0.4, 1.4), count: 90 + people.length * 20,
          colors: ['#ffd36b', '#fff1c9'], speed: 0.8, spread: 0, gravity: 2.2, life: 2.4, size: 0.24 });
        if (fx.mode === 'group') petalRain(160);
      } else if (fx.kind === 'mo') {
        moAt = clock;
        if (clock - lastMoSound > 0.15) {
          audio.play('mo');
          lastMoSound = clock;
        }
        particles.burst({ position: new THREE.Vector3(4.3, 2, -2.8), count: 8, colors: ['#ffd36b'], speed: 2, gravity: 0.5, life: 0.8, size: 0.16 });
      } else if (fx.kind === 'bell') {
        bellAt = clock;
        bowAllUntil = clock + 3.5;
        audio.play('bell');
        hud.toast(`🔔 ${fx.nickname} thỉnh chuông`);
      } else if (fx.kind === 'incense') {
        addIncense(fx.sticks);
        bowOne(fx.userId, 5);
        audio.play('chime');
        hud.toast(`🔥 ${fx.nickname} thắp ${fx.sticks} nén hương`);
      } else if (fx.kind === 'prayer') {
        bowOne(fx.userId, 4);
        releaseLantern(fx);
      } else if (fx.kind === 'offering') {
        bowOne(fx.userId, 5);
        if (fx.offering === 'ceremony') {
          audio.play('bell');
          bowAllUntil = clock + 6;
          haloBoostUntil = clock + 8;
          petalRain(450);
          hud.banner('🪷 ĐẠI LỄ DÂNG HOA 🪷', `${fx.nickname} · ${fx.giftName} ×${fx.count}`, 5000);
        } else if (fx.offering === 'lantern') {
          audio.play('chime');
          particles.burst({ position: new THREE.Vector3(0, 2.5, -5), count: 160, colors: ['#ffd36b', '#ffb347'], speed: 2.5, gravity: 1.2, life: 2.5, size: 0.28 });
          hud.toast(`🏮 ${fx.nickname} dâng đèn lưu ly (${fx.giftName} ×${fx.count})`, { gold: true });
        } else {
          audio.play('chime');
          petalRain(140);
          hud.toast(`🪷 ${fx.nickname} dâng hoa sen (${fx.giftName} ×${fx.count})`);
        }
      } else if (fx.kind === 'fortune') {
        audio.play('chime');
        bowOne(fx.userId, 4);
        hud.showFortune(fx);
        audio.speak(`Quẻ số ${fx.number}, ${fx.rank}. ${fx.title}. ${fx.poem.join('. ')}. Lời bàn: ${fx.meaning}`);
      }
    },
    frame(dt, t) {
      clock = t;
      hall.halo.material.uniforms.uTime.value = t;
      hall.halo.material.uniforms.uPower.value = t < haloBoostUntil ? 1.25 : 0.8 + Math.sin(t * 0.8) * 0.06;
      hall.orb.material.emissiveIntensity = 2 + Math.sin(t * 1.3) * 0.3;
      hall.lanterns.forEach((l, i) => { l.rotation.z = Math.sin(t * 0.7 + i) * 0.04; });
      hall.candles.forEach((c, i) => {
        const f = 1 + Math.sin(t * 17 + i * 3) * 0.08 + Math.sin(t * 7.3 + i) * 0.05;
        c.flame.scale.set(f, 1.8 * f, f);
        c.light.intensity = 6 * f;
      });
      const bellAge = t - bellAt;
      hall.bellPivot.rotation.z = bellAge < 4 ? Math.sin(bellAge * 7) * 0.35 * Math.exp(-bellAge * 0.9) : 0;
      if (bellAge < 1.2 && Math.random() < dt * 25) {
        particles.burst({ position: new THREE.Vector3(-4.4, 3, -3.2), count: 12, colors: ['#ffd36b', '#fff1c9'], speed: 4, spread: 1, gravity: 0, life: 1, size: 0.2 });
      }
      const moAge = t - moAt;
      hall.malletPivot.rotation.z = moAge < 0.18 ? Math.sin((moAge / 0.18) * Math.PI) * 0.7 : 0;
      hall.moBody.scale.set(1.15 * (1 + Math.max(0, 0.06 - moAge * 0.3)), 0.85, 1);
      if (Math.random() < dt * 3) {
        particles.burst({ position: new THREE.Vector3(0, 5, -1), box: new THREE.Vector3(12, 8, 10), count: 1, colors: ['#ffd36b'], speed: 0.2, gravity: 0.05, life: 5, size: 0.1 });
      }
      if (hall.sticks.children.length && Math.random() < dt * 10) {
        particles.burst({ position: new THREE.Vector3((Math.random() - 0.5) * 0.6, 2.5, -2.7), count: 1, colors: ['#8a8a8a', '#bdbdbd'], speed: 0.3, spread: 0, gravity: 0.6, life: 3.5, size: 0.35, damping: 0.99 });
      }
      crowd.frame(dt, t);
      for (let i = lanterns.length - 1; i >= 0; i -= 1) {
        const l = lanterns[i];
        const age = t - l.born;
        l.lantern.position.y += dt * 0.9;
        l.lantern.position.z -= dt * 0.5;
        l.lantern.position.x += Math.sin(age * 1.5) * dt * l.drift;
        if (age > 7) {
          scene.remove(l.lantern);
          disposeObject(l.lantern);
          lanterns.splice(i, 1);
        }
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
