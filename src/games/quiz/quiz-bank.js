// Kho câu hỏi cho các game đố vui — đọc một lần lúc server chạy. Nguồn + giấy phép: bank/NGUON.md
// Mỗi bộ (deck) trả câu theo kiểu "rút túi": xáo trộn, hết túi mới lặp lại, không ra trùng câu liền nhau.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { foldText } from '../text-match.js';

const BANK_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'bank');
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(BANK_DIR, name), 'utf8'));
const readTxtDir = (dir) => fs.readdirSync(path.join(BANK_DIR, dir)).filter((f) => f.endsWith('.txt')).sort()
  .map((file) => ({ file, text: fs.readFileSync(path.join(BANK_DIR, dir, file), 'utf8') }));

/** Các cách trả lời được tính đúng, đã gập dấu + chữ thường ("Ngủ nướng" → "ngu nuong"). */
export const accepts = (...values) => [...new Set(values.flat().map((v) => foldText(v)).filter(Boolean))];

/** Lớp Học Chữ: mỗi dòng "ĐÁP ÁN | gợi ý | độ khó | cách viết khác, …"; dòng "# Tên chủ đề" đầu file là tên chủ đề. */
export function parseTextBank(text, fallbackCategory = '') {
  const lines = text.split(/\r?\n/);
  const category = (lines.find((l) => l.startsWith('#')) || '').replace(/^#\s*/, '').trim() || fallbackCategory;
  const out = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('>')) continue;
    const [answer, prompt, level, alts = ''] = line.split('|').map((s) => s.trim());
    if (!answer || !prompt) continue;
    out.push({ kind: 'text', category, answer, prompt, level: Number(level) || 2, accept: accepts(answer, alts.split(',')) });
  }
  return out;
}

const ABCD_LEVEL = { de: 1, vua: 2, phu: 2, kho: 3, dinh: 4, chuong: 4, meo: 4 };
/** Trắc nghiệm: dòng "[nhóm]" đổi độ khó; mỗi câu "câu hỏi | ĐÁP ÁN ĐÚNG | sai | sai | sai". */
export function parseChoiceBank(text, category = 'Tổng hợp') {
  const lines = text.split(/\r?\n/);
  const out = [];
  let level = 2;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const group = line.match(/^\[(\w+)\]$/);
    if (group) {
      level = ABCD_LEVEL[group[1]] || 2;
      continue;
    }
    const parts = line.split('|').map((s) => s.trim());
    if (parts.length !== 5 || parts.some((p) => !p)) continue;
    const [prompt, right, ...wrong] = parts;
    if (new Set(parts.slice(1).map(foldText)).size !== 4) continue; // 4 đáp án phải khác nhau
    out.push({ kind: 'abcd', category, prompt, right, wrong, level });
  }
  return out;
}

export function createShuffleBag(items, random = Math.random) {
  let bag = [];
  let last = null;
  return {
    size: items.length,
    next() {
      if (!bag.length) {
        bag = [...items];
        for (let i = bag.length - 1; i > 0; i -= 1) {
          const j = Math.floor(random() * (i + 1));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        if (bag.length > 1 && bag[bag.length - 1] === last) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      }
      last = bag.pop();
      return last;
    }
  };
}

const ENGLISH_FILE = '25-tieng-anh.txt';
const EMOJI_FILE = '31-duoi-hinh-dh.txt';

function lopHocFiles() {
  return readTxtDir('lop-hoc');
}

/** Lớp Học Chữ: mọi chủ đề trừ tiếng Anh và đuổi hình bắt chữ (hai thứ đó có tab riêng). */
export function loadClassroomQuestions() {
  return lopHocFiles().filter((f) => f.file !== ENGLISH_FILE && f.file !== EMOJI_FILE).flatMap((f) => parseTextBank(f.text, f.file));
}

/**
 * Từ vựng tiếng Anh: 176 từ cơ bản (Lớp Học Chữ) + ~1.000 từ tự soạn theo chủ đề trong bank/tieng-anh/ (A1–B1).
 * Một đáp án có thể có hai câu khác nghĩa (BREAK: giờ ra chơi / làm vỡ) — chỉ bỏ câu trùng cả đáp án lẫn đề.
 */
export function loadEnglishQuestions() {
  const file = lopHocFiles().find((f) => f.file === ENGLISH_FILE);
  const basic = parseTextBank(file.text).map((q) => ({ ...q, category: 'Tiếng Anh · Cơ bản' }));
  const topics = readTxtDir('tieng-anh').flatMap((f) => parseTextBank(f.text, 'Tiếng Anh'));
  const seen = new Set();
  return [...basic, ...topics].filter((q) => {
    const key = `${foldText(q.answer)}|${foldText(q.prompt)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Đuổi hình bắt chữ: chuỗi emoji ghép chữ (Lớp Học Chữ) + kho emoji phim/bài hát/thành ngữ (Emoji Quiz). */
export function loadEmojiQuestions() {
  const file = lopHocFiles().find((f) => f.file === EMOJI_FILE);
  const pun = parseTextBank(file.text).map((q) => ({ ...q, category: 'Đuổi hình bắt chữ', emoji: q.prompt, prompt: '' }));
  const more = readJson('emoji-sonlamdev.json').map((q) => ({
    kind: 'text', category: q.cat, answer: q.a, emoji: q.e, prompt: '', level: 2, accept: accepts(q.a, q.alt || [])
  }));
  return [...pun, ...more];
}

export function loadFlagQuestions() {
  return readJson('flags.json').map((f) => ({ kind: 'text', category: 'Quốc kỳ', answer: f.name, flag: f.code, prompt: '', level: 2,
    accept: accepts(f.name, f.alt) }));
}

const CHOICE_TOPICS = {
  'dia-ly-vn.txt': 'Địa lý Việt Nam', 'dinh-khoa-cu-danh-nhan.txt': 'Khoa cử, danh nhân', 'dinh-tong-hop.txt': 'Thi Đình',
  'dong-thuc-vat.txt': 'Động thực vật', 'khoa-hoc-tu-nhien.txt': 'Khoa học tự nhiên', 'lich-su-vn-can-hien-dai.txt': 'Lịch sử cận hiện đại',
  'lich-su-vn-co-trung-dai.txt': 'Lịch sử cổ trung đại', 'meo-choi-chu-dan-gian.txt': 'Đố mẹo chơi chữ', 'meo-logic-tinh-huong.txt': 'Đố mẹo logic',
  'phat-minh-nghe-thuat-the-thao.txt': 'Phát minh, nghệ thuật, thể thao', 'sinh-hoc-suc-khoe.txt': 'Sinh học, sức khỏe', 'the-gioi.txt': 'Thế giới',
  'van-hoa-am-thuc-vn.txt': 'Văn hóa, ẩm thực', 'van-hoc-tieng-viet.txt': 'Văn học, tiếng Việt'
};

export function loadChoiceQuestions() {
  return readTxtDir('trang-nguyen').flatMap((f) => parseChoiceBank(f.text, CHOICE_TOPICS[f.file] || 'Tổng hợp'));
}

export function loadWordleWords() {
  const { answers, allowed } = readJson('wordle-words.json');
  return { answers, allowed: new Set([...allowed, ...answers]) };
}

// ---- Toán nhanh: tự sinh, khó dần theo vòng 12 câu (3 câu mỗi bậc) ----
const SPOKEN_OP = { '+': 'cộng', '−': 'trừ', '×': 'nhân', '÷': 'chia' };
export function makeMathQuestion(level, random = Math.random) {
  const int = (a, b) => a + Math.floor(random() * (b - a + 1));
  let text;
  let answer;
  if (level <= 1) {
    const a = int(3, 20);
    const b = int(2, 20);
    [text, answer] = random() < 0.5 ? [`${a} + ${b}`, a + b] : [`${a + b} − ${b}`, a];
  } else if (level === 2) {
    const a = int(2, 9);
    const b = int(2, 12);
    const c = int(11, 60);
    const d = int(11, 39);
    [text, answer] = random() < 0.5 ? [`${a} × ${b}`, a * b] : [`${c + d} − ${d}`, c];
  } else if (level === 3) {
    const a = int(3, 9);
    const b = int(3, 12);
    const c = int(2, 30);
    [text, answer] = random() < 0.5 ? [`${a} × ${b} + ${c}`, a * b + c] : [`${a * b} ÷ ${a}`, b];
  } else {
    const a = int(12, 39);
    const b = int(3, 9);
    // c × d ≤ 25 < a × b (≥ 36): kết quả luôn dương — người xem không gõ được số âm (dấu "-" bị bỏ khi so đáp án)
    const c = int(2, 5);
    const d = int(2, 5);
    [text, answer] = random() < 0.5 ? [`${a} × ${b}`, a * b] : [`${a} × ${b} − ${c} × ${d}`, a * b - c * d];
  }
  const speech = `${text.replace(/[+−×÷]/g, (op) => SPOKEN_OP[op])} bằng mấy?`;
  return { kind: 'text', category: `Toán nhanh · bậc ${level}`, answer: String(answer), prompt: `${text} = ?`, math: true, speech, level,
    accept: [String(answer)] };
}

export function createMathDeck(random = Math.random) {
  let n = 0;
  return { size: Infinity, next: () => makeMathQuestion(1 + Math.floor((n++ % 12) / 3), random) };
}
