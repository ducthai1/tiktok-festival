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
      if (list && list[0]?.webSocketDebuggerUrl) return list[0].webSocketDebuggerUrl;
    } catch {}
    await sleep(300);
  }
  throw new Error('Không thể kết nối đến V8 Inspector trên cổng 9229');
}

async function main() {
  process.kill(PID, 'SIGUSR1');
  await sleep(600);
  const wsUrl = await getDebuggerUrl();
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

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

  await sendCmd('Debugger.enable');
  const protoRes = await sendCmd('Runtime.evaluate', { expression: 'Function.prototype' });
  const protoId = protoRes.result.objectId;
  const queryRes = await sendCmd('Runtime.queryObjects', { prototypeObjectId: protoId });
  const objectsId = queryRes.objects.objectId;

  // Find reload function
  const reloadFnRes = await sendCmd('Runtime.callFunctionOn', {
    objectId: objectsId,
    functionDeclaration: `function() {
      return this.find(f => f.name === "reload");
    }`
  });

  if (!reloadFnRes.result?.objectId) {
    throw new Error('Không tìm thấy hàm reload trong heap');
  }

  const reloadId = reloadFnRes.result.objectId;
  const props = await sendCmd('Runtime.getProperties', { objectId: reloadId });
  const scopes = props.internalProperties.find(p => p.name === '[[Scopes]]');
  const scopeList = await sendCmd('Runtime.getProperties', { objectId: scopes.value.objectId });

  // Scope 0: Block with handlers
  const blockScope = scopeList.result.find(s => s.value?.description?.includes('Block'));
  const blockVars = await sendCmd('Runtime.getProperties', { objectId: blockScope.value.objectId });
  const handlersVar = blockVars.result.find(v => v.name === 'handlers');

  // Scope 1: Closure with sockets, settings, updateSettings
  const closureScope = scopeList.result.find(s => s.value?.description?.includes('Closure'));
  const closureVars = await sendCmd('Runtime.getProperties', { objectId: closureScope.value.objectId });
  const socketsVar = closureVars.result.find(v => v.name === 'sockets');
  const updateSettingsVar = closureVars.result.find(v => v.name === 'updateSettings');

  console.log('Đã định vị handlers, sockets, updateSettings trong scope của Node.js');

  // Patch handlers object directly!
  const patchRes = await sendCmd('Runtime.callFunctionOn', {
    objectId: handlersVar.value.objectId,
    arguments: [
      { objectId: socketsVar.value.objectId },
      { objectId: updateSettingsVar.value.objectId }
    ],
    functionDeclaration: `function(sockets, updateSettings) {
      this.safeReload = function() {
        sockets?.broadcast({ t: 'safeReload' });
        return { message: 'Đã lên lịch: Sẽ tự làm mới ngay khi kết thúc câu hỏi này (không gián đoạn live)' };
      };
      this.setObsAutoRefresh = function(msg) {
        const enabled = Boolean(msg.enabled);
        const intervalMs = Math.max(1800_000, Math.min(24 * 3600_000, Number(msg.intervalMs) || 7200_000));
        const lagDetect = msg.lagDetect !== false;
        const obsAutoRefresh = { enabled, intervalMs, lagDetect };
        updateSettings({ obsAutoRefresh });
        return { message: enabled ? ('Tự làm mới OBS mỗi ' + (Math.round(intervalMs / 3600_000 * 10) / 10) + ' giờ (khi hết câu)') : 'Đã tắt tự làm mới OBS' };
      };
      return Object.keys(this);
    }`,
    returnByValue: true
  });

  console.log('✅ Handlers đã được hot-patch thành công trên server live PID', PID);
  console.log('Các lệnh admin hiện có:', patchRes.result.value);

  ws.close();
}

main().catch(err => {
  console.error('Lỗi hot-patch:', err);
  process.exit(1);
});
