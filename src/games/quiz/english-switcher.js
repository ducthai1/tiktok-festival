// Bộ đề + độ khó của tab Từ Vựng Tiếng Anh, đổi bằng quà tối đa 30 xu (bảng gán quà ở public/shared/english-sets.js).
// Quà (theo luật ở tab 🎁 Quà của trang điều khiển) kết thúc luôn bộ đang chạy, đổi chế độ NGAY; mỗi luật có số câu riêng.
// Quà ở tab này KHÔNG mở gợi ý và không cộng điểm cho người tặng — chỉ đổi đề cho cả phòng + hiện tên người đổi.
import {
  ENGLISH_DEFAULTS, ENGLISH_HOLD_QUESTIONS, ENGLISH_TARGETS, LISTEN_MIN_QUESTIONS, buildEnglishRules, defaultEnglishRules,
  defaultQuestionsFor, englishRuleFor
} from '../../../public/shared/english-sets.js';
import { foldText } from '../text-match.js';
import { homophonesOf } from './homophones.js';

export const LISTEN_MS = 25000; // câu luyện nghe dài hơn câu thường (20 giây): phải nghe rồi mới gõ

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const keep = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = keep;
    }
  }
  return row[b.length];
}

/**
 * Câu thường → câu luyện nghe. Chỉ nghe được ÂM nên chỉ nhận: đúng từ đó, cách viết khác của nó (colour/color, payday/pay day)
 * và từ đồng âm (pear/pair) — KHÔNG nhận từ đồng nghĩa trong kho (nghe "acne" mà gõ "pimples" là không nghe).
 */
export function toListenQuestion(q) {
  const answer = foldText(q.answer);
  const compact = (s) => s.replace(/[ -]/g, '');
  const accept = new Set([answer]);
  for (const a of q.accept) if (editDistance(compact(a), compact(answer)) <= 2) accept.add(a);
  if (!answer.includes(' ')) for (const h of homophonesOf(answer)) accept.add(foldText(h));
  const meaning = String(q.prompt || '').replace(/\s*(trong\s+)?tiếng Anh\s+(là gì|gọi là gì|nói thế nào)\s*\??\s*$/i, '').trim();
  return {
    ...q, listen: true, category: 'Tiếng Anh · 🎧 Luyện nghe', prompt: '🎧 Nghe rồi gõ lại từ tiếng Anh', speech: '',
    revealPrompt: meaning ? `🇻🇳 ${meaning}` : '', accept: [...accept], timeMs: LISTEN_MS
  };
}

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
/**
 * general: từ theo chủ đề; basic: 176 từ cơ bản (luôn để cuối); sets: { toeic: [...], ielts: [...], … }
 * progress: { load(): string[], save(list) } — nhớ từ đã hỏi qua các lần khởi động lại (progress-store.js).
 */
/**
 * listen: kho câu cho Luyện nghe (mọi từ đọc được, mọi độ khó); listenReady(): giọng đọc tiếng Anh đang chạy tốt không
 * (không thì ô 🎧 ẩn khỏi bảng, quà chỉ được cảm ơn); onPrefetch(từ): chọn trước câu nghe kế tiếp → máy chủ tạo sẵn giọng.
 */
export function createEnglishSwitcher({ general, basic, sets, random = Math.random, progress = null,
  listen = [], listenReady = () => false, onPrefetch = null }) {
  let set = 'general';
  let level = 'normal';
  let setLeft = 0;
  let levelLeft = 0;
  let setBy = null;
  let levelBy = null;
  let dirty = true;
  let deckQueue = [];
  // mỗi ô một món cố định, giá thật vùng VN (english-sets.js); phòng nhận được món đó thì dùng id + giá TikTok báo
  // luật quà (tab 🎁 Quà ở trang điều khiển; chưa chỉnh thì mặc định) → bảng đang bật
  let assignments = buildEnglishRules(defaultEnglishRules());

  // ── Xoay vòng KHÔNG LẶP trên toàn bộ từ: sổ "đã hỏi" dùng CHUNG mọi bộ, theo từ tiếng Anh (đáp án).
  // Đang ở Tổng hợp câu 100 → đổi sang TOEIC (chỉ ra từ chưa hỏi ở bất kỳ đâu) → quay về Tổng hợp đi tiếp câu 101
  // (từ chưa hỏi), không về câu 1. Đổi Dễ/Khó cũng không hỏi lại từ đã hỏi. Một bộ hỏi hết mọi từ thì RIÊNG bộ đó
  // bắt đầu vòng mới. Sổ lưu ra đĩa nên khởi động lại server vẫn đi tiếp.
  const keyOf = (q) => foldText(q.answer).replace(/ /g, '');
  const seen = new Set(progress?.load?.() || []);

  function tiers() {
    if (set !== 'general') return [filterByLevel(sets[set], level)];
    // khó: chỉ từ bậc 3 theo chủ đề; dễ / vừa: từ theo chủ đề trước, 176 từ cơ bản cuối danh sách
    return level === 'hard' ? [filterByLevel(general, 'hard')] : [filterByLevel(general, level), basic].filter((t) => t.length);
  }

  function pick() {
    const list = tiers();
    for (let round = 0; round < 2; round += 1) {
      for (const tier of list) {
        const fresh = tier.filter((q) => !seen.has(keyOf(q)));
        if (!fresh.length) continue;
        const q = fresh[Math.floor(random() * fresh.length)];
        seen.add(keyOf(q));
        progress?.save?.([...seen]);
        return q;
      }
      // cả bộ đã hỏi hết → vòng mới cho RIÊNG bộ này (bộ khác giữ nguyên tiến độ)
      const label = set === 'general' ? 'Tổng hợp' : ENGLISH_TARGETS[set]?.label || set;
      console.log(`[english] bộ ${label} (${level}) đã hỏi hết ${list.reduce((n, t) => n + t.length, 0)} từ → bắt đầu vòng mới`);
      for (const tier of list) for (const q of tier) seen.delete(keyOf(q));
    }
    return list.flat()[0];
  }

  // ── Luyện nghe: 40 từ ngẫu nhiên trên TOÀN kho, sổ riêng ("nghe:…") — các lượt sau không lặp cho tới khi nghe hết cả kho
  let upcoming = null; // câu nghe kế tiếp đã chọn trước (để máy chủ kịp tạo giọng)
  let listenAsked = 0; // số câu nghe đã ra trong lượt Luyện nghe này
  let listenMin = LISTEN_MIN_QUESTIONS; // lượt này giữ ít nhất bấy nhiêu câu (lượt 10 câu thì giữ cả 10)
  let pending = null; // { to, user } — quà đổi bộ tới lúc Luyện nghe chưa đủ LISTEN_MIN_QUESTIONS câu: đổi khi đủ (món sau cùng thắng)
  const listenKey = (q) => `nghe:${keyOf(q)}`;
  function pickListen() {
    let fresh = listen.filter((q) => !seen.has(listenKey(q)));
    if (!fresh.length) {
      console.log(`[english] Luyện nghe đã nghe hết ${listen.length} từ → bắt đầu vòng mới`);
      for (const q of listen) seen.delete(listenKey(q));
      fresh = listen;
    }
    const q = fresh[Math.floor(random() * fresh.length)];
    seen.add(listenKey(q));
    progress?.save?.([...seen]);
    return toListenQuestion(q);
  }
  function prepareListen() {
    if (upcoming || !listen.length) return;
    upcoming = pickListen();
    try {
      onPrefetch?.(upcoming.answer);
    } catch {
      // tạo sẵn giọng lỗi thì lúc ra đề màn hình tự hỏi lại
    }
  }
  function releaseListen() {
    if (upcoming) seen.delete(listenKey(upcoming)); // chọn trước mà không hỏi → trả lại kho
    upcoming = null;
  }

  function build() {
    dirty = false;
  }

  /**
   * Quà / nút đổi chế độ: KẾT THÚC LUÔN bộ đang chạy, vào chế độ mới ngay (engine ra câu mới liền — xem quiz-game.js switchNow).
   * Không xếp hàng chờ: người tặng sau cùng quyết định. Trả về 'switch' (đổi chế độ → ra câu mới), 'same' (đang đúng chế độ đó:
   * chỉ đếm lại số câu từ đầu, không ra câu mới — tặng combo không làm câu nhảy liên tục) hoặc false (không đổi được).
   */
  /**
   * Quà / nút đổi chế độ: KẾT THÚC LUÔN bộ đang chạy, vào chế độ mới ngay (engine ra câu mới liền — xem quiz-game.js switchNow).
   * count: số câu của luật quà (vd Luyện nghe 1 xu → 10 câu, 30 xu → 40 câu); 0 = mặc định.
   * Trả về 'switch' (đổi chế độ → ra câu mới), 'same' (đang đúng chế độ đó: chỉ thêm câu, không ra câu mới — tặng combo không
   * làm câu nhảy liên tục), 'later' (Luyện nghe chưa đủ số câu tối thiểu: đổi khi đủ) hoặc false (không đổi được).
   */
  function apply(to, user, count = 0) {
    const target = ENGLISH_TARGETS[to];
    if (!target || (target.kind === 'set' && !sets[to]?.length)) return false;
    if (target.kind === 'listen' && (!listen.length || !listenReady())) return false; // giọng đọc hỏng → không nhận đổi
    dirty = true;
    const questions = count || defaultQuestionsFor(to);
    // Luyện nghe chưa đủ số câu tối thiểu: đổi độ khó thì ghi nhận (dùng sau, không ngắt câu nghe); đổi bộ / về Tổng hợp thì chờ
    if (set === 'nghe' && to !== 'nghe' && listenAsked < listenMin) {
      if (target.kind === 'level') {
        level = to;
        levelLeft = questions;
        levelBy = user;
        return 'same';
      }
      pending = { to, user, count };
      return 'later';
    }
    if (target.kind === 'reset') {
      if (set === 'general' && level === 'normal' && !deckQueue.length) return 'same';
      reset();
      return 'switch';
    }
    if (target.kind === 'level') {
      const same = level === to;
      level = to;
      levelLeft = same ? Math.max(levelLeft, questions) : questions;
      levelBy = user;
      return same ? 'same' : 'switch';
    }
    if (set === to) {
      // tặng thêm đúng chế độ đang chạy: không bao giờ làm ngắn lượt đang chạy (40 câu đang chạy + quà 10 câu → vẫn 40)
      setLeft = Math.max(setLeft, questions);
      setBy = user;
      if (to === 'nghe') {
        listenAsked = 0; // người mới trả tiền: lại được giữ số câu tối thiểu
        listenMin = Math.min(LISTEN_MIN_QUESTIONS, setLeft);
      }
      return 'same';
    }
    pending = null;
    if (set === 'nghe') releaseListen(); // rời Luyện nghe: câu nghe đã chọn trước trả lại kho
    deckQueue = [];
    set = to;
    setLeft = questions;
    setBy = user;
    if (target.kind === 'listen') {
      listenAsked = 0;
      listenMin = Math.min(LISTEN_MIN_QUESTIONS, questions);
      prepareListen();
    }
    return 'switch';
  }

  /** Luyện nghe đã đủ số câu tối thiểu (hoặc dừng vì giọng đọc hỏng) → đổi sang bộ người xem đã tặng trong lúc nghe. */
  function applyPending() {
    const p = pending;
    pending = null;
    releaseListen();
    if (ENGLISH_TARGETS[p.to].kind === 'reset') {
      reset();
    } else {
      deckQueue = [];
      set = p.to;
      setLeft = p.count || defaultQuestionsFor(p.to);
      setBy = p.user;
    }
    dirty = true;
    return `🎁 ${p.user?.nickname ? `${p.user.nickname}: ` : ''}đổi sang ${ENGLISH_TARGETS[p.to].icon} ${ENGLISH_TARGETS[p.to].label}`;
  }

  /** Bộ đang chạy hết lượt → bộ kế tiếp trong hàng chờ, hoặc về Tổng hợp. */
  function advance() {
    if (deckQueue.length > 0) {
      const nextReq = deckQueue.shift();
      set = nextReq.to;
      setBy = nextReq.user;
      setLeft = nextReq.questions || ENGLISH_HOLD_QUESTIONS;
    } else {
      set = 'general';
      setBy = null;
    }
    dirty = true;
  }

  function reset() {
    releaseListen();
    pending = null;
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
        let notice = '';
        // đang Luyện nghe mà giọng đọc hỏng (mất mạng / Microsoft chặn) → dừng, sang bộ kế tiếp; màn hình báo cho người xem
        if (set === 'nghe' && !listenReady()) {
          releaseListen();
          console.warn(`[english] giọng đọc tiếng Anh lỗi → dừng Luyện nghe (còn ${setLeft} câu)`);
          setLeft = 0;
          if (pending) applyPending();
          else advance();
          notice = '🎧 Giọng đọc đang lỗi — tạm dừng Luyện nghe';
        } else if (set === 'nghe' && pending && listenAsked >= listenMin) {
          notice = applyPending(); // đã nghe đủ 20 câu → đổi sang bộ người xem tặng trong lúc nghe
        }
        let q;
        const listening = set === 'nghe';
        if (listening) {
          q = upcoming || pickListen();
          upcoming = null;
          listenAsked += 1;
        } else q = pick();
        // mỗi câu ra tiêu một lượt; hết lượt thì từ câu sau quay về mặc định
        if (set !== 'general') {
          setLeft -= 1;
          // hết lượt nghe mà có quà đổi bộ đang chờ → câu sau vào bộ đó (applyPending ở đầu next), không về Tổng hợp
          if (setLeft <= 0 && !(listening && pending)) advance();
        }
        // còn nghe tiếp → chọn trước câu sau để tạo sẵn giọng (sắp đổi sang bộ đang chờ thì thôi)
        if (set === 'nghe' && !(pending && listenAsked >= listenMin)) prepareListen();
        // Luyện nghe không dùng độ khó → không trừ lượt độ khó trong lúc nghe
        if (!listening && level !== 'normal' && (levelLeft -= 1) <= 0) {
          level = 'normal';
          levelBy = null;
          dirty = true;
        }
        return notice ? { ...q, notice } : q;
      }
    },
    /** Phòng live mới: về Tổng hợp · Vừa, bỏ Luyện nghe / bộ đề / đổi bộ đang chờ của phòng cũ (sổ "đã hỏi" giữ nguyên — không lặp từ). */
    resetRoom() {
      reset();
    },
    /** Danh mục quà thật của phòng (server lưu lại giữa các buổi live). */
    /** Tab 🎁 Quà (trang điều khiển) lưu luật quà mới → bảng trên màn hình + nhận quà đổi ngay. */
    setRules(rules) {
      assignments = buildEnglishRules(rules);
      dirty = true;
    },
    setCatalog(catalog) {
      if (!catalog?.length) return;
      // (danh mục quà của phòng không còn dùng để lấy giá — giá trong luật quà là giá thật TikTok)
    },
    onGift(event) {
      const gift = event.gift;
      const rule = englishRuleFor(assignments, gift);
      const to = rule?.to;
      const base = { userId: event.user.id, nickname: event.user.nickname, avatar: event.user.avatar, giftName: gift.name,
        giftPicture: gift.pictureUrl, count: gift.count };
      const result = to && apply(to, { id: event.user.id, nickname: event.user.nickname, avatar: event.user.avatar }, rule.questions);
      if (!result) return [{ kind: 'quizGift', ...base, tier: 3, hint: '' }]; // món không nằm trong bảng: chỉ cảm ơn
      const target = ENGLISH_TARGETS[to];
      if (result === 'later') { // đang Luyện nghe chưa đủ 20 câu → đổi khi đủ
        return [{ kind: 'quizDeck', ...base, to, icon: target.icon, label: target.label, questions: rule.questions,
          after: listenMin - listenAsked }];
      }
      return [{ kind: 'quizDeck', ...base, to, icon: target.icon, label: target.label,
        questions: target.kind === 'level' ? levelLeft : setLeft, switchNow: result === 'switch' }];
    },
    /** Nút ở trang điều khiển: deck-<đích> (đổi tay, không ghi tên ai) hoặc resetDeck. */
    command(name) {
      if (name === 'resetDeck') {
        reset();
        return [{ kind: 'toast', text: `${ENGLISH_DEFAULTS.set.icon} Về bộ ${ENGLISH_DEFAULTS.set.label} · ${ENGLISH_DEFAULTS.level.label}`, switchNow: true }];
      }
      const to = name.startsWith('deck-') ? name.slice(5) : '';
      const result = to && apply(to, null);
      if (!result) return null;
      const later = result === 'later' ? ` sau ${listenMin - listenAsked} câu Luyện nghe nữa` : '';
      return [{ kind: 'toast', text: `${ENGLISH_TARGETS[to].icon} Đổi sang ${ENGLISH_TARGETS[to].label}${later}`, switchNow: result === 'switch' }];
    },
    restore(s) {
      if (!s) return;
      if (s.set && (s.set === 'general' || sets[s.set]?.length || (s.set === 'nghe' && listen.length))) {
        set = s.set;
        setLeft = Math.max(0, Number(s.setLeft) || 0);
        setBy = s.setBy || null;
        listenAsked = Math.max(0, Number(s.listenAsked) || 0);
        listenMin = Math.max(1, Math.min(LISTEN_MIN_QUESTIONS, Number(s.listenMin) || LISTEN_MIN_QUESTIONS));
      }
      // quà đổi bộ đang chờ Luyện nghe đủ 20 câu
      pending = s.pending && ENGLISH_TARGETS[s.pending.to] ? { to: s.pending.to, user: s.pending.user || null, count: Number(s.pending.count) || 0 } : null;
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
        })).filter((item) => ENGLISH_TARGETS[item.to] && (ENGLISH_TARGETS[item.to].kind !== 'set' || sets[item.to]?.length));
      }
      // (hàng chờ chỉ còn ở bản lưu cũ trước 13/11/2026 — giờ quà mới kết thúc luôn bộ đang chạy, không xếp hàng)
      dirty = true;
    },
    snapshot() {
      const s = set === 'general' ? ENGLISH_DEFAULTS.set : ENGLISH_TARGETS[set];
      const l = level === 'normal' ? ENGLISH_DEFAULTS.level : ENGLISH_TARGETS[level];
      return {
        set, setIcon: s.icon, setLabel: s.label, setLeft: set === 'general' ? 0 : setLeft, setBy, listenAsked, listenMin,
        // đổi bộ đang chờ (Luyện nghe chưa đủ 20 câu): bộ nào, ai tặng, còn mấy câu nghe nữa thì đổi
        pending: pending ? { to: pending.to, icon: ENGLISH_TARGETS[pending.to].icon, label: ENGLISH_TARGETS[pending.to].label, user: pending.user, count: pending.count,
          after: Math.max(0, listenMin - listenAsked) } : null,
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
        rules: assignments.filter((a) => a.to !== 'nghe' || (listen.length && listenReady()))
          .map((a) => ({ to: a.to, icon: a.icon, label: a.label, questions: a.questions, gift: a.gift }))
      };
    }
  };
}
