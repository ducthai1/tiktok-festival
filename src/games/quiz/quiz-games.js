// 7 tab đố vui, cùng một bộ máy (quiz-game.js), khác kho câu hỏi + cách chơi.
import {
  createMathDeck, createShuffleBag, createTieredDeck, loadChoiceQuestions, loadClassroomQuestions, loadEmojiQuestions, loadEnglishQuestions,
  loadFlagQuestions, loadWordleWords
} from './quiz-bank.js';
import { createQuizGame } from './quiz-game.js';

let banks = null; // đọc file một lần cho cả server (test tạo nhiều hub vẫn nhanh)
function loadBanks() {
  banks ??= {
    classroom: loadClassroomQuestions(),
    choice: loadChoiceQuestions(),
    english: loadEnglishQuestions(),
    emoji: loadEmojiQuestions(),
    flags: loadFlagQuestions(),
    wordle: loadWordleWords()
  };
  return banks;
}

export const QUIZ_GAME_IDS = ['lophoc', 'dovui', 'english', 'emoji', 'flag', 'math', 'wordle'];

export function createQuizGames({ random = Math.random } = {}) {
  const b = loadBanks();
  const bag = (items) => createShuffleBag(items, random);
  return [
    createQuizGame({ id: 'lophoc', title: 'Lớp Học Chữ', deck: bag(b.classroom), questionMs: 25000, random }),
    createQuizGame({ id: 'dovui', title: 'Đố Vui A/B/C/D', kind: 'abcd', deck: bag(b.choice), random }),
    createQuizGame({
      // ~1.080 từ theo chủ đề (A1–B1) chạy trước; 176 từ cơ bản cũ để cuối danh sách
      id: 'english', title: 'Từ Vựng Tiếng Anh', questionMs: 20000, revealAnswerAloud: false, random,
      deck: createTieredDeck([b.english.filter((q) => !q.basic), b.english.filter((q) => q.basic)], random)
    }),
    createQuizGame({
      id: 'emoji', title: 'Đuổi Hình Bắt Chữ', deck: bag(b.emoji), questionMs: 30000, speakLine: () => 'Đuổi hình bắt chữ! Đây là gì nào?', random
    }),
    createQuizGame({
      id: 'flag', title: 'Đoán Quốc Kỳ', deck: bag(b.flags), questionMs: 20000, speakLine: () => 'Đây là quốc kỳ nước nào?', random
    }),
    createQuizGame({ id: 'math', title: 'Toán Nhanh', deck: createMathDeck(random), questionMs: 15000, random }),
    createQuizGame({
      id: 'wordle', title: 'Wordle Tiếng Anh', kind: 'wordle', deck: bag(b.wordle.answers), questionMs: 150000, revealMs: 8000,
      wordle: b.wordle, revealAnswerAloud: false, speakLine: () => 'Đoán từ tiếng Anh năm chữ cái!', random
    })
  ];
}
