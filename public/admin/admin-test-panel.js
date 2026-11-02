// Mục "Thử trước khi live": bình luận/tim/follow/quà/người vào phòng giả mang tên "Khách thử N".
// Server tự từ chối khi đang kết nối live thật.
import { SAMPLE_GIFTS } from '/static/shared/gift-tiers.js';
const TEST_CHATS = { bar: ['chào cả quán', 'nhảy', 'cụng ly'], swim: ['cố lên', 'bơi đi'], temple: ['thắp hương', 'cầu cho gia đình bình an', 'xin xăm'] };

function chip(text, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip';
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

export function setupTestPanel({ $, run, socket, toast }) {
  const viewer = () => Number($('test-viewer').value) || 1;
  const send = (payload) => run({ t: 'test', viewer: viewer(), ...payload }, 'Đã gửi thử');
  // Nhiều người vào liên tiếp, mỗi người một số khác nhau để ai cũng được chào.
  let nextCrowdId = 100 + Math.floor(Math.random() * 300);
  async function arrive(count, kind = 'member') {
    for (let i = 0; i < count; i += 1) {
      await socket.request({ t: 'test', kind, viewer: (nextCrowdId += 1), comment: 'xin chào' });
    }
    toast(`Đã cho ${count} khách thử vào phòng`);
  }

  // quà TikTok thật hay gặp, giá phổ biến (xu) — hiệu ứng theo giá MỘT món, giống lúc live thật
  $('test-gifts').replaceChildren(...SAMPLE_GIFTS.map((g) => chip(`${g.emoji} ${g.name} · ${g.coins.toLocaleString('vi-VN')} xu`,
    () => send({ kind: 'gift', giftId: g.id }))));
  for (const b of document.querySelectorAll('[data-test]')) b.addEventListener('click', () => send({ kind: b.dataset.test, likes: 10 }));
  $('test-arrive-1').addEventListener('click', () => send({ kind: 'member' }));
  $('test-arrive-5').addEventListener('click', () => arrive(5));
  $('test-arrive-25').addEventListener('click', () => arrive(25));
  $('test-crowd').addEventListener('click', () => arrive(8, 'chat'));
  $('test-viewers-form').addEventListener('submit', (e) => {
    e.preventDefault();
    run({ t: 'test', kind: 'viewers', viewerCount: Number($('test-viewers').value) || 0 }, 'Đã đặt số người xem (thử)');
  });
  $('test-chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if ($('test-comment').value.trim()) send({ kind: 'chat', comment: $('test-comment').value });
  });

  return {
    renderChats(game) {
      $('test-chats').replaceChildren(...(TEST_CHATS[game] || []).map((text) => chip(`💬 ${text}`, () => send({ kind: 'chat', comment: text }))));
    }
  };
}
