// Chủ kênh báo: đọc câu hỏi "lúc thì đọc hai lần, lúc thì đọc hai lần nhưng không hết câu".
//
// Nguyên nhân: mỗi lượt đọc chạy trong next() và nhả cờ `busy` khi xong. clear() (đổi chủ đề /
// bấm chuyển câu) huỷ lượt đang chạy, nhưng lượt đó vẫn đang `await` giọng tải về — lúc tỉnh dậy
// nó nhả cờ `busy` của LƯỢT MỚI đang đọc dở. Câu kế tiếp thấy "đang rảnh" nên đọc chồng lên:
// hai giọng cùng lúc, và cái bị stop() cắt ngang nghe như đọc cụt câu.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createSpeech } from '../public/stage/stage-speech.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.window = globalThis.window || {}; // stage-speech.js hỏi 'speechSynthesis' in window

/** AudioContext giả vừa đủ cho stage-speech.js, có đếm số giọng phát CÙNG LÚC. */
function fakeAudio({ playMs = 150 } = {}) {
  const state = { playing: 0, maxCùngLúc: 0, đãPhát: [] };
  const ctx = {
    createBufferSource() {
      const src = { buffer: null, onended: null, _timer: null, _done: false, connect: () => src };
      src.start = () => {
        state.playing += 1;
        state.maxCùngLúc = Math.max(state.maxCùngLúc, state.playing);
        state.đãPhát.push(src.buffer?.nhãn);
        src._timer = setTimeout(() => {
          if (src._done) return;
          src._done = true;
          state.playing -= 1;
          src.onended?.();
        }, playMs);
      };
      src.stop = () => {
        if (src._done) return;
        src._done = true;
        clearTimeout(src._timer);
        state.playing -= 1;
        src.onended?.();
      };
      return src;
    },
    createGain: () => ({ gain: { value: 1 }, connect: () => ({ connect: () => {} }) }),
    decodeAudioData: async () => ({ duration: 1, sampleRate: 1000, getChannelData: () => new Float32Array(1000).fill(0.5) })
  };
  return { ctx, state };
}

/** Giả /api/tts: mỗi câu mất `delay(nhãn)` mili-giây mới có giọng. */
function fakeFetch(delay) {
  globalThis.fetch = async (url) => {
    const text = decodeURIComponent(new URL(url, 'http://x').searchParams.get('text') || '');
    await sleep(delay(text));
    return { ok: true, arrayBuffer: async () => ({ nhãn: text }) };
  };
}

function makeSpeech(playMs, delay) {
  const { ctx, state } = fakeAudio({ playMs });
  fakeFetch(delay);
  // decodeAudioData trả buffer gắn nhãn để biết câu nào đang phát
  ctx.decodeAudioData = async (raw) => ({ duration: 1, sampleRate: 1000, nhãn: raw?.nhãn, getChannelData: () => new Float32Array(1000).fill(0.5) });
  const speech = createSpeech({ context: () => ctx, output: () => ({}), duck: () => {}, options: () => ({ gain: 1, voice: 'random' }) });
  return { speech, state };
}

test('clear() giữa chừng không được làm hai giọng đọc chồng lên nhau', async () => {
  // Câu A tải giọng chậm (80ms); B, C có ngay. Mỗi câu đọc 150ms.
  const { speech, state } = makeSpeech(150, (t) => (t === 'A' ? 80 : 1));

  speech.say('A');
  await sleep(5);
  speech.clear(); // chủ kênh đổi chủ đề / bấm chuyển câu
  speech.say('B'); // câu mới bắt đầu đọc
  await sleep(100); // câu A tỉnh dậy GIỮA LÚC B đang đọc
  speech.say('C');
  await sleep(500);

  assert.equal(state.maxCùngLúc, 1, `có ${state.maxCùngLúc} giọng đọc cùng lúc — đúng lỗi "đọc hai lần"`);
  assert.ok(!state.đãPhát.includes('A'), 'câu đã bị clear() huỷ thì không được đọc nữa');
});

test('đọc nhiều câu liên tiếp vẫn lần lượt, không chồng, không sót', async () => {
  const { speech, state } = makeSpeech(40, () => 1);
  for (const t of ['một', 'hai', 'ba', 'bốn']) speech.say(t);
  await sleep(600);
  assert.equal(state.maxCùngLúc, 1, 'phải đọc lần lượt');
  assert.deepEqual(state.đãPhát, ['một', 'hai', 'ba', 'bốn'], 'phải đọc đủ và đúng thứ tự');
});

test('clear() dừng hẳn giọng đang đọc', async () => {
  const { speech, state } = makeSpeech(400, () => 1);
  speech.say('dài');
  await sleep(60);
  assert.equal(state.playing, 1, 'phải đang đọc');
  speech.clear();
  await sleep(30);
  assert.equal(state.playing, 0, 'clear() phải cắt hẳn giọng đang đọc');
});
