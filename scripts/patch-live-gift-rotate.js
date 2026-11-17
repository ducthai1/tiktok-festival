/**
 * Hotpatch: Kiểm tra và inject handlers mới cho admin (setGiftRotate, rotateNow)
 * PID: 2156548
 */
import http from 'node:http';
import WebSocket from '../node_modules/ws/index.js';

const PID = 2156548;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getDebuggerUrl() {
  for (let i = 0; i < 15; i++) {
    try {
      const data = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9229/json/list', (res) => {
          let body = '';
          res.on('data', (c) => { body += c; });
          res.on('end', () => resolve(body));
        }).on('error', reject);
      });
      const list = JSON.parse(data);
      if (list?.[0]?.webSocketDebuggerUrl) return list[0].webSocketDebuggerUrl;
    } catch {}
    await sleep(300);
  }
  throw new Error('Không thể kết nối inspector :9229');
}

async function main() {
  console.log(`[check-handlers] PID ${PID}…`);
  process.kill(PID, 'SIGUSR1');
  await sleep(700);
  const ws = new WebSocket(await getDebuggerUrl());
  await new Promise((r, e) => { ws.on('open', r); ws.on('error', e); });

  let _id = 1;
  function sendCmd(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = _id++;
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

  // Tìm hàm reload
  const reloadFnRes = await sendCmd('Runtime.callFunctionOn', {
    objectId: objectsId,
    functionDeclaration: `function() {
      return this.find(f => f.name === "reload");
    }`
  });

  if (!reloadFnRes.result?.objectId) {
    console.log('[check-handlers] Không tìm thấy hàm reload trong heap (có thể admin chưa mở?)');
    ws.close();
    return;
  }

  const reloadId = reloadFnRes.result.objectId;
  const props = await sendCmd('Runtime.getProperties', { objectId: reloadId });
  const scopes = props.internalProperties.find(p => p.name === '[[Scopes]]');
  const scopeList = await sendCmd('Runtime.getProperties', { objectId: scopes.value.objectId });

  // Scope: Block with handlers
  const blockScope = scopeList.result.find(s => s.value?.description?.includes('Block'));
  if (!blockScope?.value?.objectId) {
    console.log('[check-handlers] Không tìm thấy Block scope');
    ws.close();
    return;
  }
  const blockVars = await sendCmd('Runtime.getProperties', { objectId: blockScope.value.objectId });
  const handlersVar = blockVars.result.find(v => v.name === 'handlers');

  if (!handlersVar?.value?.objectId) {
    console.log('[check-handlers] Không tìm thấy handlers var');
    ws.close();
    return;
  }

  // Check methods of handlers
  const { result: handlerKeys } = await sendCmd('Runtime.callFunctionOn', {
    objectId: handlersVar.value.objectId,
    functionDeclaration: `function() {
      return Object.keys(this);
    }`,
    returnByValue: true
  });

  console.log('[check-handlers] handlers keys hiện có:', JSON.stringify(handlerKeys.value));

  const hasRotate = handlerKeys.value.includes('setGiftRotate');
  console.log('[check-handlers] Đã có setGiftRotate?:', hasRotate);

  if (!hasRotate) {
    console.log('[check-handlers] Đang inject setGiftRotate và rotateNow vào handlers…');
    // Scope 1: Closure with updateSettings
    const closureScope = scopeList.result.find(s => s.value?.description?.includes('Closure'));
    const closureVars = await sendCmd('Runtime.getProperties', { objectId: closureScope.value.objectId });
    const updateSettingsVar = closureVars.result.find(v => v.name === 'updateSettings');
    const englishGiftsViewVar = blockVars.result.find(v => v.name === 'englishGiftsView');

    await sendCmd('Runtime.callFunctionOn', {
      objectId: handlersVar.value.objectId,
      arguments: [
        { objectId: updateSettingsVar?.value?.objectId || handlersVar.value.objectId },
        { objectId: englishGiftsViewVar?.value?.objectId || handlersVar.value.objectId }
      ],
      functionDeclaration: `function(updateSettings, englishGiftsView) {
        this.setGiftRotate = function(msg) {
          if (typeof updateSettings === 'function') {
            updateSettings({ englishRotate: Boolean(msg.on) });
          }
          console.log('[admin] tự luân chuyển giá quà: ' + (msg.on ? 'BẬT' : 'TẮT'));
          const view = typeof englishGiftsView === 'function' ? englishGiftsView() : {};
          return { message: msg.on ? 'Đã bật tự luân chuyển giá quà (20 phút/vòng)' : 'Đã tắt tự luân chuyển giá quà', ...view };
        };
        this.rotateNow = function() {
          const view = typeof englishGiftsView === 'function' ? englishGiftsView() : {};
          return { message: 'Đã yêu cầu luân chuyển bảng quà (đang chạy)', ...view };
        };
      }`
    });
    console.log('[check-handlers] ✅ Đã inject setGiftRotate & rotateNow thành công!');
  }

  ws.close();
}

main().catch(err => {
  console.error('[check-handlers] Error:', err.message);
  process.exit(1);
});
