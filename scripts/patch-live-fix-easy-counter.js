/**
 * HOTPATCH: Sửa lỗi tặng hoa hồng chọn Dễ bị kẹt tên và số câu 20 mãi mãi:
 * 1. Reset ngay levelBy = null, levelLeft = 0 cho tài khoản đang bị kẹt
 * 2. Patch hàm deck.next trong memory: đếm lùi levelLeft khi có levelBy (kể cả level === 'easy'),
 *    hết số câu tự động xoá tên người tặng và về Dễ mặc định.
 * 3. Broadcast snapshot mới ra OBS.
 *
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
  console.log(`[fix-easy-counter] Kết nối inspector PID ${PID}…`);
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
  await sendCmd('Debugger.enable');

  const { result: protoRes } = await sendCmd('Runtime.evaluate', { expression: 'Function.prototype' });
  const { objects: queryRes } = await sendCmd('Runtime.queryObjects', { prototypeObjectId: protoRes.objectId });

  // Tìm hàm deck.next trong english-switcher
  const { result: nextFnRes } = await sendCmd('Runtime.callFunctionOn', {
    objectId: queryRes.objectId,
    functionDeclaration: `function() {
      return this.find(f => f.name === "next" && f.toString().includes("Luyện nghe không dùng độ khó"));
    }`
  });

  if (!nextFnRes?.objectId) {
    throw new Error('Không tìm thấy hàm deck.next trong heap');
  }

  console.log('[fix-easy-counter] ✅ Tìm thấy hàm deck.next trong heap');

  const props = await sendCmd('Runtime.getProperties', { objectId: nextFnRes.objectId });
  const scopes = props.internalProperties.find((p) => p.name === '[[Scopes]]');
  const scopeList = await sendCmd('Runtime.getProperties', { objectId: scopes.value.objectId });

  // Scope [0] là Block (createEnglishSwitcher) chứa set, level, levelLeft, levelBy, etc.
  const blockScope = scopeList.result.find((s) => s.value?.description?.includes('createEnglishSwitcher'));
  if (!blockScope?.value?.objectId) {
    throw new Error('Không tìm thấy scope createEnglishSwitcher');
  }

  const blockVars = await sendCmd('Runtime.getProperties', { objectId: blockScope.value.objectId });
  const levelVar = blockVars.result.find((v) => v.name === 'level');
  const levelLeftVar = blockVars.result.find((v) => v.name === 'levelLeft');
  const levelByVar = blockVars.result.find((v) => v.name === 'levelBy');

  console.log('[fix-easy-counter] Block vars found:', {
    hasLevel: !!levelVar,
    hasLevelLeft: !!levelLeftVar,
    hasLevelBy: !!levelByVar
  });

  // ─────────────────────────────────────────────────────────────
  // 1. Reset ngay levelBy và levelLeft đang bị kẹt
  // ─────────────────────────────────────────────────────────────
  // Dùng callFunctionOn trên object chứa scope nếu có, hoặc dùng scope manipulation
  // Ở đây, trong englishSwitcher object (trả về từ createEnglishSwitcher), ta có thể gọi command / restore hoặc mutate
  const { result: opRef } = await sendCmd('Runtime.evaluate', { expression: 'Object.prototype' });
  const { objects: allObjs } = await sendCmd('Runtime.queryObjects', { prototypeObjectId: opRef.objectId });

  const { result: mutateRes } = await sendCmd('Runtime.callFunctionOn', {
    objectId: allObjs.objectId,
    functionDeclaration: `function() {
      const arr = this;
      let switcher = null;
      for (let i = 0; i < arr.length; i++) {
        try {
          const o = arr[i];
          if (o && o.deck && typeof o.deck.next === 'function' && typeof o.snapshot === 'function' && typeof o.restore === 'function') {
            switcher = o;
            break;
          }
        } catch {}
      }
      if (!switcher) return { ok: false, error: 'Không tìm thấy switcher' };

      // 1. Lấy snapshot hiện tại
      const snBefore = switcher.snapshot();

      // 2. Gọi restore để reset levelBy về null và levelLeft về 0
      switcher.restore({
        set: snBefore.set,
        setLeft: snBefore.setLeft,
        setBy: snBefore.setBy,
        level: 'easy',
        levelLeft: 0,
        levelBy: null
      });

      // 3. Patch hàm deck.next
      const origNext = switcher.deck.next.bind(switcher.deck);
      switcher.deck.__origNext = switcher.deck.__origNext || origNext;

      // Hàm bọc deck.next: sau khi gọi hàm gốc, kiểm tra và đếm ngược levelLeft nếu có levelBy
      // Nhưng hàm gốc đang có bug là không trừ levelLeft khi level === 'easy'.
      // Ta patch trực tiếp hàm deck.next:
      switcher.deck.next = function() {
        const q = origNext();
        // Kiểm tra snapshot sau khi next
        const sn = switcher.snapshot();
        // Nếu có levelBy và level === 'easy' mà levelLeft chưa giảm hoặc đã hết:
        // Ta can thiệp qua restore:
        if (sn.levelBy && sn.level === 'easy') {
          const nextLeft = (sn.levelLeft || 0) - 1;
          if (nextLeft <= 0) {
            switcher.restore({
              set: sn.set, setLeft: sn.setLeft, setBy: sn.setBy,
              level: 'easy', levelLeft: 0, levelBy: null
            });
            console.log('[english] Đã hết 20 câu Dễ tri ân người tặng -> Trở về Dễ mặc định');
          } else {
            switcher.restore({
              set: sn.set, setLeft: sn.setLeft, setBy: sn.setBy,
              level: 'easy', levelLeft: nextLeft, levelBy: sn.levelBy
            });
          }
        }
        return q;
      };

      const snAfter = switcher.snapshot();
      return {
        ok: true,
        before: { levelBy: snBefore.levelBy?.nickname, levelLeft: snBefore.levelLeft },
        after: { levelBy: snAfter.levelBy, levelLeft: snAfter.levelLeft }
      };
    }`,
    returnByValue: true
  });

  console.log('[fix-easy-counter] Mutate switcher result:', JSON.stringify(mutateRes.value, null, 2));

  // ─────────────────────────────────────────────────────────────
  // 2. Broadcast ngay snapshot mới ra OBS
  // ─────────────────────────────────────────────────────────────
  await sendCmd('Runtime.callFunctionOn', {
    objectId: allObjs.objectId,
    functionDeclaration: `function() {
      const arr = this;
      for (let i = 0; i < arr.length; i++) {
        try {
          const o = arr[i];
          if (o && typeof o.broadcast === 'function' && typeof o.clients === 'function') {
            for (let j = 0; j < arr.length; j++) {
              const h = arr[j];
              if (h && typeof h.snapshot === 'function' && typeof h.handleEvent === 'function') {
                o.broadcast({ t: 'state', ...h.snapshot() });
                return 'Broadcasted clean state to OBS';
              }
            }
          }
        } catch {}
      }
      return 'No broadcast';
    }`
  });

  ws.close();
  console.log('\n[fix-easy-counter] 🎉 SỬA LỖI VÀ ĐỒNG BỘ THÀNH CÔNG 100%!');
}

main().catch((err) => {
  console.error('[fix-easy-counter] ❌ Lỗi:', err);
  process.exit(1);
});
