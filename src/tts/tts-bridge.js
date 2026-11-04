// Giọng đọc tiếng Việt: Node tự bật tools/tts/vieneu-tts-server.py (VieNeu-TTS chạy ngay trên máy) bằng Python của môi trường
// riêng, rồi phục vụ màn hình qua GET /api/tts?text=&voice= (audio/wav). Lý do phải làm ở máy chủ: OBS trên Linux không có
// giọng tiếng Việt nào (speechSynthesis của trình duyệt câm). Không có môi trường → /api/tts trả 503, màn hình bỏ qua giọng đọc.
// Câu đã đọc lưu đệm ở data/tts-cache (cùng câu + cùng giọng không đọc lại); OBS + khung xem trước hỏi cùng câu thì gộp một lần.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRateLimiter, securityHeaders } from '../http/security.js';
import { isCleanForDisplay } from '../../public/shared/profanity-filter.js';

// giọng VieNeu dùng cho live (bỏ "Adam bựa" theo ý user) — danh sách chung với màn hình
import { TTS_VOICES } from '../../public/shared/tts-voices.js';

export { TTS_VOICES };
export const DEFAULT_TTS_PYTHON = path.join(os.homedir(), '.local/share/tiktok-live-games/tts-env/bin/python');
const SCRIPT = fileURLToPath(new URL('../../tools/tts/vieneu-tts-server.py', import.meta.url));
const MAX_CHARS = 200;
const CACHE_FILES = 400;
const CACHE_VERSION = 'v3'; // v3: giọng đã nén + cân âm lượng (-14 dB) — file đệm cũ (nhỏ hơn) không dùng lại

export function createTtsBridge({ dataDir, python = process.env.TTS_PYTHON || DEFAULT_TTS_PYTHON, port = 3945 } = {}) {
  const cacheDir = path.join(dataDir, 'tts-cache');
  const pending = new Map(); // khoá → Promise<Buffer|null>
  let child = null;
  let ready = false;
  let stopped = false;
  let restarts = 0;
  let shared = false; // đang dùng chung giọng đọc của một server game khác trên máy (cùng cổng)
  let probing = false;
  let queue = Promise.resolve(); // một câu một lúc (CPU)

  async function healthy() {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(800) });
      return res.ok && (await res.json()).ok === true;
    } catch {
      return false;
    }
  }

  // Đã có giọng đọc chạy sẵn ở cổng này (server game khác, vd server thử) → dùng chung, không bật bản thứ hai
  // (trùng cổng sẽ hỏng, và tốn thêm ~1,3 GB RAM). Không có thì tự bật.
  function start() {
    if (ready || child || stopped || probing || restarts >= 5 || !fs.existsSync(python)) return false; // hỏng 5 lần liền thì thôi
    probing = true;
    healthy().then((up) => {
      probing = false;
      if (stopped) return;
      if (up) {
        shared = true;
        ready = true;
        console.log(`[tts] dùng chung giọng đọc VieNeu đang chạy ở cổng ${port}`);
      } else spawnDaemon();
    });
    return true;
  }

  function spawnDaemon() {
    child = spawn(python, ['-I', SCRIPT, String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (chunk) => {
      if (!ready && String(chunk).includes('ready')) {
        ready = true;
        restarts = 0;
        console.log('[tts] giọng đọc VieNeu sẵn sàng');
      }
    });
    let lastError = '';
    child.stderr.on('data', (chunk) => { lastError = String(chunk).slice(-300); });
    child.on('exit', (code) => {
      child = null;
      ready = false;
      if (stopped) return;
      console.warn(`[tts] VieNeu tắt (mã ${code}) ${lastError.trim().split('\n').pop() || ''}`);
      if (restarts < 5) setTimeout(start, 3000 * (restarts += 1)); // start() dò lại: có bản chung thì dùng, không thì bật lại
    });
    return true;
  }

  async function prune() {
    const names = await fs.promises.readdir(cacheDir).catch(() => []);
    if (names.length <= CACHE_FILES) return;
    const stats = await Promise.all(names.map(async (n) => [n, (await fs.promises.stat(path.join(cacheDir, n))).mtimeMs]));
    stats.sort((a, b) => a[1] - b[1]);
    await Promise.all(stats.slice(0, names.length - CACHE_FILES).map(([n]) => fs.promises.unlink(path.join(cacheDir, n)).catch(() => {})));
  }

  async function synthesize(text, voice) {
    const res = await fetch(`http://127.0.0.1:${port}/speak`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice }), signal: AbortSignal.timeout(25000)
    });
    if (!res.ok) throw new Error(`VieNeu ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  /** Buffer wav của câu `text` bằng giọng `voice` (đệm đĩa), null nếu chưa có giọng đọc / câu lỗi. */
  function speak(text, voice) {
    const key = crypto.createHash('sha1').update(`${CACHE_VERSION}|${voice}|${text}`).digest('hex');
    if (pending.has(key)) return pending.get(key);
    const file = path.join(cacheDir, `${key}.wav`);
    const job = (async () => {
      const cached = await fs.promises.readFile(file).catch(() => null);
      if (cached) return cached;
      if (!ready) return null;
      const run = queue.then(() => synthesize(text, voice));
      queue = run.catch(() => {});
      const wav = await run;
      await fs.promises.mkdir(cacheDir, { recursive: true });
      await fs.promises.writeFile(file, wav);
      prune().catch(() => {});
      return wav;
    })().catch((error) => {
      console.warn('[tts]', error.message);
      if (shared) { // server giữ giọng đọc chung vừa tắt → lần sau tự bật bản riêng
        shared = false;
        ready = false;
      }
      return null;
    }).finally(() => pending.delete(key));
    pending.set(key, job);
    return job;
  }

  const limit = createRateLimiter(60, 60000);
  let autoStart = false;
  /** GET /api/tts?text=&voice= — chỉ chạy sau kiểm tra Host của server chính (chỉ máy này). */
  async function handle(req, res, serverPort) {
    const url = new URL(req.url, 'http://local');
    const text = String(url.searchParams.get('text') || '').replace(/\s+/g, ' ').trim();
    const voice = TTS_VOICES.includes(url.searchParams.get('voice')) ? url.searchParams.get('voice') : TTS_VOICES[0];
    const fail = (code, msg) => {
      res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...securityHeaders(serverPort) });
      res.end(msg);
    };
    if (!text || text.length > MAX_CHARS) return fail(400, 'Câu trống hoặc quá dài');
    // lớp chặn cuối: dù màn hình đã lọc, câu có từ tục tĩu / miệt thị / link / số điện thoại thì máy chủ không đọc
    if (!isCleanForDisplay(text)) return fail(400, 'Câu có từ ngữ không phù hợp');
    if (!limit()) return fail(429, 'Đọc dồn quá nhanh');
    if (autoStart) start(); // vừa cài môi trường xong (server đang chạy) → bật luôn, không phải khởi động lại server
    const wav = await speak(text, voice);
    if (!wav) return fail(503, !fs.existsSync(python) ? 'Chưa cài giọng đọc VieNeu — chạy: bash tools/tts/install-voice.sh'
      : ready ? 'Câu này đọc lỗi' : 'Đang nạp giọng đọc (~20 giây) — bấm lại sau');
    res.writeHead(200, { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store', ...securityHeaders(serverPort) });
    res.end(req.method === 'HEAD' ? undefined : wav);
  }

  return {
    /** Bật giọng đọc; chưa cài môi trường thì lần hỏi đọc sau cài xong sẽ tự bật. */
    start() {
      autoStart = true;
      return start();
    },
    handle,
    speak,
    status: () => ({ installed: fs.existsSync(python), ready }),
    stop() {
      stopped = true;
      child?.kill();
    }
  };
}
