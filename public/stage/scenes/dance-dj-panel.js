// Kiểu "bar online": video DJ chiếu trên MÀN LED LỚN sau sân khấu (không chiếm màn hình người xem) + cột LỆNH bên phải
// (vùng bình luận TikTok nằm bên trái nên cột phải luôn đọc được).
// Video DJ: public/assets/dance/dj/dj.mp4 (không có file thì màn LED chạy chữ + cột sóng nhạc như cũ).
const DJ_VIDEO = '/static/assets/dance/dj/dj.mp4';

// [biểu tượng, cách làm (gõ gì / làm gì), được gì] — đọc thành "Gõ [đổi nv] → Đổi nhân vật".
// Vào live là tự có nhân vật trên sàn (sự kiện vào phòng), nên không có dòng "gõ 1".
const COMMANDS = [
  ['💬', 'đổi nv', 'Đổi nhân vật'],
  ['💬', 'đi vòng', 'Đi 1 vòng sàn'],
  ['💬', 'nhảy', 'Nhảy lên 1 cái'],
  ['💬', 'to lên', 'Nhân vật to ra'],
  ['💬', 'nhỏ lại', 'Nhân vật nhỏ lại'],
  ['💬', 'quẩy', 'Quẩy bung 8 giây'],
  ['👋', 'Vào live', 'Tự lên sàn, khỏi gõ', 'act'],
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

  // bảng 2 cột "Gõ | Được" (chữ "Gõ" chỉ ở đầu cột, không lặp mỗi dòng); bề ngang cố định, chữ tự xuống dòng — không tràn khung
  const table = hud.el('div', 'cmd-table');
  table.append(hud.el('div', 'cmd-title', '🆓 MIỄN PHÍ'));
  const grid = hud.el('div', 'cmd-grid');
  grid.append(hud.el('div', 'cmd-th', '💬 Gõ'), hud.el('div', 'cmd-th', 'Được'));
  for (const [icon, word, label, kind] of COMMANDS) {
    grid.append(hud.el('div', `cmd-key${kind === 'act' ? ' act' : ''}`, kind === 'act' ? `${icon} ${word}` : word), hud.el('div', 'cmd-val', label));
  }
  table.append(grid);
  hud.gameRoot.append(table);
  return { video, dispose: () => { video.pause(); video.removeAttribute('src'); } };
}
