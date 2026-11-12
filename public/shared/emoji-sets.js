import { giftEmoji } from './gift-tiers.js';
import { foldText } from './profanity-filter.js';

export const EMOJI_HOLD_QUESTIONS = 30;
export const EMOJI_MAX_COINS = 20;

export const EMOJI_TARGETS = {
  song: { kind: 'set', cat: 'Bài hát', icon: '🎵', label: 'Bài hát', price: 1 },
  movie: { kind: 'set', cat: 'Phim', icon: '🎬', label: 'Phim', price: 1 },
  food: { kind: 'set', cat: 'Đồ ăn', icon: '🍲', label: 'Đồ ăn', price: 5 },
  item: { kind: 'set', cat: 'Vật dụng', icon: '🎒', label: 'Vật dụng', price: 5 },
  idiom: { kind: 'set', cat: 'Thành ngữ', icon: '📜', label: 'Thành ngữ', price: 10 },
  place: { kind: 'set', cat: 'Địa danh', icon: '🗺️', label: 'Địa danh', price: 10 },
  trend: { kind: 'set', cat: 'Hot trend', icon: '🔥', label: 'Hot trend', price: 10 }
};

export const EMOJI_DEFAULTS = { set: { icon: '🧩', label: 'Chủ đề: Tổng hợp' }, level: { icon: '⚖️', label: 'Độ khó: Thường' } };
const ORDER = ['song', 'movie', 'food', 'item', 'idiom', 'place', 'trend'];

const nameKeys = (g) => [foldText(g?.name), foldText(g?.en)].filter(Boolean);
const coinsOf = (g) => Number(g?.diamondsEach ?? g?.coins) || 0;

export function sameGift(a, b) {
  if (a?.id && b?.id && !/^[a-z-]+$/.test(String(a.id)) && !/^[a-z-]+$/.test(String(b.id))) return String(a.id) === String(b.id);
  const keys = new Set(nameKeys(a));
  return nameKeys(b).some((k) => keys.has(k));
}

export function assignEmojiGifts(catalog, previous = []) {
  const cheap = (catalog || []).filter((g) => coinsOf(g) >= 1 && coinsOf(g) <= EMOJI_MAX_COINS);
  const out = new Map();
  const usedIds = new Set();

  // Giữ lại quà cũ nếu vẫn còn trong danh mục
  for (const to of ORDER) {
    const prev = previous.find(p => p.to === to);
    if (prev) {
      const still = cheap.find(g => sameGift(g, prev.gift));
      if (still) {
        out.set(to, still);
        usedIds.add(still.id || still.name);
      }
    }
  }

  // Điền nốt các ô trống theo mức giá mục tiêu
  for (const to of ORDER) {
    if (!out.has(to)) {
      const targetPrice = EMOJI_TARGETS[to].price;
      const candidates = cheap.filter(g => !usedIds.has(g.id || g.name))
        .sort((a, b) => Math.abs(coinsOf(a) - targetPrice) - Math.abs(coinsOf(b) - targetPrice) 
                        || coinsOf(a) - coinsOf(b)
                        || (b.image ? 1 : 0) - (a.image ? 1 : 0));
      
      if (candidates.length) {
        const best = candidates[0];
        out.set(to, best);
        usedIds.add(best.id || best.name);
      }
    }
  }

  return ORDER.filter((to) => out.has(to)).map((to) => {
    const g = out.get(to);
    const target = EMOJI_TARGETS[to];
    return { to, label: target.label, icon: target.icon, gift: { id: String(g.id || ''), name: g.name, coins: coinsOf(g), image: g.image || '', emoji: g.emoji || giftEmoji(g.name) } };
  });
}

export function emojiTargetFor(assignments, gift) {
  return assignments.find((a) => sameGift(a.gift, gift))?.to || null;
}
