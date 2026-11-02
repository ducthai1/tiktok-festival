// Xử lý lệnh từ trang điều khiển (đã qua kiểm token ở socket-hub). Mọi tham số được
// kiểm lại ở đây; lệnh sai trả lỗi chứ không làm sập server.
import { buildTestEvent } from './games/test-event-factory.js';

const GAME_COMMANDS = {
  bar: ['party', 'clear'],
  swim: ['pause', 'resume', 'resetRound', 'resetWins'],
  temple: ['resetMerit', 'clear']
};
const TEST_KINDS = new Set(['chat', 'gift', 'like', 'follow', 'share', 'member', 'viewers']);

export function createAdminCommandHandler({ hub, live, settings, updateSettings, emitFx, pushState }) {
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
    test(msg) {
      // Không cho bơm sự kiện giả vào buổi live thật: người xem sẽ thấy tương tác bịa.
      if (live.isLive()) throw new Error('Đang live thật — tắt kết nối trước khi chạy thử');
      if (!TEST_KINDS.has(msg.kind)) throw new Error('Loại thử không hợp lệ');
      const raw = buildTestEvent(msg, (testSeq += 1));
      const event = raw && live.ingest(raw, { simulated: true });
      if (!event) throw new Error('Sự kiện thử không hợp lệ');
      return { message: `Đã gửi ${msg.kind}` };
    },
    settings(msg) {
      const patch = {};
      for (const key of ['tts', 'ttsWelcome', 'legend', 'sound']) if (typeof msg[key] === 'boolean') patch[key] = msg[key];
      if (Number.isFinite(msg.volume)) patch.volume = Math.max(0, Math.min(1, msg.volume));
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
