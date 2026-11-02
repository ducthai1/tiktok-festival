// Tên các mức quà ở chùa = LỜI CẦU đời thường của chính người tặng (sức khỏe, tiền tài, tình duyên…),
// không dùng tên nghi lễ hay danh xưng của tôn giáo nào. Mỗi lần tặng bốc một lời cầu trong danh sách
// cho đỡ lặp; quà càng lớn lời cầu càng "to" và được đọc thành tiếng. Chữ băng rôn ≤ 19 ký tự để nằm
// gọn một dòng.

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export const TIERS = {
  lotus: { legend: 'Cầu bình an', verb: 'dâng hoa', icon: '🪷', wishes: ['bình an', 'bình an cho cả nhà', 'lòng nhẹ tênh, ngủ thật ngon'] },
  lamp: { legend: 'Cầu sức khỏe', verb: 'thắp đèn', icon: '🏮', wishes: ['sức khỏe cho cả nhà', 'ba mẹ mạnh khỏe, sống lâu', 'sức khỏe dồi dào, ăn ngon ngủ kỹ'] },
  fruit: { legend: 'Cầu tài lộc', verb: 'dâng mâm ngũ quả', icon: '🍊', wishes: ['tài lộc đầy nhà', 'buôn may bán đắt', 'lương thưởng tăng vù vù'] },
  ceremony: {
    legend: 'Điều ước lớn',
    wishes: [
      ['💘', 'HẾT Ế RỒI NHA', 'hết ế, sắp có người thương'],
      ['💰', 'TIỀN VÀO NHƯ NƯỚC', 'tiền vào như nước'],
      ['📈', 'LÊN CHỨC TĂNG LƯƠNG', 'lên chức tăng lương'],
      ['🎓', 'THI ĐÂU ĐẬU ĐÓ', 'thi đâu đậu đó'],
      ['🏠', 'SỚM CÓ NHÀ CÓ XE', 'sớm có nhà có xe'],
      ['👨‍👩‍👧', 'CẢ NHÀ KHỎE MẠNH', 'cả nhà khỏe mạnh, hạnh phúc']
    ]
  },
  grand: {
    legend: 'Vạn sự như ý',
    wishes: [
      ['✨', 'VẠN SỰ NHƯ Ý', 'vạn sự như ý'],
      ['🧧', 'PHÚ QUÝ ĐẦY NHÀ', 'phú quý đầy nhà'],
      ['🌟', 'TIỀN TÀI ĐẦY TÚI', 'tiền tài đầy túi, tình duyên như ý, sức khỏe dồi dào'],
      ['👑', 'ƯỚC GÌ ĐƯỢC NẤY', 'ước gì được nấy'],
      ['💎', 'ĐẠI CÁT ĐẠI LỢI', 'đại cát đại lợi, tiền tài như nước']
    ]
  }
};

/** Lời cầu nhỏ (hoa / đèn / mâm quả): chuỗi ngắn để ghép vào thông báo. */
export const smallWish = (tier) => pick(TIERS[tier].wishes);

/** Lời cầu lớn: { icon, title (băng rôn), spoken (đọc thành tiếng) }. */
export function bigWish(tier) {
  const [icon, title, spoken] = pick(TIERS[tier].wishes);
  return { icon, title, spoken };
}

/** Nhãn từng bậc quà (1..6) cho bảng "Cách tham gia" — màn hình ghép ảnh quà thật vào trước. */
export const giftLabels = () => ({ 1: 'Thắp hương', 2: 'Xin xăm', 3: TIERS.lamp.legend, 4: TIERS.fruit.legend,
  5: TIERS.ceremony.legend, 6: TIERS.grand.legend });
