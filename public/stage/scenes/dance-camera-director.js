// Camera "đạo diễn" của sàn nhảy cho khung dọc 9:16.
// - Bình thường: vòng 8 góc như MV — TOÀN CẢNH RỘNG (thấy hết sân khấu + màn LED + cả sàn) → lượn cinematic vòng cung hạ
//   xuống → lướt bục Top 1-2-3 → lướt hàng đầu → lướt các hàng giữa → nhìn qua các hàng sau về sân khấu → quả cầu disco
//   (ngắn) → lia một bên sàn → lại toàn cảnh. Mỗi góc chuyển mượt, không giật.
// - Có quà: tiến sát người được chọn (solo thì vòng quanh chậm như quay MV), quà lớn thì cận rồi kéo ra toàn cảnh.
// Nhịp chuyển góc, cách làm mượt (hệ số mũ) và kịch bản "cận → kéo ra toàn cảnh" chuyển thể từ ClubCameraController.cs
// của dự án tiktok-live-bar — MIT License, Copyright (c) 2025 ÔNG CHÚ MMO (https://ongchummo.com).
import * as THREE from '/vendor/three/three.module.js';

const smooth = (v) => v * v * (3 - 2 * v);
// độ dài từng góc (ô nhịp): toàn cảnh, lượn cinematic, Top 3, hàng đầu, hàng giữa, hàng sau, cầu disco (ngắn), lia một bên
// — dài gần gấp đôi bản đầu: lướt chậm, xem live lâu không chóng mặt
const SHOT_BARS = [8, 7, 6, 5.5, 5.5, 5.5, 2.5, 6];
// lúc không theo ai: camera trượt như trên ray — lọc mũ HAI tầng (đích → điểm trượt → camera) nên đổi góc thì tăng tốc từ từ,
// hãm từ từ, không vọt ngay khung đầu. Hệ số nhỏ = chậm hơn.
const GLIDE_K = 1.1;
// ghé thăm một người (gõ lệnh miễn phí / 1k tim / share): cũng trượt HAI tầng như trên — vào từ từ, ra từ từ, không vọt
const GLANCE_K = 1.1;
// góc đổi theo ĐỒNG HỒ RIÊNG của camera (1 ô nhịp = nhịp chuẩn 124 BPM), KHÔNG theo nhịp bài đang phát: nhịp bài về 0 khi
// đổi bài (camera đứng im cả phút chờ "đuổi kịp") và nhảy vọt khi chen nhạc quà lớn (cắt liền mấy góc)
const SEC_PER_BAR = (4 * 60) / 124;

export function createCameraDirector(camera) {
  const look = new THREE.Vector3(0, 1.2, -1);
  const wantPos = new THREE.Vector3();
  const wantLook = new THREE.Vector3();
  const target = new THREE.Vector3();
  const glidePos = new THREE.Vector3();
  const glideLook = new THREE.Vector3();
  let shot = 0;
  let cycle = 0;
  let shotStart = null; // giây (đồng hồ cảnh) lúc bắt đầu góc hiện tại
  let focus = null; // { get: () => Vector3 | null, until, startedAt, mode: 'solo'|'glance'|'reveal'|'chase' }
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
      case 0: // TOÀN CẢNH RỘNG: lùi xa + cao, thấy trọn sân khấu, màn LED, bục Top và cả sàn; đẩy vào chậm
        wantPos.lerpVectors(target.set(0, 11.6, camFront + 8.8), wantPos.set(0, 10.6, camFront + 7.2), t);
        wantLook.set(0, 3.2, middle - 4.2);
        fov = THREE.MathUtils.lerp(62, 57, t);
        break;
      case 1: { // lượn cinematic: vòng cung từ trên cao một bên, hạ thấp sang bên kia; ánh nhìn trượt từ sàn về sân khấu
        const angle = THREE.MathUtils.lerp(-0.85, 0.55, t) * side;
        const radius = THREE.MathUtils.lerp(12.5, 8.5, t);
        wantPos.set(Math.sin(angle) * radius, THREE.MathUtils.lerp(8.6, 3.6, t), middle + Math.cos(angle) * radius);
        wantLook.lerpVectors(target.set(0, 1.2, middle), new THREE.Vector3(0, 2.6, podium.z), t);
        fov = THREE.MathUtils.lerp(52, 44, t);
        break;
      }
      case 2: // lướt ngang trước bục Top 1-2-3 trên sân khấu
        wantPos.lerpVectors(target.set(-side * 2.4, 4.4, podium.z + 7.6), wantPos.set(side * 2.4, 3.9, podium.z + 6.4), t);
        wantLook.set(0, podium.y + 0.9, podium.z);
        fov = THREE.MathUtils.lerp(44, 40, t);
        break;
      case 3: // lướt hàng đầu
        wantPos.set(sweep * 0.5, 4.4, front + 6);
        wantLook.set(sweep * 0.8, 1.0, front - 1.5);
        fov = 45;
        break;
      case 4: // lướt các hàng giữa từ trên chéo xuống (hàng sau không bị sticker hàng trước che)
        wantPos.set(mirrored * 0.6, 6.2, middle + 5.2);
        wantLook.set(mirrored * 0.75, 0.9, middle - 0.8);
        fov = 46;
        break;
      case 5: // nhìn qua đầu các hàng sau về phía sân khấu + màn LED
        wantPos.set(sweep * 0.4, 7.4, front + 5.5);
        wantLook.set(sweep * 0.5, 2.4, back - 2.5);
        fov = 52;
        break;
      case 6: // từ giữa đám đông ngước lên quả cầu disco + tia sáng toả xuống (góc ngắn)
        wantPos.set(mirrored * 0.35, 3.4, front + 3.6);
        wantLook.set(0, 6.4, 0.5);
        fov = THREE.MathUtils.lerp(54, 50, t);
        break;
      default: // lia một bên sàn, không băng qua cả sàn
        wantPos.lerpVectors(target.set(cx + side * (half + 2), 5.6, front + 7.5), wantPos.set(cx + side * (half * 0.5 + 1.4), 6.2, front + 8.6), t);
        wantLook.set(cx + side * THREE.MathUtils.lerp(half * 0.25, -half * 0.1, t), 1.0, middle);
        fov = THREE.MathUtils.lerp(48, 45, t);
    }
    return fov;
  }

  return {
    /** Theo một người: mode 'solo' (vòng quanh chậm), 'glance' (ghé nhìn), 'arrive' (khu vực người mới rơi xuống), 'reveal' (cận rồi kéo ra toàn cảnh). */
    focus(get, seconds, mode, now) {
      focus = { get, until: now + seconds, startedAt: now, mode };
    },
    isFocusing: (now) => Boolean(focus && now < focus.until),
    shotIndex: () => shot, // để kiểm tra (chụp từng góc)
    focusMode: (now) => (focus && now < focus.until ? focus.mode : ''),
    release() {
      focus = null;
    },
    update(dt, now, _beat, crowd, podium) {
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
        } else if (focus.mode === 'chase') {
          // quay xe bay kiểu truyền hình trực tiếp: camera đứng phía khán giả (trượt ngang nhẹ theo xe), ống kính xoay theo xe
          // và tự zoom theo khoảng cách → xe luôn vừa khung, không bao giờ sát xe / lọt vào khói, nền luôn là sân khấu
          wantPos.set(at.x * 0.45, Math.max(at.y + 2.2, 4.2), 11);
          // nhìn CAO hơn xe ~2,4 m + lệch phải 1 m → xe nằm ở nửa dưới khung, lệch trái (~78 % từ trên, ~30 % từ trái):
          // vùng chỉ có sàn nhảy, dưới thẻ quà lớn + bên trái bảng lệnh — không bị bảng / khung chữ / thẻ quà giữa màn che
          wantLook.copy(at).setY(at.y + 2.4);
          wantLook.x += 1.0;
          const dist = wantPos.distanceTo(at);
          fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(4.2 / dist)), 24, 55);
        } else if (focus.mode === 'solo') {
          // vòng quanh người đang solo như quay MV: góc lượn qua lại ±35°, thỉnh thoảng hạ thấp
          const orbit = Math.sin(elapsed * 0.45) * 0.6;
          const dist = 8.4 - Math.min(1, elapsed * 0.3);
          wantPos.set(at.x + Math.sin(orbit) * dist, at.y + 1.8 + Math.sin(elapsed * 0.3) * 0.4, at.z + Math.cos(orbit) * dist);
          wantLook.set(at.x, at.y + 2.0, at.z); // nhìn cao hơn đầu một chút: người solo nằm giữa-dưới, không đụng bảng phía trên
          fov = 40;
        } else if (focus.mode === 'arrive') {
          // người mới vào: khung RỘNG cả khu vực ô của họ (không cận), đủ cao để thấy nhân vật rơi từ trên xuống
          wantPos.set(at.x * 0.7, at.y + 5.2, at.z + 7.4);
          wantLook.set(at.x, at.y + 1.4, at.z - 0.5);
          fov = 48;
        } else {
          // ghé nhìn từ trên cao chéo xuống: người ở hàng sau không bị sticker hàng trước che; đứng hơi xa (khung vừa,
          // thấy cả người xung quanh) để quãng camera phải đi ngắn hơn, đỡ chóng mặt
          wantPos.set(at.x * 0.85, at.y + 3.6, at.z + 4.6);
          wantLook.set(at.x, at.y + 0.9, at.z);
          fov = 42;
        }
      } else {
        if (wasFocusing || shotStart === null || now < shotStart) {
          if (wasFocusing) shot = 0;
          shotStart = now;
          wasFocusing = false;
        }
        if (now - shotStart >= SHOT_BARS[shot] * SEC_PER_BAR) { // mỗi lần chỉ sang MỘT góc — không bao giờ cắt liền nhiều góc
          shotStart = now;
          shot = (shot + 1) % SHOT_BARS.length;
          if (shot === 0) cycle += 1;
        }
        fov = directorShot(THREE.MathUtils.clamp((now - shotStart) / (SHOT_BARS[shot] * SEC_PER_BAR), 0, 1), crowd, podium);
      }
      // toàn cảnh + ghé thăm: trượt hai tầng (tăng tốc / hãm từ từ); solo / xe bay / cận rồi kéo ra cần bám nhanh nên 3,6
      const gentle = !at || focus.mode === 'glance' || focus.mode === 'arrive';
      const blend = 1 - Math.exp(-(at ? (gentle ? GLANCE_K : 3.6) : GLIDE_K) * dt);
      if (!gentle) {
        camera.position.lerp(wantPos, blend);
        look.lerp(wantLook, blend);
        glidePos.copy(camera.position); // hết theo người → trượt tiếp từ chỗ đang đứng, không giật
        glideLook.copy(look);
      } else {
        glidePos.lerp(wantPos, blend);
        glideLook.lerp(wantLook, blend);
        camera.position.lerp(glidePos, blend);
        look.lerp(glideLook, blend);
      }
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
      glidePos.copy(wantPos);
      glideLook.copy(wantLook);
      camera.lookAt(look);
    }
  };
}
