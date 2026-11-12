// Ghi nhớ "từ nào đã hỏi trong vòng này" ra đĩa (data/english-seen.json) — khởi động lại server không hỏi lại từ đầu.
// Ghi không chặn, gom lại tối đa mỗi vài giây; lúc tắt server thì flush() ghi đồng bộ.
import fs from 'node:fs';
import path from 'node:path';

export function createProgressStore(file, { delayMs = 5000 } = {}) {
  let pending = null;
  let timer = null;
  const write = (list, sync) => {
    const text = JSON.stringify({ savedAt: new Date().toISOString(), seen: list });
    if (sync) return fs.writeFileSync(file, text);
    fs.writeFile(file, text, (error) => {
      if (error) console.warn('[english] không lưu được tiến độ xoay vòng:', error.message);
    });
  };
  return {
    load() {
      try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        return Array.isArray(data.seen) ? data.seen.map(String) : [];
      } catch {
        return [];
      }
    },
    save(list) {
      pending = list;
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        write(pending, false);
      }, delayMs);
      timer.unref?.();
    },
    flush() {
      if (!timer) return;
      clearTimeout(timer);
      timer = null;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      write(pending, true);
    }
  };
}
