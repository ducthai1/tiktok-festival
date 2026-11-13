# TikTok Live Games — Quán Bar · Đua Bơi · Chùa Online

> Làm việc trên repo (người hoặc AI): đọc **`AGENTS.md`** trước — setup chuẩn, dữ liệu không đưa lên git, quy tắc khi đang live, đổi token (`npm run rotate-token`).

Ba game tương tác 3D cho TikTok LIVE chạy trên **một server**. Bấm một nút trên trang điều khiển là đổi game ngay khi đang live; game kia vẫn giữ nguyên trạng thái để quay lại.

| Game | Người xem làm gì | Màn hình |
|---|---|---|
| 🍸 **Quán Bar** | Bình luận để vào quán (6 ghế quầy + 16 ô sàn nhảy). Gõ `nhảy` để quẩy, `cụng ly` để nâng ly. Thả tim và bình luận làm đầy **độ quẩy**; đầy thì cả quán mở tiệc. | Quầy rượu, biển neon, sàn LED, quả cầu disco, bartender, pháo hoa |
| 🏊 **Đua Bơi Vượt Rào** | Cả phòng hợp sức đẩy vận động viên bơi 1000 m qua 4 bức tường. Thả tim gọi vịt phao, gõ `cố lên`, follow/share gọi ván lướt, quà gọi thuyền, cá heo, cá mập, cá voi, tàu ngầm. Thắng đủ 7 vòng là **VÔ ĐỊCH**. | Biển hoàng hôn, dây phao, tường gạch có thanh máu, trợ thủ bơi vào đẩy |
| 🪷 **Chùa Online** | Thả tim gõ mõ, follow/share thỉnh chuông, gõ `thắp hương`, `cầu …` (thả hoa đăng mang lời cầu) hoặc `xin xăm` (gieo quẻ). Mỗi mức quà là một **lời cầu đời thường** của người tặng (bình an, sức khỏe, tài lộc, hết ế, tiền vào như nước…). 6 người nhiều điểm nhất quỳ hàng đầu. | Tranh chánh điện vẽ tay, tượng toả hào quang; Phật tử vẽ tay quỳ trên bồ đoàn, đi lên lư hương, dâng lễ; chuông đồng treo, mõ trên bàn thờ; tờ giải quẻ |

## Hiệu ứng theo chức năng — quà càng lớn màn càng hoành tráng

| Bậc quà (giá một món) | 🍸 Quán Bar | 🏊 Đua bơi | 🪷 Chùa |
|---|---|---|---|
| 1 · Hoa hồng… | Bia: bartender rót, cốc bay tới tay khách, khách nâng ly | Chân vịt bơi nhanh ×1,8 / Ván lướt nảy trên sóng | Thắp hương: người tặng lên bên lư, nâng hương, vái 3 vái, cắm hương |
| 2 · Bánh donut… | Cocktail: lắc bình mạnh, rót dòng màu | Thuyền rẽ sóng / Cá heo nhảy vòng cung | Xin xăm: lắc ống xăm tới khi que văng ra, mở tờ quẻ |
| 3 · Corgi… | Champagne: bật nút, bọt vàng phun, đèn rọi khách | Cá mập lộ vây rồi lao lên | Cầu sức khỏe: thắp đèn, cả dãy đèn bàn thờ lần lượt sáng |
| 4 · Dải ngân hà… | Tháp champagne: xếp từng ly, rót tràn, cả quán nâng ly | Cá voi phóng vọt khỏi mặt nước, camera rung | Cầu tài lộc: dâng mâm ngũ quả, chuông ngân, mưa cánh hoa |
| 5 · Siêu xe… | Mở tiệc: pháo giấy, laser, đèn chớp nhẹ, pháo hoa | Tàu ngầm trồi lên kèm còi | Điều ước lớn: băng rôn + giọng đọc lời cầu của người tặng, cả chánh điện lạy 3 lạy theo 3 hồi chuông |
| 6 · Sư tử, Tên lửa, Vũ trụ | Đại tiệc: pháo hoa gấp đôi | Tàu ngầm đẩy 3 lần | Vạn sự như ý: sen vàng nở giữa lối, hoa đăng bay khắp chánh điện, lạy 2 tuần chuông, camera tiến vào |

**Nghi thức ở chùa** đều có đầu có cuối (thắp hương và xin xăm mở bằng quà, xem mục Quà TikTok thật):
- *Thắp hương*: người đó đứng dậy, cầm 3 nén hương tới bên lư, thắp, nâng lên trán, vái 3 vái, cắm hương rồi về chỗ quỳ.
- *Cầu …*: bình luận hiện thành bong bóng 🙏; tặng quà sau đó thì hoa đăng mang lời cầu bay lên từ tay người tặng.
- *Xin xăm*: lắc ống xăm tới khi que xăm văng ra thì tờ quẻ mới mở.

Thả tim là gõ mõ (dùi gõ xuống mõ trên bàn thờ), follow/share là thỉnh chuông: chuông đồng treo bên phải lắc, ngân, loé sáng, tượng rực lên và cả chánh điện cùng vái.

Tên các mức quà cố ý là lời cầu đời thường, không dùng tên nghi lễ hay danh xưng của tôn giáo nào (`public/stage/scenes/temple-wishes.js`).

Nhân vật đi chậm dần khi tới chỗ và quỳ/ngồi xuống thành một động tác liền, không giật.

## 7 tab đố vui (Lớp Học Chữ · A/B/C/D · Tiếng Anh · Đuổi hình · Quốc kỳ · Toán · Wordle)

Cùng một bộ máy (`src/games/quiz/quiz-game.js`) + một cảnh (`public/stage/scenes/quiz-scene.js`), khác kho câu hỏi:

| Tab | Người xem gõ gì | Kho |
|---|---|---|
| 📚 Lớp Học Chữ | đáp án (không dấu cũng được) | ~2.200 câu, 32 chủ đề |
| 🏆 Đố Vui A/B/C/D | A, B, C hoặc D (chỉ tính lần chọn đầu) | ~5.100 câu, 4 bậc khó |
| 🔤 Từ Vựng Tiếng Anh | từ tiếng Anh đúng nghĩa | ~1.250 từ chung (`bank/tieng-anh/`) + 5 bộ đổi bằng quà: TOEIC, IELTS, Y học, Bóng đá, Công nghệ (~150 từ/bộ, `bank/tieng-anh-bo/`) |
| 🧩 Đuổi Hình Bắt Chữ | cụm từ theo chuỗi emoji | ~1.100 câu |
| 🚩 Đoán Quốc Kỳ | tên nước (Việt hoặc Anh) | 143 nước |
| ➗ Toán Nhanh | kết quả | tự sinh, khó dần |
| 🟩 Wordle Tiếng Anh | từ tiếng Anh 5 chữ cái | 442 đáp án |

- Điểm: 5 người đúng nhanh nhất +10/7/5/3/3, đúng sau +1 (Wordle: đoán trúng +15, mở ô xanh mới +1/ô). Bảng điểm giữ suốt phiên, nút "Xoá bảng điểm".
- **Tab tiếng Anh: quà đổi bộ đề / độ khó cho cả phòng** (`public/shared/english-sets.js` → `ENGLISH_GIFT_PLAN`): mỗi ô một món cố định có thật ở TikTok VN, **giá thật** (bảng `public/shared/tiktok-gifts-vn.js`, lấy từ streamtoearn.io/gifts?region=VN, cập nhật bằng `node scripts/update-vn-gifts.mjs`). Trang 1: TikTok 1 → Tổng hợp, Hoa hồng 1 → Dễ, Heart Me 1 → Khó, Brown Paw 5 → Động vật, Peach 5 → Ẩm thực, Rosa 10 → Trường học, **Doughnut 30 → 🎧 Luyện nghe**. Trang 2 (quà quen mặt): Capybara 30 → TOEIC, Perfume 20 → IELTS, Tiny Diny 10 → Công nghệ, Lucky Pig 10 → Thể thao, Squirrel 10 → Y học, Friendship Necklace 10 → Du lịch, Cheer You Up 9 → Giải trí. **Máy chủ chặn món rẻ hơn giá ghi trên bảng** (TikTok có món trùng tên khác giá) — chỉ cảm ơn, không đổi. Nhận món theo id / tên / mã ảnh (TikTok gửi tên tiếng Việt vẫn khớp). Đổi từ câu sau, giữ 20 câu rồi tự về Tổng hợp · Vừa. Ở tab này quà không mở gợi ý.
- **Quà không cộng điểm cho người tặng** (theo hướng dẫn TikTok, nhất là khi có trẻ em xem): quà mở gợi ý cho CẢ PHÒNG — mở chữ, loại đáp án sai, mở ô Wordle. Luôn chừa lại ít nhất 1 chữ.
- **Tim → thanh Năng lượng** (dưới tiêu đề): 200 → câu sau là ⭐ **Câu vàng** (đúng được x2 điểm); 400 → ⚡ **Chớp nhoáng**: 3 câu liền, mỗi câu đếm 8 giây, ai đúng cả 3 được ⚡ cạnh tên + 5 điểm, rồi thanh về 0 (Wordle: mốc 400 cũng là câu vàng).
- **Follow**: lần đầu trong buổi +3 điểm; người đang follow kênh (TikTok báo kèm mỗi sự kiện, hoặc đã follow ở buổi trước — lưu ở `data/followers.json`) có 💖 cạnh tên. Cứ 10 follow trong buổi → câu vàng cho cả phòng (💖 x/10 cùng hàng thanh năng lượng).
- **Share**: +20 năng lượng (tính 5 lần/người/buổi); bảng 📣 **Đại sứ share** (top 3) ở cột trái, dưới dải chào người mới.
- **Bù độ trễ live**: mỗi câu hiện đề 2 giây rồi mới đếm ngược (người xem thấy đề trễ 1–2 giây); hết giờ vẫn nhận thêm 1,5 giây bình luận đang tới.
- Tab không được chọn thì đứng yên (đồng hồ không chạy). Nút điều khiển: câu tiếp / lật đáp án, gợi ý, tạm dừng, tiếp tục.
- Bật "Đọc cảm ơn quà / follow" để giọng đọc đọc câu hỏi và đáp án.
- **🎧 Luyện nghe** (Doughnut 30 xu, `english-switcher.js`): 40 câu liền, mỗi câu chỉ hiện "Nghe rồi gõ lại từ tiếng Anh" + ô chữ (mở chữ đầu); giọng bản xứ đọc từ 3 lần (lúc ra đề, đọc chậm sau ~7 giây, giữa giờ), câu 25 giây; lật đáp án mới hiện nghĩa tiếng Việt. Từ lấy ngẫu nhiên trên TOÀN kho (mọi bộ, mọi độ khó), sổ riêng: các lượt sau không lặp tới khi nghe hết kho. Nhận đúng từ, cách viết khác (colour/color) và từ đồng âm (pear/pair — `homophones.js`), không nhận từ đồng nghĩa. Ô 🎧 chỉ hiện khi giọng đọc tiếng Anh đang chạy tốt; giọng hỏng giữa chừng thì tự dừng + báo trên màn hình. Người khác đổi bộ trong lúc nghe thì xếp hàng sau, không rút ngắn 40 câu. Bộ "Đồ vật" đã gộp vào Tổng hợp.
- **Đọc đáp án tiếng Anh giọng bản xứ** (tab Tiếng Anh + Wordle, mặc định BẬT, công tắc "🇬🇧 Đọc đáp án tiếng Anh" ở mục 5): lật đáp án là đọc từ
  đó một lần thường + một lần chậm, rồi mới "Chúc mừng …" tiếng Việt. 8 giọng neural Microsoft (Mỹ / Anh / Úc, nam ↔ nữ luân phiên, không lặp
  3 từ liền). Máy chủ tạo sẵn giọng ngay lúc ra đề (đáp án không gửi ra màn hình trước khi lật). Cần mạng; lỗi / mất mạng thì im lặng, game
  chạy bình thường. Cài: tự động lần đầu `npm start` (~30 giây, chạy nền) hoặc `npm run setup-tts-en` — xem `src/tts/english-tts.js`.

## Âm thanh

- Hiệu ứng và nhạc nền đều tự tổng hợp, không dùng nhạc có bản quyền.
  - Bar: nhạc house.
  - Đua bơi: sóng biển, marimba.
  - Chùa: tiếng ngân trầm, mõ tụng kinh, chuông nhỏ.
- Hiệu ứng mô phỏng đúng vật: chuông đồng nhiều bội âm, mõ gỗ, ly thuỷ tinh, nút sâm panh, cồng khi có quà lớn.
- Bật/tắt nhạc nền và chỉnh âm lượng riêng trong mục **Màn hình**.
- Khung xem trước trong trang điều khiển mặc định im lặng để không kêu trùng với OBS; bật **🔊 Nghe ở khung xem trước** nếu muốn nghe ngay tại đó.
- Mở `/stage` trong tab trình duyệt thường thì bấm vào màn hình một lần (trình duyệt chặn tiếng tới lần bấm đầu); OBS không cần.

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

## Setup + vận hành live trên máy Linux (cho agent)

Đọc **[docs/huong-dan-live-tiktok-tren-linux.md](docs/huong-dan-live-tiktok-tren-linux.md)**: cài từ đầu, quy trình mỗi buổi live, lệnh điều khiển (`scripts/admin-command.mjs`, `scripts/obs-ws.mjs`), luật an toàn (không chạy trình duyệt dùng card đồ hoạ khi đang live), bố cục màn hình, sự cố thường gặp.

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

### Máy yếu (Mac 8 GB, điện thoại): `?lite=1`

Mở `http://127.0.0.1:3939/stage?lite=1`: vẽ 720×1280 rồi phóng lên khung, bỏ khử răng cưa, bóng đổ mềm,
hậu kỳ phát sáng và kính mờ của bảng, tối đa 30 khung/giây (TikTok LIVE chỉ phát 30). Đèn neon quán bar bớt
rực; chùa gần như không khác. Thêm `&fps=1` để góc màn hiện số khung/giây thật.

Đo một khung trên máy dev (`__stage.step(1)` + chờ GPU vẽ xong, 1080×1920):

| Cảnh | Card GTX 1650: đầy đủ → nhẹ | Vẽ bằng CPU (gần máy yếu): đầy đủ → nhẹ |
|---|---|---|
| Quán bar | 4,7 → 2,3 ms | 324 → 73 ms |
| Đua bơi | 2,5 → 0,65 ms | 205 → 23 ms |
| Chùa | 2,8 → 0,9 ms | 201 → 24 ms |

Màn 60 Hz còn được vẽ một nửa số khung. Máy yếu thì đừng đi vòng OBS → LIVE Studio: cho LIVE Studio
lấy thẳng `/stage?lite=1` (nguồn Link) hoặc quay cửa sổ trình duyệt, và để tab trang điều khiển ở sau
(khung xem trước trong đó cũng là một màn 3D đang vẽ).

### Kết nối phòng live

Trên trang điều khiển, nhập `@tên_tiktok` (hoặc dán link live) rồi bấm **Kết nối**. Có 2 cách nhận sự kiện:

- **TikTok trực tiếp** (mặc định): thư viện `tiktok-live-connector` đọc phòng live công khai, **không cần đăng nhập, cookie hay mật khẩu**. Bản miễn phí của dịch vụ ký Euler Stream có giới hạn số lần kết nối; nếu bị giới hạn thì đặt `EULER_API_KEY`.
- **TikFinity**: mở app TikFinity Desktop trên cùng máy, chọn nguồn "Qua app TikFinity".

### Demo nhanh — xem trước để chọn

Trên trang điều khiển, chọn game, rồi dùng mục **⚡ Demo nhanh**:
- **👋 Ít người vào** (3 người, chào riêng từng người), **🚶 Đông người vào** (35 người, chào cả đoàn), **📢 Phòng trên 1000 người** (chỉ hiện dòng chữ).
- Mỗi hiệu ứng theo bình luận, tim, follow và quà của game đó có một nút riêng, ví dụ Bar: "nhảy", "cụng ly", bia → mở tiệc; Đua bơi: "cố lên", vịt phao → tàu ngầm, về đích; Chùa: "thắp hương", "cầu …", "xin xăm", gõ mõ, thỉnh chuông, điều ước lớn, vạn sự như ý.
- **▶ Chạy toàn bộ hiệu ứng** phát lần lượt mọi hiệu ứng của game đang chọn.

Xem lớn bằng cách mở `/stage` trong tab mới, bấm vào màn hình một lần để bật âm thanh (OBS không cần bấm).

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
| `TTS_EN_ENV` | `~/.local/share/tiktok-live-games/tts-en-env` | Môi trường Python của giọng đọc tiếng Anh (edge-tts) |

## Quà TikTok thật → hiệu ứng

Hiệu ứng chọn theo **giá của MỘT món quà** (xu TikTok gửi kèm sự kiện), không theo tổng: 1 Sư tử khác hẳn 30.000 Hoa hồng; số lượng (combo) chỉ làm hiệu ứng dày hơn và được cộng dồn trên cùng một dòng thông báo (×1 → ×2 → ×3) nếu cùng người, cùng quà. Bậc (`public/shared/gift-tiers.js`):

| Bậc | Giá một món | Ví dụ quà | 🍸 Bar | 🏊 Bơi | 🪷 Chùa |
|---|---|---|---|---|---|
| 1 | 1–9 xu | Hoa hồng, TikTok, GG, Bắn tim | Bia | Chân vịt / Ván lướt | Thắp hương |
| 2 | 10–98 | Rosa, Nước hoa, Bánh donut | Cocktail | Thuyền / Cá heo | Xin xăm |
| 3 | 99–498 | Mũ, Tay tim, Pháo giấy, Corgi | Champagne | Cá mập | Cầu sức khỏe |
| 4 | 499–4.999 | Thiên nga, Dải ngân hà, Pháo hoa | Tháp ly | Cá voi | Cầu tài lộc |
| 5 | 5.000–19.999 | Siêu xe, Liên hành tinh | Mở tiệc | Tàu ngầm | Điều ước lớn |
| 6 | ≥ 20.000 | Tên lửa, Sư tử, Vũ trụ | Đại tiệc pháo hoa | Tàu ngầm ×3 | Vạn sự như ý |

Khi nối live (nguồn tiktok-live-connector), server đọc **danh mục quà của chính phòng đó** (tên, giá, ảnh) và bảng "Cách tham gia" hiện ảnh quà thật cho từng bậc; giá theo vùng hay quà mới vẫn vào đúng bậc vì dùng giá thật. Chưa nối live thì dùng quà mẫu (giá phổ biến, có thể lệch theo vùng).

**Bình luận chỉ có phản hồi đơn giản, hiệu ứng đẹp để dành cho quà:** ở chùa, bình luận hiện thành bong bóng chữ trên đầu người đó (lời `cầu …` có 🙏, mỗi người 1 bong bóng / 4 giây); gõ "thắp hương"/"xin xăm" chỉ hiện bong bóng nhắc tặng quà. Lời cầu được nhớ 5 phút: khi chính người đó tặng quà từ bậc 3 (Tay tim, Corgi…) trở lên, hoa đăng mang đúng lời cầu đó bay lên và được đọc thành tiếng. Ở bar, bình luận chỉ đổi dáng (nhảy, nâng ly); ở bơi, "cố lên" gọi một vịt phao.

## Bố cục màn hình theo giao diện TikTok LIVE

Trên điện thoại người xem, TikTok phủ lên khung 1080×1920: thanh chủ phòng + người xem (0–230 px), thông báo quà bên trái (~900–1150 px), bình luận (~1150–1700 px, 70% bên trái), ô chat + nút quà (1720 px trở xuống), tim bay dọc mép phải. Vì vậy mọi chữ và bảng của game nằm trong dải 232–1150 px: tiêu đề + chỉ số ngay dưới thanh TikTok, **Cách tham gia** (lệnh gõ + bậc quà) bên trái và **bảng xếp hạng** bên phải ở giữa màn; thẻ chào người mới phủ tạm lên đúng chỗ bảng Cách tham gia rồi rút đi; băng rôn quà lớn có dải nền đậm, chữ màu đặc; thông báo của game bên phải. Phần dưới chỉ để cảnh.

Điện thoại màn dài (19,5:9, 20:9) xem video 9:16 thì TikTok phóng cho đầy chiều cao nên **cắt mất ~97–108 px mỗi bên** của khung 1080. Mọi chữ/bảng đặt cách mép `--safe-x` = 116 px (`public/stage/stage.css`); chuông + mõ của chùa nằm ở cột phải (mép phải chuông < 972 px), mõ trên đầu phải bàn thờ — đầu trái bị thông báo quà của TikTok che.

Chỗ quỳ của chùa (`public/shared/temple-seats.js`, dùng chung cho server và màn hình) được **tính bằng đúng phép chiếu của camera** (`public/shared/temple-camera.js`): mỗi chỗ phải giữ người + nhãn tên trong lề an toàn, đầu người ngồi trước lộ ít nhất một nửa, nhãn tên chồng nhau ≤ 35%, không đè bảng Cách tham gia hay cụm chuông + mõ, không quỳ lên thảm đỏ. Hai bên thảm mỗi bên chỉ còn ~200 px nên người quỳ nhỏ hơn cỡ thật 15% và nhãn ở chùa gọn lại (≤ 150 px, tên dài thì …). Kết quả 31 chỗ đều lộ (bố trí cũ 30 chỗ nhưng 14 chỗ rơi ra ngoài phần điện thoại thấy). `test/temple-seats.test.js` kiểm các luật này.

TikTok không báo ai rời phòng: người chỉ vào xem mà 5 phút không tương tác (người đã gõ mõ / bình luận / tặng quà: 10 phút), hoặc phải nhường chỗ khi chánh điện đầy, thì **đứng dậy đi ra cửa hông** rồi mới biến mất.

Hiệu ứng hạt có trần số lượng; cánh hoa và khói hương không cộng sáng, nên đông người vào hay nhiều quà lớn liền nhau cũng không bị chói trắng.

## Tranh và nhân vật của Chùa Online

Chùa dùng **tranh vẽ** thay cho khối 3D: nền chánh điện + Phật tử (nam/nữ, 11–12 tư thế) + chuông, mõ (tách từ ảnh sư), đều là ảnh chủ dự án tạo bằng Gemini, nằm trong `public/assets/temple/` (WebP, ~1,1 MB) kèm `sprites.json` (cỡ thật bằng mét, mốc chân, đỉnh đầu của từng khung).

- Camera được khớp phối cảnh của tranh (chân trời 56,3% từ trên, camera cao 0,93 m — `public/stage/scenes/temple-view.js`). Người ở gần camera được thu nhỏ bớt để hàng trước không che bàn thờ.
- Hoạt hình kiểu 2D: mỗi động tác là một chuỗi khung vẽ đổi dứt khoát (không hoà mờ, không lắc lư). Đi bộ 4 nhịp mỗi chu kỳ (bước – giữa bước – bước chân kia – giữa bước) đổi theo quãng đường nên chân không trượt; vái quỳ: quỳ → tay lên trán → cúi; lạy: thêm khung rạp sát đất; đứng ↔ quỳ chen khung một gối chạm đất. Các khung giữa (giữa bước, cúi nửa chừng, quỳ xuống…) vẽ thêm bằng Gemini từ chính ảnh nhân vật gốc (ảnh thô ở `art-inbox/chua/gen/`).
- Đổi tranh: tạo ảnh mới (nền hồng tím `#FF00FF` cho nhân vật), đặt vào `art-inbox/chua/raw/` (thư mục này không lên git), rồi chạy các script trong `scripts/temple-art/` theo thứ tự: `key_sprites` → `backdrop_clean` → `export_temple_sprites` → `buddha_glow_layer` (dáng tượng cho hào quang) → `temple_props_crop` (chuông, mõ). Đổi bố cục tranh nền thì phải đo lại chân trời và độ sâu trong `temple-view.js`.

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
- **Giọng đọc chạy trên chính máy** (VieNeu tiếng Việt; edge-tts cho đáp án tiếng Anh) trong môi trường Python riêng, gói ghim đúng phiên bản; server chỉ nghe 127.0.0.1.
- **Không có tự cập nhật.** SwimLive tải zip rồi chạy PowerShell ẩn mà không kiểm chữ ký.
- **Thư viện ghim phiên bản cũ ít nhất 2 tuần**, `ignore-scripts=true`, `npm audit` = 0 lỗ hổng. `follow-redirects` được ép lên bản đã vá.
- Vòng vẽ hình chịu được lỗi: một khung hình lỗi không làm đứng cả buổi live.

## Lưu ý chính sách TikTok

- TikTok hạn chế kiếm tiền với live "thụ động, lặp lại, không có người trông" và với việc **kêu gọi tặng quà một cách máy móc**. Nên có mặt trò chuyện với người xem; chữ gợi ý trên màn hình được viết để nhấn vào bình luận và tim.
- Bảng chú thích quà có thể tắt trong mục **Màn hình** nếu muốn gọn.
- Chủ đề chùa và quẻ xăm dễ bị xem là nhạy cảm (tôn giáo gắn với tiền). Hãy cân nhắc cách nói chuyện và cách đặt tên.
- Chỉ live trên tài khoản đã xác thực theo quy định hiện hành.

## Nhật ký (log) và xử lý sự cố mất dữ liệu live

Mọi dòng log có giờ máy và được ghi vào `data/logs/YYYY-MM-DD.log` (mỗi ngày một file, giữ 14 ngày; `data/` không lên git vì có tên người xem; token trang điều khiển bị che `***` trong file). Tìm nhanh:

| Muốn biết | Tìm dòng |
|---|---|
| Lúc nào mất / có lại dữ liệu | `[live] trạng thái →` (connected / reconnecting / idle) và `nối lại được sau … giây` |
| TikTok báo live tạm dừng / kết thúc / đóng kết nối | `TikTok báo live TẠM DỪNG`, `KẾT THÚC`, `TikTok đóng kết nối: mã …` |
| Kết nối "còn" mà không có dữ liệu | `canh chừng: … giây không có dữ liệu` (tự nối lại sau 90 giây im lặng; 2 phút đầu sau mỗi lần kết nối chỉ chờ 30 giây) |
| Vừa mở live mới mà vẫn dính phòng cũ | `TikTok vẫn trả về phòng cũ … đã kết thúc — tra lại` |
| Có cạn lượt ký Euler không | `kết nối … lần N trong ngày`, `kết nối thất bại (ratelimit / blocked)` |
| Phòng đông có làm server nghẽn không | `[health] độ trễ xử lý … p99` (≥ 250ms ghi WARN "SERVER ĐANG NGHẼN"), `xử lý sự kiện … mất …ms (chậm)` |
| Lưu lượng từng phút | `[live] 60 giây qua: chat … · like … · member … · roomUser …` |
| Người vận hành đã bấm gì | `[admin] lệnh connect / disconnect / switch …` |
| OBS chạy code cũ / vẽ ít khung (hiệu ứng có ở khung xem trước mà mất trên live) | `[stage] màn hình OBS: code … (CŨ / đúng bản mới) · N khung/giây · GPU`, `đang chạy code CŨ`, `chỉ vẽ N khung/giây` |
| Giọng đọc tiếng Anh có chạy không | `[tts-en] giọng tiếng Anh hoạt động`, `không đọc được "…": … — cách sửa`, `cài … thất bại` |

Kết nối tự hồi phục: live **tạm dừng** (mạng máy phát chập chờn, thoát app) → thử lại mỗi 4 giây (3 phút đầu); live **kết thúc** → chờ live mới mỗi 20 giây rồi 2 phút; Euler giới hạn / chặn → giãn 30 s → 5 phút; một lần kết nối treo quá 25 giây thì bỏ, thử lại. Trang điều khiển hiện **băng đỏ nhấp nháy + tiếng bíp** khi mất live quá 20 giây.

**Bắt buộc có `EULER_API_KEY` trong `.env`** (xem `.env.example`) — không có khoá TikTok dễ chặn / giới hạn. Danh mục quà qua Euler cần gói Business nên mặc định không tải (đặt `EULER_FETCH_GIFTS=1` nếu có gói), danh mục gom dần từ quà nhận được.

Trang điều khiển (dưới khung xem trước) hiện tình trạng màn hình OBS + nút **🔄 Làm mới màn hình OBS**. Màn hình OBS và trang điều khiển **tự tải lại** khi server khởi động lại với code giao diện mới (không cần bấm Refresh nguồn trình duyệt).

## Kiểm tra

```bash
npm run gate    # kiểm cú pháp toàn bộ .js + 29 bài test (logic 3 game, chào người mới, bảo mật HTTP/WebSocket)
```

## Giấy phép

Code của dự án này dùng riêng (`UNLICENSED`). Thư viện `tiktok-live-connector` theo **AGPL-3.0**: dùng riêng để live thì không sao, còn nếu chia sẻ hoặc bán bản build thì phải công bố mã nguồn. Chi tiết trong `NOTICE.md`.

## Ghi công

Một phần cách kiểm tra Host/Origin, giới hạn tần suất và bộ chuẩn hoá tin TikFinity được phỏng theo [cherry9001/tiktok-live-bar](https://github.com/cherry9001/tiktok-live-bar) (MIT, © 2025 ÔNG CHÚ MMO). Xem `NOTICE.md`.
