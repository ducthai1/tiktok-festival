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

// Lưới thử chỗ: độ sâu (m, xa → gần camera) × khoảng cách ngang từ giữa khung (px).
const DEPTHS = [10.8, 10.4, 10.0, 9.6, 9.2, 8.8, 8.4, 8.0, 7.6, 7.2, 6.8, 6.4, 6.0, 5.6, 5.2];
const COLUMNS = [168, 336, 252, 210, 294, 189, 315, 231, 273];
/** Độ cao thêm của nhãn trên đầu (m, trước khi co theo độ sâu); âm = nhãn nằm trên lưng. */
const LIFTS = [0.06, 0.3, 0.54, -0.18, 0.78, -0.4, -0.62, 1.0, -0.85];
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
  { left: 116, right: 460, top: 340, bottom: 948 },
  { left: 735, right: 980, top: 690, bottom: 1010 }
];

const toScreen = (box, sign) => (sign > 0
  ? { ...box, left: HALF + box.left, right: HALF + box.right }
  : { ...box, left: HALF - box.right, right: HALF - box.left });

// Chọn chỗ cho MỘT bên (sign 1 = phải, -1 = trái). Duyệt từ xa tới gần camera nên người mới luôn ở
// trước người cũ: chỉ cần kiểm thân người mới không che đầu người cũ.
function pickSide(sign) {
  const placed = [];
  for (const depth of DEPTHS) {
    for (const dx of COLUMNS) {
      if (placed.length >= MAX_SEATS_PER_SIDE) break;
      const x = metersFromCenterPx(dx, depth);
      if (x < CARPET_EDGE) continue;
      if (HALF + dx + LABEL_WIDTH / 2 > 2 * HALF - SAFE_X) continue;
      const boxes = personBoxes(depth, dx, 0);
      // đầu người phía trước (xa camera) phải còn lộ ít nhất một nửa — thân che nhau thì không sao, đông người là vậy
      if (placed.some((p) => overlapArea(boxes.body, p.head) > HEAD_HIDE_MAX * (p.head.right - p.head.left) * (p.head.bottom - p.head.top))) continue;
      if (placed.some((p) => Math.abs(p.dx - dx) < 30 && Math.abs(p.depth - depth) < 0.9)) continue; // không ngồi chồng lên nhau
      const lift = LIFTS.find((l) => {
        const label = personBoxes(depth, dx, l).label;
        const onScreen = toScreen(label, sign);
        return label.top > 860 && label.bottom < LABEL_LOWEST
          && LABEL_KEEP_OUT.every((zone) => overlapArea(onScreen, zone) === 0)
          && placed.every((p) => overlapArea(label, p.label) <= LABEL_OVERLAP_MAX * LABEL_WIDTH * LABEL_HEIGHT);
      });
      if (lift === undefined) continue;
      placed.push({ depth, dx, x, lift, sign, ...personBoxes(depth, dx, lift) });
    }
  }
  return placed;
}

// Trộn hai bên theo thứ tự xa → gần camera (hàng VIP sát bàn thờ được lấp đầu tiên), trái/phải xen kẽ.
const order = (a, b) => b.depth - a.depth || a.dx - b.dx || a.sign - b.sign;
/** Thứ tự lấp chỗ; mỗi chỗ: x, z (m), depth, lift (độ cao nhãn), screenX (px tâm người). */
export const TEMPLE_SEATS = [...pickSide(-1), ...pickSide(1)].sort(order).map((p) => ({
  x: Number((p.sign * p.x).toFixed(3)), z: -p.depth, depth: p.depth, lift: p.lift, screenX: Math.round(HALF + p.sign * p.dx)
}));
export const TEMPLE_SEAT_COUNT = TEMPLE_SEATS.length;

/** Hộp nhãn tên (px) của chỗ ngồi — để test kiểm nhãn trong vùng an toàn và không đè nhau. */
export function seatLabelBox(seat) {
  return toScreen(personBoxes(seat.depth, Math.abs(seat.screenX - HALF), seat.lift).label, seat.screenX < HALF ? -1 : 1);
}

export { LABEL_KEEP_OUT };
