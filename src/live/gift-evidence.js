// Bằng chứng người xem THẬT SỰ tặng được món quà nào (data/gift-evidence.json).
//
// Vì sao cần: hộp quà TikTok được nhào nặn riêng cho từng người xem (theo tài khoản, cấp độ, chiến
// dịch LIVE FEST, test A/B). Cờ is_displayed_on_panel của API danh sách quà chỉ là mặc định CHUNG
// của vùng — đo ngày 21/11/2026 thấy lệch cả hai chiều so với hộp quà thật của chủ kênh: 6 món API
// bảo "ai cũng thấy" mà chủ kênh không có, 12 món chủ kênh có mà API không đánh dấu. Truyền room_id
// vào API cũng trả về y hệt danh sách chung. Ta không đăng nhập bằng tài khoản người xem nên KHÔNG
// API nào biết được hộp quà của họ.
//
// Tín hiệu duy nhất chắc chắn: món đó đã có người tặng thật. Một người tặng được nghĩa là người đó
// có món đó trong hộp quà; càng nhiều người KHÁC NHAU tặng thì món đó càng chắc là ai cũng có.
// Đếm theo người, không đếm theo lượt: một người tặng 100 lượt vẫn chỉ là một bằng chứng.
import fs from 'node:fs';
import path from 'node:path';

/** Bấy nhiêu người KHÁC NHAU cùng tặng được thì coi là món ai cũng tìm thấy. */
export const SAFE_MIN_SENDERS = 5;
/** Chỉ tính người tặng trong bấy nhiêu ngày gần đây — hộp quà TikTok đổi theo mùa chiến dịch. */
export const SAFE_WINDOW_DAYS = 30;
/** Giữ tối đa bấy nhiêu người tặng cho mỗi món (đủ để vượt ngưỡng, không phình file). */
const MAX_SENDERS_PER_GIFT = 200;
/** Giữ tối đa bấy nhiêu món; món lâu không ai tặng nhất bị bỏ trước. */
const MAX_GIFTS = 400;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @param {string} dataDir thư mục data/
 * @param {object} opts now() để test bơm giờ giả; saveDelayMs gộp nhiều lần ghi làm một
 */
export function createGiftEvidence(dataDir, { now = Date.now, saveDelayMs = 3000 } = {}) {
  const file = path.join(dataDir, 'gift-evidence.json');
  // gifts: Map<giftId, { name, coins, senders: Map<userId, lastTs> }>
  const gifts = new Map();

  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const [id, g] of Object.entries(saved?.gifts || {})) {
      const senders = new Map();
      for (const [uid, ts] of Object.entries(g?.senders || {})) {
        if (Number(ts) > 0) senders.set(String(uid), Number(ts));
      }
      if (senders.size) gifts.set(String(id), { name: String(g.name || ''), coins: Number(g.coins) || 0, senders });
    }
  } catch {
    // chưa có file
  }

  let timer = null;
  function save() {
    timer = null;
    try {
      const obj = {};
      for (const [id, g] of gifts) {
        const senders = {};
        for (const [uid, ts] of g.senders) senders[uid] = ts;
        obj[id] = { name: g.name, coins: g.coins, senders };
      }
      fs.writeFileSync(file, JSON.stringify({ savedAt: new Date(now()).toISOString(), gifts: obj }, null, 2));
    } catch (error) {
      console.warn('[quà] không lưu được bằng chứng quà:', error.message);
    }
  }
  const saveSoon = () => {
    if (timer) return;
    timer = setTimeout(save, saveDelayMs);
    timer.unref?.();
  };

  /** Bỏ người tặng đã quá hạn cửa sổ, rồi bỏ món không còn ai tặng. */
  function prune() {
    const cutoff = now() - SAFE_WINDOW_DAYS * DAY_MS;
    for (const [id, g] of gifts) {
      for (const [uid, ts] of g.senders) if (ts < cutoff) g.senders.delete(uid);
      if (!g.senders.size) gifts.delete(id);
    }
    if (gifts.size > MAX_GIFTS) {
      const moiNhat = (g) => Math.max(...g.senders.values());
      const bo = [...gifts.entries()].sort((a, b) => moiNhat(a[1]) - moiNhat(b[1])).slice(0, gifts.size - MAX_GIFTS);
      for (const [id] of bo) gifts.delete(id);
    }
  }

  return {
    /**
     * Ghi nhận một món quà THẬT vừa nhận được. Quà giả lập (nút thử ở trang điều khiển) không tính —
     * nó không chứng minh được người xem nào có món đó.
     */
    record(event) {
      if (event?.type !== 'gift' || event.simulated) return false;
      const id = String(event.gift?.id || '');
      const uid = String(event.user?.id || event.user?.uniqueId || '');
      if (!/^\d+$/.test(id) || !uid) return false;
      let g = gifts.get(id);
      if (!g) {
        g = { name: String(event.gift.name || '').slice(0, 40), coins: Number(event.gift.diamondsEach) || 0, senders: new Map() };
        gifts.set(id, g);
      }
      if (event.gift.name) g.name = String(event.gift.name).slice(0, 40);
      if (Number(event.gift.diamondsEach) > 0) g.coins = Number(event.gift.diamondsEach);
      g.senders.set(uid, now());
      if (g.senders.size > MAX_SENDERS_PER_GIFT) {
        const cu = [...g.senders.entries()].sort((a, b) => a[1] - b[1])[0];
        if (cu) g.senders.delete(cu[0]);
      }
      saveSoon();
      return true;
    },

    /** Số người KHÁC NHAU đã tặng được món này trong cửa sổ thời gian. */
    senderCount(giftId) {
      const g = gifts.get(String(giftId));
      if (!g) return 0;
      const cutoff = now() - SAFE_WINDOW_DAYS * DAY_MS;
      let n = 0;
      for (const ts of g.senders.values()) if (ts >= cutoff) n += 1;
      return n;
    },

    /** Đủ người khác nhau tặng được → coi là món người xem chắc chắn tìm thấy trong hộp quà. */
    isSafe(giftId) {
      return this.senderCount(giftId) >= SAFE_MIN_SENDERS;
    },

    /** CHẮC CHẮN người này có món đó: chính họ đã từng tặng. Dùng cho việc nhắc riêng một người. */
    hasSent(userId, giftId) {
      const g = gifts.get(String(giftId));
      if (!g) return false;
      const ts = g.senders.get(String(userId));
      return Boolean(ts) && ts >= now() - SAFE_WINDOW_DAYS * DAY_MS;
    },

    /** { [giftId]: số người đã tặng } — trang điều khiển hiện kèm mỗi món. */
    counts() {
      const out = {};
      for (const id of gifts.keys()) {
        const n = this.senderCount(id);
        if (n > 0) out[id] = n;
      }
      return out;
    },

    /**
     * Nạp lịch sử từ data/gifts.log (mỗi dòng: "[giờ] [GIFT] tên (@uniqueId): Tên quà xN (D💎)").
     * Log chỉ ghi TÊN quà nên phải tra ngược ra id qua bảng quà. Dùng một lần lúc khởi động để bảng
     * quà có bằng chứng ngay từ buổi live đầu, không phải chờ gom lại từ số không.
     * @param {string} logFile đường dẫn gifts.log
     * @param {Map<string,{id:string,coins:number}>} theoTen tên quà (đã hạ chữ thường) → { id, coins }
     */
    seedFromLog(logFile, theoTen) {
      let text = '';
      try {
        text = fs.readFileSync(logFile, 'utf8');
      } catch {
        return 0; // chưa có log
      }
      const dong = /^\[([^\]]+)\] \[GIFT\] .*?\(@([^)]+)\): (.+?) x\d+ \(/;
      let them = 0;
      for (const line of text.split('\n')) {
        const m = dong.exec(line);
        if (!m) continue;
        const ts = Date.parse(m[1].replace(' ', 'T'));
        if (!Number.isFinite(ts) || ts < now() - SAFE_WINDOW_DAYS * DAY_MS) continue;
        const info = theoTen.get(m[3].trim().toLowerCase());
        if (!info) continue; // món không còn trong bảng quà → không suy ra id được
        let g = gifts.get(String(info.id));
        if (!g) {
          g = { name: m[3].trim().slice(0, 40), coins: Number(info.coins) || 0, senders: new Map() };
          gifts.set(String(info.id), g);
        }
        const uid = m[2].trim();
        if (!g.senders.has(uid) || g.senders.get(uid) < ts) {
          g.senders.set(uid, ts);
          them += 1;
        }
      }
      prune();
      if (them) saveSoon();
      return them;
    },

    /** Dọn bằng chứng quá hạn + ghi file ngay (app.js gọi theo giờ). */
    sweep() {
      prune();
      save();
    },

    stop() {
      if (timer) clearTimeout(timer);
      timer = null;
      save();
    }
  };
}
