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
      let patchedGames = [];
      const QUIZ_GAMES = new Set(['lophoc', 'dovui', 'english', 'emoji', 'flag', 'math', 'wordle']);

      for (const obj of this) {
        if (obj && QUIZ_GAMES.has(obj.id) && typeof obj.snapshot === 'function' && typeof obj.handleEvent === 'function') {
          if (obj.__top6BoardPatched) {
            patchedGames.push(obj.id + ' (already)');
            continue;
          }

          const oldSnapshot = obj.snapshot;
          obj.snapshot = function(now = Date.now()) {
            const state = oldSnapshot.call(this, now);
            if (state && Array.isArray(state.allScores) && state.allScores.length > 0) {
              const knownFollowers = new Set();
              for (const list of [state.board, state.players, state.ambassadors, state.donators, state.winners]) {
                for (const item of list || []) {
                  if (item && item.follower && item.id) knownFollowers.add(item.id);
                }
              }

              // Sắp xếp theo điểm giảm dần, sau đó theo số câu đúng giảm dần (giống quiz-game.js)
              const top6 = [...state.allScores]
                .sort((a, b) => b.points - a.points || (b.correct || 0) - (a.correct || 0))
                .slice(0, 6)
                .map((r) => ({
                  id: r.id,
                  nickname: r.nickname,
                  avatar: r.avatar,
                  points: r.points,
                  bolts: r.bolts || 0,
                  follower: knownFollowers.has(r.id)
                }));

              state.board = top6;
            }
            return state;
          };

          obj.__top6BoardPatched = true;
          patchedGames.push(obj.id);
        }
      }

      // Kiểm tra game english hiện tại
      let englishGame = null;
      for (const obj of this) {
        if (obj && obj.id === 'english' && typeof obj.snapshot === 'function') {
          englishGame = obj;
          break;
        }
      }

      const snap = englishGame ? englishGame.snapshot() : null;

      return {
        ok: true,
        patchedGames,
        boardLength: snap?.board?.length,
        boardNames: snap?.board?.map(r => r.nickname + ' (' + r.points + 'đ)')
      };
    }`,
    returnByValue: true
  });

  console.log('Patch result:', JSON.stringify(patchRes.result.value, null, 2));
  ws.close();
}

main().catch(console.error);
