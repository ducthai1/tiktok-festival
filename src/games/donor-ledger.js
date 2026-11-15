// 👑 BẢNG VÀNG = 3 người tặng nhiều 💎 nhất TRONG PHIÊN LIVE HIỆN TẠI (chủ kênh 15/11/2026: chỉ phiên đang live, không cộng các phiên cũ).
// Mọi tab quiz dùng chung một sổ (game-hub.js). Rớt live / khởi động lại server giữa phiên: khôi phục từ bản lưu nóng.
// Phòng live mới (room id khác) hoặc nút "Xoá dữ liệu phiên live trước" → sổ trống.
export function createDonorLedger() {
  const rows = new Map(); // @uniqueId → { key, id, nickname, avatar, diamonds }
  let cache = null; // bảng xếp sẵn (màn hình hỏi ~10 lần/giây)
  const keyOf = (user) => String(user?.uniqueId || user?.id || '');

  return {
    /** Mọi sự kiện live: quà → cộng 💎; người đã có trên sổ → cập nhật tên + ảnh đại diện. */
    record(event) {
      const user = event?.user;
      const key = keyOf(user);
      if (!key) return;
      let row = rows.get(key);
      if (event.type === 'gift' && event.gift?.diamonds > 0) {
        row ??= { key, id: '', nickname: '', avatar: '', diamonds: 0 };
        row.diamonds += event.gift.diamonds;
        rows.set(key, row);
        cache = null;
      }
      if (!row) return;
      const fresh = { id: user.id || row.id, nickname: user.nickname || row.nickname, avatar: user.avatar || row.avatar };
      if (fresh.id === row.id && fresh.nickname === row.nickname && fresh.avatar === row.avatar) return;
      Object.assign(row, fresh);
      cache = null;
    },
    top(n = 3) {
      cache ??= [...rows.values()].sort((a, b) => b.diamonds - a.diamonds).slice(0, 10)
        .map((r) => ({ id: r.id || r.key, nickname: r.nickname || r.key, avatar: r.avatar, diamonds: r.diamonds }));
      return cache.slice(0, n);
    },
    clear() {
      rows.clear();
      cache = null;
    },
    /** → bản lưu nóng (người đứng đầu; người ít hơn top 50 không ảnh hưởng top 3). */
    exportState() {
      return [...rows.values()].sort((a, b) => b.diamonds - a.diamonds).slice(0, 50);
    },
    restore(list) {
      for (const r of Array.isArray(list) ? list : []) {
        const key = String(r?.key || '');
        if (key && r.diamonds > 0) rows.set(key, { key, id: String(r.id || ''), nickname: String(r.nickname || ''), avatar: String(r.avatar || ''), diamonds: Number(r.diamonds) });
      }
      cache = null;
    }
  };
}
