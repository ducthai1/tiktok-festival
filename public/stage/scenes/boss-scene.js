// Cảnh ĐẠI CHIẾN BOSS HẮC ÁM (WORLD BOSS RAID) — Three.js 3D.
// Mô hình Boss khổng lồ ở trung tâm, đao phát sáng, lõi ngực rực lửa, hiệu ứng bạo kích rung màn hình.
import * as THREE from '/vendor/three/three.module.js';
import { createMeter, formatNumber } from '../stage-hud.js';
import { createParticleSystem } from './particle-effects.js';
import { buildBossTitan } from './boss-model.js';

export function createBossScene({ hud, labels, audio, pipeline }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#08060e');

  const camera = new THREE.PerspectiveCamera(54, 1080 / 1920, 0.1, 100);
  camera.position.set(0, 4.2, 11.8);
  camera.lookAt(0, 3.2, 0);

  // Ánh sáng điện ảnh (Cinematic Lighting)
  const ambient = new THREE.AmbientLight('#242038', 1.6);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight('#ffffff', 2.4);
  dirLight.position.set(5, 12, 7);
  scene.add(dirLight);

  const rimLight = new THREE.DirectionalLight('#4488ff', 3.6);
  rimLight.position.set(-6, 7, -6);
  scene.add(rimLight);

  // Đèn dung nham từ tâm
  const lavaLight = new THREE.PointLight('#ff4400', 1.8, 14);
  lavaLight.position.set(0, 3.2, 1.2);
  scene.add(lavaLight);

  // Đấu trường đá cổ đại (Arena Floor)
  const floorGeo = new THREE.CylinderGeometry(6.5, 7.2, 0.5, 32);
  const floorMat = new THREE.MeshStandardMaterial({
    color: '#121018',
    roughness: 0.9,
    metalness: 0.2
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.y = -0.25;
  floor.receiveShadow = true;
  scene.add(floor);

  // Vòng tròn ma pháp phát sáng (Rune Circle)
  const runeGeo = new THREE.RingGeometry(4.2, 4.4, 32);
  const runeMat = new THREE.MeshBasicMaterial({
    color: '#ff4400',
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.6
  });
  const rune = new THREE.Mesh(runeGeo, runeMat);
  rune.rotation.x = -Math.PI / 2;
  rune.position.y = 0.02;
  scene.add(rune);

  // Hệ hạt tia lửa & dung nham bay lên
  const particles = createParticleSystem(scene, 4000);
  pipeline.setBloom({ strength: 0.42, radius: 0.4, threshold: 0.82 });

  // Mô hình Boss Titan
  const boss = buildBossTitan();
  scene.add(boss.root);

  // HUD & Thanh Máu / Nộ
  hud.setTitle('⚔️ ĐẠI CHIẾN BOSS HẮC ÁM');
  hud.setHint(['Thả tim = ', '*nạp Nộ x2*', ' · bình luận ', '*chém / bắn*', ' · quà tặng = ', '*sấm sét / rồng thần*']);

  const hpMeter = createMeter(hud, { label: '🔥 MÁU BOSS', className: 'meter-boss-hp' });
  const rageMeter = createMeter(hud, { label: '⚡ NỘ LỰC CUỒNG NỘ', className: 'meter-boss-rage' });

  let state = null;
  let clock = 0;
  let shakeTime = 0;
  let shakeIntensity = 0;
  const originalCamPos = camera.position.clone();

  function triggerScreenShake(intensity = 0.15, duration = 0.3) {
    shakeIntensity = intensity;
    shakeTime = duration;
  }

  return {
    scene,
    camera,
    toneMapping: THREE.ACESFilmicToneMapping,
    legend: [
      ['👍', ' Thả tim · Nạp Nộ cuồng nộ x2'],
      ['💬', ' Bình luận "chém", "bắn" · Tấn công -15 HP'],
      ['⚡', ' Follow / Share · Sét đánh -60 HP']
    ],
    giftLabels: {
      1: 'Phi tiêu lửa (-50 đến -150 HP)',
      2: 'Búa sét (-300 đến -800 HP)',
      3: 'Mưa thiên thạch (-1.500 đến -4.000 HP)',
      4: 'Rồng thần giáng thế (-8.000 đến -15.000 HP)',
      5: 'Thần kiếm Hủy Diệt (-25.000 đến -50.000 HP)',
      6: 'Đòn Tối Thượng Thần Giới (-200.000+ HP)'
    },

    update(latest) {
      if (!latest || latest.game !== 'boss') return;
      state = latest.state;

      const hpRatio = state.hpRatio ?? (state.maxHp > 0 ? state.hp / state.maxHp : 0);
      const hpText = `${formatNumber(state.hp)} / ${formatNumber(state.maxHp)} (${state.bossName})`;
      hpMeter.update(hpRatio, hpText);

      const rageRatio = (state.rage || 0) / 100;
      const rageText = state.isFrenzy
        ? `🔥 CUỒNG NỘ X2 SÁT THƯƠNG (${Math.ceil(state.frenzyTimeLeftMs / 1000)}s)`
        : `${state.rage || 0}%`;
      rageMeter.update(state.isFrenzy ? 1 : rageRatio, rageText);

      // Thống kê góc trên
      hud.setStats([
        `Cấp ${state.level || 1}`,
        state.isFrenzy ? '🔥 CUỒNG NỘ' : '⚔️ ĐANG CHIẾN',
        `${formatNumber(state.hp)} HP`
      ]);

      // Bảng xếp hạng Top Dũng Sĩ
      if (state.contributors) {
        hud.setBoard('🏆 TOP DŨNG SĨ', state.contributors);
      }
    },

    onFx(fx) {
      this.onEvent(fx);
    },

    onEvent(fx) {
      if (fx.kind === 'bossHit') {
        const isCrit = fx.isCrit;
        boss.triggerHit(fx.damage, isCrit);

        // Hiệu ứng số sát thương nảy lên đầu Boss
        const dmgText = isCrit
          ? `💥 BẠO KÍCH -${formatNumber(fx.damage)}!`
          : `-${formatNumber(fx.damage)}`;
        labels.float(boss.headAnchor, dmgText);

        // Rung màn hình
        triggerScreenShake(isCrit ? 0.28 : 0.08, isCrit ? 0.35 : 0.18);

        // Bắn tia lửa từ ngực Boss
        particles.burst({
          position: boss.chestAnchor.position,
          count: isCrit ? 60 : 25,
          colors: isCrit ? ['#ffff00', '#ff0033', '#ffffff'] : ['#ff4400', '#ff8800'],
          speed: isCrit ? 7 : 4,
          spread: 1.0,
          gravity: -4,
          life: 0.8
        });

        // Âm thanh
        if (fx.attackType === 'slash') audio.play('whoosh');
        else if (fx.attackType === 'thunder') audio.play('clink');
        else if (fx.attackType?.startsWith('gift')) {
          audio.play(isCrit ? 'boom' : 'crash');
          if (fx.nickname) {
            hud.toast({
              nickname: fx.nickname,
              avatar: fx.avatar,
              text: `tung đòn ${dmgText}`
            });
          }
        }
      }

      if (fx.kind === 'bossFrenzy') {
        audio.play('horn');
        triggerScreenShake(0.35, 0.6);
        hud.banner('🔥 CẢ PHÒNG KÍCH HOẠT CUỒNG NỘ X2 SÁT THƯƠNG!', 4000);
        particles.burst({
          position: new THREE.Vector3(0, 3, 0),
          count: 120,
          colors: ['#ff0033', '#ff6600', '#ffff00'],
          speed: 8,
          spread: 1.0,
          gravity: -2,
          life: 1.5
        });
      }

      if (fx.kind === 'bossDefeated') {
        audio.play('fanfare');
        triggerScreenShake(0.4, 0.8);
        hud.banner(`🎉 ĐÃ TIÊU DIỆT ${fx.bossName}!`, 6000);

        // Nổ pháo hoa hạt ánh sáng hoành tráng
        for (let i = 0; i < 4; i += 1) {
          setTimeout(() => {
            particles.burst({
              position: new THREE.Vector3((Math.random() - 0.5) * 3, 3 + Math.random() * 2, (Math.random() - 0.5) * 2),
              count: 100,
              colors: ['#ffd700', '#ff3b5c', '#00f0ff', '#ffffff'],
              speed: 9,
              spread: 1.0,
              gravity: -5,
              life: 2.0
            });
            audio.play('boom');
          }, i * 350);
        }
      }

      if (fx.kind === 'bossRespawn') {
        audio.play('magic');
        hud.banner(`⚡ ${fx.bossName} ĐÃ XUẤT HIỆN!`, 3500);
      }
    },

    frame(dt, time) {
      clock += dt;

      // Cập nhật hoạt ảnh 3D của Boss
      boss.update(dt, clock, state || {});

      // Xoay vòng ma pháp sàn đấu
      rune.rotation.z += dt * (state?.isFrenzy ? 0.8 : 0.3);

      // Nhấp nháy ánh sáng dung nham theo nhịp thở của Boss
      lavaLight.intensity = 3.5 + Math.sin(clock * 3) * 1.5 + (state?.isFrenzy ? 2.5 : 0);

      // Rung màn hình khi bị đánh
      if (shakeTime > 0) {
        shakeTime -= dt;
        camera.position.x = originalCamPos.x + (Math.random() - 0.5) * shakeIntensity;
        camera.position.y = originalCamPos.y + (Math.random() - 0.5) * shakeIntensity;
        camera.position.z = originalCamPos.z + (Math.random() - 0.5) * shakeIntensity;
      } else {
        camera.position.copy(originalCamPos);
      }

      // Hạt tàn tro dung nham bay lơ lửng ngẫu nhiên
      if (Math.random() < 0.35) {
        particles.burst({
          position: new THREE.Vector3((Math.random() - 0.5) * 6, 0.1, (Math.random() - 0.5) * 6),
          count: 2,
          colors: ['#ff4400', '#ffaa00'],
          speed: 1.2,
          gravity: 0.5,
          life: 2.2,
          spread: 0.3
        });
      }

      particles.update(dt);
    },

    dispose() {
      boss.dispose();
      particles.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      runeGeo.dispose();
      runeMat.dispose();
      hud.clearGame();
    }
  };
}
