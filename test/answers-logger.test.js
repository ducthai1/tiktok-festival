import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createAnswersLogger, dayString, KEEP_DAYS } from '../src/games/quiz/answers-logger.js';

const DAY_MS = 86400 * 1000;

test('answers-logger: ghi log câu hỏi và các trường hợp trả lời của người xem', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'answers-log-'));
  const clock = Date.parse('2026-11-18T10:00:00Z');
  const logger = createAnswersLogger(tmpDir, { now: () => clock });

  logger.logQuestion(5240, { category: 'giải trí', prompt: 'Từ tiếng Anh chỉ chú hề', answer: 'CLOWN' });
  logger.logAnswer(5240, {
    user: { id: 'u1', uniqueId: 'nguoi1', nickname: 'Bé Na' },
    comment: 'clon',
    result: 'correct',
    rank: 1,
    points: 10
  });
  logger.logAnswer(5240, {
    user: { id: 'u2', uniqueId: 'nguoi2', nickname: 'Bé Miu' },
    comment: 'circus',
    result: 'WRONG'
  });
  logger.logAnswer(5240, {
    user: { id: 'u1', uniqueId: 'nguoi1', nickname: 'Bé Na' },
    comment: 'clown',
    result: 'ALREADY_WON'
  });
  logger.logAnswer(5240, {
    user: { id: 'u3', nickname: 'Khách 3' },
    comment: 'clown',
    result: 'CAP_REACHED'
  });

  const todayStr = dayString(new Date(clock));
  const logFile = path.join(tmpDir, 'answers', `${todayStr}.log`);
  assert.ok(fs.existsSync(logFile), 'File log ngày hôm nay phải tồn tại');

  const content = fs.readFileSync(logFile, 'utf8');
  assert.match(content, /CÂU #5240 \| Chủ đề: giải trí \| Gợi ý: "Từ tiếng Anh chỉ chú hề" \| Đáp án: "CLOWN"/);
  assert.match(content, /\[Bé Na \(@nguoi1\)\] gõ: "clon" -> ĐÚNG \(Hạng 1, \+10 điểm\)/);
  assert.match(content, /\[Bé Miu \(@nguoi2\)\] gõ: "circus" -> SAI/);
  assert.match(content, /\[Bé Na \(@nguoi1\)\] gõ: "clown" -> ĐÃ ĐƯỢC TÍNH ĐIỂM TRƯỚC ĐÓ/);
  assert.match(content, /\[Khách 3 \(@u3\)\] gõ: "clown" -> ĐÚNG NHƯNG ĐÃ ĐỦ 6 NGƯỜI NHANH NHẤT/);

  // Symlink answers.log
  const link = path.join(tmpDir, 'answers.log');
  assert.ok(fs.existsSync(link), 'Symlink answers.log phải trỏ đến file hôm nay');
});

test('answers-logger: tự động dọn dẹp file log cũ trên 2 ngày (auto-prune)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'answers-log-prune-'));
  const answersDir = path.join(tmpDir, 'answers');
  fs.mkdirSync(answersDir, { recursive: true });

  const now = Date.parse('2026-11-18T12:00:00Z');

  // Tạo các file giả lập: 4 ngày trước, 3 ngày trước, 2 ngày trước, hôm nay
  const day4 = path.join(answersDir, '2026-11-14.log');
  const day3 = path.join(answersDir, '2026-11-15.log');
  const day2 = path.join(answersDir, '2026-11-16.log');
  const today = path.join(answersDir, '2026-11-18.log');

  for (const f of [day4, day3, day2, today]) {
    fs.writeFileSync(f, 'sample log');
  }

  // Đặt mtime tương ứng
  const setMtime = (f, daysAgo) => {
    const t = (now - daysAgo * DAY_MS) / 1000;
    fs.utimesSync(f, t, t);
  };
  setMtime(day4, 4);
  setMtime(day3, 3);
  setMtime(day2, 2);
  setMtime(today, 0);

  const logger = createAnswersLogger(tmpDir, { keepDays: KEEP_DAYS, now: () => now });

  // Khởi tạo đã tự gọi prune()
  assert.ok(!fs.existsSync(day4), 'Log 4 ngày trước phải bị xoá');
  assert.ok(!fs.existsSync(day3), 'Log 3 ngày trước phải bị xoá');
  assert.ok(fs.existsSync(day2), 'Log 2 ngày trước trong phạm vi vẫn giữ');
  assert.ok(fs.existsSync(today), 'Log hôm nay phải còn');
});

test('answers-logger: onEntry callback và getRecentLines cho trang admin', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'answers-log-admin-'));
  const clock = Date.parse('2026-11-18T14:30:00Z');
  const entries = [];
  const logger = createAnswersLogger(tmpDir, {
    now: () => clock,
    onEntry: (entry) => entries.push(entry)
  });

  logger.logQuestion(5280, { category: 'tiếng anh', prompt: 'Môn học', answer: 'SUBJECT' });
  logger.logAnswer(5280, {
    user: { id: 'u1', nickname: 'Bao Lỏng' },
    comment: 'subject',
    result: 'correct',
    rank: 1,
    points: 10
  });

  assert.equal(entries.length, 2);
  assert.equal(entries[0].kind, 'question');
  assert.equal(entries[0].qNumber, 5280);
  assert.equal(entries[1].kind, 'answer');
  assert.equal(entries[1].comment, 'subject');
  assert.equal(entries[1].rank, 1);

  // getRecentLines
  const lines = logger.getRecentLines(10);
  assert.ok(lines.length >= 2);
  assert.ok(lines.some((l) => l.includes('CÂU #5280')));
  assert.ok(lines.some((l) => l.includes('Bao Lỏng') && l.includes('subject')));
});
