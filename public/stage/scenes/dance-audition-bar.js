// Thanh phím kiểu "nhảy theo nhịp" khi có người solo: chuỗi 6 mũi tên sáng lần lượt theo phách,
// hết chuỗi hiện PERFECT + combo rồi ra chuỗi mới (giống không khí game nhảy, chỉ để xem — người xem không phải bấm).
const ARROWS = ['←', '↑', '↓', '→'];
const KEYS = 6;
const GRADES = ['PERFECT', 'PERFECT', 'GREAT', 'PERFECT', 'COOL'];

export function createAuditionBar(hud) {
  const root = hud.el('div', 'au-bar');
  const name = hud.el('div', 'au-name');
  const keys = hud.el('div', 'au-keys');
  const grade = hud.el('div', 'au-grade');
  const cells = Array.from({ length: KEYS }, () => {
    const cell = hud.el('span', 'au-key');
    keys.append(cell);
    return cell;
  });
  root.append(name, keys, grade);
  root.hidden = true;
  hud.gameRoot.append(root);
  let seed = 1;
  let round = -1;
  let combo = 0;
  let startBeat = 0;

  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  return {
    start(nickname, beat, id) {
      root.hidden = false;
      name.textContent = `🎤 ${nickname}`;
      seed = [...String(id)].reduce((h, ch) => (h * 31 + ch.codePointAt(0)) & 0x7fffffff, 7) || 1;
      startBeat = Math.ceil(beat);
      round = -1;
      combo = 0;
    },
    stop() {
      root.hidden = true;
    },
    update(beat) {
      if (root.hidden) return;
      const local = beat - startBeat;
      if (local < 0) return;
      const r = Math.floor(local / (KEYS + 2)); // 6 phách bấm + 2 phách chấm điểm
      const step = Math.floor(local % (KEYS + 2));
      if (r !== round) {
        round = r;
        for (const cell of cells) {
          cell.textContent = ARROWS[Math.floor(rand() * 4)];
          cell.classList.remove('hit');
        }
        grade.classList.remove('show');
      }
      cells.forEach((cell, i) => cell.classList.toggle('hit', i < step));
      if (step >= KEYS && !grade.classList.contains('show')) {
        combo += 1;
        grade.textContent = `${GRADES[r % GRADES.length]}${combo > 1 ? ` ×${combo}` : ''}`;
        grade.classList.add('show');
      }
    }
  };
}
