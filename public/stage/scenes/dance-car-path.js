// Đường bay của XE BAY (quà 99–199 💎) — hàm thuần, dùng chung cho chiếc xe và nhân vật ngồi trên xe (luôn khớp nhau):
// cất cánh từ ô của người tặng → bay MỘT VÒNG elip quanh sàn + trước sân khấu (cao ~3 m, trên đầu đám đông, nhấp nhô,
// nghiêng mình theo khúc cua) → hạ cánh về đúng ô cũ. Vòng elip nằm trong tường hai bên (±8,2 m), không chạm bục Top /
// người khổng lồ / quả cầu disco.
export const RIDE_S = 14;
const TAKEOFF_S = 1.8;
const LAND_S = 1.8;
const CRUISE_S = RIDE_S - TAKEOFF_S - LAND_S;
const CENTER_Z = -1.0;
const RX = 6.2;
const RZ = 6.3;
const HEIGHT = 3.0;
const SEAT_Y = 0.55; // nhân vật ngồi trong khoang xe (tính từ gốc xe): phần dưới khuất trong thân xe như đang ngồi

const ease = (v) => v * v * (3 - 2 * v);
const lerp = (a, b, t) => a + (b - a) * t;

function onLoop(a, s) {
  return {
    x: Math.cos(a) * RX,
    y: HEIGHT + Math.sin(a * 2) * 0.45 + Math.sin(s * 3.1) * 0.12,
    z: CENTER_Z + Math.sin(a) * RZ
  };
}

/**
 * Vị trí xe sau `s` giây kể từ lúc cất cánh. home: {x, y?, z} chỗ người tặng đứng lúc cất cánh (ô sàn, hoặc bục Top).
 * Trả về { x, y, z, heading (rad, quay quanh trục đứng; xe nhìn theo +z), bank (rad, nghiêng), seatY, done }.
 */
export function ridePose(s, home) {
  const a0 = Math.atan2((home.z - CENTER_Z) / RZ, (home.x || 0.001) / RX); // điểm vào vòng gần ô nhất
  const t = Math.max(0, s);
  let p;
  let a = a0;
  if (t < TAKEOFF_S) {
    const k = ease(t / TAKEOFF_S);
    const q = onLoop(a0, t);
    p = { x: lerp(home.x, q.x, k), y: lerp(home.y || 0, q.y, k) + Math.sin(Math.PI * k) * 0.8, z: lerp(home.z, q.z, k) };
  } else if (t < TAKEOFF_S + CRUISE_S) {
    a = a0 + ((t - TAKEOFF_S) / CRUISE_S) * Math.PI * 2;
    p = onLoop(a, t);
  } else {
    const k = ease(Math.min(1, (t - TAKEOFF_S - CRUISE_S) / LAND_S));
    a = a0 + Math.PI * 2;
    const q = onLoop(a, t);
    p = { x: lerp(q.x, home.x, k), y: lerp(q.y, home.y || 0, k), z: lerp(q.z, home.z, k) };
  }
  // hướng xe = hướng tiếp tuyến vòng elip (chạy ngược chiều kim đồng hồ nhìn từ trên xuống)
  const vx = -Math.sin(a) * RX;
  const vz = Math.cos(a) * RZ;
  const cruising = t >= TAKEOFF_S && t < TAKEOFF_S + CRUISE_S;
  return {
    ...p,
    heading: Math.atan2(vx, vz),
    bank: cruising ? -0.32 : 0,
    pitch: t < TAKEOFF_S ? -0.25 * Math.sin(Math.PI * t / TAKEOFF_S) : !cruising ? 0.2 * Math.sin(Math.PI * Math.min(1, (t - TAKEOFF_S - CRUISE_S) / LAND_S)) : 0,
    seatY: p.y + SEAT_Y,
    done: t >= RIDE_S
  };
}
