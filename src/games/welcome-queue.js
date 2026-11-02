// Chào mừng TỪNG người mới: người vào phòng (hoặc lần đầu tương tác khi đã ở sẵn trong phòng)
// được một lượt chào riêng có tên + avatar + hiệu ứng. Đông người vào cùng lúc thì xếp hàng,
// hàng càng dài chào càng nhanh nhưng KHÔNG bỏ ai. Phòng vượt ngưỡng người xem (mặc định 1000)
// thì chỉ hiện một dòng chữ cho mỗi người, vì lúc đó người vào liên tục mỗi giây.
// Hàng chờ quá GROUP_ABOVE người thì chào CẢ ĐOÀN: mỗi đợt tối đa GROUP_SIZE người, mỗi người
// vẫn có nhân vật + tên riêng cùng bước vào (ý của chủ kênh, 02/11/2026).
export const REGREET_AFTER_MS = 10 * 60 * 1000;
export const DEFAULT_TEXT_ABOVE = 1000;
const MAX_BACKLOG = 300; // quá số này thì phần dư chuyển sang dòng chữ, vẫn có tên
export const GROUP_ABOVE = 20;
export const GROUP_SIZE = 40; // chủ kênh muốn chào cả đoàn vài chục người một lúc

// Đợt càng đông càng cần thêm thời gian để cả đoàn kịp bước vào.
export function groupPace(people) {
  return 3600 + people * 45;
}

// Thời gian dành cho mỗi lượt chào riêng, theo số người còn chờ phía sau.
export function welcomePace(waiting) {
  return waiting > 10 ? 1500 : 2400;
}

export function createWelcomeQueue({ textAbove = DEFAULT_TEXT_ABOVE } = {}) {
  const greetedAt = new Map();
  const queue = [];
  let viewerCount = 0;
  let threshold = textAbove;
  let nextAt = 0;

  const card = (user, mode, extra = {}) => ({ kind: 'welcome', mode, userId: user.id, nickname: user.nickname, avatar: user.avatar, ...extra });

  return {
    setViewerCount(n) {
      if (Number.isFinite(n) && n >= 0) viewerCount = n;
    },
    viewerCount: () => viewerCount,
    setThreshold(n) {
      if (Number.isFinite(n) && n >= 0) threshold = Math.floor(n);
    },
    threshold: () => threshold,
    backlog: () => queue.length,
    // Ai đang chờ được chào: màn hình giữ nhân vật của họ ở ngoài cửa tới lượt mới cho vào.
    pendingIds: () => queue.map((u) => u.id),
    /** Gọi cho MỌI sự kiện có người xem. Trả hiệu ứng cần phát ngay (chỉ ở chế độ chữ). */
    notice(user, now = Date.now()) {
      if (!user?.id) return [];
      const last = greetedAt.get(user.id);
      if (last !== undefined && now - last < REGREET_AFTER_MS) return [];
      greetedAt.delete(user.id);
      greetedAt.set(user.id, now);
      if (greetedAt.size > 20000) greetedAt.delete(greetedAt.keys().next().value);
      if (viewerCount > threshold || queue.length >= MAX_BACKLOG) return [card(user, 'text')];
      queue.push(user);
      return [];
    },
    /** Đến lượt thì phát thẻ chào cho người đứng đầu hàng. */
    tick(now = Date.now()) {
      if (!queue.length || now < nextAt) return [];
      if (queue.length > GROUP_ABOVE) {
        const people = queue.splice(0, GROUP_SIZE).map(({ id, nickname, avatar }) => ({ userId: id, nickname, avatar }));
        const pace = groupPace(people.length);
        nextAt = now + pace;
        return [{ kind: 'welcome', mode: 'group', people, durationMs: pace + 300, waiting: queue.length }];
      }
      const user = queue.shift();
      const pace = welcomePace(queue.length);
      nextAt = now + pace;
      return [card(user, 'full', { durationMs: pace + 300, waiting: queue.length })];
    },
    reset() {
      viewerCount = 0;
      greetedAt.clear();
      queue.length = 0;
      nextAt = 0;
    }
  };
}
