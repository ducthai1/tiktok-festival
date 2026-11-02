// Nghi thức từng người ở chùa — mỗi chức năng một màn riêng, có đầu có cuối:
// thắp hương: đứng dậy, cầm 3 nén hương ra trước lư, thắp, nâng lên trán, vái 3 vái, cắm hương rồi về chỗ.
// cầu nguyện: chắp tay rồi thả hoa đăng từ tay. Xin xăm: lắc ống xăm tới khi 1 que văng ra rồi mới mở quẻ.
// Quà = lời cầu của người tặng (temple-wishes.js): hoa → đèn (cả dãy đèn bàn thờ sáng) → mâm ngũ quả
// (thỉnh chuông) → điều ước lớn / vạn sự như ý (xem temple-grand-ceremony.js).
import * as THREE from '/vendor/three/three.module.js';
import { createGrandCeremony } from './temple-grand-ceremony.js';
import { createAltarTable, createLampRow, fortuneTube, fruitTray, incenseBundle, lampProp, lotus, lotusFlower } from './temple-props.js';
import { URN } from './temple-painted-hall.js';
import { smallWish, TIERS } from './temple-wishes.js';

const PI = Math.PI;
const world = new THREE.Vector3();

export function createTempleRituals(ctx) {
  const { scene, crowd, hall, particles, soft, labels, audio, hud, helpers } = ctx;
  const altar = createAltarTable(scene);
  const lamps = createLampRow(scene);
  const grand = createGrandCeremony(ctx);
  let clock = 0;
  let lastRattle = 0;

  const holdProp = (make) => ({ run: (e) => { e.prop = make(); e.model.hand.add(e.prop); } });
  const dropProp = (e) => {
    if (!e.prop) return;
    e.prop.parent?.remove(e.prop);
    e.prop = null;
  };
  const merit = (points) => ({ run: (e) => labels.float(e.model.head, `+${points} ✨ công đức`, { ms: 2200, rise: 90 }) });

  function smokeFromTips(e) {
    if (!e.prop?.userData.tips || Math.random() > 0.5) return;
    e.prop.userData.tips[Math.floor(Math.random() * 3)].getWorldPosition(world);
    soft.burst({ position: world, count: 1, colors: ['#9a9a9a', '#cfcfcf'], speed: 0.25, spread: 0, gravity: 0.5, life: 2.2, size: 0.16, damping: 0.99 });
  }

  // Đi vòng qua lư hương (ở giữa) để tới trước bàn thờ (mép bàn thờ trong tranh ở độ sâu ~11,7 m).
  function toAltar() {
    const x = (Math.random() < 0.5 ? -1 : 1) * (0.55 + Math.random() * 0.35);
    return [{ walk: new THREE.Vector3(x, 0, -9.7) }, { walk: new THREE.Vector3(x, 0, -10.95), facing: PI }];
  }

  const OFFERINGS = {
    lotus: { make: () => lotusFlower(lotus), points: 10,
      effect: () => { audio.play('chime'); helpers.petals(60); } },
    lamp: { make: () => lampProp(), points: 50,
      effect: () => { audio.play('smallBell'); audio.play('chime'); lamps.light(clock); } },
    fruit: { make: () => fruitTray(), points: 300,
      effect: () => { helpers.swingBell(); helpers.petals(120); helpers.boostHalo(3); } }
  };

  return {
    incense(fx) {
      hud.comboToast(`${fx.userId}|${fx.giftName}`, fx.count, (n) => `${fx.nickname} tặng ${fx.giftName} ×${n} — 🔥 lên thắp hương`, { image: fx.giftPicture });
      if (crowd.busy(fx.userId)) return void helpers.addIncense(fx.sticks); // đang thắp dở: cắm thêm hương, không diễn lại
      // đứng ngang hàng lư, một bên, mặt quay vào lư: camera thấy nghiêng người, rõ tay nâng hương và vái
      const side = Math.random() < 0.5 ? -1 : 1;
      const facing = Math.atan2(-side, -0.12);
      crowd.perform(fx.userId, [
        holdProp(() => incenseBundle()),
        { walk: new THREE.Vector3(side * 0.6, 0, -9.8) },
        { walk: new THREE.Vector3(side * 0.62, 0, -(URN.depth - 0.15)), facing },
        { run: (e) => { e.prop.userData.light(); audio.play('chime'); } },
        { pose: 'prayHigh', seconds: 1.1, facing, onTick: smokeFromTips },
        { pose: 'bowStand', seconds: 4.2, facing, onTick: smokeFromTips }, // vái 3 vái
        { run: (e) => { dropProp(e); helpers.addIncense(fx.sticks); } },
        merit(15)
      ], { fallback: () => helpers.addIncense(fx.sticks) });
    },
    prayer(fx) {
      crowd.perform(fx.userId, [
        { pose: 'pray', seconds: 1.3, facing: PI },
        { run: (e) => { e.model.hand.getWorldPosition(world); helpers.releaseLantern(fx, world.clone()); } },
        { pose: 'bow', seconds: 3.2, facing: PI },
        merit(10)
      ], { fallback: () => helpers.releaseLantern(fx, new THREE.Vector3(0, 1.2, -6)) });
    },
    fortune(fx) {
      const reveal = () => {
        hud.showFortune(fx);
        audio.play('chime');
        audio.speak(`Quẻ số ${fx.number}, ${fx.rank}. ${fx.title}. ${fx.poem.join('. ')}. Lời bàn: ${fx.meaning}`);
      };
      crowd.perform(fx.userId, [
        holdProp(() => fortuneTube()),
        { pose: 'shake', seconds: 2.4, facing: PI, onTick: () => {
          if (clock - lastRattle > 0.14) { audio.play('rattle'); lastRattle = clock; }
        } },
        { run: (e) => {
          e.prop.getWorldPosition(world);
          particles.burst({ position: world.clone().setY(world.y + 0.25), count: 24, colors: ['#ffd36b', '#ffffff'], speed: 1.2, gravity: -1.5, life: 1, size: 0.06 });
          dropProp(e);
          reveal();
        } },
        { pose: 'bow', seconds: 3.2, facing: PI }
      ], { fallback: reveal, waitSeconds: 6 });
    },
    offering(fx) {
      if (fx.offering === 'ceremony' || fx.offering === 'grand') {
        grand.start(fx.offering, fx);
        crowd.perform(fx.userId, [
          holdProp(() => incenseBundle()),
          { walk: new THREE.Vector3(0, 0, -9.9), facing: PI },
          { run: (e) => e.prop.userData.light() },
          { pose: 'bowStand', seconds: 6.6, facing: PI, onTick: smokeFromTips },
          { run: (e) => { dropProp(e); helpers.addIncense(9); } },
          merit(fx.offering === 'ceremony' ? 5000 : 30000)
        ]);
        return;
      }
      const kind = OFFERINGS[fx.offering] ? fx.offering : 'lotus';
      const o = OFFERINGS[kind];
      const tier = TIERS[kind];
      const wish = smallWish(kind);
      hud.comboToast(`${fx.userId}|${fx.giftName}`, fx.count, (n) => `${fx.nickname} tặng ${fx.giftName} ×${n} — ${tier.verb} cầu ${wish}`,
        { gold: kind !== 'lotus', image: fx.giftPicture });
      if (crowd.busy(fx.userId)) return void o.effect(); // đang dâng lễ dở: tặng thêm chỉ cộng dồn, không đi lại từ đầu
      crowd.perform(fx.userId, [
        holdProp(o.make),
        ...toAltar(),
        { pose: 'offer', seconds: 1.3, facing: PI },
        { run: (e) => { altar.place(e.prop, clock); e.prop = null; o.effect(); } },
        { pose: 'bowStand', seconds: 2.8, facing: PI },
        merit(o.points)
      ], { fallback: o.effect });
    },
    cameraPush: () => grand.cameraPush(),
    frame(t, dt) {
      clock = t;
      altar.frame(t);
      lamps.frame(t);
      grand.frame(t, dt);
    }
  };
}
