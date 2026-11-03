// Gọi obs-websocket (OBS 28+, cổng 4455) bằng mật khẩu đọc từ cấu hình OBS trên chính máy này.
// Dùng: node scripts/obs-ws.mjs <RequestType> ['<json requestData>'] [ảnh-ra.png]
// Ví dụ:
//   node scripts/obs-ws.mjs GetStreamStatus
//   node scripts/obs-ws.mjs GetSourceScreenshot '{"sourceName":"Game","imageFormat":"png","imageWidth":1080}' /tmp/xem.png
//   node scripts/obs-ws.mjs PressInputPropertiesButton '{"inputName":"Màn game (chùa / bar / bơi)","propertyName":"refreshnocache"}'
// Chụp qua OBS là cách kiểm hình AN TOÀN khi đang live (không mở thêm trình duyệt dùng card đồ hoạ).
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';

const CONFIGS = [
  path.join(os.homedir(), '.var/app/com.obsproject.Studio/config/obs-studio/plugin_config/obs-websocket/config.json'), // OBS flatpak
  path.join(os.homedir(), '.config/obs-studio/plugin_config/obs-websocket/config.json') // OBS cài thường
];
const [type, dataJson = '{}', out] = process.argv.slice(2);
if (!type) {
  console.error('Dùng: node scripts/obs-ws.mjs <RequestType> [json] [ảnh-ra.png]');
  process.exit(2);
}
const configFile = CONFIGS.find((file) => fs.existsSync(file));
const password = configFile ? JSON.parse(fs.readFileSync(configFile, 'utf8')).server_password || '' : '';
const ws = new WebSocket(`ws://127.0.0.1:${process.env.OBS_PORT || 4455}`);
const timer = setTimeout(() => { console.error('OBS không trả lời (OBS đã mở chưa? WebSocket đã bật chưa?)'); process.exit(1); }, 15000);
ws.on('error', (error) => { console.error(`Không nối được OBS: ${error.message}`); process.exit(1); });
ws.on('message', (raw) => {
  const m = JSON.parse(raw);
  if (m.op === 0) {
    const identify = { rpcVersion: 1 };
    if (m.d.authentication) {
      const { salt, challenge } = m.d.authentication;
      const secret = crypto.createHash('sha256').update(password + salt).digest('base64');
      identify.authentication = crypto.createHash('sha256').update(secret + challenge).digest('base64');
    }
    ws.send(JSON.stringify({ op: 1, d: identify }));
  } else if (m.op === 2) {
    ws.send(JSON.stringify({ op: 6, d: { requestType: type, requestId: '1', requestData: JSON.parse(dataJson) } }));
  } else if (m.op === 7) {
    const data = m.d.responseData || {};
    if (out && data.imageData) {
      fs.writeFileSync(out, Buffer.from(data.imageData.split(',')[1], 'base64'));
      console.log(`đã lưu ảnh: ${out}`);
    } else {
      console.log(JSON.stringify(m.d.requestStatus), JSON.stringify(data).slice(0, 2000));
    }
    clearTimeout(timer);
    ws.close();
  }
});
