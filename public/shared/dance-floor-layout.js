// Bố cục SÀN NHẢY dùng chung cho server (số chỗ) và màn hình (vị trí 3D, mét).
// Camera nhìn về phía -z; hàng 0 là hàng sát camera. Hàng lẻ lệch nửa ô cho đám đông trông tự nhiên.
export const DANCE_COLS = 16; // sàn to kiểu "đi bar online": cả trăm sticker nhỏ đứng kín sàn
export const DANCE_ROWS = 18;
export const DANCE_SLOTS = DANCE_COLS * DANCE_ROWS; // 288 người cùng nhảy
export const SLOT_DX = 0.62;
export const SLOT_DZ = 0.6;
export const FRONT_Z = 4.4;

/** Tâm ô `slot` trên sàn (x, z). */
export function slotPosition(slot) {
  const row = Math.floor(slot / DANCE_COLS);
  const col = slot % DANCE_COLS;
  const shift = row % 2 ? SLOT_DX / 2 : 0;
  return { x: (col - (DANCE_COLS - 1) / 2) * SLOT_DX + shift - SLOT_DX / 4, z: FRONT_Z - row * SLOT_DZ, row, col };
}

// Người mới vào được xếp gần camera và gần giữa trước (thấy mình ngay), người sau lấp dần ra rìa và về sau.
export const DANCE_FILL_ORDER = Array.from({ length: DANCE_SLOTS }, (_, i) => i).sort((a, b) => {
  const pa = slotPosition(a);
  const pb = slotPosition(b);
  return pa.row * 1.6 + Math.abs(pa.x) - (pb.row * 1.6 + Math.abs(pb.x));
});

// Sân khấu phía sau đám đông: chỗ diễn solo, bục Top 1-2-3, chỗ đứng của "khổng lồ VIP".
export const STAGE_TOP_Y = 0.9;
export const STAGE_FRONT_Z = -6.5;
export const SOLO_SPOT = { x: 0, y: STAGE_TOP_Y, z: -7.2 };
export const PODIUM = [
  { x: 0, y: 1.9, z: -9.3, scale: 1.55 },
  { x: -2.4, y: 1.5, z: -8.9, scale: 1.4 },
  { x: 2.4, y: 1.3, z: -8.9, scale: 1.3 }
];
export const GIANT_SPOTS = [{ x: -5.6, z: -7.6 }, { x: 5.6, z: -7.6 }];
export const DJ_SPOT = { x: 5, y: STAGE_TOP_Y, z: -10.2 };

// Ít người thì DÀN ĐỀU ra cả sàn (không chụm một cục ở giữa); đông dần thì khít lại.
// Lưới hiển thị đổi theo NẤC số người (không đổi mỗi lần có người vào) để mọi người chỉ lướt sang chỗ mới thỉnh thoảng.
// Thứ tự ô vẫn là của server (ô càng sớm càng gần camera/giữa) nên ai vào trước vẫn đứng chỗ đẹp.
const SPREAD_STEPS = [12, 24, 40, 64, 100, 150, 220];
const FLOOR_HALF_W = (DANCE_COLS * SLOT_DX) / 2 - 0.35;
const FLOOR_BACK_Z = FRONT_Z - (DANCE_ROWS - 1) * SLOT_DZ;
const FILL_INDEX = new Map(DANCE_FILL_ORDER.map((slot, i) => [slot, i]));
const spreadGrids = new Map();

function spreadGrid(cells) {
  if (spreadGrids.has(cells)) return spreadGrids.get(cells);
  const depth = FRONT_Z - FLOOR_BACK_Z;
  const cols = Math.max(2, Math.round(Math.sqrt((cells * 2 * FLOOR_HALF_W) / depth)));
  const rows = Math.ceil(cells / cols);
  const dx = (2 * FLOOR_HALF_W) / cols;
  const dz = depth / rows;
  const spots = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const jitter = ((r * 7 + c * 13) % 5) / 5 - 0.4; // lệch nhẹ cho tự nhiên, không thẳng hàng như lính
      spots.push({ x: -FLOOR_HALF_W + (c + 0.5) * dx + (r % 2 ? dx / 4 : -dx / 4) + jitter * dx * 0.3, z: FRONT_Z - (r + 0.3) * dz, row: r });
    }
  }
  spots.sort((a, b) => a.row * 1.6 + Math.abs(a.x) - (b.row * 1.6 + Math.abs(b.x)));
  spreadGrids.set(cells, spots);
  return spots;
}

/** Vị trí hiển thị của ô `slot` khi trên sàn đang có `count` người. */
export function spreadSlotPosition(slot, count) {
  const cells = SPREAD_STEPS.find((n) => n >= count);
  const k = FILL_INDEX.get(slot);
  if (!cells || k === undefined || k >= cells) return slotPosition(slot);
  return spreadGrid(cells)[k];
}
