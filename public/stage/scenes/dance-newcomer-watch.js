// Nhận ra người THẬT vừa vào sàn (có trong ảnh chụp này, chưa có ở ảnh chụp trước). Người ảo không tính. Ảnh chụp ĐẦU
// TIÊN (mở / tải lại màn giữa buổi) chỉ ghi nhớ, không coi cả sàn là người mới.
export function createNewcomerWatch() {
  let known = null; // Set id ở ảnh chụp trước; null = chưa có ảnh chụp nào

  return {
    /** id người thật mới vào so với ảnh chụp trước. */
    fresh(dancers) {
      const ids = dancers.map((d) => d.id);
      const out = known ? ids.filter((id) => !known.has(id) && !String(id).startsWith('seed:')) : [];
      known = new Set(ids);
      return out;
    }
  };
}
