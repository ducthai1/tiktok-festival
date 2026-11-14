// 👑 BẢNG VÀNG = những người tặng nhiều 💎 nhất TỪ TRƯỚC TỚI NAY (chủ kênh muốn thấy cả lịch sử cũ, không chỉ buổi đang live).
// Nguồn: data/gifts.log — app.js ghi mỗi món quà THẬT một dòng, nút "Xoá dữ liệu phiên live trước" không xoá log → khởi động lại
// server / xoá dữ liệu phiên vẫn nạp lại đủ. Quà mới cộng dồn ngay. Khoá theo @uniqueId (log ghi @uniqueId); log không có ảnh đại
// diện → ảnh lấy khi người đó có mặt trong live (và giữ trong bản lưu nóng). Quà THỬ (chế độ thử) chỉ tính tạm, phòng live mới là xoá.

// [2026-11-14 18:52:10] [GIFT] Tên hiển thị (@uniqueid): Rose x3 (3💎)
const LINE = /^\[[^\]]*\] \[GIFT\] (.*) \(@([^()\s]+)\): .* x\d+ \((\d+)💎\)\s*$/;

/** Tổng 💎 theo người từ nội dung gifts.log: Map key → { key, nickname, diamonds } (dòng hỏng / lạ bỏ qua). */
export function parseGiftLog(text) {
  const totals = new Map();
  for (const line of String(text || '').split('\n')) {
    const m = LINE.exec(line);
    const diamonds = m ? Number(m[3]) : 0;
    if (!(diamonds > 0)) continue;
    const row = totals.get(m[2]) || { key: m[2], nickname: m[1], diamonds: 0 };
    row.nickname = m[1]; // tên mới nhất
    row.diamonds += diamonds;
    totals.set(m[2], row);
  }
  return totals;
}

export function createDonorLedger() {
  const rows = new Map(); // key → { key, id, nickname, avatar, diamonds } — quà thật (lịch sử + live)
  const test = new Map(); // quà thử — tạm
  let cache = null; // bảng xếp sẵn (màn hình hỏi ~10 lần/giây)
  const keyOf = (user) => String(user?.uniqueId || user?.id || '');
  const blank = (key) => ({ key, id: '', nickname: '', avatar: '', diamonds: 0 });

  return {
    /** Nạp lịch sử (nội dung gifts.log) — gọi một lần lúc khởi động. */
    load(text) {
      for (const [key, r] of parseGiftLog(text)) {
        const row = rows.get(key) || blank(key);
        row.nickname = r.nickname;
        row.diamonds += r.diamonds;
        rows.set(key, row);
      }
      cache = null;
    },
    /** Mọi sự kiện live: quà → cộng 💎; người đã có trên sổ → cập nhật tên + ảnh đại diện. */
    record(event) {
      const user = event?.user;
      const key = keyOf(user);
      if (!key) return;
      if (event.type === 'gift' && event.gift?.diamonds > 0) {
        const book = event.simulated ? test : rows;
        const row = book.get(key) || blank(key);
        row.diamonds += event.gift.diamonds;
        book.set(key, row);
        cache = null;
      }
      for (const book of [rows, test]) {
        const row = book.get(key);
        if (!row) continue;
        const fresh = { id: user.id || row.id, nickname: user.nickname || row.nickname, avatar: user.avatar || row.avatar };
        if (fresh.id === row.id && fresh.nickname === row.nickname && fresh.avatar === row.avatar) continue;
        Object.assign(row, fresh);
        cache = null;
      }
    },
    top(n = 3) {
      if (!cache) {
        const all = new Map(rows);
        for (const [key, t] of test) all.set(key, { ...t, ...all.get(key), diamonds: (all.get(key)?.diamonds || 0) + t.diamonds });
        cache = [...all.values()].sort((a, b) => b.diamonds - a.diamonds).slice(0, 10)
          .map((r) => ({ id: r.id || r.key, nickname: r.nickname || r.key, avatar: r.avatar, diamonds: r.diamonds }));
      }
      return cache.slice(0, n);
    },
    /** Phòng live mới / "Xoá dữ liệu phiên live trước": bỏ quà thử (quà thật là lịch sử — giữ). */
    clearTest() {
      test.clear();
      cache = null;
    },
    /** Ảnh đại diện của những người đứng đầu → bản lưu nóng (log không có ảnh). */
    faces() {
      return [...rows.values()].filter((r) => r.avatar).sort((a, b) => b.diamonds - a.diamonds).slice(0, 30)
        .map((r) => ({ key: r.key, id: r.id, avatar: r.avatar }));
    },
    restoreFaces(list) {
      for (const f of Array.isArray(list) ? list : []) {
        const row = rows.get(String(f?.key || ''));
        if (row && !row.avatar && f.avatar) Object.assign(row, { avatar: String(f.avatar), id: row.id || String(f.id || '') });
      }
      cache = null;
    }
  };
}
