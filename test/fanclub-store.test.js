import assert from 'node:assert/strict';
import fsp from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createFanClubStore } from '../src/live/fanclub-store.js';

test('fanclub store: marks fanClub and fanLevel, survives restart and learns new fans', () => {
  const dir = fsp.mkdtempSync(path.join(os.tmpdir(), 'fanclub-'));
  const store = createFanClubStore(dir, { saveDelayMs: 0 });

  // Học người mới khi có cờ fanClub từ TikTok
  const newFan = { type: 'gift', user: { id: '888', nickname: 'NewFan', fanClub: true, fanLevel: 5 } };
  store.mark(newFan);
  assert.equal(store.has('888'), true);
  assert.equal(store.get('888').fanLevel, 5);

  store.flush();

  // Khởi động lại: vẫn nhớ newFan
  const store2 = createFanClubStore(dir);
  const ev2 = { type: 'member', user: { id: '888', nickname: 'NewFan' } };
  store2.mark(ev2);
  assert.equal(ev2.user.fanClub, true);
  assert.equal(ev2.user.fanLevel, 5);
});
