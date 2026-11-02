// Trang điều khiển: đăng nhập bằng token, kết nối live, đổi game, thử, cài đặt màn hình.
import { connectLiveSocket } from '/static/shared/live-socket-client.js';

const $ = (id) => document.getElementById(id);
const GAME_ICONS = { bar: '🍸', swim: '🏊', temple: '🪷' };
const GAME_COMMANDS = {
  bar: [['party', '🎉 Mở tiệc ngay'], ['clear', '🚪 Mời hết khách ra']],
  swim: [['pause', '⏸ Tạm dừng'], ['resume', '▶ Tiếp tục'], ['resetRound', '↺ Vòng mới'], ['resetWins', '🏆 Xoá số trận thắng']],
  temple: [['resetMerit', '✨ Xoá công đức'], ['clear', '🚪 Mời hết ra']]
};
const TEST_CHATS = { bar: ['chào cả quán', 'nhảy', 'cụng ly'], swim: ['cố lên', 'bơi đi'], temple: ['thắp hương', 'cầu cho gia đình bình an', 'xin xăm'] };
const GIFT_TIERS = [1, 5, 10, 30, 99, 199, 500];

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
  $('test-chats').replaceChildren(...(TEST_CHATS[activeGame] || []).map((text) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = `💬 ${text}`;
    b.addEventListener('click', () => sendTest({ kind: 'chat', comment: text }));
    return b;
  }));
}

function renderState(m) {
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
  for (const b of document.querySelectorAll('[data-test], #test-crowd, #test-chats button, #test-gifts button, #test-chat-form button')) b.disabled = locked;
  $('test-note').textContent = locked ? 'Đang live thật: nút thử bị khoá để không lẫn tương tác giả vào buổi live.' : 'Sự kiện thử hiện nhãn “CHẾ ĐỘ THỬ” trên màn hình.';
}

function applySettings(s) {
  if (!s) return;
  $('set-sound').checked = s.sound !== false;
  $('set-tts').checked = s.tts === true;
  $('set-legend').checked = s.legend !== false;
  $('set-volume').value = String(s.volume ?? 0.6);
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

const viewer = () => Number($('test-viewer').value) || 1;
const sendTest = (payload) => run({ t: 'test', viewer: viewer(), ...payload }, 'Đã gửi thử');

$('test-gifts').replaceChildren(...GIFT_TIERS.map((d) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip';
  b.textContent = `🎁 ${d}💎`;
  b.addEventListener('click', () => sendTest({ kind: 'gift', diamonds: d }));
  return b;
}));
for (const b of document.querySelectorAll('[data-test]')) b.addEventListener('click', () => sendTest({ kind: b.dataset.test, likes: 10 }));
$('test-crowd').addEventListener('click', async () => {
  for (let i = 0; i < 8; i += 1) await socket.request({ t: 'test', kind: 'chat', viewer: 10 + Math.floor(Math.random() * 40), comment: 'xin chào' });
  toast('Đã thêm khách thử');
});
$('test-chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if ($('test-comment').value.trim()) sendTest({ kind: 'chat', comment: $('test-comment').value });
});
$('connect-form').addEventListener('submit', (e) => {
  e.preventDefault();
  run({ t: 'connect', provider: $('provider').value, username: $('username').value });
});
$('disconnect').addEventListener('click', () => run({ t: 'disconnect' }));
$('reset-session').addEventListener('click', () => run({ t: 'resetSession' }));
for (const key of ['sound', 'tts', 'legend']) {
  $(`set-${key}`).addEventListener('change', (e) => run({ t: 'settings', [key]: e.target.checked }, 'Đã lưu'));
}
$('set-volume').addEventListener('change', (e) => run({ t: 'settings', volume: Number(e.target.value) }, 'Đã lưu'));
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
