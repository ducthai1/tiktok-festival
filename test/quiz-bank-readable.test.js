// Gợi ý tiếng Anh được MÁY ĐỌC LÊN cho người xem nghe, không phải để đọc bằng mắt. Hai lỗi
// chủ kênh báo đi báo lại:
//
//  1. Đáp án nằm sẵn trong gợi ý dưới dạng phiên âm tiếng Việt — OXYGEN gợi ý "khí oxy",
//     CALORIE gợi ý "lượng calo", MICROPHONE gợi ý "cây micrô". Nghe xong là biết luôn,
//     câu hỏi thành vô nghĩa. Test cũ chỉ bắt khi gợi ý chứa NGUYÊN đáp án nên lọt hết.
//  2. Lối viết từ điển "Hợp lý / đáng tin" — dấu gạch chéo không đọc thành lời được.
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadEnglishQuestions, loadEnglishSets } from '../src/games/quiz/quiz-bank.js';
import { foldText } from '../public/shared/profanity-filter.js';

const tatCa = () => [...loadEnglishQuestions(), ...Object.values(loadEnglishSets()).flat()];

// Chữ tiếng Việt tình cờ trùng 4 chữ cái đầu với đáp án, không phải lộ: "chết trân" ≠ TRANSFIXED.
const TRUNG_NGAU_NHIEN = new Set(['TRANSFIXED', 'TRANCE', 'CONGLOMERATE']);

test('gợi ý không được chứa sẵn đáp án, kể cả dạng phiên âm tiếng Việt', () => {
  const loi = [];
  for (const q of tatCa()) {
    if (TRUNG_NGAU_NHIEN.has(q.answer)) continue;
    const dapAn = foldText(q.answer).replace(/[^a-z0-9]/g, '');
    const goiY = foldText(q.prompt || '');
    if (dapAn.length >= 4 && goiY.includes(dapAn)) { loi.push(`${q.answer} ← ${q.prompt}`); continue; }
    // "calo" trong gợi ý của CALORIE, "oxy" của OXYGEN: chữ trong gợi ý là phần đầu của đáp án.
    // Phiên âm tiếng Việt hay tách thành nhiều chữ ("ca nô" ← CANOE, "mô tô" ← MOTORBIKE,
    // "am-pe" ← AMPERE) nên phải ghép các chữ liền nhau lại rồi mới so.
    const chu = goiY.split(/[^a-z0-9]+/).filter(Boolean);
    for (let i = 0; i < chu.length; i += 1) {
      for (let n = 1; n <= 3 && i + n <= chu.length; n += 1) {
        const ghep = chu.slice(i, i + n).join('');
        if (ghep.length >= 4 && dapAn.startsWith(ghep)) { loi.push(`${q.answer} ← ${q.prompt}`); i = chu.length; break; }
      }
    }
  }
  assert.deepEqual(loi, [], `gợi ý lộ đáp án:\n${loi.join('\n')}`);
});

test('gợi ý viết thành lời nói, không dùng dấu gạch chéo kiểu từ điển', () => {
  const loi = tatCa().filter((q) => (q.prompt || '').includes('/')).map((q) => `${q.answer} ← ${q.prompt}`);
  assert.deepEqual(loi, [], `gợi ý còn dấu gạch chéo, máy đọc lên không ra lời:\n${loi.join('\n')}`);
});
