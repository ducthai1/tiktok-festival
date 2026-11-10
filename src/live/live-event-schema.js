// Một sự kiện LIVE đã chuẩn hoá — mọi nguồn (TikTok trực tiếp, TikFinity, giả lập)
// đều phải đi qua đây trước khi tới game, nên game không bao giờ thấy dữ liệu thô.
import { cleanText, clampInt, safeImageUrl } from '../http/security.js';

export const LIVE_EVENT_TYPES = new Set(['chat', 'gift', 'like', 'follow', 'share', 'member', 'viewers']);

export function sanitizeLiveEvent(input) {
  if (!input || typeof input !== 'object' || !LIVE_EVENT_TYPES.has(input.type)) return null;
  // Số người đang xem phòng (không gắn với người xem nào) — dùng để đổi kiểu chào mừng.
  if (input.type === 'viewers') {
    const viewerCount = clampInt(input.viewerCount, 0, 100000000, -1);
    return viewerCount < 0 ? null : { type: 'viewers', id: '', at: Date.now(), simulated: input.simulated === true, viewerCount };
  }
  const user = input.user && typeof input.user === 'object' ? input.user : {};
  const uniqueId = cleanText(user.uniqueId, 64);
  const userId = cleanText(user.id, 128) || uniqueId;
  if (!userId) return null;
  const event = {
    type: input.type,
    id: cleanText(input.id, 180),
    at: clampInt(input.at, 0, Number.MAX_SAFE_INTEGER, Date.now()),
    simulated: input.simulated === true,
    user: {
      id: userId,
      uniqueId: uniqueId || userId,
      nickname: cleanText(user.nickname, 40) || uniqueId || 'Người xem',
      avatar: safeImageUrl(user.avatar),
      follower: user.follower === true
    }
  };
  if (event.type === 'chat') {
    event.comment = cleanText(input.comment, 200);
    if (!event.comment) return null;
  }
  if (event.type === 'like') event.likeCount = clampInt(input.likeCount, 1, 1000, 1);
  if (event.type === 'member' && input.viewerCount !== undefined) event.viewerCount = clampInt(input.viewerCount, 0, 100000000, 0);
  if (event.type === 'gift') {
    const gift = input.gift && typeof input.gift === 'object' ? input.gift : {};
    const count = clampInt(gift.count, 0, 100000, 0);
    const diamondsEach = clampInt(gift.diamondsEach, 0, 1000000, 0);
    if (count === 0) return null;
    event.gift = {
      id: cleanText(gift.id, 40),
      name: cleanText(gift.name, 60) || 'Quà',
      pictureUrl: safeImageUrl(gift.pictureUrl),
      diamondsEach,
      count,
      diamonds: Math.min(1e9, diamondsEach * count)
    };
  }
  return event;
}

// Lấy link ảnh đầu tiên trong các kiểu trường mà TikTok/TikFinity hay dùng.
export function firstImageUrl(...candidates) {
  for (const value of candidates.flat(2)) {
    if (typeof value === 'string' && /^https:\/\//i.test(value)) return value;
    if (value && typeof value === 'object') {
      const nested = firstImageUrl(value.url, value.urls, value.urlList, value.url_list);
      if (nested) return nested;
    }
  }
  return '';
}

export function firstText(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}
