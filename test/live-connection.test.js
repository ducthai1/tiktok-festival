import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyConnectError, CONNECT_TIMEOUT_MS, createLiveConnectionManager, PROBATION_WATCHDOG_MS, retryDelay, WATCHDOG_MS
} from '../src/live/live-connection-manager.js';

// Đồng hồ giả: chạy hẹn giờ theo ý, không phải chờ thật.
function fakeClock() {
  let t = 1_000_000;
  let seq = 0;
  const jobs = new Map();
  const add = (fn, ms, every) => {
    seq += 1;
    jobs.set(seq, { fn, at: t + ms, every });
    return seq;
  };
  return {
    now: () => t,
    timers: {
      setTimeout: (fn, ms) => add(fn, ms, 0),
      clearTimeout: (id) => jobs.delete(id),
      setInterval: (fn, ms) => add(fn, ms, ms),
      clearInterval: (id) => jobs.delete(id)
    },
    async advance(ms) {
      const end = t + ms;
      for (;;) {
        const due = [...jobs.entries()].filter(([, j]) => j.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        const [id, job] = due;
        t = job.at;
        if (job.every) job.at += job.every;
        else jobs.delete(id);
        job.fn();
        await new Promise((r) => setImmediate(r));
      }
      t = end;
      await new Promise((r) => setImmediate(r));
    }
  };
}

// Nguồn live giả: ghi lại các lần mở, cho test bắn sự kiện / tạm dừng / ngắt.
function fakeProvider({ hang = false, rooms = null } = {}) {
  const opened = [];
  const factory = (opts) => {
    const room = rooms ? rooms[Math.min(opened.length, rooms.length - 1)] : `room${opened.length}`;
    const inst = {
      opts,
      stopped: false,
      start: () => (hang ? new Promise(() => {}) : Promise.resolve({ roomId: room })),
      stop: async () => { inst.stopped = true; }
    };
    opened.push(inst);
    return inst;
  };
  return { opened, factory };
}

function setup(opts) {
  const clock = fakeClock();
  void PROBATION_WATCHDOG_MS;
  const p = fakeProvider(opts);
  const statuses = [];
  const events = [];
  const live = createLiveConnectionManager({
    providerFactories: { tiktok: p.factory }, onEvent: (e) => events.push(e), onStatus: (s) => statuses.push(s.state),
    timers: clock.timers, now: clock.now
  });
  return { clock, p, live, statuses, events };
}

const chat = (n) => ({ type: 'chat', id: `m${n}`, user: { id: 'u1', uniqueId: 'u1', nickname: 'A' }, comment: 'hi' });

test('live suspended (TikTok streamEnd action 4): reconnect after 4 s instead of stopping for good', async () => {
  const { clock, p, live } = setup();
  await live.connect('tangducne', 'tiktok');
  assert.equal(live.status().state, 'connected');
  p.opened[0].opts.onEnded('suspended');
  p.opened[0].opts.onDisconnected('mã 1000'); // thư viện bắn tiếp "disconnected" — không được tính thêm lần nữa
  assert.equal(live.status().state, 'reconnecting');
  assert.match(live.status().message, /4 giây/);
  await clock.advance(4000);
  assert.equal(p.opened.length, 2);
  assert.equal(live.status().state, 'connected');
  await live.disconnect();
});

test('live really ended: keep waiting for a new live, but slower (20 s, then 2 min after 10 min)', async () => {
  const { clock, p, live } = setup();
  await live.connect('tangducne', 'tiktok');
  p.opened[0].opts.onEnded('ended');
  assert.match(live.status().message, /20 giây/);
  assert.equal(retryDelay('ended', 11 * 60000, 30), 120000);
  await clock.advance(20000);
  assert.equal(p.opened.length, 2);
  await live.disconnect();
});

test('watchdog: "connected" but no data for 90 s → reconnect; regular data keeps it alive', async () => {
  const { clock, p, live, events } = setup();
  await live.connect('tangducne', 'tiktok');
  for (let i = 0; i < 12; i += 1) {
    await clock.advance(10000);
    p.opened[0].opts.onActivity();
  }
  await clock.advance(1); // qua 2 phút đầu: giờ mới dùng ngưỡng 90 s
  assert.equal(p.opened.length, 1); // 2 phút có dữ liệu đều: không nối lại
  p.opened[0].opts.emit(chat(1));
  assert.equal(events.length, 1);
  await clock.advance(WATCHDOG_MS + 10000); // lần canh chừng (mỗi 10 s) đầu tiên sau 90 s im lặng
  assert.equal(p.opened[0].stopped, true);
  assert.equal(live.status().state, 'reconnecting');
  await clock.advance(4000);
  assert.equal(p.opened.length, 2);
  assert.equal(live.status().state, 'connected');
  await live.disconnect();
});

test('a hanging connect gives up after 25 s and retries', async () => {
  const { clock, p, live } = setup({ hang: true });
  void live.connect('tangducne', 'tiktok');
  await new Promise((r) => setImmediate(r)); // để lệnh kết nối kịp đặt hẹn giờ
  await clock.advance(CONNECT_TIMEOUT_MS + 10);
  assert.equal(live.status().state, 'reconnecting');
  assert.match(live.status().message, /mạng|kết nối/i);
  await clock.advance(5000);
  assert.ok(p.opened.length >= 2);
  await live.disconnect();
});

test('a crash in game code drops that one event, the live connection stays', async () => {
  const clock = fakeClock();
  const p = fakeProvider();
  const live = createLiveConnectionManager({
    providerFactories: { tiktok: p.factory }, onStatus: () => {}, timers: clock.timers, now: clock.now,
    onEvent: () => { throw new Error('bug trong game'); }
  });
  await live.connect('tangducne', 'tiktok');
  assert.doesNotThrow(() => p.opened[0].opts.emit(chat(2)));
  assert.equal(live.status().state, 'connected');
  await live.disconnect();
});

test('connect errors are classified so the retry rhythm fits (offline / rate limit / blocked / network)', () => {
  assert.equal(classifyConnectError(new Error("The requested user isn't online :(")), 'offline');
  assert.equal(classifyConnectError(Object.assign(new Error('x'), { name: 'SignatureRateLimitError' })), 'ratelimit');
  assert.equal(classifyConnectError(new Error('Failed to retrieve Room ID from all sources')), 'blocked');
  assert.equal(classifyConnectError(new Error('connect ETIMEDOUT')), 'network');
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((f) => retryDelay('ratelimit', 0, f) / 1000), [30, 60, 120, 240, 300, 300]);
  assert.equal(retryDelay('suspended', 60000, 3), 4000);
});

test('live restarted: TikTok still returns the ended room → do not stay on it, look up again until the new room appears', async () => {
  const { clock, p, live } = setup({ rooms: ['old', 'old', 'new'] });
  await live.connect('tangducne', 'tiktok');
  p.opened[0].opts.onEnded('ended'); // chủ kênh tắt live
  await clock.advance(20000); // tra lại: TikTok vẫn trả "old"
  assert.equal(p.opened.length, 2);
  assert.equal(live.status().state, 'reconnecting');
  await clock.advance(20000); // lần sau ra phòng mới
  assert.equal(p.opened.length, 3);
  assert.equal(live.status().state, 'connected');
  assert.equal(live.status().roomId, 'new');
  await live.disconnect();
});

test('manual "Kết nối" right after going live again: a silent new connection is retried after 30 s, not 90 s', async () => {
  const { clock, p, live } = setup();
  await live.disconnect();
  await live.connect('tangducne', 'tiktok'); // bấm Kết nối trên trang điều khiển
  await clock.advance(PROBATION_WATCHDOG_MS + 1000); // không có gói tin nào
  assert.equal(live.status().state, 'reconnecting');
  await clock.advance(4000);
  assert.equal(p.opened.length, 2);
  await live.disconnect();
});
