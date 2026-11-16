import http from 'node:http';
import WebSocket from '../node_modules/ws/index.js';
import { ENGLISH_TARGETS, defaultQuestionsFor } from '../public/shared/english-sets.js';

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

  const protoRes = await sendCmd('Runtime.evaluate', { expression: 'Object.prototype' });
  const protoId = protoRes.result.objectId;
  const queryRes = await sendCmd('Runtime.queryObjects', { prototypeObjectId: protoId });
  const objectsId = queryRes.objects.objectId;

  const patchRes = await sendCmd('Runtime.callFunctionOn', {
    objectId: objectsId,
    functionDeclaration: `function() {
      let sw = null;
      for (const obj of this) {
        if (obj && typeof obj.setRules === 'function' && typeof obj.resetRoom === 'function' && obj.deck) {
          sw = obj;
          break;
        }
      }
      if (!sw) return { ok: false, error: 'Không tìm thấy switcher' };

      const snap = sw.snapshot();

      // Nếu đang có pending (ví dụ Du lịch của SunShine đang bị chờ):
      let resolvedPending = null;
      if (snap.pending) {
        resolvedPending = snap.pending;
        sw.restore({
          set: snap.pending.to,
          setLeft: snap.pending.count || 20,
          setBy: snap.pending.user,
          level: snap.level,
          levelLeft: snap.levelLeft,
          levelBy: snap.levelBy,
          pending: null
        });
      }

      if (sw.__instantSwitchPatched) {
        return { ok: true, alreadyPatched: true, resolvedPending };
      }

      const oldOnGift = sw.onGift;
      const oldCommand = sw.command;

      sw.onGift = function(event) {
        const fxList = oldOnGift.call(this, event);
        if (!Array.isArray(fxList)) return fxList;

        const curSnap = sw.snapshot();
        // Nếu có pending vừa được tạo do logic cũ trả 'later'
        if (curSnap.pending) {
          const p = curSnap.pending;
          sw.restore({
            set: p.to,
            setLeft: p.count || 20,
            setBy: p.user,
            level: curSnap.level,
            levelLeft: curSnap.levelLeft,
            levelBy: curSnap.levelBy,
            pending: null
          });
        }

        // Bỏ switchNow: true, chuyển thành switchNow: false để đợi hết câu hiện tại
        // và bỏ after (không còn chờ N câu nghe nữa)
        return fxList.map(fx => {
          if (fx.kind === 'quizDeck') {
            const copy = { ...fx, switchNow: false };
            delete copy.after;
            return copy;
          }
          return fx;
        });
      };

      sw.command = function(name) {
        const fxList = oldCommand.call(this, name);
        if (!Array.isArray(fxList)) return fxList;
        return fxList.map(fx => {
          if (fx.kind === 'toast' || fx.switchNow) {
            return { ...fx, switchNow: false };
          }
          return fx;
        });
      };

      sw.__instantSwitchPatched = true;

      return {
        ok: true,
        resolvedPending,
        newSnap: sw.snapshot()
      };
    }`,
    returnByValue: true
  });

  console.log('Patch result:', JSON.stringify(patchRes.result.value, null, 2));
  ws.close();
}

main().catch(console.error);
