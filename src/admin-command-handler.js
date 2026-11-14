// Xử lý lệnh từ trang điều khiển (đã qua kiểm token ở socket-hub). Mọi tham số được
// kiểm lại ở đây; lệnh sai trả lỗi chứ không làm sập server.
import { ENGLISH_TARGETS, ORDER, ORDER_VERSION, defaultEnglishRules, defaultQuestionsFor } from '../public/shared/english-sets.js';
import { giftOptions, normalizeRules } from './games/quiz/english-gift-rules.js';
import { buildTestEvent } from './games/test-event-factory.js';
import { isVoiceSetting } from '../public/shared/tts-voices.js';

const QUIZ_COMMANDS = ['next', 'hint', 'pause', 'resume', 'resetScores', 'resetDeck'];
const GAME_COMMANDS = {
  boss: ['resetBoss', 'killBoss', 'frenzy'],
  bar: ['party', 'clear'],
  dance: ['drop', 'clear', 'seeds'],
  swim: ['pause', 'resume', 'resetRound', 'resetWins'],
  temple: ['resetMerit', 'clear'],
  ...Object.fromEntries(['lophoc', 'dovui', 'english', 'emoji', 'flag', 'math', 'wordle'].map((id) => [id, QUIZ_COMMANDS])),
  // tab tiếng Anh: nút đổi bộ đề / độ khó / Luyện nghe bằng tay (trước đây thiếu → nút ở trang điều khiển bị từ chối)
  english: [...QUIZ_COMMANDS, ...ORDER.map((to) => `deck-${to}`)]
};
const TEST_KINDS = new Set(['chat', 'gift', 'like', 'follow', 'share', 'member', 'viewers']);

/** Danh sách người đang có mặt trong game (chùa: devotees; game khác: mảng đầu tiên có id + nickname). */
export function presentPeople(state) {
  if (!state || typeof state !== 'object') return [];
  const list = Array.isArray(state.devotees) ? state.devotees
    : Object.values(state).find((v) => Array.isArray(v) && v.length && v.every((p) => p && p.id && p.nickname)) || [];
  return list.filter((p) => p && p.id && p.nickname);
}
let testSeq = 0;

export function createAdminCommandHandler({ hub, live, settings, updateSettings, emitFx, pushState, getSampleGifts = () => undefined, sockets,
  getGiftCatalog = () => [], saveBackup = () => {} }) {
  // tab 🎁 Quà: luật quà tab tiếng Anh đang dùng (chưa chỉnh thì mặc định) + danh sách quà để chọn + các chế độ
  const englishGiftsView = () => ({
    rules: settings.englishGifts?.length ? settings.englishGifts : defaultEnglishRules(),
    custom: Boolean(settings.englishGifts?.length),
    options: giftOptions(getGiftCatalog()),
    targets: ORDER.map((to) => ({ to, icon: ENGLISH_TARGETS[to].icon, label: ENGLISH_TARGETS[to].label, kind: ENGLISH_TARGETS[to].kind,
      questions: defaultQuestionsFor(to) }))
  });
  const handlers = {
    englishGifts() {
      return englishGiftsView();
    },
    saveEnglishGifts(msg) {
      const rules = normalizeRules(msg.rules, giftOptions(getGiftCatalog()));
      updateSettings({ englishGifts: rules, englishGiftsOrder: ORDER_VERSION }); // thứ tự chủ kênh tự xếp: không xếp lại nữa
      hub.setEnglishRules(rules);
      pushState(true);
      const on = rules.filter((r) => r.enabled);
      console.log(`[admin] luật quà tab tiếng Anh: ${on.map((r) => `${r.gift.name} ${r.gift.coins}xu→${r.to}${r.questions ? `(${r.questions}c)` : ''}`).join(', ')}`);
      return { message: `Đã áp dụng ${on.length} món quà lên màn hình`, ...englishGiftsView() };
    },
    resetEnglishGifts() {
      updateSettings({ englishGifts: null });
      hub.setEnglishRules(defaultEnglishRules());
      pushState(true);
      return { message: 'Đã khôi phục bảng quà mặc định', ...englishGiftsView() };
    },
    async connect(msg) {
      const provider = msg.provider === 'tikfinity' ? 'tikfinity' : 'tiktok';
      updateSettings({ provider, username: String(msg.username || '').slice(0, 100) });
      await live.connect(msg.username, provider);
      return { message: live.status().message };
    },
    async disconnect() {
      await live.disconnect();
      return { message: 'Đã ngắt' };
    },
    switch(msg) {
      hub.switchTo(String(msg.game));
      updateSettings({ activeGame: hub.activeId() });
      pushState(true);
      return { message: `Đã chuyển sang ${hub.list().find((g) => g.id === hub.activeId()).title}` };
    },
    command(msg) {
      const game = String(msg.game);
      if (!GAME_COMMANDS[game]?.includes(msg.name)) throw new Error('Lệnh game không hợp lệ');
      emitFx(game, hub.command(game, msg.name));
      pushState(true);
      return { message: 'OK' };
    },
    // Chủ phòng chỉ định một người ĐANG CÓ MẶT trong game nhận hiệu ứng của một món quà (người đó không phải
    // tặng). Tên/avatar lấy từ trạng thái game (không tin dữ liệu trang gửi lên); chạy như quà thật, kể cả khi live.
    grant(msg) {
      const person = presentPeople(hub.snapshot().state).find((p) => p.id === String(msg.userId || ''));
      if (!person) throw new Error('Người này không còn trong game');
      const gift = (getSampleGifts() || []).find((g) => g.id === String(msg.giftId || ''));
      if (!gift) throw new Error('Quà không hợp lệ');
      const raw = {
        type: 'gift', id: `grant-${(testSeq += 1)}-${Date.now()}`,
        user: { id: person.id, uniqueId: person.id, nickname: person.nickname, avatar: person.avatar || '' },
        giftRaw: { id: gift.id, name: gift.name, pictureUrl: gift.image || '', diamondsEach: gift.coins, repeatCount: 1, repeatEnd: true, streakable: false }
      };
      if (!live.ingest(raw, { simulated: false })) throw new Error('Không tạo được hiệu ứng');
      pushState(true);
      return { message: `Đã tặng ${gift.name} cho ${person.nickname}` };
    },
    test(msg) {
      // Không cho bơm sự kiện giả vào buổi live thật: người xem sẽ thấy tương tác bịa.
      if (live.isLive()) throw new Error('Đang live thật — tắt kết nối trước khi chạy thử');
      if (!TEST_KINDS.has(msg.kind)) throw new Error('Loại thử không hợp lệ');
      const raw = buildTestEvent(msg, (testSeq += 1), getSampleGifts());
      const event = raw && live.ingest(raw, { simulated: true });
      if (!event) throw new Error('Sự kiện thử không hợp lệ');
      return { message: `Đã gửi ${msg.kind}` };
    },
    settings(msg) {
      const patch = {};
      for (const key of ['tts', 'ttsWelcome', 'ttsEnglish', 'legend', 'sound', 'music']) if (typeof msg[key] === 'boolean') patch[key] = msg[key];
      if (isVoiceSetting(msg.ttsVoice)) patch.ttsVoice = msg.ttsVoice; // tên giọng hoặc "random"
      for (const key of ['volume', 'musicVolume']) if (Number.isFinite(msg[key])) patch[key] = Math.max(0, Math.min(1, msg[key]));
      if (Number.isFinite(msg.welcomeTextAbove)) {
        patch.welcomeTextAbove = Math.max(0, Math.min(1000000, Math.floor(msg.welcomeTextAbove)));
        hub.setWelcomeThreshold(patch.welcomeTextAbove);
      }
      updateSettings(patch);
      return { message: 'Đã lưu' };
    },
    /** Nút "🧹 Xoá dữ liệu phiên live trước": mọi game về từ đầu + ghi đè bản lưu nóng (khởi động lại không nạp lại dữ liệu cũ). */
    resetLive() {
      hub.resetAll();
      saveBackup();
      console.log('[admin] ĐÃ XOÁ dữ liệu phiên live trước (số câu, điểm, bảng xếp hạng, năng lượng, follow, share, chế độ đề, tổng 💎) — giữ log, bảng quà, sổ từ đã hỏi');
      emitFx(hub.activeId(), [{ kind: 'toast', text: '🧹 Phiên live mới — mọi thứ bắt đầu lại từ đầu!' }]);
      pushState(true);
      return { message: 'Đã xoá dữ liệu phiên live trước — bắt đầu phiên mới' };
    },
    resetSession() {
      hub.resetSession();
      // Cũng xoá luôn điểm số trong game hiện tại nếu đang ở game tính điểm
      try { hub.command(hub.snapshot().game, 'resetScores'); } catch {}
      pushState(true);
      return { message: 'Đã xoá bảng xếp hạng phiên và điểm game' };
    },
    resetAmbassadors() {
      try { hub.command(hub.snapshot().game, 'resetAmbassadors'); } catch {}
      pushState(true);
      return { message: 'Đã xoá bảng đại sứ share' };
    },
    reload() {
      sockets?.broadcast({ t: 'reload' });
      return { message: 'Đã gửi lệnh làm mới tới tất cả màn hình' };
    },
    ping() {
      return { message: 'pong', settings, live: live.status() };
    }
  };

  return async function handle(msg) {
    const handler = Object.hasOwn(handlers, msg.t) ? handlers[msg.t] : null;
    if (!handler) throw new Error('Lệnh không hỗ trợ');
    return handler(msg);
  };
}
