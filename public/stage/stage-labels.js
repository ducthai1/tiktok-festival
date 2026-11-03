// Lớp chữ DOM bám theo nhân vật 3D: tên + avatar + bong bóng chat.
// Dùng DOM thay vì vẽ chữ vào WebGL để chữ tiếng Việt/emoji luôn sắc nét.
// Mọi chữ đi qua textContent — không bao giờ innerHTML với dữ liệu người xem.
import * as THREE from '/vendor/three/three.module.js';
import { STAGE_HEIGHT, STAGE_WIDTH } from './stage-render-pipeline.js';

const tmp = new THREE.Vector3();
// Lề hai bên mà TikTok trên điện thoại màn dài cắt mất (khớp --safe-x của stage.css): nhãn của người đang
// trong khung hình được đẩy vào trong lề này; người đã ra khỏi khung (đi ra cửa hông) thì ẩn nhãn.
const SAFE_X = 116;
const LAYOUT_EVERY_MS = 250; // dàn lại nhãn đông người 4 lần/giây (giữ vị trí cũ nếu vẫn ổn để chữ không nhảy)
const MAX_STEPS = 18; // mỗi nhãn được nhích tối đa chừng này nấc lên/xuống để tìm chỗ trống

const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * Dàn nhãn của một nhóm (vd người quỳ trong chùa) để tên hiện ĐỦ mà không đè nhau: nhãn nào chạm nhãn
 * đã đặt thì dời tới chỗ trống gần nhất (lên/xuống từng nấc, lệch ngang tối đa SHIFT_X) trong dải
 * [top, bottom], tránh các vùng cấm (bảng HUD, chuông + mõ) và lề điện thoại cắt. Không còn chỗ thì giữ
 * ngay trên đầu (đè còn hơn mất tên). Thứ tự đặt = thứ tự vào chùa, chỗ cũ còn trống thì giữ nguyên để
 * chữ không nhảy qua lại.
 */
const SHIFT_X = [0, -45, 45, -90, 90, -135, 135];
function layoutGroup(items, { top, bottom, keepOut = [], gap = 3 }) {
  const placed = [];
  for (const it of items) {
    const step = it.h + gap;
    const tries = [[it.label.dx || 0, it.label.dy || 0]];
    for (let k = 0; k <= MAX_STEPS; k += 1) {
      for (const dy of k ? [-k * step, k * step] : [0]) for (const dx of SHIFT_X) tries.push([dx, dy]);
    }
    tries.sort((a, b) => (a === tries[0] ? -1 : b === tries[0] ? 1 : Math.abs(a[1]) + Math.abs(a[0]) * 0.8 - Math.abs(b[1]) - Math.abs(b[0]) * 0.8));
    const boxAt = ([dx, dy]) => {
      const cx = Math.max(SAFE_X + it.w / 2, Math.min(STAGE_WIDTH - SAFE_X - it.w / 2, it.x + dx));
      return { cx, left: cx - it.w / 2, right: cx + it.w / 2, top: it.y + dy - it.h, bottom: it.y + dy };
    };
    const free = tries.find((t) => {
      const box = boxAt(t);
      return box.top >= top && box.bottom <= bottom && !keepOut.some((z) => hit(box, z)) && !placed.some((b) => hit(box, b));
    }) || [0, 0];
    const box = boxAt(free);
    it.label.dx = box.cx - it.x;
    it.label.dy = free[1];
    placed.push(box);
  }
}

export function avatarNode(url) {
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => img.replaceWith(avatarNode('')));
    return img;
  }
  const blank = document.createElement('div');
  blank.className = 'ava';
  return blank;
}

export function createLabelLayer(root) {
  const labels = new Map();
  const floaters = new Set();
  const declutter = new Map(); // nhóm → { top, bottom, keepOut, gap }
  let lastLayout = 0;
  let lastCount = -1;

  function sync(id, { anchor, nickname, avatar = '', vip = false, small = false, offsetY = 0, className = '', group = '' }) {
    let label = labels.get(id);
    if (!label) {
      const el = document.createElement('div');
      el.className = 'label';
      const tag = document.createElement('div');
      tag.className = 'tag';
      const name = document.createElement('span');
      if (avatar !== null) tag.append(avatarNode(avatar)); // avatar=null: nhãn chữ thuần (vd máu tường)
      tag.append(name);
      const lead = document.createElement('i'); // vạch nối nhãn đã nhích về đúng đầu người đó
      lead.className = 'lead';
      tag.append(lead);
      el.append(tag);
      root.append(el);
      label = { el, tag, name, lead, avatar, bubble: null, bubbleUntil: 0, dy: 0, dx: 0 };
      labels.set(id, label);
    }
    if (avatar !== null && label.avatar !== avatar) {
      label.tag.firstChild.replaceWith(avatarNode(avatar));
      label.avatar = avatar;
    }
    label.anchor = anchor;
    label.offsetY = offsetY;
    label.group = group;
    if (label.name.textContent !== nickname) {
      label.name.textContent = nickname;
      label.width = 0; // đo lại bề ngang ở lần vẽ tới
    }
    label.el.classList.toggle('vip', vip);
    label.el.classList.toggle('small', small);
    if (className && !label.el.classList.contains(className)) label.el.classList.add(className);
  }

  function project(object, offsetY, camera) {
    object.getWorldPosition(tmp);
    tmp.y += offsetY;
    tmp.project(camera);
    return { x: (tmp.x * 0.5 + 0.5) * STAGE_WIDTH, y: (-tmp.y * 0.5 + 0.5) * STAGE_HEIGHT, visible: tmp.z < 1 };
  }

  return {
    sync,
    /** Bật dàn nhãn chống đè cho một nhóm (nhãn sync với cùng group). */
    setDeclutter(group, options) {
      declutter.set(group, options);
    },
    remove(id) {
      labels.get(id)?.el.remove();
      labels.delete(id);
    },
    // Làm nổi nhãn một lúc (vd người vừa được chào).
    flash(id, className, ms) {
      const label = labels.get(id);
      if (!label) return;
      label.el.classList.add(className);
      clearTimeout(label.flashTimer);
      label.flashTimer = setTimeout(() => label.el.classList.remove(className), ms);
    },
    keepOnly(ids) {
      for (const id of [...labels.keys()]) if (!ids.has(id)) this.remove(id);
    },
    bubble(id, text, ms = 5000) {
      const label = labels.get(id);
      if (!label) return;
      label.bubble?.remove();
      label.bubble = document.createElement('div');
      label.bubble.className = 'bubble';
      label.bubble.textContent = text;
      label.el.prepend(label.bubble);
      label.bubbleUntil = performance.now() + ms;
      label.width = 0;
    },
    // Chữ bay lên rồi mờ dần (lời khấn, "+80 m"...), bám một điểm 3D.
    float(anchor, text, { ms = 2600, rise = 140, className = '' } = {}) {
      const el = document.createElement('div');
      el.className = `floating-text ${className}`;
      el.textContent = text;
      root.append(el);
      floaters.add({ el, anchor, born: performance.now(), ms, rise });
    },
    render(camera) {
      const now = performance.now();
      for (const label of labels.values()) {
        if (label.bubble && now > label.bubbleUntil) {
          label.bubble.remove();
          label.bubble = null;
          label.width = 0;
        }
        const p = project(label.anchor, label.offsetY, camera);
        const inFrame = p.x >= 0 && p.x <= STAGE_WIDTH;
        label.el.style.display = p.visible && inFrame && shown(label.anchor) ? '' : 'none';
        if (label.el.style.display === 'none') continue;
        label.width ||= label.el.offsetWidth; // đo một lần mỗi khi chữ đổi
        const half = Math.min(label.width / 2, STAGE_WIDTH / 2 - SAFE_X);
        const x = Math.max(SAFE_X + half, Math.min(STAGE_WIDTH - SAFE_X - half, p.x));
        label.x = x;
        label.headX = p.x;
        label.headY = p.y;
      }
      // Dàn nhãn chống đè cho từng nhóm (vài lần mỗi giây, hoặc ngay khi có người vào/ra)
      const groups = new Map();
      for (const label of labels.values()) {
        if (!label.group || !declutter.has(label.group) || label.el.style.display === 'none') continue;
        if (!groups.has(label.group)) groups.set(label.group, []);
        groups.get(label.group).push(label);
      }
      const count = [...groups.values()].reduce((n, list) => n + list.length, 0);
      if (now - lastLayout > LAYOUT_EVERY_MS || count !== lastCount) {
        lastLayout = now;
        lastCount = count;
        // đo lại cỡ chữ mỗi lần dàn (font tải xong muộn thì nhãn rộng ra — đo một lần là đè nhau)
        for (const [group, list] of groups) {
          const items = list.map((label) => ({ label, x: label.x, y: label.headY, w: label.tag.offsetWidth, h: label.tag.offsetHeight }));
          layoutGroup(items, declutter.get(group));
        }
      }
      for (const label of labels.values()) {
        if (label.el.style.display === 'none') continue;
        const grouped = label.group && declutter.has(label.group);
        const dy = grouped ? label.dy : 0;
        const x = label.x + (grouped ? label.dx || 0 : 0);
        label.el.style.transform = `translate(${x}px, ${label.headY + dy}px) translate(-50%, -100%)`;
        const shifted = Math.abs(dy) > 6;
        label.lead.style.display = shifted ? 'block' : 'none';
        if (shifted) {
          label.lead.style.height = `${Math.abs(dy)}px`;
          label.lead.style.left = `calc(50% + ${Math.max(-label.tag.offsetWidth / 2 + 8, Math.min(label.tag.offsetWidth / 2 - 8, label.headX - x))}px)`;
          label.lead.style.top = dy < 0 ? '100%' : 'auto';
          label.lead.style.bottom = dy < 0 ? 'auto' : '100%';
        }
      }
      for (const f of floaters) {
        const k = (now - f.born) / f.ms;
        if (k >= 1) {
          f.el.remove();
          floaters.delete(f);
          continue;
        }
        const p = f.anchor.isVector3 ? projectPoint(f.anchor, camera) : project(f.anchor, 0, camera);
        f.el.style.opacity = String(k < 0.8 ? 1 : (1 - k) * 5);
        f.el.style.transform = `translate(${p.x}px, ${p.y - k * f.rise}px) translate(-50%, -100%)`;
      }
    },
    clear() {
      for (const label of labels.values()) label.el.remove();
      labels.clear();
      for (const f of floaters) f.el.remove();
      floaters.clear();
    }
  };
}

// Nhân vật đang ẩn (vd còn đứng ngoài cửa chờ được chào) thì nhãn cũng ẩn.
function shown(object) {
  for (let node = object; node; node = node.parent) if (!node.visible) return false;
  return true;
}

function projectPoint(point, camera) {
  tmp.copy(point).project(camera);
  return { x: (tmp.x * 0.5 + 0.5) * STAGE_WIDTH, y: (-tmp.y * 0.5 + 0.5) * STAGE_HEIGHT };
}
