// Bộ đề + độ khó của tab Từ Vựng Tiếng Anh, đổi bằng quà dưới 20 xu (bảng gán quà ở public/shared/english-sets.js).
// Đổi có hiệu lực từ CÂU SAU (câu đang hỏi không bị cắt ngang), giữ ENGLISH_HOLD_QUESTIONS câu rồi tự về mặc định.
// Quà ở tab này KHÔNG mở gợi ý và không cộng điểm cho người tặng — chỉ đổi đề cho cả phòng + hiện tên người đổi.
import { ENGLISH_DEFAULTS, ENGLISH_HOLD_QUESTIONS, ENGLISH_TARGETS, assignEnglishGifts, englishTargetFor } from '../../../public/shared/english-sets.js';
import { SAMPLE_GIFTS } from '../../../public/shared/gift-tiers.js';
import { createShuffleBag, createTieredDeck } from './quiz-bank.js';

const MIN_POOL = 15;

/** easy = câu bậc 1, hard = câu bậc 3; bộ nào ít câu quá thì nới ra (≤2 / ≥2). */
export function filterByLevel(items, level) {
  if (level !== 'easy' && level !== 'hard') return items;
  const strict = items.filter((q) => (level === 'easy' ? q.level === 1 : q.level === 3));
  if (strict.length >= MIN_POOL) return strict;
  const loose = items.filter((q) => (level === 'easy' ? q.level <= 2 : q.level >= 2));
  return loose.length ? loose : items;
}

/** general: từ theo chủ đề; basic: 176 từ cơ bản (luôn để cuối); sets: { toeic: [...], ielts: [...], … } */
export function createEnglishSwitcher({ general, basic, sets, random = Math.random }) {
  let set = 'general';
  let level = 'normal';
  let setLeft = 0;
  let levelLeft = 0;
  let setBy = null;
  let levelBy = null;
  let deck = null;
  let dirty = true;
  // chưa có danh mục quà thật của phòng thì tạm gán theo quà mẫu; có danh mục thật thì gán lại từ đầu một lần rồi giữ cố định
  let assignments = assignEnglishGifts(SAMPLE_GIFTS);
  let fromCatalog = false;

  function build() {
    if (set === 'general') {
      // khó: chỉ từ bậc 3 theo chủ đề; dễ / vừa: từ theo chủ đề trước, 176 từ cơ bản cuối danh sách
      deck = level === 'hard' ? createShuffleBag(filterByLevel(general, 'hard'), random)
        : createTieredDeck([filterByLevel(general, level), basic], random);
    } else deck = createShuffleBag(filterByLevel(sets[set], level), random);
    dirty = false;
  }

  function apply(to, user) {
    const target = ENGLISH_TARGETS[to];
    if (!target || (target.kind === 'set' && !sets[to]?.length)) return false;
    if (target.kind === 'level') {
      level = to;
      levelLeft = ENGLISH_HOLD_QUESTIONS;
      levelBy = user;
    } else {
      set = to;
      setLeft = ENGLISH_HOLD_QUESTIONS;
      setBy = user;
    }
    dirty = true;
    return true;
  }

  function reset() {
    set = 'general';
    level = 'normal';
    setLeft = 0;
    levelLeft = 0;
    setBy = null;
    levelBy = null;
    dirty = true;
  }

  return {
    deck: {
      next() {
        if (dirty) build();
        const q = deck.next();
        // mỗi câu ra tiêu một lượt; hết lượt thì từ câu sau quay về mặc định
        if (set !== 'general' && (setLeft -= 1) <= 0) {
          set = 'general';
          setBy = null;
          dirty = true;
        }
        if (level !== 'normal' && (levelLeft -= 1) <= 0) {
          level = 'normal';
          levelBy = null;
          dirty = true;
        }
        return q;
      }
    },
    /** Danh mục quà thật của phòng (server lưu lại giữa các buổi live). */
    setCatalog(catalog) {
      if (!catalog?.length) return;
      const next = assignEnglishGifts(catalog, fromCatalog ? assignments : []);
      if (next.length) {
        assignments = next;
        fromCatalog = true;
      }
    },
    onGift(event) {
      const gift = event.gift;
      const to = englishTargetFor(assignments, gift);
      const base = { userId: event.user.id, nickname: event.user.nickname, avatar: event.user.avatar, giftName: gift.name,
        giftPicture: gift.pictureUrl, count: gift.count };
      if (!to || !apply(to, { id: event.user.id, nickname: event.user.nickname, avatar: event.user.avatar })) {
        return [{ kind: 'quizGift', ...base, tier: 3, hint: '' }]; // món không nằm trong bảng: chỉ cảm ơn
      }
      const target = ENGLISH_TARGETS[to];
      return [{ kind: 'quizDeck', ...base, to, icon: target.icon, label: target.label, questions: ENGLISH_HOLD_QUESTIONS }];
    },
    /** Nút ở trang điều khiển: deck-<đích> (đổi tay, không ghi tên ai) hoặc resetDeck. */
    command(name) {
      if (name === 'resetDeck') {
        reset();
        return [{ kind: 'toast', text: `${ENGLISH_DEFAULTS.set.icon} Về bộ ${ENGLISH_DEFAULTS.set.label} · ${ENGLISH_DEFAULTS.level.label}` }];
      }
      const to = name.startsWith('deck-') ? name.slice(5) : '';
      if (!to || !apply(to, null)) return null;
      return [{ kind: 'toast', text: `${ENGLISH_TARGETS[to].icon} Đổi sang ${ENGLISH_TARGETS[to].label} (từ câu sau)` }];
    },
    snapshot() {
      const s = set === 'general' ? ENGLISH_DEFAULTS.set : ENGLISH_TARGETS[set];
      const l = level === 'normal' ? ENGLISH_DEFAULTS.level : ENGLISH_TARGETS[level];
      return {
        set, setIcon: s.icon, setLabel: s.label, setLeft: set === 'general' ? 0 : setLeft, setBy,
        level, levelIcon: l.icon, levelLabel: l.label, levelLeft: level === 'normal' ? 0 : levelLeft, levelBy,
        rules: assignments.map((a) => ({ to: a.to, icon: ENGLISH_TARGETS[a.to].icon, label: ENGLISH_TARGETS[a.to].label, gift: a.gift }))
      };
    }
  };
}
