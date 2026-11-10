// Cảnh ĐỐ VUI dùng chung cho 7 tab: nền 3D nhẹ (khối phát sáng trôi + pháo giấy) + bảng câu hỏi 2D ở giữa màn hình.
// Mỗi tab chỉ khác màu, tiêu đề, cách hiện đề (chữ / emoji / cờ / phép toán / A-B-C-D / Wordle).
import * as THREE from '/vendor/three/three.module.js';
import { createParticleSystem } from './particle-effects.js';
import { disposeObject } from './person-model.js';
import { avatarNode } from '../stage-labels.js';

const MODES = {
  lophoc: { icon: '📚', title: 'LỚP HỌC CHỮ', color: '#ffd36b', bg: '#0b1a16',
    hint: ['Gõ ', '*đáp án*', ' vào bình luận (không dấu cũng được) · 5 bạn nhanh nhất được ', '*10·7·5·3·3 điểm*'] },
  dovui: { icon: '🏆', title: 'ĐỐ VUI A·B·C·D', color: '#6ee7ff', bg: '#071528',
    hint: ['Bình luận ', '*A, B, C hoặc D*', ' · chỉ tính lần chọn đầu · đúng nhanh nhất được ', '*10 điểm*'] },
  english: { icon: '🔤', title: 'TỪ VỰNG TIẾNG ANH', color: '#7dff8a', bg: '#0b1630',
    hint: ['Đọc nghĩa tiếng Việt, ', '*gõ từ tiếng Anh*', ' · 5 bạn nhanh nhất được điểm'] },
  emoji: { icon: '🧩', title: 'ĐUỔI HÌNH BẮT CHỮ', color: '#ff9bd2', bg: '#1d0b26',
    hint: ['Nhìn emoji, ', '*gõ cụm từ*', ' · không dấu cũng được'] },
  flag: { icon: '🚩', title: 'ĐOÁN QUỐC KỲ', color: '#ff7a6b', bg: '#1a0d0b',
    hint: ['Gõ ', '*tên nước*', ' · tiếng Việt hay tiếng Anh đều được'] },
  math: { icon: '➗', title: 'TOÁN NHANH', color: '#ffe066', bg: '#101010',
    hint: ['Gõ ', '*kết quả*', ' · khó dần sau mỗi 3 câu'] },
  wordle: { icon: '🟩', title: 'WORDLE TIẾNG ANH', color: '#6aaa64', bg: '#0e140e',
    hint: ['Gõ ', '*từ tiếng Anh 5 chữ cái*', ' · 🟩 đúng chỗ · 🟨 có nhưng sai chỗ · ⬛ không có'] }
};
// Luật quà + tim ở chân bảng câu hỏi (bậc 3 = món từ 99💎, xem public/shared/gift-tiers.js)
const GIFT_RULES = {
  text: ['🎁 Quà → ', '*mở 1 chữ cho cả phòng*', ' (từ 99💎 mở 2) · ❤️ 300 tim = +3 giây'],
  abcd: ['🎁 Quà → ', '*loại 1 đáp án sai cho cả phòng*', ' (từ 99💎 loại 2) · ❤️ 300 tim = +3 giây'],
  wordle: ['🎁 Quà → ', '*mở 1 ô chữ cho cả phòng*', ' (từ 99💎 mở 2) · ❤️ 300 tim = +3 giây'],
  math: ['🎁 Quà = lời cảm ơn trên màn hình · ❤️ 300 tim = +3 giây'],
  english: ['🎁 Quà → ', '*đổi bộ đề / độ khó*', ' (bảng bên dưới) · ❤️ 300 tim = +3 giây']
};
const DECK_RULES_PER_PAGE = 7; // nhiều hơn thì bảng lật trang mỗi 10 giây
const DECK_PAGE_MS = 10000;

/** Bảng "quà đổi bộ đề" của tab tiếng Anh: dòng trạng thái (bộ + độ khó + người đổi) và các ô quà → bộ đề. */
function createDeckPanel(hud) {
  const el = hud.el;
  const root = el('section', 'deck-panel');
  const status = el('div', 'deck-status');
  const rulesRoot = el('div', 'deck-rules');
  root.append(status, rulesRoot);
  hud.gameRoot.append(root);
  let chips = [];
  let pageTimer = 0;
  let statusKey = '';
  let rulesKey = '';
  let active = new Set();

  function giftIcon(gift) {
    const box = el('span', 'gift');
    if (gift?.image) {
      const img = el('img');
      img.src = gift.image;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      box.append(img);
    } else box.append(el('span', 'emoji', gift?.emoji || '🎁'));
    box.append(el('i', '', `${gift?.coins || 1}💎`));
    return box;
  }

  function nowSlot(className, icon, label, left, by) {
    const slot = el('div', `deck-now ${className}`);
    slot.append(el('span', 'ic', icon), el('b', '', label));
    if (left) slot.append(el('em', '', `${left} câu`));
    if (by) {
      const who = el('span', 'by');
      who.append(avatarNode(by.avatar), el('span', 'name', by.nickname));
      slot.append(who);
    }
    return slot;
  }

  return {
    /** rules: [{ to, icon, label, gift }] — server gán sẵn món quà (dưới 20 xu) cho từng ô. */
    setRules(rules) {
      const key = JSON.stringify(rules || []);
      if (key === rulesKey) return;
      rulesKey = key;
      clearInterval(pageTimer);
      chips = (rules || []).map((rule) => {
        const chip = el('div', 'deck-rule');
        chip.dataset.to = rule.to;
        const to = el('span', 'to');
        to.append(el('b', '', rule.icon), el('small', '', rule.label));
        chip.append(giftIcon(rule.gift), el('span', 'arrow', '➜'), to);
        chip.classList.toggle('on', active.has(rule.to));
        return chip;
      });
      rulesRoot.style.gridTemplateColumns = `repeat(${Math.max(1, Math.min(chips.length, DECK_RULES_PER_PAGE))}, 1fr)`;
      const pages = [];
      for (let i = 0; i < chips.length; i += DECK_RULES_PER_PAGE) pages.push(chips.slice(i, i + DECK_RULES_PER_PAGE));
      let at = 0;
      const show = () => rulesRoot.replaceChildren(...(pages[at] || []));
      show();
      if (pages.length > 1) pageTimer = setInterval(() => { at = (at + 1) % pages.length; show(); }, DECK_PAGE_MS);
    },
    update(c) {
      if (!c) return;
      this.setRules(c.rules);
      active = new Set([c.set, c.level]);
      for (const chip of chips) chip.classList.toggle('on', active.has(chip.dataset.to));
      const key = JSON.stringify(c);
      if (key === statusKey) return;
      statusKey = key;
      status.replaceChildren(nowSlot('set', c.setIcon, c.setLabel, c.setLeft, c.setBy), nowSlot('level', c.levelIcon, c.levelLabel, c.levelLeft, c.levelBy));
    },
    dispose() {
      clearInterval(pageTimer);
    }
  };
}

export function createQuizScene({ hud, labels, audio, pipeline, id }) {
  const mode = MODES[id] || MODES.lophoc;
  const el = hud.el;
  const color = new THREE.Color(mode.color);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(mode.bg);
  scene.fog = new THREE.Fog(mode.bg, 10, 30);
  const camera = new THREE.PerspectiveCamera(50, 1080 / 1920, 0.1, 60);
  camera.position.set(0, 0, 14);
  pipeline.setBloom({ strength: 0.9, radius: 0.6, threshold: 0.2 });
  scene.add(new THREE.AmbientLight('#ffffff', 0.6));
  const key = new THREE.PointLight(mode.color, 60, 30);
  key.position.set(0, 4, 8);
  scene.add(key);

  // khối phát sáng trôi lơ lửng phía sau bảng câu hỏi
  const shapes = [];
  const geos = [new THREE.IcosahedronGeometry(0.7, 0), new THREE.TorusGeometry(0.55, 0.18, 10, 24), new THREE.OctahedronGeometry(0.65, 0)];
  for (let i = 0; i < 26; i += 1) {
    const mat = new THREE.MeshStandardMaterial({ color: i % 3 ? color : new THREE.Color('#ffffff'), emissive: color, emissiveIntensity: 0.35 + (i % 4) * 0.12,
      roughness: 0.35, metalness: 0.2, transparent: true, opacity: 0.55 });
    const mesh = new THREE.Mesh(geos[i % geos.length], mat);
    mesh.position.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 26, -4 - Math.random() * 12);
    mesh.userData = { spin: 0.2 + Math.random() * 0.5, drift: 0.15 + Math.random() * 0.35, phase: Math.random() * 6 };
    shapes.push(mesh);
    scene.add(mesh);
  }
  const particles = createParticleSystem(scene, 3000);
  const confetti = (count = 160) => particles.burst({ position: new THREE.Vector3(0, 6, 2), box: new THREE.Vector3(6, 1, 1), count,
    colors: [mode.color, '#ffffff', '#ffd36b', '#ff4fa3', '#36d6ff'], speed: 6, gravity: -5, life: 2.4, size: 0.24 });

  hud.setTitle(`${mode.icon} ${mode.title}`);
  hud.setHint(mode.hint);

  // ---- bảng câu hỏi ----
  const card = el('section', `quiz-card quiz-mode-${id}`);
  card.style.setProperty('--quiz', mode.color);
  const head = el('div', 'quiz-head');
  const cat = el('span', 'quiz-cat');
  const qno = el('span', 'quiz-no');
  const clock = el('span', 'quiz-clock');
  head.append(cat, qno, clock);
  const timer = el('div', 'quiz-timer');
  const timerFill = el('div', 'fill');
  timer.append(timerFill);
  const body = el('div', 'quiz-body');
  const winnersRow = el('div', 'quiz-winners');
  const foot = el('div', 'quiz-foot');
  const rich = (parts, className) => {
    const line = el('div', className);
    line.append(...parts.map((p) => (p.startsWith('*') ? el('b', '', p.slice(1, -1)) : document.createTextNode(p))));
    return line;
  };
  const rulesKey = { dovui: 'abcd', wordle: 'wordle', math: 'math', english: 'english' }[id] || 'text';
  foot.append(rich(['✍️ ', ...mode.hint], 'how'), rich(GIFT_RULES[rulesKey], 'gift'));
  card.append(head, timer, body, winnersRow, foot);
  const deckPanel = id === 'english' ? createDeckPanel(hud) : null;
  hud.gameRoot.append(card);

  let bodyKey = '';
  let lastSecond = -1;
  let winnersKey = '';
  let clockT = 0;

  function renderText(state) {
    const parts = [];
    if (state.flag) {
      const img = el('img', 'quiz-flag');
      img.src = `/static/assets/flags/${state.flag}.svg`;
      img.alt = '';
      parts.push(img);
    } else if (state.emoji) parts.push(el('div', `quiz-emoji${[...new Intl.Segmenter().segment(state.emoji)].length > 5 ? ' many' : ''}`, state.emoji));
    else if (state.math) {
      const text = state.phase === 'reveal' && state.answer ? state.prompt.replace('?', state.answer) : state.prompt;
      parts.push(el('div', `quiz-math${text.length > 12 ? ' long' : ''}`, text));
    } else parts.push(el('div', `quiz-prompt${state.prompt.length > 80 ? ' long' : ''}`, state.prompt));
    if (state.mask) {
      const mask = el('div', `quiz-mask${state.mask.filter((c) => c !== ' ').length > 13 ? ' long' : ''}`);
      for (const ch of state.mask) {
        if (ch === ' ') mask.append(el('span', 'gap'));
        else mask.append(el('span', ch === '_' ? 'tile' : 'tile open', ch === '_' ? '' : ch.toUpperCase()));
      }
      parts.push(mask);
    }
    body.replaceChildren(...parts);
  }

  function renderChoices(state) {
    const total = Math.max(1, state.votes.reduce((a, b) => a + b, 0));
    const rows = state.options.map((o, i) => {
      const pct = Math.round((state.votes[i] / total) * 100);
      const row = el('div', 'quiz-opt');
      if (o.removed) row.classList.add('removed');
      if (state.rightIndex === i) row.classList.add('right');
      else if (state.rightIndex >= 0) row.classList.add('wrong');
      const bar = el('div', 'bar');
      bar.style.width = `${o.removed ? 0 : pct}%`;
      row.append(bar, el('b', 'letter', o.letter), el('span', 'text', o.text), el('span', 'pct', o.removed ? '✕' : `${pct}%`));
      return row;
    });
    const opts = el('div', 'quiz-opts');
    opts.append(...rows);
    body.replaceChildren(el('div', `quiz-prompt small${state.prompt.length > 70 ? ' long' : ''}`, state.prompt), opts);
  }

  function renderWordle(state) {
    const known = el('div', 'wordle-known');
    for (const ch of state.known) known.append(el('span', ch ? 'tile g' : 'tile', ch));
    const grid = el('div', 'wordle-grid');
    for (const g of state.guesses.slice(-4)) {
      const row = el('div', 'wordle-row');
      [...g.word].forEach((ch, i) => row.append(el('span', `tile ${g.marks[i]}`, ch)));
      row.append(el('span', 'who', g.nickname));
      grid.append(row);
    }
    if (!state.guesses.length) grid.append(el('div', 'wordle-empty', 'Gõ một từ tiếng Anh 5 chữ cái để bắt đầu…'));
    const kb = el('div', 'wordle-kb');
    for (const line of ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']) {
      const row = el('div', 'kb-row');
      for (const ch of line) {
        const rank = state.keyboard[ch.toLowerCase()];
        row.append(el('span', `key ${rank === 2 ? 'g' : rank === 1 ? 'y' : rank === 0 ? 'x' : ''}`, ch));
      }
      kb.append(row);
    }
    body.replaceChildren(known, grid, kb);
  }

  function renderWinners(state) {
    const key = JSON.stringify(state.winners) + state.phase;
    if (key === winnersKey) return;
    winnersKey = key;
    if (!state.winners.length) {
      winnersRow.replaceChildren(el('span', 'none', state.phase === 'reveal' ? 'Chưa ai trả lời đúng câu này' : 'Ai sẽ là người nhanh nhất? ⚡'));
      return;
    }
    winnersRow.style.setProperty('--n', String(state.winners.length));
    winnersRow.classList.toggle('crowded', state.winners.length >= 4);
    winnersRow.replaceChildren(...state.winners.map((w, i) => {
      const chip = el('span', `w w${i + 1}`);
      chip.append(avatarNode(w.avatar), el('b', '', w.nickname), el('em', '', `+${w.points}`));
      return chip;
    }));
  }

  return {
    scene,
    camera,
    themeClass: 'theme-quiz',
    welcome: { line: 'đã vào lớp! Gõ đáp án vào bình luận nhé ✏️', speech: (n) => `Chào mừng ${n} vào chơi đố vui!` },
    legend: [], // cách chơi + luật quà nằm ở chân bảng câu hỏi (.quiz-foot)
    update(snapshot) {
      const state = snapshot.state;
      if (!state || state.phase === 'idle') return;
      hud.setStats([`❓ Câu ${state.qNumber}`, `✅ ${state.correctCount} đúng`]);
      hud.setBoard('🏆 BẢNG ĐIỂM', state.board.map((r) => ({ ...r, score: `${r.points} đ` })));
      deckPanel?.update(state.control);
      cat.textContent = state.category || mode.title;
      const count = state.mode === 'abcd' ? `🗳 ${state.voters} người chọn` : state.mode === 'wordle' ? `${state.guessCount} lượt đoán` : '';
      qno.textContent = state.paused ? '⏸ TẠM DỪNG' : count;
      const seconds = Math.ceil(state.msLeft / 1000);
      clock.textContent = state.phase === 'question' ? `${seconds}s` : state.phase === 'reveal' ? '✅ ĐÁP ÁN' : '';
      timerFill.style.width = `${state.phase === 'question' && state.totalMs ? (state.msLeft / state.totalMs) * 100 : 0}%`;
      card.classList.toggle('urgent', state.phase === 'question' && seconds <= 5);
      card.classList.toggle('reveal', state.phase === 'reveal');
      if (state.phase === 'question' && seconds <= 5 && seconds > 0 && seconds !== lastSecond && !state.paused) audio.play('chirp');
      lastSecond = seconds;
      // vẽ lại phần thân khi dữ liệu đổi (không vẽ lại mỗi lần đồng hồ nhảy)
      const view = state.mode === 'abcd' ? [state.prompt, state.options, state.votes, state.rightIndex]
        : state.mode === 'wordle' ? [state.guesses, state.known, state.keyboard] : [state.prompt, state.emoji, state.flag, state.mask, state.answer];
      const bk = JSON.stringify(view);
      if (bk !== bodyKey) {
        bodyKey = bk;
        if (state.mode === 'abcd') renderChoices(state);
        else if (state.mode === 'wordle') renderWordle(state);
        else renderText(state);
      }
      renderWinners(state);
    },
    onFx(fx) {
      if (fx.kind === 'quizQuestion') {
        audio.play('whoosh');
        if (fx.speech) audio.speak(fx.speech, 'story');
      } else if (fx.kind === 'quizCorrect') {
        audio.play('coin');
        if (fx.rank === 1) confetti(120);
      } else if (fx.kind === 'quizReveal') {
        audio.play(fx.correctCount ? 'fanfare' : 'pop');
        if (fx.correctCount) confetti(260);
        if (fx.speech) audio.speak(fx.speech, 'story');
      } else if (fx.kind === 'quizGift') {
        audio.play('magic');
        hud.comboToast(`${fx.userId}|${fx.giftName}`, fx.count, (n) => `🎁 ${fx.giftName} ×${n}${fx.hint ? ` → ${fx.hint} cho cả phòng` : ' · cảm ơn bạn!'}`,
          { title: fx.nickname, gold: fx.tier >= 3, image: fx.giftPicture, ms: 3500 });
        particles.burst({ position: new THREE.Vector3(0, 0, 3), box: new THREE.Vector3(3, 3, 1), count: 80 + fx.tier * 40,
          colors: [mode.color, '#ffffff', '#ffd36b'], speed: 4, gravity: -1, life: 1.6, size: 0.22 });
      } else if (fx.kind === 'quizDeck') {
        audio.play('magic');
        hud.toast(`🎁 ${fx.giftName} → ${fx.icon} ${fx.label} · ${fx.questions} câu tới`, { title: fx.nickname, gold: true, image: fx.giftPicture, ms: 4000 });
        confetti(200);
        audio.speak(`${fx.nickname} đổi sang ${fx.label}!`, 'story');
      } else if (fx.kind === 'quizTime') {
        audio.play('chime');
        hud.toast(`❤ Tim đủ mốc → +${fx.seconds} giây!`, { ms: 2500 });
      } else if (fx.kind === 'quizClue') {
        audio.play('pop');
        hud.toast(`🟩 ${fx.word} mở ${fx.found} chữ đúng chỗ (+${fx.found} điểm)`, { title: fx.nickname, ms: 2800 });
      } else if (fx.kind === 'toast') hud.toast(fx.text);
    },
    frame(dt, t) {
      clockT = t;
      for (const m of shapes) {
        const u = m.userData;
        m.rotation.x += dt * u.spin;
        m.rotation.y += dt * u.spin * 0.7;
        m.position.y += dt * u.drift;
        m.position.x += Math.sin(t * 0.4 + u.phase) * dt * 0.2;
        if (m.position.y > 14) m.position.y = -14;
      }
      key.intensity = 50 + Math.sin(clockT * 1.5) * 10;
      particles.update(dt);
    },
    dispose() {
      deckPanel?.dispose();
      particles.dispose();
      for (const g of geos) g.dispose();
      disposeObject(scene);
      hud.clearGame();
      labels.clear();
    }
  };
}
