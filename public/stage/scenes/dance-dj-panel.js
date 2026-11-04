// Kiểu "bar online": video DJ chiếu trên MÀN LED LỚN sau sân khấu (không chiếm màn hình người xem) + cột LỆNH bên phải
// (vùng bình luận TikTok nằm bên trái nên cột phải luôn đọc được).
// Video DJ: public/assets/dance/dj/dj.mp4 (không có file thì màn LED chạy chữ + cột sóng nhạc như cũ).
const DJ_VIDEO = '/static/assets/dance/dj/dj.mp4';

// [biểu tượng, cách làm (gõ gì / làm gì), được gì] — đọc thành "Gõ [đổi nv] → Đổi nhân vật"
const COMMANDS = [
  ['💬', '1', 'Vào sàn nhảy'],
  ['💬', 'đổi nv', 'Đổi nhân vật'],
  ['💬', 'đi vòng', 'Đi 1 vòng sàn'],
  ['💬', 'nhảy', 'Nhảy lên 1 cái'],
  ['💬', 'to lên', 'Nhân vật to ra'],
  ['💬', 'nhỏ lại', 'Nhân vật nhỏ lại'],
  ['💬', 'quẩy', 'Quẩy bung 8 giây'],
  ['❤', '1.000 tim', 'Có cánh + lên camera', 'act'],
  ['➕', 'Follow', 'Lên camera + vẫy tay', 'act']
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
  pills.append(hud.el('div', 'cmd-head', 'MIỄN PHÍ · bình luận là được'));
  for (const [icon, word, label, kind] of COMMANDS) {
    const pill = hud.el('div', 'cmd-pill');
    pill.append(hud.el('span', 'cmd-icon', icon), hud.el('span', 'cmd-verb', kind === 'act' ? '' : 'Gõ'), hud.el('span', 'cmd-word', word),
      hud.el('span', 'cmd-arrow', '→'), hud.el('span', 'cmd-label', label));
    pills.append(pill);
  }
  hud.gameRoot.append(pills);
  return { video, dispose: () => { video.pause(); video.removeAttribute('src'); } };
}
