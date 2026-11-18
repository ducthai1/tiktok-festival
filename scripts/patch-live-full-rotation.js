/**
 * HOTPATCH: Kích hoạt hoàn chỉnh tính năng Tự Luân Chuyển Giá Quà (20 phút/vòng):
 * 1. Inject đầy đủ trường rotate trong handlers.englishGifts, setGiftRotate, rotateNow
 * 2. Cài đặt thuật toán rotateGifts, normalizeRules, giftOptions vào runtime
 * 3. Cài đặt hàm runGiftRotation() và background timer 20 phút chạy ngầm
 * 4. Sửa dứt điểm lỗi nút bấm bật/tắt bị tự động nhảy về tắt trên Admin UI!
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
  console.log(`[patch-rotation] Kết nối inspector PID ${PID}…`);
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

  // Tìm hàm reload trong handlers
  const { result: reloadFnRes } = await sendCmd('Runtime.callFunctionOn', {
    objectId: queryRes.objectId,
    functionDeclaration: `function() {
      return this.find(f => f.name === "reload");
    }`
  });

  if (!reloadFnRes?.objectId) {
    throw new Error('Không tìm thấy hàm reload');
  }

  const props = await sendCmd('Runtime.getProperties', { objectId: reloadFnRes.objectId });
  const scopes = props.internalProperties.find((p) => p.name === '[[Scopes]]');
  const scopeList = await sendCmd('Runtime.getProperties', { objectId: scopes.value.objectId });

  // Scope 0: Block với handlers, englishGiftsView
  const blockScope = scopeList.result.find((s) => s.value?.description?.includes('Block'));
  const blockVars = await sendCmd('Runtime.getProperties', { objectId: blockScope.value.objectId });
  const handlersVar = blockVars.result.find((v) => v.name === 'handlers');

  // Scope 1: Closure với settings, updateSettings, hub, live, emitFx, pushState, getGiftCatalog
  const closureScope = scopeList.result.find((s) => s.value?.description?.includes('Closure'));
  const closureVars = await sendCmd('Runtime.getProperties', { objectId: closureScope.value.objectId });
  const settingsVar = closureVars.result.find((v) => v.name === 'settings');
  const updateSettingsVar = closureVars.result.find((v) => v.name === 'updateSettings');
  const hubVar = closureVars.result.find((v) => v.name === 'hub');
  const liveVar = closureVars.result.find((v) => v.name === 'live');
  const emitFxVar = closureVars.result.find((v) => v.name === 'emitFx');
  const pushStateVar = closureVars.result.find((v) => v.name === 'pushState');
  const getGiftCatalogVar = closureVars.result.find((v) => v.name === 'getGiftCatalog');

  console.log('[patch-rotation] Scope variables located successfully');

  // ─────────────────────────────────────────────────────────────
  // Cài đặt toàn bộ logic luân chuyển quà và sửa handlers
  // ─────────────────────────────────────────────────────────────
  const { result: patchResult } = await sendCmd('Runtime.callFunctionOn', {
    objectId: handlersVar.value.objectId,
    arguments: [
      { objectId: settingsVar.value.objectId },
      { objectId: updateSettingsVar.value.objectId },
      { objectId: hubVar.value.objectId },
      { objectId: liveVar.value.objectId },
      { objectId: emitFxVar.value.objectId },
      { objectId: pushStateVar.value.objectId },
      { objectId: getGiftCatalogVar?.value?.objectId || handlersVar.value.objectId }
    ],
    functionDeclaration: `function(settings, updateSettings, hub, live, emitFx, pushState, getGiftCatalog) {
      const handlers = this;

      // ── HẰNG SỐ & ĐỊNH NGHĨA ──
      const ROTATE_MS = 20 * 60 * 1000;
      const FANCLUB_GIFT_ID = '7934';
      const CHEAP_TARGETS = ['general', 'easy', 'normal', 'hard'];
      const CHEAP_MAX_COINS = 5;
      const MAX_ROUNDS_AWAY = 2;
      const ORDER_VERSION = 1;

      const ENGLISH_TARGETS = {
        general:    { icon: '🌐', label: 'Tổng hợp',   kind: 'set' },
        easy:       { icon: '😊', label: 'Dễ',        kind: 'level' },
        normal:     { icon: '⚖️', label: 'Thường',     kind: 'level' },
        hard:       { icon: '🔥', label: 'Khó',        kind: 'level' },
        toeic:      { icon: '💼', label: 'TOEIC',      kind: 'set' },
        ielts:      { icon: '🎓', label: 'IELTS',      kind: 'set' },
        nghe:       { icon: '🎧', label: 'Luyện nghe', kind: 'listen' },
        dongvat:    { icon: '🐾', label: 'Động vật',   kind: 'set' },
        truonghoc:  { icon: '🎒', label: 'Trường học', kind: 'set' },
        congnghe:   { icon: '💻', label: 'Công nghệ',  kind: 'set' },
        bongda:     { icon: '⚽', label: 'Thể thao',   kind: 'set' },
        yhoc:       { icon: '🩺', label: 'Y học',      kind: 'set' },
        dulich:     { icon: '✈️', label: 'Du lịch',    kind: 'set' },
        giaitri:    { icon: '🎬', label: 'Giải trí',   kind: 'set' },
        amthuc:     { icon: '🍕', label: 'Ẩm thực',    kind: 'set' },
        vutru:      { icon: '🚀', label: 'Vũ trụ',     kind: 'set' },
        nghenghiep: { icon: '👷', label: 'Nghề nghiệp',kind: 'set' },
        nhacua:     { icon: '🏠', label: 'Nhà cửa',    kind: 'set' },
        game:       { icon: '🎮', label: 'Game',       kind: 'set' },
        tinhyeu:    { icon: '💘', label: 'Tình yêu',   kind: 'set' },
        bian:       { icon: '👻', label: 'Bí ẩn',      kind: 'set' }
      };

      const ORDER = [
        'general', 'easy', 'normal', 'hard', 'toeic', 'ielts', 'nghe', 'dongvat',
        'truonghoc', 'congnghe', 'bongda', 'yhoc', 'dulich', 'giaitri', 'amthuc',
        'vutru', 'nghenghiep', 'nhacua', 'game', 'tinhyeu', 'bian'
      ];

      function defaultQuestionsFor(to) {
        if (to === 'nghe') return 35;
        if (to === 'normal') return 40;
        return 20;
      }

      function defaultEnglishRules() {
        return ORDER.map(to => ({
          to,
          gift: { id: '', name: '', coins: 0, image: '' },
          questions: defaultQuestionsFor(to),
          enabled: true
        }));
      }

      const emptyRotation = () => ({ round: 0, at: 0, base: {}, away: {}, heart: '', hot: null });

      const coinsOf = (r) => Number(r?.gift?.coins) || 0;
      const idOf = (r) => String(r?.gift?.id || '');

      function pool(options) {
        return options.filter((g) => (g.panel || g.seen) && String(g.id) !== FANCLUB_GIFT_ID && Number(g.coins) >= 1);
      }

      function hottestGift(counts = {}) {
        let best = null;
        for (const [id, n] of Object.entries(counts)) {
          if (Number(n) > 0 && (!best || Number(n) > best.count)) best = { id: String(id), count: Number(n) };
        }
        return best;
      }

      function rotateGifts({ rules, options, counts = {}, state = emptyRotation(), random = Math.random }) {
        const next = { ...emptyRotation(), ...state, base: { ...state.base }, away: { ...state.away } };
        for (const r of rules) if (next.base[r.to] === undefined) next.base[r.to] = coinsOf(r);

        const candidates = pool(options);
        const heartGift = options.find((g) => String(g.id) === FANCLUB_GIFT_ID) || { id: '7934', name: 'Heart Me', coins: 1, image: '' };
        const hot = hottestGift(counts);
        const heartTo = hot && heartGift && hot.id !== FANCLUB_GIFT_ID
          ? rules.find((r) => r.enabled !== false && idOf(r) === hot.id)?.to || '' : '';

        const taken = new Set();
        if (heartTo) taken.add(FANCLUB_GIFT_ID);
        for (const r of rules) if (r.enabled === false || !ENGLISH_TARGETS[r.to]) taken.add(idOf(r));

        const changes = [];
        const out = rules.map((r) => {
          if (r.enabled === false || !ENGLISH_TARGETS[r.to]) return r;
          const base = next.base[r.to] ?? coinsOf(r);

          if (r.to === heartTo) {
            next.away[r.to] = (next.base[r.to] === 1 ? 0 : MAX_ROUNDS_AWAY);
            next.heart = r.to;
            if (idOf(r) === FANCLUB_GIFT_ID) return r;
            changes.push({ to: r.to, label: ENGLISH_TARGETS[r.to].label, from: r.gift?.name || '', name: heartGift.name, coins: heartGift.coins, fanclub: true });
            return { ...r, gift: { id: heartGift.id, name: heartGift.name, coins: heartGift.coins, image: heartGift.image } };
          }

          const cheap = CHEAP_TARGETS.includes(r.to);
          const mustReturn = !cheap && (next.away[r.to] || 0) >= MAX_ROUNDS_AWAY;
          let allowed = candidates.filter((g) => !taken.has(String(g.id)) && String(g.id) !== idOf(r));
          if (cheap) allowed = allowed.filter((g) => Number(g.coins) <= CHEAP_MAX_COINS);
          else if (mustReturn) allowed = allowed.filter((g) => Number(g.coins) === base);
          if (!allowed.length) {
            taken.add(idOf(r));
            return r;
          }
          const g = allowed[Math.floor(random() * allowed.length) % allowed.length];
          taken.add(String(g.id));
          next.away[r.to] = Number(g.coins) === base ? 0 : (next.away[r.to] || 0) + 1;
          if (next.heart === r.to) next.heart = '';
          changes.push({ to: r.to, label: ENGLISH_TARGETS[r.to].label, from: r.gift?.name || '', name: g.name, coins: g.coins, fanclub: false });
          return { ...r, gift: { id: g.id, name: g.name, coins: g.coins, image: g.image } };
        });

        next.round += 1;
        next.hot = hot && { id: hot.id, count: hot.count, name: rules.find((r) => idOf(r) === hot.id)?.gift?.name || '' };
        return { rules: out, state: next, changes };
      }

      function normalizeRules(raw, options) {
        if (!Array.isArray(raw) || !raw.length) return raw;
        const byId = new Map(options.map((g) => [g.id, g]));
        const used = new Set();
        return raw.map((r) => {
          if (!ENGLISH_TARGETS[r?.to]) return r;
          const g = byId.get(String(r.giftId ?? r.gift?.id ?? '')) || r.gift;
          if (g?.id) used.add(g.id);
          const q = Math.round(Number(r.questions));
          const questions = Number.isFinite(q) && q >= 1 ? q : defaultQuestionsFor(r.to);
          return { to: r.to, gift: { id: g.id, name: g.name, coins: g.coins, image: g.image }, questions, enabled: r.enabled !== false };
        });
      }

      function getOptions() {
        const catalog = typeof getGiftCatalog === 'function' ? getGiftCatalog() : [];
        const catalogList = Array.isArray(catalog) ? catalog : [];
        return catalogList.map((g) => ({
          id: String(g.id), name: g.name, coins: Number(g.coins)||0, image: g.image||'', panel: true, pos: 1, seen: true
        }));
      }

      const hotGifts = () => {
        const catalog = typeof getGiftCatalog === 'function' ? getGiftCatalog() : [];
        const byId = new Map((catalog||[]).map((g) => [String(g.id), g]));
        const rules = settings.englishGifts?.length ? settings.englishGifts : defaultEnglishRules();
        for (const r of rules) if (r.gift?.id) byId.set(String(r.gift.id), { ...byId.get(String(r.gift.id)), ...r.gift });
        const counts = globalThis.__giftCounts || {};
        return Object.entries(counts)
          .map(([id, count]) => ({ id, count: Number(count), name: byId.get(String(id))?.name || '#' + id,
            coins: Number(byId.get(String(id))?.coins) || 0, to: rules.find((r) => String(r.gift?.id) === String(id))?.to || '' }))
          .sort((a, b) => b.count - a.count).slice(0, 8);
      };

      const englishGiftsView = () => {
        const catalog = typeof getGiftCatalog === 'function' ? getGiftCatalog() : [];
        return {
          rules: settings.englishGifts?.length ? settings.englishGifts : defaultEnglishRules(),
          custom: Boolean(settings.englishGifts?.length),
          options: getOptions(),
          rotate: {
            enabled: Boolean(settings.englishRotate),
            round: Number(settings.englishRotation?.round) || 0,
            hot: hotGifts()
          },
          targets: ORDER.map((to) => ({
            to,
            icon: ENGLISH_TARGETS[to].icon,
            label: ENGLISH_TARGETS[to].label,
            kind: ENGLISH_TARGETS[to].kind,
            questions: defaultQuestionsFor(to)
          }))
        };
      };

      function runGiftRotation() {
        try {
          const options = getOptions();
          const current = settings.englishGifts?.length ? settings.englishGifts : defaultEnglishRules();
          const counts = globalThis.__giftCounts || {};
          const { rules, state, changes } = rotateGifts({
            rules: current,
            options,
            counts,
            state: settings.englishRotation || emptyRotation()
          });

          if (!changes.length) {
            updateSettings({ englishRotation: state });
            return;
          }

          const normalized = normalizeRules(rules, options);
          updateSettings({ englishGifts: normalized, englishGiftsOrder: ORDER_VERSION, englishRotation: state });
          if (hub && typeof hub.setEnglishRules === 'function') {
            hub.setEnglishRules(normalized);
          }
          if (typeof pushState === 'function') pushState(true);

          const heart = changes.find((c) => c.fanclub);
          const text = heart
            ? '🎁 Bảng quà vừa đổi · ' + heart.label + ' giờ chỉ ' + heart.coins + ' xu (' + heart.name + ')'
            : '🎁 Bảng quà vừa đổi giá — xem lại bảng bên dưới!';

          if (typeof emitFx === 'function') {
            emitFx(hub.activeId ? hub.activeId() : 'english', [{ kind: 'toast', text }]);
          }

          console.log('[quà] luân chuyển vòng ' + state.round + ': ' + changes.map(c => c.label + ' ' + c.from + '->' + c.name + ' ' + c.coins + 'xu').join(', '));
        } catch (err) {
          console.warn('[quà] không luân chuyển được bảng quà:', err.message);
        }
      }

      // ── GHI ĐÈ CÁC HANDLER ──
      handlers.englishGifts = function() {
        return englishGiftsView();
      };

      handlers.setGiftRotate = function(msg) {
        updateSettings({ englishRotate: Boolean(msg.on) });
        console.log('[admin] tự luân chuyển giá quà: ' + (msg.on ? 'BẬT' : 'TẮT'));
        if (msg.on) {
          globalThis.__rotateAt = Date.now() + ROTATE_MS;
        }
        return {
          message: msg.on ? 'Đã bật tự luân chuyển giá quà (20 phút/vòng)' : 'Đã tắt tự luân chuyển giá quà',
          ...englishGiftsView()
        };
      };

      handlers.rotateNow = function() {
        runGiftRotation();
        globalThis.__rotateAt = Date.now() + ROTATE_MS;
        return {
          message: 'Đã luân chuyển bảng quà ngay',
          ...englishGiftsView()
        };
      };

      // ── CÀI ĐẶT BACKGROUND TIMER 20 PHÚT ──
      if (globalThis.__rotationTimer) {
        clearInterval(globalThis.__rotationTimer);
      }
      globalThis.__rotateAt = Date.now() + ROTATE_MS;
      globalThis.__rotationTimer = setInterval(() => {
        try {
          if (settings.englishRotate && (!live || !live.isLive || live.isLive())) {
            const now = Date.now();
            if (now >= (globalThis.__rotateAt || 0)) {
              globalThis.__rotateAt = now + ROTATE_MS;
              runGiftRotation();
            }
          }
        } catch (e) {
          console.error('[rotation timer error]', e);
        }
      }, 10000);

      return {
        ok: true,
        rotateEnabled: Boolean(settings.englishRotate),
        round: Number(settings.englishRotation?.round) || 0
      };
    }`,
    returnByValue: true
  });

  console.log('[patch-rotation] Result:', JSON.stringify(patchResult.value, null, 2));

  // ─────────────────────────────────────────────────────────────
  // Kiểm tra lại handlers.englishGifts() xem có rotate.enabled chưa
  // ─────────────────────────────────────────────────────────────
  const { result: verifyReply } = await sendCmd('Runtime.callFunctionOn', {
    objectId: handlersVar.value.objectId,
    functionDeclaration: `function() {
      const res = this.englishGifts();
      return {
        hasRotate: 'rotate' in res,
        rotate: res.rotate
      };
    }`,
    returnByValue: true
  });

  console.log('[patch-rotation] Verify handlers.englishGifts():', JSON.stringify(verifyReply.value, null, 2));

  ws.close();
  console.log('\n[patch-rotation] 🎉 ĐÃ KÍCH HOẠT HOÀN CHỈNH TỰ LUÂN CHUYỂN GIÁ QUÀ!');
}

main().catch((err) => {
  console.error('[patch-rotation] ❌ Lỗi:', err);
  process.exit(1);
});
