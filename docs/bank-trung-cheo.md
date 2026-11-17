# Luật chống trùng giữa các bộ từ vựng tiếng Anh

Áp dụng 2026-11-17. Mỗi từ chỉ còn nằm ở **đúng một** bộ.

## Vì sao

Runtime chỉ lọc trùng giữa kho Tổng hợp và các bộ quà (`quiz-bank.js:123`), **không**
lọc giữa các bộ quà với nhau. Người xem đổi từ bộ này sang bộ khác sẽ gặp lại từ đã
chơi. Trước khi dọn có 461 từ nằm ở từ 2 bộ trở lên.

## Luật: bộ chuyên biệt hơn giữ từ, bộ rộng hơn nhả

Thứ tự ưu tiên khi một từ nằm ở nhiều bộ — bộ đứng trên giữ từ:

1. `yhoc` — Y học
2. `bongda` — Bóng đá
3. `vutru` — Vũ trụ
4. `game` — Game
5. `congnghe` — Công nghệ
6. `amthuc` — Ẩm thực
7. `dongvat` — Động vật
8. `tinhyeu` — Tình yêu
9. `bian` — Bí ẩn
10. `dulich` — Du lịch
11. `nhacua` — Nhà cửa
12. `nghenghiep` — Nghề nghiệp
13. `ielts` — IELTS
14. `toeic` — TOEIC
15. `truonghoc` — Trường học & Công việc
16. `giaitri` — Giải trí

Hai bộ cuối là rộng nhất nên nhả nhiều nhất. Hai bộ thi (`ielts`, `toeic`) xếp dưới các
bộ chủ đề vì chúng phân loại theo độ khó chứ không theo chủ đề: một từ về ẩm thực xuất
hiện trong đề TOEIC thì vẫn thuộc về bộ Ẩm thực.

## Kết quả

| Bộ | Trước | Nhả | Sau |
|---|---|---|---|
| Y học | 384 | — | 384 |
| Bóng đá | 369 | 3 | 366 |
| Vũ trụ | 523 | — | 523 |
| Game | 301 | 11 | 290 |
| Công nghệ | 380 | 20 | 360 |
| Ẩm thực | 424 | — | 424 |
| Động vật | 551 | 16 | 535 |
| Tình yêu | 305 | 14 | 291 |
| Bí ẩn | 302 | 23 | 279 |
| Du lịch | 571 | 44 | 527 |
| Nhà cửa | 543 | 61 | 482 |
| Nghề nghiệp | 356 | 1 | 355 |
| IELTS | 380 | 33 | 347 |
| TOEIC | 376 | 40 | 336 |
| Trường học & Công việc | 384 | 108 | 276 |
| Giải trí | 436 | 87 | 349 |

Tổng 16 bộ: 6.585 → 6.124 câu, bằng đúng số đáp án duy nhất.

Kho Tổng hợp **không đổi** (1.885 câu): mỗi từ vẫn còn ở một bộ nên `setKeys` giữ
nguyên 6.124 phần tử, luật lọc ở `quiz-bank.js:123` cho kết quả y hệt.

## Khi thêm từ mới

Tra xem từ đã nằm ở bộ nào chưa trước khi thêm. Kiểm tra bất biến (phải ra 0):

```js
import { loadEnglishSets } from './src/games/quiz/quiz-bank.js';
import { foldText } from './public/shared/profanity-filter.js';

const seen = new Map();
for (const [id, list] of Object.entries(loadEnglishSets()))
  for (const q of list) {
    const k = foldText(q.answer);
    seen.set(k, (seen.get(k) || 0) + 1);
  }
console.log([...seen.values()].filter((v) => v > 1).length); // 0
```
