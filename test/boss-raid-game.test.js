import test from 'node:test';
import assert from 'node:assert/strict';
import { createBossRaidGame, damageForGift, bossNameForLevel } from '../src/games/boss-raid-game.js';

function kinds(fx) {
  return (fx || []).map((f) => f.kind);
}

const user = (id, nickname = 'Anh Hùng') => ({ id: `u${id}`, nickname, avatar: `https://p16.tiktokcdn.com/u${id}.jpg` });

test('boss: damage calculation respects tiers, critical hits and frenzy', () => {
  // Không bạo kích (random = 0.5 >= 0.12), không cuồng nộ
  const d1 = damageForGift(1, 1, false, () => 0.5);
  assert.equal(d1.damage, 12);
  assert.equal(d1.isCrit, false);
  assert.equal(d1.tier, 1);

  // Có bạo kích (random = 0.05 < 0.12) -> x2
  const dCrit = damageForGift(1, 1, false, () => 0.05);
  assert.equal(dCrit.damage, 24);
  assert.equal(dCrit.isCrit, true);

  // Có cuồng nộ -> x2
  const dFrenzy = damageForGift(1, 1, true, () => 0.5);
  assert.equal(dFrenzy.damage, 24);

  // Quà lớn tier 5 (5000 xu, mult 30)
  const d5 = damageForGift(5000, 5000, false, () => 0.5);
  assert.equal(d5.damage, 150000);
  assert.equal(d5.tier, 5);

  // Quà tối thượng tier 6 (20000 xu, mult 40)
  const d6 = damageForGift(20000, 20000, false, () => 0.5);
  assert.equal(d6.damage, 800000);
  assert.equal(d6.tier, 6);
});

test('boss: likes increase rage and trigger frenzy mode', () => {
  const boss = createBossRaidGame();
  let now = 1000;

  // Gửi 500 like (500 * 0.12 = 60 nộ)
  const fx1 = boss.handleEvent({ type: 'like', likes: 500, user: user(1) }, now);
  assert.ok(kinds(fx1).includes('bossHit'));
  assert.equal(boss.snapshot(now).rage, 60);
  assert.equal(boss.snapshot(now).isFrenzy, false);

  // Gửi thêm 400 like (tổng 108 nộ -> đạt 100 nộ kích hoạt Frenzy)
  const fx2 = boss.handleEvent({ type: 'like', likes: 400, user: user(2) }, (now += 100));
  assert.ok(kinds(fx2).includes('bossFrenzy'));
  assert.equal(boss.snapshot(now).isFrenzy, true);
});

test('boss: chat attack commands deal damage with cooldown', () => {
  const boss = createBossRaidGame();
  let now = 1000;

  // Lần 1: chém thành công
  const fx1 = boss.handleEvent({ type: 'chat', comment: 'chém chết boss', user: user(1) }, now);
  assert.ok(kinds(fx1).includes('bossHit'));
  assert.equal(fx1[0].damage, 15);

  // Lần 2 trong 1 giây (cooldown 2.5s) -> bị chặn
  const fx2 = boss.handleEvent({ type: 'chat', comment: 'chem tiếp', user: user(1) }, now + 1000);
  assert.equal(fx2.length, 0);

  // Sau 3 giây -> chém lại được
  const fx3 = boss.handleEvent({ type: 'chat', comment: 'bắn đi', user: user(1) }, now + 3000);
  assert.equal(fx3.length, 1);
  assert.equal(fx3[0].damage, 15);
});

test('boss: defeat triggers celebration and tick respawns higher level boss', () => {
  const boss = createBossRaidGame();
  let now = 1000;

  // Tặng quà đủ kết liễu 10000 HP (quà tier 4: 500 xu * 25 = 12500 dmg)
  const fx = boss.handleEvent({ type: 'gift', diamondsEach: 500, coinsTotal: 500, count: 1, user: user(1) }, now);
  assert.ok(kinds(fx).includes('bossDefeated'));
  assert.equal(boss.snapshot(now).hp, 0);
  assert.equal(boss.snapshot(now).status, 'celebrating');

  // Đang ăn mừng thì không nhận đòn
  const fxIgnored = boss.handleEvent({ type: 'chat', comment: 'chem', user: user(2) }, now + 500);
  assert.equal(fxIgnored.length, 0);

  // Sau 4 giây: vẫn đang ăn mừng (tổng 8s)
  const fxTick1 = boss.tick(now + 4000);
  assert.equal(fxTick1.length, 0);

  // Sau 8.5 giây: Hồi sinh Boss Level 2!
  const fxRespawn = boss.tick(now + 8500);
  assert.ok(kinds(fxRespawn).includes('bossRespawn'));
  const snap = boss.snapshot(now + 8500);
  assert.equal(snap.level, 2);
  assert.equal(snap.status, 'fighting');
  assert.equal(snap.hp, 12500); // 10000 * 1.25 = 12500
  assert.equal(snap.maxHp, 12500);
});

test('boss: admin commands control reset, kill and frenzy', () => {
  const boss = createBossRaidGame();
  let now = 1000;

  // Kích hoạt frenzy bằng lệnh admin
  const fxFrenzy = boss.command('frenzy', now);
  assert.ok(kinds(fxFrenzy).includes('bossFrenzy'));
  assert.equal(boss.snapshot(now).isFrenzy, true);

  // Kết liễu bằng lệnh admin
  const fxKill = boss.command('killBoss', now);
  assert.ok(kinds(fxKill).includes('bossDefeated'));
  assert.equal(boss.snapshot(now).hp, 0);

  // Reset về Level 1
  const fxReset = boss.command('resetBoss', now);
  assert.ok(kinds(fxReset).includes('bossReset'));
  assert.equal(boss.snapshot(now).level, 1);
  assert.equal(boss.snapshot(now).hp, 10000);
});
