# Ghi công mã nguồn bên thứ ba

## cherry9001/tiktok-live-bar — MIT

Các file sau phỏng theo ý tưởng/cấu trúc của bản v1.0.5:

- `src/http/security.js` — kiểm Host/Origin, giới hạn tần suất (từ `TikTokBridge/src/security.js`)
- `src/live/normalize-tikfinity.js` — chuẩn hoá tin TikFinity (từ `TikTokBridge/src/tiktok/normalize-tikfinity-event.js`)

```
MIT License

Copyright (c) 2025 ÔNG CHÚ MMO — https://ongchummo.com

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Kho câu hỏi 7 tab đố vui — MIT

Dữ liệu (không phải mã) lấy từ `workaipvlinh-byte/lop-hoc-chu`, `workaipvlinh-byte/ai-la-trang-nguyen`, `sonlamdev/emoji-quiz-tiktok-live`,
`Maximax67/Words-CEFR-Dataset` và `lipis/flag-icons` (cờ SVG). Danh sách file + toàn văn giấy phép: `src/games/quiz/bank/NGUON.md`.
Bộ máy đố vui (`src/games/quiz/`, `public/stage/scenes/quiz-scene.js`) là tự viết.

## Chỉ tham khảo luật chơi, không dùng mã/hình

- `newakungchgamer-maker/SwimLive` (phần mềm đóng, có khoá bản quyền) — chỉ đọc file cấu hình để hiểu kiểu chơi "hợp sức đẩy vượt tường". Số liệu, mô hình và mã ở đây là tự làm.
- `zane-tv/tiktok-live-temple-rpc` (không có giấy phép) — chỉ đọc README để hiểu các nghi thức tương tác. Không dùng mã, hình Phật hay quẻ xăm của repo đó; 16 quẻ trong `src/games/temple-fortunes.js` là tự soạn.

## Font

`public/fonts/`: Be Vietnam Pro và Playfair Display — SIL Open Font License 1.1 (Google Fonts), được phép nhúng và phân phối lại.

## Thư viện npm

- `three` (MIT), `ws` (MIT).
- `tiktok-live-connector` — **AGPL-3.0-only**. Dùng riêng trên máy mình để live thì không phát sinh nghĩa vụ gì. Nếu **phát hành/bán/chia sẻ** bản có kèm thư viện này (hoặc cho người khác dùng qua mạng) thì phải công bố toàn bộ mã nguồn theo AGPL. Muốn tránh thì phát hành bản chỉ dùng nguồn TikFinity và gỡ thư viện này ra.
