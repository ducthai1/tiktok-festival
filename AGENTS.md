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

## 2. Bí mật và dữ liệu — KHÔNG BAO GIỜ đưa lên git

Repo này **công khai**. Những thứ sau chỉ ở trên máy, đã nằm trong `.gitignore`:

| Đường dẫn | Là gì |
|---|---|
| `.env` | khoá Euler, cấu hình máy |
| `data/admin-token`, `data/admin-token.rotation` | token trang điều khiển |
| `data/settings.json`, `data/gift-catalog.json`, `data/hot-backup.json` | cài đặt, danh mục quà, trạng thái game |
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
- Bố cục màn hình theo vùng an toàn của TikTok (mục *Bố cục màn hình* trong README): chữ / bảng chỉ trong dải 180–1150 px, cách mép 94 px.
- Kho câu hỏi: `src/games/quiz/bank/` (thêm từ = thêm dòng `ĐÁP ÁN | câu hỏi tiếng Anh là gì? | độ khó 1-3 | cách khác`).
  Bộ đề tiếng Anh đổi bằng quà: nhiều bộ chờ thì mỗi bộ ít câu đi (`english-switcher.js`, `adaptiveQuestions`).
- **Thêm từ tiếng Anh: không được trùng.** Mỗi bộ = file chính + file bổ sung `<bộ>-*.txt` (vd `toeic-them.txt`). Trước khi thêm,
  kiểm đáp án chưa có ở BẤT KỲ file nào trong `bank/tieng-anh/`, `bank/tieng-anh-bo/`, `bank/lop-hoc/25-tieng-anh.txt`
  (so theo chữ thường, bỏ dấu cách). Độ khó chỉ 1, 2, 3. Không dán đề lộ đáp án.
- **Xoay vòng không lặp** (`english-switcher.js`): sổ "đã hỏi" dùng chung mọi bộ, theo từ tiếng Anh, lưu `data/english-seen.json`.
  Đổi bộ / đổi độ khó / khởi động lại đều đi tiếp từ chưa hỏi; một bộ hỏi hết mới bắt đầu vòng mới cho riêng bộ đó. Có test.
- Commit: tiêu đề kiểu `feat(quiz): …` / `fix(live): …` (tiếng Anh), thân giải thích vì sao. Chạy `npm run gate` trước khi push.
