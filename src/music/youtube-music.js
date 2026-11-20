// Lấy nhạc nền từ một link YouTube: chủ kênh dán link ở tab 📺 Màn hình & âm thanh, server tải phần
// TIẾNG của video về data/music/custom.<đuôi> rồi màn hình phát luôn.
//
// Dùng yt-dlp trong một môi trường Python RIÊNG (không đụng môi trường giọng đọc tiếng Anh — YouTube đổi
// cách chặn thì chỉ phải nâng yt-dlp, giọng đọc không bị ảnh hưởng). Lần đầu dán link server tự cài,
// mất khoảng 20–40 giây; những lần sau là tải ngay.
//
// CỐ Ý KHÔNG chuyển mã: máy live không có ffmpeg, mà luồng tiếng sẵn có của YouTube (m4a / webm-opus)
// trình duyệt OBS phát thẳng được. Đỡ một phụ thuộc nặng và đỡ hàng chục giây chờ mỗi bài.
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_YT_ENV = path.join(os.homedir(), '.local/share/tiktok-live-games/yt-env');
export const REQUIREMENTS_YT = fileURLToPath(new URL('../../tools/music/requirements-yt.txt', import.meta.url));
const MARKER = 'tiktok-live-games-yt.json';
const CUTOFF = '2026-11-01'; // uv: bỏ qua mọi bản phát hành mới hơn ngày này
/** Khớp link YouTube thường, link rút gọn, Shorts và nhạc. CHỈ nhận YouTube — đây không phải máy tải dạo. */
const YT_HOST = /^(www\.|m\.|music\.)?(youtube\.com|youtu\.be)$/i;
export const MAX_MB = 80;

const envPython = (envDir) => path.join(envDir, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const requirementsHash = () => crypto.createHash('sha1').update(fs.readFileSync(REQUIREMENTS_YT)).digest('hex').slice(0, 12);

/** Link có phải YouTube không, và đã có mã video chưa. Trả về link đã làm sạch, hoặc '' nếu không hợp lệ. */
export function cleanYoutubeUrl(raw) {
  let u;
  try {
    u = new URL(String(raw || '').trim());
  } catch {
    return '';
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
  if (!YT_HOST.test(u.hostname)) return '';
  const id = u.hostname.toLowerCase().endsWith('youtu.be')
    ? u.pathname.slice(1).split('/')[0]
    : u.searchParams.get('v') || (u.pathname.match(/\/(shorts|embed|live)\/([\w-]{6,20})/) || [])[2] || '';
  if (!/^[\w-]{6,20}$/.test(id)) return '';
  return `https://www.youtube.com/watch?v=${id}`; // bỏ mọi tham số khác (danh sách phát, mốc thời gian, tracking)
}

export function youtubeToolInstalled(envDir = DEFAULT_YT_ENV) {
  try {
    const marker = JSON.parse(fs.readFileSync(path.join(envDir, MARKER), 'utf8'));
    return marker.requirements === requirementsHash() && fs.existsSync(envPython(envDir));
  } catch {
    return false;
  }
}

function run(cmd, args, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, PIP_DISABLE_PIP_VERSION_CHECK: '1' } },
      (error, stdout, stderr) => {
        if (!error) return resolve(String(stdout));
        const last = String(stderr || stdout || '').trim().split('\n').filter(Boolean).slice(-3).join(' · ');
        reject(new Error(last || error.message));
      });
  });
}

const onPath = (name) => String(process.env.PATH || '').split(path.delimiter)
  .map((dir) => dir && path.join(dir, name)).find((f) => f && fs.existsSync(f)) || '';

const findUv = () => [process.env.UV, onPath('uv'), path.join(os.homedir(), '.local/bin/uv'),
  '/opt/homebrew/bin/uv', '/usr/local/bin/uv'].find((f) => f && fs.existsSync(f)) || '';

async function findPython() {
  for (const name of ['python3.13', 'python3.12', 'python3.11', 'python3.10', 'python3']) {
    const file = onPath(name);
    if (!file) continue;
    // Mac chưa cài Command Line Tools: /usr/bin/python3 chỉ là vỏ, gọi vào sẽ bật hộp thoại cài đặt → bỏ qua
    if (process.platform === 'darwin' && file === '/usr/bin/python3' && !fs.existsSync('/Library/Developer/CommandLineTools/usr/bin/python3')) continue;
    const ok = await run(file, ['-c', 'import sys; print(sys.version_info >= (3, 9))'], 15000).catch(() => '');
    if (ok.trim() === 'True') return file;
  }
  return '';
}

/** Cài yt-dlp vào môi trường riêng. Trả về phiên bản. */
export async function setupYoutubeTool({ envDir = DEFAULT_YT_ENV, log = () => {} } = {}) {
  const python = envPython(envDir);
  const fresh = !fs.existsSync(envDir);
  await fs.promises.mkdir(path.dirname(envDir), { recursive: true });
  try {
    const uv = findUv();
    if (uv) {
      if (!fs.existsSync(python)) await run(uv, ['venv', '--python', '3.12', envDir]);
      log('đang cài yt-dlp…');
      await run(uv, ['pip', 'install', '--python', python, '--exclude-newer', CUTOFF, '-r', REQUIREMENTS_YT]);
    } else {
      const base = await findPython();
      if (!base) throw new Error('máy chưa có Python ≥ 3.9 lẫn uv — cài uv: curl -LsSf https://astral.sh/uv/install.sh | sh');
      if (!fs.existsSync(python)) {
        await run(base, ['-m', 'venv', envDir]).catch((error) => {
          throw new Error(`${error.message} — Ubuntu/Debian: sudo apt install python3-venv`);
        });
      }
      log('đang cài yt-dlp…');
      await run(python, ['-m', 'pip', 'install', '-q', '-r', REQUIREMENTS_YT]);
    }
    const version = (await run(python, ['-I', '-m', 'yt_dlp', '--version'], 60000)).trim();
    fs.writeFileSync(path.join(envDir, MARKER), JSON.stringify({ requirements: requirementsHash(), ytDlp: version, at: new Date().toISOString() }));
    return version;
  } catch (error) {
    if (fresh) await fs.promises.rm(envDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

/**
 * Tải phần tiếng của một video YouTube về `musicDir/custom.<đuôi>` (xoá file custom cũ trước).
 * @returns {Promise<{ file: string, ext: string, title: string, bytes: number }>}
 */
export async function fetchYoutubeAudio(rawUrl, musicDir, { envDir = DEFAULT_YT_ENV, log = () => {}, timeoutMs = 240000 } = {}) {
  const url = cleanYoutubeUrl(rawUrl);
  if (!url) throw new Error('Link không phải YouTube (hoặc thiếu mã video)');
  if (!youtubeToolInstalled(envDir)) {
    log('lần đầu — đang cài công cụ tải nhạc (20–40 giây)…');
    await setupYoutubeTool({ envDir, log });
  }
  fs.mkdirSync(musicDir, { recursive: true });
  // tải vào thư mục tạm rồi mới thay file đang dùng — tải hỏng giữa chừng thì nhạc cũ vẫn còn nguyên
  const tmp = fs.mkdtempSync(path.join(musicDir, '.tai-'));
  const titleFile = path.join(tmp, 'ten.txt');
  try {
    log('đang tải tiếng từ YouTube…');
    await run(envPython(envDir), ['-I', '-m', 'yt_dlp',
      '--no-playlist', '--no-warnings', '--no-progress',
      '-f', 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio',
      '--max-filesize', `${MAX_MB}M`,
      '--print-to-file', '%(title)s', titleFile,
      '--no-simulate',
      '-o', path.join(tmp, 'tai.%(ext)s'), url], timeoutMs);

    const got = fs.readdirSync(tmp).find((f) => f.startsWith('tai.'));
    if (!got) throw new Error(`không tải được phần tiếng (video có thể dài quá ${MAX_MB} MB, bị chặn hoặc ở chế độ riêng tư)`);
    const ext = (got.match(/\.[^.]+$/) || ['.m4a'])[0].toLowerCase();
    const bytes = fs.statSync(path.join(tmp, got)).size;
    let title = '';
    try {
      title = fs.readFileSync(titleFile, 'utf8').trim().split('\n')[0].slice(0, 120);
    } catch { /* không có tên thì thôi */ }

    for (const f of fs.readdirSync(musicDir)) if (/^custom\./i.test(f)) fs.unlinkSync(path.join(musicDir, f));
    const dest = path.join(musicDir, `custom${ext}`);
    fs.renameSync(path.join(tmp, got), dest);
    return { file: dest, ext, title: title || 'Nhạc từ YouTube', bytes };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
