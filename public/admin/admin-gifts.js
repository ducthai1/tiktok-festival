// Tab 🎁 Quà: chủ kênh tự chọn quà → chế độ (bộ đề / độ khó / 🎧 Luyện nghe) + số câu cho tab Từ Vựng Tiếng Anh.
// Một chế độ có thể có nhiều món (vd Luyện nghe: Heart Me 1 xu → 10 câu, Doughnut 30 xu → 40 câu); tắt một dòng để ẩn tạm.
// Máy chủ kiểm lại mọi thứ và lấy GIÁ THẬT từ bảng quà TikTok (src/games/quiz/english-gift-rules.js) — trang này chỉ gửi id quà.
const PER_PAGE = 7; // bảng trên màn hình: 7 món mỗi trang (quiz-scene.js)

export function setupGiftEditor({ $, socket, toast }) {
  let rules = []; // [{ to, giftId, questions, enabled }]
  let options = [];
  let targets = [];
  let dirty = false;
  let pickingFor = -1;

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

  function giftButton(rule, index) {
    const g = optionOf(rule.giftId);
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
    b.addEventListener('click', () => openPicker(index));
    return b;
  }

  function render() {
    const root = $('gift-rules');
    const dupIds = new Set(rules.map((r) => r.giftId).filter((id, i, all) => id && all.indexOf(id) !== i));
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
    if (dupIds.size) status('⚠ Có món quà gán cho 2 dòng (viền đỏ) — mỗi món chỉ một chế độ', 'bad');
    else if (!$('gifts-status').classList.contains('ok')) status('');
  }

  // ── hộp chọn quà ──
  function renderPicker() {
    const q = $('picker-search').value.trim().toLowerCase();
    const all = $('picker-all').checked;
    const usedBy = new Map(rules.map((r, i) => [r.giftId, i]));
    const list = options.filter((g) => (all || g.panel || g.seen) && (!q || g.name.toLowerCase().includes(q)));
    $('picker-grid').replaceChildren(...list.map((g) => {
      const b = el('button', `pick${rules[pickingFor]?.giftId === g.id ? ' sel' : ''}`);
      b.type = 'button';
      const img = el('img');
      img.src = g.image;
      img.alt = '';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      b.append(img, el('span', '', g.name), el('span', 'coins', `${g.coins} 💎`));
      const used = usedBy.get(g.id);
      if (used !== undefined && used !== pickingFor) b.append(el('span', 'badge used', `đang dùng: ${targetOf(rules[used].to)?.label || ''}`));
      else b.append(badgeFor(g));
      b.addEventListener('click', () => {
        if (used !== undefined && used !== pickingFor) return toast('Món này đang dùng ở dòng khác — mỗi món chỉ một chế độ', true);
        rules[pickingFor].giftId = g.id;
        closePicker();
        setDirty(true);
        render();
      });
      return b;
    }));
    if (!list.length) $('picker-grid').replaceChildren(el('p', 'muted', 'Không thấy quà nào — thử bật "Cả quà không có trong hộp quà chung".'));
  }
  function openPicker(index) {
    pickingFor = index;
    $('picker-search').value = '';
    const current = optionOf(rules[index]?.giftId);
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

  function apply(view) {
    options = view.options || [];
    targets = view.targets || [];
    rules = (view.rules || []).map((r) => ({ to: r.to, giftId: String(r.gift?.id || ''), questions: r.questions, enabled: r.enabled !== false }));
    setDirty(false);
    render();
    status(view.custom ? '' : 'Đang dùng bảng quà mặc định — chỉnh rồi bấm "Lưu & áp dụng".', 'idle');
  }

  async function load(force = false) {
    if (dirty && !force) return; // đang sửa dở thì không tải đè
    const reply = await socket.request({ t: 'englishGifts' });
    if (reply.ok) apply(reply);
    else toast(reply.message || 'Không tải được bảng quà', true);
  }

  $('gifts-add').addEventListener('click', () => {
    rules.push({ to: 'nghe', giftId: '', questions: targetOf('nghe')?.questions || 40, enabled: true });
    setDirty(true);
    render();
    openPicker(rules.length - 1);
  });
  $('gifts-save').addEventListener('click', async () => {
    if (rules.some((r) => !r.giftId)) return toast('Còn dòng chưa chọn quà', true);
    const reply = await socket.request({ t: 'saveEnglishGifts', rules });
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
