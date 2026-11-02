// Đám đông nhân vật dùng chung cho Quán Bar và Chùa: mỗi người xem một nhân vật có nhãn tên.
// - Người còn trong hàng chờ chào mừng: nhân vật đứng ngoài cửa (ẩn), tới lượt được chào mới bước vào,
//   để khoảnh khắc được gọi tên trùng đúng lúc họ xuất hiện.
// - Được chào mà không còn chỗ (quán/chánh điện đầy người đang tương tác): vẫn có một nhân vật
//   "khách ghé" mang tên họ bước vào chào rồi rời đi.
import * as THREE from '/vendor/three/three.module.js';
import { disposeObject, walkTowards } from './person-model.js';

const REVEAL_FALLBACK_S = 45; // hàng chờ bị xoá giữa chừng thì cũng không giữ ai ngoài cửa mãi

/**
 * @param {object} o
 * @param {THREE.Scene} o.scene
 * @param {object} o.labels
 * @param {(id:string)=>object} o.build        tạo model (buildPerson…)
 * @param {(info:object)=>THREE.Vector3} o.place  chỗ đứng/ngồi của người có chỗ
 * @param {(index:number, count:number)=>THREE.Vector3} o.entrance  cửa vào (index/count để đoàn đi so le)
 * @param {(index:number, count:number)=>THREE.Vector3} o.visitSpot  chỗ "khách ghé" đứng chào khi hết chỗ
 * @param {(model, info, t:number, walking:boolean)=>void} o.pose
 * @param {(info:object)=>object} o.labelFor   tuỳ chọn nhãn (vip, small, offsetY…)
 */
export function createCrowd({ scene, labels, build, place, entrance, visitSpot, pose, labelFor, facing = 0, speed = 3 }) {
  const members = new Map();
  let clock = 0;

  function add(id, info, { hidden, transient = false, index = 0 }) {
    const model = build(id);
    model.root.position.copy(entrance(index));
    model.root.visible = !hidden;
    scene.add(model.root);
    const entry = { id, model, info, hidden, transient, born: clock, index };
    members.set(id, entry);
    return entry;
  }

  function remove(id) {
    const entry = members.get(id);
    if (!entry) return;
    scene.remove(entry.model.root);
    disposeObject(entry.model.root);
    members.delete(id);
    labels.remove(id);
  }

  return {
    get: (id) => members.get(id),
    /** list: người có chỗ theo server; pending: Set id đang chờ được chào. */
    sync(list, pending) {
      const ids = new Set(list.map((info) => info.id));
      for (const [id, entry] of members) {
        if (!entry.transient && !ids.has(id) && !entry.leaving) entry.leaving = clock;
      }
      list.forEach((info, i) => {
        let entry = members.get(info.id);
        if (entry?.transient) {
          entry.transient = false; // khách ghé vừa có chỗ thật: giữ nguyên nhân vật
          entry.leaving = 0;
        }
        if (!entry) entry = add(info.id, info, { hidden: pending.has(info.id), index: i });
        entry.info = info;
        entry.target = place(info);
        labels.sync(info.id, { anchor: entry.model.head, nickname: info.nickname, avatar: info.avatar, ...labelFor(info) });
      });
    },
    /** Đến lượt chào: cho những người này bước vào. Trả về các entry để cảnh thêm hiệu ứng. */
    welcome(people) {
      const count = people.length;
      return people.map((person, i) => {
        let entry = members.get(person.userId);
        if (!entry) {
          const info = { id: person.userId, nickname: person.nickname, avatar: person.avatar };
          entry = add(person.userId, info, { hidden: false, transient: true, index: i });
          entry.model.root.position.copy(entrance(i, count));
          entry.target = visitSpot(i, count);
          entry.until = clock + 6 + Math.floor(i / 6) * 0.6; // hàng sau tới muộn hơn nên ở lâu hơn
          labels.sync(person.userId, { anchor: entry.model.head, nickname: person.nickname, avatar: person.avatar, offsetY: 0.5, small: count > 1 });
        }
        if (entry.hidden) {
          entry.hidden = false;
          entry.model.root.visible = true;
          entry.model.root.position.copy(entrance(i, count));
        }
        return entry;
      });
    },
    frame(dt, t) {
      clock = t;
      for (const [id, entry] of members) {
        const { root } = entry.model;
        if (entry.hidden) {
          if (t - entry.born > REVEAL_FALLBACK_S) {
            entry.hidden = false;
            root.visible = true;
          }
          continue;
        }
        if (entry.transient && t > entry.until && !entry.leaving) entry.leaving = t;
        if (entry.leaving) {
          root.scale.multiplyScalar(0.9);
          if (t - entry.leaving > 0.6) remove(id);
          continue;
        }
        root.scale.setScalar(Math.min(1, root.scale.x + dt * 3));
        const walking = walkTowards(root, entry.target, dt, { speed, facing });
        pose(entry.model, entry.info, t, walking);
      }
    },
    /** Nhãn của nhân vật ẩn (còn ngoài cửa) không được hiện. */
    isHidden: (id) => Boolean(members.get(id)?.hidden),
    clear() {
      for (const id of [...members.keys()]) remove(id);
    }
  };
}

// Cửa hông hai bên (ngoài khung hình) cho cả đoàn: chẵn bên trái, lẻ bên phải, xếp hàng chờ ra ngoài.
// Đi vào từ sát camera thì nhân vật phóng to che kín màn hình khi đoàn đông.
export function sideDoorSpot(index, { x, z, dz = 0.9, depth = 6 }) {
  const side = index % 2 ? 1 : -1;
  const k = Math.floor(index / 2);
  return new THREE.Vector3(side * (x + Math.floor(k / depth) * 0.9), 0, z + (k % depth) * dz);
}

// Xếp người theo lưới căn giữa quanh base: hàng đầu ở base.z, các hàng sau lùi thêm dz.
export function gridSpot(base, index, count, { maxCols, dx, dz }) {
  const cols = Math.max(1, Math.min(maxCols, count));
  return new THREE.Vector3(base.x + ((index % cols) - (cols - 1) / 2) * dx, base.y, base.z + Math.floor(index / cols) * dz);
}
