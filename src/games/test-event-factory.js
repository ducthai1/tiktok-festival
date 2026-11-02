// Tạo sự kiện THỬ cho nút "Thử" ở trang điều khiển. Tên luôn là "Khách thử N" để không
// thể nhầm với người xem thật; server từ chối khi đang kết nối live thật.
import { SAMPLE_GIFTS } from '../../public/shared/gift-tiers.js';

// Quà thử = quà TikTok thật hay gặp (Hoa hồng, Bánh donut, Sư tử…) với giá phổ biến. Chọn bằng giftId;
// lệnh cũ chỉ gửi số kim cương thì lấy món đắt nhất không vượt quá số đó.
function sampleGift({ giftId, diamonds }, gifts) {
  const byId = gifts.find((g) => g.id === giftId);
  if (byId) return byId;
  const budget = Math.max(1, Number(diamonds) || 1);
  return [...gifts].reverse().find((g) => g.coins <= budget) || gifts[0];
}

/** gifts: quà mẫu (đã gắn ảnh/giá thật nếu từng nối live — xem withCatalogImages). */
export function buildTestEvent({ kind, viewer = 1, name = '', comment = '', giftId = '', diamonds = 1, count = 1, likes = 5, viewerCount = 0 }, seq, gifts = SAMPLE_GIFTS) {
  // Giả lập số người xem để thử chế độ "phòng đông chỉ hiện chữ".
  if (kind === 'viewers') return { type: 'viewers', viewerCount: Math.max(0, Math.min(1000000, Number(viewerCount) || 0)) };
  const n = Math.max(1, Math.min(99999, Math.floor(Number(viewer)) || 1));
  // name: tên giả cho kịch bản demo (chỉ chạy được khi KHÔNG live, màn hình có nhãn CHẾ ĐỘ THỬ)
  const user = { id: `test-${n}`, uniqueId: `khach_thu_${n}`, nickname: String(name || '').slice(0, 40) || `Khách thử ${n}`, avatar: '' };
  const base = { type: kind, id: `test-${seq}`, user };
  if (kind === 'chat') return { ...base, comment: String(comment).slice(0, 200) || 'xin chào' };
  if (kind === 'like') return { ...base, likeCount: Math.max(1, Math.min(50, Number(likes) || 5)) };
  if (kind === 'follow' || kind === 'share' || kind === 'member') return base;
  if (kind === 'gift') {
    const sample = sampleGift({ giftId: String(giftId), diamonds }, gifts);
    const units = Math.max(1, Math.min(99, Number(count) || 1));
    return {
      ...base,
      giftRaw: { id: sample.id, name: sample.name, pictureUrl: sample.image || '', diamondsEach: sample.coins, repeatCount: units, repeatEnd: true, streakable: false }
    };
  }
  return null;
}
