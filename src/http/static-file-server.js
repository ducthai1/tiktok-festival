// Phục vụ file tĩnh theo DANH SÁCH TRẮNG: chỉ thư mục public/ và đúng vài file three.js
// trong node_modules. Không có đường nào đọc được file ngoài các thư mục này.
import fs from 'node:fs/promises';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4', // video DJ của sàn nhảy (public/assets/dance/dj/)
  '.webm': 'video/webm',
  '.ico': 'image/x-icon'
};

const PAGES = { '/admin': 'admin/index.html', '/stage': 'stage/index.html' };

function resolveInside(root, relative) {
  if (relative.includes('\0')) return null;
  const full = path.resolve(root, relative);
  return full.startsWith(root + path.sep) ? full : null;
}

export function createStaticFileServer({ publicDir, rootDir }) {
  const threeBuild = path.join(rootDir, 'node_modules', 'three', 'build');
  const threeAddons = path.join(rootDir, 'node_modules', 'three', 'examples', 'jsm');
  const cache = new Map();

  // File addon của three viết `from 'three'`; trình duyệt không hiểu tên trần nên đổi thành
  // đường dẫn thật — nhờ vậy không cần <script type="importmap"> nội tuyến, CSP giữ 'self'.
  async function readAddon(file) {
    if (!cache.has(file)) {
      const text = await fs.readFile(file, 'utf8');
      cache.set(file, Buffer.from(text.replace(/from\s+(['"])three\1/g, "from '/vendor/three/three.module.js'")));
    }
    return cache.get(file);
  }

  function locate(urlPath) {
    if (PAGES[urlPath]) return { file: path.join(publicDir, PAGES[urlPath]) };
    const three = urlPath.match(/^\/vendor\/three\/(three\.module\.js|three\.core\.js)$/);
    if (three) return { file: path.join(threeBuild, three[1]) };
    const addon = urlPath.match(/^\/vendor\/three-addons\/((?:postprocessing|shaders)\/[A-Za-z0-9]+\.js)$/);
    if (addon) return { file: path.join(threeAddons, addon[1]), addon: true };
    if (urlPath.startsWith('/static/')) {
      const file = resolveInside(publicDir, urlPath.slice('/static/'.length));
      return file ? { file } : null;
    }
    return null;
  }

  return async function serve(urlPath) {
    let decoded;
    try {
      decoded = decodeURIComponent(urlPath);
    } catch {
      return null;
    }
    const target = locate(decoded);
    const type = target && TYPES[path.extname(target.file).toLowerCase()];
    if (!type) return null;
    try {
      const body = target.addon ? await readAddon(target.file) : await fs.readFile(target.file);
      return { body, type, isHtml: type.startsWith('text/html') };
    } catch {
      return null;
    }
  };
}
