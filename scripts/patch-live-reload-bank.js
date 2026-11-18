/**
 * HOTPATCH: Nạp lại toàn bộ ngân hàng câu hỏi mới nhất từ đĩa vào Live Server:
 * 1. Đọc 8.820+ từ vựng mới từ đĩa (ngắn gọn, không còn 'tiếng Anh là gì', thêm 813 từ mới)
 * 2. Cập nhật trực tiếp vào closure của createEnglishSwitcher trong RAM
 * 3. Làm sạch ngay câu hỏi hiện tại đang hiển thị nếu có đuôi 'tiếng Anh là gì'
 * 4. Không ngắt live, không đổi thứ tự câu (qNumber), giữ nguyên điểm số & streak!
 *
 * PID: 2156548
 */
import http from 'node:http';
import WebSocket from '../node_modules/ws/index.js';
import { loadEnglishQuestions, loadEnglishSets } from '../src/games/quiz/quiz-bank.js';
import { foldText, isCleanForDisplay } from '../src/games/text-match.js';

const PID = 2156548;

function allWords(english, sets) {
  const seen = new Set();
  return [...english.filter((q) => !q.basic), ...Object.values(sets).flat()].filter((q) => {
    const key = foldText(q.answer);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function listenPool(english, sets) {
  const seen = new Set();
  return [...english, ...Object.values(sets).flat()].filter((q) => {
    const key = foldText(q.answer).replace(/ /g, '');
    if (!key || seen.has(key) || q.answer.length > 60 || !/^[A-Za-z0-9][A-Za-z0-9 '&.-]*$/.test(q.answer) || !isCleanForDisplay(q.answer)) return false;
    seen.add(key);
    return true;
  });
}

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
  console.log('[reload-bank] 1. Đang nạp dữ liệu ngân hàng câu hỏi mới từ đĩa…');
  const eng = loadEnglishQuestions();
  const sets = loadEnglishSets();
  const basic = eng.filter((q) => q.basic);
  const general = allWords(eng, sets);
  const listen = listenPool(eng, sets);

  console.log(`[reload-bank]    - Tổng hợp: ${general.length} từ`);
  console.log(`[reload-bank]    - Cơ bản: ${basic.length} từ`);
  console.log(`[reload-bank]    - Luyện nghe: ${listen.length} từ`);
  console.log(`[reload-bank]    - Bộ đề quà: ${Object.keys(sets).length} bộ`);

  console.log(`[reload-bank] 2. Kết nối inspector PID ${PID}…`);
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

  // Tìm hàm pick trong english-switcher
  const { result: pickFnRes } = await sendCmd('Runtime.callFunctionOn', {
    objectId: queryRes.objectId,
    functionDeclaration: `function() {
      return this.find(f => f.name === "pick" && f.toString().includes("tiers()"));
    }`
  });

  if (!pickFnRes?.objectId) {
    throw new Error('Không tìm thấy hàm pick trong heap');
  }

  const props = await sendCmd('Runtime.getProperties', { objectId: pickFnRes.objectId });
  const scopes = props.internalProperties.find((p) => p.name === '[[Scopes]]');
  const scopeList = await sendCmd('Runtime.getProperties', { objectId: scopes.value.objectId });

  let targetScopeObjectId = null;
  let targetVars = null;

  for (let i = 0; i < scopeList.result.length; i++) {
    const s = scopeList.result[i];
    if (s.value?.objectId) {
      const vars = await sendCmd('Runtime.getProperties', { objectId: s.value.objectId });
      const hasGeneral = vars.result.some((v) => v.name === 'general');
      const hasSets = vars.result.some((v) => v.name === 'sets');
      if (hasGeneral && hasSets) {
        targetScopeObjectId = s.value.objectId;
        targetVars = vars.result;
        console.log(`[reload-bank]    Tìm thấy scope chứa general & sets tại Scope [${i}] (${s.value.description})`);
        break;
      }
    }
  }

  if (!targetVars) {
    throw new Error('Không tìm thấy scope chứa general và sets');
  }

  const generalVar = targetVars.find((v) => v.name === 'general');
  const basicVar = targetVars.find((v) => v.name === 'basic');
  const setsVar = targetVars.find((v) => v.name === 'sets');
  const listenVar = targetVars.find((v) => v.name === 'listen');

  console.log('[reload-bank] 3. Đang bơm ngân hàng câu hỏi mới vào RAM của game…');

  // Ghi đè trực tiếp nội dung các mảng/object trong memory
  // 1. Cập nhật general
  await sendCmd('Runtime.callFunctionOn', {
    objectId: generalVar.value.objectId,
    arguments: [{ value: general }],
    functionDeclaration: `function(newGeneral) {
      this.splice(0, this.length, ...newGeneral);
      return this.length;
    }`
  });
  console.log(`[reload-bank]    ✅ Đã cập nhật ${general.length} câu Tổng hợp vào RAM`);

  // 2. Cập nhật basic
  if (basicVar?.value?.objectId) {
    await sendCmd('Runtime.callFunctionOn', {
      objectId: basicVar.value.objectId,
      arguments: [{ value: basic }],
      functionDeclaration: `function(newBasic) {
        this.splice(0, this.length, ...newBasic);
        return this.length;
      }`
    });
    console.log(`[reload-bank]    ✅ Đã cập nhật ${basic.length} câu Cơ bản vào RAM`);
  }

  // 3. Cập nhật listen
  if (listenVar?.value?.objectId) {
    await sendCmd('Runtime.callFunctionOn', {
      objectId: listenVar.value.objectId,
      arguments: [{ value: listen }],
      functionDeclaration: `function(newListen) {
        this.splice(0, this.length, ...newListen);
        return this.length;
      }`
    });
    console.log(`[reload-bank]    ✅ Đã cập nhật ${listen.length} câu Luyện nghe vào RAM`);
  }

  // 4. Cập nhật sets (16 bộ đề)
  await sendCmd('Runtime.callFunctionOn', {
    objectId: setsVar.value.objectId,
    arguments: [{ value: sets }],
    functionDeclaration: `function(newSets) {
      for (const k of Object.keys(newSets)) {
        this[k] = newSets[k];
      }
      return Object.keys(this).length;
    }`
  });
  console.log(`[reload-bank]    ✅ Đã cập nhật ${Object.keys(sets).length} bộ đề quà vào RAM`);

  // ─────────────────────────────────────────────────────────────
  // 4. LÀM SẠCH NGAY CÂU HỎI ĐANG HIỂN THỊ TRÊN MÀN HÌNH (NẾU CÓ ĐUÔI)
  // ─────────────────────────────────────────────────────────────
  console.log('[reload-bank] 4. Kiểm tra và làm sạch câu hỏi đang hiển thị trên live…');
  const { result: cleanCurQRes } = await sendCmd('Runtime.callFunctionOn', {
    objectId: queryRes.objectId,
    functionDeclaration: `function() {
      const fns = this;
      for (let i = 0; i < fns.length; i++) {
        try {
          const f = fns[i];
          if (typeof f !== 'function') continue;
          if (f.name === 'startQuestion' && f.toString().includes('slots.length')) {
            return f;
          }
        } catch {}
      }
      return null;
    }`,
    returnByValue: false
  });

  if (cleanCurQRes?.objectId) {
    const sqProps = await sendCmd('Runtime.getProperties', { objectId: cleanCurQRes.objectId });
    const sqScopes = sqProps.internalProperties.find((p) => p.name === '[[Scopes]]');
    const sqScopeList = await sendCmd('Runtime.getProperties', { objectId: sqScopes.value.objectId });
    const gameClosure = sqScopeList.result.find((s) => s.value?.description?.includes('createQuizGame'));

    if (gameClosure?.value?.objectId) {
      const gameVars = await sendCmd('Runtime.getProperties', { objectId: gameClosure.value.objectId });
      const qVar = gameVars.result.find((v) => v.name === 'q');

      if (qVar?.value?.objectId) {
        const { result: cleanResult } = await sendCmd('Runtime.callFunctionOn', {
          objectId: qVar.value.objectId,
          functionDeclaration: `function() {
            if (this.prompt) {
              const old = this.prompt;
              this.prompt = this.prompt.replace(/\\s*(trong\\s+)?tiếng Anh\\s+(là gì|gọi là gì|nói thế nào)\\s*\\??\\s*$/i, '').trim();
              return { before: old, after: this.prompt, changed: old !== this.prompt };
            }
            return { changed: false };
          }`,
          returnByValue: true
        });
        console.log('[reload-bank]    Câu hiện tại:', JSON.stringify(cleanResult.value));
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 5. Broadcast state mới nhất ra OBS để màn hình cập nhật ngay
  // ─────────────────────────────────────────────────────────────
  const { result: opRef2 } = await sendCmd('Runtime.evaluate', { expression: 'Object.prototype' });
  const { objects: allObjs } = await sendCmd('Runtime.queryObjects', { prototypeObjectId: opRef2.objectId });

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
                return 'Broadcasted updated state to OBS';
              }
            }
          }
        } catch {}
      }
      return 'No broadcast';
    }`
  });

  ws.close();
  console.log('\n[reload-bank] 🎉 NẠP NGÂN HÀNG CÂU HỎI MỚI THÀNH CÔNG 100%!');
}

main().catch((err) => {
  console.error('[reload-bank] ❌ Lỗi:', err);
  process.exit(1);
});
