// CHÙA ONLINE — người xem tương tác là có một Phật tử quỳ trong chánh điện.
// Thả tim = gõ mõ, follow/share = thỉnh chuông, bình luận "thắp hương" / "cầu ..." / "xin xăm",
// quà = một lời cầu (bình an, sức khỏe, tài lộc, điều ước lớn, vạn sự như ý). 6 người nhiều "tâm thành" nhất quỳ hàng đầu.
import { containsPhrase, createCooldown, isCleanForDisplay, startsWithPhrase } from './text-match.js';
import { drawFortune } from './temple-fortunes.js';
import { giftTier } from '../../public/shared/gift-tiers.js';
import { TEMPLE_SEAT_COUNT, VIP_SEATS } from '../../public/shared/temple-seats.js';

// Số chỗ quỳ lấy từ bố trí chung với màn hình (mọi chỗ đều lộ người + tên trên điện thoại).
export const TEMPLE_SLOTS = TEMPLE_SEAT_COUNT;
const VIP_SLOTS = VIP_SEATS;
// TikTok không báo ai rời phòng: lâu không tương tác thì coi như đã về, đứng dậy đi ra cho người khác vào.
// Người chỉ vào xem đi sớm hơn người đã gõ mõ / bình luận / tặng quà.
const IDLE_LEAVE_MS = { engaged: 10 * 60 * 1000, watcher: 5 * 60 * 1000 };
const FORTUNE_SHOW_MS = 10000;
const FORTUNE_QUEUE_MAX = 5;

const INCENSE_WORDS = ['thap huong', 'dang huong', 'thap nhang', 'bai phat', 'lay phat', 'thap 3 nen huong'];
const FORTUNE_WORDS = ['xin xam', 'gieo que', 'rut que', 'xin que', 'xin 1 que', 'xin mot que'];
const PRAYER_START = ['cau', 'nguyen', 'chuc', 'xin cho'];
const PRAYER_WORDS = ['binh an', 'nam mo', 'a di da phat', 'suc khoe', 'may man', 'an lanh', 'thuan loi'];

// 6 bậc theo giá MỘT món quà (public/shared/gift-tiers.js). Nghi thức dài (thắp hương, xin xăm) chỉ mở
// bằng quà — gõ chữ không mở được, nên đông người gõ cùng lúc cũng không làm loạn màn hình:
// Hoa hồng: thắp hương → Rosa/Donut: xin xăm → Tay tim/Corgi: thắp đèn cầu sức khỏe
// → Ngân hà/Pháo hoa: mâm ngũ quả cầu tài lộc → Siêu xe: điều ước lớn → Tên lửa/Sư tử/Vũ trụ: vạn sự như ý.
const OFFERING_BY_TIER = ['incense', 'fortune', 'lamp', 'fruit', 'ceremony', 'grand'];
const HINTS = {
  incense: 'Tặng 🌹 Hoa hồng để lên thắp hương nhé',
  fortune: 'Tặng 🍩 Bánh donut (quà từ 10 xu) để xin xăm nhé'
};
export const offeringForGift = (coinsEach) => OFFERING_BY_TIER[giftTier(coinsEach) - 1];

export function createTempleGame({ random = Math.random } = {}) {
  const devotees = new Map();
  const merit = new Map(); // điểm tâm thành của phiên, giữ cả khi người đó đã rời chánh điện
  const hintCooldown = createCooldown(30000);
  const sayCooldown = createCooldown(4000); // bình luận: mỗi người tối đa 1 bong bóng / 4 giây
  const wishes = new Map(); // lời cầu gần nhất của từng người: tặng quà (từ bậc 3) thì thả hoa đăng mang lời này
  const WISH_KEEP_MS = 5 * 60 * 1000;
  const totals = { merit: 0, incense: 0, mo: 0, bell: 0 };
  const fortuneQueue = [];
  let currentFortune = null;
  let joinSeq = 0;

  function addMerit(user, points) {
    const entry = merit.get(user.id) || { id: user.id, nickname: user.nickname, avatar: user.avatar, points: 0 };
    entry.points += points;
    entry.nickname = user.nickname;
    entry.avatar = user.avatar || entry.avatar;
    merit.set(user.id, entry);
    totals.merit += points;
  }

  // engaged=false: người chỉ mới vào phòng — được vào chánh điện nếu còn chỗ, hoặc thế chỗ
  // người cũng chỉ mới vào; không bao giờ đẩy người đang tương tác ra.
  function ensureDevotee(user, now, fx, { engaged = true } = {}) {
    let devotee = devotees.get(user.id);
    if (!devotee) {
      if (devotees.size >= TEMPLE_SLOTS) {
        const ranked = rankedDevotees();
        const out = ranked.slice(VIP_SLOTS)
          .filter((d) => engaged || !d.engaged)
          .sort((a, b) => Number(a.engaged) - Number(b.engaged) || a.lastActive - b.lastActive)[0];
        if (!out) return null;
        devotees.delete(out.id);
        fx.push({ kind: 'leave', userId: out.id });
      }
      devotee = { id: user.id, joinOrder: joinSeq += 1, engaged: false };
      devotees.set(user.id, devotee);
      fx.push({ kind: 'join', userId: user.id, nickname: user.nickname });
    }
    devotee.nickname = user.nickname;
    devotee.avatar = user.avatar;
    devotee.lastActive = now;
    devotee.engaged = devotee.engaged || engaged;
    return devotee;
  }

  // Hàng đầu: 6 người nhiều điểm nhất (có điểm > 0); sau đó theo thứ tự vào chùa.
  function rankedDevotees() {
    const list = [...devotees.values()];
    const vip = list.filter((d) => (merit.get(d.id)?.points || 0) > 0)
      .sort((a, b) => merit.get(b.id).points - merit.get(a.id).points).slice(0, VIP_SLOTS);
    const vipIds = new Set(vip.map((d) => d.id));
    const rest = list.filter((d) => !vipIds.has(d.id)).sort((a, b) => a.joinOrder - b.joinOrder);
    return [...vip, ...rest];
  }

  function onChat(event, now, fx) {
    const { user, comment } = event;
    // gõ "xin xăm"/"thắp hương": chỉ nhắc người đó tặng quà (mỗi người tối đa 1 lần nhắc / 30 giây)
    const asked = containsPhrase(comment, FORTUNE_WORDS) ? 'fortune' : containsPhrase(comment, INCENSE_WORDS) ? 'incense' : '';
    if (asked) {
      if (hintCooldown(user.id, now)) fx.push({ kind: 'hint', userId: user.id, text: HINTS[asked] });
      return;
    }
    // Bình luận chỉ có phản hồi đơn giản: chữ hiện thành bong bóng trên đầu người đó (lời cầu có 🙏).
    // Hiệu ứng đẹp (hoa đăng mang lời cầu bay lên + đọc thành tiếng) để dành cho lúc họ tặng quà.
    if (!isCleanForDisplay(comment) || !sayCooldown(user.id, now)) return;
    const isPrayer = startsWithPhrase(comment, PRAYER_START) || containsPhrase(comment, PRAYER_WORDS);
    if (isPrayer) wishes.set(user.id, { text: comment.slice(0, 80), at: now });
    addMerit(user, isPrayer ? 3 : 1);
    fx.push({ kind: 'say', userId: user.id, text: comment.slice(0, 60), prayer: isPrayer });
  }

  /** Lời cầu còn mới của người tặng (dùng một lần). */
  function takeWish(userId, now) {
    const wish = wishes.get(userId);
    wishes.delete(userId);
    return wish && now - wish.at < WISH_KEEP_MS ? wish.text : '';
  }

  return {
    id: 'temple',
    title: 'Chùa Online',
    handleEvent(event, now = Date.now()) {
      const fx = [];
      if (event.type === 'member') {
        ensureDevotee(event.user, now, fx, { engaged: false });
        return fx;
      }
      ensureDevotee(event.user, now, fx);
      if (event.type === 'like') {
        totals.mo += event.likeCount;
        addMerit(event.user, event.likeCount);
        fx.push({ kind: 'mo', userId: event.user.id, count: event.likeCount });
      } else if (event.type === 'follow' || event.type === 'share') {
        totals.bell += 1;
        addMerit(event.user, 10);
        fx.push({ kind: 'bell', userId: event.user.id, nickname: event.user.nickname });
      } else if (event.type === 'gift') {
        const { user, gift } = event;
        const offering = offeringForGift(gift.diamondsEach);
        const base = { userId: user.id, nickname: user.nickname, giftName: gift.name, giftPicture: gift.pictureUrl, count: gift.count };
        addMerit(user, gift.diamonds * 10);
        if (offering === 'incense') {
          const sticks = Math.min(9, 3 * gift.count);
          totals.incense += sticks;
          fx.push({ kind: 'incense', ...base, sticks });
        } else if (offering === 'fortune') {
          // mỗi lượt tặng một quẻ; hàng chờ đầy thì quà vẫn được tính tâm thành, chỉ không thêm quẻ
          if (fortuneQueue.length < FORTUNE_QUEUE_MAX) fortuneQueue.push({ userId: user.id, nickname: user.nickname, avatar: user.avatar, ...drawFortune(random) });
          fx.push({ kind: 'giftNote', ...base, note: 'xin một quẻ xăm' });
        } else {
          totals.bell += 1;
          fx.push({ kind: 'offering', offering, ...base, tier: giftTier(gift.diamondsEach), wish: takeWish(user.id, now) });
        }
      } else if (event.type === 'chat') onChat(event, now, fx);
      return fx;
    },
    tick(now = Date.now()) {
      const fx = [];
      for (const d of devotees.values()) {
        if (now - d.lastActive > (d.engaged ? IDLE_LEAVE_MS.engaged : IDLE_LEAVE_MS.watcher)) {
          devotees.delete(d.id);
          fx.push({ kind: 'leave', userId: d.id });
        }
      }
      if (currentFortune && now >= currentFortune.until) currentFortune = null;
      if (!currentFortune && fortuneQueue.length) {
        currentFortune = { ...fortuneQueue.shift(), until: now + FORTUNE_SHOW_MS };
        const { until, ...shown } = currentFortune;
        fx.push({ kind: 'fortune', ...shown, durationMs: FORTUNE_SHOW_MS });
      }
      return fx;
    },
    command(name) {
      if (name === 'resetMerit') {
        merit.clear();
        for (const key of Object.keys(totals)) totals[key] = 0;
        return [];
      }
      if (name === 'clear') {
        const fx = [...devotees.keys()].map((userId) => ({ kind: 'leave', userId }));
        devotees.clear();
        fortuneQueue.length = 0;
        currentFortune = null;
        return fx;
      }
      throw new Error(`Lệnh không hỗ trợ: ${name}`);
    },
    snapshot(now = Date.now()) {
      const board = [...merit.values()].sort((a, b) => b.points - a.points).slice(0, 5);
      return {
        totals: { ...totals },
        devotees: rankedDevotees().map((d, slot) => ({
          id: d.id, nickname: d.nickname, avatar: d.avatar, slot, vip: slot < VIP_SLOTS && (merit.get(d.id)?.points || 0) > 0,
          points: merit.get(d.id)?.points || 0
        })),
        board: board.map(({ id, nickname, avatar, points }) => ({ id, nickname, avatar, points })),
        fortune: currentFortune ? { userId: currentFortune.userId, msLeft: Math.max(0, currentFortune.until - now) } : null,
        fortuneQueue: fortuneQueue.length
      };
    }
  };
}
