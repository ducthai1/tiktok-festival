// Nhớ phòng live gần nhất (data/live-room.json) để biết khi nào đã sang PHÒNG MỚI: mất kết nối rồi nối lại, hay khởi động lại server
// giữa buổi thì vẫn cùng room id → không xoá gì; tắt live mở live mới → room id khác → app.js xoá thông số của phòng cũ.
import fs from 'node:fs';

export function createRoomTracker(file) {
  let last = '';
  try {
    last = String(JSON.parse(fs.readFileSync(file, 'utf8')).roomId || '');
  } catch {
    // chưa có file (lần đầu): phòng đầu tiên nối vào coi như phòng mới (trạng thái khôi phục từ bản lưu là của phòng không rõ)
  }
  return {
    last: () => last,
    /** true nếu `roomId` khác phòng đã lưu (và lưu lại phòng mới). */
    isNew(roomId) {
      const id = String(roomId || '');
      if (!id || id === last) return false;
      last = id;
      try {
        fs.writeFileSync(file, JSON.stringify({ roomId: id, at: new Date().toISOString() }));
      } catch (error) {
        console.warn('[live] không lưu được phòng live hiện tại:', error.message);
      }
      return true;
    }
  };
}
