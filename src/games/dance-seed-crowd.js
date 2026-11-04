// Người nhảy ẢO lấp sàn lúc đầu buổi chưa có ai xem — sàn không trống trơn. Tên TỰ ĐẶT kiểu TikTok, KHÔNG dùng tên
// người xem thật (họ không có mặt mà tên lại hiện như đang quẩy). Người ảo chỉ nhảy / đổi biểu cảm theo lượt ngẫu nhiên:
// không bình luận, không tặng quà, không vào Top, không solo. Có người thật vào thì bớt dần: số người ảo luôn là
// SEED_TARGET − số người thật trên sàn (người thật vào là thay đúng chỗ của một người ảo; người thật rời thì người ảo quay lại).

export const SEED_TARGET = 30; // sàn đông ngay từ đầu buổi (user chốt 04/11: 10 thì trông vắng)
export const SEED_PREFIX = 'seed:';
export const isSeedId = (id) => String(id).startsWith(SEED_PREFIX);

const SEED_NAMES = ['Bống Bang 🐟', 'Mèo Ú 🐱', 'Ken Kun', 'Na Na 🍓', 'Bin Sumo', 'Trà Sữa Trân Châu', 'Gấu Mập 🐻', 'Xu Xu',
  'Tí Nị', 'Kem Dâu 🍦', 'Ốc Bươu', 'Mỡ Hành', 'Bé Su 🌸', 'Tôm Chiên', 'Cún Con 🐶', 'Bơ Bơ 🥑', 'Su Kem 🍨', 'Bánh Bao',
  'Cà Rốt 🥕', 'Mít Ướt', 'Chuột Bự 🐭', 'Heo Hồng 🐷', 'Bắp Rang 🍿', 'Nấm Lùn 🍄', 'Thỏ Bông 🐰', 'Cá Viên', 'Sữa Dâu',
  'Kẹo Dẻo 🍬', 'Gà Rán 🍗', 'Đậu Phộng 🥜', 'Mochi', 'Bánh Flan 🍮']; // ≥ SEED_TARGET tên để không ai trùng tên
const SEED_FACES = ['laugh', 'love', 'cool', 'party', 'star', 'tongue', 'sing', 'shy'];
const ACT_GAP_MS = [1500, 4000]; // mỗi lượt: cứ 10 người ảo thì một người làm một động tác (đông bao nhiêu cũng sôi như nhau)

export function createSeedCrowd({ random = Math.random, target = 0 } = {}) {
  let enabled = target > 0;
  let nextActAt = 0;
  let serial = 0;

  return {
    enabled: () => enabled,
    toggle() {
      enabled = !enabled;
      return enabled;
    },
    /** Số người ảo cần có khi trên sàn đang có `real` người thật. */
    want(real) {
      return enabled ? Math.max(0, target - real) : 0;
    },
    /** Người ảo mới: id riêng (không trùng người thật), tên chưa ai trong `taken` dùng. */
    next(taken) {
      serial += 1;
      const free = SEED_NAMES.filter((n) => !taken.has(n));
      const pool = free.length ? free : SEED_NAMES;
      return { id: `${SEED_PREFIX}${serial}`, nickname: pool[Math.floor(random() * pool.length)], avatar: '' };
    },
    /** Thỉnh thoảng cho một người ảo quẩy / nhảy / vẫy / đổi biểu cảm (giờ hết hạn như lệnh của người thật). */
    act(seeds, now, ms) {
      if (!seeds.length || now < nextActAt) return;
      nextActAt = now + ACT_GAP_MS[0] + random() * (ACT_GAP_MS[1] - ACT_GAP_MS[0]);
      for (let i = 0; i < Math.ceil(seeds.length / 10); i += 1) {
        const d = seeds[Math.floor(random() * seeds.length)];
        const roll = random();
        if (roll < 0.4) d.hypeUntil = now + ms.hype; // không "đi vòng": màn bay vòng giờ là quà 99–199 💎
        else if (roll < 0.62) d.jumpUntil = now + ms.jump;
        else if (roll < 0.75) d.waveUntil = now + ms.wave;
        else {
          d.face = SEED_FACES[Math.floor(random() * SEED_FACES.length)];
          d.faceUntil = now + ms.face;
        }
      }
    }
  };
}
