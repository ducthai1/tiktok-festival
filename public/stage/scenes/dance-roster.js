// Danh sách nhân vật sticker của sàn nhảy (ảnh trong public/assets/dance, xem CREDITS.txt ở đó).
// Mỗi nhân vật: crowd = nhảy tại chỗ, xung = nhảy bung khi camera cận, spot = solo dưới đèn rọi.
// weight = độ hay gặp; người xem cố định một nhân vật, gõ "đổi đồ" thì đổi sang nhân vật khác.
import { hashText } from './dance-sprite-material.js';

const MEME_KEYS = ['hanhan_video_dance', ...[1, 2, 3, 5, 6, 8, 9, 12, 13, 14, 15, 16, 17, 18, 19, 42, 46, 48, 50, 53, 55, 57, 58, 59, 60, 61, 62, 65, 67, 68]
  .map((n) => `mushroom_dance_${String(n).padStart(2, '0')}`), ...[2, 5, 6, 7, 8, 9, 10, 14, 16, 18, 19, 20, 21].map((n) => `mushroom_magic_${String(n).padStart(2, '0')}`)]
  .map((k) => `meme-${k}`);
const OB_KEYS = ['boy-pho-quay', 'cereal-beer', 'cereal-guy', 'challenged-freddie', 'danchoi-vest', 'daunam-default', 'daunam-glasses',
  'happy-all-the-things', 'happy-awwyeah', 'happy-biggrin', 'happy-crying', 'happy-epic-smiley', 'happy-smile', 'happy-whistling',
  'happy-youre-the-man', 'horror-shocked', 'laughing-lol', 'laughing-yao', 'laughing-yao-pff', 'meme-guitar-rocker', 'meme-mua-quat',
  'meme-yaoming-afro', 'tieu-thu', 'troll-excited', 'troll-lol', 'troll-original'].map((k) => `ob-${k}`);
export const DJ_CHARACTER = { id: 'dj', name: 'DJ', weight: 0, crowd: 'nv03-dj-scratch', xung: 'nv03-dj-scratch' };

const trio = (crowd, base) => ({ crowd, xung: `${base}-xung-dai`, spot: `${base}-spotlight-dai` });

export const ROSTER = [
  { id: 'nv01', name: 'Đại Gia', weight: 12, ...trio('nv01-dai-gia-vung-tien', 'nv01-dai-gia') },
  { id: 'nv02', name: 'Idol', weight: 30, ...trio('nv02-idol-nhay', 'nv02-idol') },
  { id: 'nv03', name: 'DJ', weight: 22, ...trio('nv03-dj-headspin', 'nv03-dj') },
  { id: 'nv03b', name: 'DJ Scratch', weight: 10, ...trio('nv03-dj-scratch', 'nv03-dj') },
  { id: 'nv04', name: 'Dân Quẩy', weight: 32, ...trio('nv04-dan-quay-vinahouse', 'nv04-dan-quay') },
  { id: 'nv05', name: 'Mascot Vịt', weight: 26, ...trio('nv05-mascot-lac-mong', 'nv05-mascot') },
  { id: 'nv06', name: 'Tân Binh', weight: 38, ...trio('nv06-tan-binh-nhay', 'nv06-tan-binh') },
  { id: 'nv07', name: 'Kiếm Tiên', weight: 10, crowd: 'kiem-tien-1-thuong', xung: 'kiem-tien-2-xung-dai', spot: 'kiem-tien-3-spotlight-dai' },
  { id: 'nv08', name: 'Phượng Hoàng', weight: 10, crowd: 'phuong-hoang-1-thuong', xung: 'phuong-hoang-2-xung-dai', spot: 'phuong-hoang-3-spotlight-dai' },
  { id: 'nv09', name: 'Phục Vụ', weight: 6, crowd: 'nv09-phuc-vu-nhay' },
  { id: 'nv10', name: 'Bartender', weight: 6, crowd: 'nv10-bartender-nhay' },
  { id: 'nv11', name: 'Bê Rượu', weight: 6, crowd: 'nv11-be-ruou-nhay' },
  { id: 'nv12', name: 'Bảo Vệ', weight: 6, crowd: 'nv12-bao-ve-nhay' },
  { id: 'nv13', name: 'Đại Ca', weight: 16, ...trio('nv13-dai-ca-ba-dao', 'nv13-dai-ca') },
  { id: 'nv14', name: 'Siêu Hài', weight: 20, ...trio('nv14-sieu-hai-nhay-ga', 'nv14-sieu-hai') },
  { id: 'nv15', name: 'Nữ Vương', weight: 16, ...trio('nv15-nu-vuong-quat-lanh', 'nv15-nu-vuong') },
  // sticker meme "đầu nấm", mèo, gấu… (bựa bựa, chiếm phần lớn sàn như trend "đi bar online")
  ...['a', 'b', 'c', 'e', 'g', 'h', 'j', 'k'].map((k) => ({ id: `meme-c-${k}`, name: 'Meme', weight: 5, crowd: `cherry-${k}` })),
  ...MEME_KEYS.map((k) => ({ id: k, name: 'Meme', weight: 5, crowd: k })),
  // meme tĩnh (trollface, Yao Ming, cereal guy…) — nhún + lắc theo nhịp thay cho ảnh động
  ...OB_KEYS.map((k) => ({ id: k, name: 'Meme', weight: 3, crowd: k }))
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
