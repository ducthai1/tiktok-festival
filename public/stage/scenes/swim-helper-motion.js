// Mỗi trợ thủ một kiểu xuất hiện đúng tính cách — quà càng lớn màn càng mạnh:
// vịt phao nhấp nhô · ván lướt nảy trên sóng · thuyền rẽ sóng để lại vệt bọt · cá heo nhảy vòng cung ·
// cá mập chỉ lộ vây rồi lao lên · cá voi lặn sâu rồi phóng vọt khỏi mặt nước · tàu ngầm trồi lên kèm bọt khí.
import * as THREE from '/vendor/three/three.module.js';

const at = new THREE.Vector3();

export const HELPER_LIFE = { whale: 3.4, submarine: 3.2, shark: 2.6, dolphin: 2.6 };

// Cảm giác lúc đẩy: tiếng, độ lớn bọt nước, độ rung camera.
export const PUSH_FEEL = {
  duck: { sound: 'pop', splash: 20, shake: 0 },
  surfer: { sound: 'whoosh', splash: 60, shake: 0.05 },
  boat: { sound: 'whoosh', splash: 90, shake: 0.08 },
  dolphin: { sound: 'splash', splash: 120, shake: 0.1, chirp: true },
  shark: { sound: 'splash', splash: 160, shake: 0.2 },
  whale: { sound: 'boom', splash: 420, shake: 0.6 },
  submarine: { sound: 'horn', splash: 260, shake: 0.35 }
};

/** Đặt vị trí/góc trợ thủ theo tuổi (giây). ease: 0→1 lúc bơi vào sát người bơi; forward: giây kể từ lúc đẩy. */
export function moveHelper(h, age, ease, forward, particles) {
  const g = h.group;
  const kind = g.userData.kind;
  const sink = Math.max(0, age - (HELPER_LIFE[kind] || 2.2) + 0.7) * 1.8;
  g.rotation.set(0, (1 - ease) * h.side * -0.9, 0);
  if (kind === 'surfer') {
    g.position.y = Math.abs(Math.sin(age * 5)) * 0.25 - sink;
    g.rotation.z = Math.sin(age * 3) * 0.15;
  } else if (kind === 'dolphin') {
    const hop = Math.sin(age * 5.2);
    g.position.y = Math.max(-0.2, hop) * 1.3 - sink;
    g.rotation.x = -Math.cos(age * 5.2) * 0.6;
  } else if (kind === 'shark') {
    g.position.y = forward > 0 ? Math.min(0.15, -0.45 + forward * 2) : -0.45; // chỉ lộ vây, rồi lao lên
  } else if (kind === 'whale') {
    if (forward <= 0) g.position.y = -1.7 + Math.sin(age * 2) * 0.1;
    else {
      const leap = Math.min(1, forward / 1.2);
      g.position.y = Math.sin(Math.PI * leap) * 3.4 - 1.7 * (1 - Math.sin(Math.PI * leap)) - sink;
      g.rotation.x = (0.5 - leap) * 1.2;
    }
  } else if (kind === 'submarine') {
    g.position.y = Math.min(0.1, -2.4 + age * 3) - sink;
    if (Math.random() < 0.6) {
      g.getWorldPosition(at);
      particles.burst({ position: at.setY(Math.max(0, at.y)), count: 3, colors: ['#e6fbff', '#bff3ff'], speed: 1.2, spread: 0, gravity: 2, life: 0.9, size: 0.14 });
    }
  } else {
    g.position.y = Math.sin(age * 6) * 0.08 - sink;
  }
  if ((kind === 'boat' || kind === 'surfer') && Math.random() < 0.7) {
    g.getWorldPosition(at);
    particles.burst({ position: at.setY(0.15), count: 2, colors: ['#ffffff', '#d9f6ff'], speed: 1, spread: 0, gravity: -4, life: 0.7, size: 0.15 });
  }
}
