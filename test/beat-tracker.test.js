// Chủ kênh 21/11/2026: "cái nhảy theo nhịp nhạc đó có áp dụng với nhạc thêm custom từ link YouTube chưa — đồng bộ theo luôn
// mới chuẩn". Trước đó bài tự thêm KHÔNG có nhịp nào: nhân vật nhảy theo đồng hồ giả 128 BPM. Giờ màn hình tự nghe bài đang
// phát để khoá nhịp (stage-beat-core.js + stage-beat-follow.js). Ở đây dựng nhạc giả có trống ở đúng chỗ biết trước rồi
// cho bộ dò nghe y như trong trình duyệt (khối 128 mẫu, lô 10 khung) để soát nhịp + vị trí phách.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createBeatLock, createOnsetDetector, estimateBeat } from '../public/stage/stage-beat-core.js';
import { createBeatFollower } from '../public/stage/stage-beat-follow.js';

function prng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Nhạc giả: trống kick mỗi phách, hi-hat giữa phách, hợp âm nền + tiếng ồn. parts: [{ bpm, seconds }] nối nhau. */
function song({ parts, first = 0.3, sr = 44100, noise = 0.03, seed = 1 }) {
  const random = prng(seed);
  const total = parts.reduce((s, p) => s + p.seconds, 0);
  const pcm = new Float32Array(Math.round(total * sr));
  for (let i = 0; i < pcm.length; i += 1) {
    const t = i / sr;
    pcm[i] = noise * (random() * 2 - 1) + 0.08 * (Math.sin(2 * Math.PI * 110 * t) + 0.6 * Math.sin(2 * Math.PI * 164.8 * t));
  }
  const beats = [];
  let begin = 0;
  let at = first;
  for (const { bpm, seconds } of parts) {
    const spb = 60 / bpm;
    for (; at < begin + seconds; at += spb) {
      beats.push(at);
      const k0 = Math.round(at * sr);
      for (let i = 0; i < 0.25 * sr && k0 + i < pcm.length; i += 1) {
        const t = i / sr;
        pcm[k0 + i] += 0.8 * Math.exp(-t / 0.12) * Math.sin(2 * Math.PI * (45 * t + 3 * (1 - Math.exp(-t / 0.03))));
      }
      const h0 = Math.round((at + spb / 2) * sr);
      for (let i = 0; i < 0.05 * sr && h0 + i < pcm.length; i += 1) pcm[h0 + i] += 0.25 * Math.exp(-i / sr / 0.015) * (random() * 2 - 1);
    }
    begin += seconds;
  }
  return { pcm, beats, sr };
}

const lechPhach = (beat) => Math.abs(beat - Math.round(beat));

test('đo đúng nhịp + vị trí phách của nhạc có trống, mọi tần số mẫu của card âm thanh', () => {
  for (const [bpm, first, sr] of [[128, 0.3, 44100], [128, 0.3, 48000], [100, 0.11, 44100], [140, 0.42, 48000], [92, 0.2, 44100]]) {
    const { pcm, beats } = song({ parts: [{ bpm, seconds: 24 }], first, sr });
    const detector = createOnsetDetector(sr);
    const env = [];
    for (let i = 0; i < pcm.length; i += 128) env.push(...detector.push(pcm.subarray(i, i + 128)));
    const result = estimateBeat(env, detector.rate);
    assert.ok(Math.abs(result.bpm - bpm) < 0.15, `${bpm} BPM đo ra ${result.bpm.toFixed(2)}`);
    assert.ok(result.confidence > 3, `phách rõ mà độ tin chỉ ${result.confidence.toFixed(2)}`);
    const firstBeat = detector.timeOf(0) + result.phase;
    for (const b of beats.filter((t) => t > 1)) {
      const beat = ((b - firstBeat) * result.bpm) / 60;
      assert.ok(lechPhach(beat) * (60 / bpm) < 0.015, `${bpm} BPM: trống ở ${b.toFixed(2)} s lệch phách tính ra > 15 ms`);
    }
  }
});

test('tiếng ồn không có nhịp → độ tin thấp, không được khoá bừa', () => {
  const random = prng(9);
  const pcm = Float32Array.from({ length: 44100 * 24 }, () => (random() * 2 - 1) * 0.3);
  const detector = createOnsetDetector(44100);
  const result = estimateBeat(detector.push(pcm), detector.rate);
  assert.ok(!result || result.confidence < 1.5, `ồn trắng mà độ tin ${result?.confidence.toFixed(2)}`);
});

test('khoá nhịp: đổi số đo thì phách vẫn liền mạch rồi trượt dần về lưới mới, không nhảy cóc', () => {
  const lock = createBeatLock({ glideS: 2 });
  lock.set({ bpm: 120, firstBeat: 0 }, 0, { smooth: false });
  assert.equal(lock.beat(10), 20);
  lock.set({ bpm: 120, firstBeat: 0.2 }, 10); // lưới mới chậm 0,4 phách
  assert.ok(Math.abs(lock.beat(10) - 20) < 1e-9, 'ngay lúc đổi phải giữ nguyên số phách');
  let prev = lock.beat(10);
  for (let t = 10 + 1 / 30; t < 13; t += 1 / 30) {
    const now = lock.beat(t);
    assert.ok(now - prev > 0 && now - prev < (2 / 30) * 1.25, 'mỗi khung tiến đều, không giật');
    prev = now;
  }
  assert.ok(lechPhach(lock.beat(12.2) - ((12.2 - 0.2) * 120) / 60) < 1e-9, 'sau 2 s phải nằm đúng lưới mới');
});

/** Phát `pcm` qua bộ bám nhịp y như trình duyệt: AudioContext chạy trước bài 5 s, khối 128 mẫu, lô 10 khung. */
function phat(pcm, sr, { key = '/api/music-file/abc', seed, storage = new Map(), onFrame } = {}) {
  const store = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) };
  const ctx = { currentTime: 5, state: 'running' };
  const media = { currentTime: 0, paused: false, seeking: false, ended: false };
  const follower = createBeatFollower(ctx, null, media, { key: () => key, seed, storage: store });
  const detector = createOnsetDetector(sr);
  let frames = 0;
  let batch = [];
  let batchFirst = 0;
  let nextFrameAt = 0;
  for (let i = 0; i < pcm.length; i += 128) {
    media.currentTime = (i + 128) / sr;
    ctx.currentTime = 5 + media.currentTime;
    for (const value of detector.push(pcm.subarray(i, i + 128))) {
      if (!batch.length) batchFirst = frames;
      batch.push(value);
      frames += 1;
    }
    if (batch.length >= 10) {
      follower.onFrames({ at: 5 + detector.timeOf(batchFirst), rate: detector.rate, values: batch });
      batch = [];
    }
    if (media.currentTime >= nextFrameAt) { // cảnh hỏi phách ~30 lần/giây
      nextFrameAt += 1 / 30;
      onFrame?.(media.currentTime, follower.beat(), follower);
    }
  }
  return { follower, storage };
}

test('bài YouTube tự thêm: nghe ~8–11 giây là khoá đúng nhịp, phách trùng tiếng trống, lần sau phát lại vào đúng ngay', () => {
  const { pcm, beats, sr } = song({ parts: [{ bpm: 128, seconds: 30 }], first: 0.37 });
  let lockedAt = null;
  const { follower, storage } = phat(pcm, sr, {
    onFrame: (t, beat) => {
      if (t < 7.5) assert.equal(beat, null, 'chưa nghe đủ mà đã khoá');
      if (beat !== null && lockedAt === null) lockedAt = t;
    }
  });
  assert.ok(lockedAt !== null && lockedAt < 12, `khoá quá muộn: ${lockedAt}`);
  assert.ok(Math.abs(follower.bpm() - 128) < 0.1, `nhịp khoá ${follower.bpm()}`);
  const lock = follower.info();
  for (const b of beats.filter((t) => t > lockedAt)) {
    const beat = ((b - lock.firstBeat) * lock.bpm) / 60;
    assert.ok(lechPhach(beat) * (60 / 128) < 0.015, `trống ở ${b.toFixed(2)} s lệch phách > 15 ms`);
  }
  assert.equal(storage.size, 1, 'phải nhớ nhịp của bài');

  // lần sau phát lại bài đó: có phách ngay từ giây đầu, không phải chờ đo
  const again = createBeatFollower({ currentTime: 0, state: 'running' }, null, { currentTime: 0.5, paused: false }, {
    key: () => '/api/music-file/abc', storage: { getItem: (k) => storage.get(k) ?? null, setItem() {} }
  });
  assert.ok(again.beat() !== null && Math.abs(again.bpm() - 128) < 0.1);
});

test('nhạc gốc ghi sai BPM (136 thay vì 135 như đo lại 21/11) → tự chỉnh về 135, nhân vật không giật khung lúc chỉnh', () => {
  const { pcm, beats, sr } = song({ parts: [{ bpm: 135, seconds: 40 }], first: 0.128 });
  let prev = null;
  const { follower } = phat(pcm, sr, {
    seed: () => ({ bpm: 136, firstBeat: 0.128 }),
    onFrame: (t, beat) => {
      assert.ok(beat !== null, 'nhạc gốc có số đo sẵn thì phải có phách ngay từ đầu');
      if (prev !== null) {
        const step = beat - prev;
        assert.ok(step > 0 && step < (136 / 60 / 30) * 1.4, `phách nhảy ${step.toFixed(3)} ở ${t.toFixed(2)} s`);
      }
      prev = beat;
    }
  });
  assert.ok(Math.abs(follower.bpm() - 135) < 0.1, `vẫn giữ nhịp ghi sai: ${follower.bpm()}`);
  const lock = follower.info();
  for (const b of beats.filter((t) => t > 30)) {
    const beat = ((b - lock.firstBeat) * lock.bpm) / 60;
    assert.ok(lechPhach(beat) * (60 / 135) < 0.015, `cuối bài trống ở ${b.toFixed(2)} s vẫn lệch phách`);
  }
});

test('video dài nhiều bài nối nhau: sang bài nhịp khác thì đổi theo, nhưng chỉ sau 3 lần đo liền cùng ra nhịp mới', () => {
  const { pcm, sr } = song({ parts: [{ bpm: 128, seconds: 36 }, { bpm: 140, seconds: 36 }], first: 0.2 });
  let firstHeard = null; // lần đo đầu tiên nghe ra 140
  let switched = null; // lần đo mà nhịp khoá chuyển sang 140
  phat(pcm, sr, {
    onFrame: (t, _beat, f) => {
      const { measures, last } = f.info();
      if (t < 36) assert.ok(Math.abs(f.bpm() - 128) < 0.2 || f.bpm() === null, `phần đầu ${f.bpm()}`);
      if (firstHeard === null && last && Math.abs(last.bpm - 140) < 0.3) firstHeard = measures;
      if (switched === null && Math.abs(f.bpm() - 140) < 0.2) switched = measures;
    }
  });
  assert.ok(firstHeard !== null && switched !== null, 'phần sau không theo nhịp mới');
  assert.ok(switched - firstHeard >= 2, `đổi nhịp ngay khi mới nghe ${switched - firstHeard + 1} lần — một lần đo lạc cũng đủ làm đổi`);
});

test('bài không có trống rõ (chỉ ồn) → không bao giờ khoá, cảnh giữ đồng hồ cũ', () => {
  const random = prng(5);
  const pcm = Float32Array.from({ length: 44100 * 30 }, () => (random() * 2 - 1) * 0.3);
  phat(pcm, 44100, { onFrame: (t, beat) => assert.equal(beat, null, `ồn mà khoá nhịp ở ${t.toFixed(1)} s`) });
});
