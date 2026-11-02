// Quẻ xăm tự soạn cho game (không chép từ nguồn nào). Toàn lời khuyên nhẹ nhàng,
// không phán điều dữ để giữ không khí buổi live.
export const FORTUNES = [
  { rank: 'Thượng Thượng', title: 'Trăng rằm soi lối', poem: ['Trăng rằm soi sáng lối về', 'Bao điều mong ước sắp kề bên tay', 'Lòng thành giữ vững từng ngày', 'Phúc lành nối tiếp, sum vầy an vui'], meaning: 'Việc đang mong sắp thành, cứ bền lòng.' },
  { rank: 'Thượng Cát', title: 'Mầm non gặp mưa', poem: ['Mầm non vừa gặp mưa xuân', 'Cành lên lộc mới, xa gần đâm hoa', 'Chăm vun gốc rễ mặn mà', 'Mùa sau quả ngọt đầy nhà người thương'], meaning: 'Khởi đầu thuận lợi, chăm chỉ sẽ có quả.' },
  { rank: 'Đại Cát', title: 'Thuyền xuôi gió thuận', poem: ['Thuyền xuôi gặp gió thuận chiều', 'Buồm căng một mạch bao nhiêu dặm dài', 'Bạn hiền góp sức chung vai', 'Bến vui đang đợi ngày mai cập bờ'], meaning: 'Có quý nhân giúp, việc chung dễ thành.' },
  { rank: 'Trung Cát', title: 'Đường xa từng bước', poem: ['Đường xa đi chậm mà chắc', 'Mỗi ngày một bước, chẳng cần vội chi', 'Giữ lòng an tĩnh mà đi', 'Đến nơi thì sẽ thấy gì cũng xinh'], meaning: 'Đừng nóng vội, chậm mà bền thì tới.' },
  { rank: 'Thượng Cát', title: 'Hoa sen trong đầm', poem: ['Sen hồng nở giữa đầm xanh', 'Gần bùn vẫn giữ hương thanh dịu dàng', 'Ai hay lòng sáng như vàng', 'Gặp điều trắc trở vẫn an nhẹ lòng'], meaning: 'Giữ mình trong sạch, tiếng thơm tự đến.' },
  { rank: 'Đại Cát', title: 'Nhà ấm lửa hồng', poem: ['Bếp hồng ấm lửa sum vầy', 'Mẹ cha khoẻ mạnh, con đầy tiếng vui', 'Bữa cơm chan chứa ngọt bùi', 'Gia đình êm ấm, lộc trời ban cho'], meaning: 'Gia đạo bình an, người thân mạnh khoẻ.' },
  { rank: 'Trung Bình', title: 'Mây che chốc lát', poem: ['Mây che chốc lát rồi tan', 'Nắng lên lại rọi khắp ngàn non xanh', 'Việc nay tạm chậm cũng đành', 'Kiên tâm chờ đợi sẽ thành ước mong'], meaning: 'Có chút trở ngại nhỏ, qua nhanh thôi.' },
  { rank: 'Thượng Thượng', title: 'Chim én báo xuân', poem: ['Én về báo hiệu xuân sang', 'Tin vui đâu đó rộn ràng gõ cửa', 'Duyên lành như đã hẹn hò', 'Mở lòng đón nhận, chẳng lo điều gì'], meaning: 'Sắp có tin vui, nên cởi mở đón nhận.' },
  { rank: 'Trung Cát', title: 'Giếng trong mát lạnh', poem: ['Giếng trong múc mãi chẳng vơi', 'Tâm an như nước, chẳng rơi chẳng sờn', 'Học thêm một chút mỗi ngày', 'Tài năng tích lại, mai này dùng chung'], meaning: 'Hợp học hành, rèn nghề; tích luỹ dần.' },
  { rank: 'Đại Cát', title: 'Lúa chín vàng đồng', poem: ['Đồng xa lúa đã chín vàng', 'Bao ngày vất vả, nay sang được mùa', 'Công lao chẳng uổng nắng mưa', 'Tiền tài đủ đầy, sớm trưa thảnh thơi'], meaning: 'Công sức sắp được đền đáp xứng đáng.' },
  { rank: 'Thượng Cát', title: 'Cầu mới bắc sang', poem: ['Cầu mới bắc qua sông dài', 'Hai bờ nối lại, ngày mai thuận đường', 'Người xa nay lại gần thương', 'Lời hay ý đẹp, vấn vương tình người'], meaning: 'Hoà giải, kết nối; quan hệ tốt lên.' },
  { rank: 'Trung Bình', title: 'Cây cần gió lặng', poem: ['Cây muốn lặng, gió chưa dừng', 'Thong thả giữ gốc, ta đừng ngả nghiêng', 'Lời nói nên giữ dịu hiền', 'Bình tâm qua khỏi muộn phiền đôi khi'], meaning: 'Nên mềm mỏng, tránh tranh cãi lúc này.' },
  { rank: 'Đại Cát', title: 'Sao sáng đầu non', poem: ['Sao Mai sáng tỏ đầu non', 'Mở ra ngày mới vuông tròn đẹp tươi', 'Việc làm có bạn có người', 'Tên hay được nhắc, môi cười rạng danh'], meaning: 'Công việc thuận, được ghi nhận.' },
  { rank: 'Thượng Cát', title: 'Suối reo đầu ghềnh', poem: ['Suối reo róc rách đầu ghềnh', 'Đi qua đá sỏi vẫn thênh thang về', 'Sức khoẻ như nước dồi dào', 'Ăn ngon ngủ kỹ, chẳng nao ốm phiền'], meaning: 'Sức khoẻ tốt, nhớ nghỉ ngơi điều độ.' },
  { rank: 'Trung Cát', title: 'Hạt giống trong tay', poem: ['Trong tay hạt giống còn nguyên', 'Gieo đâu mọc đó, chớ phiền đất xa', 'Việc nhỏ làm kỹ mới ra', 'Từ từ góp lại thành nhà thành cơ'], meaning: 'Bắt đầu từ việc nhỏ, làm kỹ sẽ lớn dần.' },
  { rank: 'Thượng Thượng', title: 'Đèn lồng đêm hội', poem: ['Đèn lồng thắp sáng đêm vui', 'Phố phường rộn rã, người người hân hoan', 'Ước gì cũng được vẹn toàn', 'Một năm may mắn, bình an trọn đời'], meaning: 'Đại cát: mọi sự hanh thông, vui vẻ.' }
];

export function drawFortune(random = Math.random) {
  const index = Math.floor(random() * FORTUNES.length);
  return { number: index + 1, ...FORTUNES[index] };
}
