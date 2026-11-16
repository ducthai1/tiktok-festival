import http from 'node:http';
import WebSocket from '../node_modules/ws/index.js';

const PID = 1460093;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getDebuggerUrl() {
  for (let i = 0; i < 10; i++) {
    try {
      const data = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9229/json/list', (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve(body));
        }).on('error', reject);
      });
      const list = JSON.parse(data);
      if (list && list[0]?.webSocketDebuggerUrl) {
        return list[0].webSocketDebuggerUrl;
      }
    } catch {}
    await sleep(300);
  }
  throw new Error('Không thể kết nối đến V8 Inspector trên cổng 9229');
}

async function main() {
  console.log(`[patch] Đang gửi SIGUSR1 đến tiến trình PID ${PID}...`);
  process.kill(PID, 'SIGUSR1');
  await sleep(600);

  const wsUrl = await getDebuggerUrl();
  console.log(`[patch] Đã tìm thấy Inspector URL: ${wsUrl}`);

  const ws = new WebSocket(wsUrl);

  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  console.log('[patch] Đã kết nối WebSocket Inspector.');

  function sendCmd(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = Math.floor(Math.random() * 1000000);
      const onMsg = (raw) => {
        const msg = JSON.parse(raw);
        if (msg.id === id) {
          ws.off('message', onMsg);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      };
      ws.on('message', onMsg);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // 1. Get Object.prototype objectId
  const protoRes = await sendCmd('Runtime.evaluate', { expression: 'Object.prototype' });
  const protoId = protoRes.result.objectId;

  // 2. Query objects
  const queryRes = await sendCmd('Runtime.queryObjects', { prototypeObjectId: protoId });
  const objectsId = queryRes.objects.objectId;

  // 3. Find and patch hub
  const patchRes = await sendCmd('Runtime.callFunctionOn', {
    objectId: objectsId,
    functionDeclaration: `function() {
      let foundHub = null;
      for (const obj of this) {
        if (obj && typeof obj.handleEvent === 'function' && typeof obj.snapshot === 'function' && typeof obj.setWelcomeThreshold === 'function') {
          foundHub = obj;
          break;
        }
      }
      if (!foundHub) return { ok: false, message: 'Không tìm thấy instance hub trong memory' };

      if (foundHub.__donorStepPatched) {
        return { ok: true, message: 'Hub đã được patch trước đó' };
      }

      const oldHandleEvent = foundHub.handleEvent;
      const myDonations = new Map();
      try {
        const snap = foundHub.snapshot();
        for (const d of snap.donors || []) {
          if (d.id && d.diamonds > 0) myDonations.set(d.id, d.diamonds);
        }
      } catch {}

      const STEP = 50;

      foundHub.handleEvent = function(event, now = Date.now()) {
        let milestoneFx = [];
        if (event.type === 'gift' && event.user?.id && event.gift?.diamonds > 0) {
          const before = myDonations.get(event.user.id) || 0;
          const total = before + event.gift.diamonds;
          myDonations.set(event.user.id, total);
          if (Math.floor(total / STEP) > Math.floor(before / STEP)) {
            const milestone = Math.floor(total / STEP) * STEP;
            if (!event.simulated) {
              console.log('[app] 🎉 ' + event.user.nickname + ' đạt mốc ' + milestone + '💎 trong phòng (tổng ' + total + '💎)');
            }
            milestoneFx.push({
              kind: 'donorMilestone',
              userId: event.user.id,
              nickname: event.user.nickname,
              avatar: event.user.avatar,
              milestone,
              total
            });
          }
        }
        const result = oldHandleEvent.call(this, event, now);
        const filtered = Array.isArray(result) ? result.filter(f => f.kind !== 'donorMilestone') : [];
        return [...filtered, ...milestoneFx];
      };

      const oldResetRoom = foundHub.resetRoom;
      foundHub.resetRoom = function() {
        myDonations.clear();
        return oldResetRoom ? oldResetRoom.apply(this, arguments) : undefined;
      };

      const oldResetAll = foundHub.resetAll;
      foundHub.resetAll = function() {
        myDonations.clear();
        return oldResetAll ? oldResetAll.apply(this, arguments) : undefined;
      };

      foundHub.__donorStepPatched = true;
      return { ok: true, message: 'Đã patch thành công hub.handleEvent sang mốc bước nhảy 50💎 (seeding ' + myDonations.size + ' donors)' };
    }`,
    returnByValue: true
  });

  console.log('[patch] Kết quả:', patchRes.result.value);

  // Close inspector session
  ws.close();
  console.log('[patch] Hoàn tất hot-patch!');
}

main().catch(console.error);
