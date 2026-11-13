import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { startApp } from '../src/app.js';
import { createEnglishTts, createVoiceRotation, EN_VOICES, speakableEnglish } from '../src/tts/english-tts.js';
import { englishVoiceInstalled } from '../src/tts/english-voice-setup.js';
import { createQuizGame, LIGHTNING_QUESTIONS } from '../src/games/quiz/quiz-game.js';
import { createQuizGames } from '../src/games/quiz/quiz-games.js';
import { loadEnglishQuestions, loadEnglishSets, loadWordleWords } from '../src/games/quiz/quiz-bank.js';
import { audibleRange } from '../public/stage/stage-speech.js';

const made = [];
const tmp = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-en-'));
  made.push(dir);
  return dir;
};
after(() => { for (const dir of made) fs.rmSync(dir, { recursive: true, force: true }); }); // không để rác trong thư mục tạm
const fakeMp3 = (tag) => Buffer.concat([Buffer.from('ID3'), Buffer.alloc(600, tag.length)]);
/** edge-tts giả: ghi file như edge-tts thật, ghi lại các lần gọi. */
function fakeSynth({ fail = false } = {}) {
  const calls = [];
  const synth = async (job) => {
    calls.push(job);
    if (fail) throw new Error('Invalid response status 403');
    fs.writeFileSync(job.file, fakeMp3(job.text + job.voice + job.rate));
  };
  return { calls, synth };
}

test('english voice: bank answers are rewritten for a native reader (lower case, acronyms, apostrophes)', () => {
  const cases = {
    'DON T HOLD YOUR BREATH': "don't hold your breath", 'PULL SOMEONE S LEG': "pull someone's leg", 'YOU RE ON A ROLL': "you're on a roll",
    'BALLON D OR': "ballon d'Or", 'STUDENT ID': 'student ID', 'LET IT GO': 'let it go', 'R&B': 'R&B', '4K': '4K',
    'FIRST-YEAR STUDENT': 'first-year student', 'PRONUNCIATION': 'pronunciation', state: 'state'
  };
  for (const [answer, spoken] of Object.entries(cases)) assert.equal(speakableEnglish(answer), spoken, answer);
});

test('english voice: every English answer in the banks (topics, sets, wordle) can be read', async () => {
  const answers = [...loadEnglishQuestions().map((q) => q.answer), ...Object.values(loadEnglishSets()).flat().map((q) => q.answer), ...loadWordleWords().answers];
  assert.ok(answers.length > 6000);
  const { calls, synth } = fakeSynth();
  const tts = createEnglishTts({ dataDir: tmp(), synthesize: synth });
  const sample = answers.filter((_, i) => i % 97 === 0);
  const clips = await Promise.all(sample.map((a) => tts.clip(a)));
  assert.equal(clips.filter(Boolean).length, sample.length - sample.filter((a) => a === 'CAVE').length); // "cave" bị bộ lọc từ lóng chặn ở màn hình
  assert.equal(calls.length, sample.length);
  for (const a of answers) {
    const s = speakableEnglish(a);
    assert.ok(s.length <= 60 && /^[A-Za-z0-9][A-Za-z0-9 '&.-]*$/.test(s), a);
  }
});

test('english voice rotation: male and female alternate, no voice repeats within 3 words, all 8 voices get used', () => {
  let seed = 1;
  const next = createVoiceRotation(() => ((seed = (seed * 16807) % 2147483647) / 2147483647));
  const female = new Map(EN_VOICES.map((v) => [v.id, v.female]));
  const picks = Array.from({ length: 200 }, next);
  for (let i = 1; i < picks.length; i += 1) {
    assert.notEqual(female.get(picks[i]), female.get(picks[i - 1]), `lượt ${i}`);
    assert.ok(!picks.slice(Math.max(0, i - 3), i).includes(picks[i]), `lượt ${i}`);
  }
  assert.equal(new Set(picks).size, EN_VOICES.length);
});

test('english voice: question start prepares normal + slow clips in the same voice; cached clips never hit the network again', async () => {
  const { calls, synth } = fakeSynth();
  const dataDir = tmp();
  const tts = createEnglishTts({ dataDir, synthesize: synth });
  tts.prefetch('STRAWBERRY');
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(calls.map((c) => c.rate), ['+0%', '-35%']);
  assert.equal(calls[0].voice, calls[1].voice);
  assert.equal(calls[0].voice, tts.voiceFor('STRAWBERRY'));
  const [normal, slow] = await Promise.all([tts.clip('STRAWBERRY'), tts.clip('strawberry', { slow: true })]);
  assert.ok(normal.length > 500 && slow.length > 500);
  assert.equal(calls.length, 2); // lấy từ đệm
  assert.equal(fs.readdirSync(path.join(dataDir, 'tts-cache-en')).filter((f) => f.endsWith('.mp3')).length, 2);
  // khởi động lại server: đệm trên đĩa vẫn dùng được
  const again = createEnglishTts({ dataDir, synthesize: synth });
  assert.ok(await again.clip('STRAWBERRY', { voice: calls[0].voice }));
  assert.equal(calls.length, 2);
});

test('english voice: after 3 failures in a row it pauses for a minute instead of spawning edge-tts for every word', async () => {
  let clock = 0;
  const { calls, synth } = fakeSynth({ fail: true });
  const dataDir = tmp();
  const tts = createEnglishTts({ dataDir, synthesize: synth, now: () => clock });
  for (const w of ['one', 'two', 'three']) assert.equal(await tts.clip(w), null);
  assert.equal(calls.length, 3);
  assert.equal(tts.status().paused, true);
  assert.equal(await tts.clip('four'), null);
  assert.equal(calls.length, 3); // đang nghỉ
  clock += 61000;
  assert.equal(await tts.clip('five'), null);
  assert.equal(calls.length, 4); // hết nghỉ thì thử lại
  assert.deepEqual(fs.readdirSync(path.join(dataDir, 'tts-cache-en')), []); // không để lại file tạm
});

test('english voice: not installed → no clip and no crash; a stale install (requirements changed) counts as not installed', async () => {
  const envDir = tmp();
  const tts = createEnglishTts({ dataDir: tmp(), envDir, setup: async () => { throw new Error('không có mạng'); } });
  assert.equal(await tts.clip('apple'), null);
  assert.equal(tts.status().installed, false);
  fs.writeFileSync(path.join(envDir, 'tiktok-live-games.json'), JSON.stringify({ requirements: 'cũ', edgeTts: '7.0.0' }));
  assert.equal(englishVoiceInstalled(envDir), false);
});

test('quiz: English and Wordle tabs hand the answer to the voice at question start and to the screen only at reveal', () => {
  const asked = [];
  const games = createQuizGames({ onEnglishAnswer: (w) => asked.push(w) });
  for (const id of ['english', 'wordle']) {
    const game = games.find((g) => g.id === id);
    const fx = game.tick(0);
    const question = fx.find((f) => f.kind === 'quizQuestion');
    assert.ok(question && !('answerEn' in question)); // không lộ đáp án lúc ra đề
    const reveal = game.command('next', 100).find((f) => f.kind === 'quizReveal');
    assert.equal(reveal.answerEn, asked.at(-1), id);
    assert.equal(reveal.answerEnSlow, true);
  }
  assert.equal(asked.length, 2);
  // các tab tiếng Việt không đọc tiếng Anh
  const vn = games.find((g) => g.id === 'lophoc');
  vn.tick(0);
  assert.equal(vn.command('next', 100).find((f) => f.kind === 'quizReveal').answerEn, undefined);
  assert.equal(asked.length, 2);
});

test('quiz: lightning reveals are short, so the English word is read once (slow repeat only on the last one)', () => {
  const words = Array.from({ length: 8 }, (_, i) => ({ kind: 'text', category: 'T', answer: `WORD${i}`, prompt: '?', accept: [`word${i}`] }));
  const game = createQuizGame({ id: 't', title: 'T', deck: { next: () => words.shift() }, pronounce: (q) => q.answer });
  game.tick(0);
  game.handleEvent({ type: 'like', user: { id: 'u', nickname: 'U' }, likeCount: 400 }, 10);
  game.command('next', 20); // lật câu đang hỏi
  const slow = [];
  for (let i = 0; i < LIGHTNING_QUESTIONS; i += 1) {
    game.command('next', 30 + i * 20);
    slow.push(game.command('next', 40 + i * 20).find((f) => f.kind === 'quizReveal').answerEnSlow);
  }
  assert.deepEqual(slow, [false, false, true]);
});

test('stage: the long silence Microsoft leaves around each word is trimmed (a little padding kept)', () => {
  const rate = 24000;
  const data = new Float32Array(rate * 2); // 2 giây: lặng 0,2 s — tiếng 0,6 s — lặng 1,2 s
  for (let i = rate * 0.2; i < rate * 0.8; i += 1) data[i] = Math.sin(i / 5) * 0.5;
  const range = audibleRange({ getChannelData: () => data, sampleRate: rate, duration: 2 });
  assert.ok(Math.abs(range.offset - 0.16) < 0.01, range.offset);
  assert.ok(Math.abs(range.offset + range.duration - 0.95) < 0.01, range.duration);
  const silent = audibleRange({ getChannelData: () => new Float32Array(rate), sampleRate: rate, duration: 1 });
  assert.ok(silent.duration > 0 && silent.offset + silent.duration <= 1);
});

function get(port, urlPath) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: urlPath, headers: { Host: `127.0.0.1:${port}` } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

test('GET /api/tts-en: mp3 for English words only, voice reported, bad input refused', async (t) => {
  const dataDir = tmp();
  const { synth } = fakeSynth();
  const config = { port: 0, host: '127.0.0.1', allowLan: false, provider: 'tiktok', startGame: 'english' };
  const app = await startApp(config, { dataDir, tickMs: 50, englishSynth: synth,
    providerFactories: { tiktok: () => ({ start: async () => ({ roomId: '1' }), stop: async () => {} }) } });
  t.after(async () => {
    await app.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  const ok = await get(app.port, '/api/tts-en?text=DON%20T%20GIVE%20UP&slow=1');
  assert.equal(ok.status, 200);
  assert.equal(ok.headers['content-type'], 'audio/mpeg');
  assert.ok(EN_VOICES.some((v) => v.id === ok.headers['x-voice']));
  const fixed = await get(app.port, '/api/tts-en?text=apple&voice=en-GB-RyanNeural');
  assert.equal(fixed.headers['x-voice'], 'en-GB-RyanNeural');
  for (const bad of ['', 'xin%20chào', '<script>', 'a'.repeat(61), '-rf', 'cave']) {
    assert.equal((await get(app.port, `/api/tts-en?text=${bad}`)).status, 400, bad);
  }
});

test('GET /api/tts-en without the voice (tests / no npm start) answers 503, never crashes', async (t) => {
  const dataDir = tmp();
  const config = { port: 0, host: '127.0.0.1', allowLan: false, provider: 'tiktok', startGame: 'bar' };
  const app = await startApp(config, { dataDir, tickMs: 50, providerFactories: { tiktok: () => ({ start: async () => ({ roomId: '1' }), stop: async () => {} }) } });
  t.after(async () => {
    await app.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  assert.equal((await get(app.port, '/api/tts-en?text=apple')).status, 503);
});
