// WebSocket tự nối lại (dùng cho cả màn hình OBS và trang điều khiển).
export function connectLiveSocket({ onMessage, onOpen, onClose }) {
  let socket = null;
  let delay = 500;
  let pending = new Map();
  let seq = 0;

  function open() {
    socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
    socket.addEventListener('open', () => {
      delay = 500;
      onOpen?.();
    });
    socket.addEventListener('message', (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.t === 'reply' && pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
      }
      onMessage(message);
    });
    socket.addEventListener('close', () => {
      onClose?.();
      for (const resolve of pending.values()) resolve({ ok: false, message: 'Mất kết nối' });
      pending = new Map();
      setTimeout(open, delay);
      delay = Math.min(delay * 2, 5000);
    });
  }
  open();

  return {
    send(message) {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    },
    request(message) {
      return new Promise((resolve) => {
        if (socket?.readyState !== WebSocket.OPEN) return resolve({ ok: false, message: 'Chưa kết nối server' });
        const id = (seq += 1);
        pending.set(id, resolve);
        socket.send(JSON.stringify({ ...message, id }));
        setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id);
            resolve({ ok: false, message: 'Server không trả lời' });
          }
        }, 20000);
      });
    }
  };
}
