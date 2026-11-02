// Đại lễ (quà lớn): cả chánh điện lạy 3 lạy theo 3 hồi chuông, mưa cánh sen vàng, hào quang rực.
// Đại lễ Kim Liên (quà lớn nhất): thêm đài sen vàng khổng lồ nở sau bàn thờ, đèn hoa đăng bay khắp
// chánh điện và camera chầm chậm tiến vào.
import * as THREE from '/vendor/three/three.module.js';
import { disposeObject } from './person-model.js';
import { glowSprite } from './temple-painted-hall.js';
import { lotus } from './temple-props.js';
import { floorPoint } from './temple-view.js';

const GOLD_PETALS = ['#ffd36b', '#ffe9a8', '#ff9ec4', '#fff1c9'];

export function createGrandCeremony({ scene, hall, particles, audio, hud, helpers }) {
  let clock = 0;
  const timeline = [];
  const lanterns = [];
  let bigLotus = null;
  let push = { start: -99, until: -99 };
  const later = (seconds, fn) => timeline.push({ at: clock + seconds, fn });

  function petalRain(count) {
    particles.burst({ position: new THREE.Vector3(0, 3.6, -7.2), box: new THREE.Vector3(5.2, 1.8, 7), count, colors: GOLD_PETALS,
      speed: 0.25, spread: 1, gravity: -0.25, life: 9, size: 0.08, damping: 0.985 });
  }

  function threeBows() {
    helpers.bowAll('prostrate', 6.6);
    [0, 2.2, 4.4].forEach((s, i) => later(s, () => {
      audio.play(i === 2 ? 'gong' : 'bell');
      helpers.swingBell();
      particles.burst({ position: hall.haloCenter, count: 120, colors: ['#ffd36b', '#fff1c9'], speed: 2.4, spread: 1, gravity: 0, life: 1.6, size: 0.1 });
    }));
  }

  function bloomGiantLotus() {
    if (bigLotus) {
      scene.remove(bigLotus);
      disposeObject(bigLotus);
    }
    // sen vàng nở giữa lối thảm đỏ trước bàn thờ, toả quầng sáng dưới chân
    const flower = lotus(0.5);
    flower.traverse((node) => {
      if (node.isMesh) node.material = new THREE.MeshStandardMaterial({ color: '#ffd36b', emissive: '#c07a10', emissiveIntensity: 0.55, metalness: 0.55, roughness: 0.32, transparent: true });
    });
    bigLotus = new THREE.Group();
    const glow = glowSprite(2.2, 0.7);
    glow.position.y = 0.35;
    bigLotus.add(flower, glow);
    bigLotus.position.copy(floorPoint(0.5, 0.705));
    bigLotus.scale.setScalar(0.01);
    bigLotus.userData.born = clock;
    scene.add(bigLotus);
  }

  function releaseSkyLanterns(count) {
    for (let i = 0; i < count; i += 1) {
      const lantern = lotus(0.15);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd27a' }));
      glow.position.y = 0.11;
      lantern.add(glow);
      lantern.position.set((Math.random() - 0.5) * 4.4, 0.2, -4.5 - Math.random() * 6);
      scene.add(lantern);
      lanterns.push({ lantern, born: clock + i * 0.12, drift: (Math.random() - 0.5) * 0.8 });
    }
  }

  return {
    /** level: 'ceremony' | 'grand' */
    start(level, fx) {
      const grand = level === 'grand';
      threeBows();
      helpers.boostHalo(grand ? 14 : 8);
      petalRain(grand ? 700 : 420);
      hud.banner(grand ? '🪷 ĐẠI LỄ KIM LIÊN 🪷' : '🙏 ĐẠI LỄ CẦU AN 🙏', `${fx.nickname} · ${fx.giftName} ×${fx.count}`, grand ? 7000 : 5000);
      if (grand) {
        audio.play('gong');
        bloomGiantLotus();
        later(1.5, () => releaseSkyLanterns(36));
        later(5, () => petalRain(500));
        push = { start: clock, until: clock + 12 };
      }
    },
    // Camera tiến vào rồi lùi ra êm trong đại lễ Kim Liên (0 = vị trí thường).
    cameraPush() {
      if (clock > push.until) return 0;
      const u = (clock - push.start) / (push.until - push.start);
      return Math.sin(Math.PI * Math.min(1, Math.max(0, u))) * 3.2;
    },
    frame(t, dt) {
      clock = t;
      for (let i = timeline.length - 1; i >= 0; i -= 1) {
        if (t >= timeline[i].at) timeline.splice(i, 1)[0].fn();
      }
      if (bigLotus) {
        const age = t - bigLotus.userData.born;
        const grow = Math.min(1, age / 3);
        bigLotus.scale.setScalar(Math.max(0.01, grow * grow * (3 - 2 * grow)));
        bigLotus.rotation.y += dt * 0.25;
        const fade = age > 22 ? Math.max(0, 1 - (age - 22) / 3) : 1;
        bigLotus.traverse((node) => { if (node.material) node.material.opacity = fade * (node.isSprite ? 0.7 : 1); });
        if (age > 25) {
          scene.remove(bigLotus);
          disposeObject(bigLotus);
          bigLotus = null;
        }
      }
      for (let i = lanterns.length - 1; i >= 0; i -= 1) {
        const l = lanterns[i];
        const age = t - l.born;
        if (age < 0) continue;
        l.lantern.position.y += dt * 0.42;
        l.lantern.position.x += Math.sin(age * 1.3) * dt * l.drift;
        if (age > 13) {
          scene.remove(l.lantern);
          disposeObject(l.lantern);
          lanterns.splice(i, 1);
        }
      }
    }
  };
}
