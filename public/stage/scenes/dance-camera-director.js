// Camera "đạo diễn" của sàn nhảy cho khung dọc 9:16.
// - Bình thường: chuỗi 8 góc quay theo ô nhịp (toàn cảnh → lia hàng đầu → lia hàng giữa → nhìn cao hàng cuối →
//   bục Top 3 → dolly một bên → hạ thấp nhìn màn LED → kết ở nửa đối diện), mỗi góc chuyển mượt, không giật.
// - Có quà: tiến sát người được chọn (solo thì vòng quanh chậm như quay MV), quà lớn thì cận rồi kéo ra toàn cảnh.
// Nhịp chuyển góc, cách làm mượt (hệ số mũ) và kịch bản "cận → kéo ra toàn cảnh" chuyển thể từ ClubCameraController.cs
// của dự án tiktok-live-bar — MIT License, Copyright (c) 2025 ÔNG CHÚ MMO (https://ongchummo.com).
import * as THREE from '/vendor/three/three.module.js';

const smooth = (v) => v * v * (3 - 2 * v);
const SHOT_BARS = [3.5, 3.5, 3.5, 3.5, 3.5, 4, 4.5, 3.5];

export function createCameraDirector(camera) {
  const look = new THREE.Vector3(0, 1.2, -1);
  const wantPos = new THREE.Vector3();
  const wantLook = new THREE.Vector3();
  const target = new THREE.Vector3();
  let shot = 0;
  let cycle = 0;
  let shotStartBeat = 0;
  let focus = null; // { get: () => Vector3 | null, until, startedAt, mode: 'solo'|'glance'|'reveal' }
  let wasFocusing = false;

  function directorShot(progress, crowd, podium) {
    const t = smooth(progress);
    const side = cycle % 2 === 0 ? -1 : 1;
    const cx = (crowd.min.x + crowd.max.x) / 2;
    const half = Math.max(2.4, (crowd.max.x - crowd.min.x) / 2 + 0.4);
    const front = crowd.max.z;
    const back = Math.min(crowd.min.z, front - 0.8);
    const middle = (front + back) / 2;
    const sweep = THREE.MathUtils.lerp(cx - half, cx + half, side < 0 ? t : 1 - t);
    const mirrored = cx * 2 - sweep;
    const camFront = front + 9;
    let fov = 50;
    switch (shot) {
      case 0: // toàn cảnh: sàn kín người ở nửa dưới, sân khấu + màn LED chiếu DJ ở giữa khung (không bị HUD phía trên che)
        wantPos.lerpVectors(target.set(0, 9.4, camFront + 4.6), wantPos.set(0, 8.6, camFront + 3.6), t);
        wantLook.set(0, 3.9, middle - 5);
        fov = THREE.MathUtils.lerp(58, 54, t);
        break;
      case 1: // lia ngang hàng đầu
        wantPos.set(sweep * 0.5, 4.6, front + 6.2);
        wantLook.set(sweep * 0.8, 1.0, front - 1.5);
        fov = 46;
        break;
      case 2: // từ giữa đám đông ngước lên quả cầu disco + tia sáng toả xuống
        wantPos.set(mirrored * 0.35, 3.4, front + 3.6);
        wantLook.set(0, 6.4, 0.5);
        fov = THREE.MathUtils.lerp(54, 50, t);
        break;
      case 3: // nhìn qua đầu đám đông về phía sân khấu + màn LED
        wantPos.set(sweep * 0.4, 7.4, front + 5.5);
        wantLook.set(sweep * 0.5, 2.4, back - 2.5);
        fov = 52;
        break;
      case 4: // trượt ngang trước bục Top 1-2-3 trên sân khấu
        wantPos.lerpVectors(target.set(-side * 2.2, 4.4, podium.z + 7.5), wantPos.set(side * 2.2, 4.0, podium.z + 6.6), t);
        wantLook.set(0, podium.y + 0.9, podium.z);
        fov = THREE.MathUtils.lerp(44, 40, t);
        break;
      case 5: // dolly một bên, không băng qua cả sàn
        wantPos.lerpVectors(target.set(cx + side * (half + 2), 5.6, front + 7.5), wantPos.set(cx + side * (half * 0.5 + 1.4), 6.2, front + 8.6), t);
        wantLook.set(cx + side * THREE.MathUtils.lerp(half * 0.25, -half * 0.1, t), 1.0, middle);
        fov = THREE.MathUtils.lerp(48, 45, t);
        break;
      case 6: // hạ thấp sau đám đông, ngước nhìn màn LED + sân khấu
        wantPos.lerpVectors(target.set(cx, 5.2, camFront), wantPos.set(cx + side * 1.2, 3.4, camFront - 2.5), t);
        wantLook.lerpVectors(target.set(cx, 1.4, middle), new THREE.Vector3(cx - side * 0.4, 3.2, podium.z - 1.5), t);
        fov = THREE.MathUtils.lerp(48, 50, t);
        break;
      default: // kết ở nửa đối diện cho công bằng hai bên
        wantPos.lerpVectors(target.set(cx - side * (half + 1), 5.2, front + 7), wantPos.set(cx - side * 1.6, 4.8, front + 6.2), t);
        wantLook.set(cx - side * Math.max(1.2, half * 0.42), 1.1, middle + 0.3);
        fov = THREE.MathUtils.lerp(47, 43, t);
    }
    return fov;
  }

  return {
    /** Theo một người: mode 'solo' (vòng quanh chậm), 'glance' (ghé nhìn), 'reveal' (cận rồi kéo ra toàn cảnh). */
    focus(get, seconds, mode, now) {
      focus = { get, until: now + seconds, startedAt: now, mode };
    },
    isFocusing: (now) => Boolean(focus && now < focus.until),
    focusMode: (now) => (focus && now < focus.until ? focus.mode : ''),
    release() {
      focus = null;
    },
    update(dt, now, beat, crowd, podium) {
      let fov = 50;
      const at = focus && now < focus.until ? focus.get() : null;
      if (at) {
        wasFocusing = true;
        const elapsed = now - focus.startedAt;
        if (focus.mode === 'reveal') {
          const k = smooth(THREE.MathUtils.clamp((elapsed - 1.2) / 1.0, 0, 1));
          wantPos.lerpVectors(target.set(at.x, at.y + 2.6, at.z + 6.2), new THREE.Vector3(at.x * 0.15, 10.5, crowd.max.z + 11), k);
          wantLook.lerpVectors(target.set(at.x, at.y + 1.1, at.z), new THREE.Vector3(at.x * 0.25, 2.2, -3), k);
          fov = THREE.MathUtils.lerp(34, 54, k);
        } else if (focus.mode === 'solo') {
          // vòng quanh người đang solo như quay MV: góc lượn qua lại ±35°, thỉnh thoảng hạ thấp
          const orbit = Math.sin(elapsed * 0.45) * 0.6;
          const dist = 8.4 - Math.min(1, elapsed * 0.3);
          wantPos.set(at.x + Math.sin(orbit) * dist, at.y + 1.8 + Math.sin(elapsed * 0.3) * 0.4, at.z + Math.cos(orbit) * dist);
          wantLook.set(at.x, at.y + 2.0, at.z); // nhìn cao hơn đầu một chút: người solo nằm giữa-dưới, không đụng bảng phía trên
          fov = 40;
        } else {
          wantPos.set(at.x * 0.9, at.y + 2.2, at.z + 4.8);
          wantLook.set(at.x, at.y + 0.8, at.z);
          fov = 36;
        }
      } else {
        if (wasFocusing) {
          shot = 0;
          shotStartBeat = beat;
          wasFocusing = false;
        }
        let shotBeats = SHOT_BARS[shot] * 4;
        while (beat - shotStartBeat >= shotBeats) {
          shotStartBeat += shotBeats;
          shot = (shot + 1) % SHOT_BARS.length;
          if (shot === 0) cycle += 1;
          shotBeats = SHOT_BARS[shot] * 4;
        }
        fov = directorShot(THREE.MathUtils.clamp((beat - shotStartBeat) / shotBeats, 0, 1), crowd, podium);
      }
      const blend = 1 - Math.exp(-(at ? 3.6 : 2.0) * dt);
      camera.position.lerp(wantPos, blend);
      look.lerp(wantLook, blend);
      camera.lookAt(look);
      camera.fov += (fov - camera.fov) * blend;
      camera.updateProjectionMatrix();
    },
    /** Đặt ngay vào góc toàn cảnh (lúc mới mở cảnh, khỏi bay từ gốc toạ độ vào). */
    snap(crowd, podium) {
      shot = 0;
      directorShot(0, crowd, podium);
      camera.position.copy(wantPos);
      look.copy(wantLook);
      camera.lookAt(look);
    }
  };
}
