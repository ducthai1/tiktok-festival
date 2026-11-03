// Đám đông nhân vật dùng chung cho Quán Bar và Chùa: mỗi người xem một nhân vật có nhãn tên.
// - Người còn trong hàng chờ chào mừng: nhân vật đứng ngoài cửa (ẩn), tới lượt được chào mới bước vào,
//   để khoảnh khắc được gọi tên trùng đúng lúc họ xuất hiện.
// - Được chào mà không còn chỗ (quán/chánh điện đầy người đang tương tác): vẫn có một nhân vật
//   "khách ghé" mang tên họ bước vào chào rồi rời đi.
import * as THREE from '/vendor/three/three.module.js';
import { animatePerson, disposeObject, walkTowards } from './person-model.js';

const hold = new THREE.Vector3();

const REVEAL_FALLBACK_S = 45; // hàng chờ bị xoá giữa chừng thì cũng không giữ ai ngoài cửa mãi
const EXIT_TIMEOUT_S = 12; // người đi ra mà kẹt (vd đang ngoài khung) thì tối đa chừng này giây

/**
 * @param {object} o
 * @param {THREE.Scene} o.scene
 * @param {object} o.labels
 * @param {(id:string)=>object} o.build        tạo model (buildPerson…)
 * @param {(info:object)=>THREE.Vector3} o.place  chỗ đứng/ngồi của người có chỗ
 * @param {(index:number, count:number)=>THREE.Vector3} o.entrance  cửa vào (index/count để đoàn đi so le)
 * @param {(index:number, count:number)=>THREE.Vector3} o.visitSpot  chỗ "khách ghé" đứng chào khi hết chỗ
 * @param {(model, info, t:number, walking:boolean, dt:number)=>void} o.pose
 * @param {(info:object)=>object} o.labelFor   tuỳ chọn nhãn (vip, small, offsetY…)
 * @param {(entry:object)=>THREE.Vector3} [o.exit]  có thì người rời đi bước ra chỗ này rồi mới biến mất
 */
export function createCrowd({ scene, labels, build, place, entrance, visitSpot, pose, labelFor, exit, facing = 0, speed = 3 }) {
  const members = new Map();
  const deferred = new Map(); // nghi thức chờ nhân vật vào xong (người mới vừa vào đã thắp hương ngay)
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

  // Kịch bản diễn của một nhân vật: [{walk: Vector3, facing}, {pose, seconds, facing, onTick}, {run: fn}].
  // Diễn xong thì tự đi về chỗ của mình và quay lại tư thế thường.
  function runScript(entry, dt, t) {
    const step = entry.script[0];
    const { root } = entry.model;
    const next = () => {
      entry.script.shift();
      entry.stepStart = t;
    };
    if (step.run) {
      step.run(entry);
      return next();
    }
    if (step.walk) {
      const walking = walkTowards(root, step.walk, dt, { speed: step.speed || speed * 0.8, facing: step.facing ?? facing });
      animatePerson(entry.model, walking ? 'walk' : step.pose || 'idle', t, dt);
      if (!walking && Math.abs(Math.sin((root.rotation.y - (step.facing ?? facing)) / 2)) < 0.05) next();
      return undefined;
    }
    hold.copy(root.position);
    walkTowards(root, hold, dt, { facing: step.facing ?? root.rotation.y });
    const elapsed = t - entry.stepStart;
    animatePerson(entry.model, step.pose, t, dt, false, elapsed);
    step.onTick?.(entry, elapsed, dt);
    if (elapsed >= step.seconds) next();
    return undefined;
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
    /**
     * Cho một người diễn một chuỗi động tác. Nhân vật chưa có / còn đứng ngoài cửa thì chờ tối đa
     * waitSeconds rồi mới diễn; quá hạn thì gọi fallback (chỉ hiện kết quả, không có người diễn).
     */
    perform(id, steps, { fallback, waitSeconds = 15 } = {}) {
      const entry = members.get(id);
      if (entry && !entry.hidden && !entry.leaving) {
        entry.script = steps.slice();
        entry.stepStart = clock;
        return;
      }
      const previous = deferred.get(id);
      if (previous) previous.fallback?.();
      deferred.set(id, { steps, fallback, deadline: clock + waitSeconds });
    },
    busy: (id) => Boolean(members.get(id)?.script?.length),
    all: () => [...members.values()],
    /** list: người có chỗ theo server; pending: Set id đang chờ được chào. */
    sync(list, pending) {
      const ids = new Set(list.map((info) => info.id));
      for (const [id, entry] of members) {
        if (!entry.transient && !ids.has(id) && !entry.leaving) entry.leaving = clock;
      }
      list.forEach((info, i) => {
        let entry = members.get(info.id);
        if (entry?.leaving && !entry.transient) {
          entry.leaving = 0; // đang đi ra mà được chỗ lại: quay về chỗ
          entry.exitTo = null;
        }
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
      for (const [id, job] of deferred) {
        const entry = members.get(id);
        if (entry && !entry.hidden && !entry.leaving) {
          deferred.delete(id);
          entry.script = job.steps.slice();
          entry.stepStart = t;
        } else if (t > job.deadline) {
          deferred.delete(id);
          job.fallback?.();
        }
      }
      for (const [id, entry] of members) {
        const { root } = entry.model;
        if (entry.hidden) {
          if (t - entry.born > REVEAL_FALLBACK_S) {
            entry.hidden = false;
            root.visible = true;
          }
          continue;
        }
        if (entry.script?.length) {
          runScript(entry, dt, t);
          continue;
        }
        if (entry.transient && t > entry.until && !entry.leaving) entry.leaving = t;
        if (entry.leaving) {
          if (exit) {
            // đứng dậy đi ra cửa hông; tới nơi (ngoài khung hình) hoặc quá lâu thì mới xoá
            entry.exitTo ||= exit(entry);
            const walking = walkTowards(root, entry.exitTo, dt, { speed: speed * 0.8, facing });
            pose(entry.model, entry.info, t, walking, dt);
            if (!walking || t - entry.leaving > EXIT_TIMEOUT_S) remove(id);
          } else {
            root.scale.multiplyScalar(0.9);
            if (t - entry.leaving > 0.6) remove(id);
          }
          continue;
        }
        root.scale.setScalar(Math.min(1, root.scale.x + dt * 3));
        const walking = walkTowards(root, entry.target, dt, { speed, facing });
        pose(entry.model, entry.info, t, walking, dt);
      }
    },
    // Cho trình duyệt tự động đo độ mượt: vị trí + độ cao hông của một nhân vật.
    probe(id) {
      const e = members.get(id);
      if (!e) return null;
      const { root, hips } = e.model;
      return { x: root.position.x, y: root.position.y, z: root.position.z, hipsY: hips.position.y, rotY: root.rotation.y, hidden: e.hidden };
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
