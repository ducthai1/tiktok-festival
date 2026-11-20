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
    // "calo" trong gợi ý của CALORIE, "oxy" của OXYGEN: chữ trong gợi ý là phần đầu của đáp án
    for (const chu of goiY.split(/[^a-z0-9]+/)) {
      if (chu.length >= 4 && dapAn.startsWith(chu)) { loi.push(`${q.answer} ← ${q.prompt}`); break; }
    }
  }
  assert.deepEqual(loi, [], `gợi ý lộ đáp án:\n${loi.join('\n')}`);
});

test('gợi ý viết thành lời nói, không dùng dấu gạch chéo kiểu từ điển', () => {
  const loi = tatCa().filter((q) => (q.prompt || '').includes('/')).map((q) => `${q.answer} ← ${q.prompt}`);
  assert.deepEqual(loi, [], `gợi ý còn dấu gạch chéo, máy đọc lên không ra lời:\n${loi.join('\n')}`);
});
