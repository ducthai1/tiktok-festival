/**
 * Hotpatch v2: Fan CLB (Heart Me) — dùng đúng pattern callFunctionOn với `this`
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
  console.log(`[patch-fan] PID ${PID}…`);
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

  await sendCmd('Runtime.enable');

  // ── Tìm gameHub: queryObjects(Object.prototype) → duyệt mảng với this ──
  const { result: opRef } = await sendCmd('Runtime.evaluate', {
    expression: 'Object.prototype',
    returnByValue: false,
  });
  const { objects: allObjs } = await sendCmd('Runtime.queryObjects', {
    prototypeObjectId: opRef.objectId,
  });

  // `this` = mảng các object, không có arguments
  const { result: hubRef } = await sendCmd('Runtime.callFunctionOn', {
    objectId: allObjs.objectId,
    functionDeclaration: `function() {
      const arr = this;
      for (let i = 0; i < arr.length; i++) {
        try {
          const o = arr[i];
          if (o && typeof o.handleEvent === 'function'
              && typeof o.tick === 'function'
              && typeof o.switchTo === 'function'
              && typeof o.resetRoom === 'function') {
            return o;
          }
        } catch {}
      }
      return null;
    }`,
    returnByValue: false,
  });

  if (!hubRef?.objectId) {
    console.error('❌ Không tìm được gameHub!');
    ws.close(); process.exit(1);
  }
  console.log('[patch-fan] ✅ Tìm thấy gameHub');

  // ── Kiểm tra đã patch chưa, `this` = hubObj ──
  const { result: checkR } = await sendCmd('Runtime.callFunctionOn', {
    objectId: hubRef.objectId,
    functionDeclaration: `function() {
      return {
        alreadyPatched: !!this.__fanClubPatched,
        heSrc: this.handleEvent.toString().substring(0, 120)
      };
    }`,
    returnByValue: true,
  });
  console.log('[patch-fan] check:', JSON.stringify(checkR.value));

  if (checkR.value?.alreadyPatched) {
    console.log('[patch-fan] ✅ Đã patch rồi, bỏ qua.');
    ws.close(); return;
  }

  // ── Patch: `this` = hubObj ──
  const { result: patchR } = await sendCmd('Runtime.callFunctionOn', {
    objectId: hubRef.objectId,
    functionDeclaration: `function() {
      const hub = this;
      const origHandleEvent = hub.handleEvent.bind(hub);

      const FANCLUB_GIFT_IDS = new Set(['7934']);
      const FANCLUB_GIFT_NAMES = new Set(['heart me']);
      const fanGreeted = new Set();

      function fanClubJoin(event) {
        if (event.type !== 'gift' || !event.user?.id) return [];
        const name = String(event.gift?.name || '').trim().toLowerCase();
        const idOk = FANCLUB_GIFT_IDS.has(String(event.gift?.id || ''));
        const nameOk = FANCLUB_GIFT_NAMES.has(name);
        if (!idOk && !nameOk) return [];
        if (fanGreeted.has(event.user.id)) return [];
        fanGreeted.add(event.user.id);
        if (!event.simulated) console.log('[app] 💞 ' + event.user.nickname + ' vào CLB (cấp ' + (Number(event.user.fanLevel)||1) + ')');
        return [{ kind: 'fanJoin', userId: event.user.id, nickname: event.user.nickname,
          avatar: event.user.avatar, level: Number(event.user.fanLevel) || 1,
          gift: event.gift.name, image: event.gift.pictureUrl || '' }];
      }

      hub.handleEvent = function handleEvent(event, now) {
        const result = origHandleEvent(event, now);
        const fanFx = fanClubJoin(event);
        if (!fanFx.length) return result;
        const idx = result.findIndex(fx => fx.kind === 'welcome');
        if (idx >= 0) result.splice(idx, 0, ...fanFx);
        else result.push(...fanFx);
        return result;
      };

      const origResetRoom = hub.resetRoom.bind(hub);
      hub.resetRoom = function resetRoom() {
        fanGreeted.clear();
        return origResetRoom();
      };
      if (hub.resetSession) {
        const origResetSession = hub.resetSession.bind(hub);
        hub.resetSession = function resetSession() {
          fanGreeted.clear();
          return origResetSession();
        };
      }

      hub.__fanClubPatched = true;
      hub.__fanGreeted = fanGreeted;
      return 'OK — fanClubJoin active';
    }`,
    returnByValue: true,
  });
  console.log('[patch-fan] Patch result:', patchR.value);

  if (patchR.value !== 'OK — fanClubJoin active') {
    console.error('❌ Patch thất bại:', patchR.value);
    ws.close(); process.exit(1);
  }

  // ── Cũng patch normalizeConnectorUser và normalizeTikfinity
  //    để fanClub/fanLevel đi qua khi TikTok gửi data ──
  // Tìm qua Function.prototype
  const { result: fpRef } = await sendCmd('Runtime.evaluate', {
    expression: 'Function.prototype',
    returnByValue: false,
  });
  const { objects: fnObjs } = await sendCmd('Runtime.queryObjects', {
    prototypeObjectId: fpRef.objectId,
  });

  // Tìm normalizeConnectorUser và normalizeTikfinity, kiểm tra có fanClub chưa
  const { result: normCheckR } = await sendCmd('Runtime.callFunctionOn', {
    objectId: fnObjs.objectId,
    functionDeclaration: `function() {
      const fns = this;
      const results = [];
      for (let i = 0; i < fns.length; i++) {
        try {
          const f = fns[i];
          if (typeof f !== 'function') continue;
          const src = f.toString();
          if (src.includes('fansClub') || src.includes('fanClubLevel') || src.includes('fansLevel')) {
            results.push({ name: f.name, hasFanClub: src.includes('fanClub') });
          }
        } catch {}
      }
      return results;
    }`,
    returnByValue: true,
  });
  console.log('[patch-fan] normalize functions có fan data:', JSON.stringify(normCheckR.value));

  // ── Test: gửi event Heart Me giả lập ──
  const { result: testR } = await sendCmd('Runtime.callFunctionOn', {
    objectId: hubRef.objectId,
    functionDeclaration: `function() {
      try {
        const hub = this;
        const e = {
          type: 'gift', simulated: true,
          user: { id: '__test_fan__', nickname: 'TestFan', avatar: '', fanLevel: 5 },
          gift: { id: '7934', name: 'Heart Me', diamonds: 1, pictureUrl: '' },
          viewerCount: null
        };
        const fx = hub.handleEvent(e, Date.now());
        const fan = fx.filter(f => f.kind === 'fanJoin');
        return { total: fx.length, fanFx: fan };
      } catch(err) { return { error: err.message }; }
    }`,
    returnByValue: true,
  });
  console.log('[patch-fan] 🧪 Test Heart Me:', JSON.stringify(testR.value, null, 2));

  // ── Test lần 2: cùng user không được mừng lại ──
  const { result: test2R } = await sendCmd('Runtime.callFunctionOn', {
    objectId: hubRef.objectId,
    functionDeclaration: `function() {
      const hub = this;
      const e = {
        type: 'gift', simulated: true,
        user: { id: '__test_fan__', nickname: 'TestFan', avatar: '', fanLevel: 5 },
        gift: { id: '7934', name: 'Heart Me', diamonds: 1, pictureUrl: '' },
        viewerCount: null
      };
      const fx = hub.handleEvent(e, Date.now());
      return { fanFx: fx.filter(f => f.kind === 'fanJoin').length, msg: 'phải là 0 (đã chào rồi)' };
    }`,
    returnByValue: true,
  });
  console.log('[patch-fan] 🧪 Test dedup:', JSON.stringify(test2R.value));

  // ── Dọn test user khỏi fanGreeted ──
  await sendCmd('Runtime.callFunctionOn', {
    objectId: hubRef.objectId,
    functionDeclaration: `function() { this.__fanGreeted.delete('__test_fan__'); return 'cleaned'; }`,
    returnByValue: true,
  });

  ws.close();
  console.log('\n[patch-fan] ✅ Hotpatch FAN CLB hoàn tất — không restart server!');
}

main().catch((err) => {
  console.error('[patch-fan] ❌', err.message);
  process.exit(1);
});
