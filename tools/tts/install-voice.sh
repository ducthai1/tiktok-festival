#!/usr/bin/env bash
# Cài giọng đọc tiếng Việt VieNeu-TTS cho game live — môi trường Python RIÊNG (không đụng tool aff), cùng bản vieneu 3.8.3
# và đúng các phụ thuộc tool aff đang dùng ổn; chặn mọi bản phát hành mới hơn 20/10/2026 (tránh gói vừa bị chèn mã độc).
# Model (~500 MB) dùng lại bản tool aff đã tải trong ~/.cache/huggingface. Chạy: bash tools/tts/install-voice.sh
set -euo pipefail

ENV_DIR="$HOME/.local/share/tiktok-live-games/tts-env"
UV="${UV:-$(command -v uv || echo "$HOME/.local/bin/uv")}"
CUTOFF="2026-10-20"

[ -x "$UV" ] || { echo "✗ Không thấy uv ($UV). Cài uv trước: https://docs.astral.sh/uv/"; exit 1; }
mkdir -p "$(dirname "$ENV_DIR")"

echo "→ Tạo môi trường Python 3.12: $ENV_DIR"
[ -x "$ENV_DIR/bin/python" ] || "$UV" venv --python 3.12 "$ENV_DIR"

echo "→ Cài phụ thuộc (onnxruntime, sea-g2p, librosa, soundfile…)"
"$UV" pip install --python "$ENV_DIR/bin/python" --exclude-newer "$CUTOFF" \
  "onnxruntime>=1.20" "sea-g2p>=0.9.1" "soxr>=0.3" "kaldi-native-fbank>=1.20" "tokenizers>=0.20" \
  "huggingface_hub>=0.20" "librosa>=0.11.0" "soundfile>=0.12" numpy

echo "→ Cài vieneu 3.8.3 (--no-deps: gói tự khai thêm gradio ~100 MB không cần)"
"$UV" pip install --python "$ENV_DIR/bin/python" --exclude-newer "$CUTOFF" --no-deps "vieneu==3.8.3"

echo "→ Kiểm tra"
"$ENV_DIR/bin/python" -I -c "import vieneu, onnxruntime, soundfile, sea_g2p; print('  OK — vieneu, onnxruntime', onnxruntime.__version__)"
echo "✓ Xong. Server game tự bật giọng đọc ở lần đọc kế tiếp (nạp model ~10–20 giây)."
