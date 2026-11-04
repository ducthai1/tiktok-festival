// Thông báo QUÀ LỚN giữa màn (ngay khi nhận, không chờ tới lượt solo): ảnh món quà + tên người tặng + tên quà × số lượng
// + số kim cương, trên khung danh hiệu thật (neon 99+, lửa 499+, hoàng gia 5K+). Nhiều quà dồn thì xếp hàng, mỗi thẻ ~4 giây;
// hàng chờ dài thì giữ quà to nhất.
import { formatNumber } from '../stage-hud.js';

const FRAME = { 3: 'title-neon.webp', 4: 'title-fire.webp', 5: 'title-royal.webp', 6: 'title-royal.webp' };
const SHOW_MS = 4200;

export function createGiftAnnouncer(hud, { onShow } = {}) {
  const root = hud.el('div', 'big-gift');
  root.hidden = true;
  hud.gameRoot.append(root);
  const queue = [];
  let timer = null;

  function render(fx) {
    root.className = `big-gift tier-${fx.tier}`;
    root.style.backgroundImage = `url('/static/assets/dance/banners/${FRAME[fx.tier] || FRAME[3]}')`;
    root.replaceChildren();
    if (fx.giftPicture) {
      const img = document.createElement('img');
      img.src = fx.giftPicture;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      root.append(img);
    }
    const text = hud.el('div', 'big-gift-text');
    text.append(hud.el('div', 'big-gift-name', fx.nickname), hud.el('div', 'big-gift-what', `tặng ${fx.giftName} ×${fx.count}`),
      hud.el('div', 'big-gift-kc', `💎 ${formatNumber(fx.diamonds)}`));
    root.append(text);
    root.hidden = false;
    root.classList.remove('show');
    void root.offsetWidth; // chạy lại hiệu ứng xuất hiện
    root.classList.add('show');
    onShow?.(fx);
  }

  function pump() {
    if (timer || !queue.length) return;
    render(queue.shift());
    timer = setTimeout(() => {
      timer = null;
      root.classList.remove('show');
      if (queue.length) pump();
      else setTimeout(() => { if (!timer) root.hidden = true; }, 400);
    }, SHOW_MS);
  }

  return {
    /** fx: sự kiện 'gift' của sàn nhảy (tier ≥ 3 mới hiện) */
    show(fx) {
      if ((fx.tier || 1) < 3) return;
      queue.push(fx);
      queue.sort((a, b) => b.tier - a.tier || b.diamonds - a.diamonds);
      if (queue.length > 4) queue.length = 4;
      pump();
    },
    dispose() {
      clearTimeout(timer);
      root.remove();
    }
  };
}
