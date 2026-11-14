// Cập nhật bảng quà TikTok vùng Việt Nam (tối đa 30 xu) từ chính API danh sách quà của TikTok (cái hộp quà người xem thấy)
// → ghi lại public/shared/tiktok-gifts-vn.js. Chạy trên máy ở Việt Nam: node scripts/update-vn-gifts.mjs [room_id]
// (room_id: phòng đang live — để lấy đúng hộp quà của phòng; bỏ trống thì lấy hộp quà chung của vùng).
// Rồi npm run gate (test báo nếu món đang gán cho tab Tiếng Anh không còn trong hộp quà) và xem git diff trước khi push.
// Vì sao không dùng trang liệt kê quà (streamtoearn): trang đó có cả quà ẩn / sự kiện / bị khoá — người xem không tìm thấy để tặng.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../public/shared/tiktok-gifts-vn.js', import.meta.url));
const roomId = process.argv[2] || '';
const url = `https://webcast.tiktok.com/webcast/gift/list/?aid=1988&app_language=vi-VN&browser_language=vi-VN${roomId ? `&room_id=${roomId}` : ''}`;
const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' } });
const data = (await res.json()).data;
if (!data?.gifts?.length) throw new Error('TikTok không trả danh sách quà — không ghi đè file.');
// vị trí trong hộp quà (trang "Gifts"): càng nhỏ càng dễ thấy
const pos = new Map();
for (const page of data.pages || []) (page.gifts || []).forEach((g, i) => { const id = g?.id ?? g; if (!pos.has(id)) pos.set(id, i + 1); });
const gifts = data.gifts
  .filter((g) => g.diamond_count >= 1 && g.diamond_count <= 30 && g.image?.url_list?.[0])
  .map((g) => ({
    id: String(g.id), name: g.name, coins: g.diamond_count, image: g.image.url_list[0],
    // panel: người xem nào cũng thấy trong hộp quà (không ẩn, không bị khoá)
    panel: Boolean(g.is_displayed_on_panel && !g.lock_info?.lock && pos.has(g.id)), pos: pos.get(g.id) || 0
  }))
  .sort((a, b) => (b.panel - a.panel) || (a.pos || 9999) - (b.pos || 9999) || a.coins - b.coins);
const day = new Date().toLocaleDateString('vi-VN');
const q = (s) => (s.includes("'") ? JSON.stringify(s) : `'${s}'`);
const body = gifts.map((g) => `  { id: '${g.id}', name: ${q(g.name)}, coins: ${g.coins}, panel: ${g.panel}, pos: ${g.pos}, image: '${g.image}' }`).join(',\n');
fs.writeFileSync(OUT, `// Quà TikTok vùng VIỆT NAM tối đa 30 xu — id, tên, GIÁ THẬT, ảnh thật, lấy từ API danh sách quà của TikTok (cập nhật ${day}${roomId ? `, phòng ${roomId}` : ''}).
// panel: món có trong hộp quà mà MỌI người xem đều thấy (không ẩn / không bị khoá); pos: vị trí trong hộp quà (nhỏ = dễ thấy).
// Hộp quà còn có quà gợi ý riêng cho từng tài khoản — món panel:false có thể hiện với người này mà không hiện với người khác.
// Cập nhật: node scripts/update-vn-gifts.mjs [room_id]
export const VN_GIFTS_UP_TO_30 = [
${body}
];
`);
console.log(`✓ ${gifts.length} món tối đa 30 xu (${gifts.filter((g) => g.panel).length} món ai cũng thấy trong hộp quà) → ${OUT}`);
