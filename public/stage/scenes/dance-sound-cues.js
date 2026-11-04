// Âm thanh Sàn Nhảy theo CẤP QUÀ — quà càng đắt càng nhiều lớp tiếng, càng to, càng dài, và có nhạc riêng:
//   bậc 1 (1–9 💎)      xu leng keng
//   bậc 2 (10–98)       vút + hò reo nhỏ
//   bậc 3 (99–498)      kèn đồng + airhorn + hò reo lớn
//   bậc 4 (499–4,9K)    còi jackpot + airhorn + trực thăng bay qua + nổ trầm → solo đổi sang nhạc VIP
//   bậc 5 (5K–19,9K)    tiếng kéo lên → NỔ đúng lúc + cả sân vận động hò + pháo hoa → nhạc Siêu sao
//   bậc 6 (20K+)        trống dồn → dàn kèn đồng + jackpot + pháo hoa liên hoàn + đám đông → nhạc chủ đề Đại nhạc hội
// Tiếng là file thu sẵn (public/assets/dance/sfx, Mixkit); thiếu file nào thì stage-audio tự dùng tiếng tổng hợp.
const GIFT_CUES = {
  1: [['coin', 0, 0.8]],
  2: [['win-swoosh', 0, 0.9], ['cheer-small', 0.1, 0.7]],
  3: [['horns-fanfare', 0, 1], ['airhorn', 0.25, 1], ['cheer-big', 0.3, 0.8]],
  4: [['siren-win', 0, 0.8], ['airhorn', 0.2, 1], ['impact-big', 0.5, 0.9], ['cheer-big', 0.6, 0.9]],
  5: [['riser-short', 0, 1], ['impact-epic', 1.6, 1], ['crowd-roar', 1.7, 0.9], ['fireworks-multi', 1.9, 0.9], ['airhorn', 2.2, 1]],
  6: [['drumroll', 0, 1], ['impact-epic', 4.6, 1], ['trumpet-fanfare', 4.7, 1], ['jackpot', 4.9, 0.8], ['crowd-joy', 5, 1],
    ['fireworks-whistle', 5.6, 0.9], ['fireworks-multi', 7, 1]]
};
// nhạc riêng khi người tặng lên solo (mili-giây = thời lượng solo)
const SOLO_MUSIC = { 4: 'vip', 5: 'star', 6: 'festival' };
// bậc thấp hay bị tặng dồn (combo) — giãn tiếng để không thành tiếng rè liên tục
const MIN_GAP_MS = { 1: 180, 2: 350 };
// nhạc nền lặng xuống [mức, giây] cho tiếng quà nổi lên; bậc 5–6 lặng sâu tới đúng cú NỔ rồi nhạc bùng lại
const DUCK = { 3: [0.45, 2.5], 4: [0.4, 3], 5: [0.2, 1.7], 6: [0.12, 4.7] };

export function createDanceSounds(audio) {
  const last = {};
  let lastBigAt = -Infinity; // quà bậc 5+ tự kích DROP cùng lúc: tiếng kéo lên → nổ chỉ phát một lần
  const cue = (list) => {
    for (const [name, delay, gain] of list) audio.play(name, { delay, gain });
  };

  return {
    gift(tier) {
      const now = performance.now();
      if (now - (last[tier] || -Infinity) < (MIN_GAP_MS[tier] || 0)) return;
      last[tier] = now;
      cue(GIFT_CUES[Math.min(6, Math.max(1, tier))]);
      if (tier >= 5) lastBigAt = now;
      if (DUCK[tier]) audio.duck(...DUCK[tier]);
    },
    // thẻ quà lớn / follow hiện giữa màn: nhạc nhỏ lại cho giọng đọc + kèn nổi lên
    announce(seconds = 2.5) {
      audio.duck(0.55, seconds);
    },
    solo(tier, ms) {
      audio.play('scratch', { gain: 0.9 });
      if (SOLO_MUSIC[tier]) audio.special(SOLO_MUSIC[tier], ms);
    },
    drop(ms) {
      if (performance.now() - lastBigAt > 1500) cue([['riser-short', 0, 1], ['impact-epic', 1.5, 1], ['crowd-joy', 1.6, 0.9], ['airhorn', 1.9, 1]]);
      audio.special('drop', ms);
    },
    follow() {
      cue([['party-trumpet', 0, 1], ['cheer-party', 0.15, 0.9], ['achievement', 0.5, 0.8]]);
    },
    fireworks(power) {
      cue(power >= 3 ? [['fireworks-whistle', 0, 0.9], ['fireworks-multi', 0.8, 0.9]] : [['fireworks', 0, 0.8]]);
    },
    heli: () => audio.play('heli', { gain: 0.8 }),
    look: () => audio.play('magic', { gain: 0.7 })
  };
}
