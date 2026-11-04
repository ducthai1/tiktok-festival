import assert from 'node:assert/strict';
import test from 'node:test';
import { isCleanForDisplay, isCleanText } from '../public/shared/profanity-filter.js';
import { speakableGift, speakableName } from '../public/shared/spoken-name.js';
import { thankLine } from '../public/stage/scenes/dance-voice-lines.js';

test('dirty names are caught even when written around the filter', () => {
  for (const name of ['Đ.ị.t mẹ', 'fuuuck boy', 'XxBitchxX', 'ditme123', 'Thằng Chó', 'Lồn', 'con đĩ nhỏ', 'D C M 2k5', 'vcl',
    'Óc Chó Vip', 'nigga', 'bê đê', 'ĐM tất cả', 'Đụ Má', 'ShIIIt', 'dkm luôn']) {
    assert.equal(isCleanText(name), false, name);
  }
});

test('ordinary Vietnamese names that look close to bad words are left alone', () => {
  for (const name of ['Ngọc Bích', 'Ngọc Hồng', 'Du Mai', 'Fukuda', 'Con Cá Chép', 'Dâu Bưởi', 'Vai Long', 'Cái Lò Nướng',
    'Hoa Lớn', 'Các Anh Em', 'Đeo Kính', 'Cu Tí', 'Đức Mạnh', 'Edit Me', 'Credit', 'Bé Na cute phô mai que 🧀', 'Người 1']) {
    assert.equal(isCleanText(name), true, name);
  }
  assert.equal(isCleanForDisplay('add zalo 0912345678'), false);
});

test('the voice never says a dirty name, and skips emoji / non-Latin letters', () => {
  assert.equal(speakableName('Đ.ị.t mẹ'), 'bạn');
  assert.equal(speakableName('🔥🔥🔥'), 'bạn');
  assert.equal(speakableName('小明 Minh'), 'Minh');
  assert.equal(thankLine({ nickname: 'XxBitchxX', giftName: 'Corgi', count: 2, tier: 3 }), 'Cảm ơn bạn đã tặng 2 Corgi!');
  assert.ok(isCleanText(thankLine({ kind: 'follow', nickname: 'fuuuck' })));
});

test('names are tidied so the voice says them clearly, with a pause after the name', () => {
  const cases = { 'Bé Na cute phô mai que 🧀': 'Bé Na cute', BeNaCute: 'Be Na Cute', 'NGUYEN VAN A': 'Nguyen Van A',
    'Minh Tuấn 2k5': 'Minh Tuấn', 'xX_Huyền_Xx': 'Huyền', Naaaaa: 'Na', 'Tuấn2005': 'Tuấn', 'Lan.Anh.Official': 'Lan Anh',
    2005: '2005', TV: 'TV', 'Ngọc Bích': 'Ngọc Bích' };
  for (const [raw, said] of Object.entries(cases)) assert.equal(speakableName(raw), said, raw);
  assert.equal(speakableGift('TikTok Universe'), 'TikTok Universe');
  assert.equal(thankLine({ nickname: 'Minh Tuấn 2k5', giftName: 'Hoa hồng', count: 5, tier: 3 }), 'Cảm ơn Minh Tuấn, đã tặng 5 Hoa hồng!');
  assert.equal(thankLine({ nickname: 'BeNa', giftName: 'Sư tử', count: 1, tier: 6 }),
    'Đại gia Be Na! Cảm ơn bạn đã tặng Sư tử! Đại nhạc hội bắt đầu! Cả sàn cháy hết mình nào!');
  assert.equal(thankLine({ kind: 'follow', nickname: 'Lan Anh' }), 'Cảm ơn Lan Anh, đã follow sàn nhảy! Mời bạn lên sân khấu!');
});

test('every paid gift is thanked once per combo, each line in one of the three voices at random', async () => {
  const { pickVoice, TTS_VOICES } = await import('../public/shared/tts-voices.js');
  const { createGiftVoice } = await import('../public/stage/scenes/dance-voice-lines.js');
  assert.deepEqual(new Set(Array.from({ length: 60 }, (_, i) => pickVoice('random', () => (i % 3) / 3 + 0.01))), new Set(TTS_VOICES));
  assert.equal(pickVoice('Adam bựa'), 'Ngọc Huyền');
  assert.equal(pickVoice('Trúc Ly'), 'Trúc Ly');
  const said = [];
  const voice = createGiftVoice((line) => said.push(line), { settleMs: 30 });
  for (let i = 0; i < 4; i += 1) voice.add({ userId: 'u1', nickname: 'Lan Anh', giftName: 'Hoa hồng', count: i === 0 ? 1 : 3, tier: 1 });
  voice.add({ userId: 'u2', nickname: 'Minh', giftName: 'Corgi', count: 1, tier: 3 });
  await new Promise((r) => setTimeout(r, 80));
  assert.deepEqual(said.sort(), ['Cảm ơn Lan Anh, đã tặng 10 Hoa hồng!', 'Cảm ơn Minh, đã tặng Corgi!']);
});
