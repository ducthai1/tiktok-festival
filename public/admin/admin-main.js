// Trang điều khiển: đăng nhập bằng token, kết nối live, đổi game, thử, cài đặt màn hình.
import { connectLiveSocket } from '/static/shared/live-socket-client.js';
import { pickVoice } from '/static/shared/tts-voices.js';
import { createDemoRunner, renderDemoButtons } from './admin-demo-scenarios.js';
import { setupTestPanel } from './admin-test-panel.js';
import { setupGiftEditor } from './admin-gifts.js';
import { SAMPLE_GIFTS, giftTier } from '/static/shared/gift-tiers.js';

const $ = (id) => document.getElementById(id);
const GAME_ICONS = { boss: '⚔️', temple: '🪷', bar: '🍸', dance: '🪩', swim: '🏊', lophoc: '📚', dovui: '🏆', english: '🔤', emoji: '🧩', flag: '🚩', math: '➗', wordle: '🟩' };
const QUIZ_COMMANDS = [['next', '⏭ Câu tiếp / lật đáp án'], ['hint', '💡 Gợi ý'], ['pause', '⏸ Tạm dừng'], ['resume', '▶ Tiếp tục'], ['resetScores', '🏆 Xoá bảng điểm']];
const GAME_COMMANDS = {
  boss: [['frenzy', '⚡ Cuồng nộ ngay'], ['killBoss', '💥 Kết liễu Boss'], ['resetBoss', '↺ Reset Boss Cấp 1']],
  bar: [['party', '🎉 Mở tiệc ngay'], ['clear', '🚪 Mời hết khách ra']],
  dance: [['drop', '💥 DROP ngay'], ['clear', '🚪 Mời hết ra'], ['seeds', '🎭 Bật/tắt người nhảy ảo']],
  swim: [['pause', '⏸ Tạm dừng'], ['resume', '▶ Tiếp tục'], ['resetRound', '↺ Vòng mới'], ['resetWins', '🏆 Xoá số trận thắng']],
  temple: [['resetMerit', '✨ Xoá công đức'], ['clear', '🚪 Mời hết ra']],
  ...Object.fromEntries(['lophoc', 'dovui', 'english', 'emoji', 'flag', 'math', 'wordle'].map((id) => [id, QUIZ_COMMANDS])),
  english: [...QUIZ_COMMANDS.filter(([name]) => name !== 'hint'), ['deck-nghe', '🎧 Luyện nghe'], ['deck-easy', '😊 Dễ'], ['deck-hard', '🔥 Khó'], ['deck-toeic', '💼 TOEIC'],
    ['deck-ielts', '🎓 IELTS'], ['deck-yhoc', '🩺 Y học'], ['deck-bongda', '⚽ Thể thao'], ['deck-congnghe', '💻 Công nghệ'], ['resetDeck', '↺ Về Tổng hợp']]
};

let token = '';
let authed = false;
let activeGame = '';
let liveState = 'idle';

// Token đi theo #hash (không gửi lên server/không lưu log), rồi xoá khỏi thanh địa chỉ để
// lỡ chia sẻ màn hình cũng không lộ.
const hashToken = new URLSearchParams(location.hash.slice(1)).get('token');
try {
  if (hashToken) sessionStorage.setItem('adminToken', hashToken);
  token = sessionStorage.getItem('adminToken') || '';
} catch {
  token = hashToken || '';
}
if (hashToken) history.replaceState(null, '', location.pathname);

function toast(text, bad = false) {
  const el = $('toast');
  el.textContent = text;
  el.className = `toast${bad ? ' bad' : ''}`;
  el.hidden = false;
  clearTimeout(el.timer);
  el.timer = setTimeout(() => { el.hidden = true; }, 3500);
}

const socket = connectLiveSocket({
  onOpen() {
    $('server-dot').classList.remove('off');
    if (token) socket.send({ t: 'auth', token });
    else $('login').hidden = false;
  },
  onClose() {
    $('server-dot').classList.add('off');
    authed = false;
  },
  onMessage(m) {
    if (m.t === 'authOk') {
      authed = true;
      $('login').hidden = true;
      $('app').hidden = false;
      if (currentTab === 'gifts') gifts.load();
      if (currentTab === 'board') loadAnswersLog();
    } else if (m.t === 'authFail') {
      $('login').hidden = false;
      $('app').hidden = true;
      toast('Token sai', true);
    } else if (m.t === 'hello') {
      // server khởi động lại với code giao diện mới → tải lại trang (token vẫn giữ trong sessionStorage)
      if (m.version && adminVersion && m.version !== adminVersion) return location.reload();
      adminVersion = m.version || adminVersion;
      renderGames(m.games);
      applySettings(m.settings);
      renderLive(m.live);
      testPanel.setGifts(m.sampleGifts);
    } else if (m.t === 'gifts') {
      if (m.sampleGifts) testPanel.setGifts(m.sampleGifts);
    } else if (m.t === 'adminInfo') {
      $('provider').value = m.provider;
      if (m.username && !$('username').value) $('username').value = m.username;
    } else if (m.t === 'stages') renderStages(m);
    else if (m.t === 'settings') applySettings(m.settings);
    else if (m.t === 'live') renderLive(m.status);
    else if (m.t === 'state') renderState(m);
    else if (m.t === 'log') appendLog(m.event);
    else if (m.t === 'quizAnswerLog') appendQuizAnswerEntry(m.entry);
  }
});

async function run(message, okText) {
  if (!authed) return toast('Chưa mở khoá', true);
  const reply = await socket.request(message);
  if (reply.ok) toast(okText || reply.message || 'OK');
  else toast(reply.message || 'Lỗi', true);
  return reply;
}

// (3 khai báo dưới từng bị xoá nhầm ở commit 9a982d4 → nút "Kết nối" không gửi lệnh, trang báo lỗi testPanel — giữ nguyên)
const testPanel = setupTestPanel({ $, run, socket, toast });
const gifts = setupGiftEditor({ $, socket, toast });

// ── tab: nhớ tab đang mở theo trình duyệt này ──
let currentTab = 'live';
function showTab(name) {
  if (!document.querySelector(`.tab-panel[data-panel="${name}"]`)) name = 'live';
  currentTab = name;
  for (const b of $('tabs').children) b.classList.toggle('active', b.dataset.tab === name);
  for (const p of document.querySelectorAll('.tab-panel')) p.hidden = p.dataset.panel !== name;
  try { localStorage.setItem('adminTab', name); } catch { /* bỏ qua */ }
  if (name === 'gifts' && authed) gifts.load();
  if (name === 'board' && authed) loadAnswersLog();
}
for (const b of $('tabs').children) b.addEventListener('click', () => showTab(b.dataset.tab));
try { showTab(localStorage.getItem('adminTab') || 'live'); } catch { showTab('live'); }
const demo = createDemoRunner({ socket, toast, setStatus: (text) => { $('demo-status').textContent = text; } });
$('connect-form').addEventListener('submit', (e) => {
  e.preventDefault();
  run({ t: 'connect', provider: $('provider').value, username: $('username').value });
});

const gameTitles = new Map();
function renderGames(games) {
  for (const g of games) gameTitles.set(g.id, g.title);
  $('game-buttons').replaceChildren(...games.map((g) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.game = g.id;
    b.textContent = `${GAME_ICONS[g.id] || '🎮'} ${g.title}`;
    b.classList.toggle('active', g.id === activeGame);
    b.addEventListener('click', () => run({ t: 'switch', game: g.id }));
    return b;
  }));
}

function renderCommands() {
  $('game-commands').replaceChildren(...(GAME_COMMANDS[activeGame] || []).map(([name, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = label;
    b.addEventListener('click', () => run({ t: 'command', game: activeGame, name }));
    return b;
  }));
  testPanel.renderChats(activeGame);
  renderDemoButtons({ arrivalsRoot: $('demo-arrivals'), effectsRoot: $('demo-effects'), game: activeGame, runner: demo });
}

// Danh sách người đang có mặt + nút "Tặng": chỉ vẽ lại khi danh sách đổi, để chọn quà không bị reset.
let grantKey = '';
$('grant-gift').replaceChildren(...SAMPLE_GIFTS.map((g) => new Option(`${g.emoji} ${g.name} · ${g.coins} xu · bậc ${giftTier(g.coins)}`, g.id)));
function renderGrantList(state) {
  const people = (state && Array.isArray(state.devotees) ? state.devotees
    : Object.values(state || {}).find((v) => Array.isArray(v) && v.length && v.every((p) => p && p.id && p.nickname))) || [];
  const key = people.map((p) => `${p.id}:${p.nickname}`).join('|');
  if (key === grantKey) return;
  grantKey = key;
  const rows = people.map((p) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = p.nickname;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tiny';
    button.textContent = 'Tặng';
    button.addEventListener('click', () => run({ t: 'grant', userId: p.id, giftId: $('grant-gift').value }));
    li.append(name, button);
    return li;
  });
  $('grant-list').replaceChildren(...(rows.length ? rows : [Object.assign(document.createElement('li'), { textContent: 'Chưa có ai trong game' })]));
}

function formatDiamondsUsd(diamonds) {
  const d = Number(diamonds) || 0;
  const usd = d * 0.004;
  const decimals = (usd * 100) % 1 !== 0 ? 3 : 2;
  return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: decimals })}`;
}

let donationListKey = '';

function renderDonationList(donations = []) {
  if (!Array.isArray(donations)) donations = [];
  if ($('donations-count')) {
    const totalCount = donations.length;
    const totalDia = donations.reduce((sum, d) => sum + (d.gift?.diamonds || 0), 0);
    $('donations-count').textContent = `${totalCount} lần (${totalDia.toLocaleString('vi-VN')}💎)`;
  }

  const key = donations.map((d) => `${d.id || d.at}:${d.user?.id}:${d.gift?.diamonds}:${d.gift?.count}`).slice(0, 50).join('|');
  if (key === donationListKey) return;
  donationListKey = key;

  const nodes = donations.map((item) => {
    const li = document.createElement('li');
    if (item.simulated) li.className = 'sim';

    const timeStr = item.at ? new Date(item.at).toLocaleTimeString('vi-VN', { hour12: false }) : '';

    const mainDiv = document.createElement('div');
    mainDiv.className = 'item-main';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'time';
    timeSpan.textContent = timeStr;

    const userB = document.createElement('b');
    userB.className = 'donor';
    userB.textContent = item.user?.nickname || 'Người xem';

    const giftSpan = document.createElement('span');
    giftSpan.className = 'gift-info';

    if (item.gift?.pictureUrl) {
      const img = document.createElement('img');
      img.src = item.gift.pictureUrl;
      img.className = 'gift-img';
      img.alt = item.gift.name || 'Quà';
      giftSpan.append(img, ' ');
    } else {
      giftSpan.append('🎁 ');
    }

    const gName = item.gift?.name || 'Quà';
    const gCount = (item.gift?.count || 1) > 1 ? ` ×${item.gift.count}` : '';
    giftSpan.append(document.createTextNode(`${gName}${gCount}`));

    mainDiv.append(timeSpan, ' · ', userB, ' đã tặng ', giftSpan);
    if (item.simulated) {
      const simTag = document.createElement('span');
      simTag.className = 'muted small';
      simTag.textContent = ' [THỬ]';
      mainDiv.append(simTag);
    }

    const diaVal = document.createElement('div');
    diaVal.className = 'dia-val';
    const d = item.gift?.diamonds || 0;
    diaVal.textContent = `${d.toLocaleString('vi-VN')}💎 (${formatDiamondsUsd(d)})`;

    li.append(mainDiv, diaVal);
    return li;
  });

  if (nodes.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.className = 'muted';
    emptyLi.style.justifyContent = 'center';
    emptyLi.textContent = 'Chưa có lượt donate nào trong phiên';
    if ($('donations-list')) $('donations-list').replaceChildren(emptyLi);
  } else {
    if ($('donations-list')) $('donations-list').replaceChildren(...nodes);
  }
}

function renderState(m) {
  renderGrantList(m.state);
  
  // Cập nhật số người xem và kim cương cho cả 2 loại PiP
  const v = m.viewers || {};
  const t = m.totals || {};
  const diaCount = t.diamonds || 0;
  const diaUsd = formatDiamondsUsd(diaCount);
  pipViewerCount = v.count || 0;
  pipDiamondCount = diaCount;
  if (document.pictureInPictureElement) drawPipCanvas();
  if (pipWin && pipWin.document) {
    const vEl = pipWin.document.getElementById('pip-viewers');
    if (vEl) vEl.textContent = `👀 ${pipViewerCount.toLocaleString('vi-VN')}`;
    const dEl = pipWin.document.getElementById('pip-diamonds');
    if (dEl) dEl.textContent = `💎 ${pipDiamondCount.toLocaleString('vi-VN')} (${diaUsd})`;
  }

  if ($('pill-diamonds')) {
    $('pill-diamonds').textContent = `💎 ${diaCount.toLocaleString('vi-VN')} (${diaUsd})`;
  }
  if ($('diamonds-count')) {
    $('diamonds-count').textContent = diaCount.toLocaleString('vi-VN');
  }
  if ($('diamonds-usd')) {
    $('diamonds-usd').textContent = diaUsd;
  }

  if (m.game !== activeGame) {
    activeGame = m.game;
    for (const b of $('game-buttons').children) b.classList.toggle('active', b.dataset.game === activeGame);
    $('pill-game').textContent = `${GAME_ICONS[activeGame] || '🎮'} ${gameTitles.get(activeGame) || activeGame}`;
    renderCommands();
  }
  $('leaderboard').replaceChildren(...m.top.map((r) => {
    const li = document.createElement('li');
    const details = [];
    if (r.diamonds) details.push(`${r.diamonds.toLocaleString('vi-VN')}💎 (${formatDiamondsUsd(r.diamonds)})`);
    if (r.likes) details.push(`${r.likes}❤`);
    if (r.chats) details.push(`${r.chats}💬`);
    li.textContent = `${r.nickname}${details.length ? ` — ${details.join(' · ')}` : ''}`;
    return li;
  }));

  const amb = m.state?.ambassadors || [];
  $('ambassadors').replaceChildren(...amb.map((r) => {
    const li = document.createElement('li');
    li.textContent = `${r.nickname} — ${r.shares} lượt share`;
    if (r.follower) li.style.color = '#ffc107'; // highlight followers
    return li;
  }));
  if (!amb.length) $('ambassadors').replaceChildren(Object.assign(document.createElement('li'), { textContent: 'Chưa ai share trong 2 tiếng qua' }));

  renderDonationList(m.donations);

  $('viewers-count').textContent = (v.count || 0).toLocaleString('vi-VN');
  $('viewers-status').textContent = `Đang chờ chào: ${v.waiting || 0} · `
    + `${(v.count || 0) > (v.textAbove ?? 1000) ? 'phòng đông → chỉ hiện chữ' : 'đang chào từng người'}`;
  $('totals').textContent = `Phiên này: ${t.viewers || 0} người · ${diaCount.toLocaleString('vi-VN')}💎 (${diaUsd}) · ${t.likes || 0}❤ · ${t.chats || 0} bình luận · ${t.follows || 0} follow · ${t.shares || 0} share`;
}

let adminVersion = '';
let alarmTimer = 0;
let lastAlarmBeep = 0;
// Mất live đang chạy (đang nối lại) quá 20 giây → băng đỏ nhấp nháy + tiếng bíp mỗi 30 giây cho người vận hành biết ngay.
function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    osc.onended = () => ctx.close();
  } catch {
    // trình duyệt chặn âm thanh khi chưa bấm vào trang: chỉ còn băng đỏ
  }
}
function renderLive(status) {
  if (!status) return;
  liveState = status.state;
  const el = $('live-status');
  el.className = `status ${status.state}`;
  el.textContent = status.message;
  const pill = $('pill-live');
  pill.className = `pill ${status.state}`;
  pill.textContent = `● ${{ connected: 'Đang live', connecting: 'Đang kết nối…', reconnecting: 'Mất kết nối — đang nối lại', idle: 'Chưa live',
    error: 'Lỗi kết nối', ended: 'Live đã kết thúc' }[status.state] || status.state}`;
  pill.title = status.message;
  clearTimeout(alarmTimer);
  if (status.state === 'reconnecting') {
    alarmTimer = setTimeout(() => {
      el.classList.add('alarm');
      el.textContent = `⚠ MẤT KẾT NỐI LIVE — ${status.message}`;
      if (Date.now() - lastAlarmBeep > 30000) {
        lastAlarmBeep = Date.now();
        beep();
      }
    }, 20000);
  }
  const locked = liveState === 'connected';
  for (const b of document.querySelectorAll('[data-test], [id^="test-"] button, #test-crowd, [id^="test-arrive"], #demo button')) b.disabled = locked;
  $('test-note').textContent = locked ? 'Đang live thật: nút thử bị khoá để không lẫn tương tác giả vào buổi live.' : 'Sự kiện thử hiện nhãn “CHẾ ĐỘ THỬ” trên màn hình.';
}

// Màn hình OBS chạy code cũ / vẽ quá ít khung → hiệu ứng (mờ dần khi lật trang bảng quà…) mất trên live dù khung xem trước vẫn có.
function renderStages({ list = [] }) {
  const obs = list.filter((s) => !s.preview);
  if (obs.length && $('obs-uptime')) {
    const maxUptime = Math.max(...obs.map((s) => s.uptimeMs || 0));
    const hrs = Math.floor(maxUptime / 3600000);
    const mins = Math.floor((maxUptime % 3600000) / 60000);
    $('obs-uptime').textContent = hrs > 0 ? `${hrs}h ${mins}p` : `${mins} phút`;
    if ($('obs-schedule-status')) {
      const pending = obs.some((s) => s.pendingReload);
      $('obs-schedule-status').textContent = pending ? '🛡️ Sẽ tự làm mới ngay khi hết câu này' : '✓ Hoạt động bình thường';
      $('obs-schedule-status').style.color = pending ? '#ffd36b' : '#7dff8a';
    }
  }
  const line = obs.map((s) => {
    if (s.stale) return '⚠️ đang chạy code CŨ → bấm "Làm mới màn hình OBS" (không được thì trong OBS: chuột phải nguồn → Làm mới)';
    const fps = s.fps ? `${s.fps} khung/giây` : 'đang đo FPS…';
    if (s.fps && s.fps < 20) return `⚠️ ${fps}${s.software ? ' (vẽ bằng CPU)' : ''} — hiệu ứng sẽ giật/mất: bật tăng tốc phần cứng nguồn trình duyệt trong OBS hoặc dùng ?lite=1`;
    return `✅ bản mới · ${fps}`;
  });
  $('stage-health').textContent = obs.length ? `${obs.length > 1 ? `${obs.length} màn hình` : 'Màn hình OBS'}: ${line.join(' | ')}` : 'Màn hình OBS: chưa nối';
  const bad = obs.some((s) => s.stale || (s.fps && s.fps < 20));
  $('stage-health').classList.toggle('bad', bad);
  $('pill-obs').className = `pill ${!obs.length ? 'idle' : bad ? 'bad' : 'ok'}`;
  $('pill-obs').textContent = !obs.length ? '📺 OBS: chưa nối' : bad ? '📺 OBS: cần xem lại' : `📺 OBS ✓${obs[0].fps ? ` ${obs[0].fps} fps` : ''}`;
  $('pill-obs').title = $('stage-health').textContent;
}

function applySettings(s) {
  if (!s) return;
  $('set-sound').checked = s.sound !== false;
  $('set-tts').checked = s.tts === true;
  $('set-legend').checked = s.legend !== false;
  $('set-volume').value = String(s.volume ?? 0.6);
  $('set-music').checked = s.music !== false;
  $('set-musicVolume').value = String(s.musicVolume ?? 0.35);
  // 🎄 chủ đề Giáng sinh: một nút đổi cả màn hình live + nhạc + trang điều khiển
  document.body.classList.toggle('xmas', s.season === 'christmas');
  document.body.classList.toggle('teacher', s.season === 'teacher');
  for (const b of document.querySelectorAll('#season-pick button')) b.setAttribute('aria-pressed', String(b.dataset.season === (s.season || '')));
  $('set-ttsWelcome').checked = s.ttsWelcome === true;
  $('set-ttsEnglish').checked = s.ttsEnglish !== false;
  if (s.ttsVoice) $('set-ttsVoice').value = s.ttsVoice;
  if (document.activeElement !== $('set-welcome-above')) $('set-welcome-above').value = String(s.welcomeTextAbove ?? 1000);

  const auto = s.obsAutoRefresh || { enabled: true, intervalMs: 7200000, lagDetect: true };
  if ($('set-obs-autorefresh')) $('set-obs-autorefresh').checked = auto.enabled !== false;
  if ($('set-obs-interval')) $('set-obs-interval').value = String(auto.intervalMs || 7200000);
  if ($('set-obs-lagdetect')) $('set-obs-lagdetect').checked = auto.lagDetect !== false;
}

let pipWin = null;
let pipVideo = null;
let pipCanvas = null;
let pipCtx = null;
let pipLogs = [];
let pipScrollOffset = 0;
let pipViewerCount = 0;
let pipDiamondCount = 0;
let userScrolledUp = false;

function initPipCanvas() {
  if (pipCanvas) return;
  pipCanvas = document.createElement('canvas');
  pipCanvas.width = 400;
  pipCanvas.height = 560;
  pipCtx = pipCanvas.getContext('2d');

  pipVideo = document.createElement('video');
  pipVideo.muted = true;
  pipVideo.playsInline = true;
  pipVideo.srcObject = pipCanvas.captureStream(10);

  pipVideo.addEventListener('leavepictureinpicture', () => {
    if ($('pip-video-btn')) $('pip-video-btn').textContent = '📌 Ghim Nổi 100% (như YouTube)';
    if ($('pip-scroll-controls')) $('pip-scroll-controls').style.display = 'none';
  });
}

function drawPipCanvas() {
  if (!pipCtx) return;
  const ctx = pipCtx;
  const w = pipCanvas.width;
  const h = pipCanvas.height;

  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#161b22';
  ctx.fillRect(0, 0, w, 42);
  ctx.fillStyle = '#30363d';
  ctx.fillRect(0, 41, w, 1);

  ctx.fillStyle = '#ffe066';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText('📌 LIVE CHAT', 14, 27);

  // Viewer & Diamond count on canvas
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffe066';
  const diaText = `💎 ${pipDiamondCount.toLocaleString('vi-VN')} (${formatDiamondsUsd(pipDiamondCount)})`;
  const viewText = `👀 ${pipViewerCount.toLocaleString('vi-VN')}`;
  ctx.fillText(`${diaText}   ${viewText}`, w - 14, 27);
  ctx.textAlign = 'left';

  if (pipScrollOffset > 0) {
    ctx.fillStyle = '#238636';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText(`▲ (+${pipScrollOffset})`, 115, 27);
  }

  const total = pipLogs.length;
  const endIndex = Math.max(0, total - pipScrollOffset);
  const items = pipLogs.slice(Math.max(0, endIndex - 14), endIndex);

  let y = 68;
  for (const e of items) {
    if (y > h - 15) break;

    const icon = e.type === 'chat' ? '💬' : e.type === 'gift' ? '🎁' : e.type === 'like' ? '❤' : e.type === 'follow' ? '💖' : '↗';

    ctx.fillStyle = e.type === 'gift' ? 'rgba(255, 211, 107, 0.15)' : 'rgba(255, 255, 255, 0.06)';
    ctx.beginPath();
    ctx.roundRect(10, y - 20, w - 20, 32, 6);
    ctx.fill();

    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(icon, 18, y + 2);

    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = e.type === 'gift' ? '#ffe066' : '#58a6ff';
    const nameText = (e.nickname || 'Khách').slice(0, 18);
    ctx.fillText(nameText, 42, y + 2);

    const nameWidth = ctx.measureText(nameText).width;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = '#e6edf3';
    const msgText = e.text ? `: ${e.text}` : '';

    let displayMsg = msgText;
    const maxMsgWidth = w - 55 - nameWidth;
    if (ctx.measureText(displayMsg).width > maxMsgWidth && maxMsgWidth > 20) {
      while (displayMsg.length > 3 && ctx.measureText(displayMsg + '…').width > maxMsgWidth) {
        displayMsg = displayMsg.slice(0, -1);
      }
      displayMsg += '…';
    }
    ctx.fillText(displayMsg, 42 + nameWidth, y + 2);

    y += 36;
  }
}

async function toggleVideoPip() {
  initPipCanvas();
  drawPipCanvas();

  if (document.pictureInPictureElement) {
    await document.exitPictureInPicture().catch(() => {});
    if ($('pip-video-btn')) $('pip-video-btn').textContent = '📌 Ghim Nổi 100% (như YouTube)';
    if ($('pip-scroll-controls')) $('pip-scroll-controls').style.display = 'none';
    return;
  }

  try {
    await pipVideo.play();
    await pipVideo.requestPictureInPicture();
    if ($('pip-video-btn')) $('pip-video-btn').textContent = '❌ Đóng Ghim Nổi';
    if ($('pip-scroll-controls')) $('pip-scroll-controls').style.display = 'inline-flex';
  } catch (err) {
    console.error('Lỗi mở Video PiP:', err);
    toast('Trình duyệt chưa cho phép ghim nổi (cần bấm tương tác chuột)', true);
  }
}

async function toggleDocPip() {
  if (pipWin) {
    try { pipWin.close(); } catch {}
    pipWin = null;
    if ($('pip-doc-btn')) $('pip-doc-btn').textContent = '🪟 Cửa Sổ HTML (Cuộn chuột)';
    return;
  }

  if (!('documentPictureInPicture' in window)) {
    const pop = window.open('', 'pipLog', 'width=420,height=580,scrollbars=yes');
    if (!pop) return toast('Trình duyệt chặn mở cửa sổ mới', true);
    setupPipWindowDOM(pop);
    pipWin = pop;
    if ($('pip-doc-btn')) $('pip-doc-btn').textContent = '❌ Đóng HTML';
    return;
  }

  try {
    const win = await window.documentPictureInPicture.requestWindow({ width: 420, height: 580 });
    setupPipWindowDOM(win);
    pipWin = win;

    win.addEventListener('pagehide', () => {
      pipWin = null;
      if ($('pip-doc-btn')) $('pip-doc-btn').textContent = '🪟 Cửa Sổ HTML (Cuộn chuột)';
    });

    if ($('pip-doc-btn')) $('pip-doc-btn').textContent = '❌ Đóng HTML';
  } catch (err) {
    console.error('Lỗi mở Document PiP:', err);
    toast('Trình duyệt từ chối mở cửa sổ nổi', true);
  }
}

function setupPipWindowDOM(win) {
  const doc = win.document;
  doc.title = '💬 Live Chat & Quà';

  const style = doc.createElement('style');
  style.textContent = `
    * { box-sizing: border-box; }
    body { background: #0d1117; color: #e6edf3; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 0; margin: 0; height: 100vh; display: flex; flex-direction: column; overflow: hidden; user-select: text; }
    header { background: #161b22; border-bottom: 1px solid #30363d; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; flex: none; }
    h3 { margin: 0; font-size: 15px; color: #ffe066; font-weight: 800; }
    .viewers { font-size: 13px; color: #8b949e; font-weight: 600; }
    .container { flex: 1; overflow-y: auto; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; scroll-behavior: smooth; }
    .container::-webkit-scrollbar { width: 6px; }
    .container::-webkit-scrollbar-thumb { background: #30363d; border-radius: 4px; }
    .container::-webkit-scrollbar-thumb:hover { background: #8b949e; }
    .log-item { padding: 8px 12px; border-radius: 8px; background: rgba(255,255,255,0.05); font-size: 14px; line-height: 1.45; word-break: break-word; border: 1px solid transparent; transition: background 150ms; }
    .log-item:hover { background: rgba(255,255,255,0.09); }
    .log-item.gift { background: rgba(255, 211, 107, 0.12); border-color: rgba(255, 211, 107, 0.3); }
    .log-item.sim { border-left: 3px solid #ffc107; }
    .log-item b { color: #58a6ff; font-weight: 700; }
    .log-item.gift b { color: #ffe066; }
    .scroll-btn { position: fixed; bottom: 12px; right: 14px; padding: 6px 14px; border-radius: 20px; background: #238636; color: #fff; border: 0; font-weight: 800; font-size: 13px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.5); display: none; z-index: 99; }
    .scroll-btn:hover { background: #2ea043; }
  `;
  doc.head.appendChild(style);

  const header = doc.createElement('header');
  header.innerHTML = '<h3>💬 Live Chat & Quà Tặng</h3><div style="display:flex;gap:10px;align-items:center;"><span id="pip-diamonds" class="diamonds" style="color:#ffe066;font-weight:700;font-size:13px;">💎 0 ($0.00)</span><span id="pip-viewers" class="viewers">👀 0</span></div>';

  const container = doc.createElement('div');
  container.className = 'container';
  container.id = 'log-container';

  const scrollBtn = doc.createElement('button');
  scrollBtn.className = 'scroll-btn';
  scrollBtn.id = 'scroll-btn';
  scrollBtn.textContent = '⬇ Bình luận mới';

  doc.body.append(header, container, scrollBtn);

  userScrolledUp = false;
  container.addEventListener('scroll', () => {
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 40;
    userScrolledUp = !isAtBottom;
    scrollBtn.style.display = userScrolledUp ? 'block' : 'none';
  });

  scrollBtn.addEventListener('click', () => {
    container.scrollTop = container.scrollHeight;
    userScrolledUp = false;
    scrollBtn.style.display = 'none';
  });

  const mainLogs = [...$('log').children];
  for (let i = mainLogs.length - 1; i >= 0; i--) {
    const item = mainLogs[i];
    let rawObj = null;
    try { rawObj = item.dataset.rawObj ? JSON.parse(item.dataset.rawObj) : null; } catch {}
    appendPipLogNode(doc, container, rawObj || { type: item.dataset.type || 'chat', nickname: item.querySelector('b')?.textContent || '', text: item.innerText });
  }

  setTimeout(() => {
    container.scrollTop = container.scrollHeight;
  }, 50);
}

function appendPipLogNode(doc, container, e) {
  const div = doc.createElement('div');
  div.className = `log-item${e.type === 'gift' ? ' gift' : ''}${e.simulated ? ' sim' : ''}`;
  const icon = e.type === 'chat' ? '💬' : e.type === 'gift' ? '🎁' : e.type === 'like' ? '❤' : e.type === 'follow' ? '💖' : '↗';

  const who = doc.createElement('b');
  who.textContent = e.nickname || 'Khách';

  div.append(`${icon} `, who, e.text ? `: ${e.text}` : '');
  container.appendChild(div);

  while (container.children.length > 300) {
    container.removeChild(container.firstChild);
  }

  if (!userScrolledUp) {
    container.scrollTop = container.scrollHeight;
  }
}

function appendLog(e) {
  pipLogs.push(e);
  if (pipLogs.length > 100) pipLogs.shift();
  drawPipCanvas();

  const li = document.createElement('li');
  if (e.simulated) li.className = 'sim';
  li.dataset.rawObj = JSON.stringify(e);
  li.dataset.type = e.type;
  const who = document.createElement('b');
  who.textContent = e.nickname;
  const typeIcon = e.type === 'chat' ? '💬' : e.type === 'gift' ? '🎁' : e.type === 'like' ? '❤' : e.type === 'follow' ? '💖' : e.type === 'share' ? '↗' : e.type;
  li.append(`${typeIcon} `, who, e.text ? `: ${e.text}` : '');
  $('log').prepend(li);
  while ($('log').children.length > 100) $('log').lastChild.remove();

  if (pipWin && pipWin.document) {
    const container = pipWin.document.getElementById('log-container');
    if (container) {
      appendPipLogNode(pipWin.document, container, e);
    }
  }
}
// (vòng này từng bị xoá nhầm ở commit 9a982d4 → các công tắc màn hình bấm không ăn — giữ nguyên)
for (const key of ['sound', 'music', 'tts', 'ttsWelcome', 'ttsEnglish', 'legend']) {
  $(`set-${key}`).addEventListener('change', (e) => run({ t: 'settings', [key]: e.target.checked }, 'Đã lưu'));
}
$('welcome-form').addEventListener('submit', (e) => {
  e.preventDefault();
  run({ t: 'settings', welcomeTextAbove: Number($('set-welcome-above').value) || 0 }, 'Đã lưu ngưỡng');
});
// chủ đề mùa (một chỗ chọn ở thanh trên): đổi cả màn hình live + nhạc nền + trang này
for (const b of document.querySelectorAll('#season-pick button')) {
  b.addEventListener('click', () => run({ t: 'settings', season: b.dataset.season }, `Chủ đề: ${b.textContent}`));
}
$('set-ttsVoice').addEventListener('change', (e) => run({ t: 'settings', ttsVoice: e.target.value }, 'Đã đổi giọng đọc'));
// Nghe thử giọng ngay trên trang này (máy chủ đọc bằng VieNeu; lần đầu mỗi câu mất 1–3 giây)
$('tts-preview').addEventListener('click', async () => {
  const text = 'Quá đỉnh! Cảm ơn Minh Tuấn, đã tặng 5 Hoa hồng! Mời VIP lên sân khấu!';
  const voice = pickVoice($('set-ttsVoice').value, String(Math.random())); // nghe thử: mỗi lần bấm một giọng
  const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice)}`).catch(() => null);
  if (!res?.ok) return toast(res ? await res.text() : 'Không kết nối được máy chủ', true);
  toast(`🔊 ${voice}`);
  new Audio(URL.createObjectURL(await res.blob())).play().catch(() => toast('Trình duyệt chặn phát tiếng — bấm lại'));
});
// Nghe thử giọng tiếng Anh: mỗi lần bấm một từ + một giọng khác (Mỹ / Anh / Úc, nam / nữ)
const EN_SAMPLES = ['pronunciation', 'vocabulary', 'beautiful', 'congratulations', 'opportunity', 'strawberry', 'environment', 'comfortable'];
$('tts-en-preview').addEventListener('click', async () => {
  const word = EN_SAMPLES[Math.floor(Math.random() * EN_SAMPLES.length)];
  const res = await fetch(`/api/tts-en?text=${encodeURIComponent(word)}&voice=random`).catch(() => null);
  if (!res?.ok) return toast(res ? await res.text() : 'Không kết nối được máy chủ', true);
  toast(`🔊 ${word} · ${res.headers.get('X-Voice') || ''}`);
  new Audio(URL.createObjectURL(await res.blob())).play().catch(() => toast('Trình duyệt chặn phát tiếng — bấm lại'));
});
for (const key of ['volume', 'musicVolume']) {
  $(`set-${key}`).addEventListener('change', (e) => run({ t: 'settings', [key]: Number(e.target.value) }, 'Đã lưu'));
}
// Nghe ở khung xem trước: nhớ theo trình duyệt này, báo cho khung qua postMessage (cùng nguồn).
const previewSoundOn = () => { try { return localStorage.getItem('previewSound') === '1'; } catch { return false; } };
const sendPreviewSound = () => $('preview').contentWindow?.postMessage({ t: 'previewSound', on: $('preview-sound').checked }, location.origin);
$('preview-sound').checked = previewSoundOn();
$('preview-sound').addEventListener('change', () => {
  try { localStorage.setItem('previewSound', $('preview-sound').checked ? '1' : '0'); } catch { /* bỏ qua */ }
  sendPreviewSound();
});
$('preview').addEventListener('load', () => setTimeout(sendPreviewSound, 300));
$('login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  token = $('login-token').value.trim();
  try {
    sessionStorage.setItem('adminToken', token);
  } catch {
    // trình duyệt chặn lưu trữ: vẫn dùng token trong bộ nhớ trang
  }
  socket.send({ t: 'auth', token });
});

const stageUrl = `${location.origin}/stage`;
$('stage-url').textContent = stageUrl;
$('copy-stage').addEventListener('click', () => navigator.clipboard?.writeText(stageUrl).then(() => toast('Đã chép link')));
if ($('pip-video-btn')) $('pip-video-btn').addEventListener('click', toggleVideoPip);
if ($('pip-doc-btn')) $('pip-doc-btn').addEventListener('click', toggleDocPip);
if ($('pip-scroll-up')) $('pip-scroll-up').addEventListener('click', () => { pipScrollOffset = Math.min(pipLogs.length - 1, pipScrollOffset + 5); drawPipCanvas(); });
if ($('pip-scroll-down')) $('pip-scroll-down').addEventListener('click', () => { pipScrollOffset = Math.max(0, pipScrollOffset - 5); drawPipCanvas(); });
if ($('pip-scroll-latest')) $('pip-scroll-latest').addEventListener('click', () => { pipScrollOffset = 0; drawPipCanvas(); });
if ($('reset-session')) $('reset-session').addEventListener('click', () => {
  if (confirm('Xoá bảng xếp hạng phiên (kim cương/like)?')) run({ t: 'resetSession' });
});
if ($('reset-ambassadors')) $('reset-ambassadors').addEventListener('click', () => {
  if (confirm('Xoá bảng đại sứ share?')) run({ t: 'resetAmbassadors' });
});
if ($('disconnect')) $('disconnect').addEventListener('click', () => run({ t: 'disconnect' }));
$('reset-live').addEventListener('click', () => {
  if (confirm('Xoá TOÀN BỘ dữ liệu phiên live trước (số câu, điểm, bảng xếp hạng, năng lượng, follow, share, chế độ đề…)? Không hoàn tác được.')) {
    run({ t: 'resetLive' });
  }
});
function saveObsAutoRefresh() {
  const enabled = $('set-obs-autorefresh')?.checked;
  const intervalMs = Number($('set-obs-interval')?.value) || 7200000;
  const lagDetect = $('set-obs-lagdetect')?.checked;
  run({ t: 'setObsAutoRefresh', enabled, intervalMs, lagDetect });
}
$('set-obs-autorefresh')?.addEventListener('change', saveObsAutoRefresh);
$('set-obs-interval')?.addEventListener('change', saveObsAutoRefresh);
$('set-obs-lagdetect')?.addEventListener('change', saveObsAutoRefresh);

$('safe-reload-stages')?.addEventListener('click', () => {
  run({ t: 'safeReload' });
});
$('trigger-hsts')?.addEventListener('click', () => {
  run({ t: 'triggerHoangSaTruongSa' });
});
$('reload-stages')?.addEventListener('click', () => {
  if (confirm('Tải lại màn hình OBS ngay lập tức? Màn hình có thể chớp 1–2 giây.')) run({ t: 'reload' });
});

// ── 📝 Nhật ký đáp án Đố Vui ──
function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function parseLogLine(line) {
  if (!line || typeof line !== 'string') return null;
  const qMatch = line.match(/CÂU #(\d+)(?: \| Chủ đề: (.*?))? \| Gợi ý: "(.*?)" \| Đáp án: "(.*?)"/);
  if (qMatch) {
    return {
      kind: 'question',
      qNumber: qMatch[1],
      category: qMatch[2] || '',
      prompt: qMatch[3] || '',
      answer: qMatch[4] || ''
    };
  }
  const aMatch = line.match(/^\[(.*?)\] \[(.*?)\] gõ: "(.*?)" -> (.*)$/);
  if (aMatch) {
    const time = aMatch[1];
    const userStr = aMatch[2];
    const comment = aMatch[3];
    const statusStr = aMatch[4];
    return {
      kind: 'answer',
      time,
      user: { nickname: userStr },
      comment,
      statusStr,
      result: statusStr.startsWith('ĐÚNG') && !statusStr.includes('NHƯNG') ? 'correct'
        : statusStr.includes('CAP_REACHED') || statusStr.includes('ĐỦ 6') ? 'CAP_REACHED'
        : statusStr.includes('ALREADY_WON') || statusStr.includes('ĐÃ ĐƯỢC TÍNH') ? 'ALREADY_WON'
        : statusStr.includes('MAX_TRIES') || statusStr.includes('VƯỢT QUÁ') ? 'MAX_TRIES' : 'WRONG'
    };
  }
  return null;
}

function renderQuizAnswerNode(entry) {
  const li = document.createElement('li');
  if (entry.kind === 'question') {
    li.className = 'ans-q-hdr';
    li.innerHTML = `<span class="q-badge">CÂU #${entry.qNumber}</span> <span>Chủ đề: <b>${escapeHtml(entry.category || '—')}</b></span> | Gợi ý: <i>"${escapeHtml(entry.prompt || '')}"</i> | Đáp án: <span class="q-ans">${escapeHtml(entry.answer || '')}</span>`;
    return li;
  }
  const isCorrect = entry.result === 'correct' || (entry.rank > 0 && entry.points > 0);
  const isCap = entry.result === 'CAP_REACHED';
  const isAlready = entry.result === 'ALREADY_WON';
  const isMax = entry.result === 'MAX_TRIES';
  const isWrong = entry.result === 'WRONG';

  li.className = `ans-row${isCorrect ? ' correct' : isCap ? ' cap' : isWrong ? ' wrong' : ''}`;

  const timeSpan = `<span class="ans-time">[${escapeHtml(entry.time || '')}]</span>`;
  const userNick = entry.user?.nickname || 'Khách';
  const userUid = entry.user?.uniqueId ? `@${entry.user.uniqueId}` : '';
  const userSpan = `<span class="ans-user">${escapeHtml(userNick)} ${userUid && !userNick.includes(userUid) ? `<small style="color:#8b949e">(${escapeHtml(userUid)})</small>` : ''}</span>`;
  const commentSpan = `gõ: <span class="ans-comment">"${escapeHtml(entry.comment || '')}"</span>`;

  let badgeClass = 's-wrong';
  let badgeText = entry.statusStr || (isCorrect ? `ĐÚNG (Hạng ${entry.rank || 1}, +${entry.points || 10}đ)` : isWrong ? 'SAI' : entry.result);
  if (isCorrect) badgeClass = 's-correct';
  else if (isCap) badgeClass = 's-cap';
  else if (isAlready) badgeClass = 's-already';
  else if (isMax) badgeClass = 's-max';

  const statusSpan = `<span class="ans-status ${badgeClass}">${escapeHtml(badgeText)}</span>`;
  li.innerHTML = `${timeSpan} ${userSpan} ${commentSpan} ${statusSpan}`;
  return li;
}

function appendQuizAnswerEntry(entry) {
  const list = $('answers-log');
  const box = $('answers-scroll-box');
  if (!list) return;
  const node = renderQuizAnswerNode(entry);
  list.appendChild(node);
  while (list.children.length > 250) {
    list.removeChild(list.firstChild);
  }
  if ($('answers-count')) $('answers-count').textContent = `${list.children.length} mục`;
  if (box) {
    const isNearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    if (isNearBottom) box.scrollTop = box.scrollHeight;
  }
}

async function loadAnswersLog() {
  if (!authed) return;
  try {
    const reply = await socket.request({ t: 'getAnswersLog', limit: 200 });
    if (!reply?.ok || !Array.isArray(reply.lines)) return;
    const list = $('answers-log');
    const box = $('answers-scroll-box');
    if (!list) return;
    list.replaceChildren();
    for (const line of reply.lines) {
      const entry = parseLogLine(line);
      if (entry) {
        list.appendChild(renderQuizAnswerNode(entry));
      }
    }
    if ($('answers-count')) $('answers-count').textContent = `${list.children.length} mục`;
    if (box) box.scrollTop = box.scrollHeight;
  } catch (err) {
    console.warn('[answers-log] Không tải được log:', err);
  }
}

$('refresh-answers-btn')?.addEventListener('click', () => {
  loadAnswersLog();
  toast('Đã tải lại nhật ký đáp án');
});
$('clear-answers-btn')?.addEventListener('click', () => {
  $('answers-log')?.replaceChildren();
  if ($('answers-count')) $('answers-count').textContent = '0 mục';
});
