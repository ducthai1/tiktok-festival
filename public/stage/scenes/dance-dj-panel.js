// Kiểu "bar online": video DJ chiếu trên MÀN LED LỚN sau sân khấu (không chiếm màn hình người xem) + cột LỆNH bên phải
// (vùng bình luận TikTok nằm bên trái nên cột phải luôn đọc được).
// Video DJ: public/assets/dance/dj/dj.mp4 (không có file thì màn LED chạy chữ + cột sóng nhạc như cũ).
const DJ_VIDEO = '/static/assets/dance/dj/dj.mp4';

const COMMANDS = [
  ['💬', '1', 'VÀO SÀN'],
  ['🤍', 'đổi nv', 'ĐỔI NV'],
  ['🏃', 'đi vòng', 'ĐI VÒNG'],
  ['🤪', 'nhảy', 'NHẢY 1 CÁI'],
  ['💖', 'to lên', 'TO LÊN'],
  ['🔍', 'nhỏ lại', 'NHỎ LẠI'],
  ['❤', '1k tim', 'CÓ CÁNH + CAMERA'],
  ['🌹', 'quà', 'HUY HIỆU + CÁNH'],
  ['🎆', 'quà 99+', 'PHÁO HOA']
];

export function createDjPanel(hud, { onVideo }) {
  // video không gắn vào trang (chỉ làm ảnh cho màn LED 3D; thẻ <video> phủ trên canvas WebGL làm hỏng ghép lớp)
  const video = document.createElement('video');
  Object.assign(video, { src: DJ_VIDEO, muted: true, loop: true, autoplay: true, playsInline: true, preload: 'auto' });
  video.addEventListener('loadeddata', () => {
    video.play().catch(() => {});
    onVideo(video);
  }, { once: true });

  const pills = hud.el('div', 'cmd-pills');
  for (const [icon, word, label] of COMMANDS) {
    const pill = hud.el('div', 'cmd-pill');
    pill.append(hud.el('span', 'cmd-icon', icon), hud.el('span', 'cmd-label', label), hud.el('span', 'cmd-word', word));
    pills.append(pill);
  }
  hud.gameRoot.append(pills);
  return { video, dispose: () => { video.pause(); video.removeAttribute('src'); } };
}
