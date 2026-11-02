// Điều ước lớn (quà lớn): băng rôn lời cầu của người tặng (hết ế, tiền vào như nước…), cả chánh điện
// lạy 3 lạy theo 3 hồi chuông, mưa cánh hoa vàng, hào quang rực.
// Vạn sự như ý (quà lớn nhất): thêm sen vàng nở giữa lối thảm đỏ, đèn hoa đăng bay khắp chánh điện
// và camera chầm chậm tiến vào.
import * as THREE from '/vendor/three/three.module.js';
import { disposeObject } from './person-model.js';
import { glowSprite } from './temple-painted-hall.js';
import { lotus } from './temple-props.js';
import { floorPoint } from './temple-view.js';
import { bigWish } from './temple-wishes.js';

const GOLD_PETALS = ['#ffd36b', '#ffe9a8', '#ff9ec4', '#fff1c9'];

export function createGrandCeremony({ scene, hall, particles, soft, audio, hud, helpers }) {
  let clock = 0;
  const timeline = [];
  const lanterns = [];
  let bigLotus = null;
  let push = { start: -99, until: -99 };
  const later = (seconds, fn) => timeline.push({ at: clock + seconds, fn });

  function petalRain(count) {
    soft.burst({ position: new THREE.Vector3(0, 3.6, -7.2), box: new THREE.Vector3(5.2, 1.8, 7), count, colors: GOLD_PETALS,
      speed: 0.25, spread: 1, gravity: -0.25, life: 9, size: 0.065, damping: 0.985 });
  }

  function threeBows() {
    helpers.bowAll('prostrate', 6.6);
    [0, 2.2, 4.4].forEach((s, i) => later(s, () => {
      if (i === 2) audio.play('gong'); // tiếng chuông phát lúc chuông bị đánh (temple-scene)
      helpers.swingBell();
      particles.burst({ position: hall.haloCenter, count: 40, colors: ['#ffd36b', '#fff1c9'], speed: 1.8, spread: 1, gravity: 0, life: 1.5, size: 0.075 });
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
    /** level: 'ceremony' (Siêu xe…) | 'grand' (Tên lửa, Sư tử, Vũ trụ — món lớn nhất) */
    start(level, fx) {
      const grand = level === 'grand';
      const legend = grand;
      threeBows();
      if (legend) later(6.6, threeBows); // món quà lớn nhất: lạy thêm một tuần chuông nữa
      helpers.boostHalo(legend ? 15 : grand ? 10 : 7);
      petalRain(legend ? 300 : grand ? 260 : 170);
      const wish = bigWish(level);
      hud.banner(`${wish.icon} ${wish.title} ${wish.icon}`, `${fx.nickname} · ${fx.giftName} ×${fx.count}`, legend ? 10000 : grand ? 7000 : 5000);
      // người tặng đã gõ lời cầu riêng thì đọc đúng lời của họ, kèm hoa đăng mang lời đó
      audio.speak(fx.wish ? `${fx.nickname} ${fx.wish}` : `${fx.nickname} cầu ${wish.spoken}`);
      if (fx.wish) helpers.releaseLantern({ nickname: fx.nickname, text: fx.wish, silent: true }, new THREE.Vector3(0, 1.4, -9.5));
      if (grand) {
        audio.play('gong');
        bloomGiantLotus();
        later(1.5, () => releaseSkyLanterns(legend ? 28 : 18));
        later(5, () => petalRain(170));
        if (legend) later(9, () => petalRain(200));
        push = { start: clock, until: clock + (legend ? 16 : 12) };
      }
    },
    // Camera tiến vào rồi lùi ra êm khi có quà lớn nhất (0 = vị trí thường).
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
