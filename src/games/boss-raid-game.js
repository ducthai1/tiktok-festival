// ĐẠI CHIẾN BOSS HẮC ÁM (WORLD BOSS RAID) — Cả phòng livestream hợp sức diệt Boss.
// Người xem thả tim để nạp thanh Cuồng Nộ (Frenzy Mode x2 sát thương), comment "chem"/"ban" để tấn công,
// và tặng quà để tung tuyệt kỹ sấm sét / rồng thần / thiên thạch diệt Boss.
// Boss gục ngã thì nổ rương kho báu, vinh danh Top Dũng Sĩ và thăng cấp Boss trâu hơn.
import { containsPhrase, createCooldown } from './text-match.js';
import { giftTier } from '../../public/shared/gift-tiers.js';

export const BASE_BOSS_HP = 10000;
export const CELEBRATE_MS = 8000;
export const FRENZY_DURATION_MS = 20000;
export const MAX_CONTRIBUTORS = 300; // Giới hạn bộ nhớ tránh rò rỉ RAM khi stream kéo dài

const BOSS_NAMES = [
  'TITAN HẮC ÁM',
  'GOLEM NHAM THẠCH',
  'CHÚA TỂ TÀN BẠO',
  'MA VƯƠNG HỦY DIỆT',
  'RỒNG LỬA CỔ ĐẠI',
  'THẦN CHIẾN TỐI CAO'
];

const ATTACK_WORDS = [
  'chem', 'ban', 'danh', 'attack', 'kill',
  'go', 'tan cong', 'xung phong', 'pk', 'diet boss', 'diet'
];

export function bossNameForLevel(level) {
  const idx = Math.max(0, (level - 1) % BOSS_NAMES.length);
  return `${BOSS_NAMES[idx]}${level > BOSS_NAMES.length ? ` (Cấp ${level})` : ''}`;
}

export function damageForGift(diamondsEach, coinsTotal, isFrenzy = false, random = Math.random) {
  const tier = giftTier(diamondsEach);
  const mults = { 1: 12, 2: 16, 3: 20, 4: 25, 5: 30, 6: 40 };
  const baseRate = mults[tier] || 12;
  let dmg = Math.max(10, Math.round(coinsTotal * baseRate));

  // 12% tỷ lệ nảy bạo kích x2 sát thương
  const isCrit = random() < 0.12;
  if (isCrit) dmg *= 2;

  // Cuồng nộ x2 sát thương
  if (isFrenzy) dmg *= 2;

  return { damage: dmg, isCrit, tier };
}

export function createBossRaidGame({ random = Math.random } = {}) {
  const attackCooldown = createCooldown(2500);
  const contributors = new Map(); // userId -> { id, nickname, avatar, damage, hits, lastAt }
  let level = 1;
  let maxHp = BASE_BOSS_HP;
  let hp = maxHp;
  let rage = 0; // 0 - 100
  let frenzyUntil = 0;
  let celebrateUntil = 0;
  let status = 'fighting'; // 'fighting' | 'celebrating'

  function resetLevel(lvl = 1) {
    level = Math.max(1, lvl);
    // Mỗi level tăng 25% máu
    maxHp = Math.round(BASE_BOSS_HP * Math.pow(1.25, level - 1));
    hp = maxHp;
    rage = 0;
    frenzyUntil = 0;
    celebrateUntil = 0;
    status = 'fighting';
    contributors.clear();
  }

  function topContributors(limit = 5) {
    return [...contributors.values()]
      .sort((a, b) => b.damage - a.damage)
      .slice(0, limit)
      .map((c) => ({
        id: c.id,
        nickname: c.nickname,
        avatar: c.avatar,
        damage: c.damage,
        score: c.damage.toLocaleString('vi-VN')
      }));
  }

  function credit(user, dmg, now) {
    if (!user || !user.id || dmg <= 0) return;
    const cur = contributors.get(user.id) || {
      id: user.id,
      nickname: user.nickname || 'Dũng sĩ',
      avatar: user.avatar || '',
      damage: 0,
      hits: 0,
      lastAt: now
    };
    cur.damage += dmg;
    cur.hits += 1;
    cur.nickname = user.nickname || cur.nickname;
    cur.avatar = user.avatar || cur.avatar;
    cur.lastAt = now;
    contributors.set(user.id, cur);

    // Dọn dẹp cache nếu danh sách quá lớn
    if (contributors.size > MAX_CONTRIBUTORS) {
      let oldestKey = null;
      let oldestTime = Infinity;
      for (const [k, v] of contributors.entries()) {
        if (v.lastAt < oldestTime) {
          oldestTime = v.lastAt;
          oldestKey = k;
        }
      }
      if (oldestKey) contributors.delete(oldestKey);
    }
  }

  function applyDamage(amount, fx, user, attackType, isCrit, now) {
    if (status !== 'fighting' || amount <= 0) return;
    const actual = Math.min(hp, amount);
    hp = Math.max(0, hp - actual);

    if (user) credit(user, actual, now);

    fx.push({
      kind: 'bossHit',
      attackType,
      damage: actual,
      isCrit: !!isCrit,
      userId: user?.id,
      nickname: user?.nickname,
      avatar: user?.avatar,
      hp,
      maxHp
    });

    if (hp <= 0) {
      status = 'celebrating';
      celebrateUntil = now + CELEBRATE_MS;
      fx.push({
        kind: 'bossDefeated',
        level,
        bossName: bossNameForLevel(level),
        top: topContributors(3),
        nextInSeconds: Math.round(CELEBRATE_MS / 1000)
      });
    }
  }

  return {
    id: 'boss',
    title: '⚔️ Săn Boss',

    handleEvent(event, now = Date.now()) {
      const fx = [];
      const isFrenzy = now < frenzyUntil;

      // Đang ăn mừng thì không nhận đòn đánh
      if (status === 'celebrating') {
        return fx;
      }

      if (event.type === 'like') {
        const count = Math.max(1, event.likes || 1);
        // Nạp thanh nộ (1 like = 0.12%)
        rage = Math.min(100, rage + count * 0.12);
        if (rage >= 100 && !isFrenzy) {
          rage = 0;
          frenzyUntil = now + FRENZY_DURATION_MS;
          fx.push({ kind: 'bossFrenzy', durationMs: FRENZY_DURATION_MS, until: frenzyUntil });
        }
        const dmg = (isFrenzy ? 3 : 1) * count;
        applyDamage(dmg, fx, event.user, 'like', false, now);
        return fx;
      }

      if (event.type === 'chat') {
        const text = String(event.comment || '').trim();
        if (containsPhrase(text, ATTACK_WORDS)) {
          if (attackCooldown(event.user.id, now)) {
            const baseDmg = isFrenzy ? 30 : 15;
            applyDamage(baseDmg, fx, event.user, 'slash', false, now);
          }
        }
        return fx;
      }

      if (event.type === 'follow' || event.type === 'share') {
        const dmg = isFrenzy ? 120 : 60;
        applyDamage(dmg, fx, event.user, 'thunder', false, now);
        return fx;
      }

      if (event.type === 'gift') {
        const diamondsEach = event.diamondsEach || (event.coinsTotal / Math.max(1, event.count || 1)) || 1;
        const coinsTotal = event.coinsTotal || diamondsEach * Math.max(1, event.count || 1);
        const { damage, isCrit, tier } = damageForGift(diamondsEach, coinsTotal, isFrenzy, random);
        applyDamage(damage, fx, event.user, `gift_t${tier}`, isCrit, now);
        return fx;
      }

      return fx;
    },

    tick(now = Date.now()) {
      const fx = [];
      if (status === 'celebrating' && now >= celebrateUntil) {
        // Hết thời gian ăn mừng -> Hồi sinh Boss cấp tiếp theo
        resetLevel(level + 1);
        fx.push({
          kind: 'bossRespawn',
          level,
          bossName: bossNameForLevel(level),
          maxHp
        });
      }
      return fx;
    },

    command(name, now = Date.now()) {
      const fx = [];
      if (name === 'resetBoss') {
        resetLevel(1);
        fx.push({ kind: 'bossReset', level: 1, bossName: bossNameForLevel(1), maxHp });
      } else if (name === 'killBoss') {
        if (status === 'fighting') {
          applyDamage(hp, fx, { id: 'admin', nickname: 'Chủ phòng', avatar: '' }, 'admin_strike', true, now);
        }
      } else if (name === 'frenzy') {
        rage = 0;
        frenzyUntil = now + FRENZY_DURATION_MS;
        fx.push({ kind: 'bossFrenzy', durationMs: FRENZY_DURATION_MS, until: frenzyUntil });
      }
      return fx;
    },

    snapshot(now = Date.now()) {
      const isFrenzy = now < frenzyUntil;
      return {
        level,
        bossName: bossNameForLevel(level),
        hp,
        maxHp,
        hpRatio: maxHp > 0 ? hp / maxHp : 0,
        rage: isFrenzy ? 100 : Math.round(rage),
        isFrenzy,
        frenzyTimeLeftMs: Math.max(0, frenzyUntil - now),
        status,
        celebrateLeftMs: Math.max(0, celebrateUntil - now),
        contributors: topContributors(5)
      };
    }
  };
}
