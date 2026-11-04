// Thông báo LỚN giữa màn (ngay khi nhận, không chờ tới lượt solo) trên khung danh hiệu thật:
// - quà lớn: ảnh món quà + tên người tặng + tên quà × số lượng + số kim cương (neon 99+, lửa 499+, hoàng gia 5K+);
// - follow mới: avatar tròn + tên + "vừa FOLLOW" + "Lên sân khấu solo!" (khung neon).
// Nhiều thẻ dồn thì xếp hàng, mỗi thẻ ~4 giây; hàng chờ dài thì giữ thẻ to nhất (follow xếp ngay sau quà bậc 3).
import { formatNumber } from '../stage-hud.js';

const FRAME = { 3: 'title-neon.webp', 4: 'title-fire.webp', 5: 'title-royal.webp', 6: 'title-royal.webp' };
const SHOW_MS = 4200;

export function createGiftAnnouncer(hud, { onShow } = {}) {
  const root = hud.el('div', 'big-gift');
  root.hidden = true;
  hud.gameRoot.append(root);
  const queue = [];
  let timer = null;

  function render(card) {
    root.className = `big-gift tier-${card.tier}${card.fx.kind === 'follow' ? ' follow' : ''}`;
    root.style.backgroundImage = `url('/static/assets/dance/banners/${FRAME[card.tier] || FRAME[3]}')`;
    root.replaceChildren();
    if (card.picture) {
      const img = document.createElement('img');
      img.src = card.picture;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      if (card.fx.kind === 'follow') img.className = 'avatar';
      root.append(img);
    } else if (card.fx.kind === 'follow') root.append(hud.el('div', 'big-gift-heart', '💖'));
    const text = hud.el('div', 'big-gift-text');
    text.append(hud.el('div', 'big-gift-name', card.fx.nickname), hud.el('div', 'big-gift-what', card.what), hud.el('div', 'big-gift-kc', card.extra));
    root.append(text);
    root.hidden = false;
    root.classList.remove('show');
    void root.offsetWidth; // chạy lại hiệu ứng xuất hiện
    root.classList.add('show');
    onShow?.({ ...card.fx, tier: card.tier });
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

  function push(card) {
    queue.push(card);
    queue.sort((a, b) => b.order - a.order);
    if (queue.length > 4) queue.length = 4;
    pump();
  }

  return {
    /** fx: sự kiện 'gift' của sàn nhảy (tier ≥ 3 mới hiện) */
    show(fx) {
      const tier = fx.tier || 1;
      if (tier < 3) return;
      push({ fx, tier, picture: fx.giftPicture, what: `tặng ${fx.giftName} ×${fx.count}`, extra: `💎 ${formatNumber(fx.diamonds)}`,
        order: tier * 1e9 + fx.diamonds });
    },
    /** fx: sự kiện 'follow' (lần follow đầu trong phiên) */
    follow(fx) {
      push({ fx, tier: 3, picture: fx.avatar, what: '💖 vừa FOLLOW sàn nhảy', extra: '🎤 Lên sân khấu solo!', order: 3e9 - 1 });
    },
    dispose() {
      clearTimeout(timer);
      root.remove();
    }
  };
}
