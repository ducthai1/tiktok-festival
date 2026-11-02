// ĐUA BƠI VƯỢT RÀO — cả phòng live hợp sức đưa vận động viên bơi 1000 m.
// Dọc đường có 4 bức tường; người bơi tự đập tường rất chậm, người xem gọi "trợ thủ"
// (vịt phao, ván lướt, thuyền, cá heo, cá mập, cá voi, tàu ngầm) để đẩy/phá tường.
// Thắng đủ WIN_TARGET vòng là VÔ ĐỊCH. Thiết kế số liệu riêng, không lấy từ bản tham khảo.
import { containsPhrase, createCooldown } from './text-match.js';
import { giftTier } from '../../public/shared/gift-tiers.js';

export const GOAL_METERS = 1000;
export const WIN_TARGET = 7;
const BASE_SPEED = 2; // m/giây
const FLIPPER_FACTOR = 1.8;
const FLIPPER_MS_PER_GIFT = 4000;
const FLIPPER_MAX_MS = 30000;
const CELEBRATE_MS = 8000;
const WALLS = [
  { at: 200, hp: 120 },
  { at: 400, hp: 240 },
  { at: 600, hp: 380 },
  { at: 800, hp: 520 }
];

// Trợ thủ theo giá MỘT món quà (kim cương/món); push = mét khi đường trống, = sát thương khi gặp tường.
export const HELPERS = [
  { min: 5000, helper: 'submarine', label: 'Tàu ngầm', push: 600 },
  { min: 499, helper: 'whale', label: 'Cá voi', push: 350 },
  { min: 99, helper: 'shark', label: 'Cá mập', push: 150 },
  { min: 30, helper: 'dolphin', label: 'Cá heo', push: 90 },
  { min: 10, helper: 'boat', label: 'Thuyền', push: 50 },
  { min: 5, helper: 'surfer', label: 'Ván lướt', push: 25 },
  { min: 1, helper: 'flipper', label: 'Chân vịt', push: 0 }
];
export const DUCK = { helper: 'duck', label: 'Vịt phao', push: 3 };
const SURFER = HELPERS.find((h) => h.helper === 'surfer');
const CHEER_WORDS = ['co len', 'go', 'boi', 'boi di', 'len', 'tien len', 'day', 'push', 'nhanh len', 'co gang'];

export function helperForGift(diamondsEach) {
  return HELPERS.find((h) => diamondsEach >= h.min) || HELPERS[HELPERS.length - 1];
}

export function createSwimPushGame() {
  const cheerCooldown = createCooldown(8000);
  const contributors = new Map(); // mét/sát thương mỗi người góp trong vòng này
  let position = 0;
  let walls = [];
  let wins = 0;
  let flipperUntil = 0;
  let celebrateUntil = 0;
  let paused = false;
  let lastTick = null;

  function resetRound() {
    position = 0;
    const difficulty = 1 + wins * 0.15; // vòng sau tường cứng hơn
    walls = WALLS.map((w) => ({ at: w.at, maxHp: Math.round(w.hp * difficulty), hp: Math.round(w.hp * difficulty) }));
    contributors.clear();
    flipperUntil = 0;
  }
  resetRound();

  const nextWall = () => walls.find((w) => w.hp > 0 && position <= w.at);

  // Đẩy về phía trước; gặp tường thì phần còn lại thành sát thương lên tường.
  function advance(amount, fx) {
    let left = amount;
    while (left > 0 && position < GOAL_METERS) {
      const wall = nextWall();
      const stop = wall ? wall.at : GOAL_METERS;
      const free = Math.min(left, stop - position);
      position += free;
      left -= free;
      if (left > 0 && wall) {
        const dmg = Math.min(left, wall.hp);
        wall.hp -= dmg;
        left -= dmg;
        if (wall.hp <= 0) fx.push({ kind: 'wallBreak', at: wall.at });
      }
    }
  }

  function credit(user, amount) {
    const entry = contributors.get(user.id) || { id: user.id, nickname: user.nickname, avatar: user.avatar, meters: 0 };
    entry.meters += amount;
    entry.nickname = user.nickname;
    contributors.set(user.id, entry);
  }

  function sendHelper(user, helper, units, fx, now) {
    const shownUnits = Math.min(units, 6);
    if (helper.helper === 'flipper') {
      flipperUntil = Math.min(Math.max(flipperUntil, now) + FLIPPER_MS_PER_GIFT * units, now + FLIPPER_MAX_MS);
      credit(user, units * 2);
    } else {
      advance(helper.push * units, fx);
      credit(user, helper.push * units);
    }
    fx.push({ kind: 'helper', helper: helper.helper, label: helper.label, units, shownUnits,
      userId: user.id, nickname: user.nickname, avatar: user.avatar, push: helper.push * units });
  }

  function checkFinish(now, fx) {
    if (position < GOAL_METERS || celebrateUntil) return;
    wins += 1;
    const champion = wins >= WIN_TARGET;
    const mvp = [...contributors.values()].sort((a, b) => b.meters - a.meters)[0] || null;
    fx.push({ kind: champion ? 'champion' : 'finish', wins, mvp });
    celebrateUntil = now + CELEBRATE_MS;
  }

  return {
    id: 'swim',
    title: 'Đua Bơi Vượt Rào',
    handleEvent(event, now = Date.now()) {
      const fx = [];
      if (celebrateUntil || paused) return fx;
      const { user } = event;
      if (event.type === 'gift') {
        // Tên lửa / Sư tử / Vũ trụ (bậc 6): tàu ngầm đẩy 3 lần mỗi món
        const boost = giftTier(event.gift.diamondsEach) >= 6 ? 3 : 1;
        sendHelper(user, helperForGift(event.gift.diamondsEach || 1), event.gift.count * boost, fx, now);
      } else if (event.type === 'like') {
        sendHelper(user, DUCK, Math.min(3, Math.ceil(event.likeCount / 5)), fx, now);
      } else if (event.type === 'follow' || event.type === 'share') {
        sendHelper(user, SURFER, 1, fx, now);
      } else if (event.type === 'chat' && containsPhrase(event.comment, CHEER_WORDS) && cheerCooldown(user.id, now)) {
        sendHelper(user, DUCK, 1, fx, now);
      }
      checkFinish(now, fx);
      return fx;
    },
    tick(now = Date.now()) {
      const fx = [];
      const dt = lastTick === null ? 0 : Math.min(1, Math.max(0, now - lastTick) / 1000);
      lastTick = now;
      if (celebrateUntil) {
        if (now >= celebrateUntil) {
          celebrateUntil = 0;
          if (wins >= WIN_TARGET) wins = 0;
          resetRound();
          fx.push({ kind: 'roundStart' });
        }
        return fx;
      }
      if (paused || dt === 0) return fx;
      const speed = BASE_SPEED * (now < flipperUntil ? FLIPPER_FACTOR : 1);
      advance(speed * dt, fx);
      checkFinish(now, fx);
      return fx;
    },
    command(name, now = Date.now()) {
      if (name === 'pause') paused = true;
      else if (name === 'resume') paused = false;
      else if (name === 'resetRound') {
        celebrateUntil = 0;
        resetRound();
      } else if (name === 'resetWins') {
        wins = 0;
        celebrateUntil = 0;
        resetRound();
      } else throw new Error(`Lệnh không hỗ trợ: ${name}`);
      lastTick = now;
      return [{ kind: 'roundStart' }];
    },
    snapshot(now = Date.now()) {
      const wall = nextWall();
      return {
        position: Math.round(position * 10) / 10,
        goal: GOAL_METERS,
        wins,
        winTarget: WIN_TARGET,
        paused,
        celebrating: Boolean(celebrateUntil),
        flipperMs: Math.max(0, flipperUntil - now),
        blocked: Boolean(wall && position >= wall.at),
        walls: walls.map((w) => ({ at: w.at, hp: Math.round(w.hp), maxHp: w.maxHp })),
        contributors: [...contributors.values()].sort((a, b) => b.meters - a.meters).slice(0, 5)
          .map((c) => ({ ...c, meters: Math.round(c.meters) }))
      };
    }
  };
}
