// Cảnh SÀN NHẢY: hội trường cả trăm nhân vật chibi nhảy theo nhạc, camera đạo diễn tự lượn kiểu MV;
// quà = solo giữa sân khấu (sàn tối, đèn rọi, camera vòng quanh), Top 1-2-3 đứng bục, khổng lồ VIP hai bên.
import * as THREE from '/vendor/three/three.module.js';
import { DANCE_SLOTS, PODIUM } from '/static/shared/dance-floor-layout.js';
import { createMeter, formatNumber } from '../stage-hud.js';
import { createAuditionBar } from './dance-audition-bar.js';
import { createCameraDirector } from './dance-camera-director.js';
import { createDjPanel } from './dance-dj-panel.js';
import { createGiftAnnouncer } from './dance-gift-announcer.js';
import { buildHallDecor } from './dance-hall-decor.js';
import { buildDanceHall } from './dance-hall-room.js';
import { createShowEffects } from './dance-show-effects.js';
import { createSpriteCrowd } from './dance-sprite-crowd.js';
import { BPM } from './dance-sprite-material.js';
import { disposeObject } from './person-model.js';

const MEDALS = ['🥇', '🥈', '🥉'];
const RANK_TITLES = ['BÁ CHỦ SÀN', 'PHÚ HỘ', 'ĐẠI GIA']; // danh hiệu khung vàng trên đầu Top 1-2-3
const TIER_TITLES = { 1: '💖 FAN MỚI 💖', 2: 'SOLO', 3: '★ SOLO SÂN KHẤU ★', 4: '👑 VIP SOLO 👑', 5: '🔥 SIÊU SAO 🔥', 6: '🌌 ĐẠI NHẠC HỘI 🌌' };
const RECENT_MS = 12000;
const DJ_INFO = { id: '__dj', dj: true, look: 0, slot: -1, move: '' }; // DJ đứng bàn mix trên sân khấu (không phải người xem)
const FACE_EMOJI = { happy: '😊', grin: '😁', wink: '😉', cool: '😎', love: '😍', laugh: '😂', surprise: '😮', tongue: '😜',
  sing: '🎤', cry: '😭', angry: '😡', sleepy: '😴', star: '🤩', shy: '☺️', party: '🥳', kiss: '😘' };
const MAX_LABELS = 18;
const ALL_LABELS_UNDER = 40; // ≤ 40 người: ai cũng có tên + avatar
const ZOOM_LABEL_PX = 210; // ai hiện cao hơn chừng này px (camera zoom gần) thì có tên bản to
const LABELS_CAP = 60; // tối đa nhãn cùng lúc (nhẹ trang, khỏi chồng chéo)
const GLANCE_GAP_S = 6;

// sheets: mô tả ảnh ghép nhân vật (public/assets/dance/sheets.json), tải trước khi dựng cảnh
export function createDanceScene({ hud, labels, audio, pipeline, sheets }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1080 / 1920, 0.1, 90);
  const room = buildDanceHall(scene);
  const decor = buildHallDecor(scene);
  const crowd = createSpriteCrowd(scene, { sheets, capacity: DANCE_SLOTS + 8 });
  // trực thăng chở VIP bay ngang hội trường khi có quà lớn
  const heli = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.TextureLoader().load('/static/assets/dance/heli.webp', (t) => { t.colorSpace = THREE.SRGBColorSpace; }), transparent: true }));
  heli.scale.set(4.2, 2, 1);
  heli.visible = false;
  scene.add(heli);
  let heliFrom = -Infinity;
  const show = createShowEffects(scene);
  const director = createCameraDirector(camera);
  director.snap(crowd.bounds(), PODIUM[0]);
  pipeline.setBloom({ strength: 0.38, radius: 0.45, threshold: 0.9 }); // phát sáng nhẹ: bar cần đèn nhưng xem lâu không đau mắt

  hud.setTitle('🪩 SÀN NHẢY LIVE');
  hud.setHint(['🎁 ', '*Tặng quà*', ' → nhận ngay:']);
  const meter = createMeter(hud, { label: '🔥 ĐỘ QUẨY' });
  const auBar = createAuditionBar(hud);
  const bigGift = createGiftAnnouncer(hud, {
    onShow(fx) {
      const follow = fx.kind === 'follow';
      audio.play(follow || fx.tier >= 5 ? 'fanfare' : 'coin');
      audio.speak(follow ? `Cảm ơn ${fx.nickname} đã follow sàn nhảy` : `Cảm ơn ${fx.nickname} đã tặng ${fx.giftName}`, 'story');
    }
  });
  // có video DJ: chiếu trên màn LED lớn sau sân khấu
  const djPanel = createDjPanel(hud, { onVideo: (video) => room.setScreenVideo(video) });
  let lastBeat = 0;
  labels.setDeclutter('dance', { top: 260, bottom: 1700, gap: 2, maxSteps: 2, shiftX: [0, -28, 28] });

  let state = { dancers: [], solo: null, hype: 0, hypeGoal: 1, dropMs: 0 };
  let byId = new Map();
  let clock = 0;
  let solo = null; // { id, tier, startedAt }
  let dim = 0;
  let lastGlance = -Infinity;
  const recent = new Map(); // id → hết hạn hiện tên (người vừa bình luận / tặng / được chào)
  const faces = new Map(); // id → nét mặt đang chọn (để thả emoji khi người xem vừa đổi)
  let closeId = ''; // người đang được camera ghé cận (dùng bản nhảy bung)

  const posOf = (id) => crowd.get(id)?.pos || null;

  function glance(id, seconds = 2.4) {
    if (director.isFocusing(clock) || clock - lastGlance < GLANCE_GAP_S) return;
    lastGlance = clock;
    closeId = id;
    director.focus(() => posOf(id), seconds, 'glance', clock);
  }

  // chiều cao (px trên khung 1920) của một nhân vật đang thấy trên màn; 0 nếu ngoài khung
  const headV = new THREE.Vector3();
  const footV = new THREE.Vector3();
  function screenHeightPx(e) {
    if (!e || e.leaving) return 0;
    headV.copy(e.anchor.position).project(camera);
    footV.copy(e.pos).project(camera);
    if (headV.z > 1 || Math.abs(headV.x) > 1 || headV.y > 1 || footV.y < -1.1) return 0;
    return (headV.y - footV.y) * 960;
  }

  function refreshLabels() {
    const now = performance.now();
    for (const [id, until] of recent) if (now > until || !byId.has(id)) recent.delete(id);
    const ids = new Set([...recent.keys()].slice(-MAX_LABELS));
    for (const d of state.dancers) if (d.rank || d.giant || d.fan || d.id === solo?.id) ids.add(d.id); // fan mới: tên luôn hiện 10 phút
    // ít người: ai cũng có tên + avatar; đông: thêm những ai đang hiện TO trên màn (camera zoom gần) — nhãn bản to
    const zoomed = new Set();
    const sized = [];
    for (const d of state.dancers) {
      const px = screenHeightPx(crowd.get(d.id));
      if (px > ZOOM_LABEL_PX) sized.push([px, d.id]);
    }
    sized.sort((a, b) => b[0] - a[0]);
    for (const [, id] of sized) {
      if (ids.size >= LABELS_CAP) break;
      ids.add(id);
      zoomed.add(id); // camera đang zoom gần người này → nhãn bản to
    }
    if (state.dancers.length <= ALL_LABELS_UNDER) for (const d of state.dancers) ids.add(d.id);
    for (const id of ids) {
      const d = byId.get(id);
      const e = crowd.get(id);
      if (!d || !e) continue;
      const title = d.rank ? RANK_TITLES[d.rank - 1] : d.id === solo?.id ? 'SIÊU SAO' : d.giant ? 'VIP' : d.fan ? 'FAN CỨNG' : '';
      const titleClass = d.rank ? `rank-${d.rank}` : title ? 'star' : '';
      labels.sync(id, { anchor: e.anchor, nickname: d.rank ? `${MEDALS[d.rank - 1]} ${d.nickname}` : d.nickname, avatar: d.avatar || '',
        vip: Boolean(d.rank || d.giant || d.fan || d.id === solo?.id), small: !d.rank && !d.fan && d.id !== solo?.id && !zoomed.has(id), group: 'dance', title, titleClass });
    }
    labels.keepOnly(ids);
  }

  function markRecent(id) {
    recent.delete(id);
    recent.set(id, performance.now() + RECENT_MS);
    refreshLabels();
  }

  function startSolo(info) {
    const d = byId.get(info.id);
    solo = { id: info.id, tier: info.tier, startedAt: clock };
    director.focus(() => posOf(info.id), info.msLeft / 1000, 'solo', clock);
    hud.banner(TIER_TITLES[info.tier] || 'SOLO', d?.nickname || '', 3200);
    auBar.start(d?.nickname || '', lastBeat, info.id);
    audio.play(info.tier >= 3 ? 'fanfare' : 'whoosh');
    markRecent(info.id);
  }

  function ctx() {
    return {
      soloId: solo?.id || '',
      closeId: director.focusMode(clock) === 'glance' ? closeId : '',
      dim,
      giants: state.dancers.filter((d) => d.giant && d.id !== solo?.id).slice(-2).map((d) => d.id),
      cheering: Boolean(solo && clock - solo.startedAt < 3),
      now: clock,
      camPos: camera.position,
      floorCount: state.dancers.length
    };
  }

  return {
    scene,
    camera,
    welcome: { line: 'đã vào sàn! Gõ “quẩy” để nhảy bung 🪩', speech: (n) => `Chào mừng ${n} đến sàn nhảy!` },
    // lệnh miễn phí nằm ở cột phải (dance-dj-panel.js); bảng trái chỉ còn bậc quà theo số 💎
    legend: [['🎁 Quà', ' theo số 💎 ↓']],
    // người TẶNG nhận được gì; bảng 2 dòng: khoảng 💎 / hiệu ứng. Mỗi câu hiệu ứng phải vừa MỘT dòng của cột trái
    // (~20 ký tự) — dài hơn là rớt chữ xuống dòng, khó đọc
    giftRows: true,
    giftLabels: { 1: '🦋 Có cánh + lên hình', 2: '🎈 Bay cao + solo ngắn', 3: '🎤 Solo + pháo hoa',
      4: '👑 Khổng lồ VIP 🚁', 5: '🎆 Pháo hoa + DROP', 6: '🌌 Đại nhạc hội' },
    update(snapshot) {
      state = snapshot.state;
      byId = new Map(state.dancers.map((d) => [d.id, d]));
      crowd.sync([...state.dancers, DJ_INFO], ctx());
      if (state.solo && state.solo.id !== solo?.id) startSolo(state.solo);
      else if (!state.solo && solo) {
        solo = null;
        director.release();
        auBar.stop();
      }
      const dropping = state.dropMs > 0;
      meter.root.classList.toggle('party', dropping);
      meter.update(dropping ? 1 : state.hype / state.hypeGoal,
        dropping ? `DROP! ${Math.ceil(state.dropMs / 1000)}s` : `${formatNumber(state.hype)} / ${formatNumber(state.hypeGoal)}`);
      hud.setStats([`👥 ${state.dancers.length} người quẩy`, `💎 ${formatNumber(snapshot.totals.diamonds)}`]);
      hud.setBoard('TOP DÂN QUẨY', snapshot.top.map((r) => ({ ...r, score: r.diamonds ? `${formatNumber(r.diamonds)}💎` : `${formatNumber(r.likes)}❤` })));
      for (const d of state.dancers) {
        if (d.face && faces.get(d.id) !== d.face) {
          const e = crowd.get(d.id);
          if (e) labels.float(e.anchor, FACE_EMOJI[d.face] || '✨', { ms: 2200, rise: 120, className: 'dance-emote' });
        }
        faces.set(d.id, d.face);
      }
      refreshLabels();
    },
    probe: (id) => {
      const e = crowd.get(id);
      if (!e) return null;
      const p = e.anchor.getWorldPosition(new THREE.Vector3()).project(camera);
      return { x: (p.x * 0.5 + 0.5) * 1080, y: (-p.y * 0.5 + 0.5) * 1920, solo: e.id === solo?.id };
    },
    onFx(fx) {
      const e = fx.userId ? crowd.get(fx.userId) : null;
      if (fx.kind === 'welcome') {
        const people = fx.mode === 'group' ? fx.people : [fx];
        for (const p of people) if (p.userId || p.id) markRecent(p.userId || p.id);
        if (people.length === 1) glance(people[0].userId || people[0].id, 2.2);
      } else if (fx.kind === 'bubble') {
        markRecent(fx.userId);
        labels.bubble(fx.userId, fx.text);
      } else if (fx.kind === 'toast') hud.toast(fx.text, { title: fx.nickname, image: fx.avatar, gold: fx.gold });
      else if (fx.kind === 'follow') {
        bigGift.follow(fx);
        if (e) show.hearts(e.pos.clone().setY(e.pos.y + 1.6 * e.scale), 15);
        markRecent(fx.userId);
      }
      else if (fx.kind === 'camera' && e) {
        if (!fx.reason) hud.toast(`❤ ${formatNumber(fx.likes)} tim → có cánh 📸`, { gold: true, title: fx.nickname });
        markRecent(fx.userId);
        lastGlance = -Infinity; // 1k tim / follow / share luôn được lên hình
        glance(fx.userId, fx.reason ? 3 : 4);
      }
      else if (fx.kind === 'look' && e) {
        show.sparkle(e.pos.clone().setY(e.pos.y + 0.8));
        audio.play('magic');
        markRecent(fx.userId);
      } else if (fx.kind === 'hearts' && e) show.hearts(e.pos.clone().setY(e.pos.y + 1.6 * e.scale), fx.count);
      else if (fx.kind === 'gift') {
        hud.comboToast(`${fx.userId}|${fx.giftName}`, fx.count, (n) => `🪩 tặng ${fx.giftName} ×${n}`, { gold: fx.tier >= 3, image: fx.giftPicture, title: fx.nickname });
        if (e) show.sparkle(e.pos.clone().setY(e.pos.y + 0.9), fx.tier >= 3);
        if (fx.tier < 3) audio.play('pop');
        bigGift.show(fx);
        markRecent(fx.userId);
        if (fx.tier === 1) glance(fx.userId);
      } else if (fx.kind === 'fountains') {
        show.fountains(clock, 7);
        heliFrom = clock;
        audio.play('whoosh');
      } else if (fx.kind === 'fireworks') {
        show.fireworks(fx.power);
        audio.play('boom');
        if (!solo) director.focus(() => new THREE.Vector3(0, 0.9, -7.2), 5, 'reveal', clock);
      } else if (fx.kind === 'drop') {
        hud.banner('💥 DROP! 💥', 'Cả sàn cùng quẩy', 3000);
        audio.play('crash');
        show.confetti(clock, fx.durationMs / 1000);
      }
    },
    frame(dt, t) {
      clock = t;
      const beat = audio.beat?.() ?? (t * BPM) / 60;
      lastBeat = beat;
      auBar.update(beat);
      dim += ((solo ? 1 : 0) - dim) * Math.min(1, dt * 3);
      const c = ctx();
      crowd.frame(dt, beat, c);
      const soloEntity = solo ? crowd.get(solo.id) : null;
      const dropping = state.dropMs > 0;
      room.update(t, beat, {
        drop: dropping,
        dim,
        lasers: dropping || (solo && solo.tier >= 4),
        screenTitle: solo ? (TIER_TITLES[solo.tier] || 'SOLO') : dropping ? 'DROP!!!' : 'SÀN NHẢY LIVE',
        screenSub: solo ? (byId.get(solo.id)?.nickname || '') : dropping ? 'CẢ SÀN CÙNG QUẨY' : `${state.dancers.length} người đang quẩy`
      });
      const top1 = state.dancers.find((d) => d.rank === 1);
      decor.update(t, beat, { top1Head: top1 ? crowd.get(top1.id)?.anchor.position : null, dim });
      show.spotlight(soloEntity ? soloEntity.pos : null);
      const k = (t - heliFrom) / 5;
      heli.visible = k >= 0 && k <= 1;
      if (heli.visible) heli.position.set(-10 + k * 20, 6.4 + Math.sin(k * Math.PI * 3) * 0.3, 0.5);
      show.update(dt, t);
      director.update(dt, t, beat, crowd.bounds(), PODIUM[0]);
      if (Math.floor(t * 4) !== Math.floor((t - dt) * 4)) refreshLabels(); // 4 lần/giây: camera zoom tới ai là tên hiện ngay
    },
    dispose() {
      crowd.dispose();
      djPanel.dispose();
      bigGift.dispose();
      show.dispose();
      disposeObject(scene);
      hud.clearGame();
      labels.clear();
    }
  };
}
