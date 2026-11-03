// Chỗ quỳ trong chánh điện — dùng chung cho server (số chỗ) và cảnh 3D (vị trí + độ cao nhãn tên).
// Mọi chỗ được tính bằng đúng phép chiếu của camera (temple-camera.js) để NGƯỜI VÀ NHÃN TÊN luôn nằm
// trong vùng điện thoại thấy được: TikTok phóng video 9:16 cho đầy màn 19,5:9–20:9 nên cắt ~108 px mỗi
// bên khung 1080 (lề an toàn 116 px, khớp --safe-x của stage.css). Hai bên thảm đỏ mỗi bên chỉ còn
// ~200 px bề ngang, nên chỗ được chọn theo luật: đầu của người ngồi trước (xa camera) không bị người
// ngồi sau che, nhãn tên không đè nhau, và cả nhãn lẫn người nằm trọn trong vùng an toàn.
import { depthScale, metersFromCenterPx, screenXPx, screenYPx } from './temple-camera.js';

/** Người quỳ nhỏ hơn cỡ thật 15% (cả đệm): hai bên thảm chỉ ~200 px nên người nhỏ đi mới đủ chỗ cho ~30 người lộ tên. */
export const CROWD_SCALE = 0.85;
const scaleAt = (depth) => depthScale(depth) * CROWD_SCALE;

export const SAFE_X = 116; // px, mép khung điện thoại không cắt
export const LABEL_WIDTH = 150; // px, bề ngang tối đa của nhãn tên ở chùa (.theme-temple .label.small .tag max-width)
export const LABEL_HEIGHT = 36; // px
const CARPET_EDGE = 0.72; // m: chỗ sát thảm đỏ nhất (giữ lối đi giữa cho người lên thắp hương)
const KNEEL_HEAD = 1.18; // m: đệm + đỉnh đầu người quỳ (trước khi co theo độ sâu)
const HEAD_SIZE = 0.26; // m: cỡ đầu (để kiểm đầu người phía trước còn lộ)
const BODY_WIDTH = 0.5; // m: bề ngang thân người quỳ (thân sprite, không tính tay áo loe)
const HALF = 540;

// Các hàng quỳ được sắp xếp ngay ngắn, đối xứng, tách bạch, không đè đệm lên nhau.
// 8 hàng từ bàn thờ xuống gần camera (đối xứng trái/phải qua thảm đỏ):
// Hàng 1 (VIP sát bàn thờ): 3 chỗ mỗi bên = 6 chỗ VIP
// Hàng 2: 3 chỗ mỗi bên
// Hàng 3: 3 chỗ mỗi bên
// Hàng 4: 2 chỗ mỗi bên
// Hàng 5: 2 chỗ mỗi bên
// Hàng 6: 1 chỗ mỗi bên
// Hàng 7: 1 chỗ mỗi bên
// Hàng 8: 1 chỗ mỗi bên
// Tổng: 16 chỗ mỗi bên = 32 chỗ (khớp test >= 31, đệm cách nhau rõ ràng, không đè lên nhau).
const ROWS = [
  { depth: 10.8, xs: [0.84, 1.35, 1.86] },
  { depth: 9.6,  xs: [0.84, 1.26, 1.68] },
  { depth: 8.5,  xs: [0.82, 1.16, 1.50] },
  { depth: 7.5,  xs: [0.82, 1.25] },
  { depth: 6.6,  xs: [0.80, 1.16] },
  { depth: 5.7,  xs: [0.80] },
  { depth: 5.0,  xs: [0.78] },
  { depth: 4.4,  xs: [0.76] }
];
/** Độ cao thêm của nhãn trên đầu (m, trước khi co theo độ sâu); âm = nhãn nằm trên lưng. */
const LIFTS = [0.06, 0.3, 0.54, -0.18, 0.78, -0.4, -0.62, 1.0, -0.85, 0.18, -0.06, 0.42, -0.3, 0.66, -0.5, 0.9, -0.75, 1.1, -0.95];
export const MAX_SEATS_PER_SIDE = 16;
const HEAD_HIDE_MAX = 0.5; // tối đa nửa cái đầu bị người ngồi sau che
export const LABEL_OVERLAP_MAX = 0.35; // nhãn chồng mép lên nhau tối đa 35% diện tích (vẫn đọc được tên)
const LABEL_LOWEST = 1330; // px: nhãn thấp nhất (nằm trên lưng người hàng gần camera)
export const VIP_SEATS = 6;

function personBoxes(depth, dx, lift) {
  const s = scaleAt(depth);
  const pxPerM = (screenXPx(1, depth) - HALF);
  const headTop = screenYPx(s * KNEEL_HEAD, depth);
  const headBottom = screenYPx(s * (KNEEL_HEAD - HEAD_SIZE), depth);
  const floor = screenYPx(0, depth);
  const labelBottom = screenYPx(s * (KNEEL_HEAD + lift), depth);
  return {
    head: { left: dx - (HEAD_SIZE / 2) * s * pxPerM, right: dx + (HEAD_SIZE / 2) * s * pxPerM, top: headTop, bottom: headBottom },
    body: { left: dx - (BODY_WIDTH / 2) * s * pxPerM, right: dx + (BODY_WIDTH / 2) * s * pxPerM, top: headTop, bottom: floor },
    label: { left: dx - LABEL_WIDTH / 2, right: dx + LABEL_WIDTH / 2, top: labelBottom - LABEL_HEIGHT, bottom: labelBottom }
  };
}

const overlapArea = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

// Vùng nhãn tên không được đè (px của khung 1080×1920): bảng "Cách tham gia" bên trái (HUD nằm trên lớp
// nhãn nên nhãn chui xuống dưới là mất tên) và cụm chuông + mõ bên phải (temple-bell-and-mo.js).
const LABEL_KEEP_OUT = [
  { left: 72, right: 342, top: 225, bottom: 820 }, // bảng Cách tham gia (top 234) + thông báo quà bám ngay dưới
  { left: 700, right: 980, top: 665, bottom: 1010 }
];

const toScreen = (box, sign) => (sign > 0
  ? { ...box, left: HALF + box.left, right: HALF + box.right }
  : { ...box, left: HALF - box.right, right: HALF - box.left });

// Chọn chỗ cho MỘT bên (sign 1 = phải, -1 = trái) theo đúng các hàng đã tính toán để tách biệt đệm.
function pickSide(sign) {
  const placed = [];
  for (const row of ROWS) {
    for (const x of row.xs) {
      if (placed.length >= MAX_SEATS_PER_SIDE) break;
      const depth = row.depth;
      const dx = Math.round(screenXPx(x, depth) - HALF);
      const lift = LIFTS.find((l) => {
        const label = personBoxes(depth, dx, l).label;
        const onScreen = toScreen(label, sign);
        return label.top >= 860 && label.bottom < LABEL_LOWEST
          && LABEL_KEEP_OUT.every((zone) => overlapArea(onScreen, zone) === 0)
          && placed.every((p) => overlapArea(label, p.label) <= LABEL_OVERLAP_MAX * LABEL_WIDTH * LABEL_HEIGHT);
      });
      if (lift === undefined) continue;
      placed.push({ depth, dx, x: sign * x, lift, sign, ...personBoxes(depth, dx, lift) });
    }
  }
  return placed;
}

// Trộn hai bên theo thứ tự xa → gần camera (hàng VIP sát bàn thờ được lấp đầu tiên), trái/phải xen kẽ.
const order = (a, b) => b.depth - a.depth || Math.abs(a.dx) - Math.abs(b.dx) || a.sign - b.sign;
/** Thứ tự lấp chỗ; mỗi chỗ: x, z (m), depth, lift (độ cao nhãn), screenX (px tâm người). */
export const TEMPLE_SEATS = [...pickSide(-1), ...pickSide(1)].sort(order).map((p) => ({
  x: Number(p.x.toFixed(3)), z: -p.depth, depth: p.depth, lift: p.lift, screenX: Math.round(HALF + p.sign * p.dx)
}));
export const TEMPLE_SEAT_COUNT = TEMPLE_SEATS.length;

/** Hộp nhãn tên (px) của chỗ ngồi — để test kiểm nhãn trong vùng an toàn và không đè nhau. */
export function seatLabelBox(seat) {
  return toScreen(personBoxes(seat.depth, Math.abs(seat.screenX - HALF), seat.lift).label, seat.screenX < HALF ? -1 : 1);
}

export { LABEL_KEEP_OUT };
