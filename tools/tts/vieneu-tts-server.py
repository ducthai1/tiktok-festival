# Giọng đọc tiếng Việt cho game live: VieNeu-TTS (Apache-2.0, chạy ngay trên máy bằng CPU, không cần mạng / tài khoản —
# cùng bản và cùng các giọng mà tool aff đang dùng). Server HTTP nhỏ CHỈ nghe 127.0.0.1:
#   GET  /health                 → {"ok": true, "voices": [...]}
#   POST /speak {"text","voice"} → audio/wav (đã cắt lặng hai đầu)
# Server Node (src/tts/tts-bridge.js) tự bật file này bằng Python của môi trường riêng nếu môi trường đó có.
import io
import json
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
import soundfile as sf
from vieneu import Vieneu

VOICES = ['Ngọc Huyền', 'Trúc Ly', 'Hải Đăng']
MAX_CHARS = 220
MAX_BODY = 4096

model = Vieneu(mode='v3turbo')
infer_lock = threading.Lock()  # onnxruntime đã tự chạy nhiều luồng; hai câu cùng lúc chỉ tranh CPU


# Giọng VieNeu gốc chỉ ~-19 dB trung bình và có đỉnh nhọn (nâng thẳng lên là chạm trần -1 dB) → NÉN như giọng radio
# (ép đỉnh: ngưỡng -32 dB, tỉ lệ 4:1, đường bao 15 ms) rồi chuẩn hoá về -14 dB. Đo: 3 giọng lên -14…-15 dB, lệch < 1 dB.
TARGET_RMS_DB = -14.0
PEAK_MAX = 0.89  # -1 dBFS


def compress(wav, rate, threshold_db=-32.0, ratio=4.0):
    win = max(1, int(0.015 * rate))
    power = np.convolve(wav * wav, np.ones(win) / win, mode='same')
    over = np.maximum(0.0, 10 * np.log10(power + 1e-10) - threshold_db)
    smooth = max(1, int(0.010 * rate))
    gain_db = np.convolve(-over * (1 - 1 / ratio), np.ones(smooth) / smooth, mode='same')
    return wav * (10 ** (gain_db / 20))


def normalize_loudness(wav, rate):
    if not len(wav) or float(np.sqrt(np.mean(np.square(wav)))) < 1e-5:
        return wav
    squeezed = compress(wav, rate)
    out = squeezed * (10 ** (TARGET_RMS_DB / 20) / float(np.sqrt(np.mean(np.square(squeezed)))))
    peak = float(np.max(np.abs(out)))
    return (out * (PEAK_MAX / peak) if peak > PEAK_MAX else out).astype(np.float32)


def trim_silence(wav, rate):
    level = np.abs(wav if wav.ndim == 1 else wav.mean(axis=1))
    loud = np.where(level > 0.01)[0]
    if not len(loud):
        return wav
    pad = int(0.05 * rate)
    return wav[max(0, loud[0] - pad):loud[-1] + pad]


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, code, body, kind):
        self.send_response(code)
        self.send_header('Content-Type', kind)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == '/health':
            return self.reply(200, json.dumps({'ok': True, 'voices': VOICES}).encode(), 'application/json')
        self.reply(404, b'not found', 'text/plain')

    def do_POST(self):
        if self.path != '/speak':
            return self.reply(404, b'not found', 'text/plain')
        length = int(self.headers.get('Content-Length') or 0)
        if length <= 0 or length > MAX_BODY:
            return self.reply(400, b'bad length', 'text/plain')
        try:
            body = json.loads(self.rfile.read(length))
            text = ' '.join(str(body.get('text', '')).split())[:MAX_CHARS]
            voice = body.get('voice') if body.get('voice') in VOICES else VOICES[0]
        except (ValueError, AttributeError):
            return self.reply(400, b'bad json', 'text/plain')
        if not text:
            return self.reply(400, b'empty', 'text/plain')
        try:
            with infer_lock:
                wav = model.infer(text, voice=voice)
            wav = normalize_loudness(trim_silence(np.asarray(wav, dtype=np.float32), model.sample_rate), model.sample_rate)
            out = io.BytesIO()
            sf.write(out, wav, model.sample_rate, format='WAV', subtype='PCM_16')
            self.reply(200, out.getvalue(), 'audio/wav')
        except Exception as error:  # câu lỗi không làm sập server — Node bỏ qua câu đó
            self.reply(500, str(error)[:200].encode('utf-8', 'replace'), 'text/plain')


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3945
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    print(f'vieneu-tts ready 127.0.0.1:{port}', flush=True)
    server.serve_forever()
