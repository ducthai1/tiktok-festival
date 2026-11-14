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
import { createQuizGames } from './quiz/quiz-games.js';

/** Mốc chúc mừng người ủng hộ: mỗi 100 💎 cộng dồn trong một phòng live. */
export const DONOR_STEP = 100;

export function createGameHub({ startGame = 'boss', random = Math.random, welcomeTextAbove = DEFAULT_TEXT_ABOVE, englishProgress = null,
  onEnglishAnswer = null, englishListenReady = () => false } = {}) {
  const games = new Map([
    ['boss', createBossRaidGame({ random })],
    ['temple', createTempleGame({ random })],
    ['bar', createBarClubGame({ random })],
    ['dance', createDanceHallGame({ random, seedCount: SEED_TARGET })],
    ['swim', createSwimPushGame()],
    ...createQuizGames({ random, englishProgress, onEnglishAnswer, englishListenReady }).map((g) => [g.id, g])
  ]);
  const board = createSessionLeaderboard();
  const welcome = createWelcomeQueue({ textAbove: welcomeTextAbove });
  let activeId = games.has(startGame) ? startGame : 'bar';
  let lastSimulatedAt = 0;

  const active = () => games.get(activeId);

  // 🎉 Chúc mừng người ủng hộ: cộng dồn 💎 mỗi người tặng TRONG PHÒNG LIVE NÀY; vượt mốc 100 / 200 / 300… → màn chúc mừng toàn màn hình
  // (stage-celebration.js). Một món lớn vượt nhiều mốc một lúc → một màn với mốc cao nhất. Phòng live mới thì đếm lại.
  const roomDonations = new Map(); // id → 💎 đã tặng trong phòng này
  function donorMilestone(event) {
    if (event.type !== 'gift' || !event.user?.id || !(event.gift?.diamonds > 0)) return [];
    const before = roomDonations.get(event.user.id) || 0;
    const total = before + event.gift.diamonds;
    roomDonations.set(event.user.id, total);
    if (Math.floor(total / DONOR_STEP) <= Math.floor(before / DONOR_STEP)) return [];
    const milestone = Math.floor(total / DONOR_STEP) * DONOR_STEP;
    if (!event.simulated) console.log(`[app] 🎉 ${event.user.nickname} đạt mốc ${milestone}💎 trong phòng (tổng ${total}💎)`);
    return [{ kind: 'donorMilestone', userId: event.user.id, nickname: event.user.nickname, avatar: event.user.avatar, milestone, total }];
  }

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
      return [...fx, ...donorMilestone(event), ...welcome.notice(event.user, now)];
    },
    /** Danh mục quà thật của phòng → game nào cần (tab tiếng Anh gán quà đổi bộ đề). */
    setGiftCatalog(catalog) {
      for (const game of games.values()) game.setGiftCatalog?.(catalog);
    },
    setWelcomeThreshold(n) {
      welcome.setThreshold(n);
    },
    // Mọi game đều chạy tick (để khách hết hạn tự rời, vòng bơi tự kết thúc) nhưng chỉ
    // hiệu ứng của game đang chọn được gửi lên màn hình.
    tick(now = Date.now()) {
      let fx = [];
      for (const game of games.values()) {
        const out = game.tick(now, game.id === activeId);
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
    /** Tab 🎁 Quà (trang điều khiển): luật quà tab tiếng Anh. */
    setEnglishRules(rules) {
      games.get('english')?.setEnglishRules?.(rules);
    },
    /** Phòng live mới: mỗi game xoá thông số của phòng cũ (game quiz: năng lượng, follow, share, chế độ đề) — giữ bảng xếp hạng. */
    resetRoom() {
      roomDonations.clear();
      for (const game of games.values()) game.resetRoom?.();
      welcome.reset(); // phòng mới: chào lại người vào
    },
    restore(snapshot) {
      if (!snapshot) return;
      if (snapshot.game && games.has(snapshot.game)) activeId = snapshot.game;
      if (snapshot.state) active().restore?.(snapshot.state);
      if (snapshot.leaderboard) board.restore(snapshot.leaderboard);
      else if (snapshot.totals) board.restore({ totals: snapshot.totals, viewers: snapshot.top });
    },
    snapshot(now = Date.now()) {
      return {
        game: activeId,
        state: active().snapshot(now),
        top: board.top(),
        totals: board.totals(),
        leaderboard: board.exportState(),
        viewers: { count: welcome.viewerCount(), textAbove: welcome.threshold(), waiting: welcome.backlog(), pending: welcome.pendingIds() },
        // Màn hình phải hiện nhãn "CHẾ ĐỘ THỬ" khi vừa có sự kiện giả lập.
        testMode: now - lastSimulatedAt < 20000
      };
    }
  };
}
