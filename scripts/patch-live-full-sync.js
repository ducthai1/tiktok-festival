/**
 * HOTPATCH TOÀN DIỆN CHO LIVE SERVER ĐANG CHẠY:
 * 1. Khai thác dữ liệu Fan CLB trực tiếp từ TikTokLiveConnection
 * 2. Phục hồi fanClub & fanLevel trong gameHub.handleEvent
 * 3. Hỗ trợ thẻ chào Fan CLB trong welcomeQueue (đơn + nhóm)
 * 4. Phát màn bùng nổ chúc mừng fanJoin khi tặng Heart Me
 * 5. Kích hoạt safeReload: OBS chỉ reload KHI HẾT CÂU HỎI HIỆN TẠI (phase reveal/idle),
 *    không làm ngắt tiến trình câu hỏi, không reset live, không mất streak!
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
  console.log(`[hotpatch-sync] Đang kết nối inspector PID ${PID}…`);
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

  const { result: opRef } = await sendCmd('Runtime.evaluate', {
    expression: 'Object.prototype',
    returnByValue: false,
  });
  const { objects: allObjs } = await sendCmd('Runtime.queryObjects', {
    prototypeObjectId: opRef.objectId,
  });

  // ─────────────────────────────────────────────────────────────
  // BƯỚC 1: Khởi tạo __fanCache trên globalThis
  // ─────────────────────────────────────────────────────────────
  await sendCmd('Runtime.evaluate', {
    expression: `
      globalThis.__fanCache = globalThis.__fanCache || new Map();
      if (!globalThis.__fanCacheCleanTimer) {
        globalThis.__fanCacheCleanTimer = setInterval(() => {
          if (globalThis.__fanCache.size > 10000) {
            const now = Date.now();
            for (const [k, v] of globalThis.__fanCache.entries()) {
              if (now - v.at > 2 * 3600000) globalThis.__fanCache.delete(k);
            }
          }
        }, 300000);
      }
      'fanCache ready';
    `
  });
  console.log('[hotpatch-sync] ✅ Đã khởi tạo __fanCache trên server');

  // ─────────────────────────────────────────────────────────────
  // BƯỚC 2: Patch TikTokLiveConnection listeners để bắt thông tin Fan
  // ─────────────────────────────────────────────────────────────
  const { result: patchConnRes } = await sendCmd('Runtime.callFunctionOn', {
    objectId: allObjs.objectId,
    functionDeclaration: `function() {
      const arr = this;
      let conn = null;
      for (let i = 0; i < arr.length; i++) {
        try {
          const o = arr[i];
          if (o && o.constructor && o.constructor.name === 'TikTokLiveConnection') {
            conn = o;
            break;
          }
        } catch {}
      }
      if (!conn) return { ok: false, error: 'Không tìm thấy TikTokLiveConnection' };

      if (conn.__fanListenerPatched) {
        return { ok: true, already: true, msg: 'TikTokLiveConnection listeners đã được patch trước đó' };
      }

      function extractFan(data) {
        if (!data) return;
        const user = data.user || data;
        const uid = String(user.id || user.userId || user.uniqueId || '');
        if (!uid) return;

        const fanLevel = Number(
          user.fanClubLevel ??
          data.fanClubLevel ??
          user.fansClub?.data?.level ??
          user.fansClub?.level ??
          user.fansClubInfo?.fansLevel ??
          user.fansClubInfo?.level ??
          0
        );
        const fanClubStatus = Number(
          user.fansClub?.data?.userFansClubStatus ??
          user.fansClub?.userFansClubStatus ??
          user.fansClub?.status ??
          user.fansClubStatus ??
          0
        );
        const fanClub = Boolean(
          user.isSubscribed ||
          user.isSubscriber ||
          data.isSubscribed ||
          data.isSubscriber ||
          fanClubStatus === 1 ||
          fanLevel > 0
        );

        if (fanClub || fanLevel > 0) {
          globalThis.__fanCache.set(uid, { fanClub, fanLevel, at: Date.now() });
          const uniq = String(user.uniqueId || data.uniqueId || '');
          if (uniq) globalThis.__fanCache.set(uniq, { fanClub, fanLevel, at: Date.now() });
        }
      }

      const eventsToWrap = ['chat', 'gift', 'like', 'member', 'follow', 'share'];
      for (const ev of eventsToWrap) {
        const origListeners = conn.listeners(ev);
        conn.removeAllListeners(ev);
        conn.on(ev, function(data) {
          try { extractFan(data); } catch {}
          for (const fn of origListeners) {
            try { fn.call(this, data); } catch(err) { console.error('[conn error]', err); }
          }
        });
      }

      conn.__fanListenerPatched = true;
      return { ok: true, msg: 'Đã bọc listeners bắt thông tin fan' };
    }`,
    returnByValue: true
  });
  console.log('[hotpatch-sync] TikTokLiveConnection patch:', JSON.stringify(patchConnRes.value));

  // ─────────────────────────────────────────────────────────────
  // BƯỚC 3: Patch gameHub (phục hồi fan data + mừng Heart Me)
  // ─────────────────────────────────────────────────────────────
  const { result: patchHubRes } = await sendCmd('Runtime.callFunctionOn', {
    objectId: allObjs.objectId,
    functionDeclaration: `function() {
      const arr = this;
      let hub = null;
      for (let i = 0; i < arr.length; i++) {
        try {
          const o = arr[i];
          if (o && typeof o.handleEvent === 'function' && typeof o.tick === 'function' && typeof o.switchTo === 'function') {
            hub = o;
            break;
          }
        } catch {}
      }
      if (!hub) return { ok: false, error: 'Không tìm thấy gameHub' };

      const origHandleEvent = hub.__origHandleEvent || hub.handleEvent.bind(hub);
      hub.__origHandleEvent = origHandleEvent;

      const FANCLUB_GIFT_IDS = new Set(['7934']);
      const FANCLUB_GIFT_NAMES = new Set(['heart me']);
      const fanGreeted = hub.__fanGreeted || new Set();
      hub.__fanGreeted = fanGreeted;

      function fanClubJoin(event) {
        if (event.type !== 'gift' || !event.user?.id) return [];
        const name = String(event.gift?.name || '').trim().toLowerCase();
        const idOk = FANCLUB_GIFT_IDS.has(String(event.gift?.id || ''));
        const nameOk = FANCLUB_GIFT_NAMES.has(name);
        if (!idOk && !nameOk) return [];
        if (fanGreeted.has(event.user.id)) return [];
        fanGreeted.add(event.user.id);
        const level = Number(event.user.fanLevel) || 1;
        if (!event.simulated) console.log('[app] 💞 ' + event.user.nickname + ' vào CLB (cấp ' + level + ')');
        return [{
          kind: 'fanJoin',
          userId: event.user.id,
          nickname: event.user.nickname,
          avatar: event.user.avatar,
          level,
          gift: event.gift.name,
          image: event.gift.pictureUrl || ''
        }];
      }

      hub.handleEvent = function handleEvent(event, now = Date.now()) {
        // Phục hồi fan info từ cache trước khi đưa vào game / welcome
        if (event && event.user && event.user.id) {
          const cached = globalThis.__fanCache?.get(String(event.user.id))
            || globalThis.__fanCache?.get(String(event.user.uniqueId || ''));
          if (cached) {
            event.user.fanClub = cached.fanClub;
            event.user.fanLevel = Math.max(Number(event.user.fanLevel) || 0, cached.fanLevel);
          }
        }

        const result = origHandleEvent(event, now);
        const fanFx = fanClubJoin(event);
        if (!fanFx.length) return result;

        const idx = result.findIndex(fx => fx.kind === 'welcome');
        if (idx >= 0) result.splice(idx, 0, ...fanFx);
        else result.push(...fanFx);
        return result;
      };

      return { ok: true, msg: 'gameHub.handleEvent đã được nâng cấp đầy đủ' };
    }`,
    returnByValue: true
  });
  console.log('[hotpatch-sync] gameHub patch:', JSON.stringify(patchHubRes.value));

  // ─────────────────────────────────────────────────────────────
  // BƯỚC 4: Patch welcomeQueue (giữ cờ Fan trong card đơn & nhóm)
  // ─────────────────────────────────────────────────────────────
  const { result: patchWqRes } = await sendCmd('Runtime.callFunctionOn', {
    objectId: allObjs.objectId,
    functionDeclaration: `function() {
      const arr = this;
      let wq = null;
      for (let i = 0; i < arr.length; i++) {
        try {
          const o = arr[i];
          if (o && typeof o.notice === 'function' && typeof o.setViewerCount === 'function' && typeof o.tick === 'function') {
            wq = o;
            break;
          }
        } catch {}
      }
      if (!wq) return { ok: false, error: 'Không tìm thấy welcomeQueue' };

      if (wq.__fanCardPatched) {
        return { ok: true, already: true, msg: 'welcomeQueue đã được patch trước đó' };
      }

      const origTick = wq.tick.bind(wq);
      wq.__origTick = origTick;

      wq.tick = function tick(now = Date.now()) {
        const cards = origTick(now);
        if (!cards || !cards.length) return cards;

        for (const card of cards) {
          if (card.kind !== 'welcome') continue;
          if (card.mode === 'group' && Array.isArray(card.people)) {
            for (const p of card.people) {
              const cached = globalThis.__fanCache?.get(String(p.userId || p.id));
              if (cached) {
                p.fanClub = cached.fanClub;
                p.fanLevel = Math.max(Number(p.fanLevel) || 0, cached.fanLevel);
              }
            }
          } else if (card.userId) {
            const cached = globalThis.__fanCache?.get(String(card.userId));
            if (cached) {
              card.fanClub = cached.fanClub;
              card.fanLevel = Math.max(Number(card.fanLevel) || 0, cached.fanLevel);
            }
          }
        }
        return cards;
      };

      wq.__fanCardPatched = true;
      return { ok: true, msg: 'welcomeQueue.tick đã được bổ sung fan properties' };
    }`,
    returnByValue: true
  });
  console.log('[hotpatch-sync] welcomeQueue patch:', JSON.stringify(patchWqRes.value));

  // ─────────────────────────────────────────────────────────────
  // BƯỚC 5: Kích hoạt safeReload cho OBS (TỰ ĐỘNG CHỜ HẾT CÂU MỚI RELOAD)
  // ─────────────────────────────────────────────────────────────
  const { result: protoRes } = await sendCmd('Runtime.evaluate', { expression: 'Function.prototype' });
  const { objects: queryRes } = await sendCmd('Runtime.queryObjects', { prototypeObjectId: protoRes.objectId });

  const { result: reloadFnRes } = await sendCmd('Runtime.callFunctionOn', {
    objectId: queryRes.objectId,
    functionDeclaration: `function() {
      return this.find(f => f.name === "reload");
    }`
  });

  if (reloadFnRes?.objectId) {
    const props = await sendCmd('Runtime.getProperties', { objectId: reloadFnRes.objectId });
    const scopes = props.internalProperties.find(p => p.name === '[[Scopes]]');
    const scopeList = await sendCmd('Runtime.getProperties', { objectId: scopes.value.objectId });
    const blockScope = scopeList.result.find(s => s.value?.description?.includes('Block'));
    const blockVars = await sendCmd('Runtime.getProperties', { objectId: blockScope.value.objectId });
    const handlersVar = blockVars.result.find(v => v.name === 'handlers');

    if (handlersVar?.value?.objectId) {
      const { result: triggerRes } = await sendCmd('Runtime.callFunctionOn', {
        objectId: handlersVar.value.objectId,
        functionDeclaration: `function() {
          if (typeof this.safeReload === 'function') {
            return this.safeReload();
          }
          return { error: 'Không có safeReload' };
        }`,
        returnByValue: true
      });
      console.log('[hotpatch-sync] 🔄 safeReload broadcast:', JSON.stringify(triggerRes.value));
    }
  }

  // ─────────────────────────────────────────────────────────────
  // BƯỚC 6: Kiểm tra tiến trình câu hỏi hiện tại để đảm bảo an toàn
  // ─────────────────────────────────────────────────────────────
  const { result: gameStateCheck } = await sendCmd('Runtime.callFunctionOn', {
    objectId: allObjs.objectId,
    functionDeclaration: `function() {
      const arr = this;
      for (let i = 0; i < arr.length; i++) {
        try {
          const o = arr[i];
          if (o && o.id === 'english' && typeof o.getState === 'function') {
            const st = o.getState();
            return {
              game: 'english',
              round: st.round,
              phase: st.phase,
              questionCount: st.totalQuestions || st.questionNumber || st.questionCount || 0,
              questionText: st.question?.text || st.clue || ''
            };
          }
        } catch {}
      }
      return null;
    }`,
    returnByValue: true
  });
  console.log('[hotpatch-sync] 📊 Game state hiện tại:', JSON.stringify(gameStateCheck.value, null, 2));

  ws.close();
  console.log('\n[hotpatch-sync] 🎉 HOÀN TẤT HOTPATCH TOÀN DIỆN!');
}

main().catch((err) => {
  console.error('[hotpatch-sync] ❌ Lỗi:', err.message);
  process.exit(1);
});
