// Phép chiếu của camera Chùa (thuần toán, không cần three.js) — dùng chung cho cảnh 3D, bố trí chỗ ngồi
// và test. Camera được khớp với phối cảnh của tranh nền chánh điện (đơn vị: mét, sàn y = 0).
// Đo trên tranh: hai mép thảm đỏ hội tụ ở đường chân trời cao 56,3% từ trên xuống; chân bàn thờ
// nằm ở 64,5% và ở đó 1 m ≈ 90 điểm ảnh (bề ngang tranh 572) ⇒ camera cao 0,93 m, nhìn thẳng,
// ống kính dịch dọc (cột trong tranh đứng thẳng, không chụm). Đổi tranh nền thì đo lại 3 số này.

export const FRAME_WIDTH = 1080;
export const FRAME_HEIGHT = 1920;
export const CAMERA_HEIGHT = 0.93;
export const FOV = 52;
export const ASPECT = FRAME_WIDTH / FRAME_HEIGHT;
export const HORIZON = 0.563; // tỉ lệ từ mép trên khung xuống
export const SHIFT = 2 * HORIZON - 1; // lệch ống kính theo chiều dọc (NDC)
export const P11 = 1 / Math.tan(((FOV / 2) * Math.PI) / 180);
export const P00 = P11 / ASPECT;
/** Độ sâu (m, tính từ camera) của chân bàn thờ trong tranh. */
export const ALTAR_DEPTH = 11.6;

/**
 * Tranh vẽ góc máy rất thấp: theo đúng phối cảnh, người ở hàng đầu to gấp 3–4 lần người cạnh bàn thờ
 * và che kín bàn thờ. Nên người/đồ vật ở gần camera được thu nhỏ bớt theo căn bậc hai độ sâu
 * (cạnh bàn thờ giữ đúng cỡ thật để khớp với lư hương, bàn thờ trong tranh).
 */
export const depthScale = (depth) => Math.min(1, Math.max(0.3, Math.sqrt(depth / ALTAR_DEPTH)));

/** Toạ độ ngang (px của khung 1080) của điểm cách giữa x mét ở độ sâu depth (zoom 1). */
export const screenXPx = (x, depth) => (0.5 + (P00 * x) / (2 * depth)) * FRAME_WIDTH;
/** Toạ độ dọc (px của khung 1920) của điểm cao y mét ở độ sâu depth (zoom 1). */
export const screenYPx = (y, depth) => (HORIZON - (P11 * (y - CAMERA_HEIGHT)) / (2 * depth)) * FRAME_HEIGHT;
/** Khoảng cách ngang (m) từ giữa tới điểm hiện ở px cách giữa khung dx px, ở độ sâu depth. */
export const metersFromCenterPx = (dx, depth) => (dx * 2 * depth) / (P00 * FRAME_WIDTH);
