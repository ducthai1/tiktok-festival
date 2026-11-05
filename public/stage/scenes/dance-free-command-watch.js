// Nhận ra người THẬT vừa gõ lệnh miễn phí (đổi nv / to lên / nhỏ lại / bay lên / nhảy / quẩy / vẫy) từ các ảnh chụp trạng
// thái sàn: kiểu nhân vật hoặc cỡ đổi, bay lên tầng cao hơn, hoặc vừa VÀO một động tác. Bỏ qua người ảo (tự nhảy ngẫu nhiên), xe bay (quà) và lúc DROP
// (cả sàn cùng quẩy); hết động tác (về đứng nhảy thường) không tính. Người mới vào sàn chưa có ảnh trước → không tính.
const COMMAND_MOVES = ['jump', 'hype', 'wave'];

export function createFreeCommandWatch() {
  const last = new Map(); // id → { look, size, move } ở ảnh chụp trước

  return {
    /** true nếu người `d` vừa dùng lệnh miễn phí so với ảnh chụp trước. */
    used(d, dropping) {
      const now = { look: d.look, size: d.size, level: d.level || 0, move: dropping ? '' : d.move || '' };
      const before = last.get(d.id);
      last.set(d.id, now);
      if (!before || String(d.id).startsWith('seed:')) return false;
      return now.look !== before.look || now.size !== before.size || now.level > before.level
        || (now.move !== before.move && COMMAND_MOVES.includes(now.move));
    },
    /** Quên người đã rời sàn. */
    keepOnly(ids) {
      for (const id of last.keys()) if (!ids.has(id)) last.delete(id);
    }
  };
}
