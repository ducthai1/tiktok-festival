// Cảnh CHÙA ONLINE: tranh chánh điện vẽ tay làm nền, Phật tử (người xem) là nhân vật vẽ tay quỳ trên
// bồ đoàn theo hàng, quay lưng về camera hướng lên bàn thờ. Mỗi tương tác là một nghi thức có diễn
// biến riêng (temple-rituals.js); quà càng lớn lễ càng trang trọng. Đơn vị: mét (temple-view.js).
import * as THREE from '/vendor/three/three.module.js';
import { formatNumber } from '../stage-hud.js';
import { createCrowd, gridSpot, sideDoorSpot } from './crowd-characters.js';
import { createParticleSystem } from './particle-effects.js';
import { animatePerson, disposeObject } from './person-model.js';
import { buildDevotee } from './temple-devotee-sprite.js';
import { addCushion, animatePaintedHall, buildPaintedHall } from './temple-painted-hall.js';
import { lotus } from './temple-props.js';
import { createTempleRituals } from './temple-rituals.js';
import { createTempleCamera, setZoom } from './temple-view.js';
import { createBellAndMo } from './temple-bell-and-mo.js';
import { giftLabels } from './temple-wishes.js';
import { LABEL_KEEP_OUT, TEMPLE_SEATS, VIP_SEATS } from '/static/shared/temple-seats.js';

// Chỗ quỳ: tính sẵn ở /static/shared/temple-seats.js để người + nhãn tên luôn trong vùng điện thoại thấy được
// (6 chỗ đầu sát bàn thờ là của 6 người nhiều tâm thành nhất), chừa lối giữa theo thảm đỏ.
const SLOTS = TEMPLE_SEATS.map((seat) => new THREE.Vector3(seat.x, 0, seat.z));
const EXIT_X = 3.6; // m: cửa hông hai bên, ngoài khung hình ở mọi độ sâu có chỗ quỳ
const PETALS = ['#c2416f', '#d9668f', '#e0a840', '#b85a7a'];

export function createTempleScene({ hud, labels, audio, pipeline }) {
  const scene = new THREE.Scene();
  const camera = createTempleCamera();
  const hall = buildPaintedHall(scene, camera);
  const particles = createParticleSystem(scene, 5000); // tia sáng, bụi vàng (cộng sáng)
  const soft = createParticleSystem(scene, 3000, { blending: THREE.NormalBlending }); // cánh hoa, khói hương: không cộng thành mảng chói
  const fixtures = createBellAndMo(scene);
  pipeline.setBloom({ strength: 0.3, radius: 0.45, threshold: 0.9 });
  const seats = SLOTS.map((p, i) => ({ x: p.x, z: p.z, top: addCushion(scene, p, i < VIP_SEATS) }));

  const bowUntil = new Map();
  const lanterns = [];
  let clock = 0;
  let lastMoSound = 0;
  let lastMoFloat = 0;
  let haloUntil = 0;
  let bowAll = { pose: 'bow', start: 0, until: 0 };

  // tên người quỳ hiện ĐỦ: nhãn chạm nhau thì tự nhích lên/xuống, không đè bảng Cách tham gia hay chuông + mõ
  labels.setDeclutter('crowd', { top: 860, bottom: 1520, keepOut: LABEL_KEEP_OUT, gap: 3 });
  hud.setTitle('🪷 CHÙA ONLINE');
  hud.setHint(['*MIỄN PHÍ*', ' — bình luận ↓']);

  // Phật tử vào chánh điện rồi đi lên chỗ quỳ, mặt hướng về bàn thờ.
  const crowd = createCrowd({
    scene,
    labels,
    build: (id) => buildDevotee({ id }),
    place: (info) => SLOTS[info.slot] || SLOTS[SLOTS.length - 1],
    // 1 người: từ cổng (dưới khung hình) đi dọc thảm đỏ; cả đoàn: vào từ hai cửa hông ngoài khung
    entrance: (i, count) => (count <= 1 ? new THREE.Vector3(0, 0, -1.9) : sideDoorSpot(i, { x: 3.4, z: -5.2, dz: -0.55 })),
    visitSpot: (i, count) => gridSpot(new THREE.Vector3(0, 0, -8.3), i, count, { maxCols: 3, dx: 0.4, dz: 0.6 }),
    pose: (model, info, t, walking, dt) => {
      model.seat = seats[info.slot] || null;
      model.labelLift = TEMPLE_SEATS[info.slot]?.lift ?? 0.06; // độ cao nhãn đã chọn sẵn để tên không đè nhau
      if (walking) return animatePerson(model, 'walk', t, dt);
      if (t < bowAll.until) return animatePerson(model, bowAll.pose, t, dt, false, t - bowAll.start); // cả chánh điện lạy cùng nhịp
      return animatePerson(model, t < (bowUntil.get(info.id) || 0) ? 'bow' : 'kneel', t, dt);
    },
    // Nhãn so le cao/thấp để hàng quỳ sát nhau không đè chữ lên nhau.
    labelFor: (info) => ({ vip: info.vip, small: true, group: 'crowd' }),
    // Người rời chánh điện (lâu không tương tác / nhường chỗ khi đầy) đứng dậy đi ra cửa hông phía mình.
    exit: (entry) => new THREE.Vector3(Math.sign(entry.model.root.position.x || 1) * EXIT_X, 0, entry.model.root.position.z),
    facing: Math.PI,
    speed: 2 // m/s; nghi thức đi 80% tốc độ này
  });

  const bowOne = (userId, seconds) => bowUntil.set(userId, clock + seconds);
  const headAt = new THREE.Vector3();
  function prayerLight(userId) {
    const entry = crowd.get(userId);
    if (!entry || entry.hidden) return;
    entry.model.head.getWorldPosition(headAt);
    particles.burst({ position: headAt.clone(), count: 14, colors: ['#fff6d8', '#ffe9a8', '#ffd36b'], speed: 0.18, spread: 0.6,
      gravity: 0.35, life: 2.6, size: 0.07, damping: 0.985 });
  }
  const helpers = {
    bowAll: (pose, seconds) => { bowAll = { pose, start: clock, until: clock + seconds }; },
    boostHalo: (seconds) => { haloUntil = Math.max(haloUntil, clock + seconds); },
    // Chuông treo bên phải chánh điện: lắc, ngân, loé sáng (bellHit) — quà lớn đánh nhiều hồi.
    swingBell: () => fixtures.ringBell(),
    petals: (count) => soft.burst({ position: new THREE.Vector3(0, 3.4, -7.2), box: new THREE.Vector3(5, 1.6, 6.5), count: Math.min(count, 140), colors: PETALS,
      speed: 0.25, spread: 1, gravity: -0.25, life: 8, size: 0.07, damping: 0.985 }),
    addIncense(n) {
      for (let i = 0; i < n; i += 1) {
        const stick = new THREE.Group();
        stick.add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.1, 5), new THREE.MeshStandardMaterial({ color: '#b5462a' })));
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshBasicMaterial({ color: '#ff5a1f' }));
        tip.position.y = 0.56;
        stick.add(tip);
        stick.position.set((Math.random() - 0.5) * 0.9, 0.5, (Math.random() - 0.5) * 0.4);
        stick.rotation.z = (Math.random() - 0.5) * 0.25;
        hall.sticks.add(stick);
      }
      while (hall.sticks.children.length > 27) disposeObject(hall.sticks.children[0].removeFromParent());
      particles.burst({ position: hall.urnTop.clone().setY(hall.urnTop.y + 0.25), count: 24, colors: ['#ffb347', '#ffd36b'], speed: 0.7, gravity: 0.4, life: 1.2, size: 0.06 });
    },
    releaseLantern(fx, from) {
      const lantern = lotus(0.16);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffd27a' }));
      glow.position.y = 0.12;
      lantern.add(glow);
      lantern.position.copy(from);
      scene.add(lantern);
      lanterns.push({ lantern, born: clock, drift: (Math.random() - 0.5) * 0.3 });
      labels.float(lantern, `🪷 ${fx.nickname}: ${fx.text}`, { ms: 6500, rise: 30, className: 'prayer' });
      audio.play('chime');
      if (!fx.silent) audio.speak(`${fx.nickname}: ${fx.text}`);
    }
  };
  const rituals = createTempleRituals({ scene, crowd, hall, particles, soft, labels, audio, hud, helpers });

  // lúc chuông bị đánh: tiếng chuông, hạt sáng vàng toả ra từ thân chuông, tượng Phật rực lên một nhịp
  function bellHit() {
    audio.play('bell');
    particles.burst({ position: fixtures.bellCenter(), count: 24, colors: ['#ffe9a8', '#ffd36b', '#fff6d8'], speed: 0.9, spread: 1, gravity: -0.15, life: 1.6, size: 0.09, damping: 0.97 });
    helpers.boostHalo(1.6);
  }

  return {
    scene,
    camera,
    toneMapping: THREE.NoToneMapping, // tranh vẽ đã có màu chuẩn: không nắn lại màu
    // dòng miễn phí đặt trên, rồi tới các bậc quà (stage-main ghép thêm ảnh quà thật)
    legend: [['❤ · mõ', ' Gõ mõ'], ['a di đà phật', ' Vái Phật'], ['cầu …', ' Lời cầu bay lên'], ['Follow', ' Thỉnh chuông'], ['🎁 Quà', ' mở lễ lớn hơn ↓']],
    giftLabels: giftLabels(),
    welcome: { line: 'đã vào chánh điện 🙏 Gõ “cầu …” điều bạn mong', speech: (n) => `Chào mừng ${n} đến chánh điện, chúc bạn một ngày bình an` },
    probe: (id) => (id === '__fixtures' ? fixtures.state() : crowd.probe(id)),
    update(snapshot) {
      const { state } = snapshot;
      const t = state.totals;
      hud.setStats([`✨ ${formatNumber(t.merit)} công đức`, `🔥 ${formatNumber(t.incense)} nén hương · 🪵 ${formatNumber(t.mo)} mõ`]);
      hud.setBoard('TẤM LÒNG THÀNH', state.board.map((b) => ({ ...b, score: formatNumber(b.points) })));
      crowd.sync(state.devotees, new Set(snapshot.viewers?.pending || []));
    },
    onFx(fx) {
      if (fx.kind === 'welcome') {
        const people = fx.mode === 'group' ? fx.people : [fx];
        for (const entry of crowd.welcome(people)) {
          labels.flash(entry.id, 'welcomed', fx.durationMs || 2600);
          bowOne(entry.id, 3.4); // tới chỗ thì vái chào
        }
        // cả đoàn vào cùng lúc: lượng hạt có trần, không chồng sáng thành mảng trắng
        particles.burst({ position: new THREE.Vector3(0, 0.25, -2.6), box: new THREE.Vector3(1.2, 0.3, 0.8), count: Math.min(110, 45 + people.length * 4),
          colors: ['#ffd36b', '#fff1c9'], speed: 0.35, spread: 0, gravity: 0.6, life: 2.2, size: 0.055 });
        if (fx.mode === 'group') helpers.petals(90);
      } else if (fx.kind === 'mo') {
        fixtures.strikeMo();
        if (clock - lastMoSound > 0.15) { audio.play('mo'); lastMoSound = clock; }
        if (clock - lastMoFloat > 0.6) {
          labels.float(fixtures.moTop(), `+${fx.count} ✨`, { ms: 1400, rise: 70 });
          lastMoFloat = clock;
        }
        if (!crowd.busy(fx.userId)) bowOne(fx.userId, 1.7);
      } else if (fx.kind === 'bell') {
        helpers.swingBell();
        helpers.bowAll('bow', 3.4);
        hud.toast(`🔔 ${fx.nickname} thỉnh chuông — cả chánh điện cùng vái`);
      } else if (fx.kind === 'hint') labels.bubble(fx.userId, fx.text, 3800);
      else if (fx.kind === 'giftNote') {
        hud.comboToast(`${fx.userId}|${fx.giftName}`, fx.count, (n) => `${fx.nickname} tặng ${fx.giftName} ×${n} — 🎋 ${fx.note}`, { image: fx.giftPicture });
      } else if (fx.kind === 'incense') rituals.incense(fx);
      else if (fx.kind === 'say') {
        labels.bubble(fx.userId, fx.prayer ? `🙏 ${fx.text}` : fx.text, 4500);
        if (fx.prayer) prayerLight(fx.userId); // lời cầu (miễn phí): đốm sáng vàng bay lên từ người cầu
      } else if (fx.kind === 'bow') {
        if (!crowd.busy(fx.userId)) bowOne(fx.userId, 3.4); // "a di đà phật" (miễn phí): vái Phật trên đệm
      }
      else if (fx.kind === 'fortune') rituals.fortune(fx);
      else if (fx.kind === 'offering') rituals.offering(fx);
    },
    frame(dt, t) {
      clock = t;
      animatePaintedHall(hall, t, { haloBoost: t < haloUntil });
      fixtures.frame(t, bellHit);
      setZoom(camera, 1 + rituals.cameraPush() * 0.09);
      if (Math.random() < dt * 4) { // hạt sáng vàng bay lên quanh tượng Phật
        particles.burst({ position: hall.aura.randomPoint(), count: 1, colors: ['#ffe9a8', '#ffd36b', '#fff6d8'], speed: 0.12, spread: 1, gravity: 0.12, life: 3.2, size: 0.08, damping: 0.99 });
      }
      if (Math.random() < dt * 2.5) { // bụi vàng lơ lửng trong ánh nến
        particles.burst({ position: new THREE.Vector3(0, 2.4, -8), box: new THREE.Vector3(5, 3.5, 7), count: 1, colors: ['#ffd36b'], speed: 0.08, gravity: 0.02, life: 5, size: 0.035 });
      }
      if (hall.sticks.children.length && Math.random() < dt * 9) {
        soft.burst({ position: hall.urnTop.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.45, 0)), count: 1, colors: ['#8a8a8a', '#bdbdbd'],
          speed: 0.12, spread: 0, gravity: 0.15, life: 3.5, size: 0.14, damping: 0.99 });
      }
      crowd.frame(dt, t);
      rituals.frame(t, dt);
      for (let i = lanterns.length - 1; i >= 0; i -= 1) {
        const l = lanterns[i];
        const age = t - l.born;
        l.lantern.position.y += dt * 0.42;
        l.lantern.position.z -= dt * 0.35;
        l.lantern.position.x += Math.sin(age * 1.5) * dt * l.drift;
        if (age > 7) disposeObject(lanterns.splice(i, 1)[0].lantern.removeFromParent());
      }
      particles.update(dt);
      soft.update(dt);
    },
    dispose() {
      crowd.clear();
      particles.dispose();
      soft.dispose();
      disposeObject(scene);
      hud.clearGame();
      labels.clear();
    }
  };
}
