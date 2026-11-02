// Giữ cả 3 game sống cùng lúc; chỉ game ĐANG CHỌN nhận sự kiện live và lên màn hình.
// Đổi game giữa buổi live không làm mất trạng thái game kia (quay lại vẫn còn nguyên).
import { createBarClubGame } from './bar-club-game.js';
import { createSessionLeaderboard } from './session-leaderboard.js';
import { createSwimPushGame } from './swim-push-game.js';
import { createTempleGame } from './temple-game.js';

export function createGameHub({ startGame = 'bar', random = Math.random } = {}) {
  const games = new Map([
    ['bar', createBarClubGame({ random })],
    ['swim', createSwimPushGame()],
    ['temple', createTempleGame({ random })]
  ]);
  const board = createSessionLeaderboard();
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
      board.record(event, now);
      return active().handleEvent(event, now);
    },
    // Mọi game đều chạy tick (để khách hết hạn tự rời, vòng bơi tự kết thúc) nhưng chỉ
    // hiệu ứng của game đang chọn được gửi lên màn hình.
    tick(now = Date.now()) {
      let fx = [];
      for (const game of games.values()) {
        const out = game.tick(now);
        if (game.id === activeId) fx = out;
      }
      return fx;
    },
    command(gameId, name, now = Date.now()) {
      const game = games.get(gameId);
      if (!game) throw new Error(`Không có game "${gameId}"`);
      const fx = game.command(name, now);
      return gameId === activeId ? fx : [];
    },
    resetSession() {
      board.reset();
    },
    snapshot(now = Date.now()) {
      return {
        game: activeId,
        state: active().snapshot(now),
        top: board.top(5),
        totals: board.totals(),
        // Màn hình phải hiện nhãn "CHẾ ĐỘ THỬ" khi vừa có sự kiện giả lập.
        testMode: now - lastSimulatedAt < 20000
      };
    }
  };
}
