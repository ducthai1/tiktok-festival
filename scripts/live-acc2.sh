#!/usr/bin/env bash
# Live TÀI KHOẢN THỨ 2 trên cùng máy (Ubuntu + OBS + NVENC): mở OBS thứ 2 với cấu hình RIÊNG rồi chạy server game thứ 2.
#   bash scripts/live-acc2.sh        (Ctrl+C dừng server tài khoản 2; OBS 2 vẫn mở)
# - Server game: cổng 3940, dữ liệu riêng data-acc2/ (token, cài đặt, bảng quà, bảng xếp hạng… không đụng tài khoản 1).
# - OBS 2: cấu hình riêng ở ~/.config-acc2 — nếu chỉ "obs --multi" thì 2 OBS dùng chung cấu hình + chung cổng WebSocket 4455
#   → LIVE Studio điều khiển nhầm OBS.
# Đổi được: PORT=… DATA_DIR=… OBS_CONFIG=… bash scripts/live-acc2.sh
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-3940}"
DATA_DIR="${DATA_DIR:-data-acc2}"
OBS_CONFIG="${OBS_CONFIG:-$HOME/.config-acc2}"
mkdir -p "$DATA_DIR" "$OBS_CONFIG"

if ss -ltn 2>/dev/null | grep -q ":$PORT "; then
  echo "✗ Cổng $PORT đang có chương trình khác (server tài khoản 2 đã chạy?). Đổi: PORT=3941 bash scripts/live-acc2.sh"
  exit 1
fi

# OBS thứ 2 (bản cài thường hoặc Flatpak)
if command -v obs >/dev/null 2>&1; then
  XDG_CONFIG_HOME="$OBS_CONFIG" nohup obs --multi >/dev/null 2>&1 &
elif flatpak info com.obsproject.Studio >/dev/null 2>&1; then
  nohup flatpak run --env=XDG_CONFIG_HOME="$OBS_CONFIG" com.obsproject.Studio --multi >/dev/null 2>&1 &
else
  echo "⚠ Không thấy OBS (obs / Flatpak com.obsproject.Studio) — mở OBS thứ 2 bằng tay: XDG_CONFIG_HOME=$OBS_CONFIG obs --multi"
fi

cat <<EOF
→ Đã mở OBS thứ 2 (cấu hình riêng: $OBS_CONFIG). LẦN ĐẦU cài trong OBS 2:
   1. Settings → Video: Base + Output 1080x1920, 30 FPS.   Settings → Output: Encoder NVIDIA NVENC H.264, 4500–6000 Kbps.
   2. Tools → WebSocket Server Settings: bật, cổng 4456 (KHÁC 4455 của OBS 1), đặt mật khẩu.
   3. Thêm Browser Source 1080x1920, URL: http://127.0.0.1:$PORT/stage?lite=1   (?lite=1: đỡ nặng cho GTX 1650)
      + bật "Control audio via OBS".   Settings → Audio: TẮT Desktop Audio (không thì lẫn tiếng game của tài khoản 1).
   4. LIVE Studio thứ 2 (đăng nhập tài khoản 2), cũng chạy với cấu hình riêng: XDG_CONFIG_HOME=$OBS_CONFIG <lệnh mở LIVE Studio>
      → trỏ tới OBS WebSocket cổng 4456 + mật khẩu ở bước 2.
   Theo dõi tải card: nvidia-smi dmon -s um   (sm < 85 %, fb < 3700 MB là ổn) · OBS → View → Stats: khung hình bị lỡ ≈ 0.
→ Server game tài khoản 2 ở cổng $PORT, dữ liệu $DATA_DIR/ — link trang điều khiển in ngay dưới đây:
EOF
exec env PORT="$PORT" DATA_DIR="$DATA_DIR" node --env-file-if-exists=.env src/main.js
