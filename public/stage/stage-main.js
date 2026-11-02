// Màn hình OBS: nhận trạng thái từ server, vẽ đúng game đang chọn, chuyển cảnh có màn mờ.
import { connectLiveSocket } from '/static/shared/live-socket-client.js';
import { createStageAudio } from './stage-audio.js';
import { createHud } from './stage-hud.js';
import { createLabelLayer } from './stage-labels.js';
import { createRenderPipeline, STAGE_HEIGHT, STAGE_WIDTH } from './stage-render-pipeline.js';

const SCENES = {
  bar: () => import('./scenes/bar-scene.js').then((m) => m.createBarScene),
  swim: () => import('./scenes/swim-scene.js').then((m) => m.createSwimScene),
  temple: () => import('./scenes/temple-scene.js').then((m) => m.createTempleScene)
};

const stageEl = document.getElementById('stage');
const fadeEl = document.getElementById('fade');
const pipeline = createRenderPipeline(document.getElementById('scene'));
const hud = createHud();
const labels = createLabelLayer(document.getElementById('labels'));
const audio = createStageAudio();
let settings = { legend: true };
// Khung xem trước trong trang điều khiển: tắt tiếng để không đọc/kêu trùng với nguồn OBS.
const isPreview = new URLSearchParams(location.search).has('preview');
let previewSound = false; // trang điều khiển bật "Nghe ở khung xem trước"
const applyAudio = () => audio.configure(isPreview && !previewSound ? { ...settings, sound: false, tts: false, ttsWelcome: false } : settings);
if (isPreview) {
  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin || event.data?.t !== 'previewSound') return;
    previewSound = event.data.on === true;
    if (previewSound) audio.unlock();
    applyAudio();
  });
}
let current = null;
let currentId = '';
let switching = null;
let latest = null;

// Mở /stage trong tab thường (không phải OBS, không phải khung xem trước): nhắc bấm để bật tiếng.
if (!isPreview && !window.obsstudio && !navigator.userActivation?.hasBeenActive) {
  const hint = document.getElementById('sound-hint');
  hint.hidden = false;
  const unlock = () => {
    audio.unlock();
    hint.hidden = true;
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}

function fit() {
  const scale = Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT);
  stageEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
  pipeline.resize(scale);
}
window.addEventListener('resize', fit);
fit();

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function switchScene(id) {
  if (!SCENES[id]) return;
  const factory = await SCENES[id]();
  fadeEl.classList.add('on');
  if (current) await wait(400);
  current?.dispose();
  current = factory({ hud, labels, audio, pipeline });
  currentId = id;
  stageEl.classList.remove('theme-bar', 'theme-swim', 'theme-temple');
  stageEl.classList.add(`theme-${id}`);
  audio.setTheme(id);
  hud.setLegend(current.legend || [], settings.legend !== false);
  if (latest?.game === id) current.update(latest);
  fadeEl.classList.remove('on');
}

// Chào người mới: thẻ tên chung cho mọi game + hiệu ứng 3D riêng của từng cảnh.
function onWelcome(fx) {
  const w = current?.welcome || {};
  if (fx.mode === 'text') return hud.welcomeLine(fx.nickname);
  hud.welcome(fx, w.line);
  audio.play('welcome');
  if (fx.mode === 'group') {
    const names = fx.people.slice(0, 3).map((p) => p.nickname).join(', ');
    const more = fx.people.length > 3 ? ` và ${fx.people.length - 3} bạn nữa` : '';
    audio.speak(`Chào mừng ${names}${more}`, 'welcome');
  } else {
    audio.speak(w.speech ? w.speech(fx.nickname) : `Chào mừng ${fx.nickname}`, 'welcome');
  }
  return current?.onFx(fx);
}

function onState(message) {
  latest = message;
  hud.setTestMode(Boolean(message.testMode));
  if (message.game !== currentId) {
    if (!switching) switching = switchScene(message.game).finally(() => { switching = null; });
    return;
  }
  try {
    current?.update(message);
  } catch (error) {
    console.error('[stage] lỗi cập nhật:', error);
  }
}

connectLiveSocket({
  onOpen: () => hud.setOffline(false),
  onClose: () => hud.setOffline(true),
  onMessage(message) {
    if (message.t === 'hello' || message.t === 'settings') {
      settings = message.settings || settings;
      applyAudio();
      if (current) hud.setLegend(current.legend || [], settings.legend !== false);
    } else if (message.t === 'state') onState(message);
    else if (message.t === 'fx' && message.game === currentId && current) {
      for (const fx of message.list) {
        try {
          if (fx.kind === 'welcome') onWelcome(fx);
          else current.onFx(fx);
        } catch (error) {
          console.error('[stage] lỗi hiệu ứng:', fx.kind, error);
        }
      }
    }
  }
});

let last = performance.now();
let frameErrors = 0;
function loop(now) {
  requestAnimationFrame(loop); // đặt khung sau TRƯỚC: lỗi một khung không được làm đứng hình cả buổi live
  // dt không bao giờ âm/quá lớn: tab bị ẩn rồi hiện lại, hay đồng hồ lệch, nhân vật cũng không bị kéo lùi/nhảy cóc.
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = Math.max(last, now);
  if (!current) return;
  try {
    current.frame(dt, now / 1000);
    pipeline.render(current.scene, current.camera);
    labels.render(current.camera);
  } catch (error) {
    if ((frameErrors += 1) < 5) console.error('[stage] lỗi khung hình:', error);
  }
}
requestAnimationFrame(loop);

// Để kiểm tra bằng trình duyệt tự động: chụp màn hình sau đúng N khung hình.
window.__stage = {
  step(frames = 1, dt = 1 / 30) {
    for (let i = 0; i < frames; i += 1) {
      last += dt * 1000;
      if (current) current.frame(dt, last / 1000);
    }
    if (current) {
      pipeline.render(current.scene, current.camera);
      labels.render(current.camera);
    }
    return currentId;
  },
  probe: (id) => current?.probe?.(id) || null,
  audioState: () => audio.state(),
  audioLevel: () => audio.level(),
  playSound: (name) => audio.play(name),
  // Chỉ để chụp ảnh kiểm tra: phát hiệu ứng ngay trên màn hình này, không qua server.
  inject(list) {
    for (const fx of list) {
      if (fx.kind === 'welcome') onWelcome(fx);
      else current?.onFx(fx);
    }
  }
};
