// "Demo nhanh": bấm một nút là chạy một kịch bản thử cho game đang chọn — ít người vào, đông
// người vào, phòng trên 1000 người, và từng hiệu ứng theo bình luận/quà — để chọn kiểu mình thích.
// Mọi sự kiện đi qua lệnh "test" nên server tự chặn khi đang live thật; màn hình hiện CHẾ ĐỘ THỬ.
const NAMES = ['Lan Anh', 'Minh Tuấn', 'Hà My', 'Quốc Bảo', 'Thu Trang', 'Đức Huy', 'Ngọc Ánh', 'Hoàng Nam', 'Phương Linh',
  'Gia Bảo', 'Bảo Ngọc', 'Khánh Vy', 'Tiến Đạt', 'Mai Chi', 'Nhật Minh', 'Thảo Vy', 'Anh Khoa', 'Yến Nhi', 'Trung Kiên',
  'Hải Yến', 'Vân Anh', 'Đăng Khoa', 'Thanh Hằng', 'Minh Châu', 'Phúc An', 'Diệu Linh', 'Tuấn Kiệt', 'Bích Ngọc', 'Hữu Phước',
  'Kim Ngân', 'Việt Hoàng', 'Ngọc Hân', 'Quang Huy', 'Thùy Dung', 'Duy Mạnh', 'Hồng Nhung', 'Bảo Long', 'Cẩm Tú', 'Minh Khôi', 'Lệ Quyên'];
const CAST = ['Lan Anh 🌸', 'Minh Tuấn', 'Hà My', 'Quốc Bảo', 'Thu Trang', 'Đức Huy'];

// Mỗi lần mở trang một dải id mới để người "mới vào" luôn là người chưa được chào.
let nextNewcomer = 20000 + Math.floor(Math.random() * 60000);
const castId = (i) => 9001 + (i % CAST.length);
const newcomer = () => {
  nextNewcomer += 1;
  return { viewer: nextNewcomer, name: NAMES[nextNewcomer % NAMES.length] };
};

const by = (i) => ({ viewer: castId(i), name: CAST[i % CAST.length] });
const chat = (comment, i = 0) => ({ kind: 'chat', comment, ...by(i) });
// quà theo id quà mẫu (public/shared/gift-tiers.js): rose, finger-heart, rosa, doughnut, cap, corgi,
// galaxy, fireworks, sports-car, interstellar, lion, universe
const gift = (giftId, i = 0, count = 1) => ({ kind: 'gift', giftId, count, ...by(i) });
const like = (i = 0) => ({ kind: 'like', likes: 15, ...by(i) });
const social = (kind, i = 0) => ({ kind, ...by(i) });

export const ARRIVALS = [
  ['👋 Ít người vào (3 người)', () => [1, 2, 3].map(() => ({ kind: 'member', ...newcomer(), wait: 1800 }))],
  ['🚶 Đông người vào (35 người)', () => Array.from({ length: 35 }, () => ({ kind: 'member', ...newcomer(), wait: 15 }))],
  ['📢 Phòng trên 1000 người', () => [
    { kind: 'viewers', viewerCount: 1500, wait: 200 },
    ...Array.from({ length: 8 }, () => ({ kind: 'member', ...newcomer(), wait: 450 })),
    { kind: 'viewers', viewerCount: 0, wait: 6000 }
  ]]
];

export const EFFECTS = {
  bar: [
    ['💬 Chào quán', () => chat('quán xịn quá mọi người ơi 🔥', 0)],
    ['💃 “nhảy”', () => chat('nhảy', 1)],
    ['🥂 “cụng ly”', () => chat('cụng ly', 2)],
    ['❤ Thả tim', () => like(3)],
    ['➕ Follow', () => social('follow', 4)],
    ['↗ Share', () => social('share', 5)],
    ['🌹 Hoa hồng → Bia', () => gift('rose', 0)],
    ['🍩 Bánh donut → Cocktail', () => gift('doughnut', 1)],
    ['🐶 Corgi → Champagne', () => gift('corgi', 2)],
    ['🌌 Dải ngân hà → Tháp ly', () => gift('galaxy', 3)],
    ['🏎️ Siêu xe → Mở tiệc', () => gift('sports-car', 4)],
    ['🦁 Sư tử → Đại tiệc', () => ({ ...gift('lion', 5), wait: 9000 })]
  ],
  dance: [
    ['💬 “quẩy lên”', () => chat('quẩy lên mọi người ơi 🔥', 0)],
    ['👋 “chào cả nhà”', () => chat('chào cả nhà', 1)],
    ['😂 Đổi mặt', () => chat('haha 😂', 2)],
    ['👕 “đổi đồ”', () => chat('đổi đồ', 3)],
    ['❤ Thả tim', () => like(4)],
    ['➕ Follow', () => social('follow', 5)],
    ['🌹 Hoa hồng → Hào quang', () => gift('rose', 0)],
    ['🍩 Bánh donut → Bay + solo ngắn', () => gift('doughnut', 1)],
    ['🐶 Corgi → Solo sân khấu', () => ({ ...gift('corgi', 2), wait: 6000 })],
    ['🌌 Dải ngân hà → Khổng lồ VIP', () => ({ ...gift('galaxy', 3), wait: 8000 })],
    ['🏎️ Siêu xe → Pháo hoa + DROP', () => ({ ...gift('sports-car', 4), wait: 9000 })],
    ['🦁 Sư tử → Đại nhạc hội', () => ({ ...gift('lion', 5), wait: 12000 })]
  ],
  swim: [
    ['💬 “cố lên”', () => chat('cố lên', 0)],
    ['❤ Thả tim → vịt phao', () => like(1)],
    ['➕ Follow → ván lướt', () => social('follow', 2)],
    ['🌹 Hoa hồng → Chân vịt', () => gift('rose', 3)],
    ['🫰 Bắn tim → Ván lướt', () => gift('finger-heart', 4)],
    ['💐 Rosa → Thuyền', () => gift('rosa', 5)],
    ['🍩 Bánh donut → Cá heo', () => gift('doughnut', 0)],
    ['🐶 Corgi → Cá mập', () => gift('corgi', 1)],
    ['🌌 Dải ngân hà → Cá voi', () => gift('galaxy', 2)],
    ['🏎️ Siêu xe → Tàu ngầm', () => gift('sports-car', 3)],
    ['🦁 Sư tử → Về đích ngay', () => gift('lion', 4)]
  ],
  temple: [
    ['🪷 “cầu …” thả hoa đăng', () => chat('cầu cho gia đình bình an mạnh khoẻ', 1)],
    ['💬 Gõ “xin xăm” (chỉ được nhắc tặng quà)', () => chat('xin xăm', 2)],
    ['❤ Thả tim → gõ mõ', () => like(4)],
    ['🔔 Follow → thỉnh chuông', () => social('follow', 5)],
    ['🌹 Hoa hồng ×3 → Thắp hương', () => ({ ...gift('rose', 0, 3), wait: 9000 })],
    ['🍩 Bánh donut → Xin xăm', () => ({ ...gift('doughnut', 3), wait: 10000 })],
    ['🐶 Corgi → Cầu sức khỏe', () => ({ ...gift('corgi', 1), wait: 7000 })],
    ['🌌 Dải ngân hà → Cầu tài lộc', () => ({ ...gift('galaxy', 2), wait: 7000 })],
    ['🏎️ Siêu xe → Điều ước lớn', () => ({ ...gift('sports-car', 4), wait: 10000 })],
    ['🦁 Sư tử → Vạn sự như ý', () => ({ ...gift('lion', 5), wait: 18000 })]
  ]
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createDemoRunner({ socket, toast, setStatus }) {
  let runId = 0;

  async function run(label, steps) {
    const me = (runId += 1);
    setStatus(`▶ Đang chạy: ${label}`);
    for (const step of steps) {
      if (me !== runId) return; // đã bấm kịch bản khác hoặc Dừng
      const { wait = 2600, ...payload } = step;
      const reply = await socket.request({ t: 'test', ...payload });
      if (!reply.ok) {
        toast(reply.message || 'Không chạy được', true);
        setStatus('');
        return;
      }
      await sleep(wait);
    }
    if (me === runId) setStatus(`✓ Xong: ${label}`);
  }

  return {
    run,
    stop() {
      runId += 1;
      setStatus('⏹ Đã dừng');
    },
    // Chạy hết: vài người vào → từng hiệu ứng của game, cách nhau đủ lâu để xem rõ.
    runAll(game) {
      const effects = EFFECTS[game] || [];
      // mỗi hiệu ứng có thời lượng riêng (wait trong make) để màn trước diễn xong mới tới màn sau
      const steps = [...ARRIVALS[0][1](), ...effects.map(([, make]) => ({ wait: 3600, ...make() }))];
      return run(`Toàn bộ hiệu ứng (${effects.length})`, steps);
    }
  };
}

function button(text, className, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

// Vẽ lại các nút demo theo game đang chọn.
export function renderDemoButtons({ arrivalsRoot, effectsRoot, game, runner }) {
  arrivalsRoot.replaceChildren(
    ...ARRIVALS.map(([label, make]) => button(label, 'chip', () => runner.run(label, make()))),
    button('▶ Chạy toàn bộ hiệu ứng', 'big', () => runner.runAll(game)),
    button('⏹ Dừng', 'ghost', () => runner.stop())
  );
  effectsRoot.replaceChildren(...(EFFECTS[game] || []).map(([label, make]) =>
    button(label, 'chip', () => runner.run(label, [{ ...make(), wait: 200 }]))));
}
