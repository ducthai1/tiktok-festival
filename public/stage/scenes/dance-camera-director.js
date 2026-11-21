// Camera "đạo diễn" của sàn nhảy cho khung dọc 9:16.
// - Bình thường: vòng 9 góc như MV — TOÀN CẢNH (thấy sân khấu + màn LED + sàn) → lượn cinematic vòng cung hạ xuống →
//   lướt bục Top 1-2-3 → LƯỚT NGANG TẦM MẮT NHÂN VẬT → lướt hàng đầu → GÓC THẤP NGƯỚC LÊN → lướt các hàng giữa → quả cầu
//   disco (ngắn) → lia một bên sàn → lại toàn cảnh. Mỗi góc chuyển mượt, không giật.
// - Có quà: tiến sát người được chọn (solo thì vòng quanh chậm như quay MV), quà lớn thì cận rồi lùi ra tầm trung.
// Chủ kênh 21/11/2026: "dàn máy đừng đưa ra xa thường xuyên quá, cho camera cinematic quay phần nhân vật, cam quay tổng
// đang hơi xa quá cho gần lại". Trước đó: cứ ghé nhìn ai xong (gõ lệnh, người mới vào, share, solo, quà…) là BẬT NGAY về
// toàn cảnh rộng nhất — live càng đông càng bị giật ra xa liên tục; toàn cảnh lùi tới ~18 m; quà lớn kéo ra gần toàn cảnh.
// Nhịp chuyển góc, cách làm mượt (hệ số mũ) và kịch bản "cận → kéo ra toàn cảnh" chuyển thể từ ClubCameraController.cs
// của dự án tiktok-live-bar — MIT License, Copyright (c) 2025 ÔNG CHÚ MMO (https://ongchummo.com).
import * as THREE from '/vendor/three/three.module.js';

const smooth = (v) => v * v * (3 - 2 * v);
// Thứ tự góc + độ dài từng góc (ô nhịp). Toàn cảnh chỉ còn 5/45 ô nhịp (trước 8/46) và không còn bị gọi lại sau mỗi lần
// ghé nhìn; phần lớn thời gian là các góc tầm nhân vật.
const SHOTS = [
  ['toanCanh', 5],
  ['luonCung', 6],
  ['bucTop', 5],
  ['tamMat', 6], // lướt ngang ngay tầm mắt nhân vật, sát hàng đầu — đám đông có chiều sâu như quay MV
  ['hangDau', 5],
  ['gocThap', 5], // máy thấp ngước lên, đẩy chậm vào đám đông, đèn sân khấu phía sau
  ['hangGiua', 5],
  ['cauDisco', 2.5],
  ['liaBen', 5.5]
];
const SHOT_BARS = SHOTS.map(([, bars]) => bars);
// ghé nhìn xong thì nối sang góc tầm nhân vật — đang cận mà bật thẳng ra toàn cảnh là cú "đưa ra xa" chủ kênh khó chịu
const SAU_KHI_GHE = SHOTS.findIndex(([ten]) => ten === 'tamMat');
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
    let fov = 50;
    switch (SHOTS[shot][0]) {
      case 'toanCanh': // TOÀN CẢNH: thấy sân khấu, màn LED, bục Top và sàn; đẩy vào chậm. Trước lùi tới front+17,8 m, cao
        // 11,6 m, ống 62° — nhân vật thành chấm nhỏ. Nay gần lại ~27 %, ống hẹp hơn: vẫn trọn sân khấu mà thấy rõ người.
        wantPos.lerpVectors(target.set(0, 9.2, front + 13), wantPos.set(0, 8.4, front + 11.6), t);
        wantLook.set(0, 3.0, middle - 4.0);
        fov = THREE.MathUtils.lerp(56, 52, t);
        break;
      case 'luonCung': { // lượn cinematic: vòng cung từ trên một bên, hạ thấp sang bên kia; ánh nhìn trượt từ sàn về sân khấu
        const angle = THREE.MathUtils.lerp(-0.85, 0.55, t) * side;
        const radius = THREE.MathUtils.lerp(10, 7, t);
        wantPos.set(Math.sin(angle) * radius, THREE.MathUtils.lerp(6.6, 2.8, t), middle + Math.cos(angle) * radius);
        wantLook.lerpVectors(target.set(0, 1.0, middle), new THREE.Vector3(0, 2.4, podium.z), t);
        fov = THREE.MathUtils.lerp(48, 42, t);
        break;
      }
      case 'tamMat': // LƯỚT NGANG TẦM MẮT: máy ngang đầu nhân vật , ngay trước hàng đầu, trượt chậm từ bên này sang bên kia
        // (chụp thử 21/11: đặt sát front+2,6 m thì một sticker hàng đầu che nửa khung — lùi ra 5,6 m)
        wantPos.set(sweep * 0.6, THREE.MathUtils.lerp(2.4, 2.2, t), front + 5.6);
        wantLook.set(sweep * 0.7, 1.2, front - 2.5);
        fov = THREE.MathUtils.lerp(42, 40, t);
        break;
      case 'gocThap': // GÓC THẤP NGƯỚC LÊN: máy sát sàn, đẩy chậm vào đám đông, ngước lên thấy đèn sân khấu phía sau
        wantPos.set(mirrored * 0.3, THREE.MathUtils.lerp(1.5, 1.7, t), THREE.MathUtils.lerp(front + 6.8, front + 5.2, t));
        wantLook.set(mirrored * 0.3, 2.0, middle);
        fov = THREE.MathUtils.lerp(46, 42, t);
        break;
      case 'bucTop': // lướt ngang trước bục Top 1-2-3 trên sân khấu
        wantPos.lerpVectors(target.set(-side * 2.4, 4.4, podium.z + 7.6), wantPos.set(side * 2.4, 3.9, podium.z + 6.4), t);
        wantLook.set(0, podium.y + 0.9, podium.z);
        fov = THREE.MathUtils.lerp(44, 40, t);
        break;
      case 'hangDau': // lướt hàng đầu
        wantPos.set(sweep * 0.5, 4.4, front + 6);
        wantLook.set(sweep * 0.8, 1.0, front - 1.5);
        fov = 45;
        break;
      case 'hangGiua': // lướt các hàng giữa từ trên chéo xuống (hàng sau không bị sticker hàng trước che)
        wantPos.set(mirrored * 0.6, 6.2, middle + 5.2);
        wantLook.set(mirrored * 0.75, 0.9, middle - 0.8);
        fov = 46;
        break;
      case 'cauDisco': // từ giữa đám đông ngước lên quả cầu disco + tia sáng toả xuống (góc ngắn)
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
    /** Theo một người: mode 'solo' (vòng quanh chậm), 'glance' (ghé nhìn), 'arrive' (khu vực người mới rơi xuống), 'reveal' (cận rồi lùi ra tầm trung). */
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
          // cận người tặng rồi lùi ra TẦM TRUNG (thấy pháo hoa + đám đông quanh họ). Trước đây lùi tới cao 10,5 m, sau sàn
          // 11 m — gần bằng toàn cảnh, mà quà lớn thì nhiều, nên camera cứ bị kéo ra xa.
          wantPos.lerpVectors(target.set(at.x, at.y + 2.6, at.z + 6.2), new THREE.Vector3(at.x * 0.3, 6.6, crowd.max.z + 7.5), k);
          wantLook.lerpVectors(target.set(at.x, at.y + 1.1, at.z), new THREE.Vector3(at.x * 0.35, 1.8, -2.5), k);
          fov = THREE.MathUtils.lerp(34, 48, k);
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
          wantPos.set(at.x * 0.7, at.y + 4.2, at.z + 6.0);
          wantLook.set(at.x, at.y + 1.2, at.z - 0.5);
          fov = 46;
        } else {
          // ghé nhìn từ trên cao chéo xuống: người ở hàng sau không bị sticker hàng trước che; đứng hơi xa (khung vừa,
          // thấy cả người xung quanh) để quãng camera phải đi ngắn hơn, đỡ chóng mặt
          wantPos.set(at.x * 0.85, at.y + 3.6, at.z + 4.6);
          wantLook.set(at.x, at.y + 0.9, at.z);
          fov = 42;
        }
      } else {
        if (wasFocusing || shotStart === null || now < shotStart) {
          if (wasFocusing) shot = SAU_KHI_GHE;
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
