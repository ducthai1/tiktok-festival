// Phần chữ 2D phủ trên cảnh 3D: tiêu đề, chỉ số, bảng xếp hạng, thông báo, chú thích quà.
import { avatarNode } from './stage-labels.js';

const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function formatNumber(n) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n || 0));
}

const LEGEND_PAGE_MS = 7000; // bảng Cách tham gia lật trang mỗi 7 giây
let legendTimer = 0;

export function createHud() {
  const toastRoot = $('toasts');
  const combos = new Map(); // key → { node, text, total, timer }
  let bannerTimer = 0;
  let lastBoardKey = '';
  let boardScores = new Map();

  return {
    el,
    gameRoot: $('game-hud'),
    setTitle(text) {
      $('title').textContent = text;
    },
    // chips: [{text}] — các ô chỉ số góc phải trên
    setStats(chips) {
      const root = $('stats');
      root.replaceChildren(...chips.map((c) => el('div', 'chip', c)));
    },
    // rows: [{id, nickname, avatar, score}] — chỉ vẽ lại khi dữ liệu đổi
    setBoard(heading, rows) {
      const key = heading + JSON.stringify(rows);
      if (key === lastBoardKey) return;
      lastBoardKey = key;
      const root = $('board');
      if (!rows.length) return root.replaceChildren();
      const list = el('ol');
      rows.forEach((row, i) => {
        const li = el('li');
        li.append(el('span', 'rank', String(i + 1)), avatarNode(row.avatar), el('span', 'name', row.nickname), el('span', 'score', row.score));
        if (boardScores.has(row.id) && boardScores.get(row.id) !== row.score) li.classList.add('bump'); // điểm vừa tăng: loé sáng
        list.append(li);
      });
      boardScores = new Map(rows.map((row) => [row.id, row.score]));
      root.replaceChildren(el('h3', '', heading), list);
    },
    setHint(parts) {
      // parts: mảng chuỗi; chuỗi bọc trong *...* được tô vàng
      const root = $('hint');
      root.replaceChildren(...parts.map((p) => (p.startsWith('*') ? el('b', '', p.slice(1, -1)) : document.createTextNode(p))));
    },
    // items: [[khoá, chữ]]; khoá là chuỗi ('❤', 'Follow') hoặc danh sách quà [{image, emoji, name}] → hiện ảnh quà
    setLegend(items, visible) {
      const root = $('legend');
      root.classList.toggle('off', !visible);
      const row = ([key, value]) => {
        const item = el('div', 'item');
        const em = el('em', Array.isArray(key) ? 'gifts' : '');
        if (Array.isArray(key)) {
          for (const g of key) {
            if (g.image) {
              const img = document.createElement('img');
              img.src = g.image;
              img.alt = g.name;
              img.referrerPolicy = 'no-referrer';
              em.append(img);
            } else em.append(el('span', '', g.emoji || '🎁'));
          }
        } else em.textContent = key;
        item.append(em, document.createTextNode(value));
        return item;
      };
      // Bảng gọn để không che tượng Phật: 2 trang tự lật — MIỄN PHÍ (bình luận, tim, follow) và QUÀ (dòng 🎁 + các bậc quà)
      const isGift = ([key]) => Array.isArray(key) || String(key).startsWith('🎁');
      const pages = [items.filter((it) => !isGift(it)), items.filter(isGift)].filter((p) => p.length);
      clearInterval(legendTimer);
      root.replaceChildren(...pages.map((p, i) => {
        const page = el('div', `page${i === 0 ? ' on' : ''}`);
        page.append(...p.map(row));
        return page;
      }));
      const howto = $('howto');
      howto.classList.remove('gifts-page');
      // thông báo quà bám sát ngay dưới đáy bảng Cách tham gia (bảng giữ chiều cao của trang dài nhất nên không nhảy)
      const placeToasts = () => {
        if (howto.offsetHeight) toastRoot.style.top = `${howto.offsetTop + howto.offsetHeight + 8}px`;
      };
      requestAnimationFrame(placeToasts);
      document.fonts?.ready.then(placeToasts);
      if (pages.length > 1) {
        let at = 0;
        legendTimer = setInterval(() => {
          at = (at + 1) % pages.length;
          [...root.children].forEach((page, i) => page.classList.toggle('on', i === at));
          howto.classList.toggle('gifts-page', at === pages.length - 1);
        }, LEGEND_PAGE_MS);
      }
    },
    /**
     * Thông báo cộng dồn: cùng key (vd cùng người + cùng quà) thì sửa dòng đang hiện (×1 → ×2 → ×3) và
     * nảy nhẹ, thay vì thêm dòng mới mỗi lần. render(total) trả chữ cho tổng hiện tại.
     */
    comboToast(key, add, render, { gold = false, image = '', ms = 4200 } = {}) {
      let combo = combos.get(key);
      if (combo && combo.node.isConnected && !combo.node.classList.contains('out')) {
        combo.total += add;
        combo.text.textContent = render(combo.total);
        combo.node.classList.remove('bump');
        void combo.node.offsetWidth; // chạy lại hiệu ứng nảy
        combo.node.classList.add('bump');
        clearTimeout(combo.timer);
      } else {
        const node = el('div', `toast${gold ? ' gold' : ''}`);
        if (image) node.append(avatarNode(image));
        const text = document.createTextNode(render(add));
        node.append(text);
        toastRoot.prepend(node);
        while (toastRoot.children.length > 4) toastRoot.lastChild.remove();
        combo = { node, text, total: add };
        combos.set(key, combo);
      }
      const { node } = combo;
      combo.timer = setTimeout(() => {
        node.classList.add('out');
        setTimeout(() => node.remove(), 400);
        if (combos.get(key) === combo) combos.delete(key);
      }, ms);
    },
    toast(text, { gold = false, image = '', ms = 4200 } = {}) {
      const node = el('div', `toast${gold ? ' gold' : ''}`);
      if (image) node.append(avatarNode(image));
      node.append(document.createTextNode(text));
      toastRoot.prepend(node);
      while (toastRoot.children.length > 4) toastRoot.lastChild.remove();
      setTimeout(() => {
        node.classList.add('out'); // mờ dần rồi mới gỡ, không biến mất đột ngột
        setTimeout(() => node.remove(), 400);
      }, ms);
    },
    banner(text, sub = '', ms = 3200) {
      const root = $('banner');
      root.replaceChildren(document.createTextNode(text));
      if (sub) root.append(el('small', '', sub));
      root.classList.add('show');
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => root.classList.remove('show'), ms);
    },
    showFortune(f) {
      const root = $('fortune');
      root.querySelector('.fortune-rank').textContent = `Quẻ số ${f.number} · ${f.rank}`;
      root.querySelector('.fortune-title').textContent = f.title;
      root.querySelector('.fortune-who').textContent = `Người xin quẻ: ${f.nickname}`;
      root.querySelector('.fortune-poem').replaceChildren(...f.poem.flatMap((line, i) => (i ? [el('br'), line] : [line])));
      root.querySelector('.fortune-meaning').textContent = `Lời bàn: ${f.meaning}`;
      root.hidden = false;
      clearTimeout(root.timer);
      root.timer = setTimeout(() => { root.hidden = true; }, f.durationMs || 10000);
    },
    // Thẻ chào một người (mode full) hoặc cả đoàn (mode group). Thẻ mới thay thẻ cũ.
    welcome(fx, line) {
      const root = $('welcome');
      const group = fx.mode === 'group';
      const people = group ? fx.people : [fx];
      root.className = group ? 'group' : '';
      root.getAnimations?.().forEach((a) => a.cancel());
      const shown = people.slice(0, group ? 18 : 1);
      const avatars = shown.map((p, i) => {
        const node = avatarNode(p.avatar);
        node.style.setProperty('--i', String(i)); // xuất hiện lần lượt
        return node;
      });
      if (people.length > shown.length) avatars.push(el('div', 'ava more', `+${people.length - shown.length}`));
      root.querySelector('.welcome-avatars').replaceChildren(...avatars);
      root.querySelector('.kicker').textContent = group ? `🎉 CHÀO MỪNG ${people.length} BẠN MỚI` : '👋 CHÀO MỪNG';
      root.querySelector('.name').textContent = group ? people.map((p) => p.nickname).join(' · ') : fx.nickname;
      root.querySelector('.line').textContent = line || 'vừa vào phòng!';
      root.hidden = false;
      void root.offsetWidth; // chạy lại hiệu ứng xuất hiện cho thẻ kế tiếp
      root.classList.add('show');
      clearTimeout(root.timer);
      root.timer = setTimeout(() => {
        root.classList.replace('show', 'hide');
        root.timer = setTimeout(() => { root.hidden = true; }, 320);
      }, Math.max(1200, (fx.durationMs || 2600) - 300));
    },
    // Phòng quá đông: mỗi người mới một dòng chữ nhỏ bên phải.
    welcomeLine(nickname) {
      const root = $('welcome-ticker');
      const line = el('div', 'ticker-line', `👋 ${nickname} vừa vào`);
      root.prepend(line);
      while (root.children.length > 5) root.lastChild.remove();
      setTimeout(() => line.remove(), 4500);
    },
    hideFortune() {
      $('fortune').hidden = true;
    },
    setTestMode(on) {
      $('test-badge').hidden = !on;
    },
    setOffline(on) {
      $('offline').hidden = !on;
    },
    clearGame() {
      this.gameRoot.replaceChildren();
      toastRoot.replaceChildren();
      for (const c of combos.values()) clearTimeout(c.timer);
      combos.clear();
      $('banner').classList.remove('show');
      this.hideFortune();
      $('welcome').hidden = true;
      $('welcome-ticker').replaceChildren();
      lastBoardKey = '';
    }
  };
}

// Thanh tiến trình dùng chung: trả về hàm cập nhật.
export function createMeter(hud, { label, className = '' }) {
  const root = hud.el('div', `meter ${className}`);
  const row = hud.el('div', 'row');
  const left = hud.el('span', '', label);
  const right = hud.el('span');
  const bar = hud.el('div', 'bar');
  const fill = hud.el('div', 'fill');
  bar.append(fill);
  row.append(left, right);
  root.append(row, bar);
  hud.gameRoot.append(root);
  return {
    root,
    bar,
    update(ratio, rightText, leftText) {
      fill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
      right.textContent = rightText;
      if (leftText !== undefined) left.textContent = leftText;
    }
  };
}
