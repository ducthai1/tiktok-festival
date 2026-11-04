// Bố cục "bar online" như các phòng live đang hot: khung VIDEO DJ ở 35% trên (dòng nhắc "chat: 1 vào BAR. 1k tym có cánh"),
// hội trường 3D ở phần dưới, cột LỆNH bên phải (vùng bình luận TikTok nằm bên trái nên cột phải luôn đọc được).
// Video DJ: đặt file public/assets/dance/dj/dj.mp4 (video của chủ kênh). Không có file thì khung trên ẩn, cảnh 3D phủ toàn màn.
const DJ_VIDEO = '/static/assets/dance/dj/dj.mp4';
export const DJ_PANEL_RATIO = 0.35;

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
  const panel = hud.el('div', 'dj-panel');
  const video = document.createElement('video');
  Object.assign(video, { src: DJ_VIDEO, muted: true, loop: true, autoplay: true, playsInline: true, preload: 'auto' });
  const notice = hud.el('div', 'dj-notice', 'chat: 1 vào BAR. 1k tym có cánh');
  // video KHÔNG gắn vào trang: vẽ từng khung sang canvas 2D (lớp <video> phủ trên canvas WebGL làm hỏng ghép lớp ở một số trình duyệt)
  const screen = document.createElement('canvas');
  screen.width = 540;
  screen.height = 336;
  const g = screen.getContext('2d');
  panel.append(screen, notice);
  panel.hidden = true;
  video.addEventListener('loadeddata', () => {
    panel.hidden = false;
    video.play().catch(() => {});
    onVideo(video);
  }, { once: true });
  video.addEventListener('error', () => { panel.hidden = true; }, { once: true });

  const pills = hud.el('div', 'cmd-pills');
  for (const [icon, word, label] of COMMANDS) {
    const pill = hud.el('div', 'cmd-pill');
    pill.append(hud.el('span', 'cmd-icon', icon), hud.el('span', 'cmd-label', label), hud.el('span', 'cmd-word', word));
    pills.append(pill);
  }
  // khung video đặt ĐẦU #hud để thanh tiêu đề, bảng xếp hạng… vẽ đè lên trên nó (không bị video che)
  hud.gameRoot.parentElement.prepend(panel);
  hud.gameRoot.append(pills);
  return {
    panel,
    video,
    /** gọi mỗi khung hình: chép khung video hiện tại sang canvas (cắt giữa cho đầy khung, không méo) */
    draw() {
      if (panel.hidden || video.readyState < 2) return;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const scale = Math.max(screen.width / vw, screen.height / vh);
      const w = screen.width / scale;
      const h = screen.height / scale;
      g.drawImage(video, (vw - w) / 2, (vh - h) / 2, w, h, 0, 0, screen.width, screen.height);
    },
    dispose: () => { video.pause(); video.removeAttribute('src'); panel.remove(); }
  };
}
