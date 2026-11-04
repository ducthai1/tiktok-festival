// "Khoảnh khắc quà": câu cảm ơn đi TRƯỚC, hiệu ứng làm NỀN cho câu đó. Giọng đọc mất vài giây để tạo, nên khi có quà / follow:
// hold() giữ cổng → tiếng hiệu ứng, thẻ quà lớn, pháo hoa, DROP, nhạc VIP… gọi qua run() đều xếp hàng → giọng bắt đầu đọc
// (release) thì tất cả chạy cùng lúc, giọng nằm trên (hiệu ứng bị hạ nhỏ trong lúc đọc). Chờ tối đa `maxWaitMs` — giọng chậm /
// lỗi / đang tắt thì hiệu ứng vẫn chạy, không bao giờ treo. Thứ tự trong hàng giữ nguyên.
export function createMomentGate({ maxWaitMs = 5000 } = {}) {
  let holds = 0;
  const waiting = [];
  const timers = new Set();

  function flush() {
    while (!holds && waiting.length) {
      try {
        waiting.shift()();
      } catch (error) {
        console.error('[moment]', error);
      }
    }
  }

  return {
    /** Giữ cổng; trả về hàm release (gọi nhiều lần cũng chỉ tính một). */
    hold() {
      holds += 1;
      let released = false;
      const timer = setTimeout(() => release(), maxWaitMs);
      timers.add(timer);
      function release() {
        if (released) return;
        released = true;
        clearTimeout(timer);
        timers.delete(timer);
        holds -= 1;
        flush();
      }
      return release;
    },
    /** Chạy `fn` ngay nếu cổng mở, không thì chờ tới lúc giọng đọc bắt đầu. */
    run(fn) {
      if (holds) waiting.push(fn);
      else fn();
    },
    clear() {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      waiting.length = 0;
      holds = 0;
    }
  };
}
