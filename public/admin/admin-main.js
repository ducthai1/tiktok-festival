// Trang điều khiển: đăng nhập bằng token, kết nối live, đổi game, thử, cài đặt màn hình.
import { connectLiveSocket } from '/static/shared/live-socket-client.js';
import { createDemoRunner, renderDemoButtons } from './admin-demo-scenarios.js';
import { setupTestPanel } from './admin-test-panel.js';
import { SAMPLE_GIFTS, giftTier } from '/static/shared/gift-tiers.js';

const $ = (id) => document.getElementById(id);
const GAME_ICONS = { boss: '⚔️', temple: '🪷', bar: '🍸', dance: '🪩', swim: '🏊' };
const GAME_COMMANDS = {
  boss: [['frenzy', '⚡ Cuồng nộ ngay'], ['killBoss', '💥 Kết liễu Boss'], ['resetBoss', '↺ Reset Boss Cấp 1']],
  bar: [['party', '🎉 Mở tiệc ngay'], ['clear', '🚪 Mời hết khách ra']],
  dance: [['drop', '💥 DROP ngay'], ['clear', '🚪 Mời hết ra'], ['seeds', '🎭 Bật/tắt người nhảy ảo']],
  swim: [['pause', '⏸ Tạm dừng'], ['resume', '▶ Tiếp tục'], ['resetRound', '↺ Vòng mới'], ['resetWins', '🏆 Xoá số trận thắng']],
  temple: [['resetMerit', '✨ Xoá công đức'], ['clear', '🚪 Mời hết ra']]
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
    } else if (m.t === 'authFail') {
      $('login').hidden = false;
      $('app').hidden = true;
      toast('Token sai', true);
    } else if (m.t === 'hello') {
      renderGames(m.games);
      applySettings(m.settings);
      renderLive(m.live);
      testPanel.setGifts(m.sampleGifts);
    } else if (m.t === 'gifts') {
      if (m.sampleGifts) testPanel.setGifts(m.sampleGifts);
    } else if (m.t === 'adminInfo') {
      $('provider').value = m.provider;
      if (m.username && !$('username').value) $('username').value = m.username;
    } else if (m.t === 'settings') applySettings(m.settings);
    else if (m.t === 'live') renderLive(m.status);
    else if (m.t === 'state') renderState(m);
    else if (m.t === 'log') appendLog(m.event);
  }
});

async function run(message, okText) {
  if (!authed) return toast('Chưa mở khoá', true);
  const reply = await socket.request(message);
  if (reply.ok) toast(okText || reply.message || 'OK');
  else toast(reply.message || 'Lỗi', true);
  return reply;
}

function renderGames(games) {
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

function renderState(m) {
  renderGrantList(m.state);
  if (m.game !== activeGame) {
    activeGame = m.game;
    for (const b of $('game-buttons').children) b.classList.toggle('active', b.dataset.game === activeGame);
    renderCommands();
  }
  $('leaderboard').replaceChildren(...m.top.map((r) => {
    const li = document.createElement('li');
    li.textContent = `${r.nickname} — ${r.diamonds}💎 · ${r.likes}❤`;
    return li;
  }));
  const v = m.viewers || {};
  $('viewers-status').textContent = `👀 ${v.count || 0} người xem · đang chờ chào: ${v.waiting || 0} · `
    + `${(v.count || 0) > (v.textAbove ?? 1000) ? 'phòng đông → chỉ hiện chữ' : 'đang chào từng người'}`;
  const t = m.totals;
  $('totals').textContent = `Phiên này: ${t.viewers} người · ${t.diamonds}💎 · ${t.likes}❤ · ${t.chats} bình luận · ${t.follows} follow · ${t.shares} share`;
}

function renderLive(status) {
  if (!status) return;
  liveState = status.state;
  const el = $('live-status');
  el.className = `status ${status.state}`;
  el.textContent = status.message;
  const locked = liveState === 'connected';
  for (const b of document.querySelectorAll('[data-test], [id^="test-"] button, #test-crowd, [id^="test-arrive"], #demo button')) b.disabled = locked;
  $('test-note').textContent = locked ? 'Đang live thật: nút thử bị khoá để không lẫn tương tác giả vào buổi live.' : 'Sự kiện thử hiện nhãn “CHẾ ĐỘ THỬ” trên màn hình.';
}

function applySettings(s) {
  if (!s) return;
  $('set-sound').checked = s.sound !== false;
  $('set-tts').checked = s.tts === true;
  $('set-legend').checked = s.legend !== false;
  $('set-volume').value = String(s.volume ?? 0.6);
  $('set-music').checked = s.music !== false;
  $('set-musicVolume').value = String(s.musicVolume ?? 0.35);
  $('set-ttsWelcome').checked = s.ttsWelcome === true;
  if (s.ttsVoice) $('set-ttsVoice').value = s.ttsVoice;
  if (document.activeElement !== $('set-welcome-above')) $('set-welcome-above').value = String(s.welcomeTextAbove ?? 1000);
}

function appendLog(e) {
  const li = document.createElement('li');
  if (e.simulated) li.className = 'sim';
  const who = document.createElement('b');
  who.textContent = e.nickname;
  li.append(`${e.type} · `, who, e.text ? `: ${e.text}` : '');
  $('log').prepend(li);
  while ($('log').children.length > 80) $('log').lastChild.remove();
}

const testPanel = setupTestPanel({ $, run, socket, toast });
const demo = createDemoRunner({ socket, toast, setStatus: (text) => { $('demo-status').textContent = text; } });
$('connect-form').addEventListener('submit', (e) => {
  e.preventDefault();
  run({ t: 'connect', provider: $('provider').value, username: $('username').value });
});
$('disconnect').addEventListener('click', () => run({ t: 'disconnect' }));
$('reset-session').addEventListener('click', () => run({ t: 'resetSession' }));
for (const key of ['sound', 'music', 'tts', 'ttsWelcome', 'legend']) {
  $(`set-${key}`).addEventListener('change', (e) => run({ t: 'settings', [key]: e.target.checked }, 'Đã lưu'));
}
$('welcome-form').addEventListener('submit', (e) => {
  e.preventDefault();
  run({ t: 'settings', welcomeTextAbove: Number($('set-welcome-above').value) || 0 }, 'Đã lưu ngưỡng');
});
$('set-ttsVoice').addEventListener('change', (e) => run({ t: 'settings', ttsVoice: e.target.value }, 'Đã đổi giọng đọc'));
// Nghe thử giọng ngay trên trang này (máy chủ đọc bằng VieNeu; lần đầu mỗi câu mất 1–3 giây)
$('tts-preview').addEventListener('click', async () => {
  const text = 'Quá đỉnh! Minh Tuấn ơi! Cảm ơn bạn đã tặng 5 Hoa hồng! Mời VIP lên sân khấu!';
  const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}&voice=${encodeURIComponent($('set-ttsVoice').value)}`).catch(() => null);
  if (!res?.ok) return toast(res ? await res.text() : 'Không kết nối được máy chủ', true);
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
