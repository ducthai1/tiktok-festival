// Đổi payload của thư viện tiktok-live-connector v2 sang dạng chung.
// Trường tên/ảnh có nhiều biến thể giữa các bản giao thức nên đọc lỏng tay.
import { firstImageUrl, firstText } from './live-event-schema.js';

export function normalizeConnectorUser(data = {}) {
  const user = data.user || data;
  const uniqueId = firstText(user.uniqueId, user.displayId);
  const userId = firstText(user.userId, user.id, uniqueId);
  return {
    id: userId,
    uniqueId: uniqueId || userId,
    nickname: firstText(user.nickname, uniqueId),
    avatar: firstImageUrl(user.profilePicture, user.avatarThumb, user.avatarMedium, user.profilePictureUrl)
  };
}

function messageId(data = {}) {
  return firstText(data.common?.msgId, data.event?.msgId, data.msgId);
}

// Đọc được cả hai dạng payload: bản giao thức mới (tiktok-live-proto v3, đo 03/11 trên phòng live thật:
// bình luận ở `content`, số tim ở `count`, quà ở `gift` {name, diamondCount, image, type}) lẫn bản cũ
// (`comment`, `likeCount`, `giftDetails`/`extendedGiftInfo`).
export function normalizeConnectorEvent(type, data = {}) {
  if (type === 'roomUser') return { type: 'viewers', viewerCount: Number(data.viewerCount ?? data.total) };
  const base = { type, id: messageId(data), user: normalizeConnectorUser(data) };
  if (type === 'chat') return { ...base, comment: firstText(data.content, data.comment) };
  if (type === 'like') return { ...base, likeCount: Number(data.count ?? data.likeCount) || 1 };
  if (type === 'member' && data.memberCount !== undefined) return { ...base, viewerCount: Number(data.memberCount) };
  if (type === 'gift') {
    const details = data.gift || data.giftDetails || data.extendedGiftInfo || {};
    const giftType = Number(details.type ?? details.giftType ?? data.giftType) || 0;
    return {
      ...base,
      giftRaw: {
        id: firstText(data.giftId, details.id),
        name: firstText(details.name, details.giftName, data.giftName),
        pictureUrl: firstImageUrl(details.image, details.icon, details.giftImage),
        diamondsEach: Number(details.diamondCount ?? data.diamondCount) || 0,
        repeatCount: Number(data.repeatCount) || 1,
        repeatEnd: Boolean(data.repeatEnd),
        streakable: giftType === 1 || details.combo === true, // quà combo: TikTok gửi nhiều lần, lần cuối repeatEnd
        groupId: firstText(data.groupId)
      }
    };
  }
  return base; // member, follow, share
}

/**
 * Danh mục quà của phòng (connection.availableGifts, lấy lúc kết nối) → [{id, name, coins, image}].
 * Giá là diamondCount của chính TikTok nên đúng theo vùng/thời điểm; ảnh chỉ nhận từ CDN TikTok.
 */
export function normalizeGiftCatalog(raw) {
  const list = Array.isArray(raw) ? raw : raw?.gifts || raw?.data?.gifts || raw?.giftList || [];
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const g of list.slice(0, 2000)) {
    const coins = Number(g?.diamond_count ?? g?.diamondCount) || 0;
    const name = firstText(g?.name, g?.giftName);
    if (!coins || !name || seen.has(name)) continue;
    seen.add(name);
    out.push({ id: firstText(g.id, g.giftId), name: name.slice(0, 40), coins,
      image: firstImageUrl(g.image, g.icon, g.giftImage, g.image?.url_list?.[0], g.icon?.url_list?.[0]) });
  }
  return out;
}
