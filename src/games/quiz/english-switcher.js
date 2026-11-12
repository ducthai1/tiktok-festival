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
  let deckQueue = [];
  // chưa có danh mục quà thật của phòng thì tạm gán theo quà mẫu; có danh mục thật thì gán lại từ đầu một lần rồi giữ cố định
  let assignments = assignEnglishGifts(SAMPLE_GIFTS);
  let fromCatalog = false;

  // ── Persistent bags: mỗi set ID giữ riêng ShuffleBag của mình.
  // Khi user quay lại bộ cũ, tiếp tục câu còn dở thay vì shuffle lại từ đầu.
  // Key của general bag: 'general:<level>' (vì dễ/khó dùng bộ khác nhau).
  const persistentBags = new Map();

  function bagKey() {
    return set === 'general' ? `general:${level}` : `set:${set}:${level}`;
  }

  function build() {
    const key = bagKey();
    if (!persistentBags.has(key)) {
      let newBag;
      if (set === 'general') {
        newBag = level === 'hard'
          ? createShuffleBag(filterByLevel(general, 'hard'), random)
          : createTieredDeck([filterByLevel(general, level), basic].filter((t) => t.length), random);
      } else {
        newBag = createShuffleBag(filterByLevel(sets[set], level), random);
      }
      persistentBags.set(key, newBag);
    }
    deck = persistentBags.get(key);
    dirty = false;
  }

  const MIN_QUESTIONS = 2; // tối thiểu câu/topic khi queue rất đông

  /** Adaptive: càng nhiều người chờ → chia đều câu, tối thiểu MIN_QUESTIONS. */
  function adaptiveQuestions(totalSlots) {
    return Math.max(MIN_QUESTIONS, Math.floor(ENGLISH_HOLD_QUESTIONS / Math.max(1, totalSlots)));
  }

  /** Tính lại số câu cho topic đang chạy và toàn bộ queue theo số slot hiện tại. */
  function rebalanceQueue() {
    const totalSlots = 1 + deckQueue.length; // topic đang chạy + queue
    const q = adaptiveQuestions(totalSlots);
    // Rút ngắn topic hiện tại nếu còn nhiều hơn mức mới (không kéo dài thêm)
    if (set !== 'general') setLeft = Math.min(setLeft, q);
    for (const item of deckQueue) item.questions = q;
  }

  function apply(to, user, giftInfo = null) {
    const target = ENGLISH_TARGETS[to];
    if (!target || (target.kind === 'set' && !sets[to]?.length)) return false;
    if (target.kind === 'reset') {
      reset();
      dirty = true;
      return true;
    }
    if (target.kind === 'level') {
      level = to;
      levelLeft = ENGLISH_HOLD_QUESTIONS;
      levelBy = user;
    } else {
      if (set === 'general' || setLeft <= 0) {
        // Queue rỗng hoặc vừa về general → áp dụng ngay, tính câu theo slot hiện tại
        set = to;
        setLeft = adaptiveQuestions(1 + deckQueue.length);
        setBy = user;
      } else {
        // Có topic đang chạy → đẩy vào queue rồi rebalance tất cả
        deckQueue.push({ to, user, questions: ENGLISH_HOLD_QUESTIONS, giftName: giftInfo?.name || '', giftPicture: giftInfo?.pictureUrl || '' });
        rebalanceQueue();
      }
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
    deckQueue = [];
    dirty = true;
  }

  return {
    deck: {
      next() {
        if (dirty) build();
        const q = deck.next();
        // mỗi câu ra tiêu một lượt; hết lượt thì từ câu sau quay về mặc định
        if (set !== 'general') {
          setLeft -= 1;
          if (setLeft <= 0) {
            if (deckQueue.length > 0) {
              const nextReq = deckQueue.shift();
              set = nextReq.to;
              setBy = nextReq.user;
              setLeft = nextReq.questions || ENGLISH_HOLD_QUESTIONS;
              dirty = true;
            } else {
              set = 'general';
              setBy = null;
              dirty = true;
            }
          }
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
      if (!to || !apply(to, { id: event.user.id, nickname: event.user.nickname, avatar: event.user.avatar }, gift)) {
        return [{ kind: 'quizGift', ...base, tier: 3, hint: '' }]; // món không nằm trong bảng: chỉ cảm ơn
      }
      const target = ENGLISH_TARGETS[to];
      return [{ kind: 'quizDeck', ...base, to, icon: target.icon, label: target.label, questions: setLeft, queueLength: deckQueue.length }];
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
    restore(s) {
      if (!s) return;
      if (s.set && (s.set === 'general' || sets[s.set]?.length)) {
        set = s.set;
        setLeft = Math.max(0, Number(s.setLeft) || 0);
        setBy = s.setBy || null;
      }
      if (s.level) {
        level = s.level;
        levelLeft = Math.max(0, Number(s.levelLeft) || 0);
        levelBy = s.levelBy || null;
      }
      if (Array.isArray(s.deckQueue)) {
        deckQueue = s.deckQueue.map((item) => ({
          to: item.to,
          user: item.user ? { id: item.user.id, nickname: item.user.nickname, avatar: item.user.avatar } : null,
          questions: Math.max(1, Number(item.questions) || ENGLISH_HOLD_QUESTIONS),
          giftName: item.giftName || '',
          giftPicture: item.giftPicture || ''
        })).filter((item) => ENGLISH_TARGETS[item.to] && (ENGLISH_TARGETS[item.to].kind === 'level' || sets[item.to]?.length));
      }
      // Tự rebalance sau restore: nếu queue đông thì rút ngắn câu ngay
      if (set !== 'general' || deckQueue.length > 0) rebalanceQueue();
      dirty = true;
    },
    snapshot() {
      const s = set === 'general' ? ENGLISH_DEFAULTS.set : ENGLISH_TARGETS[set];
      const l = level === 'normal' ? ENGLISH_DEFAULTS.level : ENGLISH_TARGETS[level];
      return {
        set, setIcon: s.icon, setLabel: s.label, setLeft: set === 'general' ? 0 : setLeft, setBy,
        level, levelIcon: l.icon, levelLabel: l.label, levelLeft: level === 'normal' ? 0 : levelLeft, levelBy,
        deckQueue: deckQueue.map((q) => ({
          to: q.to,
          label: ENGLISH_TARGETS[q.to]?.label || q.to,
          icon:  ENGLISH_TARGETS[q.to]?.icon  || '🔤',
          nickname: q.user?.nickname || '',
          giftName: q.giftName || '',
          // ── Lưu đủ để restore adaptive queue đúng ──
          questions: q.questions || ENGLISH_HOLD_QUESTIONS,
          user: q.user ? { id: q.user.id, nickname: q.user.nickname, avatar: q.user.avatar } : null,
          giftPicture: q.giftPicture || ''
        })),
        rules: assignments.map((a) => ({ to: a.to, icon: ENGLISH_TARGETS[a.to].icon, label: ENGLISH_TARGETS[a.to].label, gift: a.gift }))
      };
    }
  };
}
