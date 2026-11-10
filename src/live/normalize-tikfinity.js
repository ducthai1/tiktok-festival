// Đổi tin nhắn WebSocket của TikFinity Desktop (ws://127.0.0.1:21213) sang dạng chung.
// Phỏng theo src/tiktok/normalize-tikfinity-event.js của cherry9001/tiktok-live-bar
// (MIT, © 2025 ÔNG CHÚ MMO). Khác bản gốc: không mặc định repeatEnd=true khi thiếu
// trường, mà để bộ đếm combo tự tính phần tăng — tránh cộng trùng kim cương.
import { firstImageUrl, firstText } from './live-event-schema.js';

const TYPE_ALIASES = {
  chat: 'chat', comment: 'chat', message: 'chat',
  member: 'member', join: 'member', viewerjoin: 'member',
  gift: 'gift', like: 'like', follow: 'follow', share: 'share',
  roomuser: 'viewers', viewercount: 'viewers'
};

function typeOf(raw = {}) {
  return firstText(raw.event, raw.eventType, raw.type, raw.name).toLowerCase().replace(/[^a-z]/g, '');
}

function userOf(data = {}) {
  const user = data.user || data.userData || data.author || data;
  const uniqueId = firstText(user.uniqueId, user.unique_id, user.username, data.uniqueId, data.username);
  const userId = firstText(user.userId, user.user_id, user.id, data.userId, data.user_id, uniqueId);
  return {
    id: userId,
    uniqueId: uniqueId || userId,
    nickname: firstText(user.nickname, user.displayName, user.name, data.nickname, uniqueId),
    avatar: firstImageUrl(
      user.userDetails?.profilePictureUrls, data.userDetails?.profilePictureUrls,
      user.profilePictureUrls, user.profilePictureUrl, user.avatarUrl, data.profilePictureUrl
    ),
    follower: Number(user.followRole ?? data.followRole ?? user.followInfo?.followStatus) >= 1
  };
}

function normalizeOne(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data) ? raw.data : raw;
  const type = TYPE_ALIASES[typeOf(raw) || typeOf(data)];
  if (!type) return null;
  if (type === 'viewers') return { type, viewerCount: Number(data.viewerCount ?? data.count ?? data.total) };
  const base = { type, id: firstText(raw.msgId, data.msgId, data.eventId, raw.eventId), user: userOf(data) };
  if (type === 'chat') return { ...base, comment: firstText(data.comment, data.message, data.text) };
  if (type === 'like') return { ...base, likeCount: Number(data.likeCount ?? data.count) || 1 };
  if (type === 'member' && data.memberCount !== undefined) return { ...base, viewerCount: Number(data.memberCount) };
  if (type !== 'gift') return base;
  const gift = data.gift || data.giftDetails || data.extendedGiftInfo || {};
  const giftType = Number(data.giftType ?? gift.giftType) || 0;
  return {
    ...base,
    giftRaw: {
      id: firstText(data.giftId, data.gift_id, gift.id, gift.giftId),
      name: firstText(data.giftName, gift.giftName, gift.name),
      pictureUrl: firstImageUrl(data.giftPictureUrl, gift.giftPictureUrl, gift.image, gift.giftImage),
      diamondsEach: Number(gift.diamondCount ?? gift.diamond_count ?? data.diamondCount) || 0,
      repeatCount: Number(data.repeatCount ?? data.repeat_count) || 1,
      repeatEnd: data.repeatEnd === undefined ? giftType !== 1 : Boolean(data.repeatEnd),
      streakable: giftType === 1,
      groupId: firstText(data.groupId, data.group_id)
    }
  };
}

export function normalizeTikFinityMessage(message) {
  let parsed = message;
  if (Buffer.isBuffer(parsed)) parsed = parsed.toString('utf8');
  if (typeof parsed === 'string') {
    if (parsed.length > 256 * 1024) return [];
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  const items = Array.isArray(parsed) ? parsed.slice(0, 200) : [parsed];
  return items.map(normalizeOne).filter(Boolean);
}
