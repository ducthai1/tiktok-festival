// WebSocket chung cho màn hình OBS (chỉ xem) và trang điều khiển (phải gửi token).
// Bản tham khảo cho mọi trang cùng máy quyền điều khiển; ở đây thiếu token = chỉ được xem.
import { WebSocketServer } from 'ws';
import { createRateLimiter, isAllowedHost, isAllowedOrigin, isLoopbackAddress, tokensEqual } from './security.js';

const MAX_AUTH_FAILURES = 3;

export function createSocketHub({ getPort, allowLan, adminToken, onAdminMessage, onClientReady }) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: false });

  function send(ws, message) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
  }

  function handleUpgrade(request, socket, head) {
    const { host, origin } = request.headers;
    const pathOk = (request.url || '').split('?')[0] === '/ws';
    const port = getPort();
    const remoteOk = allowLan || isLoopbackAddress(request.socket.remoteAddress);
    if (!pathOk || !remoteOk || !isAllowedHost(host, port, allowLan) || !isAllowedOrigin(origin, host, port, allowLan)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws));
  }

  wss.on('connection', (ws) => {
    ws.role = 'stage';
    ws.alive = true;
    ws.authFailures = 0;
    // Màn hình chưa đăng nhập: 30 tin/5 giây là thừa. Trang điều khiển đã có token được nới hơn
    // vì kịch bản demo "đông người vào" gửi vài chục sự kiện thử liền nhau.
    const allowGuest = createRateLimiter(30, 5000);
    const allowAdmin = createRateLimiter(400, 5000);
    ws.on('pong', () => { ws.alive = true; });
    ws.on('error', () => {});
    ws.on('message', (raw, isBinary) => {
      if (isBinary || !(ws.role === 'admin' ? allowAdmin() : allowGuest())) return ws.close(1008, 'Quá nhiều tin nhắn');
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return ws.close(1003, 'Sai định dạng');
      }
      if (!message || typeof message !== 'object' || typeof message.t !== 'string') return undefined;
      if (message.t === 'auth') {
        if (tokensEqual(adminToken, message.token)) {
          ws.role = 'admin';
          onClientReady(ws);
          return send(ws, { t: 'authOk' });
        }
        ws.authFailures += 1;
        send(ws, { t: 'authFail' });
        if (ws.authFailures >= MAX_AUTH_FAILURES) ws.close(1008, 'Sai token');
        return undefined;
      }
      if (ws.role !== 'admin') return undefined; // màn hình OBS chỉ nhận, không ra lệnh
      Promise.resolve(onAdminMessage(message))
        .then((result) => send(ws, { t: 'reply', id: message.id, ok: true, ...(result || {}) }))
        .catch((error) => send(ws, { t: 'reply', id: message.id, ok: false, message: String(error?.message || error) }));
      return undefined;
    });
    onClientReady(ws);
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) ws.terminate();
      else {
        ws.alive = false;
        ws.ping();
      }
    }
  }, 30000);
  heartbeat.unref();

  return {
    handleUpgrade,
    send,
    broadcast(message, { adminsOnly = false } = {}) {
      const text = JSON.stringify(message);
      for (const ws of wss.clients) {
        if (ws.readyState === ws.OPEN && (!adminsOnly || ws.role === 'admin')) ws.send(text);
      }
    },
    close() {
      clearInterval(heartbeat);
      for (const ws of wss.clients) ws.terminate();
      wss.close();
    }
  };
}
