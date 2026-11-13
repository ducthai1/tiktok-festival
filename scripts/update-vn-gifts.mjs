// Cập nhật bảng giá quà TikTok vùng Việt Nam (dưới 20 xu) từ https://streamtoearn.io/gifts?region=VN
// → ghi lại public/shared/tiktok-gifts-vn.js. Chạy: node scripts/update-vn-gifts.mjs   rồi npm run gate (test báo nếu món
// đang gán cho tab Tiếng Anh biến mất / trùng tên) và xem git diff giá trước khi push.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const URL_VN = 'https://streamtoearn.io/gifts?region=VN';
const OUT = fileURLToPath(new URL('../public/shared/tiktok-gifts-vn.js', import.meta.url));
const html = await (await fetch(URL_VN, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
const unescape = (s) => s.replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
const gifts = [...html.matchAll(/<div class="gift"[^>]*>\s*<img\s+src="([^"]+)"[\s\S]*?<p class="gift-name">([^<]*)<\/p>\s*<p class="gift-price">\s*([\d,.]+)/g)]
  .map(([, image, name, price]) => ({ name: unescape(name), coins: Number(price.replace(/[,.]/g, '')), image }))
  .filter((g) => g.coins >= 1 && g.coins < 20 && /^https:\/\/p\d+-webcast\.tiktokcdn\.com\//.test(g.image));
if (gifts.length < 30) throw new Error(`Chỉ đọc được ${gifts.length} món — trang đổi giao diện? Không ghi đè file.`);
const day = new Date().toLocaleDateString('vi-VN');
const body = gifts.map((g) => `  { name: ${JSON.stringify(g.name).replace(/^"([^'"]*)"$/, "'$1'")}, coins: ${g.coins}, image: '${g.image}' }`).join(',\n');
fs.writeFileSync(OUT, `// Quà TikTok vùng VIỆT NAM dưới 20 xu — tên, GIÁ THẬT, ảnh thật. Nguồn: ${URL_VN} (cập nhật ${day}).
// Dùng cho tab Tiếng Anh: bảng đổi bộ đề chỉ được ghi đúng giá ở đây (hoặc giá TikTok báo khi phòng nhận được món đó).
// TikTok đổi giá / thêm quà → chạy lại: node scripts/update-vn-gifts.mjs (tải trang trên, ghi lại file này).
export const VN_GIFTS_UNDER_20 = [
${body}
];
`);
console.log(`✓ ${gifts.length} món dưới 20 xu → ${OUT}`);
