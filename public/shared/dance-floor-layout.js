// Bố cục SÀN NHẢY dùng chung cho server (số chỗ) và màn hình (vị trí 3D, mét).
// Camera nhìn về phía -z; hàng 0 là hàng sát camera. Hàng lẻ lệch nửa ô cho đám đông trông tự nhiên.
export const DANCE_COLS = 10; // khung dọc 9:16 hẹp ngang nên đám đông xếp sâu hơn rộng
export const DANCE_ROWS = 12;
export const DANCE_SLOTS = DANCE_COLS * DANCE_ROWS; // 120 người cùng nhảy
export const SLOT_DX = 0.8;
export const SLOT_DZ = 0.84;
export const FRONT_Z = 3.4;

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
export const GIANT_SPOTS = [{ x: -4.2, z: -8.2 }, { x: 4.2, z: -8.2 }];
