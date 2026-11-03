# Hướng dẫn setup và vận hành live TikTok (máy Linux) — dành cho agent (Antigravity…) và người vận hành

Tài liệu này đủ để một agent tự cài, tự kiểm, tự bật live và xử lý sự cố thường gặp **mà không cần hỏi lại**.
Chỉ hỏi người viết code (Claude) khi: lỗi khó không có trong mục Sự cố, hoặc cần tính năng mới.

---

## 0. Luật bắt buộc cho agent (đọc trước khi làm gì)

1. **Đang live thì KHÔNG mở trình duyệt tự động dùng card đồ hoạ** (Chrome headless có GPU, Playwright có GPU…).
   Card GTX 1650 chỉ 4 GB VRAM; OBS + LIVE Studio + Chrome của user đã gần đầy. Ngày 03/11 một lần chụp
   kiểm như vậy làm **hết VRAM → GNOME đen màn → phải reset → live đứt**.
   Kiểm hình khi đang live: chụp thẳng từ OBS — `node scripts/obs-ws.mjs GetSourceScreenshot …` (mục 6).
   Cần trình duyệt tự động thì dùng CPU: `--disable-gpu --enable-unsafe-swiftshader` + `/stage?lite=1`.
2. **Mọi file/repo bên ngoài sắp chạy phải đọc từng dòng trước** (user yêu cầu). File nhị phân (Electron…)
   thì chỉ lấy bản phát hành chính thức + đối chiếu SHA-256 từ ≥ 2 nguồn. Không chạy script cài đặt lạ.
3. **Không in / lưu / gửi**: stream key, admin token, mật khẩu OBS, cookie TikTok. Không commit thư mục `data/`.
4. **Không đưa dữ liệu người xem thật (tên, id) vào repo** — test dùng tên giả.
5. Không dùng tool "tạo stream key" không chính thức. Không tự nối/ngắt live liên tục (dịch vụ ký miễn phí
   Euler giới hạn số lần nối mỗi phút).
6. Sửa code xong phải `npm run gate` xanh rồi mới commit; commit message tiếng Anh, conventional, ≤ 72 ký tự.
7. Đổi code **phía server** (thư mục `src/`) cần khởi động lại server ⇒ chỉ làm khi **không** live.
   Đổi code **màn hình** (`public/`) chỉ cần tải lại nguồn OBS (mục 6) — làm được cả khi đang live (chớp ~1 giây).

---

## 1. Hệ thống gồm những gì

```
 TikTok (người xem tim/bình luận/quà)
        │  tiktok-live-connector (đọc sự kiện phòng, qua dịch vụ ký Euler miễn phí)
        ▼
 Server game Node  ── http://127.0.0.1:3939 ──┬─ /stage  : màn game 3D (three.js) 1080×1920
 ~/FileMySelf/tiktok-live-games (src/main.js) └─ /admin  : trang điều khiển (cần token)
        │ WebSocket
        ▼
 OBS (flatpak) : nguồn trình duyệt "Màn game (chùa / bar / bơi)" = /stage → nén NVENC 6000 kbps
        │ RTMP (địa chỉ + key do app dưới đây xin từ TikTok cho mỗi buổi)
        ▼
 TikTok LIVE  ◄── "LIVE Studio for Linux" (~/Apps/live-studio-linux, app KHÔNG chính thức):
                  đăng nhập TikTok, tạo phòng, lấy RTMP, điều khiển OBS qua obs-websocket 4455
```

- Tài khoản live: **@tangducne** (có quyền LIVE Studio **dùng thử 14 ngày tới 17/11/2026**; muốn gia hạn
  phải có **≥ 1 buổi live dài ≥ 25 phút**). Tài khoản @thangbinh1593 KHÔNG có quyền LIVE Studio.
- TikTok LIVE Studio chính thức không có bản Linux; app trên gửi yêu cầu giống bản Mac. TikTok có thể chặn bất
  cứ lúc nào (rủi ro điều khoản — user đã chấp nhận).

## 2. Máy hiện tại (đã cài xong, ghi lại để dựng lại khi cần)

| Thành phần | Giá trị |
|---|---|
| Hệ điều hành | Ubuntu 26.04, GNOME Wayland |
| Card | NVIDIA GTX 1650 4 GB, driver 595.99.02 |
| Node | `~/.nvm/versions/node/v22.23.2/bin/node` |
| Repo game | `~/FileMySelf/tiktok-live-games` (GitHub `ducthai1/tiktok-festival`, nhánh `main`) |
| OBS | flatpak `com.obsproject.Studio` 33 + `org.freedesktop.Platform.GL.nvidia-595-99-02` (phải khớp đúng bản driver) |
| App LIVE | `~/Apps/live-studio-linux` (commit `80c933d`, đã đọc hết 5.427 dòng) |
| Electron | `~/Apps/electron-v44.9.0-linux-x64` (zip chính thức, SHA-256 `ecced7ec…c8b9` khớp GitHub + npm) |
| Nút menu | "Bắt đầu live TikTok" → `~/Apps/bat-dau-live-tiktok.sh` |
| Log | server: `~/.cache/tiktok-live-games.log` · app: `~/.cache/live-studio-linux.log` |
| Mạng | tải lên ~50–60 Mbps (đủ; cần ≥ 10) |

### 2.1 Dựng lại từ đầu (máy mới / cài lại)

**a) Game**
```bash
cd ~/FileMySelf && git clone git@github.com:ducthai1/tiktok-festival.git tiktok-live-games
cd tiktok-live-games && npm ci && npm run gate      # phải: pass N, fail 0
```

**b) OBS** (flatpak, cài cho user)
```bash
flatpak install --user flathub com.obsproject.Studio
nvidia-smi --query-gpu=driver_version --format=csv,noheader   # vd 595.99.02
flatpak install --user flathub org.freedesktop.Platform.GL.nvidia-595-99-02   # đổi số theo driver
```
Trong OBS (giao diện tiếng Anh):
- `Profile` → tạo **TikTokLive**. `Settings → Video`: Base **1080×1920**, Output **1080×1920**, **30** FPS.
- `Settings → Output` (Simple): Video Bitrate **6000**, Encoder **NVIDIA NVENC H.264**, Audio **160**.
  `Settings → Advanced`: bật **Automatically Reconnect** (Retry Delay 2).
- `Scene Collection` → **TikTokLive**, scene **Game**, thêm nguồn **Browser**:
  tên `Màn game (chùa / bar / bơi)`, URL `http://127.0.0.1:3939/stage`, Width **1080**, Height **1920**,
  FPS 30, bật **Control audio via OBS**.
- `Tools → WebSocket Server Settings`: bật server, cổng 4455, bật mật khẩu (app LIVE dùng mật khẩu này).

**c) App LIVE Studio for Linux** — đọc mã trước khi chạy (luật 2)
```bash
mkdir -p ~/Apps && cd ~/Apps
git clone https://github.com/averagenative/tiktok-live-studio-linux.git live-studio-linux
cd live-studio-linux && git checkout 80c933d9011f724a1c27afe6d473a83d31618b9f
# bản mới hơn: PHẢI đọc lại toàn bộ src/ (chỉ được gọi tới host TikTok, OBS 127.0.0.1:4455, 127.0.0.1:47812)
```
Electron (không dùng `npm install electron` — script cài của nó tự tải + chạy):
```bash
Q=$(mktemp -d) && cd "$Q"
curl -sSLO https://github.com/electron/electron/releases/download/v44.9.0/electron-v44.9.0-linux-x64.zip
curl -sSLO https://github.com/electron/electron/releases/download/v44.9.0/SHASUMS256.txt
grep ' \*electron-v44.9.0-linux-x64.zip$' SHASUMS256.txt
echo "ecced7ecb55697f92ca870939c5988557faa8acd8c222c232cae5913d318c8b9  electron-v44.9.0-linux-x64.zip" | sha256sum -c
unzip -Z1 electron-v44.9.0-linux-x64.zip | grep -E '(^/|\.\./)' && echo "ĐƯỜNG DẪN LẠ — DỪNG"
mkdir -p ~/Apps/electron-v44.9.0-linux-x64 && unzip -q electron-v44.9.0-linux-x64.zip -d ~/Apps/electron-v44.9.0-linux-x64
```
Ubuntu chặn sandbox Chromium của app tự cài ⇒ cho đúng file electron dùng (giống hồ sơ Chrome/VS Code của Ubuntu;
KHÔNG chạy `--no-sandbox`). Nội dung `~/Apps/live-studio-linux-electron.apparmor`:
```
abi <abi/5.0>,
include <tunables/global>

profile live-studio-linux-electron /home/datadevice/Apps/electron-v44.9.0-linux-x64/electron flags=(unconfined) {
  userns,
  @{exec_path} mr,

  include if exists <local/live-studio-linux-electron>
}
```
```bash
sudo cp ~/Apps/live-studio-linux-electron.apparmor /etc/apparmor.d/live-studio-linux-electron
sudo apparmor_parser -r /etc/apparmor.d/live-studio-linux-electron      # cần mật khẩu: để user tự gõ
```
Cài đặt app — `~/.config/LIVE Studio for Linux/settings.json` (sửa khi app **đã tắt**; app đang chạy sẽ ghi đè):
```json
{ "driveObs": true, "useTikTokProfile": false, "vertical": true, "language": "vi",
  "lastTitle": "Chùa Online 🙏 Gõ mõ cầu may" }
```
`useTikTokProfile: false` = dùng chính profile OBS **TikTokLive** ở trên (không để app tạo profile riêng).

**d) Nút bấm** `~/Apps/live-studio-linux.sh`:
```sh
#!/bin/sh
exec "$HOME/Apps/electron-v44.9.0-linux-x64/electron" "$HOME/Apps/live-studio-linux" "$@"
```
`~/Apps/bat-dau-live-tiktok.sh`:
```sh
#!/bin/sh
GAME_DIR="$HOME/FileMySelf/tiktok-live-games"
NODE="$HOME/.nvm/versions/node/v22.23.2/bin/node"
if ! curl -s -o /dev/null --max-time 2 http://127.0.0.1:3939/api/health; then
  mkdir -p "$HOME/.cache"
  (cd "$GAME_DIR" && PORT=3939 nohup "$NODE" src/main.js >> "$HOME/.cache/tiktok-live-games.log" 2>&1 &)
fi
if ! pgrep -x obs >/dev/null; then
  nohup flatpak run com.obsproject.Studio --disable-shutdown-check >/dev/null 2>&1 &
fi
exec "$HOME/Apps/live-studio-linux.sh"
```
`chmod +x` cả hai. Mục menu `~/.local/share/applications/live-studio-linux.desktop`:
`Name=Bắt đầu live TikTok`, `Exec=/home/datadevice/Apps/bat-dau-live-tiktok.sh`, `Icon=/home/datadevice/Apps/live-studio-linux/build/icon.png`.

Agent chạy giúp user mà không muốn chương trình chết theo phiên agent: `setsid -f ~/Apps/bat-dau-live-tiktok.sh`
(KHÔNG cài dịch vụ tự chạy lúc khởi động máy — user chưa đồng ý việc đó).

---

## 3. Quy trình mỗi buổi live

1. Bấm **"Bắt đầu live TikTok"** (menu ứng dụng). Kiểm: `curl -s http://127.0.0.1:3939/api/health` → `{"ok":true…}`.
2. OBS: thấy màn Chùa trong khung; thanh âm lượng "Màn game" có nhảy khi bấm thử (mục 4).
3. App LIVE Studio for Linux: chấm OBS xanh (`connected to obs-websocket`), ô Account báo
   **LIVE access: ready** và **LIVE Studio access: granted**. Chưa đăng nhập: bấm **Log in to TikTok** (user tự đăng nhập).
4. Nối game với phòng **trước** khi lên live (server tự thử lại tới khi phòng mở, báo "isn't online" là bình thường):
   `node scripts/admin-command.mjs connect tangducne`
5. Trong app: **Title** (≤ 32 ký tự) → **Go LIVE**. Trạng thái PREPARING → **LIVE**; OBS tự phát.
6. Trong ~1 phút: `node scripts/admin-command.mjs status` → `"state":"connected"`.
7. Kiểm luồng phát: `node scripts/obs-ws.mjs GetStreamStatus` → `outputActive:true`, `outputSkippedFrames` ~0,
   `outputCongestion` ~0. Mở TikTok trên điện thoại vào phòng để nhìn tận mắt.
8. Kết thúc: **End LIVE** trong app (OBS tự dừng và trả cài đặt cũ). Buổi đầu nhớ **≥ 25 phút**.

## 4. Trang điều khiển `/admin`

URL: `http://127.0.0.1:3939/admin#token=<nội dung data/admin-token>` (không dán token ra ngoài).
- Chọn game (Chùa / Bar / Bơi), Kết nối / Ngắt tên TikTok, bật tắt âm thanh, nhạc, giọng đọc, bảng chú thích.
- **🎁 Tặng quà cho người đang có mặt**: chọn quà rồi bấm "Tặng" cạnh tên — game chạy hiệu ứng quà đó cho người ấy (họ không phải tặng), dùng được khi đang live. Lệnh server `grant` (`src/admin-command-handler.js`).
- "Thử trước khi live": bơm sự kiện giả (tim, bình luận, quà…) — **tự bị khoá khi đang nối live thật**.
- Dòng lệnh tương đương: `node scripts/admin-command.mjs status|connect <tên>|disconnect|switch <temple|bar|swim>|test <chat|like|gift|follow|member> [nội dung]`.

## 5. Người xem tương tác thế nào (Chùa Online)

Miễn phí (ghi trên bảng "Cách tham gia" đầu màn):

| Người xem làm | Hiệu ứng |
|---|---|
| Thả tim ❤ hoặc bình luận `mõ` / `gõ mõ` | gõ mõ (+công đức); bình luận mỗi người tối đa 1 lần / 2,5 giây |
| Bình luận `a di đà phật` / `adidaphat` / `nam mô…` / `vái…` | người đó ra giữa thảm trước bàn thờ quỳ vái rồi về chỗ (mỗi người 1 lần / 6 giây). **Không dùng chữ "lạy"** (nghĩa lóng xấu) |
| Bình luận `cầu …` (cầu bình an, sức khỏe…) | bong bóng 🙏 + đốm sáng bay lên; lời cầu được nhớ 5 phút, tặng quà từ bậc 3 thì thành hoa đăng |
| Follow / chia sẻ | thỉnh chuông, cả chánh điện cùng vái |
| Bình luận khác | bong bóng chữ trên đầu người đó (lọc chữ tục, link, số điện thoại) |

Quà (theo giá MỘT món, `public/shared/gift-tiers.js`): Hoa hồng → thắp hương · Rosa/Donut → xin xăm ·
Mũ/Corgi → đèn cầu sức khỏe · Ngân hà/Pháo hoa → mâm ngũ quả cầu tài lộc · Siêu xe → điều ước lớn ·
Sư tử/Tên lửa/Vũ trụ → vạn sự như ý (lễ lớn nhất). Người mới vào phòng được gọi tên + bước vào ngồi.

Chỗ ngồi: 31 chỗ, mọi chỗ + tên đều nằm trong phần điện thoại thấy. TikTok không báo ai rời phòng ⇒ người chỉ xem
mà 5 phút không tương tác (đã tương tác: 10 phút), hoặc phải nhường chỗ khi đầy, sẽ **đứng dậy đi ra cửa hông**.

## 6. Kiểm hình / cập nhật màn khi đang live (an toàn)

```bash
cd ~/FileMySelf/tiktok-live-games
node scripts/obs-ws.mjs GetSourceScreenshot '{"sourceName":"Game","imageFormat":"png","imageWidth":1080}' /tmp/xem.png
node scripts/obs-ws.mjs PressInputPropertiesButton '{"inputName":"Màn game (chùa / bar / bơi)","propertyName":"refreshnocache"}'   # nạp lại code màn hình
node scripts/obs-ws.mjs GetStats      # activeFps ~30, renderSkippedFrames thấp
nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader   # còn trống ≥ 800 MiB mới yên tâm
```
Đo số khung/giây của chính trang game: tạm đổi URL nguồn thành `/stage?fps=1` (góc dưới trái hiện số), xong đổi lại.

## 7. Bố cục màn hình — luật khi sửa giao diện

TikTok trên điện thoại phủ lên khung 1080×1920 (đã đo):
- Thanh trên 0–230 px · thông báo quà bên trái ~900–1150 px (x < ~700) · bình luận ~1150–1700 px (70% trái)
  · ô chat + nút ≥ 1720 px · tim bay mép phải.
- Màn điện thoại dài (19,5:9 / 20:9) **cắt ~97–108 px mỗi bên** ⇒ mọi chữ/bảng cách mép `--safe-x` = **116 px**
  (`public/stage/stage.css`); nhãn tên cũng bị kẹp trong lề này (`public/stage/stage-labels.js`).
- Chuông + mõ ở cột phải (`public/stage/scenes/temple-bell-and-mo.js`, toạ độ theo tỉ lệ khung): đáy chuông phải cao hơn đỉnh mõ, mép phải chuông < 972 px.
- Chỗ ngồi (`public/shared/temple-seats.js`) tính bằng phép chiếu camera (`public/shared/temple-camera.js`);
  vùng cấm nhãn: bảng Cách tham gia (trái) và cụm chuông + mõ (phải) — đổi vị trí chuông/mõ/bảng thì sửa `LABEL_KEEP_OUT`.
  `test/temple-seats.test.js` kiểm các luật này; chạy `npm run gate`.
- Tên người xem hiện ĐỦ và **luôn sát đỉnh đầu** (user chốt): chạm nhau chỉ nhích tối đa 1 nấc (`maxSteps: 1` ở `temple-scene.js`, `layoutGroup` trong `stage-labels.js`).
- Máy yếu (Mac 8 GB, điện thoại): `/stage?lite=1` (720×1280, 30 fps, bỏ hiệu ứng nặng).

## 8. Bản đồ code

| Muốn sửa | File |
|---|---|
| Luật chơi Chùa (lệnh bình luận, quà → nghi lễ, chỗ, rời đi) | `src/games/temple-game.js` |
| Hiệu ứng Chùa trên màn | `public/stage/scenes/temple-scene.js`, `temple-rituals.js`, `temple-grand-ceremony.js` |
| Bậc quà, ảnh quà | `public/shared/gift-tiers.js` |
| Chỗ ngồi / camera | `public/shared/temple-seats.js`, `public/shared/temple-camera.js` |
| Bảng HUD, thẻ chào, thông báo | `public/stage/stage-hud.js`, `stage.css`, `stage-theme.css` |
| Nhãn tên, bong bóng | `public/stage/stage-labels.js` |
| Nối TikTok, đọc sự kiện | `src/live/*.js` (`normalize-tiktok-connector.js` đọc payload v3) |
| Lệnh trang điều khiển | `src/admin-command-handler.js`, `public/admin/*` |
| Âm thanh | `public/stage/stage-audio.js` |
| Game Bar / Bơi | `src/games/bar-club-game.js`, `swim-*`, `public/stage/scenes/bar-*`, `swim-*` |

Quy trình sửa: sửa → `npm run gate` (xanh) → kiểm hình (mục 6 nếu đang live; không live thì có thể chạy server
riêng cổng khác + trình duyệt CPU) → commit + `git push origin main`.

## 9. Sự cố thường gặp

| Triệu chứng | Nguyên nhân / cách xử lý |
|---|---|
| App LIVE không mở (lỗi sandbox / "No usable sandbox") | Chưa nạp hồ sơ AppArmor (mục 2.1c) hoặc đường dẫn electron đổi |
| App báo "OBS WebSocket needs a password" | Dán mật khẩu ở `Tools → WebSocket Server Settings → Show Connect Info` vào ô OBS của app |
| "you have no live auth" / LIVE Studio access chưa cấp | Tài khoản không có quyền LIVE Studio (vd @thangbinh1593) — dùng @tangducne; quá 17/11 mà chưa có buổi ≥ 25 phút thì hết quyền |
| `status` báo "The requested user isn't online" | Bình thường khi chưa Go LIVE; server tự thử lại (≤ 60 giây/lần) |
| Báo lỗi Euler / rate limit | Đừng nối/ngắt liên tục; đợi vài phút rồi `connect` một lần |
| Tim/bình luận không hiện hiệu ứng | `status` phải `connected`; xem `~/.cache/tiktok-live-games.log` |
| Màn đen / máy đứng khi đang live | Hết VRAM: đóng bớt tab Chrome/ứng dụng nặng; tuyệt đối không chạy trình duyệt tự động có GPU (luật 1) |
| Video giật / "mạng rớt" | `GetStreamStatus`: `outputSkippedFrames`, `outputCongestion`; `GetStats`: renderSkippedFrames; kiểm tải lên |
| Không có tiếng game trên live | Nguồn browser phải bật "Control audio via OBS"; trong OBS thanh "Màn game" phải nhảy |
| Bảng/tên bị cắt mép trên điện thoại | Có thứ đặt ngoài `--safe-x`; xem mục 7 |
| Sau khi sửa code màn hình mà OBS chưa đổi | `refreshnocache` (mục 6) |
| Sau khi sửa code server | Chỉ khi KHÔNG live: dừng server (`kill <pid của node src/main.js>`), chạy lại bằng nút menu hoặc `setsid -f` |

## 10. Khi nào nhờ Claude

- Lỗi không có trong bảng trên, hoặc sửa theo bảng mà không hết.
- Tính năng mới / đổi giao diện lớn / đổi luật chơi.
Khi nhờ, gửi kèm: `node scripts/admin-command.mjs status`, 30 dòng cuối hai file log, ảnh `GetSourceScreenshot`,
và mô tả người xem thấy gì trên điện thoại (chụp màn hình điện thoại càng tốt).
