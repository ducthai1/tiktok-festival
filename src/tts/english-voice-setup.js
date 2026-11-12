// Cài môi trường Python RIÊNG cho giọng đọc tiếng Anh (gói edge-tts, ghim phiên bản ở tools/tts/requirements-en.txt).
// Mac và Linux như nhau: có `uv` thì dùng uv (tự tải Python 3.12 nếu máy chưa có), không thì python3 -m venv + pip.
// Cài xong ghi dấu (kèm mã của requirements-en.txt) — file đó đổi (nâng edge-tts) thì server tự cài lại ở lần chạy sau.
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_EN_ENV = path.join(os.homedir(), '.local/share/tiktok-live-games/tts-en-env');
export const REQUIREMENTS_EN = fileURLToPath(new URL('../../tools/tts/requirements-en.txt', import.meta.url));
const MARKER = 'tiktok-live-games.json';
const CUTOFF = '2026-11-01'; // uv: bỏ qua mọi bản phát hành mới hơn ngày này

export const envPython = (envDir) => path.join(envDir, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');

const requirementsHash = () => crypto.createHash('sha1').update(fs.readFileSync(REQUIREMENTS_EN)).digest('hex').slice(0, 12);

/** Đã cài đúng bản đang ghim chưa (dấu cài đặt khớp requirements-en.txt hiện tại). */
export function englishVoiceInstalled(envDir = DEFAULT_EN_ENV) {
  try {
    const marker = JSON.parse(fs.readFileSync(path.join(envDir, MARKER), 'utf8'));
    return marker.requirements === requirementsHash() && fs.existsSync(envPython(envDir));
  } catch {
    return false;
  }
}

function run(cmd, args, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, PIP_DISABLE_PIP_VERSION_CHECK: '1' } },
      (error, stdout, stderr) => {
        if (!error) return resolve(String(stdout));
        const last = String(stderr || stdout || '').trim().split('\n').filter(Boolean).slice(-3).join(' · ');
        reject(new Error(`${path.basename(cmd)} ${args[0]}: ${last || error.message}`));
      });
  });
}

function onPath(name) {
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
    const file = path.join(dir, name);
    if (dir && fs.existsSync(file)) return file;
  }
  return '';
}

function findUv() {
  const home = os.homedir();
  return [process.env.UV, onPath('uv'), path.join(home, '.local/bin/uv'), path.join(home, '.cargo/bin/uv'), '/opt/homebrew/bin/uv', '/usr/local/bin/uv']
    .find((f) => f && fs.existsSync(f)) || '';
}

async function findPython() {
  for (const name of ['python3.13', 'python3.12', 'python3.11', 'python3.10', 'python3']) {
    const file = onPath(name);
    if (!file) continue;
    // Mac chưa cài Command Line Tools: /usr/bin/python3 chỉ là vỏ, gọi vào sẽ bật hộp thoại cài đặt → bỏ qua
    if (process.platform === 'darwin' && file === '/usr/bin/python3' && !fs.existsSync('/Library/Developer/CommandLineTools/usr/bin/python3')) continue;
    const ok = await run(file, ['-c', 'import sys; print(sys.version_info >= (3, 10))'], 15000).catch(() => '');
    if (ok.trim() === 'True') return file;
  }
  return '';
}

/** Tạo môi trường + cài edge-tts. Trả về phiên bản edge-tts. Lỗi → ném lỗi kèm cách sửa. */
export async function setupEnglishVoice({ envDir = DEFAULT_EN_ENV, log = () => {} } = {}) {
  const python = envPython(envDir);
  const fresh = !fs.existsSync(envDir);
  await fs.promises.mkdir(path.dirname(envDir), { recursive: true });
  try {
    const uv = findUv();
    if (uv) {
      if (!fs.existsSync(python)) {
        log(`tạo môi trường Python 3.12 bằng uv: ${envDir}`);
        await run(uv, ['venv', '--python', '3.12', envDir]);
      }
      log('cài edge-tts (bản ghim trong tools/tts/requirements-en.txt)…');
      await run(uv, ['pip', 'install', '--python', python, '--exclude-newer', CUTOFF, '-r', REQUIREMENTS_EN]);
    } else {
      const base = await findPython();
      if (!base) {
        throw new Error('máy chưa có Python ≥ 3.10 lẫn uv — cài uv: curl -LsSf https://astral.sh/uv/install.sh | sh  (Mac: brew install uv)');
      }
      if (!fs.existsSync(python)) {
        log(`tạo môi trường bằng ${base}: ${envDir}`);
        await run(base, ['-m', 'venv', envDir]).catch((error) => {
          throw new Error(`${error.message} — Ubuntu/Debian: sudo apt install python3-venv  (hoặc cài uv)`);
        });
      }
      log('cài edge-tts bằng pip (bản ghim trong tools/tts/requirements-en.txt)…');
      await run(python, ['-m', 'pip', 'install', '-q', '-r', REQUIREMENTS_EN]);
    }
    const version = (await run(python, ['-I', '-c', 'import edge_tts; print(edge_tts.__version__)'], 30000)).trim();
    fs.writeFileSync(path.join(envDir, MARKER), JSON.stringify({ requirements: requirementsHash(), edgeTts: version, at: new Date().toISOString() }));
    return version;
  } catch (error) {
    // môi trường vừa tạo dở lần này thì xoá đi (lần sau tạo lại sạch); môi trường có sẵn từ trước thì để nguyên
    if (fresh) await fs.promises.rm(envDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}
