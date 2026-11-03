// Mô hình 3D Boss TITAN NHAM THẠCH dựng bằng Three.js Procedural.
// Nhẹ tuyệt đối, không tốn VRAM tải file ngoài, có sẵn khớp xương và hiệu ứng chấn động khi nhận đòn.
import * as THREE from '/vendor/three/three.module.js';

const rockMat = (color = '#2e3042', extra = {}) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness: 0.32,
    flatShading: true,
    ...extra
  });

const lavaMat = (color = '#ff3b00', intensity = 2.2) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.25,
    metalness: 0.4
  });

function mesh(geometry, material, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const node = new THREE.Mesh(geometry, material);
  node.position.set(...pos);
  node.rotation.set(...rot);
  node.scale.set(...scale);
  node.castShadow = true;
  node.receiveShadow = true;
  return node;
}

export function buildBossTitan() {
  const root = new THREE.Group();
  const materials = [];
  const geometries = [];

  function track(geo, mat) {
    if (geo && !geometries.includes(geo)) geometries.push(geo);
    if (mat && !materials.includes(mat)) materials.push(mat);
    return { geo, mat };
  }

  // --- 1. Lõi Năng Lượng Ngực (Heart Core) ---
  const coreMat = lavaMat('#ff4400', 3.0);
  const coreGeo = new THREE.OctahedronGeometry(0.55);
  track(coreGeo, coreMat);
  const core = mesh(coreGeo, coreMat, [0, 3.4, 0.45]);
  root.add(core);

  // --- 2. Thân Trên (Torso) ---
  const bodyMat = rockMat('#181822');
  const plateMat = rockMat('#262638', { roughness: 0.7 });
  track(null, bodyMat);
  track(null, plateMat);

  const torso = new THREE.Group();
  torso.position.set(0, 3.2, 0);

  // Giáp ngực tảng đá
  const chestGeo = new THREE.BoxGeometry(2.4, 1.8, 1.5);
  track(chestGeo, bodyMat);
  torso.add(mesh(chestGeo, bodyMat, [0, 0.3, 0]));

  // Giáp sườn & bụng
  const bellyGeo = new THREE.BoxGeometry(1.8, 1.4, 1.2);
  track(bellyGeo, plateMat);
  torso.add(mesh(bellyGeo, plateMat, [0, -0.9, 0]));

  // Khe nứt nham thạch trên ngực
  const seamGeo = new THREE.BoxGeometry(0.2, 1.2, 0.1);
  const seamMat = lavaMat('#ff5500', 2.2);
  track(seamGeo, seamMat);
  torso.add(mesh(seamGeo, seamMat, [-0.5, 0.4, 0.76], [0, 0, -0.3]));
  torso.add(mesh(seamGeo, seamMat, [0.5, 0.4, 0.76], [0, 0, 0.3]));

  root.add(torso);

  // --- 3. Đầu & Sừng Quỷ (Head & Horns) ---
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 4.6, 0.2);

  // Khối đầu góc cạnh
  const headGeo = new THREE.DodecahedronGeometry(0.65);
  track(headGeo, bodyMat);
  headGroup.add(mesh(headGeo, bodyMat));

  // Mắt Laser Đỏ
  const eyeMat = lavaMat('#ff0044', 4.0);
  const eyeGeo = new THREE.SphereGeometry(0.12, 12, 8);
  track(eyeGeo, eyeMat);
  headGroup.add(mesh(eyeGeo, eyeMat, [0.26, 0.12, 0.52]));
  headGroup.add(mesh(eyeGeo, eyeMat, [-0.26, 0.12, 0.52]));

  // Sừng Quỷ Lớn
  const hornMat = rockMat('#0c0c14', { roughness: 0.5 });
  const hornGeo = new THREE.ConeGeometry(0.2, 1.4, 6);
  track(hornGeo, hornMat);
  headGroup.add(mesh(hornGeo, hornMat, [0.55, 0.7, -0.1], [0.3, 0, -0.6]));
  headGroup.add(mesh(hornGeo, hornMat, [-0.55, 0.7, -0.1], [0.3, 0, 0.6]));

  // Sừng Nhỏ Bổ Sung
  const smallHornGeo = new THREE.ConeGeometry(0.12, 0.7, 5);
  track(smallHornGeo, hornMat);
  headGroup.add(mesh(smallHornGeo, hornMat, [0.35, 0.45, 0.35], [-0.4, 0, -0.4]));
  headGroup.add(mesh(smallHornGeo, hornMat, [-0.35, 0.45, 0.35], [-0.4, 0, 0.4]));

  root.add(headGroup);

  // --- 4. Hai Cánh Tay & Vũ Khí (Arms & Weapon) ---
  const armMat = rockMat('#222230');
  const armGeo = new THREE.CylinderGeometry(0.35, 0.3, 1.4, 6);
  track(armGeo, armMat);

  // Vai Hộ Giáp (Pauldrons)
  const pauldronGeo = new THREE.ConeGeometry(0.7, 1.1, 5);
  track(pauldronGeo, plateMat);

  // Tay Phải (Cầm Đại Đao)
  const armR = new THREE.Group();
  armR.position.set(1.6, 3.8, 0);
  armR.add(mesh(pauldronGeo, plateMat, [0.3, 0.2, 0], [0, 0, -0.8]));
  armR.add(mesh(armGeo, armMat, [0.2, -0.8, 0.2], [0.4, 0, -0.2]));

  // Đại Đao Nham Thạch (Flame Greatsword)
  const sword = new THREE.Group();
  sword.position.set(0.3, -1.6, 0.6);
  sword.rotation.set(-0.6, 0.2, -0.3);

  // Chuôi & Cán đao
  const hiltGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8);
  const guardGeo = new THREE.BoxGeometry(0.9, 0.22, 0.3);
  track(hiltGeo, hornMat);
  track(guardGeo, plateMat);
  sword.add(mesh(hiltGeo, hornMat, [0, -0.5, 0]));
  sword.add(mesh(guardGeo, plateMat, [0, 0.1, 0]));

  // Lưỡi Đao Lớn Phát Sáng
  const bladeMat = lavaMat('#ff5500', 3.5);
  const bladeGeo = new THREE.BoxGeometry(0.35, 3.6, 0.08);
  const bladeTipGeo = new THREE.ConeGeometry(0.35, 0.8, 4);
  track(bladeGeo, bladeMat);
  track(bladeTipGeo, bladeMat);
  sword.add(mesh(bladeGeo, bladeMat, [0, 1.9, 0]));
  sword.add(mesh(bladeTipGeo, bladeMat, [0, 4.0, 0], [0, Math.PI / 4, 0]));

  armR.add(sword);
  root.add(armR);

  // Tay Trái (Giáp Gai Hộ Thủ)
  const armL = new THREE.Group();
  armL.position.set(-1.6, 3.8, 0);
  armL.add(mesh(pauldronGeo, plateMat, [-0.3, 0.2, 0], [0, 0, 0.8]));
  armL.add(mesh(armGeo, armMat, [-0.2, -0.8, 0.3], [0.6, 0, 0.3]));
  // Khiên gai nham thạch
  const shieldGeo = new THREE.DodecahedronGeometry(0.7);
  track(shieldGeo, seamMat);
  armL.add(mesh(shieldGeo, seamMat, [-0.4, -1.4, 0.6], [0.3, 0.4, 0], [0.7, 1.4, 0.7]));
  root.add(armL);

  // --- 5. Cánh Nham Thạch / Hào Quang Lưng (Wings) ---
  const wings = new THREE.Group();
  wings.position.set(0, 3.6, -0.8);
  const wingGeo = new THREE.BoxGeometry(2.4, 0.35, 0.1);
  track(wingGeo, seamMat);
  wings.add(mesh(wingGeo, seamMat, [1.5, 0.8, 0], [0, -0.3, 0.5]));
  wings.add(mesh(wingGeo, seamMat, [-1.5, 0.8, 0], [0, 0.3, -0.5]));
  wings.add(mesh(wingGeo, seamMat, [1.8, 0.2, 0], [0, -0.2, 0.2]));
  wings.add(mesh(wingGeo, seamMat, [-1.8, 0.2, 0], [0, 0.2, -0.2]));
  root.add(wings);

  // --- 6. Neo Điểm (Anchors) ---
  const headAnchor = new THREE.Object3D();
  headAnchor.position.set(0, 5.8, 0.5);
  root.add(headAnchor);

  const chestAnchor = new THREE.Object3D();
  chestAnchor.position.set(0, 3.4, 0.4);
  root.add(chestAnchor);

  // Trạng thái rung lắc & chớp sáng
  let hitTime = 0;
  let defaultScales = {
    torso: torso.scale.clone(),
    core: core.scale.clone()
  };

  return {
    root,
    headAnchor,
    chestAnchor,
    sword,
    core,
    torso,
    headGroup,
    armR,
    armL,
    wings,

    triggerHit(damage = 10, isCrit = false) {
      hitTime = isCrit ? 0.45 : 0.25;
      // Rung lắc giật lùi
      torso.position.z = -0.35;
      headGroup.rotation.x = -0.25;
    },

    update(dt, elapsed, state = {}) {
      const isFrenzy = !!state.isFrenzy;
      const isDefeated = state.status === 'celebrating';

      // 1. Cử động thở phập phồng (Breathing idle)
      if (!isDefeated) {
        const breathSpeed = isFrenzy ? 4.5 : 2.2;
        const breathAmt = Math.sin(elapsed * breathSpeed) * 0.05;
        torso.scale.set(1 + breathAmt, 1 + breathAmt * 0.6, 1 + breathAmt);

        // Lơ lửng bồng bềnh
        root.position.y = Math.sin(elapsed * 1.5) * 0.15;

        // Xoay nhẹ theo dõi sàn đấu
        root.rotation.y = Math.sin(elapsed * 0.6) * 0.12;

        // Xoay lõi năng lượng 3 chiều
        core.rotation.x += dt * (isFrenzy ? 5.0 : 2.0);
        core.rotation.y += dt * (isFrenzy ? 6.0 : 2.5);

        // Đao vung nhẹ theo nhịp
        sword.rotation.z = -0.3 + Math.sin(elapsed * 2.0) * 0.1;

        // Cánh đập nhẹ
        wings.rotation.y = Math.sin(elapsed * 1.8) * 0.15;
      } else {
        // Boss gục ngã khi chết
        root.position.y = Math.max(-1.5, root.position.y - dt * 2.5);
        torso.rotation.x = Math.min(0.8, torso.rotation.x + dt * 1.8);
        armR.rotation.z = Math.min(1.2, armR.rotation.z + dt * 2.0);
        armL.rotation.z = Math.max(-1.2, armL.rotation.z - dt * 2.0);
      }

      // 2. Xử lý hồi phục sau khi dính đòn (Hit recovery)
      if (hitTime > 0) {
        hitTime -= dt;
        const flashIntensity = (hitTime / 0.45) * 4.0;
        coreMat.emissiveIntensity = 3.0 + flashIntensity;
        bladeMat.emissiveIntensity = 3.5 + flashIntensity;
      } else {
        coreMat.emissiveIntensity = isFrenzy ? 5.0 : 3.0;
        bladeMat.emissiveIntensity = isFrenzy ? 5.5 : 3.5;
        torso.position.z += (0 - torso.position.z) * Math.min(1, dt * 12);
        headGroup.rotation.x += (0 - headGroup.rotation.x) * Math.min(1, dt * 12);
      }
    },

    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    }
  };
}
