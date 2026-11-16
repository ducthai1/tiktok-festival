// Script chạy nền tự động duy trì chế độ Dễ (easy) trên phiên live 3939
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const token = fs.readFileSync(path.join(DIR, 'data/admin-token'), 'utf8').trim();
let ws = null;
let reconnectTimer = null;
let lastSend = 0;

function connect() {
  clearTimeout(reconnectTimer);
  ws = new WebSocket('ws://127.0.0.1:3939/ws', { headers: { Origin: 'http://127.0.0.1:3939' } });

  ws.on('open', () => {
    ws.send(JSON.stringify({ t: 'auth', token }));
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      const c = msg.snapshot?.control || msg.state?.control;
      if (c) {
        const now = Date.now();
        // 1. Nếu c.level === 'normal' thì lập tức ép về easy (bất kể có levelBy hay không)
        // 2. Nếu c.level !== 'easy' nhưng số câu còn lại đã hết (c.levelLeft <= 0)
        // 3. Nếu c.level === 'easy' và số câu sắp hết (<= 8 câu) thì bù thêm lượt để không bao giờ bị rơi về 0 câu
        const isNormal = c.level === 'normal';
        const expiredOther = c.level !== 'easy' && c.levelLeft <= 0;
        const lowEasy = c.level === 'easy' && !c.levelBy && c.levelLeft <= 8;

        if (isNormal || expiredOther || lowEasy) {
          if (now - lastSend > 3000) { // chống spam
            lastSend = now;
            console.log(`[keep-easy] Duy trì Dễ (level: ${c.level}, còn: ${c.levelLeft}c, levelBy: ${c.levelBy?.nickname || 'null'})...`);
            ws.send(JSON.stringify({ t: 'command', game: 'english', name: 'deck-easy' }));
          }
        }
      }
    } catch (e) {
      console.error('[keep-easy] Lỗi xử lý:', e.message);
    }
  });

  ws.on('close', () => {
    reconnectTimer = setTimeout(connect, 3000);
  });

  ws.on('error', () => {
    ws.close();
  });
}

connect();
console.log('[keep-easy] Đã khởi động dịch vụ duy trì chế độ Dễ cho cổng 3939.');
