import assert from 'node:assert/strict';
import test from 'node:test';
import { ORDER, defaultEnglishRules, sortByOrder, upgradeSavedRules } from '../public/shared/english-sets.js';

test('saved gift rules are re-sorted to the new slot order once (TOEIC, IELTS on page 1), gifts and counts untouched', () => {
  const OLD = ['general', 'easy', 'hard', 'dongvat', 'amthuc', 'truonghoc', 'nghe', 'toeic', 'ielts', 'congnghe', 'bongda', 'yhoc', 'dulich', 'giaitri'];
  const saved = defaultEnglishRules().filter((r) => OLD.includes(r.to)).sort((a, b) => OLD.indexOf(a.to) - OLD.indexOf(b.to)).map((r) => ({ ...r, questions: r.questions + 1 }));
  const sorted = sortByOrder(saved);
  assert.deepEqual([...new Set(sorted.map((r) => r.to))], ORDER.filter((to) => OLD.includes(to)));
  assert.deepEqual(sorted.slice(0, 7).map((r) => r.to), ['general', 'easy', 'hard', 'toeic', 'ielts', 'nghe', 'nghe']); // chưa có ô mới (nghe có 2 món: Doughnut + Heart Me)
  assert.equal(sorted.length, saved.length);
  for (const r of saved) assert.ok(sorted.includes(r)); // cùng đối tượng: quà / số câu / bật-tắt giữ nguyên
  const nghe = sorted.filter((r) => r.to === 'nghe');
  assert.deepEqual(nghe, saved.filter((r) => r.to === 'nghe')); // nhiều món cùng ô: giữ thứ tự cũ
});

test('upgrading saved gift rules adds the new slots (Thường, page 3) without touching the owner\'s choices', () => {
  const OLD = ['general', 'easy', 'hard', 'amthuc', 'toeic', 'ielts', 'nghe', 'dongvat', 'truonghoc', 'congnghe', 'bongda', 'yhoc', 'dulich', 'giaitri'];
  const saved = defaultEnglishRules().filter((r) => OLD.includes(r.to) && r.to !== 'dongvat').map((r) => ({ ...r, questions: 7 }));
  const up = upgradeSavedRules(saved, 2);
  assert.deepEqual(up.slice(0, 7).map((r) => r.to), ['general', 'easy', 'normal', 'hard', 'toeic', 'ielts', 'nghe']);
  assert.ok(!up.some((r) => r.to === 'dongvat')); // ô chủ kênh đã xoá không tự quay lại
  assert.ok(['vutru', 'game', 'tinhyeu', 'bian', 'nghenghiep', 'nhacua'].every((to) => up.some((r) => r.to === to)));
  assert.ok(!up.some((r) => ['thanhngu', 'dongtu', 'camxuc'].includes(r.to)));
  // bảng đã nâng lên bản 3 (còn ô Thời trang / Làm giàu đã bỏ) → bản 4: bỏ ô không còn, thêm ô mới
  const v3 = [...up, { to: 'thoitrang', gift: { id: 'x1', name: 'Bravo!', coins: 15 }, questions: 20, enabled: true }];
  const v4 = upgradeSavedRules(v3, 3);
  assert.ok(!v4.some((r) => r.to === 'thoitrang'));
  assert.ok(saved.every((r) => up.includes(r))); // quà / số câu đã chọn giữ nguyên
  assert.equal(new Set(up.map((r) => r.gift.id)).size, up.length); // không món nào gán hai ô
  assert.deepEqual(upgradeSavedRules(up, 5), up); // đã nâng cấp → không thêm lần nữa
});
