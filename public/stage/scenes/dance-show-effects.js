// Hiệu ứng sân khấu của sàn nhảy: đèn rọi người solo, pháo sáng lạnh (cold fountain) mép sân khấu,
// pháo hoa, mưa giấy khi DROP, tim bay khi thả tim, lấp lánh khi vào sàn / đổi đồ.
import * as THREE from '/vendor/three/three.module.js';
import { STAGE_FRONT_Z, STAGE_TOP_Y } from '/static/shared/dance-floor-layout.js';
import { createParticleSystem } from './particle-effects.js';

const PARTY = ['#ff4fa3', '#ffd21f', '#36d6ff', '#7dff8a', '#ffffff', '#b07cff'];
const FOUNTAIN_X = [-5.4, -2.6, 2.6, 5.4];

export function createShowEffects(scene) {
  const particles = createParticleSystem(scene, 7000);
  const spot = new THREE.SpotLight('#fff3d6', 0, 18, 0.24, 0.5, 1.1);
  spot.position.set(0, 9, 0);
  scene.add(spot, spot.target);
  // vũng sáng dưới chân người solo (không dùng chùm nón: camera lọt vào nón là trắng xoá cả màn)
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.5, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#fff1c9', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(pool);
  let fountainUntil = 0;
  let confettiUntil = 0;
  let spotOn = false;
  const at = new THREE.Vector3();

  return {
    particles,
    /** Rọi đèn theo một điểm (người solo), null để tắt. */
    spotlight(position) {
      spotOn = Boolean(position);
      if (position) at.copy(position);
    },
    fountains(now, seconds = 6) {
      fountainUntil = Math.max(fountainUntil, now + seconds);
    },
    confetti(now, seconds = 6) {
      confettiUntil = Math.max(confettiUntil, now + seconds);
    },
    fireworks(power) {
      for (let i = 0; i < 2 + power * 2; i += 1) {
        setTimeout(() => particles.burst({ position: new THREE.Vector3((Math.random() - 0.5) * 9, 8 + Math.random() * 3, -4 + Math.random() * 4),
          count: 220, colors: PARTY, speed: 7, gravity: -3, life: 2.1, size: 0.32 }), i * 320);
      }
    },
    hearts(position, count) {
      particles.burst({ position, count: 6 + count * 2, colors: ['#ff4f7b', '#ff8fb1', '#ffffff'], speed: 2.2, spread: 0.25, gravity: 1.2, life: 1.5, size: 0.26 });
    },
    sparkle(position, big = false) {
      particles.burst({ position, count: big ? 140 : 50, colors: PARTY, speed: big ? 5 : 3, gravity: -2, life: 1.2, size: big ? 0.28 : 0.2 });
    },
    update(dt, now) {
      const target = spotOn ? 70 : 0;
      spot.intensity += (target - spot.intensity) * Math.min(1, dt * 4);
      if (spotOn) {
        spot.target.position.lerp(at, Math.min(1, dt * 6));
        spot.position.set(spot.target.position.x, 9, spot.target.position.z + 2.5);
        pool.position.set(spot.target.position.x, spot.target.position.y + 0.02, spot.target.position.z);
      }
      pool.material.opacity += ((spotOn ? 0.32 : 0) - pool.material.opacity) * Math.min(1, dt * 4);
      if (now < fountainUntil) {
        for (const x of FOUNTAIN_X) {
          particles.burst({ position: new THREE.Vector3(x, STAGE_TOP_Y + 0.05, STAGE_FRONT_Z + 0.2), count: 5, colors: ['#ffffff', '#fff3c4', '#ffd36b'],
            speed: 7.5, spread: 0.06, gravity: -7, life: 1.1, size: 0.14, damping: 0.99 });
        }
      }
      if (now < confettiUntil && Math.random() < 0.9) {
        particles.burst({ position: new THREE.Vector3(0, 9, -1), box: new THREE.Vector3(11, 0.5, 9), count: 6, colors: PARTY,
          speed: 0.6, gravity: -1.6, life: 4.5, size: 0.22, damping: 0.995 });
      }
      particles.update(dt);
    },
    dispose() {
      particles.dispose();
    }
  };
}
