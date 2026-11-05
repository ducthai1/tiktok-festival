// SÀN NHẢY — hội trường quẩy: ai bình luận / thả tim / tặng quà là có một nhân vật chibi trên sàn (tối đa DANCE_SLOTS).
// Miễn phí: "quẩy" nhảy bung, "nhảy" nhảy 1 cái, "to lên"/"nhỏ lại" đổi cỡ, "chào" vẫy tay, "bay lên" bay cao,
// "đổi nv" đổi nhân vật, emoji đổi biểu cảm; mỗi 500 tim của một người = có cánh + lên camera (mỗi 1.000 tim thêm pháo
// hoa), mỗi 3.000 tim = xe bay một vòng; share = lên camera;
// follow (lần đầu) = thẻ lớn + solo sân khấu + cánh neon + danh hiệu FAN CỨNG;
// tim làm đầy thanh ĐỘ QUẨY → DROP (cả sàn bùng nổ). Quà nhỏ nhất đã có huy hiệu cánh xanh. Quà: hào quang → bay lên → XE BAY
// (1–199 💎) → SOLO giữa sân khấu + khổng lồ (200–999) → DROP (1.000+) (mốc quà Sàn Nhảy: DANCE_TIER_MIN)
// (camera tiến sát) → khổng lồ VIP → pháo hoa + DROP → đại nhạc hội. Top 1-2-3 đứng bục trên sân khấu.
import { containsPhrase, createCooldown, foldText, isCleanForDisplay } from './text-match.js';
import { DANCE_TIER_MIN, giftTierIn } from '../../public/shared/gift-tiers.js';
import { DANCE_FILL_ORDER, DANCE_SLOTS } from '../../public/shared/dance-floor-layout.js';
import { createSeedCrowd } from './dance-seed-crowd.js';

const FILL_RANK = new Map(DANCE_FILL_ORDER.map((slot, i) => [slot, i])); // chỗ càng đầu danh sách càng đẹp (gần camera, giữa sàn)

const WATCHER_LEAVE_MS = 5 * 60 * 1000;
const ENGAGED_LEAVE_MS = 10 * 60 * 1000;
const HYPE_MS = 8000;
const WAVE_MS = 4000;
const FACE_MS = 6000;
const DROP_MS = 20000;
export const HYPE_GOAL = 1500;
const SOLO_QUEUE_MAX = 8;
const LEVEL_MS = 90 * 1000;
const GIANT_MS = 2 * 60 * 1000;
const FAN_MS = 10 * 60 * 1000;
const FOLLOW_SOLO_MS = 6000;
// Solo của người vừa follow vào hàng chờ ở "bậc 1" (quà bậc 1 không có solo): quà từ bậc 2 trở lên luôn diễn trước.
const FOLLOW_SOLO_TIER = 1;

const HYPE_WORDS = ['quay', 'quay len', 'quay di', 'dance', 'bung', 'phe', 'chay', 'nhun'];
const JUMP_WORDS = ['nhay', 'nhay di', 'nhay 1 cai', 'nhay mot cai', 'jump'];
const GROW_WORDS = ['to len', 'to ra', 'lon len'];
const SHRINK_WORDS = ['nho lai', 'nho di', 'be lai'];
const JUMP_MS = 1300;
// Quà 1–199 💎 (cả khoảng đầu của Sàn Nhảy): XE BAY mọc cánh chở người tặng bay một vòng quanh sàn + sân khấu.
// Từ 200 💎 trở lên: solo sân khấu + khổng lồ + pháo hoa.
export const RIDE_MIN_KC = 1;
export const RIDE_MAX_KC = 199;
const RIDE_MS = 14500; // màn hình bay 14 s (cất cánh → một vòng → hạ cánh), dư nửa giây
const WINGS_MS = 10 * 60 * 1000;
export const LIKES_FOR_CAMERA = 500; // miễn phí: cánh + lên camera (user 05/11 chuyển bớt về free, trước là 1.000)
export const LIKES_FOR_RIDE = 3000; // miễn phí: xe bay một vòng
export const LIKES_FOR_FIREWORKS = 1000; // miễn phí: pháo hoa
const FLY_WORDS = ['bay len', 'bay cao']; // "bay" trơn trùng "bây giờ" / "bảy" sau khi bỏ dấu → chỉ nhận cụm 2 chữ
const FREE_FLY_MS = 60 * 1000;
const WAVE_WORDS = ['chao', 'hello', 'hi', 'xin chao', 'chao ca nha', 'alo'];
const LOOK_WORDS = ['doi do', 'doi nv', 'doi nhan vat', 'thay do', 'doi skin', 'doi mau', 'doi style'];
// Cảm xúc: emoji so trên chữ gốc, chữ so sau khi bỏ dấu (theo từ nguyên vẹn).
const FACE_RULES = [
  ['laugh', /😂|🤣|😆/u, ['haha', 'kkk', 'kaka', 'hehe', 'cuoi']],
  ['love', /❤|♥|😍|🥰|💕|💖|😻/u, ['yeu', 'thuong', 'love', 'iu', 'yeu qua']],
  ['cool', /😎|🔥/u, ['ngau', 'chat', 'dinh', 'cool', 'slay', 'xin so']],
  ['cry', /😭|😢|🥲/u, ['buon', 'khoc', 'huhu', 'hic']],
  ['surprise', /😮|😱|😲|🤯/u, ['wow', 'woa', 'troi oi', 'oi troi', 'u la troi']],
  ['angry', /😡|😠|🤬/u, ['tuc', 'gian', 'cay']],
  ['kiss', /😘|😚|💋/u, ['hun', 'chut', 'moa', 'chu chu']],
  ['sing', /🎤|🎵|🎶/u, ['hat', 'sing', 'la la', 'lalala']],
  ['party', /🥳|🎉|🎊/u, ['party', 'tiec', 'quay tung noc']],
  ['sleepy', /😴|🥱/u, ['buon ngu', 'ngu ngon', 'met']],
  ['shy', /😊|☺|🥺/u, ['hihi', 'ngai', 'e then']],
  ['tongue', /😜|😛|😝/u, ['leu leu', 'le le', 'bleh']],
  ['star', /🤩|⭐|✨/u, ['xinh', 'dep', 'idol', 'dinh noc']]
];

export function faceForComment(text) {
  const raw = String(text || '');
  for (const [face, emoji, words] of FACE_RULES) if (emoji.test(raw) || containsPhrase(raw, words)) return face;
  return '';
}

// Bậc quà → thời gian solo (ms). Bậc 1 không solo (chỉ hào quang + nhảy bung).
const SOLO_MS_BY_TIER = [0, 5000, 9000, 12000, 15000, 20000];

export function createDanceHallGame({ random = Math.random, seedCount = 0 } = {}) {
  const dancers = new Map();
  const seedCrowd = createSeedCrowd({ random, target: seedCount });
  const spenders = new Map(); // kc theo người trong phiên → Top 1-2-3 lên bục
  const chatHypeCooldown = createCooldown(5000);
  const heartsCooldown = createCooldown(2500);
  const commandCooldown = createCooldown(3500);
  let hype = 0;
  let dropUntil = 0;
  let solo = null; // { id, tier, startedAt, until }
  let queue = []; // [{ id, tier, ms }]
  const followed = new Set(); // ai đã nhận gói follow trong phiên

  function ranks() {
    const top = [...spenders.entries()].filter(([id]) => dancers.has(id)).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return new Map(top.map(([id], i) => [id, i + 1]));
  }

  function protectedIds(now) {
    const keep = new Set(ranks().keys());
    if (solo) keep.add(solo.id);
    for (const q of queue) keep.add(q.id);
    for (const d of dancers.values()) if (now < d.giantUntil) keep.add(d.id);
    return keep;
  }

  function freeSlot() {
    const used = new Set([...dancers.values()].map((d) => d.slot));
    return DANCE_FILL_ORDER.find((slot) => !used.has(slot)) ?? -1;
  }

  // Hết chỗ: người CHỈ VÀO XEM ra trước, rồi tới người im lâu nhất; Top 3, người đang/chờ solo, khổng lồ VIP giữ chỗ.
  function evictIdlest(now, fx, onlyLurkers) {
    const keep = protectedIds(now);
    const out = [...dancers.values()]
      .filter((d) => !keep.has(d.id) && (!onlyLurkers || !d.engaged))
      .sort((a, b) => Number(a.engaged) - Number(b.engaged) || a.lastActive - b.lastActive)[0];
    if (!out) return -1;
    dancers.delete(out.id);
    fx.push({ kind: 'leave', userId: out.id });
    return out.slot;
  }

  const seedsOnFloor = () => [...dancers.values()].filter((d) => d.seed);

  // Người thật vào mà đang dư người ảo: người ảo ở chỗ đẹp nhất bay ra, người thật vào đúng chỗ đó.
  function takeSeedSpot(fx) {
    const seeds = seedsOnFloor();
    if (seeds.length <= seedCrowd.want(dancers.size - seeds.length + 1)) return -1;
    const out = seeds.sort((a, b) => FILL_RANK.get(a.slot) - FILL_RANK.get(b.slot))[0];
    dancers.delete(out.id);
    fx.push({ kind: 'leave', userId: out.id });
    return out.slot;
  }

  // Giữ số người ảo = mục tiêu − số người thật: thiếu thì thêm (sàn trống), dư thì mời bớt.
  function syncSeeds(now, fx) {
    const seeds = seedsOnFloor();
    const want = seedCrowd.want(dancers.size - seeds.length);
    for (const d of seeds.slice(want)) {
      dancers.delete(d.id);
      fx.push({ kind: 'leave', userId: d.id });
    }
    const names = new Set(seeds.slice(0, want).map((d) => d.nickname));
    for (let n = seeds.length; n < want; n += 1) {
      const seed = seedCrowd.next(names);
      names.add(seed.nickname);
      const d = ensureDancer(seed, now, fx, { canEvict: false, engaged: false, seed: true });
      if (!d) break;
    }
  }

  function ensureDancer(user, now, fx, { canEvict, engaged = true, seed = false }) {
    let d = dancers.get(user.id);
    if (!d) {
      let slot = seed ? -1 : takeSeedSpot(fx);
      if (slot < 0) slot = freeSlot();
      if (slot < 0 && canEvict) slot = evictIdlest(now, fx, canEvict === 'lurkers');
      if (slot < 0) return null;
      d = { id: user.id, slot, look: 0, engaged: false, seed, // look 0: nhân vật theo ô (8 ô quanh luôn khác nhau); "đổi nv" tăng look joinedAt: now, hypeUntil: 0, waveUntil: 0,
        jumpUntil: 0, rideUntil: 0, size: 1, likes: 0, wingsUntil: 0, fanUntil: 0,
        face: '', faceUntil: 0, auraUntil: 0, level: 0, levelUntil: 0, giantUntil: 0 };
      dancers.set(user.id, d);
      fx.push({ kind: 'join', userId: user.id, nickname: user.nickname });
    }
    d.nickname = user.nickname;
    d.avatar = user.avatar;
    d.lastActive = now;
    d.engaged = d.engaged || engaged;
    return d;
  }

  function addHype(amount, now, fx) {
    if (now < dropUntil) return;
    hype += amount;
    if (hype >= HYPE_GOAL) startDrop(now, fx);
  }

  function startDrop(now, fx) {
    hype = 0;
    dropUntil = now + DROP_MS;
    fx.push({ kind: 'drop', durationMs: DROP_MS });
  }

  // Hàng chờ solo: bậc cao lên trước, cùng bậc thì ai trước diễn trước; một người chỉ giữ một lượt (lấy bậc cao nhất).
  function enqueueSolo(id, tier, ms, now) {
    if (solo?.id === id) {
      solo.until = Math.min(solo.until + ms / 2, solo.startedAt + 30000);
      solo.tier = Math.max(solo.tier, tier);
      return;
    }
    const existing = queue.find((q) => q.id === id);
    if (existing) {
      existing.tier = Math.max(existing.tier, tier);
      existing.ms = Math.max(existing.ms, ms);
    } else queue.push({ id, tier, ms, at: now });
    queue.sort((a, b) => b.tier - a.tier || a.at - b.at);
    if (queue.length > SOLO_QUEUE_MAX) queue.length = SOLO_QUEUE_MAX;
  }

  function advanceSolo(now, fx) {
    if (solo && (now >= solo.until || !dancers.has(solo.id))) {
      fx.push({ kind: 'soloEnd', userId: solo.id });
      solo = null;
    }
    while (!solo && queue.length) {
      const next = queue.shift();
      const d = dancers.get(next.id);
      if (!d) continue;
      // hàng chờ dài: solo bậc thấp ngắn lại để ai cũng tới lượt
      const ms = queue.length >= 3 && next.tier <= 3 ? Math.round(next.ms * 0.65) : next.ms;
      solo = { id: next.id, tier: next.tier, startedAt: now, until: now + ms };
      fx.push({ kind: 'solo', userId: d.id, nickname: d.nickname, tier: next.tier, durationMs: ms });
    }
  }

  function onGift(event, now, fx) {
    const { gift, user } = event;
    spenders.set(user.id, (spenders.get(user.id) || 0) + gift.diamonds);
    const d = ensureDancer(user, now, fx, { canEvict: true });
    const tier = giftTierIn(gift.diamondsEach, DANCE_TIER_MIN);
    const ride = gift.diamondsEach >= RIDE_MIN_KC && gift.diamondsEach <= RIDE_MAX_KC;
    fx.push({ kind: 'gift', userId: user.id, nickname: user.nickname, giftName: gift.name, giftPicture: gift.pictureUrl,
      count: gift.count, diamonds: gift.diamonds, tier, ride });
    if (!d) return;
    d.auraUntil = Math.max(d.auraUntil, now) + Math.min(120000, 20000 * tier);
    d.wingsUntil = Math.max(d.wingsUntil, now) + WINGS_MS; // huy hiệu + cánh
    d.hypeUntil = now + HYPE_MS;
    d.face = tier >= 3 ? 'star' : 'party';
    d.faceUntil = now + FACE_MS;
    if (ride) {
      if (now >= d.rideUntil) d.rideUntil = now + RIDE_MS; // đang bay thì bay nốt vòng cũ (kéo dài làm lệch đường bay)
      addHype(gift.diamonds * 10, now, fx);
      return;
    }
    if (tier >= 2) {
      d.level = Math.min(5, d.level + 1);
      d.levelUntil = now + LEVEL_MS;
    }
    if (tier >= 4) {
      d.giantUntil = now + GIANT_MS;
      fx.push({ kind: 'fountains', userId: d.id });
    }
    if (tier >= 3) fx.push({ kind: 'fireworks', power: [1, 2, 3, 6][tier - 3] });
    if (tier >= 2) enqueueSolo(d.id, tier, SOLO_MS_BY_TIER[tier - 1] * (1 + Math.min(gift.count - 1, 4) * 0.15), now);
    if (tier >= 5) startDrop(now, fx);
    else addHype(gift.diamonds * 10, now, fx);
  }

  // Share (và follow lại lần nữa): lên camera + vẫy tay + thông báo. Không giới hạn số lần.
  function cameraShoutout(event, now, fx) {
    const d = ensureDancer(event.user, now, fx, { canEvict: true });
    if (d) {
      d.waveUntil = now + WAVE_MS;
      fx.push({ kind: 'camera', userId: d.id, nickname: d.nickname, reason: event.type });
    }
    // tên tách riêng: màn hiện tên 1 dòng (dài thì "…") + dòng việc bên dưới, không bị tên dài đẩy thành 3–4 dòng
    fx.push({ kind: 'toast', nickname: event.user.nickname, avatar: event.user.avatar,
      text: `${event.type === 'follow' ? '➕ follow' : '↗ chia sẻ live'} → lên hình 📸` });
    addHype(event.type === 'follow' ? 20 : 30, now, fx);
  }

  // Follow quý hơn share: lần follow đầu trong phiên được cả gói — thẻ lớn giữa màn + giọng đọc cảm ơn, pháo hoa,
  // SOLO sân khấu 6 giây, cánh neon + hào quang + danh hiệu FAN CỨNG trên đầu 10 phút. Bỏ follow rồi follow lại thì
  // chỉ được như share (lên camera), để một người không chiếm sân khấu mãi bằng cách follow đi follow lại.
  function onFollow(event, now, fx) {
    if (followed.has(event.user.id)) return cameraShoutout(event, now, fx);
    const d = ensureDancer(event.user, now, fx, { canEvict: true });
    if (!d) return cameraShoutout(event, now, fx);
    followed.add(d.id);
    d.fanUntil = now + FAN_MS;
    d.wingsUntil = Math.max(d.wingsUntil, now) + WINGS_MS;
    d.auraUntil = Math.max(d.auraUntil, now) + 120000;
    d.waveUntil = now + WAVE_MS;
    d.face = 'love';
    d.faceUntil = now + FACE_MS;
    fx.push({ kind: 'follow', userId: d.id, nickname: d.nickname, avatar: d.avatar || '' });
    fx.push({ kind: 'toast', nickname: d.nickname, avatar: d.avatar, text: '💖 follow → solo sân khấu 🎤', gold: true });
    fx.push({ kind: 'fireworks', power: 1 });
    enqueueSolo(d.id, FOLLOW_SOLO_TIER, FOLLOW_SOLO_MS, now);
    addHype(50, now, fx);
  }

  function onChat(event, now, fx) {
    const d = ensureDancer(event.user, now, fx, { canEvict: true });
    if (!d) return;
    const text = event.comment;
    const command = containsPhrase(text, LOOK_WORDS) ? 'look'
      : containsPhrase(text, GROW_WORDS) ? 'grow' : containsPhrase(text, SHRINK_WORDS) ? 'shrink'
        : containsPhrase(text, FLY_WORDS) ? 'fly'
          : containsPhrase(text, JUMP_WORDS) ? 'jump' : containsPhrase(text, HYPE_WORDS) ? 'hype'
            : containsPhrase(text, WAVE_WORDS) ? 'wave' : '';
    if (command && commandCooldown(d.id, now)) {
      if (command === 'look') {
        d.look += 1 + Math.floor(random() * 7);
        fx.push({ kind: 'look', userId: d.id });
      } else if (command === 'hype') d.hypeUntil = now + HYPE_MS;
      else if (command === 'jump') d.jumpUntil = now + JUMP_MS;
      else if (command === 'grow') d.size = Math.min(1.6, Math.round((d.size + 0.2) * 10) / 10);
      else if (command === 'shrink') d.size = Math.max(0.6, Math.round((d.size - 0.2) * 10) / 10);
      else if (command === 'fly') { // bay cao miễn phí: tối đa tầng 2 (quà mới lên cao hơn), không hạ tầng người đang cao sẵn
        if (d.level < 2) d.level += 1;
        d.levelUntil = Math.max(d.levelUntil, now + FREE_FLY_MS);
      }
      else d.waveUntil = now + WAVE_MS;
    }
    const face = faceForComment(text);
    if (face) {
      d.face = face;
      d.faceUntil = now + FACE_MS;
    }
    if (isCleanForDisplay(text) && foldText(text)) fx.push({ kind: 'bubble', userId: d.id, text: text.slice(0, 60) });
    if (chatHypeCooldown(d.id, now)) addHype(3, now, fx);
  }

  return {
    id: 'dance',
    title: 'Sàn Nhảy',
    handleEvent(event, now = Date.now()) {
      const fx = [];
      if (event.type === 'member') ensureDancer(event.user, now, fx, { canEvict: 'lurkers', engaged: false });
      else if (event.type === 'gift') onGift(event, now, fx);
      else if (event.type === 'chat') onChat(event, now, fx);
      else if (event.type === 'like') {
        const d = ensureDancer(event.user, now, fx, { canEvict: 'lurkers' });
        if (d && heartsCooldown(d.id, now)) fx.push({ kind: 'hearts', userId: d.id, count: Math.min(event.likeCount, 15) });
        if (d) {
          const before = d.likes;
          d.likes += event.likeCount;
          const crossed = (step) => Math.floor(d.likes / step) > Math.floor(before / step);
          if (crossed(LIKES_FOR_RIDE) && now >= d.rideUntil) {
            d.rideUntil = now + RIDE_MS; // xe bay miễn phí
            fx.push({ kind: 'toast', nickname: d.nickname, avatar: d.avatar, text: `❤ ${(Math.floor(d.likes / LIKES_FOR_RIDE) * LIKES_FOR_RIDE).toLocaleString('vi-VN')} tim → xe bay 🚗`, gold: true });
          } else if (crossed(LIKES_FOR_CAMERA)) {
            d.wingsUntil = Math.max(d.wingsUntil, now) + WINGS_MS; // "tym có cánh"
            fx.push({ kind: 'camera', userId: d.id, nickname: d.nickname, likes: d.likes });
            if (crossed(LIKES_FOR_FIREWORKS)) fx.push({ kind: 'fireworks', power: 1 });
          }
        }
        addHype(Math.min(event.likeCount, 30), now, fx);
      } else if (event.type === 'follow') onFollow(event, now, fx);
      else if (event.type === 'share') cameraShoutout(event, now, fx);
      advanceSolo(now, fx);
      return fx;
    },
    tick(now = Date.now()) {
      const fx = [];
      const keep = protectedIds(now);
      for (const d of dancers.values()) {
        if (d.seed) continue; // người ảo chỉ rời khi có người thật thay (syncSeeds)
        const limit = d.engaged ? ENGAGED_LEAVE_MS : WATCHER_LEAVE_MS;
        if (now - d.lastActive > limit && !keep.has(d.id)) {
          dancers.delete(d.id);
          fx.push({ kind: 'leave', userId: d.id });
          continue;
        }
        if (d.level && now > d.levelUntil) d.level = 0;
      }
      syncSeeds(now, fx);
      seedCrowd.act(seedsOnFloor(), now, { hype: HYPE_MS, jump: JUMP_MS, wave: WAVE_MS, face: FACE_MS });
      advanceSolo(now, fx);
      return fx;
    },
    command(name, now = Date.now()) {
      const fx = [];
      if (name === 'drop') startDrop(now, fx);
      else if (name === 'seeds') {
        seedCrowd.toggle();
        syncSeeds(now, fx);
      }
      else if (name === 'clear') {
        for (const id of dancers.keys()) fx.push({ kind: 'leave', userId: id });
        dancers.clear();
        queue = [];
        solo = null;
        hype = 0;
        dropUntil = 0;
      } else throw new Error(`Lệnh không hỗ trợ: ${name}`);
      return fx;
    },
    snapshot(now = Date.now()) {
      const rank = ranks();
      const dropping = now < dropUntil;
      return {
        hype,
        hypeGoal: HYPE_GOAL,
        dropMs: dropping ? dropUntil - now : 0,
        solo: solo ? { id: solo.id, tier: solo.tier, msLeft: Math.max(0, solo.until - now), durationMs: solo.until - solo.startedAt } : null,
        queue: queue.length,
        dancers: [...dancers.values()].sort((a, b) => a.slot - b.slot).map((d) => ({
          id: d.id, nickname: d.nickname, avatar: d.avatar, slot: d.slot, look: d.look, rank: rank.get(d.id) || 0,
          level: d.level, aura: now < d.auraUntil, giant: now < d.giantUntil,
          move: now < d.rideUntil ? 'ride' : now < d.jumpUntil ? 'jump' : dropping || now < d.hypeUntil ? 'hype' : now < d.waveUntil ? 'wave' : '',
          size: d.size, wings: now < d.wingsUntil, fan: now < d.fanUntil,
          face: now < d.faceUntil ? d.face : ''
        }))
      };
    }
  };
}
