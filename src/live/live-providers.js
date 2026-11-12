// Hai nguồn sự kiện LIVE. Cả hai chỉ ĐỌC phòng live công khai:
// - "tiktok": thư viện tiktok-live-connector, không cần cookie/mật khẩu.
// - "tikfinity": app TikFinity Desktop đã đăng nhập sẵn, phát lại qua ws://127.0.0.1:21213.
// Không bao giờ hỏi/lưu sessionid, cookie hay mật khẩu TikTok của streamer.
import { TikTokLiveConnection } from 'tiktok-live-connector';
import WebSocket from 'ws';
import { normalizeConnectorEvent, normalizeGiftCatalog } from './normalize-tiktok-connector.js';
import { normalizeTikFinityMessage } from './normalize-tikfinity.js';

const CONNECTOR_EVENTS = ['chat', 'gift', 'like', 'member', 'follow', 'share', 'roomUser'];

export function createTikTokConnectorProvider({ username, apiKey, emit, onCatalog = () => {}, onDisconnected, onEnded }) {
  let connection = null;
  return {
    async start() {
      connection = new TikTokLiveConnection(username, {
        signApiKey: apiKey,
        processInitialData: false, // bỏ chat cũ trước lúc kết nối, tránh tính lại
        // KHÔNG tải danh mục quà lúc kết nối: dịch vụ ký Euler bắt gói Business cho việc này và làm hỏng
        // cả lệnh kết nối (đo 03/11). Mỗi sự kiện quà đã kèm tên + giá + ảnh; danh mục gom dần từ đó.
        enableExtendedGiftInfo: false
      });
      // EventEmitter coi 'error' không có người nghe là lỗi chết; giữ server sống.
      // Lọc bỏ lỗi phụ (fetch quà, v.v.) — những lỗi đó có .catch riêng, không phải lỗi kết nối.
      const GIFT_ERRORS = ['Failed to fetch room gifts.', 'Failed to fetch room gift gallery.'];
      connection.on('error', (error) => {
        if (GIFT_ERRORS.includes(error?.info)) return;
        const msg = error?.exception?.message || error?.message || error;
        if (!/UserOffline/i.test(msg)) console.warn('[tiktok] lỗi:', msg);
      });
      for (const type of CONNECTOR_EVENTS) {
        connection.on(type, (data) => emit(normalizeConnectorEvent(type, data)));
      }
      connection.on('streamEnd', () => onEnded());
      connection.on('disconnected', () => onDisconnected('mất kết nối'));
      const state = await connection.connect();
      // thử lấy cả danh mục quà của phòng (cần khoá Euler gói cao); không được thì thôi, không ảnh hưởng kết nối
      connection.fetchAvailableGifts().then((raw) => {
        const catalog = normalizeGiftCatalog(raw);
        if (catalog.length) onCatalog(catalog);
      }).catch((error) => console.warn('[tiktok] chưa lấy được danh mục quà (sẽ gom dần từ quà nhận được):', error?.message || error));
      return { roomId: String(state?.roomId || '') };
    },
    async stop() {
      const current = connection;
      connection = null;
      if (current) {
        current.removeAllListeners();
        current.on('error', () => {});
        await current.disconnect().catch(() => {});
      }
    }
  };
}

export function createTikFinityProvider({ url, emit, onDisconnected }) {
  let socket = null;
  return {
    start() {
      const target = new URL(url);
      // TikFinity chạy trên cùng máy; không cho trỏ ra máy khác để tránh lộ dữ liệu.
      if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)) {
        return Promise.reject(new Error('TIKFINITY_WS_URL phải là địa chỉ trên máy này'));
      }
      return new Promise((resolve, reject) => {
        socket = new WebSocket(url, { maxPayload: 512 * 1024, handshakeTimeout: 8000 });
        let opened = false;
        socket.on('open', () => {
          opened = true;
          resolve({ roomId: 'tikfinity' });
        });
        socket.on('message', (payload) => {
          for (const event of normalizeTikFinityMessage(payload)) emit(event);
        });
        socket.on('error', (error) => {
          if (!opened) reject(new Error(`Không mở được TikFinity: ${error.message}`));
        });
        socket.on('close', () => {
          if (opened) onDisconnected('TikFinity đã đóng');
        });
      });
    },
    async stop() {
      const current = socket;
      socket = null;
      if (current) {
        current.removeAllListeners();
        current.on('error', () => {});
        current.close();
      }
    }
  };
}
