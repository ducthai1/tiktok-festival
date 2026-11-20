// Xử lý lệnh từ trang điều khiển (đã qua kiểm token ở socket-hub). Mọi tham số được
// kiểm lại ở đây; lệnh sai trả lỗi chứ không làm sập server.
import { ENGLISH_TARGETS, ORDER, ORDER_VERSION, defaultEnglishRules, defaultMusicGifts, defaultQuestionsFor } from '../public/shared/english-sets.js';
import { giftOptions, normalizeMusicGifts, normalizeRules } from './games/quiz/english-gift-rules.js';
import { buildTestEvent } from './games/test-event-factory.js';
import { isVoiceSetting } from '../public/shared/tts-voices.js';
import { createHoangSaTruongSaQuestions } from './games/quiz/special-questions.js';

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

const clampRotateMinutes = (val) => {
  const n = Math.round(Number(val));
  if (!Number.isFinite(n) || n < 1) return 20;
  return Math.min(180, n);
};

export function createAdminCommandHandler({ hub, live, settings, updateSettings, updateGameAudio = () => {}, emitFx, pushState, getSampleGifts = () => undefined, sockets,
  playlist = null, pushPlaylist = () => {}, builtinMusic = () => [],
  getGiftCatalog = () => [], saveBackup = () => {}, getGiftCounts = () => ({}), rotateGiftsNow = () => {}, answersLogger = null,
  resetRotateTimer = () => {} }) {
  /** Món được tặng nhiều LƯỢT nhất buổi live này → tab 🎁 Quà hiện ra để chủ kênh thấy món nào đang hot. */
  const hotGifts = () => {
    const byId = new Map(getGiftCatalog().map((g) => [String(g.id), g]));
    const rules = settings.englishGifts?.length ? settings.englishGifts : defaultEnglishRules();
    for (const r of rules) if (r.gift?.id) byId.set(String(r.gift.id), { ...byId.get(String(r.gift.id)), ...r.gift });
    return Object.entries(getGiftCounts())
      .map(([id, count]) => ({ id, count: Number(count), name: byId.get(String(id))?.name || `#${id}`,
        coins: Number(byId.get(String(id))?.coins) || 0, to: rules.find((r) => String(r.gift?.id) === String(id))?.to || '' }))
      .sort((a, b) => b.count - a.count).slice(0, 8);
  };
  // tab 🎁 Quà: luật quà tab tiếng Anh đang dùng (chưa chỉnh thì mặc định) + danh sách quà để chọn + các chế độ + quà nhạc
  const englishGiftsView = () => ({
    rules: settings.englishGifts?.length ? settings.englishGifts : defaultEnglishRules(),
    custom: Boolean(settings.englishGifts?.length),
    options: giftOptions(getGiftCatalog()),
    musicGifts: settings.musicGifts || defaultMusicGifts(),
    // tự luân chuyển giá quà (gift-rotation.js) — tắt sẵn, chủ kênh tự bật
    rotate: {
      enabled: Boolean(settings.englishRotate),
      minutes: Number(settings.englishRotateMinutes) || 20,
      round: Number(settings.englishRotation?.round) || 0,
      hot: hotGifts()
    },
    targets: ORDER.map((to) => ({ to, icon: ENGLISH_TARGETS[to].icon, label: ENGLISH_TARGETS[to].label, kind: ENGLISH_TARGETS[to].kind,
      questions: defaultQuestionsFor(to) }))
  });
  /**
   * Quà có thể "bù" cho một người: quà mẫu + MỌI món đang gắn trên bảng quà tab tiếng Anh (kể cả ô Thường
   * và các chủ đề) + quà thật phòng đã nhận. Trước đây chỉ có 21 quà mẫu nên không bù được những ô như
   * ⚖️ Thường, 🏠 Nhà cửa… khi người xem tặng mà máy chủ lỡ mất.
   */
  const grantableGifts = () => {
    const out = [];
    const seen = new Set();
    const add = (g, label) => {
      const id = String(g?.id || '');
      if (!id || seen.has(id) || !(Number(g.coins) >= 1)) return;
      seen.add(id);
      out.push({ id, name: String(g.name || '').slice(0, 40), coins: Number(g.coins), image: g.image || '', label: label || '' });
    };
    const rules = settings.englishGifts?.length ? settings.englishGifts : defaultEnglishRules();
    for (const r of rules) {
      const t = ENGLISH_TARGETS[r?.to];
      if (t && r.gift) add(r.gift, `${t.icon} ${t.label}${r.enabled === false ? ' (đang tắt)' : ''}`);
    }
    for (const g of getSampleGifts() || []) add(g, 'quà mẫu');
    for (const g of getGiftCatalog() || []) add(g, 'phòng đã nhận');
    return out;
  };

  // ── Danh sách nhạc nền (tab 📺 Màn hình & âm thanh) ─────────────────────────
  // Dùng `trackId` chứ KHÔNG dùng `id`: live-socket-client.js tự gán msg.id = số thứ tự request
  // để ghép câu trả lời, nên trường `id` của mình sẽ bị ghi đè mất.
  const musicView = () => ({ items: playlist?.all() || [], builtin: builtinMusic() });
  const musicDo = (fn) => {
    if (!playlist) throw new Error('Chưa bật danh sách nhạc');
    const out = fn();
    pushPlaylist();
    return { ...musicView(), ...out };
  };

  const handlers = {
    musicList() {
      return musicView();
    },
    /** Bật / tắt một bài: tắt là để sang một bên, bài vẫn nằm trong danh sách. */
    musicToggle(msg) {
      return musicDo(() => {
        const it = playlist.toggle(msg.trackId, msg.on);
        return { message: it.enabled ? `Đã đưa "${it.title}" vào vòng phát` : `Đã để "${it.title}" sang một bên` };
      });
    },
    /** Dời bài lên / xuống để sắp thứ tự xoay tua. */
    musicMove(msg) {
      return musicDo(() => {
        playlist.move(msg.trackId, Number(msg.delta) || 0);
        return { message: 'Đã đổi thứ tự' };
      });
    },
    musicRename(msg) {
      return musicDo(() => ({ message: `Đã đổi tên thành "${playlist.rename(msg.trackId, msg.title).title}"` }));
    },
    /** Xoá hẳn: bỏ khỏi danh sách và xoá file trên ổ (nhạc gốc thì giữ file). */
    musicRemove(msg) {
      return musicDo(() => ({ message: `Đã xoá "${playlist.remove(msg.trackId).title}"` }));
    },
    /** Thêm một bài NHẠC GỐC đi kèm vào danh sách. */
    musicAddBuiltin(msg) {
      return musicDo(() => {
        const track = builtinMusic().find((t) => t.name === String(msg.name || ''));
        if (!track) throw new Error('Không có bài gốc này');
        if (!track.has) throw new Error(`Máy này chưa có file ${track.file} (xem public/assets/dance/music/NGUON-NHAC.txt)`);
        const it = playlist.add({ kind: 'builtin', title: track.name, builtinFile: track.file });
        return { message: `Đã thêm bài gốc "${it.title}"` };
      });
    },
    /** Danh sách quà để "bù quà" ở tab Điều khiển. */
    grantGifts() {
      return { gifts: grantableGifts() };
    },
    englishGifts() {
      return englishGiftsView();
    },
    saveEnglishGifts(msg) {
      const opts = giftOptions(getGiftCatalog());
      let musicGifts = null;
      if (msg.musicGifts) {
        musicGifts = normalizeMusicGifts(msg.musicGifts, opts, msg.rules);
      }
      const rules = normalizeRules(msg.rules, opts, musicGifts || settings.musicGifts);
      const patch = { englishGifts: rules, englishGiftsOrder: ORDER_VERSION };
      if (musicGifts) patch.musicGifts = musicGifts;
      updateSettings(patch);
      hub.setEnglishRules(rules);
      pushState(true);
      const on = rules.filter((r) => r.enabled);
      console.log(`[admin] luật quà tab tiếng Anh: ${on.map((r) => `${r.gift.name} ${r.gift.coins}xu→${r.to}${r.questions ? `(${r.questions}c)` : ''}`).join(', ')}`);
      return { message: `Đã áp dụng ${on.length} món quà lên màn hình`, ...englishGiftsView() };
    },
    setMusicGifts(msg) {
      const opts = giftOptions(getGiftCatalog());
      const rules = settings.englishGifts?.length ? settings.englishGifts : defaultEnglishRules();
      const musicGifts = normalizeMusicGifts(msg.musicGifts, opts, rules);
      updateSettings({ musicGifts });
      pushState(true);
      return { message: 'Đã cập nhật quà Bật / Tắt nhạc nền', ...englishGiftsView() };
    },
    setGiftRotate(msg) {
      const on = Boolean(msg.on);
      const patch = { englishRotate: on };
      if (msg.minutes !== undefined) {
        patch.englishRotateMinutes = clampRotateMinutes(msg.minutes);
      }
      updateSettings(patch);
      resetRotateTimer();
      const mins = Number(settings.englishRotateMinutes) || 20;
      console.log(`[admin] tự luân chuyển giá quà: ${on ? 'BẬT' : 'TẮT'} (${mins} phút/vòng)`);
      return { message: on ? `Đã bật tự luân chuyển giá quà (${mins} phút/vòng)` : 'Đã tắt tự luân chuyển giá quà', ...englishGiftsView() };
    },
    setGiftRotateInterval(msg) {
      const valid = clampRotateMinutes(msg.minutes);
      updateSettings({ englishRotateMinutes: valid });
      resetRotateTimer();
      console.log(`[admin] cài đặt thời gian luân chuyển quà: ${valid} phút/vòng`);
      return { message: `Đã đổi thời gian luân chuyển quà thành ${valid} phút/vòng`, ...englishGiftsView() };
    },
    rotateNow() {
      rotateGiftsNow();
      return { message: 'Đã luân chuyển bảng quà ngay', ...englishGiftsView() };
    },
    resetEnglishGifts() {
      updateSettings({ englishGifts: null, musicGifts: defaultMusicGifts() });
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
      // updateSettings cũng phát lại publicSettings() → âm thanh RIÊNG của game vừa chọn được áp ngay
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
    triggerHoangSaTruongSa() {
      const qs = createHoangSaTruongSaQuestions();
      hub.queuePriority(qs);
      return { ok: true, message: '🇻🇳 Đã lên lịch 2 câu hỏi Hoàng Sa - Trường Sa (sẽ ra ngay sau câu hiện tại)!' };
    },
    // Chủ phòng chỉ định một người ĐANG CÓ MẶT trong game nhận hiệu ứng của một món quà (người đó không phải
    // tặng). Tên/avatar lấy từ trạng thái game (không tin dữ liệu trang gửi lên); chạy như quà thật, kể cả khi live.
    grant(msg) {
      const person = presentPeople(hub.snapshot().state).find((p) => p.id === String(msg.userId || ''));
      if (!person) throw new Error('Người này không còn trong game');
      const gift = grantableGifts().find((g) => g.id === String(msg.giftId || ''));
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
      // Âm thanh đi vào bộ RIÊNG của game đang chạy (không đè game khác); còn lại là cài đặt chung.
      const audio = {};
      for (const key of ['sound', 'music']) if (typeof msg[key] === 'boolean') audio[key] = msg[key];
      for (const key of ['volume', 'musicVolume']) if (Number.isFinite(msg[key])) audio[key] = Math.max(0, Math.min(1, msg[key]));
      if (Object.keys(audio).length) updateGameAudio(audio);
      for (const key of ['tts', 'ttsWelcome', 'ttsEnglish', 'legend']) if (typeof msg[key] === 'boolean') patch[key] = msg[key];
      if (isVoiceSetting(msg.ttsVoice)) patch.ttsVoice = msg.ttsVoice; // tên giọng hoặc "random"
      if (['', 'christmas', 'teacher'].includes(msg.season)) patch.season = msg.season; // chủ đề mùa: 🎄 Giáng sinh / 💐 20/11
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
    // MỖI NÚT XOÁ CHỈ XOÁ ĐÚNG BẢNG CỦA NÓ. Trước đây nút này kéo theo cả điểm game, đại sứ share và
    // danh sách đã chào — muốn xoá mỗi bảng kim cương thì mất sạch. Xoá tất cả đã có nút
    // "Bắt đầu phiên live mới" (resetLive) rồi.
    resetSession() {
      hub.resetBoard();
      pushState(true);
      return { message: 'Đã xoá bảng xếp hạng phiên (kim cương / like / chat)' };
    },
    resetScores() {
      try { hub.command(hub.snapshot().game, 'resetScores'); } catch {}
      pushState(true);
      return { message: 'Đã xoá bảng điểm của game đang chạy' };
    },
    getAnswersLog(msg) {
      const max = Math.min(500, Math.max(10, Number(msg.limit) || 150));
      const lines = answersLogger?.getRecentLines(max, msg.date) || [];
      return { lines };
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
    safeReload() {
      sockets?.broadcast({ t: 'safeReload' });
      return { message: 'Đã lên lịch: Sẽ tự làm mới ngay khi kết thúc câu hỏi này (không gián đoạn live)' };
    },
    setObsAutoRefresh(msg) {
      const enabled = Boolean(msg.enabled);
      const intervalMs = Math.max(1800_000, Math.min(24 * 3600_000, Number(msg.intervalMs) || 7200_000));
      const lagDetect = msg.lagDetect !== false;
      const obsAutoRefresh = { enabled, intervalMs, lagDetect };
      updateSettings({ obsAutoRefresh });
      return { message: enabled ? `Tự làm mới OBS mỗi ${Math.round(intervalMs / 3600_000 * 10) / 10} giờ (khi hết câu)` : 'Đã tắt tự làm mới OBS' };
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
