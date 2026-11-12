import { EMOJI_DEFAULTS, EMOJI_HOLD_QUESTIONS, EMOJI_TARGETS, assignEmojiGifts, emojiTargetFor } from '../../../public/shared/emoji-sets.js';
import { SAMPLE_GIFTS } from '../../../public/shared/gift-tiers.js';
import { createShuffleBag } from './quiz-bank.js';

export function createEmojiSwitcher({ all, random = Math.random }) {
  let set = 'general';
  let setBy = null;
  let deck = null;
  let dirty = true;
  let setLeft = 0;
  let deckQueue = [];
  let assignments = assignEmojiGifts(SAMPLE_GIFTS);

  function build() {
    const config = EMOJI_TARGETS[set];
    const cat = config?.cat;
    const filtered = cat ? all.filter(q => q.cat === cat) : all;
    deck = createShuffleBag(filtered.length ? filtered : all, random);
    dirty = false;
  }

  return {
    get deck() {
      return {
        next: () => {
          if (dirty || !deck) build();
          const q = deck.next();
          if (set !== 'general') {
            setLeft -= 1;
            if (setLeft <= 0) {
              if (deckQueue.length > 0) {
                const nextReq = deckQueue.shift();
                set = nextReq.to;
                setBy = nextReq.user;
                setLeft = nextReq.questions || EMOJI_HOLD_QUESTIONS;
                dirty = true;
              } else {
                set = 'general';
                setBy = null;
                dirty = true;
              }
            }
          }
          return q;
        }
      };
    },
    onGift(event) {
      const gift = event.gift;
      const to = emojiTargetFor(assignments, gift);
      const target = EMOJI_TARGETS[to];
      if (!to || !target) return [];

      const user = { nickname: event.user.nickname, avatar: event.user.avatar };
      if (set === 'general' || setLeft <= 0) {
        set = to;
        setBy = user;
        setLeft = EMOJI_HOLD_QUESTIONS;
        dirty = true;
      } else {
        deckQueue.push({ to, user, questions: EMOJI_HOLD_QUESTIONS, giftName: gift.name, giftPicture: gift.pictureUrl });
      }
      return [{ 
        kind: 'quizDeck', 
        to: set, 
        label: target.label, 
        icon: target.icon,
        nickname: event.user.nickname,
        giftName: gift.name,
        giftPicture: gift.pictureUrl,
        questions: setLeft,
        queueLength: deckQueue.length
      }];
    },
    setCatalog(catalog) {
      if (!catalog?.length) return;
      assignments = assignEmojiGifts(catalog, assignments);
    },
    restore(s) {
      if (!s) return;
      if (s.set && (s.set === 'general' || EMOJI_TARGETS[s.set])) {
        set = s.set;
        setLeft = Math.max(0, Number(s.setLeft) || 0);
        setBy = s.setBy || null;
      }
      if (Array.isArray(s.deckQueue)) {
        deckQueue = s.deckQueue.map((item) => ({
          to: item.to,
          user: item.user ? { nickname: item.user.nickname, avatar: item.user.avatar } : null,
          questions: Math.max(1, Number(item.questions) || EMOJI_HOLD_QUESTIONS),
          giftName: item.giftName || '',
          giftPicture: item.giftPicture || ''
        })).filter((item) => EMOJI_TARGETS[item.to]);
      }
      dirty = true;
    },
    snapshot() {
      const target = EMOJI_TARGETS[set] || EMOJI_DEFAULTS.set;
      return { 
        set, 
        setLabel: target.label, 
        setIcon: target.icon,
        setBy,
        rules: assignments.map(a => ({ to: a.to, label: a.label, icon: a.icon, gift: a.gift })),
        setLeft,
        deckQueue: deckQueue.map((q) => ({
          to: q.to,
          label: EMOJI_TARGETS[q.to]?.label || q.to,
          icon: EMOJI_TARGETS[q.to]?.icon || '🧩',
          nickname: q.user?.nickname || '',
          giftName: q.giftName || ''
        })),
        levelLabel: 'Thường',
        levelIcon: '⚖️'
      };
    }
  };
}
