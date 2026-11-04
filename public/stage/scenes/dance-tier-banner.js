// Khung chữ lớn giữa màn của Sàn Nhảy (SOLO / VIP / SIÊU SAO / ĐẠI NHẠC HỘI / DROP) — XỊN DẦN THEO CẤP, dùng ảnh khung danh
// hiệu thật (public/assets/dance/banners) chứ không tự vẽ bằng CSS:
//   follow  → bảng tên cyber + avatar      quà 10–98    → khung băng
//   99–498  → khung neon + vệt sáng lướt    499–4,9K     → khung lửa + lửa chập chờn
//   5K–19,9K → khung hoàng gia + tia sáng xoay   20K+   → hoàng gia to hơn + tia sáng cầu vồng
//   DROP    → khung lửa + rung + chớp trắng
// Chữ tiêu đề tự thu nhỏ cho vừa lòng khung (tên dài / tiêu đề dài không tràn ra viền).
// size: [tiêu đề, tên] tối đa (px) — khung lửa / hoàng gia có lòng thấp hơn (viền lửa, vương miện ở trên) nên chữ nhỏ hơn
const FRAMES = {
  1: { img: 'vip-nameplate-v2.webp', title: 'FAN MỚI', avatar: true, size: [42, 22] },
  2: { img: 'title-ice.webp', title: 'SOLO', size: [42, 22] },
  3: { img: 'title-neon.webp', title: 'SOLO SÂN KHẤU', size: [38, 21] },
  4: { img: 'title-fire.webp', title: 'VIP SOLO', size: [34, 19] },
  5: { img: 'title-royal.webp', title: 'SIÊU SAO', size: [34, 19] },
  6: { img: 'title-royal.webp', title: 'ĐẠI NHẠC HỘI', size: [34, 19] },
  drop: { img: 'title-fire.webp', title: 'DROP!', size: [36, 19] }
};
const BASE = '/static/assets/dance/banners/';

export function createTierBanner(hud) {
  const root = hud.el('div', 'tier-banner');
  root.hidden = true;
  const rays = hud.el('div', 'tb-rays');
  const frame = hud.el('div', 'tb-frame');
  const avatarBox = hud.el('div', 'tb-avatar');
  const avatar = document.createElement('img');
  avatar.alt = '';
  avatar.referrerPolicy = 'no-referrer';
  avatarBox.append(avatar);
  const text = hud.el('div', 'tb-text');
  const title = hud.el('div', 'tb-title');
  const sub = hud.el('div', 'tb-sub');
  text.append(title, sub);
  frame.append(avatarBox, text);
  root.append(rays, frame);
  hud.gameRoot.append(root);
  let timer = 0;

  // tiêu đề / tên dài → thu nhỏ chữ tới khi vừa lòng khung
  function fit(node, max, min) {
    node.style.fontSize = `${max}px`;
    for (let size = max; size > min && node.scrollWidth > node.clientWidth + 1; size -= 2) node.style.fontSize = `${size - 2}px`;
  }

  return {
    /** level: 1–6 (cấp quà của người solo) hoặc 'drop'. */
    show(level, subText = '', { avatarUrl = '', ms = 3400 } = {}) {
      const cfg = FRAMES[level] || FRAMES[2];
      root.className = `tier-banner tb-${level}`;
      frame.style.backgroundImage = `url('${BASE}${cfg.img}')`;
      title.textContent = cfg.title;
      sub.textContent = subText;
      avatarBox.hidden = !cfg.avatar;
      avatar.hidden = !avatarUrl;
      avatarBox.dataset.empty = avatarUrl ? '' : '💖'; // chưa có ảnh đại diện → trái tim
      if (avatarUrl) avatar.src = avatarUrl;
      root.hidden = false;
      // đo lại sau khi dựng khung + khi phông chữ tải xong (đo sớm bằng phông dự phòng hẹp hơn → vẫn tràn)
      const refit = () => {
        fit(title, cfg.size[0], 20);
        fit(sub, cfg.size[1], 13);
      };
      refit();
      requestAnimationFrame(refit);
      document.fonts?.ready.then(refit);
      root.classList.remove('show');
      void root.offsetWidth; // chạy lại hiệu ứng xuất hiện
      root.classList.add('show');
      clearTimeout(timer);
      timer = setTimeout(() => {
        root.classList.remove('show');
        timer = setTimeout(() => { root.hidden = true; }, 450);
      }, ms);
    },
    dispose() {
      clearTimeout(timer);
      root.remove();
    }
  };
}
