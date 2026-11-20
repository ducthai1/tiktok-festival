// BỘ MÁY ĐỐ VUI dùng chung cho mọi tab đố (Lớp Học Chữ, A/B/C/D, Tiếng Anh, Đuổi hình, Quốc kỳ, Toán, Wordle).
// Vòng lặp: HỎI (đếm ngược) → ĐÁP ÁN (vài giây) → câu tiếp. Người xem trả lời bằng bình luận.
// Luật quà theo hướng dẫn TikTok: quà KHÔNG cộng điểm cho người tặng — quà chỉ mở gợi ý CHO CẢ PHÒNG (cố định, không may rủi).
// Tim (và share) đổ vào thanh NĂNG LƯỢNG chung: 200 → câu sau là ⭐ CÂU VÀNG (x2 điểm); 400 → ⚡ CHỚP NHOÁNG (3 câu 8 giây,
// ai đúng cả 3 được ⚡ + 5 điểm) rồi thanh về 0. Follow lần đầu trong buổi: +3 điểm + 💖; cứ 10 follow → câu vàng cho cả phòng.
// Share: +20 năng lượng (tính 5 lần/người/buổi), người share nhiều nhất lên bảng ĐẠI SỨ. Live trễ 1–2 giây nên mỗi câu hiện đề 2 giây rồi mới đếm, hết giờ vẫn nhận
// thêm 1,5 giây bình luận đang trên đường tới. Game không ở tab đang chọn thì đứng yên (đồng hồ không chạy).
import { giftTier } from '../../../public/shared/gift-tiers.js';
import { createCooldown, foldText, isCleanForDisplay } from '../text-match.js';

export const POINTS = [10, 7, 5, 3, 3, 3]; // đúng 6 bạn nhanh nhất mới được điểm, không có người thứ 7
const MAX_TRIES = 6; // mỗi người tối đa 6 lần đoán mỗi câu (chống dội bình luận)
const FIRST_CORRECT_GRACE_MS = 5000; // có người đúng rồi thì chờ thêm 5 giây cho người khác rồi lật đáp án
export const LEAD_IN_MS = 2000; // đề hiện rồi mới bắt đầu đếm ngược (người xem thấy đề trễ 1–2 giây)
/**
 * ĐỘ TRỄ SÓNG LIVE. Người xem KHÔNG thấy đề cùng lúc với máy chủ: màn hình OBS → mã hoá → TikTok →
 * điện thoại người xem mất 5–15 giây, bình luận đi ngược lại cũng mất thêm vài giây. Vì vậy một câu
 * trả lời ĐÚNG thường về tới máy chủ sau khi đề đã đóng — trước đây bị vứt thẳng, người xem thấy
 * "gõ mãi không ăn". Nay giữ đề vừa đóng sống thêm bấy nhiêu mili-giây để nhận nốt.
 * Chỉnh ở trang điều khiển (📺 Màn hình & âm thanh → Độ trễ sóng live).
 */
export const DEFAULT_LATE_MS = 9000;
export const MAX_LATE_MS = 30000;

/**
 * Tính thời gian đọc câu hỏi (giọng VieNeu / Edge TTS) để đồng hồ CHỜ ĐỌC XONG mới đếm ngược.
 * Mỗi âm tiết ~230ms, dấu phẩy ~200ms, dấu chấm/hỏi/chấm than ~300ms + 500ms nạp/đệm âm thanh.
 * Tối thiểu LEAD_IN_MS (2000ms) để người xem kịp nhìn đề kể cả khi câu ngắn / không có giọng đọc.
 */
export function estimateSpeechLeadIn(speechText) {
  if (!speechText) return LEAD_IN_MS;
  const clean = speechText.replace(/[!?,;.]/g, ' ').trim();
  const words = clean.split(/\s+/).filter(Boolean).length;
  if (!words) return LEAD_IN_MS;
  const commas = (speechText.match(/[,;]/g) || []).length;
  const periods = (speechText.match(/[.!?]/g) || []).length;
  const speechMs = Math.round(500 + words * 230 + commas * 200 + periods * 300);
  return Math.max(LEAD_IN_MS, speechMs);
}
export const LATE_MS = 1500; // hết giờ vẫn nhận bình luận gửi kịp nhưng tới chậm
/**
 * THỜI GIAN MỖI CÂU TÍNH THEO ĐÁP ÁN, không để một con số chết cho mọi câu.
 * Đáp án dài hoặc nhiều chữ thì phải gõ lâu hơn; bậc khó hơn thì phải nghĩ lâu hơn.
 * (Trước đây mọi câu đều 20 giây: từ 3 chữ cái thì thừa, từ 20 chữ cái thì gõ không kịp.)
 */
export const TIME_REF_CHARS = 8; // đáp án "cỡ trung bình" — giờ gốc của tab ứng với độ dài này
export const TIME_PER_CHAR_MS = 700; // mỗi chữ cái dài/ngắn hơn mức trung bình
export const TIME_PER_EXTRA_WORD_MS = 1500; // mỗi chữ rời thêm (dấu cách khó gõ hơn chữ cái)
export const TIME_PER_LEVEL_MS = 2500; // bậc 2 thêm ngần này, bậc 3 thêm gấp đôi
export const TIME_MIN_MS = 12000;
export const TIME_MAX_MS = 35000;
/** Số người trả lời ĐÚNG thì chốt câu luôn cho mượt — chỉ 6 người đầu có điểm nên không thiệt ai. */
export const END_AFTER_CORRECT = 10;

// NHỊP GỢI Ý: mở TỪNG Ô MỘT, rải đều từ mốc này tới mốc kia của thời gian câu hỏi.
// (Trước đây mở theo hai mốc 50% / 75%: tới 75% là nổ một phát xuống còn 1–2 ô, trong khi
//  đồng hồ vẫn còn cả nửa phút — người xem nhìn gần như đáp án đầy đủ, hết hay.)
export const HINT_START_RATIO = 0.35; // qua 1/3 thời gian mới bắt đầu nhỏ giọt
export const HINT_END_RATIO = 0.92; // gần hết giờ thì mở tới mức tối đa cho phép
/** Số ô LUÔN để trống tới cùng (gợi ý tự động không bao giờ mở hết đáp án). */
export const hintMinHidden = (len) => (len <= 4 ? 1 : 2);

/**
 * Tới thời điểm `ratio` thì ĐƯỢC PHÉP lộ tối đa bao nhiêu ô trong tổng `len` ô.
 * `free` = số ô đã cho sẵn lúc ra đề (chữ cái đầu). Những ô đó KHÔNG tính vào suất gợi ý,
 * nếu không thì ô gợi ý đầu tiên bị đẩy lùi mãi về cuối giờ.
 */
export function hintTargetOpen(len, ratio, free = 0) {
  if (!(len > 0)) return 0;
  const cho = Math.max(0, Math.min(len, free));
  const toiDa = Math.max(0, len - hintMinHidden(len) - cho); // số ô gợi ý được phép mở
  const tien = Math.max(0, Math.min(1, (ratio - HINT_START_RATIO) / (HINT_END_RATIO - HINT_START_RATIO)));
  return cho + Math.floor(tien * toiDa);
}

/**
 * Thời gian cho một câu gõ chữ. Neo vào giờ gốc của tab (`baseMs`) rồi cộng/trừ quanh đó theo
 * độ dài đáp án và bậc khó — nhờ vậy mỗi tab vẫn giữ nhịp riêng (Lớp Học Chữ chậm hơn tab tiếng Anh),
 * chỉ là câu dài thì rộng giờ ra, câu ngắn thì co lại.
 */
export function questionTimeMs(answer, level = 1, baseMs = 20000) {
  const text = String(answer || '').trim();
  if (!text) return Math.max(TIME_MIN_MS, Math.min(TIME_MAX_MS, baseMs));
  const chars = text.replace(/\s+/g, '').length;
  const extraWords = Math.max(0, text.split(/\s+/).filter(Boolean).length - 1);
  const step = Math.max(0, (Number(level) || 1) - 1);
  const ms = baseMs
    + (chars - TIME_REF_CHARS) * TIME_PER_CHAR_MS
    + extraWords * TIME_PER_EXTRA_WORD_MS
    + step * TIME_PER_LEVEL_MS;
  return Math.round(Math.max(TIME_MIN_MS, Math.min(TIME_MAX_MS, ms)) / 500) * 500;
}
export const ENERGY_GOLDEN = 200;
export const ENERGY_LIGHTNING = 400;
export const FOLLOW_POINTS = 3;
export const FOLLOW_GOAL = 10;
export const SHARE_ENERGY = 20;
export const SHARE_ENERGY_MAX_PER_USER = 5;
/** Quá bấy nhiêu không có tương tác nào (bình luận, tim, quà, share, follow, vào phòng) → xoá khỏi bảng xếp hạng + bảng đại sứ share,
 * quay lại thì tính từ 0 (chủ kênh chốt 13/11/2026). */
export const INACTIVE_MS = 2 * 60 * 60 * 1000;
const PRUNE_EVERY_MS = 30000;
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
  onGift = null, onCommand = null, extraState = null, onRestore = null, onCatalog = null, pronounce = null, onPronounce = null,
  onRoomReset = null, // phòng live mới: tab tự xoá trạng thái riêng của phòng cũ (vd tab tiếng Anh: chế độ đề đang chạy)
  donors = null, // 👑 Bảng vàng (phiên live hiện tại) dùng chung mọi tab — game-hub.js → donor-ledger.js
  answersLogger = null, // 📋 Ghi log đáp án — answers-logger.js
  lateMs = DEFAULT_LATE_MS // cửa sổ nhận câu trả lời đến trễ vì độ trễ sóng live
}) {
  const scores = new Map(); // id → { id, nickname, avatar, points, correct }
  const present = new Map(); // id → { id, nickname, avatar, at }
  const wordleCooldown = createCooldown(3000);
  let q = null;
  const priorityQueue = [];
  let phase = 'idle'; // idle → question → reveal → question …
  let paused = false;
  let phaseStart = 0;
  let phaseEnd = 0;
  let lastTick = null;
  let qNumber = 0;
  // theo từng câu
  let winners = [];
  // MỌI người trả lời đúng câu này (kể cả ngoài top 6). Trước đây đủ 6 người là thôi dò luôn,
  // nên người thứ 7 gõ đúng vẫn bị ghi là SAI và màn hình không hề biết phòng đang trả lời rất tốt.
  let correctIds = new Set();
  let tries = new Map();
  let firstCorrectAt = 0;
  let revealed = new Set(); // chữ đã lộ (text) / ô đã lộ (wordle)
  let slots = [];
  let options = [];
  let rightIndex = -1;
  let votes = new Map(); // abcd: id → { idx, at, user }
  let voteCounts = [0, 0, 0, 0];
  let removed = new Set();
  let guesses = [];
  let keyboard = {};
  let greens = new Set();
  let freeRevealed = 0; // số ô cho sẵn lúc ra đề (chữ cái đầu)
  let countStart = 0; // lúc bắt đầu đếm ngược (sau 2 giây hiện đề)
  // Đề vừa đóng, vẫn nhận câu trả lời đến trễ: { until, accept, checkAnswer, qNumber, answer, won }
  let late = null;
  let lateStats = { count: 0, totalMs: 0 }; // để log biết độ trễ thực tế bao nhiêu
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
  const sharers = new Map(); // id → { id, nickname, avatar, shares, at } — bảng đại sứ (giữ qua các phòng live, xoá sau 2 tiếng im lặng)
  // 💬 Bình luận THEO THỨ TỰ MÁY CHỦ NHẬN (khung bên phải màn hình): người xem thấy bình luận của mình trước trên máy mình nên tưởng
  // mình nhanh hơn — khung này cho cả phòng thấy thứ tự thật + số giây từ lúc ra đề + ai đúng thứ mấy, khỏi tranh cãi.
  const feed = [];
  let feedSeq = 0;
  const liveShares = new Map(); // id → số lần share TRONG PHÒNG LIVE NÀY (giới hạn năng lượng 5 lần/người/buổi)
  let lastPrune = 0;
  let clock = 0; // giờ của sự kiện / nhịp đang xử lý (đồng hồ của engine, không phải Date.now — test chạy đồng hồ giả)
  let hintsByGifts = 0;

  // abcd: giờ theo bậc như cũ · wordle: giờ cố định của tab · còn lại: tính theo đáp án.
  // q.timeMs (câu đặc biệt tự đặt giờ) luôn thắng.
  const totalMs = () => {
    if (q?.timeMs) return q.timeMs;
    if (kind === 'abcd') return ABCD_MS[q?.level] || 15000;
    if (kind === 'text' && q?.answer) return questionTimeMs(q.answer, q.level, questionMs);
    return questionMs;
  };
  // Luyện nghe (q.listen): đọc từ lúc ra đề, đọc CHẬM sau ~7 giây, đọc lại giữa giờ (live trễ / người vào giữa chừng vẫn nghe kịp)
  let listenAt = []; // [{ at: ms kể từ lúc ra đề, slow }] — tính theo phaseStart nên tạm dừng không làm lệch

  const mult = () => (diamond ? 3 : golden ? 2 : 1);

  /** Bình luận vào khung "theo thứ tự máy chủ nhận": giây tính từ lúc ra đề (đang hỏi), giữ 20 dòng mới nhất. */
  function feedEntry(event, now) {
    const text = String(event.comment || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!text || !event.user?.id) return null;
    const entry = {
      key: (feedSeq += 1), id: event.user.id, avatar: event.user.avatar || '', q: qNumber,
      nickname: isCleanForDisplay(event.user.nickname) ? event.user.nickname : 'Người xem',
      text: isCleanForDisplay(text) ? text : '***',
      t: phase === 'question' ? Math.max(0, Math.round((now - phaseStart) / 100) / 10) : null, rank: 0
    };
    feed.push(entry);
    if (feed.length > 20) feed.shift();
    return entry;
  }

  function touch(user, now) {
    if (!user?.id) return;
    // còn tương tác → còn trên bảng xếp hạng / bảng đại sứ
    const row = scores.get(user.id);
    if (row) row.at = now;
    const sharer = sharers.get(user.id);
    if (sharer) sharer.at = now;
    if (user.follower) followers.add(user.id);
    present.set(user.id, { id: user.id, nickname: user.nickname, avatar: user.avatar, at: now });
    if (present.size > 400) present.delete(present.keys().next().value);
  }

  function addPoints(user, points, { correct = true } = {}) {
    const row = scores.get(user.id) || { id: user.id, nickname: user.nickname, avatar: user.avatar, points: 0, correct: 0, bolts: 0 };
    row.at = row.at || clock;
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
    q = priorityQueue.length ? priorityQueue.shift() : deck.next();
    qNumber += 1;
    phase = 'question';
    phaseStart = now;
    winners = [];
    correctIds = new Set();
    tries = new Map();
    firstCorrectAt = 0;
    revealed = new Set();
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
      freeRevealed = slots.filter((slot) => revealed.has(slot)).length; // chữ cho sẵn, không tính vào suất gợi ý
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
    const intro = diamond ? 'Câu Kim Cương, NHÂN BA ĐIỂM! ' : golden ? 'Câu Vàng, nhân đôi điểm! ' : '';
    const speech = intro + (speakLine(q) || '');
    if (q.notice) fx.push({ kind: 'toast', text: q.notice });
    fx.push({ kind: 'quizQuestion', qNumber, category: q.category, golden, lightning: lightningIndex, listen: Boolean(q.listen),
      speech });
    answersLogger?.logQuestion(qNumber, { category: q.category || '', prompt: q.prompt || q.emoji || q.speech || '', answer: q.answer || (kind === 'wordle' ? q : '') || '' });
    const leadIn = lightningIndex ? 1500 : (q.listen ? LEAD_IN_MS : estimateSpeechLeadIn(speech));
    countStart = now + leadIn;
    phaseEnd = countStart + (lightningIndex ? LIGHTNING_MS : totalMs());
    const total = lightningIndex ? LIGHTNING_MS : totalMs();
    listenAt = !q.listen ? [] : lightningIndex ? [{ at: 300, slow: false }]
      : [{ at: 300, slow: false }, { at: 7000, slow: true }, { at: leadIn + Math.round(total * 0.55), slow: false }];
    if (pronounce && onPronounce) {
      try {
        onPronounce(pronounce(q));
      } catch (error) {
        console.warn(`[quiz] tạo sẵn giọng đọc đáp án lỗi: ${error.message}`); // giọng đọc hỏng không được làm hỏng câu hỏi
      }
    }
  }

  /**
   * Quà / nút đổi chế độ (tab tiếng Anh) → ra câu mới NGAY trong chế độ mới, bỏ câu đang hỏi. Trừ vòng chớp nhoáng (câu 8 giây:
   * đổi từ câu sau, không phá vòng 3 câu) và lúc tạm dừng. Câu vàng / kim cương chưa ai trả lời thì câu mới giữ quyền đó.
   */
  function switchNow(now, fx) {
    if (lightningIndex || paused || phase === 'idle') return;
    if (phase === 'question' && !winners.length) {
      goldenPending = goldenPending || golden;
      diamondPending = diamondPending || diamond;
    }
    startQuestion(now, fx);
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
    listenAt = []; // lật sớm (đủ người đúng / bấm câu tiếp) thì thôi đọc lại
    if (kind === 'abcd') {
      const right = [...votes.values()].filter((v) => v.idx === rightIndex).sort((a, b) => a.at - b.at);
      winners = right.slice(0, POINTS.length).map((v, rank) => {
        const points = POINTS[rank] * mult();
        addPoints(v.user, points);
        return { id: v.user.id, nickname: v.user.nickname, avatar: v.user.avatar, points };
      });
    }
    phase = 'reveal';
    phaseStart = now;
    // Giữ đề vừa đóng "sống" thêm lateMs để nhận nốt câu trả lời đang trên đường về (độ trễ sóng live).
    late = kind === 'text' && lateMs > 0 && q
      ? { until: now + lateMs, accept: q.accept, checkAnswer: q.checkAnswer, qNumber, answer: q.answer,
          won: new Set(correctIds), closedAt: now, slots: POINTS.length - winners.length }
      : null;
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
    const neededRevealMs = (english.answerEn ? (english.answerEnSlow ? 3500 : 1800) : 0) + (speech ? estimateSpeechLeadIn(speech) : 0) + 800;
    const durationMs = Math.max(revealMs, neededRevealMs);
    phaseEnd = now + (lightningIndex && lightningIndex < LIGHTNING_QUESTIONS ? LIGHTNING_REVEAL_MS : durationMs);
    fx.push({ kind: 'quizReveal', answer, winners: winners.slice(0, 6), correctCount: correctIds.size || winners.length, speech, ...english });
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

  /** Câu bình luận có khớp đáp án của một đề không (dùng cho cả đề hiện tại lẫn đề vừa đóng). */
  function matchesAnswer(target, comment) {
    if (typeof target?.checkAnswer === 'function') return Boolean(target.checkAnswer(comment));
    const said = foldText(comment);
    if (!said) return false;
    const compact = said.replace(/ /g, '');
    return (target?.accept || []).some((a) => a === said || a.replace(/ /g, '') === compact);
  }

  /**
   * Câu trả lời ĐÚNG nhưng về tới máy chủ sau khi đề đã đóng — do độ trễ sóng live, không phải lỗi
   * người xem. Vẫn cộng điểm và báo lên màn hình, chỉ không chen vào bảng xếp hạng của câu đó nữa.
   */
  function onLateText(user, comment, now, fx) {
    if (!late || now >= late.until) return false;
    if (late.won.has(user.id) || late.slots <= 0) return false;
    if (!matchesAnswer(late, comment)) return false;
    late.won.add(user.id);
    late.slots -= 1;
    const points = POINTS[POINTS.length - 1] * mult(); // về trễ thì nhận mức điểm thấp nhất
    addPoints(user, points);
    lateStats.count += 1;
    lateStats.totalMs += now - late.closedAt;
    answersLogger?.logAnswer(late.qNumber, { user, comment, result: 'correct-late', points });
    fx.push({ kind: 'quizCorrect', userId: user.id, nickname: user.nickname, avatar: user.avatar, rank: 0, points, late: true });
    return true;
  }

  // ---- trả lời ----
  function onText(user, comment, now, fx) {
    if (correctIds.has(user.id)) {
      answersLogger?.logAnswer(qNumber, { user, comment, result: 'ALREADY_WON' });
      return;
    }
    const n = (tries.get(user.id) || 0) + 1;
    tries.set(user.id, n);
    if (n > MAX_TRIES) {
      answersLogger?.logAnswer(qNumber, { user, comment, result: 'MAX_TRIES' });
      return;
    }
    if (!matchesAnswer(q, comment)) {
      // Sai với đề ĐANG hỏi → thử đề VỪA ĐÓNG: người xem đang nhìn đề cũ lúc gõ (độ trễ sóng live).
      if (onLateText(user, comment, now, fx)) return;
      answersLogger?.logAnswer(qNumber, { user, comment, result: 'WRONG' });
      return;
    }
    correctIds.add(user.id);
    if (!firstCorrectAt) firstCorrectAt = now;
    // Ngoài top 6 thì KHÔNG có điểm, nhưng vẫn ghi nhận là đúng và vẫn hiện tên — phòng trả lời
    // tốt thì cứ chốt câu sớm cho mượt, không bắt cả phòng ngồi chờ hết giờ.
    if (winners.length >= POINTS.length) {
      answersLogger?.logAnswer(qNumber, { user, comment, result: 'correct-no-slot', rank: correctIds.size });
      fx.push({ kind: 'quizCorrect', userId: user.id, nickname: user.nickname, avatar: user.avatar, rank: 0, points: 0, extra: true });
      return;
    }
    const points = POINTS[winners.length] * mult();
    addPoints(user, points);
    winners.push({ id: user.id, nickname: user.nickname, avatar: user.avatar, points, ms: now - phaseStart });
    const rank = winners.length;
    answersLogger?.logAnswer(qNumber, { user, comment, result: 'correct', rank, points });
    fx.push({ kind: 'quizCorrect', userId: user.id, nickname: user.nickname, avatar: user.avatar, rank, points });
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
    queuePriority(list) {
      if (Array.isArray(list)) priorityQueue.push(...list);
      else if (list) priorityQueue.push(list);
    },
    setGiftCatalog: (catalog) => onCatalog?.(catalog),
    /** Độ trễ sóng live (ms) — trang điều khiển chỉnh. 0 = tắt hẳn việc nhận câu trả lời đến trễ. */
    setLateMs(ms) {
      lateMs = Math.max(0, Math.min(MAX_LATE_MS, Math.round(Number(ms) || 0)));
    },
    /** Thống kê câu trả lời đúng nhưng về trễ — để biết nên đặt độ trễ bao nhiêu. */
    lateReport: () => ({ count: lateStats.count, avgMs: lateStats.count ? Math.round(lateStats.totalMs / lateStats.count) : 0 }),
    handleEvent(event, now = Date.now()) {
      const fx = [];
      clock = now;
      touch(event.user, now);
      if (event.type === 'chat') {
        const entry = feedEntry(event, now);
        if (phase !== 'question' || paused) {
          // Đang hiện đáp án / tạm dừng: vẫn nhận nốt câu đúng đang trên đường về vì độ trễ sóng live
          if (!paused && kind === 'text') onLateText(event.user, event.comment, now, fx);
          return fx;
        }
        const before = winners.length;
        if (kind === 'text') onText(event.user, event.comment, now, fx);
        else if (kind === 'abcd') onVote(event.user, event.comment, now);
        else onWordleGuess(event.user, event.comment, now, fx);
        if (entry && winners.length > before && winners.at(-1).id === event.user.id) entry.rank = winners.length; // đúng thứ mấy
      } else if (event.type === 'gift' && onGift) {
        const own = onGift(event, now) || [];
        fx.push(...own);
        if (own.some((f) => f.switchNow)) switchNow(now, fx);
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
        Object.assign(row, { nickname: event.user.nickname, avatar: event.user.avatar, shares: row.shares + 1, at: now });
        sharers.set(event.user.id, row);
        const inRoom = (liveShares.get(event.user.id) || 0) + 1;
        liveShares.set(event.user.id, inRoom);
        const energized = inRoom <= SHARE_ENERGY_MAX_PER_USER && !paused;
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
      clock = now;
      if (now - lastPrune >= PRUNE_EVERY_MS) {
        lastPrune = now;
        for (const [uid, r] of scores) if (now - (r.at || now) > INACTIVE_MS) scores.delete(uid);
        for (const [uid, r] of sharers) if (now - (r.at || now) > INACTIVE_MS) sharers.delete(uid);
      }
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
        while (listenAt.length && now - phaseStart >= listenAt[0].at) {
          const { slow } = listenAt.shift();
          if (pronounce) fx.push({ kind: 'quizListen', word: pronounce(q), slow });
        }
        // Gợi ý tự động: mở TỪNG Ô MỘT, rải đều theo thời gian còn lại. Từ càng dài thì
        // các ô nối nhau càng mau (vì phải mở nhiều ô trong cùng quãng thời gian), nhưng
        // không bao giờ nổ một phát mấy ô cùng lúc. Luôn chừa 1–2 ô tới cùng.
        const ratio = (now - countStart) / totalMs();
        if (autoHints && kind === 'text' && !q.math && slots.length) {
          const dangMo = slots.filter((slot) => revealed.has(slot)).length;
          const nenMo = hintTargetOpen(slots.length, ratio, freeRevealed);
          // quà đã mở nhiều hơn mức này rồi thì thôi, không mở thêm
          if (nenMo > dangMo) revealLetters(nenMo - dangMo, hintMinHidden(slots.length));
        }
        // Kết thúc sớm khi:
        //  · đủ END_AFTER_CORRECT người đúng → phòng đang bắt bài rất tốt, chốt luôn cho mượt
        //  · hoặc bảng top (6 người) đã kín VÀ đã qua 5 giây kể từ câu đúng đầu tiên
        // Mới 1–5 người đúng thì để đồng hồ chạy tiếp cho người khác kịp gõ.
        const đủĐông = kind === 'text' && correctIds.size >= END_AFTER_CORRECT;
        const graceOver = kind === 'text' && firstCorrectAt && winners.length >= POINTS.length && now - firstCorrectAt >= FIRST_CORRECT_GRACE_MS;
        if (now >= phaseEnd + LATE_MS || đủĐông || graceOver) reveal(now, fx);
      } else if (phase === 'reveal' && now >= phaseEnd) startQuestion(now, fx);
      return fx;
    },
    /**
     * Phòng live MỚI (app.js nhận ra room id khác phòng trước): xoá thông số của phòng cũ — năng lượng tim, câu vàng / chớp nhoáng
     * đang chờ, mốc follow + ai đã được +3 điểm follow, lượt share tính năng lượng, chế độ đề của tab. GIỮ bảng xếp hạng và bảng
     * đại sứ (chúng tự xoá người im lặng quá 2 tiếng).
     */
    resetRoom() {
      energy = 0;
      goldenUnlocked = false;
      goldenPending = false;
      diamondPending = false;
      lightningQueued = 0;
      followedNow.clear();
      followCount = 0;
      liveShares.clear();
      onRoomReset?.();
    },
    command(name, now = Date.now()) {
      clock = now;
      const own = onCommand?.(name, now);
      if (own) {
        const out = [...own];
        if (own.some((f) => f.switchNow)) switchNow(now, out);
        return out;
      }
      const fx = [];
      if (name === 'next') {
        if (phase === 'question') reveal(now, fx);
        else {
          startQuestion(now, fx);
          const qFx = fx.find((f) => f.kind === 'quizQuestion');
          if (qFx) qFx.manual = true;
        }
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
        scores.clear(); // KHÔNG xoá đại sứ share: mỗi nút xoá chỉ xoá đúng bảng của nó
        fx.push({ kind: 'toast', text: '🏆 Đã xoá bảng điểm' });
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
          scores.set(r.id, { id: r.id, nickname: r.nickname, avatar: r.avatar, points: r.points, correct: r.correct || Math.floor(r.points / 5), bolts: r.bolts || 0,
            at: Number(r.at) || Date.now() });
        }
      } else if (state.board) {
        for (const r of state.board) {
          scores.set(r.id, { id: r.id, nickname: r.nickname, avatar: r.avatar, points: r.points, correct: Math.floor(r.points / 5), bolts: r.bolts || 0 });
        }
      }
      if (state.players) {
        for (const p of state.players) {
          present.set(p.id, { id: p.id, nickname: p.nickname, avatar: p.avatar, at: Date.now() });
          if (!scores.has(p.id)) scores.set(p.id, { id: p.id, nickname: p.nickname, avatar: p.avatar, points: p.points, correct: 0, at: Date.now() });
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
        for (const a of state.ambassadors) sharers.set(a.id, { id: a.id, nickname: a.nickname, avatar: a.avatar, shares: a.shares, at: Number(a.at) || Date.now() });
      }
      if (state.control && onRestore) {
        onRestore(state.control);
      }
      if (Array.isArray(state.comments) && state.comments.length) {
        feed.length = 0;
        feed.push(...state.comments);
        const maxKey = Math.max(...state.comments.map((c) => Number(c.key) || 0));
        if (maxKey > feedSeq) feedSeq = maxKey;
      }
    },
    snapshot(now = Date.now()) {
      const board = [...scores.values()].sort((a, b) => b.points - a.points || b.correct - a.correct).slice(0, 6)
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
        // luyện nghe: lúc hỏi chỉ có "🎧 Nghe rồi gõ lại", lật đáp án mới hiện nghĩa tiếng Việt
        prompt: q && kind !== 'wordle' ? (phase === 'reveal' && q.revealPrompt ? q.revealPrompt : q.prompt) : '',
        listen: Boolean(q?.listen),
        emoji: q?.emoji || '',
        flag: q?.flag || '',
        math: Boolean(q?.math),
        // 2 giây đầu (chờ live trễ) đồng hồ đứng ở mức đầy
        leadIn: phase === 'question' && now < countStart,
        msLeft: phase === 'question' ? Math.max(0, Math.round((phaseEnd - Math.max(now, countStart)) / 100) * 100) : 0,
        totalMs: q ? (lightningIndex ? LIGHTNING_MS : totalMs()) : 0,
        answer: phase === 'reveal' ? answerText() : '',
        winners: winners.slice(0, 6).map((w) => ({ id: w.id, nickname: w.nickname, avatar: w.avatar, points: w.points, follower: followers.has(w.id) })),
        correctCount: correctIds.size || winners.length, // kể cả người đúng ngoài top 6
        board,
        allScores: [...scores.values()].map((r) => ({ id: r.id, nickname: r.nickname, avatar: r.avatar, points: r.points, correct: r.correct || 0, bolts: r.bolts || 0, at: r.at || 0 })),
        golden,
        lightning: lightningIndex ? { index: lightningIndex, total: LIGHTNING_QUESTIONS } : null,
        energy: { value: energy, golden: ENERGY_GOLDEN, max: ENERGY_LIGHTNING, goldenPending, lightningQueued,
          follows: followCount % FOLLOW_GOAL, followGoal: FOLLOW_GOAL },
        ambassadors: [...sharers.values()].sort((a, b) => b.shares - a.shares).slice(0, 3)
          .map((r) => ({ id: r.id, nickname: r.nickname, avatar: r.avatar, shares: r.shares, follower: followers.has(r.id) })),
        // 👑 BẢNG VÀNG: 3 người tặng nhiều 💎 nhất trong phiên live hiện tại (donor-ledger.js)
        donators: (donors?.top(3) || []).map((r) => ({ ...r, follower: followers.has(r.id) })),
        comments: feed.slice(-12)
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
