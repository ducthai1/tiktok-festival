// Cảnh QUÁN BAR: khách (người xem) ngồi quầy / nhảy trên sàn, cầm đồ uống theo quà.
import * as THREE from '/vendor/three/three.module.js';
import { createMeter, formatNumber } from '../stage-hud.js';
import { animateBarRoom, buildBarRoom, FLOOR_POSITIONS, STOOL_POSITIONS } from './bar-room.js';
import { createParticleSystem } from './particle-effects.js';
import { buildPerson, disposeObject, posePerson } from './person-model.js';

const DRINK_NAMES = { beer: 'Bia', cocktail: 'Cocktail', champagne: 'Champagne', tower: 'Tháp champagne', party: 'MỞ TIỆC' };

function drinkMesh(kind) {
  const group = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, roughness: 0.05 });
  if (kind === 'beer') {
    group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.28, 12), new THREE.MeshStandardMaterial({ color: '#f2a516', emissive: '#7a4a00', emissiveIntensity: 0.4 })));
    const foam = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.06, 12), new THREE.MeshStandardMaterial({ color: '#fffaf0' }));
    foam.position.y = 0.16;
    group.add(foam);
  } else {
    const color = kind === 'cocktail' ? '#ff4fa3' : '#ffd36b';
    const cup = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.22, 16, 1, true), glass);
    cup.rotation.x = Math.PI;
    cup.position.y = 0.2;
    const liquid = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.16, 16), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2 }));
    liquid.rotation.x = Math.PI;
    liquid.position.y = 0.22;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.2, 6), glass);
    group.add(cup, liquid, stem);
  }
  group.rotation.x = Math.PI; // tay đang buông xuống: lật ly cho thẳng khi giơ lên
  return group;
}

export function createBarScene({ hud, labels, audio, pipeline }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1080 / 1920, 0.1, 80);
  camera.position.set(0, 5.4, 12.6);
  camera.lookAt(0, 2.5, -0.4);
  const room = buildBarRoom(scene);
  const particles = createParticleSystem(scene, 5000);
  const patrons = new Map();
  let state = null;
  let party = false;
  let tower = null;
  pipeline.setBloom({ strength: 0.6, radius: 0.5, threshold: 0.78 });

  hud.setTitle('🍸 QUÁN BAR LIVE');
  hud.setHint(['Bình luận để ', '*vào quán*', ' · gõ ', '*nhảy*', ' để quẩy · ', '*cụng ly*', ' để nâng ly']);
  const meter = createMeter(hud, { label: '🔥 ĐỘ QUẨY' });

  function seatPosition(seat) {
    return seat < 6 ? STOOL_POSITIONS[seat] : FLOOR_POSITIONS[seat - 6];
  }

  function syncPatrons(list) {
    const ids = new Set(list.map((p) => p.id));
    for (const [id, p] of patrons) {
      if (!ids.has(id) && !p.leaving) p.leaving = performance.now();
    }
    for (const info of list) {
      let p = patrons.get(info.id);
      if (!p) {
        p = { model: buildPerson({ id: info.id }), drinkKind: '', target: seatPosition(info.seat) };
        p.model.root.position.copy(p.target);
        p.model.root.scale.setScalar(0.01);
        scene.add(p.model.root);
        patrons.set(info.id, p);
        particles.burst({ position: seatPosition(info.seat).clone().setY(1.5), count: 40, colors: ['#ff4fa3', '#ffd36b', '#36d6ff'], speed: 3, gravity: -3, life: 1 });
      }
      p.info = info;
      p.target = seatPosition(info.seat);
      if (p.drinkKind !== info.drink) {
        p.model.hand.clear();
        if (info.drink) p.model.hand.add(drinkMesh(info.drink));
        p.drinkKind = info.drink;
      }
      labels.sync(info.id, { anchor: p.model.head, nickname: info.nickname, avatar: info.avatar, vip: info.vip, small: info.seat >= 6, offsetY: 0.55 });
    }
  }

  function showTower() {
    if (tower) scene.remove(tower);
    tower = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: '#ffd36b', emissive: '#ffb300', emissiveIntensity: 1.4, transparent: true, opacity: 0.85 });
    for (let level = 0; level < 4; level += 1) {
      const n = 4 - level;
      for (let i = 0; i < n; i += 1) {
        const g = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.24, 14, 1, true), gold);
        g.rotation.x = Math.PI;
        g.position.set((i - (n - 1) / 2) * 0.34, 1.35 + level * 0.3, -3.3);
        tower.add(g);
      }
    }
    scene.add(tower);
    tower.userData.until = performance.now() + 20000;
  }

  return {
    scene,
    camera,
    update(snapshot) {
      state = snapshot.state;
      party = state.partyMs > 0;
      meter.root.classList.toggle('party', party);
      meter.update(party ? 1 : state.vibe / state.vibeGoal, party ? `TIỆC! ${Math.ceil(state.partyMs / 1000)}s` : `${formatNumber(state.vibe)} / ${formatNumber(state.vibeGoal)}`);
      hud.setStats([`👥 ${state.patrons.length} khách`, `💎 ${formatNumber(snapshot.totals.diamonds)}`]);
      hud.setBoard('TOP DÂN CHƠI', snapshot.top.map((r) => ({ ...r, score: r.diamonds ? `${formatNumber(r.diamonds)}💎` : `${formatNumber(r.likes)}❤` })));
      syncPatrons(state.patrons);
    },
    legend: [['1💎', ' Bia'], ['5💎', ' Cocktail'], ['30💎', ' Champagne'], ['100💎', ' Tháp ly'], ['500💎', ' Mở tiệc']],
    onFx(fx) {
      const p = patrons.get(fx.userId);
      if (fx.kind === 'bubble') labels.bubble(fx.userId, fx.text);
      else if (fx.kind === 'join') audio.play('pop');
      else if (fx.kind === 'toast') hud.toast(fx.text);
      else if (fx.kind === 'drink') {
        audio.play('clink');
        hud.toast(`${fx.nickname} gọi ${DRINK_NAMES[fx.drink]} (${fx.giftName} ×${fx.count})`, { gold: fx.diamonds >= 30 });
        if (p) particles.burst({ position: p.model.root.position.clone().setY(2.6), count: 30 + Math.min(120, fx.diamonds), colors: ['#ffd36b', '#ffffff'], speed: 4, gravity: -4 });
        if (fx.drink === 'tower' || fx.drink === 'party') showTower();
      } else if (fx.kind === 'party') {
        audio.play('fanfare');
        hud.banner('🎉 MỞ TIỆC! 🎉', 'Cả quán cùng quẩy');
      } else if (fx.kind === 'fireworks') {
        audio.play('boom');
        for (let i = 0; i < 2 + fx.power * 2; i += 1) {
          setTimeout(() => particles.burst({ position: new THREE.Vector3((Math.random() - 0.5) * 8, 7 + Math.random() * 2, 0), count: 220,
            colors: ['#ff4fa3', '#ffd36b', '#36d6ff', '#7dff8a', '#ffffff'], speed: 7, gravity: -3.5, life: 2, size: 0.3 }), i * 350);
        }
      }
    },
    frame(dt, t) {
      animateBarRoom(room, t, party);
      if (party && Math.random() < dt * 6) {
        particles.burst({ position: new THREE.Vector3(3.4, 7.2, 0.5), count: 6, colors: ['#ffffff', '#cfe0ff'], speed: 8, spread: 1, gravity: -1, life: 1.2, size: 0.18 });
      }
      const now = performance.now();
      for (const [id, p] of patrons) {
        const { root } = p.model;
        if (p.leaving) {
          root.scale.multiplyScalar(0.86);
          if (now - p.leaving > 600) {
            scene.remove(root);
            disposeObject(root);
            patrons.delete(id);
            labels.remove(id);
          }
          continue;
        }
        root.position.lerp(p.target, Math.min(1, dt * 4));
        root.scale.setScalar(Math.min(1, root.scale.x + dt * 3));
        const pose = p.info.dancing ? 'dance' : p.info.cheers ? 'cheers' : 'idle';
        posePerson(p.model, pose, t, p.info.seat < 6);
      }
      if (tower && now > tower.userData.until) {
        scene.remove(tower);
        disposeObject(tower);
        tower = null;
      }
      if (tower) particles.burst({ position: new THREE.Vector3(0, 2.6, -3.3), count: 1, colors: ['#ffe08a'], speed: 1.5, gravity: 0.5, life: 1.2, size: 0.12 });
      particles.update(dt);
    },
    dispose() {
      particles.dispose();
      disposeObject(scene);
      hud.clearGame();
      labels.clear();
    }
  };
}
