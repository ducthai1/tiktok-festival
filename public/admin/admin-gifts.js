// Tab 🎁 Quà: chủ kênh tự chọn quà → chế độ (bộ đề / độ khó / 🎧 Luyện nghe) + số câu cho tab Từ Vựng Tiếng Anh.
// Một chế độ có thể có nhiều món (vd Luyện nghe: Heart Me 1 xu → 10 câu, Doughnut 30 xu → 40 câu); tắt một dòng để ẩn tạm.
// Máy chủ kiểm lại mọi thứ và lấy GIÁ THẬT từ bảng quà TikTok (src/games/quiz/english-gift-rules.js) — trang này chỉ gửi id quà.
const PER_PAGE = 7; // bảng trên màn hình: 7 món mỗi trang (quiz-scene.js)

export function setupGiftEditor({ $, socket, toast }) {
  let rules = []; // [{ to, giftId, questions, enabled }]
  let musicGifts = { enabled: true, on: null, off: null };
  let options = [];
  let targets = [];
  let dirty = false;
  let pickingFor = -1; // number hoặc 'music-on' | 'music-off'

  const el = (tag, className = '', text = '') => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const optionOf = (id) => options.find((g) => g.id === id);
  const targetOf = (to) => targets.find((t) => t.to === to);

  function setDirty(on) {
    dirty = on;
    $('gifts-save').disabled = !on;
    $('gifts-save').textContent = on ? '💾 Lưu & áp dụng *' : '💾 Đã lưu';
  }

  function status(text, kind = 'idle') {
    $('gifts-status').hidden = !text;
    $('gifts-status').className = `status ${kind}`;
    $('gifts-status').textContent = text;
  }

  function badgeFor(g) {
    if (!g) return el('span', 'badge warn', 'chưa chọn');
    if (g.panel) return el('span', 'badge', `hộp quà #${g.pos}`);
    if (g.seen) return el('span', 'badge seen', 'phòng đã nhận');
    return el('span', 'badge warn', '⚠ không có trong hộp quà chung');
  }

  function makeGiftBtn(giftId, onPick) {
    const g = optionOf(giftId);
    const b = el('button', 'gift-btn');
    b.type = 'button';
    b.title = 'Đổi món quà';
    if (g?.image) {
      const img = el('img');
      img.src = g.image;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      b.append(img);
    }
    const name = el('span', 'gname');
    name.append(el('b', '', g?.name || 'Chọn quà…'));
    const meta = el('span');
    meta.append(el('span', 'coins', g ? `${g.coins} 💎 ` : ''), badgeFor(g));
    name.append(meta);
    b.append(name);
    b.addEventListener('click', onPick);
    return b;
  }

  function giftButton(rule, index) {
    return makeGiftBtn(rule.giftId, () => openPicker(index));
  }

  function renderMusicGifts(dupIds) {
    if (!$('music-gifts-box')) return;
    $('music-gifts-on').checked = musicGifts.enabled !== false;

    const onId = musicGifts.on?.id || '';
    const offId = musicGifts.off?.id || '';

    const onDup = dupIds.has(onId) || (onId && onId === offId);
    const offDup = dupIds.has(offId) || (offId && onId === offId);

    $('music-on-slot').className = `music-slot${onDup ? ' dup' : ''}`;
    $('music-on-slot').replaceChildren(makeGiftBtn(onId, () => openPicker('music-on')));

    $('music-off-slot').className = `music-slot${offDup ? ' dup' : ''}`;
    $('music-off-slot').replaceChildren(makeGiftBtn(offId, () => openPicker('music-off')));
  }

  function render() {
    const root = $('gift-rules');
    const dupIds = new Set(rules.map((r) => r.giftId).filter((id, i, all) => id && all.indexOf(id) !== i));
    if (musicGifts.enabled !== false) {
      const onId = musicGifts.on?.id;
      const offId = musicGifts.off?.id;
      if (onId && offId && onId === offId) dupIds.add(onId);
      for (const r of rules) {
        if (r.giftId && (r.giftId === onId || r.giftId === offId)) dupIds.add(r.giftId);
      }
    }
    renderMusicGifts(dupIds);

    const rows = [];
    let shown = 0;
    rules.forEach((rule, index) => {
      // vạch "Trang N" đúng như bảng trên màn hình (chỉ đếm dòng đang bật)
      if (rule.enabled && shown % PER_PAGE === 0) rows.push(el('div', 'page-sep', `Trang ${shown / PER_PAGE + 1} trên màn hình`));
      if (rule.enabled) shown += 1;
      const row = el('div', `rule${rule.enabled ? '' : ' off'}${dupIds.has(rule.giftId) ? ' dup' : ''}`);
      const toggle = el('label', 'toggle');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = rule.enabled;
      box.title = 'Bật / tắt dòng này';
      box.addEventListener('change', () => { rule.enabled = box.checked; setDirty(true); render(); });
      toggle.append(box);
      const select = el('select');
      for (const t of targets) {
        const o = el('option', '', `${t.icon} ${t.label}`);
        o.value = t.to;
        select.append(o);
      }
      select.value = rule.to;
      select.addEventListener('change', () => {
        const before = targetOf(rule.to);
        rule.to = select.value;
        // số câu còn là mặc định của chế độ cũ → đổi theo mặc định chế độ mới
        if (!rule.questions || rule.questions === before?.questions) rule.questions = targetOf(rule.to)?.questions || 20;
        setDirty(true);
        render();
      });
      const qty = el('label', 'qty');
      const num = el('input');
      num.type = 'number';
      num.min = '1';
      num.max = '200';
      num.value = String(rule.questions || targetOf(rule.to)?.questions || 20);
      num.addEventListener('input', () => { rule.questions = Number(num.value) || 0; setDirty(true); });
      qty.append(num, 'câu');
      if (targetOf(rule.to)?.kind === 'reset') qty.style.visibility = 'hidden'; // về Tổng hợp: không tính số câu
      const acts = el('div', 'acts');
      const btn = (text, title, fn, disabled = false) => {
        const b = el('button', 'tiny ghost', text);
        b.type = 'button';
        b.title = title;
        b.disabled = disabled;
        b.addEventListener('click', fn);
        return b;
      };
      const move = (d) => () => {
        const [r] = rules.splice(index, 1);
        rules.splice(index + d, 0, r);
        setDirty(true);
        render();
      };
      acts.append(btn('▲', 'Lên', move(-1), index === 0), btn('▼', 'Xuống', move(1), index === rules.length - 1),
        btn('🗑', 'Xoá dòng', () => { rules.splice(index, 1); setDirty(true); render(); }));
      row.append(toggle, giftButton(rule, index), el('span', 'arrow', '→'), select, qty, acts);
      rows.push(row);
    });
    root.replaceChildren(...rows);
    if (dupIds.size) status('⚠ Có món quà bị trùng giữa các chế độ hoặc quà Bật/Tắt nhạc (viền đỏ) — mỗi món chỉ gán một tính năng', 'bad');
    else if (!$('gifts-status').classList.contains('ok')) status('');
  }

  // ── hộp chọn quà ──
  function renderPicker() {
    const q = $('picker-search').value.trim().toLowerCase();
    const all = $('picker-all').checked;
    const usedByRule = new Map(rules.map((r, i) => [r.giftId, i]));
    const onId = musicGifts.on?.id;
    const offId = musicGifts.off?.id;
    const list = options.filter((g) => (all || g.panel || g.seen) && (!q || g.name.toLowerCase().includes(q)));

    let currentSelId = '';
    if (pickingFor === 'music-on') currentSelId = onId;
    else if (pickingFor === 'music-off') currentSelId = offId;
    else if (pickingFor >= 0) currentSelId = rules[pickingFor]?.giftId;

    $('picker-grid').replaceChildren(...list.map((g) => {
      const b = el('button', `pick${currentSelId === g.id ? ' sel' : ''}`);
      b.type = 'button';
      const img = el('img');
      img.src = g.image;
      img.alt = '';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      b.append(img, el('span', '', g.name), el('span', 'coins', `${g.coins} 💎`));

      let usedLabel = '';
      let isUsed = false;

      if (pickingFor === 'music-on') {
        if (usedByRule.has(g.id)) {
          isUsed = true;
          usedLabel = `đang dùng: ${targetOf(rules[usedByRule.get(g.id)].to)?.label || 'đổi chế độ'}`;
        } else if (offId && g.id === offId) {
          isUsed = true;
          usedLabel = 'đang dùng: Tắt nhạc';
        }
      } else if (pickingFor === 'music-off') {
        if (usedByRule.has(g.id)) {
          isUsed = true;
          usedLabel = `đang dùng: ${targetOf(rules[usedByRule.get(g.id)].to)?.label || 'đổi chế độ'}`;
        } else if (onId && g.id === onId) {
          isUsed = true;
          usedLabel = 'đang dùng: Bật nhạc';
        }
      } else if (pickingFor >= 0) {
        if (usedByRule.has(g.id) && usedByRule.get(g.id) !== pickingFor) {
          isUsed = true;
          usedLabel = `đang dùng: ${targetOf(rules[usedByRule.get(g.id)].to)?.label || ''}`;
        } else if (musicGifts.enabled !== false && onId && g.id === onId) {
          isUsed = true;
          usedLabel = 'đang dùng: Bật nhạc';
        } else if (musicGifts.enabled !== false && offId && g.id === offId) {
          isUsed = true;
          usedLabel = 'đang dùng: Tắt nhạc';
        }
      }

      if (usedLabel) b.append(el('span', 'badge used', usedLabel));
      else b.append(badgeFor(g));

      b.addEventListener('click', () => {
        if (isUsed) return toast(`Món này đang được dùng (${usedLabel}) — mỗi món chỉ gán một tính năng`, true);
        if (pickingFor === 'music-on') {
          musicGifts.on = { id: g.id, name: g.name, coins: g.coins, image: g.image };
        } else if (pickingFor === 'music-off') {
          musicGifts.off = { id: g.id, name: g.name, coins: g.coins, image: g.image };
        } else if (pickingFor >= 0) {
          rules[pickingFor].giftId = g.id;
        }
        closePicker();
        setDirty(true);
        render();
      });
      return b;
    }));
    if (!list.length) $('picker-grid').replaceChildren(el('p', 'muted', 'Không thấy quà nào — thử bật "Cả quà không có trong hộp quà chung".'));
  }

  function openPicker(target) {
    pickingFor = target;
    $('picker-search').value = '';
    let currentId = '';
    if (target === 'music-on') currentId = musicGifts.on?.id;
    else if (target === 'music-off') currentId = musicGifts.off?.id;
    else currentId = rules[target]?.giftId;

    const current = optionOf(currentId);
    $('picker-all').checked = Boolean(current && !current.panel && !current.seen);
    $('gift-picker').hidden = false;
    renderPicker();
    $('picker-search').focus();
  }
  function closePicker() {
    $('gift-picker').hidden = true;
    pickingFor = -1;
  }
  $('picker-search').addEventListener('input', renderPicker);
  $('picker-all').addEventListener('change', renderPicker);
  $('picker-close').addEventListener('click', closePicker);
  $('gift-picker').addEventListener('click', (e) => { if (e.target === $('gift-picker')) closePicker(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('gift-picker').hidden) closePicker(); });

  /** Khối tự luân chuyển giá quà: công tắc, số vòng đã chạy, và món đang được tặng nhiều nhất buổi này. */
  function renderRotate(rot) {
    $('rotate-on').checked = Boolean(rot?.enabled);
    if ($('rotate-minutes') && document.activeElement !== $('rotate-minutes')) {
      $('rotate-minutes').value = String(rot?.minutes || 20);
    }
    $('rotate-round').hidden = !rot?.round;
    if (rot?.round) $('rotate-round').textContent = `đã đổi ${rot.round} vòng`;
    const box = $('rotate-hot');
    box.replaceChildren();
    const hot = rot?.hot || [];
    if (!hot.length) {
      box.append(el('span', 'none', 'Buổi này chưa ai tặng quà — chưa có món nào để tính "hot nhất".'));
      return;
    }
    for (const g of hot) {
      const chip = el('span', 'hot');
      chip.append(el('b', '', g.name), el('span', 'n', `${g.count} lượt · ${g.coins} 💎${g.to ? ` · ${targetOf(g.to)?.label || g.to}` : ''}`));
      box.append(chip);
    }
  }

  function apply(view) {
    options = view.options || [];
    targets = view.targets || [];
    rules = (view.rules || []).map((r) => ({ to: r.to, giftId: String(r.gift?.id || ''), questions: r.questions, enabled: r.enabled !== false }));
    if (view.musicGifts) {
      musicGifts = {
        enabled: view.musicGifts.enabled !== false,
        on: view.musicGifts.on ? { ...view.musicGifts.on } : null,
        off: view.musicGifts.off ? { ...view.musicGifts.off } : null
      };
    }
    setDirty(false);
    render();
    renderRotate(view.rotate);
    status(view.custom ? '' : 'Đang dùng bảng quà mặc định — chỉnh rồi bấm "Lưu & áp dụng".', 'idle');
  }

  async function load(force = false) {
    if (dirty && !force) return; // đang sửa dở thì không tải đè
    const reply = await socket.request({ t: 'englishGifts' });
    if (reply.ok) apply(reply);
    else toast(reply.message || 'Không tải được bảng quà', true);
  }

  $('music-gifts-on')?.addEventListener('change', () => {
    musicGifts.enabled = $('music-gifts-on').checked;
    setDirty(true);
    render();
  });

  $('rotate-on').addEventListener('change', async () => {
    const on = $('rotate-on').checked;
    const minutes = Number($('rotate-minutes')?.value) || 20;
    const reply = await socket.request({ t: 'setGiftRotate', on, minutes });
    if (!reply.ok) {
      $('rotate-on').checked = !on;
      return toast(reply.message || 'Không đổi được', true);
    }
    apply(reply);
    toast(reply.message);
  });
  $('rotate-minutes')?.addEventListener('change', async () => {
    let minutes = Math.max(1, Math.min(180, Math.round(Number($('rotate-minutes').value)) || 20));
    $('rotate-minutes').value = String(minutes);
    const reply = await socket.request({ t: 'setGiftRotateInterval', minutes });
    if (!reply.ok) return toast(reply.message || 'Không đổi được', true);
    apply(reply);
    toast(reply.message);
  });
  $('rotate-minutes')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('rotate-minutes').blur();
    }
  });
  $('rotate-now').addEventListener('click', async () => {
    if (!confirm('Đổi bảng quà ngay bây giờ? Giá các ô trên màn hình sẽ thay đổi với người xem.')) return;
    const reply = await socket.request({ t: 'rotateNow' });
    if (!reply.ok) return toast(reply.message || 'Không đổi được', true);
    apply(reply);
    status(`✓ ${reply.message}`, 'ok');
  });

  $('gifts-add').addEventListener('click', () => {
    rules.push({ to: 'nghe', giftId: '', questions: targetOf('nghe')?.questions || 40, enabled: true });
    setDirty(true);
    render();
    openPicker(rules.length - 1);
  });
  $('gifts-save').addEventListener('click', async () => {
    if (rules.some((r) => !r.giftId)) return toast('Còn dòng chưa chọn quà', true);
    if (musicGifts.enabled !== false && (!musicGifts.on?.id || !musicGifts.off?.id)) {
      return toast('Chưa chọn quà Bật hoặc Tắt nhạc nền', true);
    }
    const reply = await socket.request({ t: 'saveEnglishGifts', rules, musicGifts });
    if (!reply.ok) {
      status(`✗ ${reply.message}`, 'bad');
      return toast(reply.message || 'Lưu không được', true);
    }
    apply(reply);
    status(`✓ ${reply.message}`, 'ok');
    toast(reply.message);
  });
  $('gifts-reset').addEventListener('click', async () => {
    if (!confirm('Khôi phục bảng quà mặc định? Các chỉnh sửa hiện tại sẽ mất.')) return;
    const reply = await socket.request({ t: 'resetEnglishGifts' });
    if (!reply.ok) return toast(reply.message || 'Không khôi phục được', true);
    apply(reply);
    status(`✓ ${reply.message}`, 'ok');
  });
  window.addEventListener('beforeunload', (e) => { if (dirty) e.preventDefault(); });

  return { load };
}
