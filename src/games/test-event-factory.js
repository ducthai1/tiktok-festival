// Tạo sự kiện THỬ cho nút "Thử" ở trang điều khiển. Tên luôn là "Khách thử N" để không
// thể nhầm với người xem thật; server từ chối khi đang kết nối live thật.
const SAMPLE_GIFTS = {
  1: { id: '5655', name: 'Hoa hồng' },
  5: { id: '5487', name: 'Tim ngón tay' },
  10: { id: '5879', name: 'Bánh vòng' },
  30: { id: '5658', name: 'Nước hoa' },
  99: { id: '6064', name: 'Mũ cối' },
  199: { id: '6671', name: 'Tim to' },
  500: { id: '7934', name: 'Pháo hoa' }
};

export const TEST_GIFT_TIERS = Object.keys(SAMPLE_GIFTS).map(Number);

export function buildTestEvent({ kind, viewer = 1, name = '', comment = '', diamonds = 1, count = 1, likes = 5, viewerCount = 0 }, seq) {
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
    const tier = TEST_GIFT_TIERS.includes(Number(diamonds)) ? Number(diamonds) : 1;
    const units = Math.max(1, Math.min(20, Number(count) || 1));
    return {
      ...base,
      giftRaw: { ...SAMPLE_GIFTS[tier], pictureUrl: '', diamondsEach: tier, repeatCount: units, repeatEnd: true, streakable: false }
    };
  }
  return null;
}
