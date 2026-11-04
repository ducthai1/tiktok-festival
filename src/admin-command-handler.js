// Xử lý lệnh từ trang điều khiển (đã qua kiểm token ở socket-hub). Mọi tham số được
// kiểm lại ở đây; lệnh sai trả lỗi chứ không làm sập server.
import { buildTestEvent } from './games/test-event-factory.js';

const GAME_COMMANDS = {
  boss: ['resetBoss', 'killBoss', 'frenzy'],
  bar: ['party', 'clear'],
  dance: ['drop', 'clear'],
  swim: ['pause', 'resume', 'resetRound', 'resetWins'],
  temple: ['resetMerit', 'clear']
};
const TEST_KINDS = new Set(['chat', 'gift', 'like', 'follow', 'share', 'member', 'viewers']);

/** Danh sách người đang có mặt trong game (chùa: devotees; game khác: mảng đầu tiên có id + nickname). */
export function presentPeople(state) {
  if (!state || typeof state !== 'object') return [];
  const list = Array.isArray(state.devotees) ? state.devotees
    : Object.values(state).find((v) => Array.isArray(v) && v.length && v.every((p) => p && p.id && p.nickname)) || [];
  return list.filter((p) => p && p.id && p.nickname);
}

export function createAdminCommandHandler({ hub, live, settings, updateSettings, emitFx, pushState, getSampleGifts = () => undefined }) {
  let testSeq = 0;

  const handlers = {
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
      for (const key of ['tts', 'ttsWelcome', 'legend', 'sound', 'music']) if (typeof msg[key] === 'boolean') patch[key] = msg[key];
      for (const key of ['volume', 'musicVolume']) if (Number.isFinite(msg[key])) patch[key] = Math.max(0, Math.min(1, msg[key]));
      if (Number.isFinite(msg.welcomeTextAbove)) {
        patch.welcomeTextAbove = Math.max(0, Math.min(1000000, Math.floor(msg.welcomeTextAbove)));
        hub.setWelcomeThreshold(patch.welcomeTextAbove);
      }
      updateSettings(patch);
      return { message: 'Đã lưu' };
    },
    resetSession() {
      hub.resetSession();
      pushState(true);
      return { message: 'Đã xoá bảng xếp hạng phiên' };
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
