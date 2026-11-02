# TikTok Live Games — Quán Bar · Đua Bơi · Chùa Online

Ba game tương tác 3D cho TikTok LIVE chạy trên **một server**. Bấm một nút trên trang điều khiển là đổi game ngay khi đang live; game kia vẫn giữ nguyên trạng thái để quay lại.

| Game | Người xem làm gì | Màn hình |
|---|---|---|
| 🍸 **Quán Bar** | Bình luận để vào quán (6 ghế quầy + 16 ô sàn nhảy). Gõ `nhảy` để quẩy, `cụng ly` để nâng ly. Thả tim và bình luận làm đầy **độ quẩy**; đầy thì cả quán mở tiệc. | Quầy rượu, biển neon, sàn LED, quả cầu disco, bartender, pháo hoa |
| 🏊 **Đua Bơi Vượt Rào** | Cả phòng hợp sức đẩy vận động viên bơi 1000 m qua 4 bức tường. Thả tim gọi vịt phao, gõ `cố lên`, follow/share gọi ván lướt, quà gọi thuyền, cá heo, cá mập, cá voi, tàu ngầm. Thắng đủ 7 vòng là **VÔ ĐỊCH**. | Biển hoàng hôn, dây phao, tường gạch có thanh máu, trợ thủ bơi vào đẩy |
| 🪷 **Chùa Online** | Thả tim gõ mõ, follow/share thỉnh chuông, gõ `thắp hương`, `cầu …` (thả hoa đăng mang lời cầu) hoặc `xin xăm` (gieo quẻ). Quà để dâng hoa sen, đèn lưu ly hoặc làm đại lễ. 6 người nhiều điểm nhất quỳ hàng đầu. | Chánh điện cột son, đèn lồng, đài sen có hào quang, lư hương, chuông, mõ, tờ giải quẻ |

## Chào mừng người mới vào phòng

Ở cả 3 game, **mỗi người vào phòng đều được gọi tên**. Người đã ở sẵn trong phòng từ trước khi kết nối thì được chào lúc họ tương tác lần đầu. Người quay lại sau 10 phút được chào lại.

| Lúc nào | Màn hình |
|---|---|
| Hàng chờ ≤ 20 người | **Chào riêng từng người**: thẻ lớn có avatar, tên, lời chào theo game, kèm tiếng nhạc chào. Bar: nhân vật bước vào quán dưới đèn spotlight vàng. Đua bơi: một chú vịt phao mang tên người đó bơi ra chào. Chùa: Phật tử đi từ cổng lên chỗ quỳ rồi vái chào. Mỗi người khoảng 2,4 giây; hàng dài hơn 10 người thì 1,5 giây. |
| Hàng chờ > 20 người | **Chào cả đoàn**: mỗi đợt tối đa 40 người. Thẻ hiện avatar và tên cả đoàn, mỗi người một nhân vật (hoặc một chú vịt) có gắn tên cùng bước vào. |
| Phòng > 1000 người xem | Mỗi người mới một **dòng chữ** "👋 … vừa vào" bên phải màn hình. Ngưỡng 1000 chỉnh được trên trang điều khiển. |

- Không bỏ sót ai, giữ đúng thứ tự vào phòng.
- Nhân vật của người đang chờ được giữ ngoài cửa, tới lượt chào mới bước vào, để khoảnh khắc được gọi tên trùng lúc họ xuất hiện.
- Quán hoặc chánh điện hết chỗ: người mới chỉ thế chỗ người cũng chỉ vào xem, không bao giờ đẩy người đang bình luận hay tặng quà ra. Hết chỗ hẳn thì vẫn có một nhân vật mang tên họ bước vào chào rồi rời đi.
- Công tắc **"Đọc tên người mới vào"** (giọng máy, mặc định tắt) nằm trong mục **Màn hình**.

## Chạy

Cần **Node.js 20 trở lên**.

```bash
npm ci          # cài đúng phiên bản trong package-lock.json, KHÔNG chạy script cài đặt nào (.npmrc)
npm start
```

Cửa sổ server in ra 2 link:

- **Màn hình OBS**: `http://127.0.0.1:3939/stage`
- **Trang điều khiển**: `http://127.0.0.1:3939/admin#token=…` (link này giữ kín; token còn nằm trong `data/admin-token`)

### Gắn vào OBS

1. Thêm nguồn **Browser Source** (Nguồn trình duyệt), URL là `http://127.0.0.1:3939/stage`.
2. Đặt Rộng **1080** × Cao **1920**.
3. Bật **Control audio via OBS** để thu âm thanh game.

Trên TikTok LIVE Studio thì dùng OBS Virtual Camera, hoặc dùng stream key từ OBS.

### Kết nối phòng live

Trên trang điều khiển, nhập `@tên_tiktok` (hoặc dán link live) rồi bấm **Kết nối**. Có 2 cách nhận sự kiện:

- **TikTok trực tiếp** (mặc định): thư viện `tiktok-live-connector` đọc phòng live công khai, **không cần đăng nhập, cookie hay mật khẩu**. Bản miễn phí của dịch vụ ký Euler Stream có giới hạn số lần kết nối; nếu bị giới hạn thì đặt `EULER_API_KEY`.
- **TikFinity**: mở app TikFinity Desktop trên cùng máy, chọn nguồn "Qua app TikFinity".

### Thử trước khi live

Mục **Thử trước khi live** gửi bình luận, tim, follow, quà và người vào phòng giả mang tên "Khách thử N". Có nút "25 người vào" để xem chào cả đoàn, và ô đặt số người xem giả để xem kiểu chỉ hiện chữ. Màn hình sẽ hiện nhãn vàng **CHẾ ĐỘ THỬ**. Khi đang kết nối live thật, các nút này **tự khoá**, để không ai lỡ phát tương tác bịa ra cho người xem thật.

## Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | `3939` | Cổng server |
| `ALLOW_LAN` | tắt | `1` = cho điện thoại cùng wifi mở trang điều khiển (vẫn cần token) |
| `LIVE_PROVIDER` | `tiktok` | `tiktok` hoặc `tikfinity` (dùng khi tự kết nối lúc khởi động) |
| `TIKTOK_USERNAME` | trống | Tự kết nối tài khoản này khi khởi động |
| `EULER_API_KEY` | trống | Khoá Euler Stream nếu bị giới hạn lượt kết nối |
| `TIKFINITY_WS_URL` | `ws://127.0.0.1:21213/` | Chỉ nhận địa chỉ trên chính máy này |
| `START_GAME` | `bar` | `bar` / `swim` / `temple` |

## Ảnh bàn thờ riêng (Chùa Online)

Mặc định bàn thờ là một đài sen 3D phát hào quang. Muốn dùng ảnh riêng thì đặt file **bạn có quyền sử dụng** vào `public/assets/temple/altar.png` (nên là PNG nền trong suốt), rồi tải lại màn hình OBS.

## Đã sửa gì so với code tham khảo

Phần bridge của `cherry9001/tiktok-live-bar` được dùng làm tham khảo. `SwimLive` và `tiktok-live-temple-rpc` chỉ được dùng để hiểu luật chơi: code, hình ảnh và quẻ xăm ở đây đều tự viết.

- **Trang điều khiển phải có token.** Bản tham khảo cho mọi trang trên cùng máy quyền điều khiển. Ở đây màn hình OBS chỉ được xem; sai token 3 lần là bị ngắt.
- **Chỉ nghe `127.0.0.1`**, kiểm `Host` (chặn DNS rebinding) và `Origin` cho WebSocket. Bản chùa tham khảo mở mọi cổng mạng kèm `cors()` và không xác thực.
- **CSP chặt** `script-src 'self'`, không có script hay style nội tuyến. File addon của three.js được đổi đường dẫn khi phục vụ, nên không cần importmap nội tuyến.
- **Ảnh chỉ tải từ CDN TikTok** (whitelist ở cả server lẫn CSP). Chữ của người xem luôn đi qua `textContent`, không bao giờ qua `innerHTML`.
- **Lọc tên giả mạo**: bỏ ký tự điều khiển, ký tự đảo chiều và ký tự rộng 0, nhưng giữ emoji ghép.
- **Lọc lời khấn bẩn có tính dấu**: gập dấu thì "lớn", "các", "buổi" bị trùng từ bậy, nên ở đây so trên chữ còn dấu. Link và số điện thoại bị bỏ.
- **Combo quà tính phần tăng thêm**: hiệu ứng hiện ngay, tổng kim cương không đếm trùng, kể cả khi TikFinity không gửi `repeatEnd`.
- **Không có người xem giả tự chạy, không tự kết nối tài khoản của người khác.** Bản chùa tham khảo tự giả lập Phật tử và tự nối tới kênh của tác giả.
- **Giọng đọc dùng `speechSynthesis` của trình duyệt** (mặc định tắt), không chạy chương trình Python ngoài.
- **Không có tự cập nhật.** SwimLive tải zip rồi chạy PowerShell ẩn mà không kiểm chữ ký.
- **Thư viện ghim phiên bản cũ ít nhất 2 tuần**, `ignore-scripts=true`, `npm audit` = 0 lỗ hổng. `follow-redirects` được ép lên bản đã vá.
- Vòng vẽ hình chịu được lỗi: một khung hình lỗi không làm đứng cả buổi live.

## Lưu ý chính sách TikTok

- TikTok hạn chế kiếm tiền với live "thụ động, lặp lại, không có người trông" và với việc **kêu gọi tặng quà một cách máy móc**. Nên có mặt trò chuyện với người xem; chữ gợi ý trên màn hình được viết để nhấn vào bình luận và tim.
- Bảng chú thích quà có thể tắt trong mục **Màn hình** nếu muốn gọn.
- Chủ đề chùa và quẻ xăm dễ bị xem là nhạy cảm (tôn giáo gắn với tiền). Hãy cân nhắc cách nói chuyện và cách đặt tên.
- Chỉ live trên tài khoản đã xác thực theo quy định hiện hành.

## Kiểm tra

```bash
npm run gate    # kiểm cú pháp toàn bộ .js + 28 bài test (logic 3 game, chào người mới, bảo mật HTTP/WebSocket)
```

## Giấy phép

Code của dự án này dùng riêng (`UNLICENSED`). Thư viện `tiktok-live-connector` theo **AGPL-3.0**: dùng riêng để live thì không sao, còn nếu chia sẻ hoặc bán bản build thì phải công bố mã nguồn. Chi tiết trong `NOTICE.md`.

## Ghi công

Một phần cách kiểm tra Host/Origin, giới hạn tần suất và bộ chuẩn hoá tin TikFinity được phỏng theo [cherry9001/tiktok-live-bar](https://github.com/cherry9001/tiktok-live-bar) (MIT, © 2025 ÔNG CHÚ MMO). Xem `NOTICE.md`.
