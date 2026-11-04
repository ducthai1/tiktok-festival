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
            wav = trim_silence(np.asarray(wav, dtype=np.float32), model.sample_rate)
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
