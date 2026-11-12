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

pool = [
    # 01-dong-vat-thien-nhien.txt
    ("PELICAN", "Con chim bồ nông có chiếc túi lớn dưới mỏ tiếng Anh là gì?", 2, "BỒ NÔNG, CHIM BỒ NÔNG", "01-dong-vat-thien-nhien.txt"),
    ("CHAMELEON", "Con tắc kè hoa đổi màu da ngụy trang tài tình tiếng Anh là gì?", 2, "TẮC KÈ HOA, TẮC KÈ", "01-dong-vat-thien-nhien.txt"),
    ("PLATYPUS", "Thú mỏ vịt đẻ trứng độc đáo của nước Úc tiếng Anh là gì?", 3, "THÚ MỎ VỊT", "01-dong-vat-thien-nhien.txt"),
    ("SLOTH", "Con lười di chuyển chậm chạp trên cành cây tiếng Anh là gì?", 2, "CON LƯỜI", "01-dong-vat-thien-nhien.txt"),
    ("ARMADILLO", "Con tatu có lớp vỏ giáp cứng bảo vệ tiếng Anh là gì?", 3, "CON TATU", "01-dong-vat-thien-nhien.txt"),
    ("CHEETAH", "Báo săn loài động vật chạy nhanh nhất trên cạn tiếng Anh là gì?", 2, "BÁO SĂN, BÁO CHEETAH", "01-dong-vat-thien-nhien.txt"),
    ("HYENA", "Con linh cẩu ăn xác thối nơi thảo nguyên tiếng Anh là gì?", 2, "LINH CẨU", "01-dong-vat-thien-nhien.txt"),
    ("BADGER", "Con lửng mật gan dạ đối đầu mọi kẻ thù tiếng Anh là gì?", 3, "LỬNG MẬT, CON LỬNG", "01-dong-vat-thien-nhien.txt"),
    ("OTTER", "Con rái cá bơi lội bắt cá điêu luyện dưới nước tiếng Anh là gì?", 2, "RÁI CÁ, CON RÁI CÁ", "01-dong-vat-thien-nhien.txt"),
    ("MEERKAT", "Chồn đất meerkat đứng thẳng canh gác tiếng Anh là gì?", 2, "CHỒN ĐẤT, MEERKAT", "01-dong-vat-thien-nhien.txt"),
    ("WALRUS", "Con hải mã có hai chiếc răng nanh dài ngoằng tiếng Anh là gì?", 2, "HẢI MÃ", "01-dong-vat-thien-nhien.txt"),
    ("SEA LION", "Sư tử biển thích nô đùa trên mỏm đá tiếng Anh là gì?", 2, "SƯ TỬ BIỂN", "01-dong-vat-thien-nhien.txt"),
    ("STINGRAY", "Cá đuối gai độc bơi lượn đáy biển tiếng Anh là gì?", 2, "CÁ ĐUỐI", "01-dong-vat-thien-nhien.txt"),
    ("SEAHORSE", "Con cá ngựa nhỏ nhắn bơi đứng thẳng tiếng Anh là gì?", 2, "CÁ NGỰA", "01-dong-vat-thien-nhien.txt"),
    ("STARFISH", "Sao biển hình năm cánh bám trên đá ngầm tiếng Anh là gì?", 1, "SAO BIỂN", "01-dong-vat-thien-nhien.txt"),
    ("JELLYFISH", "Con sứa biển thân trong suốt dập dềnh theo sóng tiếng Anh là gì?", 1, "CON SỨA, SỨA BIỂN", "01-dong-vat-thien-nhien.txt"),
    ("SCORPION", "Con bọ cạp có chiếc đuôi cong chích nọc độc tiếng Anh là gì?", 2, "BỌ CẠP", "01-dong-vat-thien-nhien.txt"),
    ("CENTIPEDE", "Con rết nhiều chân chạy nhanh trong góc tối tiếng Anh là gì?", 2, "CON RẾT", "01-dong-vat-thien-nhien.txt"),
    ("CATERPILLAR", "Con sâu bướm chuẩn bị hóa kén tiếng Anh là gì?", 2, "SÂU BƯỚM", "01-dong-vat-thien-nhien.txt"),
    ("FIREFLY", "Con đom đóm phát sáng lập lòe đêm hè tiếng Anh là gì?", 1, "ĐOM ĐÓM", "01-dong-vat-thien-nhien.txt"),
    ("WOODPECKER", "Chim gõ kiến mổ thân cây tìm sâu bọ tiếng Anh là gì?", 2, "CHIM GÕ KIẾN, GÕ KIẾN", "01-dong-vat-thien-nhien.txt"),
    ("FLAMINGO", "Chim hồng hạc lông hồng đứng một chân tiếng Anh là gì?", 2, "HỒNG HẠC, CHIM HỒNG HẠC", "01-dong-vat-thien-nhien.txt"),
    ("HUMMINGBIRD", "Chim ruồi tí hon vỗ cánh cực nhanh hút mật tiếng Anh là gì?", 2, "CHIM RUỒI", "01-dong-vat-thien-nhien.txt"),
    ("SEAGULL", "Chim hải âu chao lượn trên mặt sóng biển tiếng Anh là gì?", 2, "HẢI ÂU, CHIM HẢI ÂU", "01-dong-vat-thien-nhien.txt"),
    ("FALCON", "Chim cắt săn mồi dũng mãnh lao từ trên cao tiếng Anh là gì?", 2, "CHIM CẮT", "01-dong-vat-thien-nhien.txt"),
    ("VULTURE", "Chim kền kền rỉa xác động vật thảo nguyên tiếng Anh là gì?", 3, "KỀN KỀN, CHIM KỀN KỀN", "01-dong-vat-thien-nhien.txt"),
    ("SWAN", "Thiên nga trắng muốt bơi kiêu sa trên hồ tiếng Anh là gì?", 1, "THIÊN NGA", "01-dong-vat-thien-nhien.txt"),
    ("PEACOCK", "Con công xòe chiếc đuôi sặc sỡ khoe sắc tiếng Anh là gì?", 1, "CON CÔNG, CHIM CÔNG", "01-dong-vat-thien-nhien.txt"),
    ("OSTRICH", "Đà điểu châu Phi to lớn chạy rất nhanh tiếng Anh là gì?", 2, "ĐÀ ĐIỂU", "01-dong-vat-thien-nhien.txt"),

    # 02-do-an-do-uong.txt
    ("CINNAMON", "Vỏ quế thơm nồng dùng làm gia vị trà bánh tiếng Anh là gì?", 2, "QUẾ, VỎ QUẾ", "02-do-an-do-uong.txt"),
    ("CORIANDER", "Rau mùi rau ngò thơm nêm vào phở tiếng Anh là gì?", 2, "RAU MÙI, RAU NGÒ, CILANTRO", "02-do-an-do-uong.txt"),
    ("ROSEMARY", "Lá hương thảo thơm lừng nướng cùng bò bít tết tiếng Anh là gì?", 2, "HƯƠNG THẢO, LÁ HƯƠNG THẢO", "02-do-an-do-uong.txt"),
    ("THYME", "Cỏ xạ hương gia vị phương Tây dậy mùi thơm tiếng Anh là gì?", 3, "XẠ HƯƠNG, CỎ XẠ HƯƠNG", "02-do-an-do-uong.txt"),
    ("VANILLA", "Hương vani thơm ngọt ngào cho kem và bánh tiếng Anh là gì?", 1, "VANI, HƯƠNG VANI", "02-do-an-do-uong.txt"),
    ("TURMERIC", "Củ nghệ vàng ươm tạo màu và tốt cho dạ dày tiếng Anh là gì?", 2, "CỦ NGHỆ, NGHỆ", "02-do-an-do-uong.txt"),
    ("GINGER", "Củ gừng cay nồng ấm bụng mùa đông tiếng Anh là gì?", 1, "CỦ GỪNG, GỪNG", "02-do-an-do-uong.txt"),
    ("BASIL", "Lá húng quế thơm ăn kèm phở bò tiếng Anh là gì?", 2, "HÚNG QUẾ, RAU HÚNG", "02-do-an-do-uong.txt"),
    ("CELERY", "Cần tây giòn thanh dùng ép nước giảm cân tiếng Anh là gì?", 2, "CẦN TÂY", "02-do-an-do-uong.txt"),
    ("ASPARAGUS", "Măng tây xanh giòn ngọt xào tỏi tiếng Anh là gì?", 2, "MĂNG TÂY", "02-do-an-do-uong.txt"),
    ("ZUCCHINI", "Bí ngòi xanh mát xào thịt bò tiếng Anh là gì?", 2, "BÍ NGÒI", "02-do-an-do-uong.txt"),
    ("EGGPLANT", "Quả cà tím nướng mỡ hành thơm nức tiếng Anh là gì?", 2, "CÀ TÍM, AUBERGINE", "02-do-an-do-uong.txt"),
    ("CAULIFLOWER", "Súp lơ trắng nấu canh sườn ngọt nước tiếng Anh là gì?", 2, "SÚP LƠ TRẮNG, HOA LƠ", "02-do-an-do-uong.txt"),
    ("BROCCOLI", "Súp lơ xanh giàu vitamin tốt cho sức khỏe tiếng Anh là gì?", 1, "SÚP LƠ XANH, BÔNG CẢI XANH", "02-do-an-do-uong.txt"),
    ("BEETROOT", "Củ dền đỏ thắm hầm súp canh màu đỏ tiếng Anh là gì?", 2, "CỦ DỀN", "02-do-an-do-uong.txt"),
    ("RADISH", "Củ cải trắng thanh mát giải nhiệt tiếng Anh là gì?", 2, "CỦ CẢI", "02-do-an-do-uong.txt"),
    ("POMEGRANATE", "Quả lựu đỏ rực đầy hạt mọng nước tiếng Anh là gì?", 2, "QUẢ LỰU, TRÁI LỰU", "02-do-an-do-uong.txt"),
    ("APRICOT", "Quả mơ vàng ươm ngâm đường chua ngọt tiếng Anh là gì?", 2, "QUẢ MƠ, TRÁI MƠ", "02-do-an-do-uong.txt"),
    ("PLUM", "Quả mận giòn chua chấm muối ớt tiếng Anh là gì?", 1, "QUẢ MẬN, TRÁI MẬN", "02-do-an-do-uong.txt"),
    ("BLUEBERRY", "Quả việt quất tím thẫm giàu chất chống oxy hóa tiếng Anh là gì?", 1, "VIỆT QUẤT, QUẢ VIỆT QUẤT", "02-do-an-do-uong.txt"),
    ("RASPBERRY", "Quả mâm xôi đỏ tươi chua thanh mát tiếng Anh là gì?", 2, "MÂM XÔI, QUẢ MÂM XÔI", "02-do-an-do-uong.txt"),
    ("ALMOND", "Hạt hạnh nhân bùi béo tốt cho tim mạch tiếng Anh là gì?", 2, "HẠNH NHÂN, HẠT HẠNH NHÂN", "02-do-an-do-uong.txt"),
    ("WALNUT", "Hạt óc chó vỏ cứng bùi ngậy bổ não tiếng Anh là gì?", 2, "ÓC CHÓ, HẠT ÓC CHÓ", "02-do-an-do-uong.txt"),
    ("CASHEW", "Hạt điều rang muối thơm giòn béo ngậy tiếng Anh là gì?", 2, "HẠT ĐIỀU", "02-do-an-do-uong.txt"),
    ("PISTACHIO", "Hạt dẻ cười vỏ hé mở đón Tết tiếng Anh là gì?", 2, "HẠT DẺ CƯỜI", "02-do-an-do-uong.txt"),
    ("SESAME", "Hạt vừng hạt mè rắc lên chè bánh tiếng Anh là gì?", 2, "MÈ, VỪNG, HẠT MÈ", "02-do-an-do-uong.txt"),
    ("PANCAKE", "Bánh kếp nướng chảo rưới mật ong thơm lừng tiếng Anh là gì?", 1, "BÁNH KẾP", "02-do-an-do-uong.txt"),
    ("WAFFLE", "Bánh tổ ong nướng giòn rụm kẹp kem tiếng Anh là gì?", 1, "BÁNH TỔ ONG, WAFFLE", "02-do-an-do-uong.txt"),
    ("MUFFIN", "Chiếc bánh nướng xốp nhỏ trong khuôn giấy tiếng Anh là gì?", 1, "BÁNH MUFFIN", "02-do-an-do-uong.txt"),
    ("CROISSANT", "Bánh sừng bò ngàn lớp xốp bơ thơm phức tiếng Anh là gì?", 1, "BÁNH SỪNG BÒ", "02-do-an-do-uong.txt"),
    ("OMELET", "Món trứng cuộn tráng vàng ruộm bữa sáng tiếng Anh là gì?", 1, "TRỨNG CUỘN, TRỨNG RÁN, OMELETTE", "02-do-an-do-uong.txt"),
    ("PORRIDGE", "Món cháo hoa nóng hổi ấm bụng buổi sớm tiếng Anh là gì?", 2, "CHÁO, BÁT CHÁO, CONGEE", "02-do-an-do-uong.txt"),

    # 03-nha-cua-quan-ao.txt
    ("WARDROBE", "Tủ quần áo lớn bằng gỗ trong phòng ngủ tiếng Anh là gì?", 1, "TỦ QUẦN ÁO, CLOSET", "03-nha-cua-quan-ao.txt"),
    ("ARMCHAIR", "Chiếc ghế bành êm ái có chỗ tỳ tay tiếng Anh là gì?", 1, "GHẾ BÀNH", "03-nha-cua-quan-ao.txt"),
    ("BOOKSHELF", "Kệ sách giá sách xếp ngay ngắn tiếng Anh là gì?", 1, "KỆ SÁCH, GIÁ SÁCH, BOOKCASE", "03-nha-cua-quan-ao.txt"),
    ("FIREPLACE", "Lò sưởi ấm cúng trong phòng khách mùa đông tiếng Anh là gì?", 2, "LÒ SƯỞI", "03-nha-cua-quan-ao.txt"),
    ("CHANDELIER", "Đèn chùm pha lê lộng lẫy treo trên trần nhà tiếng Anh là gì?", 2, "ĐÈN CHÙM", "03-nha-cua-quan-ao.txt"),
    ("CURTAIN", "Rèm cửa che nắng gió bên khung cửa sổ tiếng Anh là gì?", 1, "RÈM CỬA, MÀN CỬA, DRAPE", "03-nha-cua-quan-ao.txt"),
    ("CARPET", "Tấm thảm trải sàn dệt hoa văn mềm mại tiếng Anh là gì?", 1, "THẢM TRẢI SÀN, THẢM, RUG", "03-nha-cua-quan-ao.txt"),
    ("PILLOW", "Chiếc gối đầu êm ái ru giấc ngủ ngon tiếng Anh là gì?", 1, "CHIẾC GỐI, GỐI ĐẦU", "03-nha-cua-quan-ao.txt"),
    ("CUSHION", "Chiếc đệm gối tựa lưng đặt trên ghế sô pha tiếng Anh là gì?", 1, "ĐỆM TỰA, GỐI TỰA", "03-nha-cua-quan-ao.txt"),
    ("BLANKET", "Chiếc chăn ấm đắp khi trời trở gió lạnh tiếng Anh là gì?", 1, "CHIẾC CHĂN, MỀN, CHĂN ĐẮP", "03-nha-cua-quan-ao.txt"),
    ("MATTRESS", "Tấm nệm giường nằm êm lưng tiếng Anh là gì?", 2, "TẤM NỆM, ĐỆM GIƯỜNG", "03-nha-cua-quan-ao.txt"),
    ("BEDSHEET", "Tấm ga trải giường phẳng phiu sạch sẽ tiếng Anh là gì?", 2, "GA TRẢI GIƯỜNG, GA GIƯỜNG", "03-nha-cua-quan-ao.txt"),
    ("TOWEL", "Khăn tắm mềm dùng lau khô người tiếng Anh là gì?", 1, "KHĂN TẮM, KHĂN LAU", "03-nha-cua-quan-ao.txt"),
    ("FAUCET", "Vòi nước xả bồn rửa tay tiếng Anh là gì?", 2, "VÒI NƯỚC, TAP", "03-nha-cua-quan-ao.txt"),
    ("BATHTUB", "Bồn tắm ngâm mình thư giãn bằng nước ấm tiếng Anh là gì?", 1, "BỒN TẮM", "03-nha-cua-quan-ao.txt"),
    ("SHOWER", "Vòi hoa sen phun tia nước tắm mát tiếng Anh là gì?", 1, "VÒI HOA SEN, TẮM VÒI SEN", "03-nha-cua-quan-ao.txt"),
    ("BLENDER", "Máy xay sinh tố xay nhuyễn hoa quả tiếng Anh là gì?", 1, "MÁY XAY SINH TỐ, MÁY XAY", "03-nha-cua-quan-ao.txt"),
    ("TOASTER", "Máy nướng bánh mì gối lát vàng giòn tiếng Anh là gì?", 1, "MÁY NƯỚNG BÁNH MÌ", "03-nha-cua-quan-ao.txt"),
    ("MICROWAVE", "Lò vi sóng hâm nóng thức ăn trong nháy mắt tiếng Anh là gì?", 1, "LÒ VI SÓNG", "03-nha-cua-quan-ao.txt"),
    ("KETTLE", "Ấm đun nước siêu tốc sôi sùng sục tiếng Anh là gì?", 1, "ẤM ĐUN NƯỚC, ẤM NƯỚC", "03-nha-cua-quan-ao.txt")
]

by_file = {}
added = 0

for ans, prompt, lvl, alts, fname in pool:
    low = ans.lower().strip()
    if low in set_keys or low in existing_gen:
        continue
    line = f"{ans} | {prompt} | {lvl} | {alts}\n"
    by_file.setdefault(fname, []).append(line)
    existing_gen.add(low)
    added += 1

for fname, lines in by_file.items():
    fpath = os.path.join(GEN_DIR, fname)
    with open(fpath, 'a', encoding='utf-8') as fp:
        fp.writelines(lines)
    print(f"Appended {len(lines)} questions to {fname}")

print(f"Total new unique questions added: {added}")
