import assert from 'node:assert/strict';
import test from 'node:test';
import { isCleanForDisplay, isCleanText, speakableName } from '../public/shared/profanity-filter.js';
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
  assert.equal(speakableName('Bé Na cute phô mai que 🧀'), 'Bé Na cute phô mai que');
  assert.equal(speakableName('🔥🔥🔥'), 'bạn');
  assert.equal(speakableName('小明 Minh'), 'Minh');
  const line = thankLine({ nickname: 'XxBitchxX', giftName: 'Corgi', count: 2, tier: 3 });
  assert.equal(line, 'Cảm ơn bạn đã tặng 2 Corgi!');
  assert.ok(isCleanText(thankLine({ kind: 'follow', nickname: 'fuuuck' })));
});
