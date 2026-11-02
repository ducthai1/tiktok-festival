// QUÁN BAR — người xem bình luận/tặng quà là có chỗ trong quán (6 ghế quầy + 16 ô sàn nhảy).
// Quà = gọi đồ uống, thả tim + bình luận làm đầy "độ quẩy"; đầy thì cả quán mở tiệc.
import { containsPhrase, createCooldown, isCleanForDisplay } from './text-match.js';

export const BAR_SEATS = 22; // ghế 0–5 là quầy, 6–21 là sàn nhảy
const IDLE_LEAVE_MS = 6 * 60 * 1000;
const DRINK_MS = 60 * 1000;
const DANCE_MS = 8000;
const CHEERS_MS = 3000;
const PARTY_MS = 25000;
export const VIBE_GOAL = 1000;

const DANCE_WORDS = ['nhay', 'dance', 'quay', 'quay len', 'bung', 'phe'];
const CHEERS_WORDS = ['cung ly', 'nang ly', 'cheers', 'zo', 'dzo', 'yo', 'mot hai ba zo', 'tram phan tram'];

export function drinkForDiamonds(diamonds) {
  if (diamonds >= 500) return 'party';
  if (diamonds >= 100) return 'tower';
  if (diamonds >= 30) return 'champagne';
  if (diamonds >= 5) return 'cocktail';
  return 'beer';
}

export function createBarClubGame({ random = Math.random } = {}) {
  const patrons = new Map();
  const spenders = new Map(); // diamonds theo người trong phiên, để giữ ghế cho khách VIP
  const chatVibeCooldown = createCooldown(5000);
  let vibe = 0;
  let partyUntil = 0;

  function vipIds() {
    return new Set([...spenders.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id));
  }

  function freeSeat() {
    const used = new Set([...patrons.values()].map((p) => p.seat));
    const free = [];
    for (let seat = 0; seat < BAR_SEATS; seat += 1) if (!used.has(seat)) free.push(seat);
    return free.length ? free[Math.floor(random() * free.length)] : -1;
  }

  // Hết chỗ: mời người CHỈ VÀO XEM ra trước, rồi mới tới khách ngồi im lâu nhất (top 3 tặng quà luôn giữ chỗ).
  // onlyLurkers: người mới vào phòng chỉ được thế chỗ người cũng mới vào, không đẩy người đang tương tác.
  function evictIdlest(fx, onlyLurkers = false) {
    const vip = vipIds();
    const candidates = [...patrons.values()]
      .filter((p) => !vip.has(p.id) && (!onlyLurkers || !p.engaged))
      .sort((a, b) => Number(a.engaged) - Number(b.engaged) || a.lastActive - b.lastActive);
    const out = candidates[0];
    if (!out) return -1;
    patrons.delete(out.id);
    fx.push({ kind: 'leave', userId: out.id });
    return out.seat;
  }

  function ensurePatron(user, now, fx, { canEvict, engaged = true }) {
    let patron = patrons.get(user.id);
    if (!patron) {
      let seat = freeSeat();
      if (seat < 0 && canEvict) seat = evictIdlest(fx, canEvict === 'lurkers');
      if (seat < 0) return null;
      patron = { id: user.id, seat, joinedAt: now, engaged: false, drink: '', drinkUntil: 0, danceUntil: 0, cheersUntil: 0 };
      patrons.set(user.id, patron);
      fx.push({ kind: 'join', userId: user.id, nickname: user.nickname });
    }
    patron.nickname = user.nickname;
    patron.avatar = user.avatar;
    patron.lastActive = now;
    patron.engaged = patron.engaged || engaged;
    return patron;
  }

  function addVibe(amount, now, fx) {
    if (now < partyUntil) return;
    vibe += amount;
    if (vibe >= VIBE_GOAL) startParty(now, fx);
  }

  function startParty(now, fx) {
    vibe = 0;
    partyUntil = now + PARTY_MS;
    fx.push({ kind: 'party', durationMs: PARTY_MS });
  }

  function onGift(event, now, fx) {
    const { gift, user } = event;
    spenders.set(user.id, (spenders.get(user.id) || 0) + gift.diamonds);
    const patron = ensurePatron(user, now, fx, { canEvict: true });
    const drink = drinkForDiamonds(gift.diamonds);
    if (patron) {
      patron.drink = drink === 'party' || drink === 'tower' ? 'champagne' : drink;
      patron.drinkUntil = now + DRINK_MS;
      patron.cheersUntil = now + CHEERS_MS;
    }
    fx.push({ kind: 'drink', userId: user.id, nickname: user.nickname, drink, giftName: gift.name, count: gift.count, diamonds: gift.diamonds });
    if (drink === 'tower' || drink === 'party') {
      for (const p of patrons.values()) p.cheersUntil = now + CHEERS_MS;
      fx.push({ kind: 'fireworks', power: drink === 'party' ? 3 : 1 });
    }
    if (drink === 'party') startParty(now, fx);
    else addVibe(gift.diamonds * 10, now, fx);
  }

  function onChat(event, now, fx) {
    const patron = ensurePatron(event.user, now, fx, { canEvict: true });
    if (!patron) return;
    if (containsPhrase(event.comment, DANCE_WORDS)) patron.danceUntil = now + DANCE_MS;
    if (containsPhrase(event.comment, CHEERS_WORDS)) patron.cheersUntil = now + CHEERS_MS;
    if (isCleanForDisplay(event.comment)) fx.push({ kind: 'bubble', userId: patron.id, text: event.comment.slice(0, 60) });
    if (chatVibeCooldown(patron.id, now)) addVibe(3, now, fx);
  }

  return {
    id: 'bar',
    title: 'Quán Bar',
    handleEvent(event, now = Date.now()) {
      const fx = [];
      if (event.type === 'member') ensurePatron(event.user, now, fx, { canEvict: 'lurkers', engaged: false });
      else if (event.type === 'gift') onGift(event, now, fx);
      else if (event.type === 'chat') onChat(event, now, fx);
      else if (event.type === 'like') {
        ensurePatron(event.user, now, fx, { canEvict: 'lurkers' });
        addVibe(Math.min(event.likeCount, 30), now, fx);
      } else if (event.type === 'follow' || event.type === 'share') {
        const patron = ensurePatron(event.user, now, fx, { canEvict: true });
        if (patron) patron.cheersUntil = now + CHEERS_MS;
        fx.push({ kind: 'toast', text: `${event.user.nickname} vừa ${event.type === 'follow' ? 'theo dõi' : 'chia sẻ'} quán` });
        addVibe(event.type === 'follow' ? 20 : 30, now, fx);
      }
      return fx;
    },
    tick(now = Date.now()) {
      const fx = [];
      for (const p of patrons.values()) {
        if (now - p.lastActive > IDLE_LEAVE_MS) {
          patrons.delete(p.id);
          fx.push({ kind: 'leave', userId: p.id });
        } else if (p.drink && now > p.drinkUntil) p.drink = '';
      }
      return fx;
    },
    command(name, now = Date.now()) {
      const fx = [];
      if (name === 'party') startParty(now, fx);
      else if (name === 'clear') {
        for (const id of patrons.keys()) fx.push({ kind: 'leave', userId: id });
        patrons.clear();
        vibe = 0;
        partyUntil = 0;
      } else throw new Error(`Lệnh không hỗ trợ: ${name}`);
      return fx;
    },
    snapshot(now = Date.now()) {
      const party = now < partyUntil;
      const vip = vipIds();
      return {
        vibe,
        vibeGoal: VIBE_GOAL,
        partyMs: party ? partyUntil - now : 0,
        patrons: [...patrons.values()].map((p) => ({
          id: p.id, nickname: p.nickname, avatar: p.avatar, seat: p.seat, drink: p.drink,
          vip: vip.has(p.id), dancing: party || now < p.danceUntil, cheers: now < p.cheersUntil
        }))
      };
    }
  };
}
