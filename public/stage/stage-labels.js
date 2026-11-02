// Lớp chữ DOM bám theo nhân vật 3D: tên + avatar + bong bóng chat.
// Dùng DOM thay vì vẽ chữ vào WebGL để chữ tiếng Việt/emoji luôn sắc nét.
// Mọi chữ đi qua textContent — không bao giờ innerHTML với dữ liệu người xem.
import * as THREE from '/vendor/three/three.module.js';
import { STAGE_HEIGHT, STAGE_WIDTH } from './stage-render-pipeline.js';

const tmp = new THREE.Vector3();

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

  function sync(id, { anchor, nickname, avatar = '', vip = false, small = false, offsetY = 0, className = '' }) {
    let label = labels.get(id);
    if (!label) {
      const el = document.createElement('div');
      el.className = 'label';
      const tag = document.createElement('div');
      tag.className = 'tag';
      const name = document.createElement('span');
      if (avatar !== null) tag.append(avatarNode(avatar)); // avatar=null: nhãn chữ thuần (vd máu tường)
      tag.append(name);
      el.append(tag);
      root.append(el);
      label = { el, tag, name, avatar, bubble: null, bubbleUntil: 0 };
      labels.set(id, label);
    }
    if (avatar !== null && label.avatar !== avatar) {
      label.tag.firstChild.replaceWith(avatarNode(avatar));
      label.avatar = avatar;
    }
    label.anchor = anchor;
    label.offsetY = offsetY;
    if (label.name.textContent !== nickname) label.name.textContent = nickname;
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
    remove(id) {
      labels.get(id)?.el.remove();
      labels.delete(id);
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
        }
        const p = project(label.anchor, label.offsetY, camera);
        label.el.style.display = p.visible ? '' : 'none';
        label.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
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

function projectPoint(point, camera) {
  tmp.copy(point).project(camera);
  return { x: (tmp.x * 0.5 + 0.5) * STAGE_WIDTH, y: (-tmp.y * 0.5 + 0.5) * STAGE_HEIGHT };
}
