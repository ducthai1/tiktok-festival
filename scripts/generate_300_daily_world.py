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

# Rich everyday vocabulary (tools, feelings, science, communication, occupations, society)
pool = [
    # Tools, Materials & Objects
    ("PLIERS", "Cái kìm bấm để bẻ dây kẽm uốn kim loại tiếng Anh là gì?", 2, "CÁI KÌM, KÌM BẤM"),
    ("SAW", "Chiếc cưa tay dùng cưa gỗ xẻ củi tiếng Anh là gì?", 1, "CÁI CƯA, CÂY CƯA"),
    ("AXE", "Cây rìu bổ củi đốn củi trong rừng tiếng Anh là gì?", 1, "CÂY RÌU, CÁI RÌU"),
    ("SHOVEL", "Cái xẻng xúc đất xúc cát làm vườn tiếng Anh là gì?", 1, "CÁI XẺNG, CHIẾC XẺNG"),
    ("RAKE", "Cái cào sắt gom lá khô gom rác vườn tiếng Anh là gì?", 2, "CÁI CÀO, CÀO LÁ"),
    ("NAIL", "Cây đinh sắt đóng vào tường gỗ tiếng Anh là gì?", 1, "CÂY ĐINH, CHIẾC ĐINH"),
    ("SCREW", "Con ốc vít ren xoắn siết chặt đồ đạc tiếng Anh là gì?", 1, "ỐC VÍT, ĐINH VÍT"),
    ("BOLT", "Bu lông ốc vít cỡ lớn có ren vặn đai ốc tiếng Anh là gì?", 2, "BU LÔNG, BÙ LOONG"),
    ("NUT", "Đai ốc ê-cu vặn khớp với bu lông tiếng Anh là gì?", 2, "ĐAI ỐC, Ê CU"),
    ("DRILL", "Máy khoan cầm tay khoan lỗ trên tường tiếng Anh là gì?", 1, "MÁY KHOAN, CÁI KHOAN"),
    ("PADLOCK", "Ổ khóa móc sắt bấm lại bảo vệ cửa nhà tiếng Anh là gì?", 2, "Ổ KHÓA, KHÓA BẤM"),
    ("CHAIN", "Sợi dây xích bằng sắt chắc chắn khóa cổng tiếng Anh là gì?", 1, "DÂY XÍCH, XÍCH"),
    ("ROPE", "Sợi dây thừng bện dẻo dai buộc thuyền tiếng Anh là gì?", 1, "DÂY THỪNG, DÂY DÙ"),
    ("THREAD", "Sợi chỉ khâu vá quần áo tiếng Anh là gì?", 1, "SỢI CHỈ, CHỈ KHÂU"),
    ("NEEDLE", "Cây kim may vá xỏ chỉ qua lỗ kim tiếng Anh là gì?", 1, "CÂY KIM, CÁI KIM"),
    ("BUTTON", "Chiếc cúc áo khuy áo cài áo sơ mi tiếng Anh là gì?", 1, "CÚC ÁO, KHUY ÁO"),
    ("ZIPPER", "Khóa kéo séc-mơ-tuya trên áo khoác quần bò tiếng Anh là gì?", 1, "KHÓA KÉO, DÂY KÉO"),
    ("BUCKLE", "Mặt khóa dây thắt lưng bằng kim loại tiếng Anh là gì?", 2, "MẶT THẮT LƯNG, MẶT KHÓA"),
    ("UMBRELLA", "Chiếc ô dù che mưa che nắng tiện lợi tiếng Anh là gì?", 1, "CHIẾC Ô, CÁI DÙ"),
    ("RAINCOAT", "Chiếc áo mưa mặc khi đi xe máy trời đổ mưa tiếng Anh là gì?", 1, "ÁO MƯA, CHIẾC ÁO MƯA"),
    ("SUNSCREEN", "Kem chống nắng bảo vệ làn da khỏi tia cực tím tiếng Anh là gì?", 1, "KEM CHỐNG NẮNG"),
    ("LIPSTICK", "Cây son môi tô màu hồng thắm cho phái đẹp tiếng Anh là gì?", 1, "SON MÔI, THỎI SON"),
    ("PERFUME", "Nước hoa xịt thơm cơ thể tỏa hương quyến rũ tiếng Anh là gì?", 1, "NƯỚC HOA, DẦU THƠM"),
    ("SHAMPOO", "Dầu gội đầu làm sạch mượt mái tóc tiếng Anh là gì?", 1, "DẦU GỘI, DẦU GỘI ĐẦU"),
    ("SOAP", "Bánh xà phòng thơm rửa tay diệt khuẩn tiếng Anh là gì?", 1, "XÀ PHÒNG, XÀ BÔNG"),
    ("TOOTHBRUSH", "Bàn chải đánh răng làm sạch răng mỗi sáng tiếng Anh là gì?", 1, "BÀN CHẢI ĐÁNH RĂNG"),
    ("TOOTHPASTE", "Tuýp kem đánh răng thơm mát hương bạc hà tiếng Anh là gì?", 1, "KEM ĐÁNH RĂNG"),
    ("COMB", "Chiếc lược chải tóc mượt mà trước gương tiếng Anh là gì?", 1, "CHIẾC LƯỢC, CÁI LƯỢC"),
    ("MIRROR", "Chiếc gương soi hình ảnh phản chiếu khuôn mặt tiếng Anh là gì?", 1, "CHIẾC GƯƠNG, TẤM GƯƠNG"),
    ("SCALES", "Chiếc cân đo trọng lượng cân nặng cơ thể tiếng Anh là gì?", 2, "CHIẾC CÂN, CÁI CÂN"),

    # Body, Health & Feelings (distinct, not clinical)
    ("HEEL", "Gót chân chịu lực khi bước đi tiếng Anh là gì?", 1, "GÓT CHÂN"),
    ("ANKLE", "Mắt cá chân khớp nối giữa chân và bàn chân tiếng Anh là gì?", 2, "MẮT CÁ CHÂN"),
    ("ELBOW", "Khớp khuỷu tay gập duỗi cánh tay tiếng Anh là gì?", 1, "KHUỶU TAY, CÙI CHỎ"),
    ("WRIST", "Cổ tay nơi đeo chiếc đồng hồ đeo tay tiếng Anh là gì?", 1, "CỔ TAY"),
    ("CHIN", "Cằm phía dưới khuôn mặt dưới bờ môi tiếng Anh là gì?", 1, "CẰM"),
    ("CHEEK", "Đôi gò má hồng hào phúng phính tiếng Anh là gì?", 1, "MÁ, GÒ MÁ"),
    ("FOREHEAD", "Vầng trán cao thông minh trên gương mặt tiếng Anh là gì?", 1, "VẦNG TRÁN, TRÁN"),
    ("EYEBROW", "Hàng lông mày lá liễu uốn cong trên mắt tiếng Anh là gì?", 1, "LÔNG MÀY"),
    ("EYELASH", "Hàng lông mi cong vút chớp chớp che chở cho mắt tiếng Anh là gì?", 1, "LÔNG MI"),
    ("THUMB", "Ngón tay cái giơ lên biểu thị số một hoặc tuyệt vời tiếng Anh là gì?", 1, "NGÓN TAY CÁI, NGÓN CÁI"),
    ("PALM", "Lòng bàn tay mở ra đón nhận tiếng Anh là gì?", 1, "LÒNG BÀN TAY"),
    ("HIP", "Hông eo lắc lư theo điệu nhảy tiếng Anh là gì?", 1, "HÔNG, EO HÔNG"),
    ("THIGH", "Bắp đùi chân săn chắc nhờ tập luyện tiếng Anh là gì?", 2, "BẮP ĐÙI, ĐÙI"),
    ("SPINE", "Cột sống chạy dọc theo sống lưng người tiếng Anh là gì?", 2, "CỘT SỐNG, SỐNG LƯNG"),
    ("RIB", "Chiếc xương sườn bảo vệ lồng ngực tiếng Anh là gì?", 2, "XƯƠNG SƯỜN"),

    # Nature, Weather & Geography
    ("PUDDLE", "Vũng nước mưa nhỏ đọng trên đường sau cơn mưa tiếng Anh là gì?", 2, "VŨNG NƯỚC"),
    ("MIST", "Làn sương mù mỏng manh giăng nhẹ buổi sớm mai tiếng Anh là gì?", 2, "SƯƠNG MÙ NHẸ, LÀN SƯƠNG, FOG"),
    ("FROST", "Băng giá sương muối phủ trắng cành cây mùa đông tiếng Anh là gì?", 2, "BĂNG GIÁ, SƯƠNG MUỐI"),
    ("HAIL", "Mưa đá những viên đá băng rơi rào rào từ trời tiếng Anh là gì?", 2, "MƯA ĐÁ"),
    ("DOWNPOUR", "Cơn mưa rào trút nước như thác đổ tiếng Anh là gì?", 2, "MƯA RÀO, MƯA TRÚT NƯỚC"),
    ("DRIZZLE", "Cơn mưa phùn lất phất se lạnh đầu xuân tiếng Anh là gì?", 2, "MƯA PHÙN, MƯA BỤI"),
    ("SHOWER_RAIN", "Cơn mưa rào thoảng qua chợt đến chợt đi tiếng Anh là gì?", 2, "MƯA RÀO THOẢNG"),
    ("SUNSHINE", "Ánh nắng vàng chan hòa sưởi ấm vạn vật tiếng Anh là gì?", 1, "ÁNH NẮNG, ÁNH MẶT TRỜI"),
    ("HEATWAVE", "Đợt nắng nóng gay gắt oi bức mùa hè tiếng Anh là gì?", 2, "ĐỢT NẮNG NÓNG, SÓNG NHIỆT"),
    ("COLD_SPELL", "Đợt không khí lạnh rét căm căm tràn về tiếng Anh là gì?", 2, "ĐỢT RÉT, ĐỢT LẠNH"),

    # Verbs of Motion, Communication & Mind
    ("STROLL", "Đi dạo tản bộ thong dong bên bờ hồ tiếng Anh là gì?", 1, "TẢN BỘ, ĐI DẠO"),
    ("CRAWL", "Bò trườn bé tập bò trên sàn nhà tiếng Anh là gì?", 1, "BÒ, TRƯỜN"),
    ("LEAP", "Nhảy vọt qua con rãnh nhỏ bước nhảy xa tiếng Anh là gì?", 2, "NHẢY VỌT, BƯỚC NHẢY"),
    ("DIVE", "Lao đầu lặn xuống hồ nước trong xanh tiếng Anh là gì?", 1, "LẶN XUỐNG, LAO ĐẦU"),
    ("CLIMB", "Leo trèo leo lên đỉnh núi dốc tiếng Anh là gì?", 1, "LEO TRÈO, LEO NÚI"),
    ("SLIDE", "Trượt cầu trượt trượt dốc thú vị tiếng Anh là gì?", 1, "TRƯỢT, CẦU TRƯỢT"),
    ("SPRINT", "Chạy nước rút hết tốc lực về đích tiếng Anh là gì?", 2, "CHẠY NƯỚC RÚT"),
    ("MARCH", "Hành quân bước đều bước theo đội ngũ tiếng Anh là gì?", 2, "HÀNH QUÂN, BƯỚC ĐỀU"),
    ("TIPTOE", "Đi nhón chân rón rén nhẹ nhàng không phát ra tiếng tiếng Anh là gì?", 2, "ĐI NHÓN CHÂN, RÓN RÉN"),
    ("STUMBLE", "Vấp ngã loạng choạng suýt ngã nhào tiếng Anh là gì?", 2, "VẤP NGÃ, LOẠNG CHOẠNG"),
    ("SHIVER", "Rùng mình run rẩy vì trời quá rét buốt tiếng Anh là gì?", 2, "RUN RẨY, RÙNG MÌNH, TREMBLE"),
    ("SWEAT", "Đổ mồ hôi nhễ nhại sau buổi tập mệt tiếng Anh là gì?", 1, "ĐỔ MỒ HÔI, MỒ HÔI, PERSPIRATION"),
    ("SNEEZE", "Hắt xì hơi một cái thật to vì dị ứng tiếng Anh là gì?", 1, "HẮT HƠI, HẮT XÌ"),
    ("COUGH", "Ho khúng khắng vì viêm họng tiếng Anh là gì?", 1, "HO, TIẾNG HO"),
    ("HICCOUP", "Nấc cụt từng cơn do uống nước vội tiếng Anh là gì?", 2, "NẤC CỤT, HICCUP"),
    ("SNOCK", "Ngáy khò khò khi ngủ say sưa tiếng Anh là gì?", 1, "NGÁY, SNORE"),
    ("BLINK", "Chớp mắt chớp chớp liên hồi khi chói nắng tiếng Anh là gì?", 1, "CHỚP MẮT"),
    ("WINK", "Nháy một bên mắt đầy ngụ ý hài hước tiếng Anh là gì?", 1, "NHÁY MẮT"),
    ("NOD", "Gật đầu đồng ý tán thành tiếng Anh là gì?", 1, "GẬT ĐẦU"),
    ("SHAKE HEAD", "Lắc đầu từ chối không chấp nhận tiếng Anh là gì?", 1, "LẮC ĐẦU"),

    # Descriptive Adjectives
    ("CRISP", "Giòn rụm quả táo tươi cắn vào giòn tan tiếng Anh là gì?", 2, "GIÒN RỤM, GIÒN TAN"),
    ("JUICY", "Mọng nước quả cam quả dưa hấu nhiều nước tiếng Anh là gì?", 1, "MỌNG NƯỚC, NHIỀU NƯỚC"),
    ("TENDER", "Mềm mại miếng thịt thăn nấu chín mềm tiếng Anh là gì?", 2, "MỀM MẠI, MỀM"),
    ("BITTER", "Đắng ngắt như vị thuốc nam tiếng Anh là gì?", 1, "ĐẮNG, VỊ ĐẮNG"),
    ("SOUR", "Chua lòm quả chanh quả khế tươi tiếng Anh là gì?", 1, "CHUA, VỊ CHUA"),
    ("SALTY", "Mặn mòi như vị muối biển tiếng Anh là gì?", 1, "MẶN, VỊ MẶN"),
    ("SWEET", "Ngọt ngào như viên kẹo viên đường tiếng Anh là gì?", 1, "NGỌT, VỊ NGỌT"),
    ("SPICY", "Cay xè quả ớt hiểm làm tê đầu lưỡi tiếng Anh là gì?", 1, "CAY, VỊ CAY, HOT"),
    ("BLAND", "Nhạt nhẽo vô vị không nêm gia vị tiếng Anh là gì?", 2, "NHẠT NHẼO, VÔ VỊ"),
    ("FRAGRANT", "Thơm ngát hương hoa thơm ngào ngạt tiếng Anh là gì?", 2, "THƠM NGÁT, NGÀO NGẠT"),
    ("STINKY", "Hôi thối bốc mùi khó chịu tiếng Anh là gì?", 1, "HÔI THỐI, BỐC MÙI, SMELLY"),
    ("SHARP", "Sắc bén lưỡi dao con dao gọt hoa quả tiếng Anh là gì?", 1, "SẮC BÉN, BÉN"),
    ("BLUNT", "Cùn lưỡi kéo cùn cắt không đứt tiếng Anh là gì?", 2, "CÙN"),
    ("SMOOTH", "Mịn màng nhẵn thín làn da em bé tiếng Anh là gì?", 1, "MỊN MÀNG, NHẴN"),
    ("ROUGH", "Gồ ghề ráp thô nhám bề mặt đá sỏi tiếng Anh là gì?", 2, "GỒ GHỀ, THÔ RÁP"),
    ("TIGHT", "Chật chội bó sát bộ quần áo vừa may tiếng Anh là gì?", 1, "CHẶT, BÓ SÁT, CHẬT"),
    ("LOOSE", "Rộng thùng thình lỏng lẻo thoải mái tiếng Anh là gì?", 1, "RỘNG, LỎNG LẺO"),
    ("HEAVY", "Nặng nề tảng đá nặng khó nhấc lên tiếng Anh là gì?", 1, "NẶNG, NẶNG NỀ"),
    ("LIGHT_WEIGHT", "Nhẹ bẫng lông hồng bay phất phơ tiếng Anh là gì?", 1, "NHẸ, NHẸ BÃNG"),
    ("FIRM", "Chắc chắn kiên cố đệm nằm không lún tiếng Anh là gì?", 2, "CHẮC CHẮN, KIÊN CỐ")
]

target_file = os.path.join(GEN_DIR, '07-dong-tu-tinh-tu.txt')
appended = 0
lines = []

for ans, prompt, lvl, alts in pool:
    ans_clean = ans.replace('_', ' ')
    low = ans_clean.lower().strip()
    if low in set_keys or low in existing_gen:
        continue
    line = f"{ans_clean} | {prompt} | {lvl} | {alts}\n"
    lines.append(line)
    existing_gen.add(low)
    appended += 1

with open(target_file, 'a', encoding='utf-8') as fp:
    fp.writelines(lines)

print(f"Appended {appended} new daily world words into 07-dong-tu-tinh-tu.txt")
