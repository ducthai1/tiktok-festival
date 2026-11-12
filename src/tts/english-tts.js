// Đọc ĐÁP ÁN TIẾNG ANH bằng giọng bản xứ — 8 giọng neural Mỹ / Anh / Úc (nam + nữ xoay tua) của Microsoft Edge "Đọc to",
// gọi qua gói Python edge-tts trong môi trường riêng (english-voice-setup.js; server tự cài lần đầu, Mac và Linux như nhau).
// Vì sao không gọi thẳng bằng Node: Microsoft đổi cách ký yêu cầu liên tục (11/2026 đổi sang token "v2", bản tự viết bị 403) —
// dùng gói edge-tts thì khi họ đổi chỉ cần nâng phiên bản trong tools/tts/requirements-en.txt, không phải sửa code.
// - Câu hỏi vừa ra → tạo SẴN bản đọc thường + đọc chậm trong lúc người chơi trả lời; lật đáp án là phát ngay.
// - Lưu đệm mp3 ở data/tts-cache-en (từ đã đọc không gọi mạng lại). Cần mạng; mất mạng / bị chặn → /api/tts-en trả 503,
//   màn hình bỏ qua (game chạy bình thường), log [tts-en] ghi rõ lý do + cách sửa.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRateLimiter, securityHeaders } from '../http/security.js';
import { isCleanForDisplay } from '../../public/shared/profanity-filter.js';
import { DEFAULT_EN_ENV, englishVoiceInstalled, envPython, setupEnglishVoice } from './english-voice-setup.js';

export const EN_VOICES = [
  { id: 'en-US-AriaNeural', label: 'Aria (Mỹ, nữ)', female: true },
  { id: 'en-US-GuyNeural', label: 'Guy (Mỹ, nam)', female: false },
  { id: 'en-US-JennyNeural', label: 'Jenny (Mỹ, nữ)', female: true },
  { id: 'en-US-ChristopherNeural', label: 'Christopher (Mỹ, nam)', female: false },
  { id: 'en-GB-SoniaNeural', label: 'Sonia (Anh, nữ)', female: true },
  { id: 'en-GB-RyanNeural', label: 'Ryan (Anh, nam)', female: false },
  { id: 'en-AU-NatashaNeural', label: 'Natasha (Úc, nữ)', female: true },
  { id: 'en-AU-WilliamNeural', label: 'William (Úc, nam)', female: false }
];
const VOICE_IDS = EN_VOICES.map((v) => v.id);
const RATE = { normal: '+0%', slow: '-35%' };
const MAX_CHARS = 60;
const TEXT_OK = /^[A-Za-z0-9][A-Za-z0-9 '&.-]*$/; // đáp án trong kho: chữ cái, số, dấu cách, gạch nối, R&B
const CACHE_VERSION = 'en1';
const CACHE_FILES = 1500; // ~10 KB / file
const PAUSE_AFTER = 3; // lỗi liền 3 lần → nghỉ gọi mạng một lúc (không dồn tiến trình khi Microsoft chặn / mất mạng)
const PAUSE_MS = 60000;

// Chữ viết tắt đọc từng chữ cái; còn lại đổi chữ thường (kho viết HOA — giọng đọc sẽ đánh vần "APPLE" thành a-p-p-l-e).
const ACRONYMS = new Set(['AI', 'API', 'AR', 'CCTV', 'CDN', 'CEO', 'CPU', 'CT', 'CV', 'DJ', 'DNA', 'EDM', 'EV', 'GPA', 'GPS', 'GPU', 'HD', 'HQ',
  'HR', 'ICU', 'ID', 'IP', 'IV', 'JD', 'KOL', 'MRI', 'MSG', 'MV', 'MVP', 'OS', 'OTC', 'OTP', 'PC', 'PE', 'PT', 'QR', 'RAM', 'SLA', 'SMS',
  'SSD', 'TB', 'TV', 'UFO', 'UI', 'UPS', 'URL', 'USB', 'UV', 'VAR', 'VIP', 'VR', 'WFH']);
const NEGATIVE = new Set(['DON', 'CAN', 'WON', 'DIDN', 'DOESN', 'ISN', 'AREN', 'WASN', 'WEREN', 'COULDN', 'SHOULDN', 'WOULDN', 'HAVEN', 'HASN']);

/** Đáp án trong kho → câu cho giọng đọc: "DON T HOLD YOUR BREATH" → "don't hold your breath", "STUDENT ID" → "student ID". */
export function speakableEnglish(answer) {
  const words = String(answer).trim().toUpperCase().split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    const prev = words[i - 1];
    // kho bỏ dấu nháy: ghép lại cho đọc đúng (don't, someone's, you're, Ballon d'Or)
    if (prev && ((w === 'T' && NEGATIVE.has(prev)) || w === 'S' || (w === 'RE' && /^(YOU|WE|THEY)$/.test(prev)) || w === 'LL' || w === 'VE'
      || (w === 'M' && prev === 'I'))) {
      out[out.length - 1] += `'${w.toLowerCase()}`;
      continue;
    }
    if (w === 'D' && words[i + 1] === 'OR') {
      out.push("d'Or");
      i += 1;
      continue;
    }
    out.push(ACRONYMS.has(w) || /[0-9&]/.test(w) ? w : w.toLowerCase());
  }
  return out.join(' ');
}

/** Xoay tua giọng: nam ↔ nữ luân phiên, chọn ngẫu nhiên giọng không trùng 3 từ gần nhất. */
export function createVoiceRotation(random = Math.random) {
  const recent = [];
  return () => {
    const last = EN_VOICES.find((v) => v.id === recent.at(-1));
    let pool = EN_VOICES.filter((v) => !recent.includes(v.id) && (!last || v.female !== last.female));
    if (!pool.length) pool = EN_VOICES.filter((v) => v !== last);
    const voice = pool[Math.floor(random() * pool.length)];
    recent.push(voice.id);
    if (recent.length > 3) recent.shift();
    return voice.id;
  };
}

const lastLine = (s) => String(s).trim().split('\n').filter(Boolean).pop() || '';

/** python -I -m edge_tts … → ghi mp3 vào `file`. */
function runEdgeTts(python, { text, voice, rate, file, timeoutMs = 20000 }) {
  return new Promise((resolve, reject) => {
    const child = spawn(python, ['-I', '-m', 'edge_tts', '--voice', voice, `--rate=${rate}`, '--text', text, '--write-media', file],
      { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-3000); });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`edge-tts quá ${timeoutMs / 1000} giây không xong`));
    }, timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(lastLine(stderr) || `edge-tts thoát mã ${code}`));
    });
  });
}

/** Lỗi edge-tts → câu dễ hiểu + cách sửa (in vào log). */
function explain(message) {
  if (/403|Forbidden|Sec-MS-GEC|Invalid response status/i.test(message)) {
    return 'Microsoft từ chối (có thể vừa đổi cách ký) → nâng edge-tts trong tools/tts/requirements-en.txt lên bản mới rồi khởi động lại';
  }
  if (/No module named|ENOENT/i.test(message)) return 'chưa cài giọng tiếng Anh → chạy: npm run setup-tts-en';
  if (/Cannot connect|getaddrinfo|Network|timed out|quá .* giây|ClientConnector|Connection reset/i.test(message)) return 'mất mạng / mạng chậm';
  return '';
}

export function createEnglishTts({
  dataDir, envDir = process.env.TTS_EN_ENV || DEFAULT_EN_ENV, python = process.env.TTS_EN_PYTHON || '',
  synthesize = null, setup = setupEnglishVoice, random = Math.random, now = Date.now
} = {}) {
  const cacheDir = path.join(dataDir, 'tts-cache-en');
  const pythonBin = python || envPython(envDir);
  const run = synthesize || ((job) => runEdgeTts(pythonBin, job));
  const nextVoice = createVoiceRotation(random);
  const voiceOf = new Map(); // từ → giọng chọn lúc ra đề (màn OBS + khung xem trước + bản chậm cùng một giọng)
  const pending = new Map(); // khoá → Promise<Buffer|null>
  let queue = Promise.resolve(); // một tiến trình edge-tts một lúc
  let ready = Boolean(synthesize || python);
  let setupState = ready ? 'done' : 'idle'; // idle | running | done | failed
  let setupError = '';
  let failures = 0;
  let pausedUntil = 0;
  let worked = false;

  const installed = () => ready || (ready = englishVoiceInstalled(envDir));

  function voiceFor(text) {
    const key = text.toLowerCase();
    if (!voiceOf.has(key)) {
      voiceOf.set(key, nextVoice());
      if (voiceOf.size > 200) voiceOf.delete(voiceOf.keys().next().value);
    }
    return voiceOf.get(key);
  }

  async function prune() {
    const names = await fs.promises.readdir(cacheDir).catch(() => []);
    if (names.length <= CACHE_FILES) return;
    const stats = await Promise.all(names.map(async (n) => [n, (await fs.promises.stat(path.join(cacheDir, n)).catch(() => ({ mtimeMs: 0 }))).mtimeMs]));
    stats.sort((a, b) => a[1] - b[1]);
    await Promise.all(stats.slice(0, names.length - CACHE_FILES).map(([n]) => fs.promises.unlink(path.join(cacheDir, n)).catch(() => {})));
  }

  function failed(error, text) {
    failures += 1;
    const hint = explain(error.message);
    if (failures >= PAUSE_AFTER) pausedUntil = now() + PAUSE_MS;
    // lỗi đầu tiên + mỗi lần bắt đầu nghỉ mới ghi log (không xả log khi mất mạng lâu)
    if (failures === 1 || failures % PAUSE_AFTER === 0) {
      console.warn(`[tts-en] không đọc được "${text}": ${error.message}${hint ? ` — ${hint}` : ''}`
        + `${failures >= PAUSE_AFTER ? ` (lỗi ${failures} lần liền, nghỉ ${PAUSE_MS / 1000} giây rồi thử lại)` : ''}`);
    }
  }

  function succeeded(text, voice, ms) {
    if (failures) console.log(`[tts-en] đọc lại được sau ${failures} lần lỗi`);
    else if (!worked) console.log(`[tts-en] giọng tiếng Anh hoạt động: "${text}" (${voice}, ${ms} ms)`);
    worked = true;
    failures = 0;
    pausedUntil = 0;
  }

  /** mp3 của đáp án (đệm đĩa). null nếu chưa cài / lỗi mạng / đang nghỉ sau lỗi. */
  function clip(answer, { slow = false, voice = '' } = {}) {
    const text = speakableEnglish(answer);
    if (!text || text.length > MAX_CHARS || !TEXT_OK.test(text)) return Promise.resolve(null);
    const chosen = VOICE_IDS.includes(voice) ? voice : voiceFor(text);
    const rate = slow ? RATE.slow : RATE.normal;
    const key = crypto.createHash('sha1').update(`${CACHE_VERSION}|${chosen}|${rate}|${text}`).digest('hex');
    if (pending.has(key)) return pending.get(key);
    const file = path.join(cacheDir, `${key}.mp3`);
    const tmp = `${file}.${process.pid}.tmp`;
    const job = (async () => {
      const cached = await fs.promises.readFile(file).catch(() => null);
      if (cached?.length) return cached;
      if (!installed() || now() < pausedUntil) return null;
      await fs.promises.mkdir(cacheDir, { recursive: true });
      const started = now();
      const task = queue.then(() => run({ text, voice: chosen, rate, file: tmp }));
      queue = task.catch(() => {});
      await task;
      const mp3 = await fs.promises.readFile(tmp);
      if (mp3.length < 500) throw new Error('edge-tts trả về file rỗng');
      await fs.promises.rename(tmp, file);
      succeeded(text, chosen, now() - started);
      prune().catch(() => {});
      return mp3;
    })().catch((error) => {
      fs.promises.unlink(tmp).catch(() => {});
      failed(error, text);
      return null;
    }).finally(() => pending.delete(key));
    pending.set(key, job);
    return job;
  }

  /** Cài môi trường lần đầu (chạy nền, không chặn server). */
  function start() {
    if (installed() || setupState === 'running') return;
    setupState = 'running';
    const t0 = now();
    console.log('[tts-en] chưa có giọng đọc tiếng Anh → đang tự cài edge-tts (chạy nền, ~30 giây)…');
    setup({ envDir, log: (line) => console.log(`[tts-en] ${line}`) }).then((version) => {
      setupState = 'done';
      ready = true;
      console.log(`[tts-en] cài xong edge-tts ${version} (${Math.round((now() - t0) / 1000)} giây)`);
      clip('hello'); // thử một từ: báo luôn trong log là mạng / Microsoft có cho đọc không
    }, (error) => {
      setupState = 'failed';
      setupError = error.message;
      console.warn(`[tts-en] cài giọng tiếng Anh thất bại: ${error.message} — chạy tay: npm run setup-tts-en`);
    });
  }

  function statusText() {
    if (setupState === 'running') return 'Đang cài giọng tiếng Anh lần đầu (~30 giây) — thử lại sau';
    if (!installed()) return `Chưa cài giọng tiếng Anh — chạy: npm run setup-tts-en${setupError ? ` (${setupError})` : ''}`;
    if (now() < pausedUntil) return 'Giọng tiếng Anh đang lỗi (mạng / Microsoft) — tự thử lại sau 1 phút, xem log [tts-en]';
    return 'Từ này đọc lỗi — xem log [tts-en]';
  }

  const limit = createRateLimiter(90, 60000);
  /** GET /api/tts-en?text=&slow=1&voice=(tên giọng | random) → audio/mpeg. Chỉ chạy sau kiểm tra Host của server chính (chỉ máy này). */
  async function handle(req, res, serverPort) {
    const url = new URL(req.url, 'http://local');
    const raw = String(url.searchParams.get('text') || '').replace(/\s+/g, ' ').trim();
    const fail = (code, msg) => {
      res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...securityHeaders(serverPort) });
      res.end(msg);
    };
    if (!raw || raw.length > MAX_CHARS || !TEXT_OK.test(raw)) return fail(400, 'Chỉ đọc từ tiếng Anh (chữ cái, tối đa 60 ký tự)');
    if (!isCleanForDisplay(raw)) return fail(400, 'Từ có nội dung không phù hợp');
    if (!limit()) return fail(429, 'Đọc dồn quá nhanh');
    const asked = url.searchParams.get('voice') || '';
    // voice=random (nút nghe thử): giọng kế tiếp trong vòng xoay; không ghi gì: giọng đã chọn cho từ này lúc ra đề
    const voice = VOICE_IDS.includes(asked) ? asked : asked === 'random' ? nextVoice() : voiceFor(speakableEnglish(raw));
    const mp3 = await clip(raw, { slow: url.searchParams.get('slow') === '1', voice });
    if (!mp3) return fail(503, statusText());
    res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store', 'X-Voice': voice, ...securityHeaders(serverPort) });
    res.end(req.method === 'HEAD' ? undefined : mp3);
  }

  return {
    start,
    clip,
    handle,
    /** Câu hỏi vừa ra: tạo sẵn bản thường + bản chậm của đáp án (chưa gửi gì ra màn hình — không lộ đáp án). */
    prefetch(answer) {
      if (!answer || !installed()) return;
      clip(answer).then(() => clip(answer, { slow: true }));
    },
    voiceFor: (answer) => voiceFor(speakableEnglish(answer)),
    status: () => ({ installed: installed(), setup: setupState, failures, paused: now() < pausedUntil })
  };
}
