// Giữ lại nhật ký TỪNG PHIÊN LIVE: mỗi phòng live một file trong data/logs/sessions/.
//
// Vì sao cần, khi đã có log theo ngày (logger.js):
//   - log ngày trộn lẫn mọi buổi live trong ngày, lại chỉ giữ 14 ngày rồi tự xoá;
//   - khi cần truy "tối hôm đó mất dữ liệu lúc nào, ai tặng gì, đổi bộ đề mấy lần" thì phải
//     lần giữa hàng nghìn dòng của cả ngày, và sau hai tuần là mất hẳn.
// File phiên tách riêng từng buổi, có đầu/cuối ghi rõ giờ và thời lượng, và giữ lâu hơn nhiều.
//
// Một phiên = một room id. Mất kết nối rồi nối lại, hay khởi động lại server GIỮA BUỔI, vẫn cùng
// room id → ghi tiếp vào đúng file cũ (cùng quy ước với room-tracker.js), không cắt thành hai buổi.
// data/ không lên git — log có tên người xem (xem .gitignore).
import fs from 'node:fs';
import path from 'node:path';
import { addLogSink, timestamp } from './logger.js';

/** Giữ bấy nhiêu buổi gần nhất. 60 buổi ≈ 2 tháng live hằng ngày — đủ để truy lại mùa giải trước. */
export const KEEP_SESSIONS = 60;
/** Nối lại vào file cũ nếu buổi đó mới ghi trong vòng ngần này (khởi động lại giữa buổi). */
export const RESUME_WINDOW_MS = 12 * 3600 * 1000;

const safeId = (roomId) => String(roomId || 'khong-ro').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16) || 'khong-ro';
const pad = (n) => String(n).padStart(2, '0');
const fileNameFor = (date, roomId) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`
  + `_${safeId(roomId)}.log`;

/**
 * @param {string} logDir thư mục log (data/logs) — file phiên nằm trong logDir/sessions
 * @param {{ now?: () => number }} [opts] now bơm vào để test không phải chờ đồng hồ thật
 */
export function createSessionLog(logDir, { now = () => Date.now() } = {}) {
  const dir = path.join(logDir, 'sessions');
  const indexFile = path.join(dir, 'index.json');
  let current = null; // { file, roomId, startedAt, lines, buffer }
  let detach = null;
  let timer = null;

  const readIndex = () => {
    try {
      const data = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
      return Array.isArray(data) ? data : [];
    } catch {
      return []; // chưa có file hoặc hỏng: coi như chưa có phiên nào
    }
  };

  const writeIndex = (rows) => {
    try {
      fs.writeFileSync(indexFile, `${JSON.stringify(rows, null, 1)}\n`);
    } catch (error) {
      console.warn('[phiên] không ghi được danh sách phiên:', error.message);
    }
  };

  /** Xoá file phiên cũ nhất khi vượt KEEP_SESSIONS, và bỏ khỏi danh sách cả dòng trỏ tới file đã mất. */
  const prune = () => {
    let rows = readIndex().filter((r) => r && typeof r.file === 'string');
    rows = rows.filter((r) => r.file === current?.file || fs.existsSync(path.join(dir, r.file)));
    rows.sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));
    while (rows.length > KEEP_SESSIONS) {
      const old = rows.shift();
      if (old.file === current?.file) { rows.unshift(old); break; } // không bao giờ xoá file đang ghi
      try {
        fs.unlinkSync(path.join(dir, old.file));
      } catch {
        // xoá không được thì bỏ qua, lần sau dọn tiếp
      }
    }
    writeIndex(rows);
    return rows;
  };

  const upsert = (patch) => {
    const rows = readIndex();
    const at = rows.findIndex((r) => r.file === patch.file);
    if (at >= 0) rows[at] = { ...rows[at], ...patch };
    else rows.push(patch);
    writeIndex(rows);
  };

  // writing = chốt chống đệ quy: một cảnh báo phát ra TỪ TRONG lúc ghi lại đi qua
  // console.warn → logger → chính sink này. Bỏ qua dòng đó thay vì ghi lồng vô tận.
  let writing = false;

  /**
   * Ghi đợt dòng đang gom xuống file.
   * Cố tình KHÔNG dùng createWriteStream: stream mở fd bất đồng bộ, nên một file vừa bị dọn
   * có thể được stream chưa kịp mở tạo lại — dọn xong vẫn còn nguyên. appendFileSync thì không.
   * Gom theo đợt 2 giây nên cả buổi live chỉ vài nghìn lần ghi, không chặn vòng lặp sự kiện.
   */
  const flush = () => {
    if (!current?.buffer.length || writing) return;
    const batch = current.buffer.join('');
    current.buffer.length = 0;
    writing = true;
    try {
      fs.appendFileSync(path.join(dir, current.file), batch);
    } catch (error) {
      console.warn('[phiên] không ghi được file phiên:', error.message);
    } finally {
      writing = false;
    }
  };

  const line = (text) => {
    if (!current || writing) return;
    current.buffer.push(`${text}\n`);
    current.lines += 1;
    if (current.buffer.length >= 200) flush(); // phòng khi live rất đông, đừng giữ quá nhiều trong bộ nhớ
  };

  return {
    /** Gọi một lần lúc khởi động: tạo thư mục, dọn phiên cũ, và bắt đầu chép mọi dòng log vào file phiên. */
    setup() {
      fs.mkdirSync(dir, { recursive: true });
      prune();
      detach?.();
      detach = addLogSink((text) => line(text));
      return dir;
    },

    /**
     * Vào phòng live `roomId`. Cùng phòng với phiên đang mở → không làm gì.
     * Phòng đó vừa ghi trong RESUME_WINDOW_MS (khởi động lại giữa buổi) → mở lại đúng file cũ.
     */
    start(roomId, { reason = '' } = {}) {
      const id = String(roomId || '');
      if (!id) return null;
      if (current?.roomId === id) return current.file;
      this.end('sang phòng khác');

      const nowMs = now();
      const resumed = readIndex().find((r) => r.roomId === id && nowMs - Date.parse(r.lastAt || r.startedAt || 0) < RESUME_WINDOW_MS
        && fs.existsSync(path.join(dir, r.file)));
      const file = resumed ? resumed.file : fileNameFor(new Date(nowMs), id);
      const startedAt = resumed ? resumed.startedAt : new Date(nowMs).toISOString();

      try {
        fs.appendFileSync(path.join(dir, file), ''); // tạo file ngay để prune() ngay dưới nhìn thấy
      } catch (error) {
        console.warn('[phiên] không mở được file phiên:', error.message);
        return null;
      }
      current = { file, roomId: id, startedAt, lines: resumed?.lines || 0, buffer: [] };
      // đẩy định kỳ: mất điện giữa buổi thì cùng lắm mất 2 giây cuối. unref để không giữ tiến trình sống.
      if (!timer) {
        timer = setInterval(flush, 2000);
        timer.unref?.(); // không giữ tiến trình sống chỉ vì cái hẹn giờ này
      }

      line(`${'='.repeat(78)}`);
      line(`${timestamp(new Date(nowMs))} ${resumed ? 'GHI TIẾP' : 'BẮT ĐẦU'} phiên live · phòng ${id}${reason ? ` · ${reason}` : ''}`);
      line(`${'='.repeat(78)}`);
      upsert({ file, roomId: id, startedAt, lastAt: new Date(nowMs).toISOString(), lines: current.lines, open: true });
      prune();
      return file;
    },

    /** Đóng phiên đang mở, ghi giờ kết thúc + thời lượng xuống cuối file. */
    end(reason = '') {
      if (!current) return null;
      const nowMs = now();
      const mins = Math.max(0, Math.round((nowMs - Date.parse(current.startedAt)) / 60000));
      const dur = `${Math.floor(mins / 60)} giờ ${mins % 60} phút`;
      line(`${'-'.repeat(78)}`);
      line(`${timestamp(new Date(nowMs))} KẾT THÚC phiên · phòng ${current.roomId} · dài ${dur}${reason ? ` · ${reason}` : ''}`);
      flush();
      const closed = current;
      current = null;
      upsert({ file: closed.file, roomId: closed.roomId, startedAt: closed.startedAt, lastAt: new Date(nowMs).toISOString(),
        lines: closed.lines, minutes: mins, open: false, reason });
      return closed.file;
    },

    /**
     * Tắt server: đóng phiên còn mở, ngừng chép log, và CHỜ file ghi xong.
     * Có chờ vì main.js gọi process.exit(0) ngay sau đó — không chờ thì mất mấy dòng cuối.
     */
    async close(reason = 'tắt server') {
      this.end(reason);
      detach?.();
      detach = null;
      if (timer) clearInterval(timer);
      timer = null;
    },

    /** Phiên đang mở, hoặc null. */
    current: () => (current ? { file: current.file, roomId: current.roomId, startedAt: current.startedAt, lines: current.lines } : null),
    /** Danh sách phiên đã lưu, mới nhất trước. */
    list: () => readIndex().sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt))),
    dir: () => dir
  };
}
