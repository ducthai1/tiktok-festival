import assert from 'node:assert/strict';
import test from 'node:test';
import { giftOptions, normalizeRules } from '../src/games/quiz/english-gift-rules.js';
import { CHEAP_MAX_COINS, CHEAP_TARGETS, FANCLUB_GIFT_ID, MAX_ROUNDS_AWAY, emptyRotation, hottestGift, rotateGifts }
  from '../src/games/quiz/gift-rotation.js';
import { defaultEnglishRules, ORDER } from '../public/shared/english-sets.js';

const options = giftOptions([]);
const base = () => defaultEnglishRules().filter((r) => r.enabled !== false);
const seeded = (seq) => { let i = 0; return () => seq[i++ % seq.length]; };
const ruleFor = (rules, to) => rules.find((r) => r.to === to);

test('mỗi vòng bảng quà vẫn hợp lệ: không món nào gán cho hai ô', () => {
  let rules = base();
  let state = emptyRotation();
  for (let round = 0; round < 8; round += 1) {
    ({ rules, state } = rotateGifts({ rules, options, counts: { [ruleFor(rules, 'toeic').gift.id]: 9 }, state, random: seeded([0.1, 0.7, 0.33, 0.9, 0.5]) }));
    assert.doesNotThrow(() => normalizeRules(rules, options), `vòng ${round + 1} ra bảng quà trùng món`);
  }
});

test('ô Tổng hợp / Dễ / Thường / Khó không bao giờ vượt 5 xu', () => {
  let rules = base();
  let state = emptyRotation();
  for (let round = 0; round < 12; round += 1) {
    ({ rules, state } = rotateGifts({ rules, options, counts: {}, state, random: seeded([0.95, 0.4, 0.05, 0.62]) }));
    for (const to of CHEAP_TARGETS) {
      const r = ruleFor(rules, to);
      assert.ok(r.gift.coins <= CHEAP_MAX_COINS, `vòng ${round + 1}: ô ${to} lên ${r.gift.coins} xu`);
    }
  }
});

test('ô được tặng nhiều nhất đổi thành Heart Me để kéo thêm fan club', () => {
  const rules = base();
  const hotRule = ruleFor(rules, 'dongvat');
  const out = rotateGifts({ rules, options, counts: { [hotRule.gift.id]: 12, [ruleFor(rules, 'yhoc').gift.id]: 3 }, random: seeded([0.5]) });

  assert.equal(ruleFor(out.rules, 'dongvat').gift.id, FANCLUB_GIFT_ID);
  assert.equal(ruleFor(out.rules, 'dongvat').gift.coins, 1);
  assert.equal(out.state.hot.count, 12);
  assert.ok(out.changes.find((c) => c.to === 'dongvat').fanclub);
  // các ô khác không được nhận Heart Me
  assert.equal(out.rules.filter((r) => r.gift.id === FANCLUB_GIFT_ID).length, 1);
});

test('trong random đổi quà bắt buộc luôn luôn có 1 nơi có sự hiện diện của Heart Me (kể cả chưa ai tặng)', () => {
  const out = rotateGifts({ rules: base(), options, counts: {}, random: seeded([0.5]) });
  assert.equal(out.rules.filter((r) => r.gift.id === FANCLUB_GIFT_ID).length, 1);
  assert.equal(out.state.hot, null);
});

test('ô 10 xu không bao giờ lệch giá gốc quá 2 vòng liên tiếp', () => {
  let rules = base();
  let state = emptyRotation();
  const ten = 'congnghe'; // Curious Twinkle 10 xu
  assert.equal(ruleFor(rules, ten).gift.coins, 10);

  const seen = [];
  for (let round = 0; round < 15; round += 1) {
    ({ rules, state } = rotateGifts({ rules, options, counts: {}, state, random: seeded([0.88, 0.2, 0.47, 0.71, 0.09]) }));
    seen.push(ruleFor(rules, ten).gift.coins);
  }
  assert.equal(state.base[ten], 10, 'giá gốc phải được ghi lại từ vòng đầu');
  // Bốc trúng lại 10 xu sớm hơn thì bộ đếm reset — điều phải đảm bảo là KHÔNG CÓ dải nào
  // dài hơn MAX_ROUNDS_AWAY mà giá vẫn khác 10.
  let away = 0;
  for (const coins of seen) {
    away = coins === 10 ? 0 : away + 1;
    assert.ok(away <= MAX_ROUNDS_AWAY, `lệch ${away} vòng liên tiếp: ${seen.join(' → ')}`);
  }
  assert.ok(seen.includes(10), `phải có lúc quay về 10 xu: ${seen.join(' → ')}`);
});

test('ô đang tắt giữ nguyên món của nó, và món đó không bị ô khác chiếm', () => {
  const rules = defaultEnglishRules(); // có sẵn một luật Heart Me → Luyện nghe, tắt sẵn
  const off = rules.filter((r) => r.enabled === false);
  assert.ok(off.length, 'bảng mặc định phải có luật tắt sẵn để test');
  const out = rotateGifts({ rules, options, counts: {}, random: seeded([0.3, 0.8]) });

  for (const r of off) {
    const same = out.rules.find((x) => x.to === r.to && x.enabled === false);
    assert.equal(same.gift.id, r.gift.id, 'ô tắt bị đổi quà');
  }
  assert.doesNotThrow(() => normalizeRules(out.rules.filter((r) => r.enabled !== false), options));
});

test('hottestGift: lấy món nhiều lượt nhất, bỏ qua món 0 lượt', () => {
  assert.equal(hottestGift({ a: 3, b: 7, c: 0 }).id, 'b');
  assert.equal(hottestGift({ a: 0 }), null);
  assert.equal(hottestGift({}), null);
});

test('quà xoay vào phải là món người xem tìm được trong hộp quà', () => {
  const findable = new Set(options.filter((g) => g.panel || g.seen).map((g) => String(g.id)));
  let rules = base();
  let state = emptyRotation();
  for (let round = 0; round < 6; round += 1) {
    ({ rules, state } = rotateGifts({ rules, options, counts: {}, state, random: seeded([0.17, 0.83, 0.5]) }));
    for (const r of rules) {
      if (r.gift.id === FANCLUB_GIFT_ID) continue; // Heart Me nằm ngoài hộp quà chung, chủ kênh chủ động chọn
      assert.ok(findable.has(String(r.gift.id)), `ô ${r.to} nhận món ngoài hộp quà: ${r.gift.name}`);
    }
  }
});

test('trang 2 và 3 ít nhất phải là 5 kim cương, không bao giờ nhận món 1 xu (trừ Heart Me khi là ô hot)', () => {
  let rules = base();
  let state = emptyRotation();
  for (let round = 0; round < 15; round += 1) {
    ({ rules, state } = rotateGifts({ rules, options, counts: {}, state, random: seeded([0.1, 0.4, 0.7, 0.2, 0.9]) }));
    rules.forEach((r, idx) => {
      if (idx >= 7 || ORDER.indexOf(r.to) >= 7) {
        if (r.gift.id === FANCLUB_GIFT_ID) return; // ngoại lệ Heart Me khi là ô hot
        assert.ok(r.gift.coins >= 5, `vòng ${round + 1}: ô ${r.to} ở trang 2/3 nhận món ${r.gift.name} (${r.gift.coins} xu) < 5 xu`);
      }
    });
  }
});
