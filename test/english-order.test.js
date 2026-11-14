import assert from 'node:assert/strict';
import test from 'node:test';
import { ORDER, defaultEnglishRules, sortByOrder } from '../public/shared/english-sets.js';

test('saved gift rules are re-sorted to the new slot order once (TOEIC, IELTS on page 1), gifts and counts untouched', () => {
  const OLD = ['general', 'easy', 'hard', 'dongvat', 'amthuc', 'truonghoc', 'nghe', 'toeic', 'ielts', 'congnghe', 'bongda', 'yhoc', 'dulich', 'giaitri'];
  const saved = defaultEnglishRules().sort((a, b) => OLD.indexOf(a.to) - OLD.indexOf(b.to)).map((r) => ({ ...r, questions: r.questions + 1 }));
  const sorted = sortByOrder(saved);
  assert.deepEqual([...new Set(sorted.map((r) => r.to))], ORDER);
  assert.deepEqual(sorted.slice(0, 7).map((r) => r.to), ['general', 'easy', 'hard', 'amthuc', 'toeic', 'ielts', 'nghe']);
  assert.equal(sorted.length, saved.length);
  for (const r of saved) assert.ok(sorted.includes(r)); // cùng đối tượng: quà / số câu / bật-tắt giữ nguyên
  const nghe = sorted.filter((r) => r.to === 'nghe');
  assert.deepEqual(nghe, saved.filter((r) => r.to === 'nghe')); // nhiều món cùng ô: giữ thứ tự cũ
});
