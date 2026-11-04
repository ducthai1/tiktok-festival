// Danh sách nhân vật sticker của sàn nhảy (ảnh trong public/assets/dance, xem CREDITS.txt ở đó).
// Mỗi nhân vật: crowd = nhảy tại chỗ, xung = nhảy bung khi camera cận, spot = solo dưới đèn rọi.
// weight = độ hay gặp; người xem cố định một nhân vật, gõ "đổi đồ" thì đổi sang nhân vật khác.
import { hashText } from './dance-sprite-material.js';

const trio = (crowd, base) => ({ crowd, xung: `${base}-xung-dai`, spot: `${base}-spotlight-dai` });

export const ROSTER = [
  { id: 'nv01', name: 'Đại Gia', weight: 6, ...trio('nv01-dai-gia-vung-tien', 'nv01-dai-gia') },
  { id: 'nv02', name: 'Idol', weight: 15, ...trio('nv02-idol-nhay', 'nv02-idol') },
  { id: 'nv03', name: 'DJ', weight: 11, ...trio('nv03-dj-headspin', 'nv03-dj') },
  { id: 'nv03b', name: 'DJ Scratch', weight: 5, ...trio('nv03-dj-scratch', 'nv03-dj') },
  { id: 'nv04', name: 'Dân Quẩy', weight: 16, ...trio('nv04-dan-quay-vinahouse', 'nv04-dan-quay') },
  { id: 'nv05', name: 'Mascot Vịt', weight: 13, ...trio('nv05-mascot-lac-mong', 'nv05-mascot') },
  { id: 'nv06', name: 'Tân Binh', weight: 19, ...trio('nv06-tan-binh-nhay', 'nv06-tan-binh') },
  { id: 'nv07', name: 'Kiếm Tiên', weight: 5, crowd: 'kiem-tien-1-thuong', xung: 'kiem-tien-2-xung-dai', spot: 'kiem-tien-3-spotlight-dai' },
  { id: 'nv08', name: 'Phượng Hoàng', weight: 5, crowd: 'phuong-hoang-1-thuong', xung: 'phuong-hoang-2-xung-dai', spot: 'phuong-hoang-3-spotlight-dai' },
  { id: 'nv09', name: 'Phục Vụ', weight: 3, crowd: 'nv09-phuc-vu-nhay' },
  { id: 'nv10', name: 'Bartender', weight: 3, crowd: 'nv10-bartender-nhay' },
  { id: 'nv11', name: 'Bê Rượu', weight: 3, crowd: 'nv11-be-ruou-nhay' },
  { id: 'nv12', name: 'Bảo Vệ', weight: 3, crowd: 'nv12-bao-ve-nhay' },
  { id: 'nv13', name: 'Đại Ca', weight: 8, ...trio('nv13-dai-ca-ba-dao', 'nv13-dai-ca') },
  { id: 'nv14', name: 'Siêu Hài', weight: 10, ...trio('nv14-sieu-hai-nhay-ga', 'nv14-sieu-hai') },
  { id: 'nv15', name: 'Nữ Vương', weight: 8, ...trio('nv15-nu-vuong-quat-lanh', 'nv15-nu-vuong') },
  // sticker meme "đầu nấm" (bỏ 1 con có chữ tục)
  ...['a', 'b', 'c', 'e', 'g', 'h', 'hanhan_video_dance', 'j', 'k', 'mushroom_dance_01', 'mushroom_dance_15', 'mushroom_magic_02']
    .map((k) => ({ id: `meme-${k}`, name: 'Meme', weight: 3, crowd: `cherry-${k}` }))
];

const TOTAL = ROSTER.reduce((sum, c) => sum + c.weight, 0);

/** Nhân vật của người xem (cố định theo id + số lần "đổi đồ"). */
export function characterFor(id, look) {
  let r = hashText(`${id}|${look}`) % TOTAL;
  for (const c of ROSTER) {
    r -= c.weight;
    if (r < 0) return c;
  }
  return ROSTER[0];
}

/** Ảnh dùng cho trạng thái: 'crowd' | 'xung' | 'spot' (thiếu thì lùi về bản thấp hơn). */
export function sheetFor(character, vis) {
  if (vis === 'spot') return character.spot || character.xung || character.crowd;
  if (vis === 'xung') return character.xung || character.crowd;
  return character.crowd;
}
