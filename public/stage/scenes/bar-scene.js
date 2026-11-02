// Cảnh QUÁN BAR: khách (người xem) ngồi quầy / nhảy trên sàn, cầm đồ uống theo quà.
import * as THREE from '/vendor/three/three.module.js';
import { createMeter, formatNumber } from '../stage-hud.js';
import { animateBarRoom, buildBarRoom, FLOOR_POSITIONS, STOOL_POSITIONS } from './bar-room.js';
import { createParticleSystem } from './particle-effects.js';
import { createBarServing, drinkMesh } from './bar-serving.js';
import { createCrowd, gridSpot, sideDoorSpot } from './crowd-characters.js';
import { animatePerson, buildPerson, disposeObject } from './person-model.js';

const DRINK_NAMES = { beer: 'Bia', cocktail: 'Cocktail', champagne: 'Champagne', tower: 'Tháp champagne', party: 'MỞ TIỆC' };
const DRINK_ICONS = { beer: '🍺', cocktail: '🍸', champagne: '🥂', tower: '🍾', party: '🎉' };

export function createBarScene({ hud, labels, audio, pipeline }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1080 / 1920, 0.1, 80);
  camera.position.set(0, 5.4, 12.6);
  camera.lookAt(0, 2.5, -0.4);
  const room = buildBarRoom(scene);
  const particles = createParticleSystem(scene, 5000);
  const welcomeSpot = new THREE.SpotLight('#ffd36b', 0, 16, 0.32, 0.45, 1.2);
  scene.add(welcomeSpot, welcomeSpot.target);
  let spotFollow = null;
  let spotUntil = 0;
  let clock = 0;
  let state = null;
  let party = false;
  pipeline.setBloom({ strength: 0.6, radius: 0.5, threshold: 0.78 });

  hud.setTitle('🍸 QUÁN BAR LIVE');
  hud.setHint(['Bình luận để ', '*vào quán*', ' · gõ ', '*nhảy*', ' để quẩy · ', '*cụng ly*', ' để nâng ly']);
  const meter = createMeter(hud, { label: '🔥 ĐỘ QUẨY' });

  // Khách vào từ cửa hông rồi đi tới ghế/ô sàn của mình.
  const crowd = createCrowd({
    scene,
    labels,
    build: (id) => buildPerson({ id }),
    place: (info) => (info.seat < 6 ? STOOL_POSITIONS[info.seat] : FLOOR_POSITIONS[info.seat - 6]),
    // vào từ cửa hông hai bên quán (1 người thì cửa trái)
    entrance: (i) => sideDoorSpot(i, { x: 5.4, z: -1.0 }),
    // khách ghé đứng giữa sàn nhảy, 8 người một hàng (đoàn tới 40 người vẫn nằm trong khung hình)
    visitSpot: (i, count) => gridSpot(new THREE.Vector3(0, 0, count > 1 ? 0.6 : 3.2), i, count, { maxCols: 8, dx: 0.72, dz: 0.75 }),
    pose: (model, info, t, walking, dt) => {
      const seated = !walking && info.seat !== undefined && info.seat < 6;
      const visiting = info.seat === undefined;
      animatePerson(model, walking ? 'walk' : info.dancing ? 'dance' : info.cheers || visiting ? 'cheers' : 'idle', t, dt, seated);
    },
    labelFor: (info) => ({ vip: info.vip, small: info.seat >= 6, offsetY: 0.55 }),
    speed: 3.2
  });

  const serving = createBarServing({ scene, room, crowd, particles, audio, focus: (entry, seconds) => {
    spotFollow = entry;
    spotUntil = clock + seconds;
  } });

  function syncDrinks(list) {
    for (const info of list) {
      const entry = crowd.get(info.id);
      if (!entry || entry.drinkKind === info.drink || serving.isDelivering(info.id)) continue; // ly đang bay tới thì chờ
      entry.model.hand.clear();
      if (info.drink) entry.model.hand.add(drinkMesh(info.drink));
      entry.drinkKind = info.drink;
    }
  }

  return {
    scene,
    camera,
    welcome: { line: 'đã tới quán! Gõ “nhảy” để quẩy cùng mọi người 🍸', speech: (n) => `Chào mừng ${n} đến quán bar!` },
    update(snapshot) {
      state = snapshot.state;
      party = state.partyMs > 0;
      meter.root.classList.toggle('party', party);
      meter.update(party ? 1 : state.vibe / state.vibeGoal, party ? `TIỆC! ${Math.ceil(state.partyMs / 1000)}s` : `${formatNumber(state.vibe)} / ${formatNumber(state.vibeGoal)}`);
      hud.setStats([`👥 ${state.patrons.length} khách`, `💎 ${formatNumber(snapshot.totals.diamonds)}`]);
      hud.setBoard('TOP DÂN CHƠI', snapshot.top.map((r) => ({ ...r, score: r.diamonds ? `${formatNumber(r.diamonds)}💎` : `${formatNumber(r.likes)}❤` })));
      crowd.sync(state.patrons, new Set(snapshot.viewers?.pending || []));
      syncDrinks(state.patrons);
    },
    legend: [['1💎', ' Bia'], ['5💎', ' Cocktail'], ['30💎', ' Champagne'], ['100💎', ' Tháp ly'], ['500💎', ' Mở tiệc']],
    probe: (id) => crowd.probe(id),
    onFx(fx) {
      if (fx.kind === 'welcome') {
        const people = fx.mode === 'group' ? fx.people : [fx];
        const entries = crowd.welcome(people);
        for (const entry of entries) labels.flash(entry.id, 'welcomed', fx.durationMs || 2600);
        spotFollow = entries.length === 1 ? entries[0] : null;
        spotUntil = clock + (fx.durationMs || 2600) / 1000 + 1;
        particles.burst({ position: new THREE.Vector3(0, 3.5, 7), box: new THREE.Vector3(5, 1, 2), count: 60 + entries.length * 25,
          colors: ['#ffd36b', '#ff4fa3', '#36d6ff', '#ffffff'], speed: 3, gravity: -3, life: 1.6, size: 0.22 });
      } else if (fx.kind === 'bubble') labels.bubble(fx.userId, fx.text);
      else if (fx.kind === 'toast') hud.toast(fx.text);
      else if (fx.kind === 'drink') {
        hud.toast(`${DRINK_ICONS[fx.drink]} ${fx.nickname} gọi ${DRINK_NAMES[fx.drink]} (${fx.giftName} ×${fx.count})`, { gold: fx.diamonds >= 30 });
        serving.serve(fx);
        if (fx.drink === 'tower') hud.banner('🍾 THÁP CHAMPAGNE 🍾', `${fx.nickname} mời cả quán`, 3500);
      } else if (fx.kind === 'party') {
        audio.play('fanfare');
        hud.banner('🎉 MỞ TIỆC! 🎉', 'Cả quán cùng quẩy');
        [-1, 1].forEach((side) => particles.burst({ position: new THREE.Vector3(side * 5.5, 0.5, 4), count: 500,
          colors: ['#ff4fa3', '#ffd36b', '#36d6ff', '#7dff8a', '#ffffff'], speed: 12, spread: 0.15, gravity: -6, life: 3, size: 0.2 }));
      } else if (fx.kind === 'fireworks') {
        audio.play('boom');
        for (let i = 0; i < 2 + fx.power * 2; i += 1) {
          setTimeout(() => particles.burst({ position: new THREE.Vector3((Math.random() - 0.5) * 8, 7 + Math.random() * 2, 0), count: 220,
            colors: ['#ff4fa3', '#ffd36b', '#36d6ff', '#7dff8a', '#ffffff'], speed: 7, gravity: -3.5, life: 2, size: 0.3 }), i * 350);
        }
      }
    },
    frame(dt, t) {
      clock = t;
      animateBarRoom(room, t, party);
      if (party && Math.random() < dt * 6) {
        particles.burst({ position: new THREE.Vector3(3.4, 7.2, 0.5), count: 6, colors: ['#ffffff', '#cfe0ff'], speed: 8, spread: 1, gravity: -1, life: 1.2, size: 0.18 });
      }
      crowd.frame(dt, t);
      // Đèn vàng rọi theo người đang được chào; chào cả đoàn thì rọi rộng vào cửa.
      const spotOn = t < spotUntil;
      welcomeSpot.intensity += ((spotOn ? (spotFollow ? 45 : 30) : 0) - welcomeSpot.intensity) * Math.min(1, dt * 5);
      if (spotOn) {
        const at = spotFollow ? spotFollow.model.root.position : new THREE.Vector3(0, 0, 5.6);
        welcomeSpot.target.position.lerp(at, Math.min(1, dt * 8));
        welcomeSpot.position.set(welcomeSpot.target.position.x, 9, welcomeSpot.target.position.z + 2);
        welcomeSpot.angle = spotFollow ? 0.22 : 0.42;
      }
      serving.frame(t, dt, party);
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
