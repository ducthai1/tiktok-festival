import os

ROOT = '/home/datadevice/FileMySelf/tiktok-live-games'
SET_DIR = os.path.join(ROOT, 'src/games/quiz/bank/tieng-anh-bo')
GEN_DIR = os.path.join(ROOT, 'src/games/quiz/bank/tieng-anh')

set_keys = set()
for f in os.listdir(SET_DIR):
    if f.endswith('.txt'):
        with open(os.path.join(SET_DIR, f), 'r', encoding='utf-8') as fp:
            for line in fp:
                line = line.strip()
                if not line or line.startswith('#'): continue
                set_keys.add(line.split('|')[0].strip().lower())

existing_gen = set()
for f in os.listdir(GEN_DIR):
    if f.endswith('.txt'):
        with open(os.path.join(GEN_DIR, f), 'r', encoding='utf-8') as fp:
            for line in fp:
                line = line.strip()
                if not line or line.startswith('#'): continue
                existing_gen.add(line.split('|')[0].strip().lower())

# Massive list of everyday phrasal verbs, daily activities, idioms, and rich descriptive vocabulary
items = [
    # Phrasal verbs
    ("GIVE UP", "Cụm động từ chỉ sự từ bỏ đầu hàng buông xuôi tiếng Anh là gì?", 1, "TỪ BỎ, ĐẦU HÀNG"),
    ("LOOK FOR", "Cụm động từ tìm kiếm thứ gì bị thất lạc tiếng Anh là gì?", 1, "TÌM KIẾM"),
    ("LOOK AFTER", "Cụm động từ chăm sóc trông nom người thân tiếng Anh là gì?", 1, "CHĂM SÓC, TRÔNG NOM, TAKE CARE OF"),
    ("TAKE OFF", "Cụm động từ máy bay cất cánh bay lên trời tiếng Anh là gì?", 1, "CẤT CÁNH"),
    ("PUT ON", "Cụm động từ mặc quần áo hoặc đeo kính vào tiếng Anh là gì?", 1, "MẶC VÀO, ĐEO VÀO"),
    ("TAKE OFF CLOTHES", "Cụm động từ cởi quần áo cởi giày dép tiếng Anh là gì?", 1, "CỞI RA"),
    ("TURN ON", "Cụm động từ bật đèn bật công tắc điện tiếng Anh là gì?", 1, "BẬT, BẬT ĐÈN, SWITCH ON"),
    ("TURN OFF", "Cụm động từ tắt quạt tắt bóng điện đi tiếng Anh là gì?", 1, "TẮT, TẮT ĐI, SWITCH OFF"),
    ("TURN UP", "Cụm động từ vặn to âm lượng hoặc xuất hiện bất ngờ tiếng Anh là gì?", 2, "VẶN TO, XUẤT HIỆN"),
    ("TURN DOWN", "Cụm động từ vặn nhỏ âm lượng hoặc từ chối lời mời tiếng Anh là gì?", 2, "VẶN NHỎ, TỪ CHỐI, REFUSE"),
    ("GO ON", "Cụm động từ tiếp tục diễn ra tiếp diễn tiếng Anh là gì?", 1, "TIẾP TỤC, CONTINUE"),
    ("CARRY OUT", "Cụm động từ tiến hành thực hiện một cuộc khảo sát tiếng Anh là gì?", 2, "TIẾN HÀNH, THỰC HIỆN, CONDUCT"),
    ("RUN OUT OF", "Cụm động từ hết cạn kiệt tiền hoặc xăng tiếng Anh là gì?", 2, "HẾT, CẠN KIỆT"),
    ("CATCH UP WITH", "Cụm động từ đuổi kịp bắt kịp người đi trước tiếng Anh là gì?", 2, "ĐUỔI KỊP, BẮT KỊP"),
    ("KEEP UP WITH", "Cụm động từ theo kịp duy trì cùng tốc độ tiếng Anh là gì?", 2, "THEO KỊP"),
    ("BREAK DOWN", "Cụm động từ xe cộ máy móc bị hỏng hóc giữa đường tiếng Anh là gì?", 2, "BỊ HỎNG, HỎNG HÓC"),
    ("BREAK UP", "Cụm động từ chia tay chấm dứt một mối tình tiếng Anh là gì?", 1, "CHIA TAY"),
    ("COME ACROSS", "Cụm động từ tình cờ bắt gặp một cuốn sách cũ tiếng Anh là gì?", 2, "TÌNH CỜ GẶP, TÌNH CỜ THẤY"),
    ("FIGURE OUT", "Cụm động từ nghĩ ra tìm ra cách giải quyết vấn đề tiếng Anh là gì?", 2, "TÌM RA, NGHĨ RA"),
    ("GIVE IN", "Cụm động từ nhượng bộ chịu thua trước sức ép tiếng Anh là gì?", 2, "NHƯỢNG BỘ, CHỊU THUA"),
    ("HOLD ON", "Cụm động từ giữ máy chờ máy điện thoại một lát tiếng Anh là gì?", 1, "CHỜ MÁY, GIỮ MÁY, WAIT"),
    ("HANG OUT", "Cụm động từ tụ tập đi chơi tán gẫu cùng bạn bè tiếng Anh là gì?", 1, "ĐI CHƠI, TỤ TẬP"),
    ("GET ALONG WITH", "Cụm động từ hòa thuận ăn ý với bạn bè người thân tiếng Anh là gì?", 2, "HÒA THUẬN, HÒA HỢP"),
    ("BRING UP", "Cụm động từ nuôi nấng dạy dỗ đứa trẻ nên người tiếng Anh là gì?", 2, "NUÔI DƯỠNG, DẠY DỖ, RAISE"),
    ("PASS AWAY", "Cụm từ trang trọng chỉ sự qua đời tạ thế tiếng Anh là gì?", 2, "QUA ĐỜI, TẠ THẾ, DIE"),
    ("SHOW UP", "Cụm động từ xuất hiện có mặt tại buổi hẹn tiếng Anh là gì?", 1, "CÓ MẶT, XUẤT HIỆN, ARRIVE"),
    ("MAKE UP", "Cụm động từ làm lành sau khi cãi vã hoặc trang điểm tiếng Anh là gì?", 1, "LÀM LÀNH, TRANG ĐIỂM"),
    ("PUT OFF", "Cụm động từ hoãn lại việc gì sang ngày khác tiếng Anh là gì?", 2, "HOÃN LẠI, TRÌ HOÃN, POSTPONE"),
    ("CALL OFF", "Cụm động từ hủy bỏ hoàn toàn trận đấu do mưa bão tiếng Anh là gì?", 2, "HỦY BỎ, CANCEL"),
    ("SET UP", "Cụm động từ thành lập dựng nên hoặc cài đặt tiếng Anh là gì?", 1, "THÀNH LẬP, CÀI ĐẶT, ESTABLISH"),
    ("TAKE UP", "Cụm động từ bắt đầu một sở thích thói quen mới tiếng Anh là gì?", 2, "BẮT ĐẦU SỞ THÍCH"),
    ("LOOK FORWARD TO", "Cụm động từ ngóng trông háo hức mong đợi điều gì tiếng Anh là gì?", 2, "TRÔNG ĐỢI, MONG ĐỢI"),
    ("DROP BY", "Cụm động từ tạt qua ghé thăm chốc lát tiếng Anh là gì?", 2, "GHÉ THĂM, TẠT QUA"),
    ("GET OVER", "Cụm động từ vượt qua cú sốc hoặc khỏi bệnh tiếng Anh là gì?", 2, "VƯỢT QUA, HỒI PHỤC"),
    ("STAND FOR", "Cụm từ viết tắt hoặc đại diện cho biểu tượng gì tiếng Anh là gì?", 2, "ĐẠI DIỆN CHO, VIẾT TẮT"),
    ("WARM UP", "Cụm động từ khởi động làm ấm cơ thể trước khi chạy tiếng Anh là gì?", 1, "KHỞI ĐỘNG"),
    ("WORK OUT", "Cụm động từ tập thể dục rèn luyện thân thể hoặc tính toán tiếng Anh là gì?", 1, "TẬP THỂ DỤC, TẬP GYM"),
    ("CHILL OUT", "Cụm từ thư giãn xả hơi thoải mái tiếng Anh là gì?", 1, "THƯ GIÃN, XẢ HƠI, RELAX"),
    ("CALM DOWN", "Cụm từ giữ bình tĩnh trấn tĩnh lại tiếng Anh là gì?", 1, "BÌNH TĨNH"),
    ("CHEER UP", "Cụm từ vui lên phấn chấn tinh thần lên tiếng Anh là gì?", 1, "VUI LÊN, PHẤN CHẤN"),
    ("SPEAK UP", "Cụm từ nói to lên dõng dạc lên tiếng Anh là gì?", 1, "NÓI TO LÊN"),
    ("SLOW DOWN", "Cụm từ đi chậm lại giảm tốc độ xe tiếng Anh là gì?", 1, "ĐI CHẬM LẠI, GIẢM TỐC"),
    ("SPEED UP", "Cụm từ tăng tốc phóng nhanh hơn tiếng Anh là gì?", 1, "TĂNG TỐC"),
    ("WAKE UP", "Cụm động từ thức giấc mở mắt sau giấc ngủ tiếng Anh là gì?", 1, "THỨC GIẤC, THỨC DẬY"),
    ("GET UP", "Cụm động từ ngồi dậy rời khỏi giường tiếng Anh là gì?", 1, "RỜI GIƯỜNG, ĐỨNG DẬY"),
    ("GROW UP", "Cụm động từ khôn lớn trưởng thành theo năm tháng tiếng Anh là gì?", 1, "TRƯỞNG THÀNH, LỚN LÊN"),
    ("DRESS UP", "Cụm từ diện đồ đẹp lên đồ dự tiệc tiếng Anh là gì?", 1, "DIỆN ĐỒ, MẶC ĐẸP"),
    ("CHECK OUT", "Cụm từ kiểm tra xem thử hoặc làm thủ tục trả phòng tiếng Anh là gì?", 1, "TRẢ PHÒNG, XEM THỬ"),
    ("SIGN IN", "Cụm từ đăng nhập tài khoản hệ thống tiếng Anh là gì?", 1, "ĐĂNG NHẬP, LOGIN"),
    ("SIGN OUT", "Cụm từ đăng xuất thoát khỏi tài khoản tiếng Anh là gì?", 1, "ĐĂNG XUẤT, LOGOUT"),

    # Rich nouns & concepts
    ("SOLITUDE", "Sự tĩnh lặng thanh tịnh một mình không quấy rầy tiếng Anh là gì?", 3, "SỰ CÔ ĐỘC, TĨNH LẶNG"),
    ("SERENITY", "Cảm giác thanh bình tĩnh tại êm ả tâm hồn tiếng Anh là gì?", 3, "SỰ THANH BÌNH"),
    ("NOSTALGIA", "Nỗi niềm hoài niệm nhớ nhung ký ức xưa cũ tiếng Anh là gì?", 3, "HOÀI NIỆM, NHỚ XƯA"),
    ("MELANCHOLY", "Nỗi buồn man mác u sầu trầm lắng tiếng Anh là gì?", 3, "U SẦU, BUỒN MAN MÁC"),
    ("EUPHORIA", "Cảm giác hưng phấn sung sướng tột độ tiếng Anh là gì?", 3, "HƯNG PHẤN, SUNG SƯỚNG"),
    ("TRANQUILITY", "Khung cảnh thanh bình tĩnh mịch êm đềm tiếng Anh là gì?", 3, "SỰ THANH BÌNH, TĨNH LẶNG"),
    ("DESTINY", "Số phận định mệnh an bài của đời người tiếng Anh là gì?", 2, "SỐ PHẬN, ĐỊNH MỆNH, FATE"),
    ("ETERNITY", "Vĩnh cửu muôn đời ngàn kiếp không phai tiếng Anh là gì?", 2, "VĨNH CỬU, MUÔN ĐỜI"),
    ("INFINITY", "Vô cực vô tận không bao giờ kết thúc tiếng Anh là gì?", 2, "VÔ CỰC, VÔ TẬN"),
    ("HORIZON", "Đường chân trời nơi mặt biển tiếp giáp bầu trời tiếng Anh là gì?", 2, "ĐƯỜNG CHÂN TRỜI, CHÂN TRỜI"),
    ("SUNRISE", "Cảnh bình minh rạng đông mặt trời mọc tiếng Anh là gì?", 1, "BÌNH MINH, RẠNG ĐÔNG, DAWN"),
    ("SUNSET", "Cảnh hoàng hôn chiều tà mặt trời lặn tiếng Anh là gì?", 1, "HOÀNG HÔN, CHIỀU TÀ, DUSK"),
    ("TWILIGHT", "Ánh chạng vạng nửa sáng nửa tối lúc hoàng hôn tiếng Anh là gì?", 2, "CHẠNG VẠNG"),
    ("MIDNIGHT", "Thời khắc nửa đêm đúng mười hai giờ đêm tiếng Anh là gì?", 1, "NỬA ĐÊM, ĐÊM KHUYA"),
    ("BREEZE", "Ngọn gió heo may gió thoảng nhẹ mát lành tiếng Anh là gì?", 1, "GIÓ THOẢNG, GIÓ NHẸ"),
    ("DEW", "Những hạt sương mai long lanh đọng trên ngọn cỏ tiếng Anh là gì?", 2, "GIỌT SƯƠNG, HẠT SƯƠNG, SƯƠNG MAI"),
    ("SHADOW", "Bóng đen in hình trên mặt đất dưới ánh đèn tiếng Anh là gì?", 1, "BÓNG ĐEN, CÁI BÓNG"),
    ("REFLECTION", "Hình ảnh phản chiếu trên mặt gương mặt nước tiếng Anh là gì?", 2, "PHẢN CHIẾU, HÌNH PHẢN CHIẾU"),
    ("ECHO", "Âm thanh tiếng vang vọng lại từ vách núi tiếng Anh là gì?", 1, "TIẾNG VANG, TIẾNG VỌNG"),
    ("RIPPLE", "Gợn sóng lăn tăn xao động trên mặt hồ tiếng Anh là gì?", 2, "GỢN SÓNG, LĂN TĂN"),
    ("TIDE", "Hiện tượng thủy triều con nước lên xuống theo chu kỳ tiếng Anh là gì?", 2, "THỦY TRIỀU"),
    ("WILDERNESS", "Vùng đất hoang dã thiên nhiên nguyên sơ tiếng Anh là gì?", 3, "HOANG DÃ, VÙNG HOANG DÃ"),
    ("MEADOW", "Đồng cỏ xanh rờn nở hoa bạt ngàn tiếng Anh là gì?", 2, "ĐỒNG CỎ"),
    ("VALLEY", "Thung lũng trù phú nằm kẹp giữa hai dãy núi tiếng Anh là gì?", 2, "THUNG LŨNG"),
    ("CLIFF", "Vách đá dựng đứng cheo leo sát bờ biển tiếng Anh là gì?", 2, "VÁCH ĐÁ"),
    ("CAVE", "Hang động kỳ bí trong lòng núi đá vôi tiếng Anh là gì?", 1, "HANG ĐỘNG, HANG"),
    ("ISLAND", "Hòn đảo nổi giữa đại dương bao la tiếng Anh là gì?", 1, "HÒN ĐẢO, ĐẢO"),
    ("PENINSULA", "Bán đảo ba mặt giáp biển tiếng Anh là gì?", 3, "BÁN ĐẢO"),
    ("OASIS", "Ốc đảo xanh tươi mát lành giữa sa mạc cát tiếng Anh là gì?", 2, "ỐC ĐẢO"),
    ("STREAM", "Con suối nhỏ róc rách nước trong veo tiếng Anh là gì?", 1, "CON SUỐI, DÒNG SUỐI"),
    ("LAGOON", "Đầm phá nước lợ ven biển yên bình tiếng Anh là gì?", 3, "ĐẦM PHÁ, ĐẦM NƯỚC"),
    ("REEF", "Rạn san hô rực rỡ sắc màu dưới biển tiếng Anh là gì?", 2, "RẠN SAN HÔ, BÃI ĐÁ NGẦM"),
    ("VOLCANO", "Ngọn núi lửa phun trào dung nham tiếng Anh là gì?", 1, "NÚI LỬA"),
    ("DESERT", "Sa mạc khô cằn toàn cát và nắng cháy tiếng Anh là gì?", 1, "SA MẠC"),
    ("JUNGLE", "Rừng rậm nhiệt đới rậm rạp cây cối tiếng Anh là gì?", 1, "RỪNG RẬM, RỪNG NHIỆT ĐỚI"),
    ("FOREST", "Khu rừng rợp bóng cây xanh mát tiếng Anh là gì?", 1, "KHU RỪNG, RỪNG CÂY"),
    ("PATHWAY", "Lối đi mòn nhỏ dẫn vào khu vườn tiếng Anh là gì?", 2, "LỐI ĐI, ĐƯỜNG MÒN, TRAIL"),
    ("BRIDGE", "Cây cầu bắc qua hai bờ sông tiếng Anh là gì?", 1, "CÂY CẦU, CHIẾC CẦU"),
    ("FOUNTAIN", "Đài phun nước tung bọt trắng xóa giữa quảng trường tiếng Anh là gì?", 1, "ĐÀI PHUN NƯỚC"),
    ("STATUE", "Bức tượng điêu khắc danh nhân bằng đồng đá tiếng Anh là gì?", 1, "BỨC TƯỢNG, PHO TƯỢNG"),
    ("MONUMENT", "Đài tưởng niệm ghi công sự kiện lịch sử tiếng Anh là gì?", 2, "ĐÀI TƯỞNG NIỆM"),
    ("CASTLE", "Tòa lâu đài cổ kính của hoàng gia tiếng Anh là gì?", 1, "LÂU ĐÀI, TÒA LÂU ĐÀI"),
    ("PALACE", "Cung điện nguy nga lộng lẫy của vua chúa tiếng Anh là gì?", 1, "CUNG ĐIỆN"),
    ("TOWER", "Tòa tháp cao chọc trời sừng sững tiếng Anh là gì?", 1, "TÒA THÁP, THÁP"),
    ("HARBOR", "Bến cảng nơi tàu thuyền neo đậu tiếng Anh là gì?", 2, "BẾN CẢNG, CẢNG BIỂN, PORT"),
    ("LIGHTHOUSE", "Ngọn hải đăng dẫn lối cho tàu thuyền trong đêm tiếng Anh là gì?", 2, "HẢI ĐĂNG, NGỌN HẢI ĐĂNG"),
    ("STREETLIGHT", "Cột đèn đường thắp sáng phố đêm tiếng Anh là gì?", 1, "ĐÈN ĐƯỜNG, ĐÈN PHỐ"),
    ("SIDEWALK", "Vỉa hè phần đường dành cho người đi bộ tiếng Anh là gì?", 1, "VỈA HÈ, LỀ ĐƯỜNG, PAVEMENT"),
    ("CROSSWALK", "Vạch kẻ trắng qua đường cho người đi bộ tiếng Anh là gì?", 1, "VẠCH QUA ĐƯỜNG, VẠCH ĐI BỘ"),
    ("ALLEY", "Con ngõ nhỏ hẻm nhỏ len lỏi trong phố tiếng Anh là gì?", 2, "CON NGÕ, HẺM NHỎ, LANE")
]

target_file = os.path.join(GEN_DIR, '07-dong-tu-tinh-tu.txt')
appended = 0
lines = []

for ans, prompt, lvl, alts in items:
    low = ans.lower().strip()
    if low in set_keys or low in existing_gen:
        continue
    line = f"{ans} | {prompt} | {lvl} | {alts}\n"
    lines.append(line)
    existing_gen.add(low)
    appended += 1

with open(target_file, 'a', encoding='utf-8') as fp:
    fp.writelines(lines)

print(f"Appended {appended} new phrasal verbs & concepts into 07-dong-tu-tinh-tu.txt")
