// Giữ các game sống cùng lúc; chỉ game ĐANG CHỌN nhận sự kiện live và lên màn hình.
// Đổi game giữa buổi live không làm mất trạng thái game kia (quay lại vẫn còn nguyên).
import { createBarClubGame } from './bar-club-game.js';
import { createBossRaidGame } from './boss-raid-game.js';
import { createDanceHallGame } from './dance-hall-game.js';
import { SEED_TARGET } from './dance-seed-crowd.js';
import { createSessionLeaderboard } from './session-leaderboard.js';
import { createSwimPushGame } from './swim-push-game.js';
import { createTempleGame } from './temple-game.js';
import { createWelcomeQueue, DEFAULT_TEXT_ABOVE } from './welcome-queue.js';

export function createGameHub({ startGame = 'boss', random = Math.random, welcomeTextAbove = DEFAULT_TEXT_ABOVE } = {}) {
  const games = new Map([
    ['boss', createBossRaidGame({ random })],
    ['temple', createTempleGame({ random })],
    ['bar', createBarClubGame({ random })],
    ['dance', createDanceHallGame({ random, seedCount: SEED_TARGET })],
    ['swim', createSwimPushGame()]
  ]);
  const board = createSessionLeaderboard();
  const welcome = createWelcomeQueue({ textAbove: welcomeTextAbove });
  let activeId = games.has(startGame) ? startGame : 'bar';
  let lastSimulatedAt = 0;

  const active = () => games.get(activeId);

  return {
    list: () => [...games.values()].map((g) => ({ id: g.id, title: g.title })),
    activeId: () => activeId,
    switchTo(id) {
      if (!games.has(id)) throw new Error(`Không có game "${id}"`);
      activeId = id;
    },
    handleEvent(event, now = Date.now()) {
      if (event.simulated) lastSimulatedAt = now;
      if (event.type === 'viewers') {
        welcome.setViewerCount(event.viewerCount);
        return [];
      }
      if (event.viewerCount) welcome.setViewerCount(event.viewerCount);
      board.record(event, now);
      const fx = active().handleEvent(event, now);
      return [...fx, ...welcome.notice(event.user, now)];
    },
    setWelcomeThreshold(n) {
      welcome.setThreshold(n);
    },
    // Mọi game đều chạy tick (để khách hết hạn tự rời, vòng bơi tự kết thúc) nhưng chỉ
    // hiệu ứng của game đang chọn được gửi lên màn hình.
    tick(now = Date.now()) {
      let fx = [];
      for (const game of games.values()) {
        const out = game.tick(now);
        if (game.id === activeId) fx = out;
      }
      return [...fx, ...welcome.tick(now)];
    },
    command(gameId, name, now = Date.now()) {
      const game = games.get(gameId);
      if (!game) throw new Error(`Không có game "${gameId}"`);
      const fx = game.command(name, now);
      return gameId === activeId ? fx : [];
    },
    resetSession() {
      board.reset();
      welcome.reset();
    },
    snapshot(now = Date.now()) {
      return {
        game: activeId,
        state: active().snapshot(now),
        top: board.top(5),
        totals: board.totals(),
        viewers: { count: welcome.viewerCount(), textAbove: welcome.threshold(), waiting: welcome.backlog(), pending: welcome.pendingIds() },
        // Màn hình phải hiện nhãn "CHẾ ĐỘ THỬ" khi vừa có sự kiện giả lập.
        testMode: now - lastSimulatedAt < 20000
      };
    }
  };
}
