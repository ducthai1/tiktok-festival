// Danh sách nhân vật sticker của sàn nhảy (ảnh trong public/assets/dance, xem CREDITS.txt ở đó).
// Chibi Việt có 3 bản: crowd = nhảy tại chỗ, xung = nhảy bung khi camera cận, spot = solo dưới đèn rọi.
// Meme (meme-*, cherry-*, bqb-*, ob-*) chỉ có bản crowd. Người xem giữ nhân vật theo Ô của mình; "đổi nv" đổi sang con khác.
export const DJ_CHARACTER = { id: 'dj', name: 'DJ', crowd: 'nv03-dj-scratch', xung: 'nv03-dj-scratch' };

const trio = (crowd, base) => ({ crowd, xung: `${base}-xung-dai`, spot: `${base}-spotlight-dai` });

export const ROSTER = [
  { id: 'nv01', name: 'Đại Gia', ...trio('nv01-dai-gia-vung-tien', 'nv01-dai-gia') },
  { id: 'nv02', name: 'Idol', ...trio('nv02-idol-nhay', 'nv02-idol') },
  { id: 'nv03', name: 'DJ', ...trio('nv03-dj-headspin', 'nv03-dj') },
  { id: 'nv03b', name: 'DJ Scratch', ...trio('nv03-dj-scratch', 'nv03-dj') },
  { id: 'nv04', name: 'Dân Quẩy', ...trio('nv04-dan-quay-vinahouse', 'nv04-dan-quay') },
  { id: 'nv05', name: 'Mascot Vịt', ...trio('nv05-mascot-lac-mong', 'nv05-mascot') },
  { id: 'nv06', name: 'Tân Binh', ...trio('nv06-tan-binh-nhay', 'nv06-tan-binh') },
  { id: 'nv07', name: 'Kiếm Tiên', crowd: 'kiem-tien-1-thuong', xung: 'kiem-tien-2-xung-dai', spot: 'kiem-tien-3-spotlight-dai' },
  { id: 'nv08', name: 'Phượng Hoàng', crowd: 'phuong-hoang-1-thuong', xung: 'phuong-hoang-2-xung-dai', spot: 'phuong-hoang-3-spotlight-dai' },
  { id: 'nv09', name: 'Phục Vụ', crowd: 'nv09-phuc-vu-nhay' },
  { id: 'nv10', name: 'Bartender', crowd: 'nv10-bartender-nhay' },
  { id: 'nv11', name: 'Bê Rượu', crowd: 'nv11-be-ruou-nhay' },
  { id: 'nv12', name: 'Bảo Vệ', crowd: 'nv12-bao-ve-nhay' },
  { id: 'nv13', name: 'Đại Ca', ...trio('nv13-dai-ca-ba-dao', 'nv13-dai-ca') },
  { id: 'nv14', name: 'Siêu Hài', ...trio('nv14-sieu-hai-nhay-ga', 'nv14-sieu-hai') },
  { id: 'nv15', name: 'Nữ Vương', ...trio('nv15-nu-vuong-quat-lanh', 'nv15-nu-vuong') }
];

// Kho nhân vật chia đều theo NHÓM. Trước đây mỗi ẢNH là một suất: riêng gấu trúc meme Trung Quốc (bqb-panda) có 171/342
// ảnh nên chiếm nửa sàn, cộng mặt cười huaji + nấm là ~3/4 — chủ kênh 21/11/2026: "nhân vật Trung Quốc đông quá, bị một
// màu, cứ ra mãi một nhân vật". Giờ MỖI NHÓM một suất như nhau (mỗi chibi Việt, mỗi sticker lẻ, cả nhóm gấu trúc, cả nhóm
// huaji, cả nhóm nấm); trong nhóm vẫn đổi ảnh theo Ô nên không ai giống hệt ai. Thêm ảnh vào sheets.json là có trong kho.
const MEME_PREFIXES = ['meme-', 'cherry-', 'bqb-', 'ob-'];
const familyOf = (key) => key.replace(/[-_]?\d+$/, '');

export function buildPool(sheets) {
  const chibi = ROSTER.filter((c) => sheets[c.crowd]);
  const families = new Map(); // nhóm → các ảnh
  for (const k of Object.keys(sheets)) {
    if (sheets[k].kind !== 'crowd' || !MEME_PREFIXES.some((pre) => k.startsWith(pre))) continue;
    const name = familyOf(k);
    if (!families.has(name)) families.set(name, []);
    families.get(name).push(k);
  }
  const single = [];
  const big = [];
  for (const [name, keys] of families) {
    if (keys.length === 1) single.push({ id: keys[0], name: 'Meme', crowd: keys[0] });
    else big.push({ id: name, name: 'Meme', crowd: keys[0], variants: keys });
  }
  return [...chibi, ...big, ...single];
}

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
/** Nhân vật theo Ô trên sàn: bước nhảy nguyên tố cùng nhau với cỡ kho → các ô xung quanh luôn là nhân vật khác nhau;
 *  "đổi nv" (look +1…) dịch sang nhân vật khác. Nhóm nhiều ảnh thì chọn ảnh trong nhóm theo Ô. */
export function characterForSlot(pool, slot, look) {
  const stride = [37, 41, 43, 47, 53, 59, 61].find((q) => gcd(q, pool.length) === 1) || 1;
  const i = (((Math.max(0, slot) * stride + (look || 0) * 11) % pool.length) + pool.length) % pool.length;
  const c = pool[i];
  if (!c.variants) return c;
  const n = c.variants.length;
  const key = c.variants[(((Math.max(0, slot) * 31 + (look || 0) * 7) % n) + n) % n];
  return { id: key, family: c.id, name: c.name, crowd: key };
}

/** Ảnh dùng cho trạng thái: 'crowd' | 'xung' | 'spot' (thiếu thì lùi về bản thấp hơn). */
export function sheetFor(character, vis) {
  if (vis === 'spot') return character.spot || character.xung || character.crowd;
  if (vis === 'xung') return character.xung || character.crowd;
  return character.crowd;
}
