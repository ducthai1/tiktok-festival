import { foldText } from '../text-match.js';

/**
 * Kiểm tra đáp án "Việt Nam" / "Viet Nam":
 * - foldText phải khớp 'viet nam' hoặc 'vietnam'
 * - Không chấp nhận ghi thường chữ cái đầu (bắt buộc chữ cái đầu tiên phải là 'V' viết hoa)
 */
export function checkVietNamAnswer(comment) {
  if (!comment) return false;
  const trimmed = comment.trim();
  const folded = foldText(trimmed);
  if (folded !== 'viet nam' && folded !== 'vietnam') return false;
  // Ký tự chữ cái đầu tiên (bỏ qua icon/emoji đầu câu nếu có) phải là 'V' viết hoa
  const m = trimmed.match(/[a-zA-ZÀ-ỹ]/);
  return Boolean(m && m[0] === 'V');
}

/**
 * Tạo 2 câu hỏi đặc biệt chủ quyền Hoàng Sa, Trường Sa
 */
export function createHoangSaTruongSaQuestions() {
  return [
    {
      prompt: 'Hoàng Sa, Trường Sa là của đất nước nào?',
      answer: 'Việt Nam',
      category: 'Tự Hào Việt Nam 🇻🇳',
      accept: ['viet nam', 'vietnam'],
      noPronounce: true,
      checkAnswer: checkVietNamAnswer
    },
    {
      prompt: 'Lại một lần nữa nè Hoàng Sa, Trường Sa là của đất nước nào?',
      answer: 'Việt Nam',
      category: 'Tự Hào Việt Nam 🇻🇳',
      accept: ['viet nam', 'vietnam'],
      noPronounce: true,
      checkAnswer: checkVietNamAnswer
    }
  ];
}
