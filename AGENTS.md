# Hướng dẫn cho AI / người làm trên repo này (setup chuẩn)

Server Node.js chạy game tương tác cho TikTok LIVE: đọc bình luận / quà / tim từ phòng live, vẽ màn hình 1080×1920 cho OBS.
Chi tiết tính năng: `README.md`. File này là **luật vận hành** — đọc trước khi sửa gì.

## 1. Chạy

```bash
npm ci                 # cài đúng phiên bản (không chạy script cài đặt — .npmrc)
cp .env.example .env   # lần đầu; điền EULER_API_KEY
npm start              # in ra link màn hình OBS + link trang điều khiển (có token)
npm run gate           # kiểm cú pháp + toàn bộ test — BẮT BUỘC pass trước khi commit/push
```

- **`EULER_API_KEY` trong `.env` là bắt buộc.** Thiếu khoá → TikTok/Euler chặn hoặc giới hạn kết nối → mất toàn bộ bình luận, quà, mắt xem
  (sự cố 11/11 và 12/11/2026). Dòng log đầu tiên khi khởi động ghi `EULER_API_KEY CÓ` / `KHÔNG CÓ`.
- Màn hình OBS: `http://127.0.0.1:3939/stage` (Browser Source 1080×1920). Nó **tự tải lại** khi server khởi động lại với code giao diện mới.
- Giọng đọc đáp án tiếng Anh (edge-tts, 8 giọng Microsoft): `npm start` tự cài lần đầu vào `~/.local/share/tiktok-live-games/tts-en-env`
  (cần mạng; Mac/Linux; dùng `uv` nếu có, không thì `python3 -m venv`). Cài tay / kiểm tra: `npm run setup-tts-en` (đọc thử cả 8 giọng).
  Log `[tts-en] … 403 … Microsoft từ chối` = Microsoft đổi cách ký → nâng `edge-tts` (+ phụ thuộc) trong `tools/tts/requirements-en.txt`,
  chạy `npm run setup-tts-en` thử, rồi push — máy live pull + khởi động lại là tự cài lại. Không vá giao thức bằng tay trong code.

## 2. Bí mật và dữ liệu — KHÔNG BAO GIỜ đưa lên git

Repo này **công khai**. Những thứ sau chỉ ở trên máy, đã nằm trong `.gitignore`:

| Đường dẫn | Là gì |
|---|---|
| `.env` | khoá Euler, cấu hình máy |
| `data/admin-token`, `data/admin-token.rotation` | token trang điều khiển |
| `data/settings.json`, `data/gift-catalog.json`, `data/hot-backup.json`, `data/live-room.json` | cài đặt, danh mục quà, trạng thái game, phòng live gần nhất |
| `data/followers.json`, `data/gifts.log` | ID / tên người xem — dữ liệu cá nhân |
| `data/logs/*.log`, `*.log`, `server.log` | nhật ký (có tên người xem) |

- **Cấm `git add -f` bất cứ thứ gì trong `data/` hay file `.log`.** Cấm dán output của `npm start` (có link kèm token) vào file nào trong repo.
- Dùng `git add <file cụ thể>`; kiểm `git status` trước khi commit.
- Nếu `git ls-files data` còn ra file khác `data/.gitkeep` (từng bị thêm ép): **chạy trên chính máy live** `npm run untrack-data`,
  rồi `git commit -m "chore: stop tracking live data and logs" && git push`. KHÔNG làm việc này từ máy khác rồi push — máy live pull về
  sẽ bị xoá các file đó.

## 3. Token trang điều khiển

- Lộ link `/admin#token=…` (chat, ảnh chụp, git…) → `npm run rotate-token` rồi khởi động lại server; dùng link mới in ra.
- Khi token bị lộ diện rộng, tăng `TOKEN_ROTATION` trong `src/admin-token-store.js`: mọi máy chạy bản mới tự đổi token một lần.
- Mặc định server chỉ nghe `127.0.0.1`. Chỉ bật `ALLOW_LAN=1` khi thật cần điều khiển bằng điện thoại cùng wifi.

## 3b. BẮT BUỘC cho AI chạy trên máy live (đọc kỹ — đã có sai sót thật ngày 14/11/2026)

- **Server thứ 2 (tài khoản 2) chỉ chạy bằng `npm run live-acc2`** (hoặc `PORT=3940 DATA_DIR=data-acc2 npm start`).
  CẤM `PORT=3940 node src/main.js` / `start-3940.sh`: thiếu `DATA_DIR` → dùng CHUNG `data/` với live chính (ghi đè token, cài đặt,
  bảng quà, bản lưu nóng, phòng live). File `start-3940.sh` đã bị xoá vì lý do này.
- **Không kill tiến trình / cổng mình không tự mở** (`fuser -k`, `pkill`…). Cổng bận → `ss -ltnp | grep <cổng>` rồi HỎI chủ kênh.
- **Không bịa người / tên.** Máy này chỉ có chủ kênh (TikTok `tangducne`). Đừng nói "tiến trình của anh X" khi không có dữ liệu.
- **Commit đúng việc đã làm + phải push hết.** Tiêu đề commit phải khớp nội dung; xong việc `git status` phải sạch (không để thay đổi
  chưa commit trên máy live — lần pull sau sẽ xung đột / mất). 14/11: commit "bảng vàng" thật ra không có giao diện bảng vàng,
  còn phần sửa khung bình luận thì không commit.
- **Sửa màn hình phải tự chụp lại kiểm tra** (Chrome headless / mở /stage) trước khi báo "đã xong" — test pass không có nghĩa là hiện đúng.
- **Từ ngữ của chủ kênh:** "Bảng vàng" = 3 người tặng nhiều 💎 nhất, hiện trên màn hình (`state.donators`). Hàng bảng (tab đố vui):
  👑 Bảng vàng | 📣 Đại sứ share | 🏆 Bảng điểm — ba bảng cạnh nhau, tên dài cắt "…" (không luân phiên). "Khung bình luận" = bình luận THEO THỨ TỰ MÁY CHỦ NHẬN + giây từ lúc ra đề + 🥇🥈🥉 người đúng (chống cãi nhau ai trước).
- **Bố cục:** live là MỘT video cho mọi máy — không responsive theo máy người xem. iPhone màn dài (15 Pro) TikTok che từ ~1.210 px,
  Android từ ~1.370 px (toạ độ 1080×1920). Thứ quan trọng (bảng quà, bảng vàng) phải nằm trên 1.210 px. Tab có bảng quà hiện tại:
  thẻ câu hỏi 270–750 · bảng quà 760–937 · Bảng vàng | Đại sứ | Bảng điểm 947–1095 · thẻ quà đổi đề / chào mừng 1103–1203.
- **Thẻ quà đổi đề** (`stage-hud.js` giftCard) nằm CÙNG CHỖ thẻ chào người mới và ƯU TIÊN hơn: đang hiện thẻ quà thì lời chào chờ
  (`stage-main.js` welcomeWaiting). 5 bậc theo giá thật món quà: 1 · 2–9 · 10–19 · 20–29 · 30+ xu.

## 4. Đang live — quy tắc

- **Không sửa code, không cho AI sửa code trên máy đang live, không `git pull` giữa buổi.** Làm trên bản clone khác; chỉ cập nhật máy live
  giữa hai buổi: Ctrl+C → `git pull` → `npm ci` (nếu package-lock đổi) → `npm start`.
- Bảng điểm, trạng thái game nằm trong bộ nhớ (+ `data/hot-backup.json`); khởi động lại giữa buổi có thể mất một phần.

## 5. Mất dữ liệu live — xem LOG trước, đừng đoán

Log: `data/logs/YYYY-MM-DD.log` (mỗi dòng có giờ). Bảng "cần tìm dòng nào" ở mục *Nhật ký (log)* trong `README.md`. Tóm tắt:

- `[live] trạng thái →` — lúc nào mất / có lại kết nối, vì sao.
- `TikTok báo live TẠM DỪNG / KẾT THÚC`, `TikTok đóng kết nối: mã …`, `canh chừng: … không có dữ liệu`, `TikTok vẫn trả về phòng cũ`.
- `kết nối thất bại (ratelimit|blocked|offline|network)` + `lần N trong ngày` — có cạn lượt ký Euler không.
- `[health] … p99` — server có nghẽn khi phòng đông không. `[live] 60 giây qua: …` — lưu lượng từng phút.

Kết nối đã **tự hồi phục** (`src/live/live-connection-manager.js`, có test ở `test/live-connection.test.js`): live tạm dừng → thử lại 4 giây;
live kết thúc → chờ live mới; im lặng 90 giây (30 giây trong 2 phút đầu) → nối lại; Euler giới hạn → giãn nhịp tới 5 phút.
**Đừng thêm vòng nối lại / retry riêng ở chỗ khác** — sửa trong file đó và thêm test.

## 6. Code

- Node ≥ 20, ES modules, không framework; màn hình là three.js + DOM trong `public/stage/`. Chú thích tiếng Việt, ngắn, giải thích *vì sao*.
- Bố cục màn hình theo vùng an toàn của TikTok (mục *Bố cục màn hình* trong README): chữ / bảng chỉ trong dải 180–1150 px, cách mép 94 px
  (thứ quan trọng ≤ 1.210 px cho iPhone — mục 3b; khung bình luận bên phải 1.385–1.705 px là ngoại lệ chủ kênh duyệt: iPhone vẫn thấy).
- Kho câu hỏi: `src/games/quiz/bank/` (thêm từ = thêm dòng `ĐÁP ÁN | câu hỏi tiếng Anh là gì? | độ khó 1-3 | cách khác`).
  Bộ đề tiếng Anh đổi bằng quà (`english-switcher.js`): quà mới KẾT THÚC LUÔN bộ đang chạy và ra câu mới ngay (không hàng chờ,
  chủ kênh chốt 13/11/2026); tặng lại đúng bộ đang chạy chỉ đếm lại số câu. Vòng chớp nhoáng thì đổi từ câu sau.
  Riêng Luyện nghe chạy ít nhất 20 câu (`LISTEN_MIN_QUESTIONS`): quà đổi bộ trong lúc đó chờ đủ 20 câu mới đổi.
- Bảng xếp hạng / đại sứ: xoá người im lặng quá 2 tiếng (`INACTIVE_MS`). Phòng live mới (room id khác `data/live-room.json`)
  → `hub.resetRoom()` xoá thông số phòng cũ, giữ bảng xếp hạng. Có test: `test/live-room-reset.test.js`.
- **Thêm từ tiếng Anh: không được trùng.** Mỗi bộ = file chính + file bổ sung `<bộ>-*.txt` (vd `toeic-them.txt`). Trước khi thêm,
  kiểm đáp án chưa có ở BẤT KỲ file nào trong `bank/tieng-anh/`, `bank/tieng-anh-bo/`, `bank/lop-hoc/25-tieng-anh.txt`
  (so theo chữ thường, bỏ dấu cách). Độ khó chỉ 1, 2, 3. Không dán đề lộ đáp án.
- Chủ kênh đổi quà / số câu tab tiếng Anh ở **tab 🎁 Quà** của trang điều khiển (lưu `data/settings.json` → `englishGifts`);
  `ENGLISH_GIFT_PLAN` chỉ là bảng mặc định. Trang điều khiển chia tab (`public/admin/index.html`) — giữ nguyên các id phần tử mà
  `admin-main.js`, `admin-test-panel.js`, `admin-demo-scenarios.js`, `admin-gifts.js` dùng.
- **Giá quà KHÔNG được tự đặt.** Tab tiếng Anh gán quà trong `ENGLISH_GIFT_PLAN` (`public/shared/english-sets.js`), giá lấy từ
  `public/shared/tiktok-gifts-vn.js` (giá thật vùng VN; cập nhật: `node scripts/update-vn-gifts.mjs`). `SAMPLE_GIFTS` cũng phải đúng giá thật.
  (12/11 quà mẫu bị sửa giá sai — "You're awesome" ghi 5 xu, thật 1 xu — người xem đổi bộ đề bằng món rẻ hơn → lỗ.)
- **Xoay vòng không lặp** (`english-switcher.js`): sổ "đã hỏi" dùng chung mọi bộ, theo từ tiếng Anh, lưu `data/english-seen.json`.
  Đổi bộ / đổi độ khó / khởi động lại đều đi tiếp từ chưa hỏi; một bộ hỏi hết mới bắt đầu vòng mới cho riêng bộ đó. Có test.
- `public/admin/admin-main.js`: giữ nguyên các khai báo `testPanel`, `demo`, sự kiện `connect-form` và vòng gắn công tắc `set-*`
  (từng bị xoá nhầm → nút Kết nối chết, công tắc không ăn). Sửa trang điều khiển xong: mở thử, xem Console không có lỗi đỏ.
- Commit: tiêu đề kiểu `feat(quiz): …` / `fix(live): …` (tiếng Anh), thân giải thích vì sao. Chạy `npm run gate` trước khi push.
