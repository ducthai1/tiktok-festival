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

  const probeRes = await sendCmd('Runtime.callFunctionOn', {
    objectId: objectsId,
    functionDeclaration: `function() {
      let foundSwitcher = null;
      let foundGame = null;
      for (const obj of this) {
        if (obj && typeof obj.setRules === 'function' && typeof obj.resetRoom === 'function' && obj.deck) {
          foundSwitcher = obj;
        }
        if (obj && obj.id === 'english' && typeof obj.setEnglishRules === 'function') {
          foundGame = obj;
        }
      }
      return {
        hasSwitcher: !!foundSwitcher,
        switcherSnap: foundSwitcher ? foundSwitcher.snapshot() : null,
        hasGame: !!foundGame,
        gameSnap: foundGame ? foundGame.snapshot() : null
      };
    }`,
    returnByValue: true
  });

  console.log('Probe:', JSON.stringify(probeRes.result.value, null, 2));
  ws.close();
}

main().catch(console.error);
