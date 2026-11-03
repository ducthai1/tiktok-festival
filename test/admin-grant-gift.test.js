import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdminCommandHandler, presentPeople } from '../src/admin-command-handler.js';
import { SAMPLE_GIFTS } from '../public/shared/gift-tiers.js';

const people = [{ id: 'u1', nickname: 'Người một', avatar: '' }, { id: 'u2', nickname: 'Người hai', avatar: '' }];

function setup() {
  const ingested = [];
  const handle = createAdminCommandHandler({
    hub: { snapshot: () => ({ state: { devotees: people } }) },
    live: { ingest: (raw, opts) => { ingested.push({ raw, opts }); return raw; }, isLive: () => true },
    settings: {}, updateSettings() {}, emitFx() {}, pushState() {}, getSampleGifts: () => SAMPLE_GIFTS
  });
  return { handle, ingested };
}

test('the host can give a present person the effect of a gift, even while live', async () => {
  const { handle, ingested } = setup();
  const reply = await handle({ t: 'grant', userId: 'u2', giftId: 'lion' });
  assert.match(reply.message, /Sư tử/);
  assert.equal(ingested.length, 1);
  assert.equal(ingested[0].opts.simulated, false); // như quà thật: không bật nhãn CHẾ ĐỘ THỬ
  assert.equal(ingested[0].raw.user.nickname, 'Người hai'); // tên lấy từ game, không từ trang gửi lên
  assert.equal(ingested[0].raw.giftRaw.diamondsEach, 29999);
});

test('granting to someone not in the game or an unknown gift is refused', async () => {
  const { handle, ingested } = setup();
  await assert.rejects(() => handle({ t: 'grant', userId: 'ai-do', giftId: 'rose' }), /không còn trong game/);
  await assert.rejects(() => handle({ t: 'grant', userId: 'u1', giftId: 'khong-co' }), /Quà không hợp lệ/);
  assert.equal(ingested.length, 0);
  assert.deepEqual(presentPeople({ patrons: people }).map((p) => p.id), ['u1', 'u2']);
});
