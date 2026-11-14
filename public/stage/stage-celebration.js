// 🎉 Chúc mừng người ủng hộ (game-hub.js: tổng 💎 một người tặng trong phòng live vượt mốc 100 / 200 / 300…).
// Màn bùng nổ ~8 giây giữa vùng an toàn của TikTok: chớp sáng + sóng xung kích + rung, avatar giữa hào quang xoay, vương miện
// rơi xuống, tên chữ vàng, số 💎 đếm lên, pháo hoa (canvas 2D — nhẹ, OBS vẽ bằng CPU vẫn chạy), mưa kim cương, kèn + giọng đọc.
// Mốc càng cao càng hoành tráng: < 500 vàng · 500+ cầu vồng "SIÊU ỦNG HỘ" · 1000+ "HUYỀN THOẠI". Nhiều người cùng lúc → lần lượt.
import { speakableName } from '/static/shared/spoken-name.js';

const SHOW_MS = 8000;
// khung danh hiệu + đôi cánh thật của Sàn Nhảy (public/assets/dance/banners) — càng mốc cao càng sang
const ART = '/static/assets/dance/banners/';
const LOOK = {
  gold: { frame: 'title-fire.webp', wings: 'wings-fire.webp', crown: true },
  rainbow: { frame: 'title-neon.webp', wings: 'energy-wings-v2.webp', crown: true },
  legend: { frame: 'title-royal.webp', wings: 'player-wings.webp', crown: false } // khung hoàng gia đã có vương miện
};
for (const look of Object.values(LOOK)) for (const file of [look.frame, look.wings]) new Image().src = ART + file; // tải sẵn
const OUT_MS = 600;
const PALETTES = {
  gold: ['#ffd36b', '#fff3c4', '#ffb300', '#ff8a00', '#ffffff'],
  rainbow: ['#ff4fa3', '#ffd36b', '#36d6ff', '#7dff8a', '#b388ff', '#ffffff'],
  legend: ['#ff3d6e', '#ffd36b', '#b388ff', '#ff9100', '#ffffff', '#36d6ff']
};

export function createCelebration({ root, audio }) {
  const queue = [];
  let busy = false;

  const el = (tag, className = '', text = '') => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  // ── pháo hoa: các chùm hạt nổ ở vị trí ngẫu nhiên trong vùng an toàn ──
  function fireworks(canvas, colors, bursts) {
    const ctx = canvas.getContext('2d');
    const parts = [];
    const start = performance.now();
    const plan = Array.from({ length: bursts }, (_, i) => ({ at: 150 + i * (5600 / bursts) + Math.random() * 250, done: false }));
    const burst = (x, y, n) => {
      const color = colors[Math.floor(Math.random() * colors.length)];
      for (let i = 0; i < n; i += 1) {
        const a = (Math.PI * 2 * i) / n + Math.random() * 0.2;
        const v = 5 + Math.random() * 9;
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, decay: 0.010 + Math.random() * 0.012,
          color: Math.random() < 0.25 ? '#ffffff' : color, size: 3 + Math.random() * 4 });
      }
    };
    let last = start;
    const frame = (now) => {
      const t = now - start;
      const dt = Math.min(3, (now - last) / 16.7); // OBS vẽ ít khung/giây: hạt vẫn bay đúng tốc độ
      last = now;
      for (const p of plan) {
        if (!p.done && t >= p.at) {
          p.done = true;
          burst(140 + Math.random() * 800, 230 + Math.random() * 760, 60 + Math.floor(Math.random() * 40));
        }
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = parts.length - 1; i >= 0; i -= 1) {
        const p = parts[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.97 ** dt;
        p.vy = p.vy * 0.97 ** dt + 0.18 * dt;
        p.life -= p.decay * dt;
        if (p.life <= 0) {
          parts.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + p.life * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (t < SHOW_MS) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  function avatarNode(fx) {
    const box = el('div', 'cb-avatar');
    const initial = el('span', 'cb-initial', ([...String(fx.nickname || '?').trim()][0] || '?').toUpperCase());
    box.append(initial);
    if (fx.avatar) {
      const img = el('img');
      img.src = fx.avatar;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.onerror = () => img.remove();
      box.append(img);
    }
    return box;
  }

  function play(fx) {
    busy = true;
    const m = Number(fx.milestone) || 100;
    const tier = m >= 1000 ? 'legend' : m >= 500 ? 'rainbow' : 'gold';
    const layer = el('div', `celebrate cb-${tier}`);
    const canvas = el('canvas', 'cb-fx');
    canvas.width = 1080;
    canvas.height = 1920;
    const rain = el('div', 'cb-rain');
    for (let i = 0; i < (tier === 'gold' ? 24 : 36); i += 1) {
      const d = el('span', '', ['💎', '💎', '✨', '🪙', tier === 'legend' ? '👑' : '💖'][i % 5]);
      d.style.left = `${4 + Math.random() * 92}%`;
      d.style.fontSize = `${38 + Math.random() * 46}px`;
      d.style.animationDelay = `${0.4 + Math.random() * 3.2}s`;
      d.style.animationDuration = `${2.4 + Math.random() * 2}s`;
      rain.append(d);
    }
    const card = el('div', 'cb-card');
    const look = LOOK[tier];
    // khung danh hiệu (ảnh thật) + chữ trong lòng khung
    const kicker = el('div', 'cb-kicker');
    kicker.style.backgroundImage = `url('${ART}${look.frame}')`;
    const ktext = el('div', 'cb-ktext');
    ktext.append(el('b', '', tier === 'legend' ? 'HUYỀN THOẠI' : tier === 'rainbow' ? 'SIÊU ỦNG HỘ' : `MỐC ${m} 💎`),
      el('small', '', tier === 'gold' ? 'ỦNG HỘ KÊNH' : `${m.toLocaleString('vi-VN')} 💎`));
    kicker.append(ktext);
    const wings = el('div', 'cb-wings');
    wings.style.backgroundImage = `url('${ART}${look.wings}')`;
    const avatar = avatarNode(fx);
    if (look.crown) avatar.append(el('span', 'cb-crown', '👑'));
    const amount = el('div', 'cb-amount');
    const num = el('span', 'num', '0');
    amount.append(num, el('span', 'gem', ' 💎'));
    card.append(kicker, wings, avatar, el('div', 'cb-name', fx.nickname || 'Bạn'), amount, el('div', 'cb-thanks', 'CẢM ƠN BẠN ĐÃ ỦNG HỘ KÊNH! ❤️'));
    layer.append(el('div', 'cb-flash'), el('div', 'cb-rays'), el('div', 'cb-ring'), el('div', 'cb-ring r2'), canvas, rain, card);
    root.append(layer);
    // chữ dài → thu nhỏ cho vừa lòng khung (như khung danh hiệu Sàn Nhảy)
    for (const [node, max, min] of [[ktext.firstChild, 52, 26], [ktext.lastChild, 26, 16]]) {
      let size = max;
      node.style.fontSize = `${size}px`;
      while (node.scrollWidth > ktext.clientWidth && size > min) node.style.fontSize = `${(size -= 2)}px`;
    }
    root.classList.remove('cb-shake');
    void root.offsetWidth;
    root.classList.add('cb-shake');

    // số 💎 đếm lên tới mốc
    const t0 = performance.now();
    const count = () => {
      const k = Math.min(1, (performance.now() - t0 - 500) / 1500);
      num.textContent = Math.max(0, Math.round(m * (1 - (1 - Math.max(0, k)) ** 3))).toLocaleString('vi-VN');
      if (k < 1) requestAnimationFrame(count);
    };
    requestAnimationFrame(count);
    fireworks(canvas, PALETTES[tier], tier === 'legend' ? 18 : tier === 'rainbow' ? 13 : 9);

    audio.duck?.(0.2, 7);
    audio.play?.('airhorn');
    setTimeout(() => audio.play?.('fanfare'), 450);
    audio.speak?.(`Quá đỉnh! Cảm ơn ${speakableName(fx.nickname)} đã ủng hộ ${m} kim cương!`, 'story');

    setTimeout(() => layer.classList.add('out'), SHOW_MS - OUT_MS);
    setTimeout(() => {
      layer.remove();
      root.classList.remove('cb-shake');
      busy = false;
      next();
    }, SHOW_MS);
  }

  function next() {
    if (busy || !queue.length) return;
    play(queue.shift());
  }

  return {
    show(fx) {
      // cùng một người còn đang chờ → chỉ giữ mốc cao nhất
      const waiting = queue.find((q) => q.userId === fx.userId);
      if (waiting) Object.assign(waiting, fx, { milestone: Math.max(waiting.milestone, fx.milestone) });
      else if (queue.length < 5) queue.push({ ...fx });
      next();
    }
  };
}
