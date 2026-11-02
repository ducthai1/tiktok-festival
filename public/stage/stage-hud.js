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

export function createHud() {
  const toastRoot = $('toasts');
  let bannerTimer = 0;
  let lastBoardKey = '';

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
        list.append(li);
      });
      root.replaceChildren(el('h3', '', heading), list);
    },
    setHint(parts) {
      // parts: mảng chuỗi; chuỗi bọc trong *...* được tô vàng
      const root = $('hint');
      root.replaceChildren(...parts.map((p) => (p.startsWith('*') ? el('b', '', p.slice(1, -1)) : document.createTextNode(p))));
    },
    setLegend(items, visible) {
      const root = $('legend');
      root.classList.toggle('off', !visible);
      root.replaceChildren(...items.map(([key, value]) => {
        const item = el('div', 'item');
        item.append(el('em', '', key), document.createTextNode(value));
        return item;
      }));
    },
    toast(text, { gold = false, image = '', ms = 4200 } = {}) {
      const node = el('div', `toast${gold ? ' gold' : ''}`);
      if (image) node.append(avatarNode(image));
      node.append(document.createTextNode(text));
      toastRoot.prepend(node);
      while (toastRoot.children.length > 4) toastRoot.lastChild.remove();
      setTimeout(() => node.remove(), ms);
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
      $('banner').classList.remove('show');
      this.hideFortune();
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
