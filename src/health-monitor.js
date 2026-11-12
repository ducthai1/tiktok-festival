// Sức khoẻ server mỗi phút: độ trễ vòng sự kiện (server có bị nghẽn khi phòng đông không), RAM, CPU.
// Sự cố 11–12/11 trùng lúc mắt xem tăng vọt — dòng này cho biết lần sau server có quá tải hay không.
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { log } from './logger.js';

const EVERY_MS = 60000;
const LAG_WARN_MS = 250;

export function startHealthMonitor({ extra = () => ({}) } = {}) {
  const loop = monitorEventLoopDelay({ resolution: 20 });
  loop.enable();
  let lastCpu = process.cpuUsage();
  let lastAt = Date.now();
  const timer = setInterval(() => {
    const ms = (ns) => Math.round(ns / 1e6);
    const p99 = ms(loop.percentile(99));
    const cpu = process.cpuUsage(lastCpu);
    const elapsed = Date.now() - lastAt;
    lastCpu = process.cpuUsage();
    lastAt = Date.now();
    const mem = process.memoryUsage();
    const line = `độ trễ xử lý p50 ${ms(loop.percentile(50))}ms · p99 ${p99}ms · tối đa ${ms(loop.max)}ms · CPU ${Math.round(((cpu.user + cpu.system) / 1000 / elapsed) * 100)}%`
      + ` · RAM ${Math.round(mem.rss / 1048576)}MB (heap ${Math.round(mem.heapUsed / 1048576)}MB)`;
    const more = Object.entries(extra()).map(([k, v]) => `${k} ${v}`).join(' · ');
    (p99 >= LAG_WARN_MS ? log.warn : log.info)('health', `${line}${more ? ` · ${more}` : ''}${p99 >= LAG_WARN_MS ? ' — SERVER ĐANG NGHẼN' : ''}`);
    loop.reset();
  }, EVERY_MS);
  timer.unref();
  return () => {
    clearInterval(timer);
    loop.disable();
  };
}
