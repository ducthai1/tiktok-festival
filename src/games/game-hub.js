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
import { createDonorLedger } from './donor-ledger.js';

/** Mốc chúc mừng người ủng hộ: mỗi 50 💎 cộng dồn trong một phòng live (50, 100, 150, 200...). */
export const DONOR_STEP = 50;
/** Quà tham gia CLB người hâm mộ: tặng món này là vào CLB (id + tên, phòng khi TikTok đổi id). */
export const FANCLUB_GIFT_IDS = new Set(['7934']);
export const FANCLUB_GIFT_NAMES = new Set(['heart me']);

export function createGameHub({ startGame = 'boss', random = Math.random, welcomeTextAbove = DEFAULT_TEXT_ABOVE, englishProgress = null,
  onEnglishAnswer = null, englishListenReady = () => false, dataDir = null, answersLogger = null } = {}) {
  const donors = createDonorLedger(); // 👑 Bảng vàng của PHIÊN LIVE HIỆN TẠI — mọi tab quiz dùng chung
  const buildGames = () => new Map([
    ['boss', createBossRaidGame({ random })],
    ['temple', createTempleGame({ random })],
    ['bar', createBarClubGame({ random, donors })], // ghế VIP theo 💎 chung của phiên
    ['dance', createDanceHallGame({ random, seedCount: SEED_TARGET, donors })], // bục Top 1-2-3 theo 💎 chung của phiên
    ['swim', createSwimPushGame()],
    ...createQuizGames({ random, englishProgress, onEnglishAnswer, englishListenReady, donors, dataDir, answersLogger }).map((g) => [g.id, g])
  ]);
  let games = buildGames();
  let lastCatalog = null; // danh mục quà + luật quà tab tiếng Anh: dựng lại game (resetAll) thì gán lại
  let lastEnglishRules = null;
  let lastLateMs = null; // độ trễ sóng live — dựng lại game (resetAll) thì gán lại
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

  // 💞 FAN MỚI: tặng Heart Me (1 xu) là vào CLB người hâm mộ. TikTok chỉ bật cờ fanClub ở các sự kiện SAU đó,
  // nên khoảnh khắc vừa vào CLB phải bắt từ chính món quà — nếu chờ cờ thì mất đúng lúc đáng chúc mừng nhất.
  // Mỗi người chỉ mừng một lần trong phòng này (tặng lại để gia hạn thì không mừng nữa).
  const fanGreeted = new Set();
  function fanClubJoin(event) {
    if (event.type !== 'gift' || !event.user?.id) return [];
    const name = String(event.gift?.name || '').trim().toLowerCase();
    if (!FANCLUB_GIFT_IDS.has(String(event.gift?.id || '')) && !FANCLUB_GIFT_NAMES.has(name)) return [];
    // ĐÃ LÀ MEMBER TỪ TRƯỚC → chỉ chúc mừng lần đầu thôi. Những lần tặng sau, món quà vẫn chạy
    // tác dụng bình thường (đổi bộ đề…), không bày lại màn "vừa vào CLB".
    // app.js đặt cờ này TRƯỚC khi fanclub-store học từ chính sự kiện này.
    // (fanGreeted chỉ là chốt phụ trong phiên: nó mất khi đổi phòng / khởi động lại, nên một mình
    //  nó không đủ — đó chính là lý do màn chúc mừng thỉnh thoảng hiện lại với fan cũ.)
    if (event.user.alreadyFan === true) return [];
    if (fanGreeted.has(event.user.id)) return [];
    fanGreeted.add(event.user.id);
    if (!event.simulated) console.log(`[app] 💞 ${event.user.nickname} vào CLB người hâm mộ (${event.gift.name})`);
    return [{ kind: 'fanJoin', userId: event.user.id, nickname: event.user.nickname, avatar: event.user.avatar,
      level: Number(event.user.fanLevel) || 1, gift: event.gift.name, image: event.gift.pictureUrl || '' }];
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
      donors.record(event);
      const fx = active().handleEvent(event, now);
      return [...fx, ...donorMilestone(event), ...fanClubJoin(event), ...welcome.notice(event.user, now)];
    },
    /** Danh mục quà thật của phòng → game nào cần (tab tiếng Anh gán quà đổi bộ đề). */
    setGiftCatalog(catalog) {
      lastCatalog = catalog;
      for (const game of games.values()) game.setGiftCatalog?.(catalog);
    },
    /** Độ trễ sóng live: mọi tab đố vui nhận câu trả lời đến trễ trong bấy nhiêu mili-giây. */
    setLateMs(ms) {
      lastLateMs = ms;
      for (const game of games.values()) game.setLateMs?.(ms);
    },
    /** Gom thống kê "trả lời đúng nhưng về trễ" của mọi tab → biết độ trễ sóng thực tế. */
    lateReport() {
      let count = 0;
      let total = 0;
      for (const game of games.values()) {
        const r = game.lateReport?.();
        if (!r?.count) continue;
        count += r.count;
        total += r.count * r.avgMs;
      }
      return { count, avgMs: count ? Math.round(total / count) : 0 };
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
    queuePriority(questions) {
      const g = games.get(activeId);
      return g?.queuePriority?.(questions);
    },
    /** Chỉ bảng xếp hạng phiên (kim cương / like / chat) + sổ donate. Không đụng điểm game, đại sứ, danh sách đã chào. */
    resetBoard() {
      board.reset();
    },
    resetSession() {
      board.reset();
      welcome.reset();
    },
    /** Tab 🎁 Quà (trang điều khiển): luật quà tab tiếng Anh. */
    setEnglishRules(rules) {
      lastEnglishRules = rules;
      games.get('english')?.setEnglishRules?.(rules);
    },
    /**
     * Nút "Xoá dữ liệu phiên live trước" (trang điều khiển): dựng lại MỌI game từ đầu — số câu cộng dồn, điểm, bảng xếp hạng, năng lượng
     * tim, follow, share, đại sứ, chế độ đề, Luyện nghe… — và xoá bảng xếp hạng phiên, danh sách đã chào, tổng 💎 chúc mừng.
     * GIỮ: game đang chọn, bảng quà / danh mục quà, sổ "từ đã hỏi" tab tiếng Anh (phiên mới vẫn không hỏi lại từ cũ).
     * Chỉ chạy khi chủ kênh bấm — rớt live / khởi động lại server vẫn khôi phục từ bản lưu nóng như cũ.
     */
    resetAll() {
      englishProgress?.flush?.();
      games = buildGames();
      if (lastCatalog) for (const game of games.values()) game.setGiftCatalog?.(lastCatalog);
      if (lastEnglishRules) games.get('english')?.setEnglishRules?.(lastEnglishRules);
    if (lastLateMs !== null) for (const game of games.values()) game.setLateMs?.(lastLateMs);
      board.reset();
      welcome.reset();
      roomDonations.clear();
      fanGreeted.clear();
      donors.clear();
      lastSimulatedAt = 0;
    },
    /** Phòng live mới: mỗi game xoá thông số của phòng cũ (game quiz: năng lượng, follow, share, chế độ đề) — giữ bảng xếp hạng. */
    resetRoom() {
      roomDonations.clear();
      fanGreeted.clear();
      donors.clear(); // 👑 Bảng vàng: phiên live mới bắt đầu lại
      for (const game of games.values()) game.resetRoom?.();
      welcome.reset(); // phòng mới: chào lại người vào
    },
    restore(snapshot) {
      if (!snapshot) return;
      if (snapshot.game && games.has(snapshot.game)) activeId = snapshot.game;
      if (snapshot.state) active().restore?.(snapshot.state);
      if (snapshot.leaderboard) board.restore(snapshot.leaderboard);
      else if (snapshot.totals) board.restore({ totals: snapshot.totals, viewers: snapshot.top });
      donors.restore(snapshot.donors);
    },
    snapshot(now = Date.now()) {
      return {
        game: activeId,
        state: active().snapshot(now),
        top: board.top(),
        totals: board.totals(),
        donations: board.donations(300),
        leaderboard: board.exportState(),
        donors: donors.exportState(),
        viewers: { count: welcome.viewerCount(), textAbove: welcome.threshold(), waiting: welcome.backlog(), pending: welcome.pendingIds() },
        // Màn hình phải hiện nhãn "CHẾ ĐỘ THỬ" khi vừa có sự kiện giả lập.
        testMode: now - lastSimulatedAt < 20000
      };
    }
  };
}
