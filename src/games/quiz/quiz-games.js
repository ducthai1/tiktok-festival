// 7 tab đố vui, cùng một bộ máy (quiz-game.js), khác kho câu hỏi + cách chơi.
import {
  createShuffleBag, loadClassroomQuestions, loadChoiceQuestions, loadEmojiQuestions, loadEnglishQuestions,
  loadEnglishSets, loadFlagQuestions, loadWordleWords
} from './quiz-bank.js';
import { createEmojiSwitcher } from './emoji-switcher.js';
import { createEnglishSwitcher } from './english-switcher.js';
import { createQuizGame } from './quiz-game.js';

let banks = null; // đọc file một lần cho cả server (test tạo nhiều hub vẫn nhanh)
function loadBanks() {
  banks ??= {
    classroom: loadClassroomQuestions(),
    choice: loadChoiceQuestions(),
    english: loadEnglishQuestions(),
    englishSets: loadEnglishSets(),
    emoji: loadEmojiQuestions(),
    flags: loadFlagQuestions(),
    wordle: loadWordleWords()
  };
  return banks;
}

export const QUIZ_GAME_IDS = ['lophoc', 'dovui', 'english', 'emoji', 'flag', 'math', 'wordle'];

export function createQuizGames({ random = Math.random, englishProgress = null } = {}) {
  const b = loadBanks();
  const bag = (items) => createShuffleBag(items, random);
  // tầng cuối là 176 từ tiếng Anh cơ bản (trước đây nhầm là kho Lớp Học Chữ tiếng Việt → hết từ tiếng Anh sẽ hỏi câu đố tiếng Việt)
  const english = createEnglishSwitcher({
    general: b.english.filter((q) => !q.basic), basic: b.english.filter((q) => q.basic), sets: b.englishSets, random,
    progress: englishProgress
  });
  const emoji = createEmojiSwitcher({ all: b.emoji, random });
  return [
    createQuizGame({ id: 'lophoc', title: 'Lớp Học Chữ', deck: bag(b.classroom), questionMs: 25000, random }),
    createQuizGame({ id: 'dovui', title: 'Đố Vui A/B/C/D', kind: 'abcd', deck: bag(b.choice), random }),
    createQuizGame({
      // quà đổi bộ đề (TOEIC, IELTS, Y học…) / độ khó — xem english-switcher.js; 176 từ cơ bản luôn ở cuối danh sách
      id: 'english', title: 'Từ Vựng Tiếng Anh', questionMs: 20000, revealAnswerAloud: false, random, deck: english.deck,
      onGift: (event) => english.onGift(event), onCommand: (name) => english.command(name), extraState: () => english.snapshot(),
      onRestore: (control) => english.restore(control),
      onCatalog: (catalog) => english.setCatalog(catalog)
    }),
    createQuizGame({
      id: 'emoji', title: 'Đuổi Hình Bắt Chữ', deck: emoji.deck, questionMs: 30000, 
      onGift: (event) => emoji.onGift(event), onCatalog: (catalog) => emoji.setCatalog(catalog), extraState: () => emoji.snapshot(),
      onRestore: (control) => emoji.restore(control),
      speakLine: () => 'Đuổi hình bắt chữ! Đây là gì nào?', random
    }),
    createQuizGame({
      id: 'flag', title: 'Đoán Quốc Kỳ', deck: bag(b.flags), questionMs: 20000, speakLine: () => 'Đây là quốc kỳ nước nào?', random
    }),
    createQuizGame({ id: 'math', title: 'Toán Nhanh', deck: bag([]), questionMs: 15000, random }),
    createQuizGame({
      id: 'wordle', title: 'Wordle Tiếng Anh', kind: 'wordle', deck: b.wordle.answers, questionMs: 150000, revealMs: 8000,
      wordle: b.wordle, revealAnswerAloud: false, speakLine: (q) => `Đoán từ tiếng Anh ${q.length} chữ cái!`, random
    })
  ];
}
