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

// Thông báo có tiêu đề (tên người: 1 dòng, dài thì "…") + dòng việc bên dưới; không có tiêu đề thì là một dòng chữ như cũ.
function toastContent(node, title, textNode) {
  if (!title) return node.append(textNode);
  const line = el('span', 'toast-text');
  line.append(textNode);
  const body = el('div', 'toast-body');
  body.append(el('b', 'toast-name', title), line);
  node.append(body);
}

// Bảng Cách tham gia: trang MIỄN PHÍ hiện 9 giây, trang QUÀ 12,5 giây (nhiều dòng hơn, cần đọc lâu hơn)
const FREE_PAGE_MS = 9000;
const GIFT_PAGE_MS = 12500;
const HINT_FADE_MS = 450;
let legendTimer = 0;
let freeHint = null;

/** Bậc thẻ quà theo giá thật món quà (xu): 1 · 2–9 · 10–19 · 20–29 · 30+ */
export const giftCardTier = (coins) => (coins >= 30 ? 5 : coins >= 20 ? 4 : coins >= 10 ? 3 : coins >= 2 ? 2 : 1);
const CARD_MS = [0, 4500, 5000, 5500, 6000, 7000];
const CARD_KICKER = ['', '🎁 ĐỔI ĐỀ', '✨ ĐỔI ĐỀ', '🌟 ĐỔI ĐỀ VIP', '🔥 ĐỔI ĐỀ SIÊU CẤP', '👑 ĐỔI ĐỀ HOÀNG GIA'];

export function createHud() {
  const toastRoot = $('toasts');
  // 🎁 Thẻ quà đổi đề: cùng chỗ thẻ chào người mới, ƯU TIÊN hơn — đang hiện thẻ quà thì lời chào chờ (stage-main.js).
  const cardRoot = document.createElement('section');
  cardRoot.id = 'giftcard';
  cardRoot.hidden = true;
  $('hud').append(cardRoot);
  const cardQueue = [];
  let cardShowing = null; // { key, count, until, timer, node }
  let cardDone = () => {};
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
      freeHint = [...root.childNodes].map((n) => n.cloneNode(true)); // tiêu đề trang MIỄN PHÍ (trang QUÀ tạm đổi chữ)
    },
    // items: [[khoá, chữ]]; khoá là chuỗi ('❤', 'Follow') hoặc danh sách quà [{image, emoji, name}] → hiện ảnh quà
    setLegend(items, visible) {
      const root = $('legend');
      root.classList.toggle('off', !visible);
      // tắt bảng = tắt cả khung "Cách tham gia" (tiêu đề + dòng "Tặng quà → nhận ngay"), không để lại khung rỗng
      $('howto')?.classList.toggle('off', !visible);
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
        // "dòng 1\ndòng 2": hai dòng rõ ràng (vd khoảng kc in đậm + hiệu ứng nhận được), chữ tự xuống dòng không bị cắt
        const lines = String(value).split('\n');
        if (lines.length > 1) {
          const box = el('span', 'txt');
          box.append(el('b', '', lines[0].trim()), el('span', 'fx', lines.slice(1).join(' ').trim()));
          item.append(em, box);
        } else item.append(em, document.createTextNode(value));
        return item;
      };
      // Bảng gọn để không che tượng Phật: 2 trang tự lật — MIỄN PHÍ (bình luận, tim, follow) và QUÀ (các bậc quà).
      // Dòng "🎁 Quà …" không thành một hàng mà làm dòng tiêu đề nhỏ (#hint) của trang QUÀ: hai trang cùng có
      // tiêu đề nên bảng không co giãn khi lật; chuyển trang bằng mờ dần (CSS transition), không bật/tắt đột ngột.
      const isGiftHeader = ([key]) => !Array.isArray(key) && String(key).startsWith('🎁');
      const giftHeader = items.find(isGiftHeader);
      const pages = [items.filter((it) => !Array.isArray(it[0]) && !isGiftHeader(it)), items.filter(([key]) => Array.isArray(key))].filter((p) => p.length);
      clearTimeout(legendTimer);
      root.replaceChildren(...pages.map((p, i) => {
        const page = el('div', `page${i === 0 ? ' on' : ''}`);
        page.append(...p.map(row));
        return page;
      }));
      const howto = $('howto');
      const hint = $('hint');
      if (freeHint) hint.replaceChildren(...freeHint.map((n) => n.cloneNode(true))); // về trang đầu: trả tiêu đề MIỄN PHÍ
      const swapHint = (nodes) => {
        hint.classList.add('swap');
        setTimeout(() => {
          hint.replaceChildren(...nodes);
          hint.classList.remove('swap');
        }, HINT_FADE_MS);
      };
      // thông báo quà bám sát ngay dưới đáy bảng Cách tham gia (bảng giữ chiều cao của trang dài nhất nên không nhảy)
      const placeToasts = () => {
        if (howto.offsetHeight) toastRoot.style.top = `${howto.offsetTop + howto.offsetHeight + 8}px`;
      };
      requestAnimationFrame(placeToasts);
      document.fonts?.ready.then(placeToasts);
      if (pages.length > 1) {
        let at = 0;
        const flip = () => {
          at = (at + 1) % pages.length;
          [...root.children].forEach((page, i) => page.classList.toggle('on', i === at));
          const giftPage = at === pages.length - 1;
          swapHint(giftPage && giftHeader ? [el('b', '', giftHeader[0]), document.createTextNode(giftHeader[1])] : (freeHint || []).map((n) => n.cloneNode(true)));
          legendTimer = setTimeout(flip, giftPage ? GIFT_PAGE_MS : FREE_PAGE_MS);
        };
        legendTimer = setTimeout(flip, FREE_PAGE_MS);
      }
    },
    /**
     * Thông báo cộng dồn: cùng key (vd cùng người + cùng quà) thì sửa dòng đang hiện (×1 → ×2 → ×3) và
     * nảy nhẹ, thay vì thêm dòng mới mỗi lần. render(total) trả chữ cho tổng hiện tại.
     */
    comboToast(key, add, render, { gold = false, image = '', ms = 4200, title = '' } = {}) {
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
        toastContent(node, title, text);
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
    toast(text, { gold = false, image = '', ms = 4200, title = '' } = {}) {
      const node = el('div', `toast${gold ? ' gold' : ''}`);
      if (image) node.append(avatarNode(image));
      toastContent(node, title, document.createTextNode(text));
      toastRoot.prepend(node);
      while (toastRoot.children.length > 4) toastRoot.lastChild.remove();
      setTimeout(() => {
        node.classList.add('out'); // mờ dần rồi mới gỡ, không biến mất đột ngột
        setTimeout(() => node.remove(), 400);
      }, ms);
    },
    /**
     * Thẻ quà đổi bộ đề (đẹp theo bậc giá món quà). card: { nickname, avatar, giftName, giftPicture, coins, count, icon, label, line }.
     * Cùng người + cùng chế độ tặng liên tục (combo) → cộng ×N trên thẻ đang hiện, không bật thẻ mới.
     */
    giftCard(card) {
      const key = `${card.nickname}|${card.label}`;
      if (cardShowing?.key === key) {
        cardShowing.count += card.count || 1;
        cardShowing.node.querySelector('.gc-count').textContent = `×${cardShowing.count}`;
        cardShowing.node.querySelector('.gc-count').classList.remove('bump', 'one');
        void cardShowing.node.offsetWidth;
        cardShowing.node.querySelector('.gc-count').classList.add('bump');
        return;
      }
      const waiting = cardQueue.find((c) => `${c.nickname}|${c.label}` === key);
      if (waiting) waiting.count = (waiting.count || 1) + (card.count || 1);
      else if (cardQueue.length < 6) cardQueue.push({ ...card });
      if (!cardShowing) this.nextGiftCard();
    },
    nextGiftCard() {
      const card = cardQueue.shift();
      if (!card) {
        cardShowing = null;
        cardRoot.hidden = true;
        cardDone();
        return;
      }
      const tier = giftCardTier(card.coins || 0);
      cardRoot.className = `gc-t${tier}`;
      const giftBox = el('div', 'gc-gift');
      if (card.giftPicture) {
        const img = document.createElement('img');
        img.src = card.giftPicture;
        img.alt = '';
        img.referrerPolicy = 'no-referrer';
        giftBox.append(img);
      } else giftBox.append(el('span', 'gc-emoji', '🎁'));
      giftBox.append(el('span', `gc-count${(card.count || 1) > 1 ? '' : ' one'}`, `×${card.count || 1}`));
      const who = el('div', 'gc-ava');
      if (card.avatar) who.append(avatarNode(card.avatar));
      else who.append(el('span', 'initial', ([...String(card.nickname || '?').trim()][0] || '?').toUpperCase()));
      if (tier >= 5) who.append(el('span', 'gc-crown', '👑'));
      const text = el('div', 'gc-text');
      text.append(el('div', 'gc-kicker', CARD_KICKER[tier]), el('div', 'gc-name', card.nickname), el('div', 'gc-line', card.line || ''));
      const target = el('div', 'gc-target');
      target.append(el('span', 'gc-icon', card.icon || '🎁'), el('span', 'gc-label', card.label || ''),
        el('span', 'gc-price', `${card.coins || 1} 💎`));
      const fx = el('div', 'gc-fx');
      for (let i = 0; i < (tier >= 4 ? 10 : tier >= 3 ? 6 : 0); i += 1) {
        const p = el('span', '', tier >= 4 ? (i % 2 ? '🔥' : '✨') : '✨');
        p.style.left = `${6 + i * 9}%`;
        p.style.animationDelay = `${(i % 5) * 0.35}s`;
        fx.append(p);
      }
      cardRoot.replaceChildren(fx, giftBox, who, text, target);
      cardRoot.hidden = false;
      cardRoot.getAnimations?.().forEach((a) => a.cancel());
      void cardRoot.offsetWidth;
      cardRoot.classList.add('show');
      const ms = CARD_MS[tier];
      cardShowing = { key: `${card.nickname}|${card.label}`, count: card.count || 1, node: cardRoot };
      clearTimeout(cardRoot.timer);
      cardRoot.timer = setTimeout(() => {
        cardRoot.classList.replace('show', 'hide');
        cardRoot.timer = setTimeout(() => this.nextGiftCard(), 380);
      }, ms - 380);
    },
    /** true khi đang hiện / còn thẻ quà chờ — lời chào người mới phải đợi. */
    giftCardBusy: () => Boolean(cardShowing) || cardQueue.length > 0,
    onGiftCardsDone(fn) {
      cardDone = fn;
    },
    /** who: { avatar, nickname } — hiện avatar người gây ra (vd người tặng quà đổi bộ đề) phía trên chữ. */
    banner(text, sub = '', ms = 3200, who = null) {
      const root = $('banner');
      root.replaceChildren(document.createTextNode(text));
      if (who) {
        const ring = el('div', 'banner-ava');
        if (who.avatar) ring.append(avatarNode(who.avatar));
        else ring.append(el('span', 'initial', ([...String(who.nickname || '?').trim()][0] || '?').toUpperCase()));
        root.prepend(ring);
      }
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
      cardQueue.length = 0;
      clearTimeout(cardRoot.timer);
      cardShowing = null;
      cardRoot.hidden = true;
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
