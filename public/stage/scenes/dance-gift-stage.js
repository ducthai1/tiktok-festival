// Sân khấu "khoảnh khắc quà" của Sàn Nhảy:
// - Câu cảm ơn đi TRƯỚC, hiệu ứng làm NỀN: hiệu ứng của một khoảnh khắc chạy đúng lúc giọng bắt đầu đọc (chờ tối đa
//   maxWaitMs — giọng chậm / lỗi / đang tắt thì hiệu ứng vẫn chạy, không bao giờ treo).
// - Quà LỚN (≥ 200 💎) ĐỘC CHIẾM sân khấu: xếp hàng, diễn LẦN LƯỢT; mỗi khoảnh khắc giữ sân khấu `holdMs` kể từ lúc giọng
//   bắt đầu đọc rồi mới tới khoảnh khắc kế. Trong lúc đó (đang diễn hoặc đang chờ) quà nhỏ chỉ hiện thông báo — không đọc,
//   không tiếng, không chen ngang làm loãng màn bùng nổ của quà tốn tiền. Follow / DROP / solo của người khác thì xếp hàng sau.
// - Sân khấu rảnh: quà nhỏ / follow diễn ngay (giọng trước, hiệu ứng sau) và không giữ sân khấu.
export function createGiftStage({ speak, maxWaitMs = 5000 } = {}) {
  const queue = [];
  const loose = []; // khoảnh khắc nhỏ đang chờ giọng (để solo của chính người đó gắn vào, không hiện trước giọng)
  let current = null;

  const safe = (fn) => {
    try {
      fn();
    } catch (error) {
      console.error('[gift-stage]', error);
    }
  };
  const moment = (o = {}) => ({ userId: o.userId ?? null, line: o.line || '', effects: [...(o.effects || [])], holdMs: o.holdMs || 0, started: false,
    fallback: o.fallback || '', waitMs: o.waitMs || 0 });

  // giọng bắt đầu đọc (hoặc hết giờ chờ) → chạy hết hiệu ứng của khoảnh khắc
  function perform(m, onBegin) {
    let timer = 0;
    const begin = () => {
      if (m.started) return;
      m.started = true;
      clearTimeout(timer);
      const i = loose.indexOf(m);
      if (i >= 0) loose.splice(i, 1);
      for (const fn of m.effects.splice(0)) safe(fn);
      onBegin?.();
    };
    timer = setTimeout(begin, maxWaitMs);
    if (m.line) speak(m.line, begin, m); // m.fallback / m.waitMs: câu dự phòng khi câu chính chưa kịp có giọng
    else begin();
  }

  function next() {
    if (current || !queue.length) return;
    const m = queue.shift();
    current = m;
    perform(m, () => setTimeout(() => {
      if (current === m) current = null;
      next();
    }, m.holdMs));
  }

  return {
    /** Có khoảnh khắc lớn đang diễn / đang chờ → quà nhỏ chỉ hiện thông báo. */
    busy: () => Boolean(current) || queue.length > 0,
    /** Khoảnh khắc lớn: xếp hàng, độc chiếm sân khấu holdMs. Trả về khoảnh khắc để gắn thêm hiệu ứng đi kèm (attach). */
    big(options) {
      const m = moment(options);
      queue.push(m);
      next();
      return m;
    },
    /** Khoảnh khắc nhỏ lúc sân khấu rảnh: diễn ngay, không giữ sân khấu. */
    now(options) {
      const m = moment(options);
      loose.push(m);
      perform(m);
      return m;
    },
    /** Gắn hiệu ứng đi kèm (pháo hoa, DROP… của cùng lượt quà) vào khoảnh khắc: chưa tới lúc thì chờ, đang diễn thì chạy luôn. */
    attach(m, fn) {
      if (m.started) safe(fn);
      else m.effects.push(fn);
    },
    /**
     * Hiệu ứng lẻ (solo, DROP do thanh Độ Quẩy…): thuộc người đang có khoảnh khắc → chạy cùng khoảnh khắc đó; sân khấu bận →
     * xếp hàng diễn sau; rảnh → chạy luôn.
     */
    run(fn, userId = null) {
      const owner = userId == null ? null : [current, ...queue, ...loose].find((m) => m?.userId === userId && !(m.started && m !== current));
      if (owner) return this.attach(owner, fn);
      if (current || queue.length) {
        queue.push(moment({ effects: [fn] }));
        return next();
      }
      return safe(fn);
    },
    clear() {
      queue.length = 0;
      loose.length = 0;
      current = null;
    }
  };
}
