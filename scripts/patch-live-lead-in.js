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

  const protoRes = await sendCmd('Runtime.evaluate', { expression: 'Object.prototype' });
  const protoId = protoRes.result.objectId;
  const queryRes = await sendCmd('Runtime.queryObjects', { prototypeObjectId: protoId });
  const objectsId = queryRes.objects.objectId;

  const patchRes = await sendCmd('Runtime.callFunctionOn', {
    objectId: objectsId,
    functionDeclaration: `function() {
      const QUIZ_GAMES = new Set(['lophoc', 'dovui', 'english', 'emoji', 'flag', 'math', 'wordle']);
      const patched = [];

      function estimateSpeechLeadIn(speechText) {
        if (!speechText || typeof speechText !== 'string') return 2000;
        const words = speechText.trim().split(/\\s+/).filter(Boolean);
        const wordCount = words.length;
        if (!wordCount) return 2000;
        const commas = (speechText.match(/[,、，]/g) || []).length;
        const periods = (speechText.match(/[.!?。！？]/g) || []).length;
        const estimatedMs = Math.round(wordCount * 230 + commas * 200 + periods * 300 + 500);
        return Math.max(2000, estimatedMs);
      }

      function calcRevealDuration(fxItem) {
        if (!fxItem) return 7000;
        const enMs = fxItem.answerEn ? (fxItem.answerEnSlow ? 3500 : 1800) : 0;
        const viMs = fxItem.speech ? estimateSpeechLeadIn(fxItem.speech) : 0;
        return Math.max(7000, enMs + viMs + 800);
      }

      function wrapGame(game) {
        // Lấy hàm gốc (nếu đã bị wrap trước đó thì unwrap để lấy hàm sạch)
        let oldTick = game.__origTick || game.tick;
        let oldSnapshot = game.__origSnapshot || game.snapshot;
        let oldHandleEvent = game.__origHandleEvent || game.handleEvent;
        let oldCommand = game.__origCommand || game.command;

        game.__origTick = oldTick;
        game.__origSnapshot = oldSnapshot;
        game.__origHandleEvent = oldHandleEvent;
        game.__origCommand = oldCommand;

        let activeQuestion = null;
        let activeReveal = null;

        function inspectFx(fx, now) {
          if (!Array.isArray(fx)) return;
          for (const item of fx) {
            if (item && item.kind === 'quizQuestion') {
              const speech = item.speech || '';
              const leadIn = item.lightning ? 1500 : (item.listen ? 2000 : estimateSpeechLeadIn(speech));
              activeQuestion = {
                t0: now,
                speech,
                leadIn,
                totalMs: item.lightning ? 8000 : 20000,
                firstCorrectAt: 0
              };
              activeReveal = null;
            } else if (item && item.kind === 'quizReveal') {
              const durationMs = calcRevealDuration(item);
              activeReveal = {
                t0: now,
                durationMs
              };
              activeQuestion = null;
            }
          }
        }

        game.tick = function(now = Date.now(), ...args) {
          let tickNow = now;

          if (activeQuestion) {
            const { t0, leadIn, totalMs } = activeQuestion;
            const questionEnd = t0 + leadIn + totalMs;

            if (now < t0 + leadIn) {
              // Trong thời gian đọc đề: giữ inner game ở t0 + 500
              tickNow = t0 + 500;
            } else if (now < questionEnd) {
              // Pha đếm ngược: tiến độ từ 0.0 đến 1.0 của countdown
              const progress = (now - (t0 + leadIn)) / totalMs;
              const innerProgressTime = (t0 + 2000) + progress * totalMs;

              // CHỐNG CẮT NGANG KHI MỚI 1-2 NGƯỜI ĐÚNG:
              // Không bao giờ để tickNow - firstCorrectAt >= 5000 khi chưa hết giờ
              if (activeQuestion.firstCorrectAt > 0) {
                tickNow = Math.min(activeQuestion.firstCorrectAt + 4000, innerProgressTime);
              } else {
                tickNow = innerProgressTime;
              }
            } else {
              // Đã hết giờ 20s: cho tickNow vượt qua phaseEnd để lật đáp án tự nhiên
              tickNow = (t0 + 2000) + totalMs + 1500;
            }
          } else if (activeReveal) {
            const { t0, durationMs } = activeReveal;
            if (now < t0 + durationMs) {
              // Đang đọc kết quả (tiếng Anh + chúc mừng): KHÔNG cho kết thúc sớm
              tickNow = t0 + 1000;
            } else {
              // Đã đọc xong trọn vẹn: cho phép bắt đầu câu mới
              tickNow = t0 + 15000;
            }
          }

          const fx = oldTick.call(this, tickNow, ...args);
          inspectFx(fx, now);
          return fx;
        };

        game.snapshot = function(now = Date.now()) {
          let snapNow = now;
          if (activeQuestion) {
            const { t0, leadIn, totalMs } = activeQuestion;
            const progress = Math.max(0, Math.min(1, (now - (t0 + leadIn)) / totalMs));
            snapNow = (t0 + 2000) + progress * totalMs;
          } else if (activeReveal) {
            snapNow = activeReveal.t0 + 1000;
          }

          const snap = oldSnapshot.call(this, snapNow);
          if (activeQuestion && snap.phase === 'question') {
            const isLeadIn = now < activeQuestion.t0 + activeQuestion.leadIn;
            snap.leadIn = isLeadIn;
            if (isLeadIn) {
              snap.msLeft = snap.totalMs;
            } else {
              const remaining = Math.max(0, (activeQuestion.t0 + activeQuestion.leadIn + activeQuestion.totalMs) - now);
              snap.msLeft = Math.round(remaining / 100) * 100;
            }
          }
          return snap;
        };

        game.handleEvent = function(event, now = Date.now()) {
          let hNow = now;
          if (activeQuestion) {
            const { t0, leadIn, totalMs } = activeQuestion;
            if (now < t0 + leadIn) {
              hNow = t0 + 500;
            } else {
              const progress = Math.min(1, (now - (t0 + leadIn)) / totalMs);
              hNow = (t0 + 2000) + progress * totalMs;
            }
          }

          const fx = oldHandleEvent.call(this, event, hNow);
          inspectFx(fx, now);

          if (activeQuestion && !activeQuestion.firstCorrectAt) {
            const snap = oldSnapshot.call(this, hNow);
            if (snap.winners && snap.winners.length > 0) {
              activeQuestion.firstCorrectAt = hNow;
            }
          }
          return fx;
        };

        game.command = function(name, now = Date.now()) {
          const fx = oldCommand.call(this, name, now);
          inspectFx(fx, now);
          return fx;
        };

        game.__speechLeadInWrapped = 'v2-no-cutoffs';
        return true;
      }

      for (const obj of this) {
        if (obj && QUIZ_GAMES.has(obj.id) && typeof obj.snapshot === 'function' && typeof obj.tick === 'function') {
          wrapGame(obj);
          patched.push(obj.id + ' (v2 hotfixed)');
        }
      }

      return { ok: true, patched };
    }`,
    returnByValue: true
  });

  console.log('Patch result:', JSON.stringify(patchRes.result.value, null, 2));
  ws.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
