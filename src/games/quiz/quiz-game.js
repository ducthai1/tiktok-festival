// BỘ MÁY ĐỐ VUI dùng chung cho mọi tab đố (Lớp Học Chữ, A/B/C/D, Tiếng Anh, Đuổi hình, Quốc kỳ, Toán, Wordle).
// Vòng lặp: HỎI (đếm ngược) → ĐÁP ÁN (vài giây) → câu tiếp. Người xem trả lời bằng bình luận.
// Luật quà theo hướng dẫn TikTok: quà KHÔNG cộng điểm cho người tặng — quà chỉ mở gợi ý CHO CẢ PHÒNG (cố định, không may rủi).
// Tim (và share) đổ vào thanh NĂNG LƯỢNG chung: 200 → câu sau là ⭐ CÂU VÀNG (x2 điểm); 400 → ⚡ CHỚP NHOÁNG (3 câu 8 giây,
// ai đúng cả 3 được ⚡ + 5 điểm) rồi thanh về 0. Follow lần đầu trong buổi: +3 điểm + 💖; cứ 10 follow → câu vàng cho cả phòng.
// Share: +20 năng lượng (tính 5 lần/người/buổi), người share nhiều nhất lên bảng ĐẠI SỨ. Live trễ 1–2 giây nên mỗi câu hiện đề 2 giây rồi mới đếm, hết giờ vẫn nhận
// thêm 1,5 giây bình luận đang trên đường tới. Game không ở tab đang chọn thì đứng yên (đồng hồ không chạy).
import { giftTier } from '../../../public/shared/gift-tiers.js';
import { createCooldown, foldText, isCleanForDisplay } from '../text-match.js';

export const POINTS = [10, 7, 5, 3, 3]; // 5 người đúng nhanh nhất; ai đúng sau nữa +1
const LATE_POINTS = 1;
const MAX_TRIES = 6; // mỗi người tối đa 6 lần đoán mỗi câu (chống dội bình luận)
const FIRST_CORRECT_GRACE_MS = 5000; // có người đúng rồi thì chờ thêm 5 giây cho người khác rồi lật đáp án
export const LEAD_IN_MS = 2000; // đề hiện rồi mới bắt đầu đếm ngược (người xem thấy đề trễ 1–2 giây)
export const LATE_MS = 1500; // hết giờ vẫn nhận bình luận gửi kịp nhưng tới chậm
export const ENERGY_GOLDEN = 200;
export const ENERGY_LIGHTNING = 400;
export const FOLLOW_POINTS = 3;
export const FOLLOW_GOAL = 10;
export const SHARE_ENERGY = 20;
export const SHARE_ENERGY_MAX_PER_USER = 5;
export const LIGHTNING_QUESTIONS = 3;
export const LIGHTNING_MS = 8000;
const LIGHTNING_REVEAL_MS = 3500;
export const LIGHTNING_PERFECT_BONUS = 5;
const PRESENT_MS = 10 * 60 * 1000;
const ABCD_MS = { 1: 12000, 2: 15000, 3: 18000, 4: 20000 };
const LETTERS = ['A', 'B', 'C', 'D'];
const WORDLE_ROWS = 8;
const WORDLE_WIN_POINTS = 15;

/** Vị trí các chữ cái/số trong đáp án (dấu cách, gạch nối… luôn hiện sẵn). */
function letterSlots(answer) {
  return [...answer].map((ch, i) => (foldText(ch) ? i : -1)).filter((i) => i >= 0);
}

/** Tô màu một lượt Wordle: g = đúng chỗ, y = có nhưng sai chỗ, x = không có (xử lý đúng chữ lặp). */
export function scoreWordle(guess, answer) {
  const marks = Array(answer.length).fill('x');
  const pool = [...answer];
  [...guess].forEach((ch, i) => {
    if (ch === answer[i]) {
      marks[i] = 'g';
      pool[i] = null;
    }
  });
  [...guess].forEach((ch, i) => {
    if (marks[i] === 'x' && pool.includes(ch)) {
      marks[i] = 'y';
      pool[pool.indexOf(ch)] = null;
    }
  });
  return marks.join('');
}

/**
 * kind: 'text' (gõ đáp án) | 'abcd' (gõ A/B/C/D) | 'wordle' (gõ từ 5 chữ).
 * deck.next() → câu hỏi (xem quiz-bank.js). questionMs: thời gian mỗi câu (abcd tính theo độ khó).
 * speakLine(q): câu đọc lúc ra đề; revealAnswerAloud: đọc đáp án lúc lật (tắt cho từ tiếng Anh).
 * pronounce(q): từ tiếng Anh màn hình đọc bằng giọng bản xứ lúc lật đáp án; onPronounce(từ): báo lúc ra đề để máy chủ tạo
 * sẵn giọng đọc (từ không gửi ra màn hình trước khi lật — không lộ đáp án).
 */
export function createQuizGame({
  id, title, kind = 'text', deck, questionMs = 25000, revealMs = 6500, firstLetter = true, autoHints = true,
  speakLine = (q) => q.speech || q.prompt, revealAnswerAloud = true, wordle = null, random = Math.random,
  // tab tự xử lý quà (vd tiếng Anh: quà đổi bộ đề thay cho mở gợi ý), lệnh riêng, và trạng thái riêng gửi lên màn hình
  onGift = null, onCommand = null, extraState = null, onRestore = null, onCatalog = null, pronounce = null, onPronounce = null
}) {
  const scores = new Map(); // id → { id, nickname, avatar, points, correct }
  const present = new Map(); // id → { id, nickname, avatar, at }
  const wordleCooldown = createCooldown(3000);
  let q = null;
  let phase = 'idle'; // idle → question → reveal → question …
  let paused = false;
  let phaseStart = 0;
  let phaseEnd = 0;
  let lastTick = null;
  let qNumber = 0;
  // theo từng câu
  let winners = [];
  let tries = new Map();
  let firstCorrectAt = 0;
  let revealed = new Set(); // chữ đã lộ (text) / ô đã lộ (wordle)
  let slots = [];
  let autoHintStep = 0;
  let options = [];
  let rightIndex = -1;
  let votes = new Map(); // abcd: id → { idx, at, user }
  let voteCounts = [0, 0, 0, 0];
  let removed = new Set();
  let guesses = [];
  let keyboard = {};
  let greens = new Set();
  let countStart = 0; // lúc bắt đầu đếm ngược (sau 2 giây hiện đề)
  let energy = 0;
  let goldenUnlocked = false; // vòng năng lượng này đã qua mốc ENERGY_GOLDEN chưa
  let goldenPending = false;
  let diamondPending = false;
  let golden = false; // câu đang hỏi là câu vàng (x2)
  let diamond = false; // câu đang hỏi là câu kim cương (x3)
  let lightningIndex = 0;
  let lightningQueued = 0;
  let lightningHits = new Map();
  const followers = new Set(); // id người đang follow kênh (cờ từ TikTok / đã follow ở buổi trước / vừa follow)
  const followedNow = new Set(); // follow trong buổi này (mỗi người thưởng một lần)
  let followCount = 0;
  const sharers = new Map(); // id → { id, nickname, avatar, shares }
  let hintsByGifts = 0;

  const totalMs = () => (kind === 'abcd' ? ABCD_MS[q?.level] || 15000 : questionMs);
  const mult = () => (diamond ? 3 : golden ? 2 : 1);

  function touch(user, now) {
    if (!user?.id) return;
    if (user.follower) followers.add(user.id);
    present.set(user.id, { id: user.id, nickname: user.nickname, avatar: user.avatar, at: now });
    if (present.size > 400) present.delete(present.keys().next().value);
  }

  function addPoints(user, points, { correct = true } = {}) {
    const row = scores.get(user.id) || { id: user.id, nickname: user.nickname, avatar: user.avatar, points: 0, correct: 0, bolts: 0 };
    row.nickname = user.nickname;
    row.avatar = user.avatar;
    row.points += points;
    if (correct) row.correct += 1;
    scores.set(user.id, row);
    return row;
  }

  function hiddenSlots() {
    return slots.filter((i) => !revealed.has(i));
  }

  /** Mở thêm n chữ ngẫu nhiên, luôn chừa lại ít nhất `keep` chữ chưa lộ. */
  function revealLetters(n, keep = 1) {
    let opened = 0;
    for (let k = 0; k < n; k += 1) {
      const hidden = hiddenSlots();
      if (hidden.length <= keep) break;
      revealed.add(hidden[Math.floor(random() * hidden.length)]);
      opened += 1;
    }
    return opened;
  }

  function startQuestion(now, fx) {
    q = deck.next();
    qNumber += 1;
    phase = 'question';
    phaseStart = now;
    winners = [];
    tries = new Map();
    firstCorrectAt = 0;
    revealed = new Set();
    autoHintStep = 0;
    votes = new Map();
    voteCounts = [0, 0, 0, 0];
    removed = new Set();
    guesses = [];
    keyboard = {};
    greens = new Set();
    hintsByGifts = 0;
    golden = goldenPending;
    goldenPending = false;
    diamond = diamondPending;
    diamondPending = false;
    if (lightningQueued > 0) {
      lightningIndex = LIGHTNING_QUESTIONS - lightningQueued + 1;
      lightningQueued -= 1;
      if (lightningIndex === 1) lightningHits = new Map();
    } else {
      lightningIndex = 0;
    }
    if (kind === 'text') {
      slots = q.math ? [] : letterSlots(q.answer);
      if (firstLetter && slots.length > 3) revealed.add(slots[0]);
    }
    if (kind === 'abcd') {
      options = [q.right, ...q.wrong];
      for (let i = options.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }
      rightIndex = options.indexOf(q.right);
    }
    if (kind === 'wordle') slots = [...Array(q.length).keys()];
    countStart = now + LEAD_IN_MS;
    phaseEnd = countStart + (lightningIndex ? LIGHTNING_MS : totalMs());
    const intro = diamond ? 'Câu Kim Cương, NHÂN BA ĐIỂM! ' : golden ? 'Câu Vàng, nhân đôi điểm! ' : '';
    fx.push({ kind: 'quizQuestion', qNumber, category: q.category, golden, lightning: lightningIndex, speech: intro + (speakLine(q) || '') });
    if (pronounce && onPronounce) {
      try {
        onPronounce(pronounce(q));
      } catch (error) {
        console.warn(`[quiz] tạo sẵn giọng đọc đáp án lỗi: ${error.message}`); // giọng đọc hỏng không được làm hỏng câu hỏi
      }
    }
  }

  function finishLightningQuestion(fx) {
    for (const w of winners) {
      const row = lightningHits.get(w.id) || { user: { id: w.id, nickname: w.nickname, avatar: w.avatar }, count: 0 };
      row.count += 1;
      lightningHits.set(w.id, row);
    }
    if (lightningIndex === LIGHTNING_QUESTIONS) {
      const perfect = [];
      for (const row of lightningHits.values()) {
        if (row.count >= LIGHTNING_QUESTIONS) {
          addPoints(row.user, LIGHTNING_PERFECT_BONUS, { correct: false });
          const scoreRow = scores.get(row.user.id);
          if (scoreRow) scoreRow.bolts = (scoreRow.bolts || 0) + 1;
          perfect.push({ id: row.user.id, nickname: row.user.nickname, avatar: row.user.avatar });
        }
      }
      fx.push({ kind: 'quizLightningEnd', perfect });
      lightningHits = new Map();
    }
  }
  function reveal(now, fx) {
    if (kind === 'abcd') {
      const right = [...votes.values()].filter((v) => v.idx === rightIndex).sort((a, b) => a.at - b.at);
      winners = right.map((v, rank) => {
        const points = (POINTS[rank] ?? LATE_POINTS) * mult();
        addPoints(v.user, points);
        return { id: v.user.id, nickname: v.user.nickname, avatar: v.user.avatar, points };
      });
    }
    phase = 'reveal';
    phaseStart = now;
    phaseEnd = now + (lightningIndex && lightningIndex < LIGHTNING_QUESTIONS ? LIGHTNING_REVEAL_MS : revealMs);
    if (lightningIndex) finishLightningQuestion(fx);
    const answer = answerText();
    const top = winners[0];
    let speech = '';
    if (kind === 'abcd') speech = `Đáp án đúng là ${LETTERS[rightIndex]}, ${q.right}.`;
    else if (revealAnswerAloud) speech = `Đáp án là ${q.answer}.`;
    if (top) speech += ` ${winners.length > 1 ? `${winners.length} bạn trả lời đúng, nhanh nhất là` : 'Chúc mừng'} ${top.nickname}!`;
    else speech += ' Chưa ai trả lời đúng.';
    // đáp án tiếng Anh: đọc giọng bản xứ (thường rồi chậm; vòng chớp nhoáng lật nhanh nên chỉ đọc một lần)
    const english = pronounce ? { answerEn: pronounce(q), answerEnSlow: !lightningIndex || lightningIndex === LIGHTNING_QUESTIONS } : {};
    fx.push({ kind: 'quizReveal', answer, winners: winners.slice(0, 5), correctCount: winners.length, speech, ...english });
  }

  /** Tim / share nạp thanh năng lượng; qua mốc thì xếp câu vàng / vòng chớp nhoáng. */
  function addEnergy(amount, fx) {
    energy = Math.min(ENERGY_LIGHTNING, energy + amount);
    if (!goldenUnlocked && energy >= ENERGY_GOLDEN) {
      goldenUnlocked = true;
      goldenPending = true;
      fx.push({ kind: 'quizEnergy', reward: 'golden' });
    }
    if (energy >= ENERGY_LIGHTNING) {
      energy = 0;
      goldenUnlocked = false;
      lightningQueued += LIGHTNING_QUESTIONS;
      fx.push({ kind: 'quizEnergy', reward: 'lightning' });
    }
  }


  function answerText() {
    if (!q) return '';
    if (kind === 'abcd') return `${LETTERS[rightIndex]}. ${q.right}`;
    if (kind === 'wordle') return q.toUpperCase();
    return q.answer;
  }

  // ---- trả lời ----
  function onText(user, comment, now, fx) {
    if (winners.some((w) => w.id === user.id)) return;
    const n = (tries.get(user.id) || 0) + 1;
    tries.set(user.id, n);
    if (n > MAX_TRIES) return;
    const said = foldText(comment);
    const compact = said.replace(/ /g, '');
    if (!said || !q.accept.some((a) => a === said || a.replace(/ /g, '') === compact)) return;
    const points = (POINTS[winners.length] ?? LATE_POINTS) * mult();
    addPoints(user, points);
    winners.push({ id: user.id, nickname: user.nickname, avatar: user.avatar, points, ms: now - phaseStart });
    if (!firstCorrectAt) firstCorrectAt = now;
    fx.push({ kind: 'quizCorrect', userId: user.id, nickname: user.nickname, avatar: user.avatar, rank: winners.length, points });
  }

  function onVote(user, comment, now) {
    if (votes.has(user.id)) return; // chỉ tính lần chọn đầu tiên
    const m = foldText(comment).match(/^(?:dap an |chon |cau )?([abcd])(?: |$)/);
    if (!m) return;
    const idx = LETTERS.indexOf(m[1].toUpperCase());
    if (removed.has(idx)) return;
    votes.set(user.id, { idx, at: now, user });
    voteCounts[idx] += 1;
  }

  function onWordleGuess(user, comment, now, fx) {
    const word = foldText(comment).replace(/ /g, '');
    if (word.length !== q.length || (wordle.allowed && !wordle.allowed.has(word)) || !wordleCooldown(user.id, now)) return;
    if (guesses.some((g) => g.word === word)) return;
    const marks = scoreWordle(word, q);
    guesses.push({ word, marks, id: user.id, nickname: user.nickname });
    if (guesses.length > 40) guesses.shift();
    let found = 0;
    [...word].forEach((ch, i) => {
      const rank = { x: 0, y: 1, g: 2 }[marks[i]];
      if ((keyboard[ch] ?? -1) < rank) keyboard[ch] = rank;
      if (marks[i] === 'g' && !greens.has(i)) {
        greens.add(i);
        found += 1;
      }
    });
    if (word === q) {
      const points = WORDLE_WIN_POINTS * mult();
      addPoints(user, points);
      winners.push({ id: user.id, nickname: user.nickname, avatar: user.avatar, points });
      fx.push({ kind: 'quizCorrect', userId: user.id, nickname: user.nickname, avatar: user.avatar, rank: 1, points });
      reveal(now, fx);
    } else if (found) {
      addPoints(user, found * mult());
      fx.push({ kind: 'quizClue', nickname: user.nickname, word: word.toUpperCase(), found });
    }
  }

  // ---- gợi ý (quà / thủ công) — giúp CẢ PHÒNG ----
  function giveHint(amount) {
    if (kind === 'text') return q.math ? 0 : revealLetters(amount, 1);
    if (kind === 'abcd') {
      let n = 0;
      for (let k = 0; k < amount && removed.size < 2; k += 1) {
        const wrong = [0, 1, 2, 3].filter((i) => i !== rightIndex && !removed.has(i));
        const pick = wrong[Math.floor(random() * wrong.length)];
        removed.add(pick);
        // phiếu đã bầu vào đáp án bị loại được bầu lại
        for (const [uid, v] of votes) if (v.idx === pick) votes.delete(uid);
        voteCounts[pick] = 0;
        n += 1;
      }
      return n;
    }
    if (kind === 'wordle') {
      let n = 0;
      for (let k = 0; k < amount; k += 1) {
        const hidden = slots.filter((i) => !revealed.has(i) && !greens.has(i));
        if (hidden.length <= 2) break;
        revealed.add(hidden[Math.floor(random() * hidden.length)]);
        n += 1;
      }
      return n;
    }
    return 0;
  }

  function hintLabel(n) {
    if (kind === 'abcd') return `loại ${n} đáp án sai`;
    return `mở ${n} chữ`;
  }

  return {
    id,
    title,
    setGiftCatalog: (catalog) => onCatalog?.(catalog),
    handleEvent(event, now = Date.now()) {
      const fx = [];
      touch(event.user, now);
      if (event.type === 'chat') {
        if (phase !== 'question' || paused) return fx;
        if (kind === 'text') onText(event.user, event.comment, now, fx);
        else if (kind === 'abcd') onVote(event.user, event.comment, now);
        else onWordleGuess(event.user, event.comment, now, fx);
      } else if (event.type === 'gift' && onGift) {
        fx.push(...onGift(event, now));
      } else if (event.type === 'gift') {
        const tier = giftTier(event.gift.diamondsEach);
        let opened = 0;
        if (phase === 'question' && !paused) {
          // 1 xu mở 1 chữ, >= 5 xu mở 2 chữ, >= 10 xu mở 3 chữ
          const coins = event.gift.diamondsEach;
          const amount = coins >= 10 ? 3 : coins >= 5 ? 2 : 1;
          opened = giveHint(amount);
          hintsByGifts += opened;
        }
        fx.push({
          kind: 'quizGift', userId: event.user.id, nickname: event.user.nickname, giftName: event.gift.name, giftPicture: event.gift.pictureUrl,
          count: event.gift.count, tier, hint: opened ? hintLabel(opened) : ''
        });
      } else if (event.type === 'like') {
        if (!paused) {
          addEnergy(event.likeCount, fx);
        }
      } else if (event.type === 'follow') {
        followers.add(event.user.id);
        if (!followedNow.has(event.user.id)) {
          followedNow.add(event.user.id);
          followCount += 1;
          addPoints(event.user, FOLLOW_POINTS, { correct: false });
          fx.push({ kind: 'quizFollow', userId: event.user.id, nickname: event.user.nickname, avatar: event.user.avatar, points: FOLLOW_POINTS,
            goal: FOLLOW_GOAL, count: followCount % FOLLOW_GOAL || FOLLOW_GOAL });
          if (followCount % FOLLOW_GOAL === 0) {
            goldenPending = true;
            fx.push({ kind: 'quizEnergy', reward: 'golden', by: 'follow' });
          }
        }
      } else if (event.type === 'share') {
        const row = sharers.get(event.user.id) || { id: event.user.id, shares: 0 };
        Object.assign(row, { nickname: event.user.nickname, avatar: event.user.avatar, shares: row.shares + 1 });
        sharers.set(event.user.id, row);
        const energized = row.shares <= SHARE_ENERGY_MAX_PER_USER && !paused;
        fx.push({ kind: 'quizShare', userId: event.user.id, nickname: event.user.nickname, avatar: event.user.avatar, energy: energized ? SHARE_ENERGY : 0 });
        if (energized) {
          addEnergy(SHARE_ENERGY, fx);
          fx.push({ kind: 'toast', text: `🔄 Cảm ơn đại sứ ${event.user.nickname} đã chia sẻ!` });
        }
      }
      return fx;
    },
    /** active=false: game đang ở tab khác → dừng đồng hồ, không ra câu mới. */
    /** active=false: game đang ở tab khác → dừng đồng hồ, không ra câu mới. */
    tick(now = Date.now(), active = true) {
      const fx = [];
      const dt = lastTick === null ? 0 : Math.max(0, now - lastTick);
      lastTick = now;
      if (!active || paused) {
        if (phase !== 'idle') {
          phaseEnd += dt;
          phaseStart += dt;
          countStart += dt;
          if (firstCorrectAt) firstCorrectAt += dt;
        }
        return fx;
      }
      if (phase === 'idle') {
        startQuestion(now, fx);
        return fx;
      }
      if (phase === 'question') {
        // gợi ý tự động khi đã qua 50% và 75% thời gian (chỉ đoán chữ)
        const ratio = (now - countStart) / totalMs();
        if (autoHints && kind === 'text' && !q.math) {
          if (autoHintStep === 0 && ratio >= 0.5) {
            autoHintStep = 1;
            revealLetters(1, Math.max(1, Math.ceil(slots.length / 3)));
          } else if (autoHintStep === 1 && ratio >= 0.75) {
            autoHintStep = 2;
            revealLetters(1, Math.max(1, Math.ceil(slots.length / 4)));
          }
        }
        const graceOver = kind === 'text' && firstCorrectAt && now - firstCorrectAt >= FIRST_CORRECT_GRACE_MS;
        if (now >= phaseEnd + LATE_MS || graceOver || (kind === 'text' && winners.length >= 12)) reveal(now, fx);
      } else if (phase === 'reveal' && now >= phaseEnd) startQuestion(now, fx);
      return fx;
    },
    command(name, now = Date.now()) {
      const own = onCommand?.(name, now);
      if (own) return own;
      const fx = [];
      if (name === 'next') {
        if (phase === 'question') reveal(now, fx);
        else startQuestion(now, fx);
      } else if (name === 'pause') {
        paused = true;
        fx.push({ kind: 'toast', text: '⏸ Tạm dừng' });
      } else if (name === 'resume') {
        paused = false;
        fx.push({ kind: 'toast', text: '▶ Tiếp tục' });
      } else if (name === 'hint') {
        const n = phase === 'question' ? giveHint(1) : 0;
        if (n) fx.push({ kind: 'toast', text: `💡 Gợi ý: ${hintLabel(n)}` });
      } else if (name === 'resetScores') {
        scores.clear();
        sharers.clear();
        fx.push({ kind: 'toast', text: '🏆 Đã xoá bảng điểm và đại sứ' });
      } else if (name === 'resetAmbassadors') {
        sharers.clear();
        fx.push({ kind: 'toast', text: '↗ Đã xoá bảng đại sứ share' });
      }
      return fx;
    },
    restore(state) {
      if (!state) return;
      if (typeof state.qNumber === 'number' && state.qNumber > 0) {
        qNumber = state.qNumber;
      }
      if (state.allScores) {
        for (const r of state.allScores) {
          scores.set(r.id, { id: r.id, nickname: r.nickname, avatar: r.avatar, points: r.points, correct: r.correct || Math.floor(r.points / 5), bolts: r.bolts || 0 });
        }
      } else if (state.board) {
        for (const r of state.board) {
          scores.set(r.id, { id: r.id, nickname: r.nickname, avatar: r.avatar, points: r.points, correct: Math.floor(r.points / 5), bolts: r.bolts || 0 });
        }
      }
      if (state.players) {
        for (const p of state.players) {
          present.set(p.id, { id: p.id, nickname: p.nickname, avatar: p.avatar, at: Date.now() });
          if (!scores.has(p.id)) scores.set(p.id, { id: p.id, nickname: p.nickname, avatar: p.avatar, points: p.points, correct: 0 });
        }
      }
      if (state.energy) {
        if (typeof state.energy.value === 'number') energy = state.energy.value;
        if (typeof state.energy.goldenPending === 'boolean') goldenPending = state.energy.goldenPending;
        if (typeof state.energy.lightningQueued === 'boolean') lightningQueued = state.energy.lightningQueued;
        if (typeof state.energy.follows === 'number') followCount = state.energy.follows;
      }
      if (typeof state.golden === 'boolean') golden = state.golden;
      if (state.lightning && typeof state.lightning.index === 'number') {
        lightningIndex = state.lightning.index;
      }
      if (state.ambassadors) {
        for (const a of state.ambassadors) sharers.set(a.id, { id: a.id, nickname: a.nickname, avatar: a.avatar, shares: a.shares });
      }
      if (state.control && onRestore) {
        onRestore(state.control);
      }
    },
    snapshot(now = Date.now()) {
      const board = [...scores.values()].sort((a, b) => b.points - a.points || b.correct - a.correct).slice(0, 5)
        .map((r) => ({ id: r.id, nickname: r.nickname, avatar: r.avatar, points: r.points, bolts: r.bolts || 0, follower: followers.has(r.id) }));
      // người đang có mặt (cho mục "Tặng quà cho người đang có mặt") — để ĐẦU TIÊN trong state
      const players = [...present.values()].filter((p) => now - p.at < PRESENT_MS).slice(-30)
        .map((p) => ({ id: p.id, nickname: p.nickname, avatar: p.avatar, points: scores.get(p.id)?.points || 0, follower: followers.has(p.id) }));
      const state = {
        players,
        mode: kind,
        phase,
        paused,
        qNumber,
        category: q?.category || '',
        prompt: q && kind !== 'wordle' ? q.prompt : '',
        emoji: q?.emoji || '',
        flag: q?.flag || '',
        math: Boolean(q?.math),
        // 2 giây đầu (chờ live trễ) đồng hồ đứng ở mức đầy
        leadIn: phase === 'question' && now < countStart,
        msLeft: phase === 'question' ? Math.max(0, Math.round((phaseEnd - Math.max(now, countStart)) / 100) * 100) : 0,
        totalMs: q ? (lightningIndex ? LIGHTNING_MS : totalMs()) : 0,
        answer: phase === 'reveal' ? answerText() : '',
        winners: winners.slice(0, 5).map((w) => ({ id: w.id, nickname: w.nickname, avatar: w.avatar, points: w.points, follower: followers.has(w.id) })),
        correctCount: winners.length,
        board,
        allScores: [...scores.values()].map((r) => ({ id: r.id, nickname: r.nickname, avatar: r.avatar, points: r.points, correct: r.correct || 0, bolts: r.bolts || 0 })),
        golden,
        lightning: lightningIndex ? { index: lightningIndex, total: LIGHTNING_QUESTIONS } : null,
        energy: { value: energy, golden: ENERGY_GOLDEN, max: ENERGY_LIGHTNING, goldenPending, lightningQueued,
          follows: followCount % FOLLOW_GOAL, followGoal: FOLLOW_GOAL },
        // bảng ĐẠI SỨ: người share nhiều nhất buổi
        ambassadors: [...sharers.values()].sort((a, b) => b.shares - a.shares).slice(0, 3)
          .map((r) => ({ id: r.id, nickname: r.nickname, avatar: r.avatar, shares: r.shares, follower: followers.has(r.id) }))
      };
      if (extraState) state.control = extraState();
      if (kind === 'text' && q && !q.math) {
        state.mask = [...q.answer].map((ch, i) => (!foldText(ch) ? ch : phase === 'reveal' || revealed.has(i) ? ch : '_'));
      }
      if (kind === 'abcd' && q) {
        state.options = options.map((text, i) => ({ letter: LETTERS[i], text, removed: removed.has(i) }));
        state.votes = [...voteCounts];
        state.voters = votes.size;
        state.rightIndex = phase === 'reveal' ? rightIndex : -1;
      }
      if (kind === 'wordle' && q) {
        state.guesses = guesses.slice(-WORDLE_ROWS).map((g) => ({ word: g.word.toUpperCase(), marks: g.marks, nickname: isCleanForDisplay(g.nickname) ? g.nickname : 'Bạn' }));
        state.keyboard = keyboard;
        state.known = slots.map((i) => (phase === 'reveal' || greens.has(i) || revealed.has(i) ? q[i].toUpperCase() : ''));
        state.guessCount = guesses.length;
      }
      return state;
    }
  };
}
