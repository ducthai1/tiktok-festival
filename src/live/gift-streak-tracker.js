// Quà "combo" (giftType 1) được TikTok gửi nhiều lần với repeatCount tăng dần rồi
// một lần cuối repeatEnd=true. Bản tham khảo chỉ xử lý lần cuối nên hiệu ứng trễ
// cả chục giây; ở đây mỗi lần cập nhật chỉ phát PHẦN TĂNG THÊM, nên hiệu ứng hiện
// ngay mà tổng kim cương vẫn đúng (không đếm trùng).
const STALE_AFTER_MS = 2 * 60 * 1000;

export function createGiftStreakTracker() {
  const streaks = new Map();

  function prune(now) {
    for (const [key, entry] of streaks) {
      if (now - entry.updatedAt > STALE_AFTER_MS) streaks.delete(key);
    }
  }

  /**
   * @param {{userId:string, giftId:string, groupId?:string, repeatCount:number, repeatEnd:boolean, streakable:boolean}} raw
   * @returns {number} số quà MỚI cần tính cho lần cập nhật này (0 = bỏ qua)
   */
  function delta(raw, now = Date.now()) {
    const repeatCount = Math.max(1, Math.floor(Number(raw.repeatCount) || 1));
    if (!raw.streakable) return repeatCount;
    const key = `${raw.userId}|${raw.giftId}|${raw.groupId || ''}`;
    const seen = streaks.get(key)?.count || 0;
    // repeatCount tụt xuống = combo mới bắt đầu (nguồn không gửi repeatEnd/groupId).
    const added = repeatCount >= seen ? repeatCount - seen : repeatCount;
    if (raw.repeatEnd) streaks.delete(key);
    else streaks.set(key, { count: repeatCount, updatedAt: now });
    if (streaks.size > 500) prune(now);
    return added;
  }

  return { delta, size: () => streaks.size };
}

// Chống trùng theo msgId (TikTok đôi khi gửi lại cùng một tin khi nối lại).
export function createEventDeduper(limit = 3000, keepMs = 10 * 60 * 1000) {
  const seen = new Map();
  return function isDuplicate(id, now = Date.now()) {
    if (!id) return false;
    const previous = seen.get(id);
    if (previous !== undefined && now - previous < keepMs) return true;
    seen.delete(id);
    seen.set(id, now);
    // Map giữ thứ tự chèn ⇒ phần tử đầu là cũ nhất; cắt bớt khi quá giới hạn.
    if (seen.size > limit) {
      for (const key of seen.keys()) {
        seen.delete(key);
        if (seen.size <= limit * 0.8) break;
      }
    }
    return false;
  };
}
