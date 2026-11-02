// Kiểm tra đầu vào và chặn truy cập trái phép cho server chạy trên máy streamer.
// Cách kiểm Host/Origin và giới hạn tần suất học từ cherry9001/tiktok-live-bar (MIT),
// thêm: lọc ký tự đảo chiều/vô hình, whitelist ảnh TikTok, so token chống đo thời gian.
import crypto from 'node:crypto';

// Ký tự điều khiển, ký tự đảo hướng chữ (dùng để giả mạo tên) và ký tự rộng 0.
// Giữ lại U+200D (ZWJ) vì emoji ghép như 👨‍👩‍👧 cần nó.
const UNSAFE_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b\u200c\u200e\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g;

export function cleanText(value, maxLength) {
  return Array.from(String(value ?? '').replace(UNSAFE_CHARS, ' ').replace(/\s+/g, ' ').trim())
    .slice(0, maxLength)
    .join('');
}

export function clampInt(value, min, max, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(Math.min(max, Math.max(min, n)));
}

// Ảnh đại diện/ảnh quà chỉ được tải từ CDN của TikTok; mọi link khác bị bỏ để
// trang OBS không gọi ra máy chủ lạ (lộ IP, ảnh bẩn).
const IMAGE_HOSTS = /(^|\.)(tiktokcdn\.com|tiktokcdn-us\.com|tiktokcdn-eu\.com|ibyteimg\.com|byteimg\.com)$/i;
export const IMAGE_CSP_SOURCES = [
  'https://*.tiktokcdn.com', 'https://*.tiktokcdn-us.com', 'https://*.tiktokcdn-eu.com',
  'https://*.ibyteimg.com', 'https://*.byteimg.com'
];

export function safeImageUrl(value) {
  const text = String(value ?? '').trim();
  if (!text || text.length > 2048) return '';
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    return IMAGE_HOSTS.test(url.hostname) ? url.toString() : '';
  } catch {
    return '';
  }
}

export function isLoopbackAddress(value) {
  const address = String(value || '').toLowerCase().replace(/^::ffff:/, '');
  return address === '127.0.0.1' || address === '::1';
}

// Chặn DNS rebinding: trang web lạ trỏ tên miền của nó về 127.0.0.1 sẽ mang Host khác.
export function isAllowedHost(hostHeader, port, allowLan = false) {
  const host = String(hostHeader || '').trim().toLowerCase();
  if (!host || host.length > 255 || /[\s\\/@]/.test(host)) return false;
  if (allowLan) return true;
  return [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`].includes(host);
}

// Trình duyệt luôn gửi Origin khi mở WebSocket; trang khác cổng/khác máy bị từ chối.
export function isAllowedOrigin(originHeader, hostHeader, port, allowLan = false) {
  if (!originHeader) return false;
  try {
    const origin = new URL(String(originHeader));
    if (origin.protocol !== 'http:') return false;
    if (allowLan) return origin.host.toLowerCase() === String(hostHeader || '').toLowerCase();
    const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname.toLowerCase());
    return loopback && origin.port === String(port);
  } catch {
    return false;
  }
}

export function tokensEqual(expected, provided) {
  const a = Buffer.from(String(expected ?? ''));
  const b = Buffer.from(String(provided ?? ''));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createRateLimiter(maximum, windowMs) {
  let windowStart = 0;
  let count = 0;
  return (now = Date.now()) => {
    if (now - windowStart >= windowMs) {
      windowStart = now;
      count = 0;
    }
    count += 1;
    return count <= maximum;
  };
}

export function securityHeaders(port, { framePreview = false } = {}) {
  const csp = [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "form-action 'self'",
    framePreview ? "frame-ancestors 'self'" : "frame-ancestors 'none'",
    "script-src 'self'",
    "style-src 'self'",
    `img-src 'self' data: blob: ${IMAGE_CSP_SOURCES.join(' ')}`,
    "media-src 'self' blob:",
    "font-src 'self'",
    `connect-src 'self' ws://127.0.0.1:${port} ws://localhost:${port}`,
    "frame-src 'self'"
  ].join('; ');
  return {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': framePreview ? 'SAMEORIGIN' : 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Cross-Origin-Opener-Policy': 'same-origin'
  };
}
