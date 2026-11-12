import os
import re

# Load set keys to ensure 0 overlap
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
                ans = line.split('|')[0].strip().lower()
                set_keys.add(ans)

# Load existing general answers
existing_gen = set()
for f in os.listdir(GEN_DIR):
    if f.endswith('.txt'):
        with open(os.path.join(GEN_DIR, f), 'r', encoding='utf-8') as fp:
            for line in fp:
                line = line.strip()
                if not line or line.startswith('#'): continue
                ans = line.split('|')[0].strip().lower()
                existing_gen.add(ans)

print(f"Set keys: {len(set_keys)}, Existing general: {len(existing_gen)}")

# Rich vocabulary categorized
# Format: (answer, prompt, level, alts, target_file)
new_entries = []

vocab_data = [
    # 08-khoa-hoc-vu-tru.txt
    ("ASTRONOMY", "Ngành thiên văn học nghiên cứu các thiên thể ngoài vũ trụ tiếng Anh là gì?", 2, "THIÊN VĂN HỌC", "08-khoa-hoc-vu-tru.txt"),
    ("GRAVITY", "Trọng lực hoặc lực hấp dẫn của Trái Đất tiếng Anh là gì?", 1, "LỰC HẤP DẪN, TRỌNG LỰC", "08-khoa-hoc-vu-tru.txt"),
    ("ORBIT", "Quỹ đạo quay của một hành tinh quanh Mặt Trời tiếng Anh là gì?", 2, "QUỸ ĐẠO", "08-khoa-hoc-vu-tru.txt"),
    ("ECLIPSE", "Hiện tượng nhật thực hoặc nguyệt thực tiếng Anh là gì?", 2, "NHẬT THỰC, NGUYỆT THỰC", "08-khoa-hoc-vu-tru.txt"),
    ("METEOR", "Sao băng lướt nhanh qua bầu trời đêm tiếng Anh là gì?", 1, "SAO BĂNG, METEORITE", "08-khoa-hoc-vu-tru.txt"),
    ("COMET", "Sao chổi có chiếc đuôi phát sáng dài tiếng Anh là gì?", 2, "SAO CHỔI", "08-khoa-hoc-vu-tru.txt"),
    ("SOLAR SYSTEM", "Hệ Mặt Trời bao gồm Mặt Trời và các hành tinh tiếng Anh là gì?", 1, "HỆ MẶT TRỜI", "08-khoa-hoc-vu-tru.txt"),
    ("ATMOSPHERE", "Bầu khí quyển bao bọc quanh Trái Đất tiếng Anh là gì?", 2, "KHÍ QUYỂN", "08-khoa-hoc-vu-tru.txt"),
    ("OXYGEN", "Khí oxy rất cần thiết cho sự sống và hô hấp tiếng Anh là gì?", 1, "OXY, KHÍ OXY", "08-khoa-hoc-vu-tru.txt"),
    ("HYDROGEN", "Khí hydro nhẹ nhất trong bảng tuần hoàn tiếng Anh là gì?", 2, "HYDRO, KHÍ HYDRO", "08-khoa-hoc-vu-tru.txt"),
    ("CARBON", "Nguyên tố cacbon có trong mọi hợp chất hữu cơ tiếng Anh là gì?", 2, "CACBON", "08-khoa-hoc-vu-tru.txt"),
    ("MOLECULE", "Phân tử gồm nhiều nguyên tử liên kết lại tiếng Anh là gì?", 2, "PHÂN TỬ", "08-khoa-hoc-vu-tru.txt"),
    ("ATOM", "Nguyên tử đơn vị cơ bản cấu tạo nên vật chất tiếng Anh là gì?", 2, "NGUYÊN TỬ", "08-khoa-hoc-vu-tru.txt"),
    ("RADIATION", "Bức xạ nhiệt hoặc bức xạ phóng xạ tiếng Anh là gì?", 3, "BỨC XẠ", "08-khoa-hoc-vu-tru.txt"),
    ("SATELLITE", "Vệ tinh nhân tạo hoặc vệ tinh tự nhiên quay quanh hành tinh tiếng Anh là gì?", 2, "VỆ TINH", "08-khoa-hoc-vu-tru.txt"),
    ("COSMOS", "Vũ trụ bao la vô tận tiếng Anh là gì?", 2, "VŨ TRỤ, UNIVERSE", "08-khoa-hoc-vu-tru.txt"),
    ("CONSTELLATION", "Chòm sao trên bầu trời đêm tiếng Anh là gì?", 3, "CHÒM SAO", "08-khoa-hoc-vu-tru.txt"),
    ("LIGHT YEAR", "Năm ánh sáng đơn vị đo khoảng cách trong thiên văn tiếng Anh là gì?", 2, "NĂM ÁNH SÁNG", "08-khoa-hoc-vu-tru.txt"),
    ("MICROSCOPE", "Kính hiển vi dùng quan sát vi sinh vật siêu nhỏ tiếng Anh là gì?", 2, "KÍNH HIỂN VI", "08-khoa-hoc-vu-tru.txt"),
    ("LABORATORY", "Phòng thí nghiệm khoa học tiếng Anh là gì?", 2, "PHÒNG THÍ NGHIỆM, LAB", "08-khoa-hoc-vu-tru.txt"),
    ("EXPERIMENT", "Cuộc thí nghiệm hoặc thử nghiệm khoa học tiếng Anh là gì?", 2, "THÍ NGHIỆM", "08-khoa-hoc-vu-tru.txt"),
    ("HYPOTHESIS", "Giả thuyết khoa học được đặt ra trước khi chứng minh tiếng Anh là gì?", 3, "GIẢ THUYẾT", "08-khoa-hoc-vu-tru.txt"),
    ("EVOLUTION", "Sự tiến hóa của các loài sinh vật qua thời gian tiếng Anh là gì?", 2, "TIẾN HÓA", "08-khoa-hoc-vu-tru.txt"),
    ("GENETICS", "Di truyền học nghiên cứu về gen và ADN tiếng Anh là gì?", 3, "DI TRUYỀN HỌC", "08-khoa-hoc-vu-tru.txt"),
    ("PHOTOSYNTHESIS", "Quá trình quang hợp của cây xanh tạo ra oxy tiếng Anh là gì?", 3, "QUANG HỢP", "08-khoa-hoc-vu-tru.txt"),
    ("ECOSYSTEM", "Hệ sinh thái tự nhiên giữa sinh vật và môi trường tiếng Anh là gì?", 2, "HỆ SINH THÁI", "08-khoa-hoc-vu-tru.txt"),
    ("BIODIVERSITY", "Sự đa dạng sinh học trong tự nhiên tiếng Anh là gì?", 3, "ĐA DẠNG SINH HỌC", "08-khoa-hoc-vu-tru.txt"),
    ("THERMODYNAMICS", "Nhiệt động lực học trong vật lý tiếng Anh là gì?", 3, "NHIỆT ĐỘNG LỰC HỌC", "08-khoa-hoc-vu-tru.txt"),
    ("MAGNETISM", "Hiện tượng từ tính của nam châm tiếng Anh là gì?", 2, "TỪ TÍNH, TỪ TRƯỜNG", "08-khoa-hoc-vu-tru.txt"),
    ("VOLTAGE", "Điện áp hoặc hiệu điện thế tiếng Anh là gì?", 2, "ĐIỆN ÁP, HIỆU ĐIỆN THẾ", "08-khoa-hoc-vu-tru.txt"),

    # 09-nghe-thuat-giai-tri.txt
    ("SCULPTURE", "Tác phẩm điêu khắc hoặc tượng nghệ thuật tiếng Anh là gì?", 2, "ĐIÊU KHẮC, TƯỢNG", "09-nghe-thuat-giai-tri.txt"),
    ("PORTRAIT", "Bức tranh vẽ chân dung một người tiếng Anh là gì?", 1, "TRANH CHÂN DUNG, CHÂN DUNG", "09-nghe-thuat-giai-tri.txt"),
    ("LANDSCAPE", "Tranh phong cảnh thiên nhiên tiếng Anh là gì?", 1, "PHONG CẢNH, TRANH PHONG CẢNH", "09-nghe-thuat-giai-tri.txt"),
    ("EXHIBITION", "Buổi triển lãm tranh hoặc tác phẩm nghệ thuật tiếng Anh là gì?", 2, "TRIỂN LÃM", "09-nghe-thuat-giai-tri.txt"),
    ("GALLERY", "Phòng trưng bày tranh nghệ thuật tiếng Anh là gì?", 1, "PHÒNG TRƯNG BÀY, PHÒNG TRANH", "09-nghe-thuat-giai-tri.txt"),
    ("SKETCH", "Bản vẽ phác thảo chì nhanh tiếng Anh là gì?", 1, "PHÁC THẢO, BẢN PHÁC THẢO", "09-nghe-thuat-giai-tri.txt"),
    ("CANVAS", "Khung vải toan dùng để vẽ tranh sơn dầu tiếng Anh là gì?", 2, "VẢI VẼ TRANH, TOAN VẼ", "09-nghe-thuat-giai-tri.txt"),
    ("EASEL", "Giá đỡ ba chân để đặt tranh vẽ tiếng Anh là gì?", 3, "GIÁ VẼ", "09-nghe-thuat-giai-tri.txt"),
    ("PALETTE", "Khay pha màu vẽ của họa sĩ tiếng Anh là gì?", 2, "BẢNG PHA MÀU, KHAY PHA MÀU", "09-nghe-thuat-giai-tri.txt"),
    ("WATERCOLOR", "Màu nước dùng trong hội họa tiếng Anh là gì?", 2, "MÀU NƯỚC", "09-nghe-thuat-giai-tri.txt"),
    ("OIL PAINTING", "Tranh sơn dầu nghệ thuật tiếng Anh là gì?", 2, "TRANH SƠN DẦU", "09-nghe-thuat-giai-tri.txt"),
    ("CALLIGRAPHY", "Nghệ thuật viết thư pháp chữ đẹp tiếng Anh là gì?", 3, "THƯ PHÁP", "09-nghe-thuat-giai-tri.txt"),
    ("POTTERY", "Nghệ thuật làm đồ gốm sứ thủ công tiếng Anh là gì?", 2, "ĐỒ GỐM, GỐM SỨ", "09-nghe-thuat-giai-tri.txt"),
    ("CERAMICS", "Đồ gốm nung men sứ mỹ nghệ tiếng Anh là gì?", 2, "GỐM SỨ", "09-nghe-thuat-giai-tri.txt"),
    ("ORIGAMI", "Nghệ thuật gấp giấy truyền thống của Nhật Bản tiếng Anh là gì?", 1, "GẤP GIẤY", "09-nghe-thuat-giai-tri.txt"),
    ("MOSAIC", "Tranh ghép từ nhiều mảnh gốm đá nhỏ tiếng Anh là gì?", 3, "TRANH GHÉP MẢNH", "09-nghe-thuat-giai-tri.txt"),
    ("GRAFFITI", "Nghệ thuật vẽ tranh đường phố bằng bình xịt sơn tiếng Anh là gì?", 1, "TRANH ĐƯỜNG PHỐ", "09-nghe-thuat-giai-tri.txt"),
    ("MUSEUM", "Bảo tàng lưu giữ hiện vật lịch sử và văn hóa tiếng Anh là gì?", 1, "BẢO TÀNG", "09-nghe-thuat-giai-tri.txt"),
    ("HARMONY", "Sự hòa âm nhịp nhàng trong bản nhạc tiếng Anh là gì?", 2, "HÒA ÂM", "09-nghe-thuat-giai-tri.txt"),
    ("TEMPO", "Tốc độ nhịp điệu nhanh chậm của bản nhạc tiếng Anh là gì?", 2, "NHỊP ĐIỆU, TỐC ĐỘ BẢN NHẠC", "09-nghe-thuat-giai-tri.txt"),
    ("COMPOSER", "Nhà soạn nhạc tài ba viết nên các tác phẩm kinh điển tiếng Anh là gì?", 2, "NHÀ SOẠN NHẠC", "09-nghe-thuat-giai-tri.txt"),
    ("CONDUCTOR", "Nhạc trưởng chỉ huy dàn nhạc giao hưởng tiếng Anh là gì?", 2, "NHẠC TRƯỞNG", "09-nghe-thuat-giai-tri.txt"),
    ("ACOUSTIC", "Nhạc mộc hoặc cây đàn ghi ta mộc không cắm điện tiếng Anh là gì?", 2, "NHẠC MỘC, ACOUSTIC GUITAR", "09-nghe-thuat-giai-tri.txt"),
    ("INSTRUMENT", "Nhạc cụ âm nhạc nói chung tiếng Anh là gì?", 1, "NHẠC CỤ", "09-nghe-thuat-giai-tri.txt"),
    ("VIOLIN", "Cây đàn vĩ cầm kéo bằng dây tiếng Anh là gì?", 1, "ĐÀN VĨ CẦM, ĐÀN VIOLIN", "09-nghe-thuat-giai-tri.txt"),
    ("CELLO", "Cây đàn trung vĩ cầm kích thước lớn tiếng Anh là gì?", 2, "ĐÀN CELLO", "09-nghe-thuat-giai-tri.txt"),
    ("FLUTE", "Cây sáo thổi hơi bằng kim loại hoặc trúc tiếng Anh là gì?", 1, "CÂY SÁO, SÁO", "09-nghe-thuat-giai-tri.txt"),
    ("TRUMPET", "Chiếc kèn trumpet bằng đồng sáng loáng tiếng Anh là gì?", 1, "KÈN TRUMPET, KÈN ĐỒNG", "09-nghe-thuat-giai-tri.txt"),
    ("SAXOPHONE", "Cây kèn saxophone uốn cong quyến rũ tiếng Anh là gì?", 1, "KÈN SAXOPHONE", "09-nghe-thuat-giai-tri.txt"),
    ("DRUM", "Cái trống gõ tạo nhịp điệu rộn ràng tiếng Anh là gì?", 1, "CÁI TRỐNG, TRỐNG", "09-nghe-thuat-giai-tri.txt"),
    ("CYMBAL", "Chiếc chũm chọe bằng đồng trong bộ trống tiếng Anh là gì?", 2, "CHŨM CHỌE", "09-nghe-thuat-giai-tri.txt"),
    ("HARP", "Cây đàn hạc có nhiều dây ngân nga êm dịu tiếng Anh là gì?", 2, "ĐÀN HẠC", "09-nghe-thuat-giai-tri.txt"),
    ("ACCORDION", "Cây đàn xếp kéo đẩy bằng tay tiếng Anh là gì?", 2, "ĐÀN ACCORDION, ĐÀN XẾP", "09-nghe-thuat-giai-tri.txt"),

    # 10-the-thao-the-hinh.txt
    ("ARCHERY", "Môn bắn cung ngắm hồng tâm tiếng Anh là gì?", 2, "BẮN CUNG", "10-the-thao-the-hinh.txt"),
    ("BOWLING", "Trò chơi ném bóng gỗ làm đổ các ki gỗ tiếng Anh là gì?", 1, "BÓNG GỖ, BOWLING", "10-the-thao-the-hinh.txt"),
    ("BILLIARDS", "Trò chơi bi-a dùng cơ chọc bi trên bàn nỉ tiếng Anh là gì?", 1, "BI-A, BIDA, POOL", "10-the-thao-the-hinh.txt"),
    ("CHESS", "Môn cờ vua đối kháng trí tuệ tiếng Anh là gì?", 1, "CỜ VUA", "10-the-thao-the-hinh.txt"),
    ("BASEBALL", "Môn bóng chày phổ biến ở Mỹ và Nhật Bản tiếng Anh là gì?", 1, "BÓNG CHÀY", "10-the-thao-the-hinh.txt"),
    ("CRICKET", "Môn bóng gậy rất được yêu thích tại Anh và Ấn Độ tiếng Anh là gì?", 2, "BÓNG GẬY, BÓNG CRICKET", "10-the-thao-the-hinh.txt"),
    ("RUGBY", "Môn bóng bầu dục tranh cướp bóng quyết liệt tiếng Anh là gì?", 2, "BÓNG BẦU DỤC", "10-the-thao-the-hinh.txt"),
    ("HOCKEY", "Môn khúc côn cầu chơi trên sân cỏ hoặc sân băng tiếng Anh là gì?", 2, "KHÚC CÔN CẦU", "10-the-thao-the-hinh.txt"),
    ("SKATING", "Trượt băng hoặc trượt pa-tin tiếng Anh là gì?", 1, "TRƯỢT BĂNG, TRƯỢT PATIN", "10-the-thao-the-hinh.txt"),
    ("SKIING", "Môn trượt tuyết trên các sườn núi dốc tiếng Anh là gì?", 1, "TRƯỢT TUYẾT", "10-the-thao-the-hinh.txt"),
    ("SNOWBOARDING", "Môn lướt ván trên nền tuyết trắng tiếng Anh là gì?", 2, "TRƯỢT VÁN TUYẾT", "10-the-thao-the-hinh.txt"),
    ("SURFING", "Môn lướt sóng biển cưỡi trên đầu ngọn sóng tiếng Anh là gì?", 1, "LƯỚT SÓNG", "10-the-thao-the-hinh.txt"),
    ("WINDSURFING", "Môn lướt ván buồm trên biển tiếng Anh là gì?", 2, "LƯỚT VÁN BUỒM", "10-the-thao-the-hinh.txt"),
    ("SCUBA DIVING", "Môn lặn biển sâu có bình dưỡng khí dưỡng khí tiếng Anh là gì?", 2, "LẶN BIỂN, LẶN BÌNH KHÍ", "10-the-thao-the-hinh.txt"),
    ("KAYAKING", "Môn chèo thuyền kayak vượt ghềnh thác tiếng Anh là gì?", 2, "CHÈO THUYỀN KAYAK", "10-the-thao-the-hinh.txt"),
    ("ROWING", "Môn đua thuyền chèo đồng đội trên sông tiếng Anh là gì?", 2, "ĐUA THUYỀN", "10-the-thao-the-hinh.txt"),
    ("FENCING", "Môn thể thao đấu kiếm phương Tây mang đồ bảo hộ tiếng Anh là gì?", 2, "ĐẤU KIẾM", "10-the-thao-the-hinh.txt"),
    ("CYCLING", "Môn thể thao đua xe đạp đường trường tiếng Anh là gì?", 1, "ĐUA XE ĐẠP, ĐI XE ĐẠP", "10-the-thao-the-hinh.txt"),
    ("EQUESTRIAN", "Môn thể thao cưỡi ngựa nghệ thuật tiếng Anh là gì?", 3, "CƯỠI NGỰA", "10-the-thao-the-hinh.txt"),
    ("TRIATHLON", "Cuộc thi ba môn phối hợp bơi chạy và đạp xe tiếng Anh là gì?", 3, "BA MÔN PHỐI HỢP", "10-the-thao-the-hinh.txt"),
    ("AEROBICS", "Môn thể dục nhịp điệu theo nền nhạc tiếng Anh là gì?", 1, "THỂ DỤC NHỊP ĐIỆU", "10-the-thao-the-hinh.txt"),
    ("WEIGHTLIFTING", "Môn thể thao cử tạ nâng đòn tạ nặng tiếng Anh là gì?", 2, "CỬ TẠ", "10-the-thao-the-hinh.txt"),
    ("BODYBUILDING", "Môn thể hình rèn luyện cơ bắp săn chắc tiếng Anh là gì?", 2, "THỂ HÌNH", "10-the-thao-the-hinh.txt"),
    ("DUMBBELL", "Quả tạ tay nhỏ tập cơ bắp tiếng Anh là gì?", 2, "TẠ TAY", "10-the-thao-the-hinh.txt"),
    ("TREADMILL", "Máy chạy bộ tập thể dục trong phòng gym tiếng Anh là gì?", 2, "MÁY CHẠY BỘ", "10-the-thao-the-hinh.txt"),
    ("STRETCHING", "Bài tập giãn cơ bắp sau khi vận động tiếng Anh là gì?", 1, "GIÃN CƠ", "10-the-thao-the-hinh.txt"),
    ("PUSH-UP", "Động tác hít đất chống đẩy tăng cường sức mạnh tiếng Anh là gì?", 1, "HÍT ĐẤT, CHỐNG ĐẨY, PUSHUP", "10-the-thao-the-hinh.txt"),
    ("SQUAT", "Động tác gánh đùi ngồi xổm tăng lực chân tiếng Anh là gì?", 1, "GÁNH ĐÙI, SQUATS", "10-the-thao-the-hinh.txt"),
    ("PLANK", "Động tác đo sàn giữ thẳng người siết cơ bụng tiếng Anh là gì?", 1, "ĐO SÀN, TẬP PLANK", "10-the-thao-the-hinh.txt"),
    ("WARM-UP", "Khởi động làm nóng cơ thể trước khi thi đấu tiếng Anh là gì?", 1, "KHỞI ĐỘNG, WARMUP", "10-the-thao-the-hinh.txt"),

    # 11-doi-song-so-cong-nghe.txt
    ("HEADPHONE", "Tai nghe chụp qua đầu để thưởng thức âm nhạc tiếng Anh là gì?", 1, "TAI NGHE, HEADPHONES", "11-doi-song-so-cong-nghe.txt"),
    ("EARBUDS", "Tai nghe nhét tai nhỏ gọn không dây tiếng Anh là gì?", 1, "TAI NGHE NHÉT TAI, EARPHONES", "11-doi-song-so-cong-nghe.txt"),
    ("SMARTWATCH", "Chiếc đồng hồ thông minh theo dõi nhịp tim tiếng Anh là gì?", 1, "ĐỒNG HỒ THÔNG MINH", "11-doi-song-so-cong-nghe.txt"),
    ("TABLET", "Chiếc máy tính bảng màn hình cảm ứng tiếng Anh là gì?", 1, "MÁY TÍNH BẢNG", "11-doi-song-so-cong-nghe.txt"),
    ("CHARGER", "Cục củ sạc pin điện thoại tiếng Anh là gì?", 1, "SẠC PIN, CỤC SẠC, DÂY SẠC", "11-doi-song-so-cong-nghe.txt"),
    ("POWER BANK", "Cục pin sạc dự phòng mang theo bên mình tiếng Anh là gì?", 1, "PIN DỰ PHÒNG, SẠC DỰ PHÒNG", "11-doi-song-so-cong-nghe.txt"),
    ("USB", "Thẻ nhớ hoặc thiết bị lưu trữ cắm cổng USB tiếng Anh là gì?", 1, "USB, Ổ USB, FLASH DRIVE", "11-doi-song-so-cong-nghe.txt"),
    ("KEYBOARD", "Bàn phím máy tính dùng gõ chữ tiếng Anh là gì?", 1, "BÀN PHÍM, BÀN PHÍM MÁY TÍNH", "11-doi-song-so-cong-nghe.txt"),
    ("MOUSE", "Con chuột máy tính điều khiển con trỏ tiếng Anh là gì?", 1, "CHUỘT MÁY TÍNH", "11-doi-song-so-cong-nghe.txt"),
    ("MONITOR", "Màn hình hiển thị của máy tính để bàn tiếng Anh là gì?", 1, "MÀN HÌNH, MÀN HÌNH MÁY TÍNH", "11-doi-song-so-cong-nghe.txt"),
    ("SPEAKER", "Chiếc loa phát âm thanh sống động tiếng Anh là gì?", 1, "CÁI LOA, CHIẾC LOA", "11-doi-song-so-cong-nghe.txt"),
    ("MICROPHONE", "Cây mic thu âm hoặc hát karaoke tiếng Anh là gì?", 1, "MICRO, MIC", "11-doi-song-so-cong-nghe.txt"),
    ("NOTIFICATION", "Thông báo tin nhắn gửi về điện thoại tiếng Anh là gì?", 2, "THÔNG BÁO", "11-doi-song-so-cong-nghe.txt"),
    ("APPLICATION", "Ứng dụng hoặc phần mềm cài trên điện thoại tiếng Anh là gì?", 1, "ỨNG DỤNG, APP", "11-doi-song-so-cong-nghe.txt"),
    ("SCREENSHOT", "Ảnh chụp lại màn hình điện thoại hoặc máy tính tiếng Anh là gì?", 1, "ẢNH CHỤP MÀN HÌNH, CHỤP MÀN HÌNH", "11-doi-song-so-cong-nghe.txt"),
    ("WALLPAPER", "Hình nền hiển thị trên màn hình chính máy tính hoặc điện thoại tiếng Anh là gì?", 1, "HÌNH NỀN", "11-doi-song-so-cong-nghe.txt"),
    ("SHORTCUT", "Phím tắt hoặc lối tắt mở nhanh ứng dụng tiếng Anh là gì?", 2, "PHÍM TẮT, LỐI TẮT", "11-doi-song-so-cong-nghe.txt"),
    ("HASHTAG", "Từ khóa có dấu thăng phía trước trên mạng xã hội tiếng Anh là gì?", 1, "DẤU THĂNG, HASHTAG", "11-doi-song-so-cong-nghe.txt"),
    ("LIVESTREAM", "Phát video trực tiếp tương tác cùng người xem tiếng Anh là gì?", 1, "PHÁT TRỰC TIẾP, LIVE STREAM", "11-doi-song-so-cong-nghe.txt"),
    ("EMOJI", "Biểu tượng cảm xúc mặt cười ngộ nghĩnh khi nhắn tin tiếng Anh là gì?", 1, "BIỂU TƯỢNG CẢM XÚC, EMOTICON", "11-doi-song-so-cong-nghe.txt"),

    # 14-nghe-nghiep-doi-song.txt
    ("ARCHITECT", "Kiến trúc sư vẽ bản thiết kế các công trình nhà cửa tiếng Anh là gì?", 2, "KIẾN TRÚC SƯ", "14-nghe-nghiep-doi-song.txt"),
    ("ENGINEER", "Kỹ sư cơ khí xây dựng hoặc công nghệ tiếng Anh là gì?", 1, "KỸ SƯ", "14-nghe-nghiep-doi-song.txt"),
    ("ACCOUNTANT", "Kế toán viên quản lý sổ sách chi tiêu tiếng Anh là gì?", 2, "KẾ TOÁN", "14-nghe-nghiep-doi-song.txt"),
    ("LAWYER", "Luật sư bào chữa và tư vấn pháp luật tiếng Anh là gì?", 2, "LUẬT SƯ, ATTORNEY", "14-nghe-nghiep-doi-song.txt"),
    ("JUDGE", "Thẩm phán chủ tọa phiên tòa xét xử tiếng Anh là gì?", 2, "THẨM PHÁN", "14-nghe-nghiep-doi-song.txt"),
    ("POLICEMAN", "Chiến sĩ cảnh sát bảo vệ trật tự an ninh tiếng Anh là gì?", 1, "CẢNH SÁT, POLICE, POLICE OFFICER", "14-nghe-nghiep-doi-song.txt"),
    ("FIREFIGHTER", "Người lính cứu hỏa dũng cảm dập tắt đám cháy tiếng Anh là gì?", 1, "LÍNH CỨU HỎA, CỨU HỎA", "14-nghe-nghiep-doi-song.txt"),
    ("SOLDIER", "Người lính bộ đội cầm súng bảo vệ Tổ quốc tiếng Anh là gì?", 1, "NGƯỜI LÍNH, BỘ ĐỘI", "14-nghe-nghiep-doi-song.txt"),
    ("PILOT", "Phi công lái máy bay bay lượn trên bầu trời tiếng Anh là gì?", 1, "PHI CÔNG", "14-nghe-nghiep-doi-song.txt"),
    ("FLIGHT ATTENDANT", "Tiếp viên hàng không phục vụ hành khách trên chuyến bay tiếng Anh là gì?", 2, "TIẾP VIÊN HÀNG KHÔNG", "14-nghe-nghiep-doi-song.txt"),
    ("JOURNALIST", "Nhà báo săn tin và viết bài cho tòa soạn tiếng Anh là gì?", 2, "NHÀ BÁO, PHÓNG VIÊN, REPORTER", "14-nghe-nghiep-doi-song.txt"),
    ("PHOTOGRAPHER", "Nhiếp ảnh gia cầm máy ảnh chụp những bức ảnh đẹp tiếng Anh là gì?", 2, "NHIẾP ẢNH GIA, THỢ CHỤP ẢNH", "14-nghe-nghiep-doi-song.txt"),
    ("CARPENTER", "Bác thợ mộc cưa đục làm đồ gỗ nội thất tiếng Anh là gì?", 2, "THỢ MỘC", "14-nghe-nghiep-doi-song.txt"),
    ("PLUMBER", "Người thợ sửa ống nước và van khóa vòi nước tiếng Anh là gì?", 2, "THỢ SỬA ỐNG NƯỚC, THỢ NƯỚC", "14-nghe-nghiep-doi-song.txt"),
    ("ELECTRICIAN", "Người thợ điện sửa chữa đường dây điện và bóng đèn tiếng Anh là gì?", 2, "THỢ ĐIỆN", "14-nghe-nghiep-doi-song.txt"),
    ("MECHANIC", "Thợ cơ khí chuyên sửa chữa máy móc động cơ ô tô tiếng Anh là gì?", 2, "THỢ CƠ KHÍ, THỢ SỬA XE", "14-nghe-nghiep-doi-song.txt"),
    ("BARBER", "Thợ cắt tóc nam tạo kiểu tóc tiếng Anh là gì?", 1, "THỢ CẮT TÓC, CẮT TÓC", "14-nghe-nghiep-doi-song.txt"),
    ("HAIRDRESSER", "Nhà tạo mẫu tóc và làm tóc nghệ thuật tiếng Anh là gì?", 2, "THỢ LÀM TÓC", "14-nghe-nghiep-doi-song.txt"),
    ("TAILOR", "Người thợ may đo may quần áo vừa vặn tiếng Anh là gì?", 2, "THỢ MAY", "14-nghe-nghiep-doi-song.txt"),
    ("BAKER", "Thợ làm bánh nướng thơm lừng trong lò tiếng Anh là gì?", 1, "THỢ LÀM BÁNH, THỢ BÁNH", "14-nghe-nghiep-doi-song.txt"),
    ("GARDENER", "Người làm vườn chăm sóc hoa cỏ cây cối tiếng Anh là gì?", 1, "NGƯỜI LÀM VƯỜN", "14-nghe-nghiep-doi-song.txt"),
    ("FARMER", "Người nông dân cày cấy gặt lúa trên đồng tiếng Anh là gì?", 1, "NÔNG DÂN, BÁC NÔNG DÂN", "14-nghe-nghiep-doi-song.txt"),
    ("FISHERMAN", "Ngư dân quăng lưới đánh bắt cá trên biển tiếng Anh là gì?", 1, "NGƯ DÂN, BÁC ĐÁNH CÁ", "14-nghe-nghiep-doi-song.txt"),
    ("ASTRONAUT", "Phi hành gia bay vào không gian khám phá vũ trụ tiếng Anh là gì?", 2, "PHI HÀNH GIA", "14-nghe-nghiep-doi-song.txt"),
    ("SCIENTIST", "Nhà khoa học nghiên cứu những phát minh mới tiếng Anh là gì?", 1, "NHÀ KHOA HỌC", "14-nghe-nghiep-doi-song.txt"),
    ("DETECTIVE", "Thám tử tư điều tra các vụ án bí ẩn tiếng Anh là gì?", 2, "THÁM TỬ", "14-nghe-nghiep-doi-song.txt"),
    ("VETERINARIAN", "Bác sĩ thú y khám chữa bệnh cho vật nuôi tiếng Anh là gì?", 3, "BÁC SĨ THÚ Y, VET", "14-nghe-nghiep-doi-song.txt"),
    ("OPTICIAN", "Chuyên viên đo mắt và cắt kính thuốc tiếng Anh là gì?", 3, "THỢ ĐO MẮT, BÁC SĨ MẮT", "14-nghe-nghiep-doi-song.txt"),
    ("TRANSLATOR", "Biên dịch viên dịch các văn bản tài liệu tiếng Anh là gì?", 2, "BIÊN DỊCH VIÊN, NGƯỜI DỊCH", "14-nghe-nghiep-doi-song.txt"),
    ("INTERPRETER", "Phiên dịch viên dịch trực tiếp lời nói trong hội nghị tiếng Anh là gì?", 3, "PHIÊN DỊCH VIÊN", "14-nghe-nghiep-doi-song.txt"),

    # 15-cam-xuc-tinh-cach.txt
    ("GENEROUS", "Hào phóng rộng lượng hay giúp đỡ người khác tiếng Anh là gì?", 2, "HÀO PHÓNG, RỘNG LƯỢNG", "15-cam-xuc-tinh-cach.txt"),
    ("GREEDY", "Tham lam chỉ muốn giữ tất cả cho riêng mình tiếng Anh là gì?", 2, "THAM LAM", "15-cam-xuc-tinh-cach.txt"),
    ("JEALOUS", "Ghen tị đố kỵ với thành công của người khác tiếng Anh là gì?", 2, "GHEN TỊ, ĐỐ KỴ, ENVIOUS", "15-cam-xuc-tinh-cach.txt"),
    ("HUMBLE", "Khiêm tốn nhã nhặn không khoe khoang tiếng Anh là gì?", 2, "KHIÊM TỐN, MODEST", "15-cam-xuc-tinh-cach.txt"),
    ("ARROGANT", "Kiêu ngạo tự cao coi thường người khác tiếng Anh là gì?", 2, "KIÊU NGẠO, TỰ CAO", "15-cam-xuc-tinh-cach.txt"),
    ("HONEST", "Trung thực thật thà không gian dối tiếng Anh là gì?", 1, "TRUNG THỰC, THẬT THÀ", "15-cam-xuc-tinh-cach.txt"),
    ("DISHONEST", "Không trung thực lừa lọc gian manh tiếng Anh là gì?", 2, "GIAN DỐI, BẤT LƯƠNG", "15-cam-xuc-tinh-cach.txt"),
    ("COURAGEOUS", "Dũng cảm can trường đối mặt hiểm nguy tiếng Anh là gì?", 2, "DŨNG CẢM, CAN ĐẢM, BRAVE", "15-cam-xuc-tinh-cach.txt"),
    ("COWARDLY", "Hèn nhát sợ sệt không dám làm gì tiếng Anh là gì?", 2, "HÈN NHÁT", "15-cam-xuc-tinh-cach.txt"),
    ("PATIENT", "Kiên nhẫn nhẫn nại chờ đợi tiếng Anh là gì?", 1, "KIÊN NHẪN, NHẪN NẠI", "15-cam-xuc-tinh-cach.txt"),
    ("IMPATIENT", "Nóng vội thiếu kiên nhẫn không chờ đợi được tiếng Anh là gì?", 2, "NÓNG VỘI, SỐT RUỘT", "15-cam-xuc-tinh-cach.txt"),
    ("CURIOUS", "Tò mò hiếu kỳ muốn khám phá mọi thứ tiếng Anh là gì?", 2, "TÒ MÒ, HIẾU KỲ", "15-cam-xuc-tinh-cach.txt"),
    ("STUBBORN", "Bướng bỉnh cứng đầu khó bảo tiếng Anh là gì?", 2, "BƯỚNG BỈNH, CỨNG ĐẦU, OBSTINATE", "15-cam-xuc-tinh-cach.txt"),
    ("POLITE", "Lịch sự lễ phép nhã nhặn tiếng Anh là gì?", 1, "LỊCH SỰ, LỄ PHÉP", "15-cam-xuc-tinh-cach.txt"),
    ("IMPENITENT", "Không hối cải không ăn năn hối hận tiếng Anh là gì?", 3, "KHÔNG HỐI CẢI", "15-cam-xuc-tinh-cach.txt"),
    ("SINCERE", "Chân thành thật lòng xuất phát từ trái tim tiếng Anh là gì?", 2, "CHÂN THÀNH, THẬT LÒNG", "15-cam-xuc-tinh-cach.txt"),
    ("SYMPATHETIC", "Cảm thông đồng cảm với nỗi đau của người khác tiếng Anh là gì?", 2, "ĐỒNG CẢM, CẢM THÔNG", "15-cam-xuc-tinh-cach.txt"),
    ("AGGRESSIVE", "Hung hăng hiếu chiến hay gây sự tiếng Anh là gì?", 2, "HUNG HĂNG, HIẾU CHIẾN", "15-cam-xuc-tinh-cach.txt"),
    ("AMBITIOUS", "Đầy tham vọng và hoài bão lớn tiếng Anh là gì?", 2, "THAM VỌNG, HOÀI BÃO", "15-cam-xuc-tinh-cach.txt"),
    ("PESSIMISTIC", "Bi quan luôn nhìn vào mặt tiêu cực tiếng Anh là gì?", 2, "BI QUAN", "15-cam-xuc-tinh-cach.txt"),

    # 17-hien-tuong-thien-nhien-ky-thu.txt
    ("TSUNAMI", "Cơn sóng thần khổng lồ ập vào bờ biển tiếng Anh là gì?", 2, "SÓNG THẦN", "17-hien-tuong-thien-nhien-ky-thu.txt"),
    ("VOLCANO", "Ngọn núi lửa phun trào nham thạch nóng bỏng tiếng Anh là gì?", 1, "NÚI LỬA", "17-hien-tuong-thien-nhien-ky-thu.txt"),
    ("EARTHQUAKE", "Trận động đất rung chuyển mặt đất dữ dội tiếng Anh là gì?", 2, "ĐỘNG ĐẤT, ĐỊA CHẤN", "17-hien-tuong-thien-nhien-ky-thu.txt"),
    ("AVALANCHE", "Trận lở tuyết dữ dội tràn xuống từ đỉnh núi tuyết tiếng Anh là gì?", 3, "LỞ TUYẾT", "17-hien-tuong-thien-nhien-ky-thu.txt"),
    ("LANDSLIDE", "Hiện tượng sạt lở đất đá sau mưa bão tiếng Anh là gì?", 2, "SẠT LỞ ĐẤT, LỞ ĐẤT", "17-hien-tuong-thien-nhien-ky-thu.txt"),
    ("HURRICANE", "Cơn bão lốc xoáy nhiệt đới cấp cuồng phong tiếng Anh là gì?", 2, "BÃO NHIỆT ĐỚI, CUỒNG PHONG, TYPHOON", "17-hien-tuong-thien-nhien-ky-thu.txt"),
    ("TORNADO", "Cơn lốc xoáy vòi rồng hút sạch mọi thứ trên đường đi tiếng Anh là gì?", 2, "LỐC XOÁY, VÒI RỒNG", "17-hien-tuong-thien-nhien-ky-thu.txt"),
    ("BLIZZARD", "Trận bão tuyết mù mịt gió rét tiếng Anh là gì?", 3, "BÃO TUYẾT", "17-hien-tuong-thien-nhien-ky-thu.txt"),
    ("DROUGHT", "Hạn hán kéo dài khiến đất đai nứt nẻ tiếng Anh là gì?", 2, "HẠN HÁN", "17-hien-tuong-thien-nhien-ky-thu.txt"),
    ("FLOOD", "Trận lũ lụt ngập nước nhà cửa đồng ruộng tiếng Anh là gì?", 1, "LŨ LỤT, NGẬP LỤT", "17-hien-tuong-thien-nhien-ky-thu.txt"),
    ("RAINBOW", "Cầu vồng bảy sắc lung linh sau cơn mưa tiếng Anh là gì?", 1, "CẦU VỒNG", "17-hien-tuong-thien-nhien-ky-thu.txt"),
    ("LIGHTNING", "Tia sét xé toạc bầu trời đêm trong cơn giông tiếng Anh là gì?", 1, "TIA SÉT, SẤM SÉT", "17-hien-tuong-thien-nhien-ky-thu.txt"),
    ("THUNDER", "Tiếng sấm rền vang trời khi trời đổ mưa dông tiếng Anh là gì?", 1, "TIẾNG SẤM, SẤM", "17-hien-tuong-thien-nhien-ky-thu.txt"),
    ("AURORA", "Hiện tượng cực quang tuyệt đẹp ở hai đầu địa cực tiếng Anh là gì?", 2, "CỰC QUANG, ÁNH SÁNG BẮC CỰC, NORTHERN LIGHTS", "17-hien-tuong-thien-nhien-ky-thu.txt"),
    ("MIRAGE", "Hiện tượng ảo ảnh trên sa mạc nắng cháy tiếng Anh là gì?", 3, "ẢO ẢNH", "17-hien-tuong-thien-nhien-ky-thu.txt"),
    ("WHIRLPOOL", "Vòng xoáy nước nguy hiểm giữa dòng sông hoặc biển tiếng Anh là gì?", 3, "XOÁY NƯỚC", "17-hien-tuong-thien-nhien-ky-thu.txt"),
    ("GEYSER", "Mạch nước ngầm phun trào nước nóng từ lòng đất tiếng Anh là gì?", 3, "MẠCH PHUN NƯỚC NÓNG", "17-hien-tuong-thien-nhien-ky-thu.txt"),
    ("WATERFALL", "Ngọn thác nước hùng vĩ đổ từ vách núi cao tiếng Anh là gì?", 1, "THÁC NƯỚC", "17-hien-tuong-thien-nhien-ky-thu.txt"),
    ("CANYON", "Hẻm núi sâu thăm thẳm do sông xói mòn qua triệu năm tiếng Anh là gì?", 2, "HẺM NÚI, GRAND CANYON", "17-hien-tuong-thien-nhien-ky-thu.txt"),
    ("GLACIER", "Dòng sông băng khổng lồ di chuyển chậm chạp tiếng Anh là gì?", 2, "SÔNG BĂNG", "17-hien-tuong-thien-nhien-ky-thu.txt"),

    # 13-thanh-ngu-cum-tu-hay.txt
    ("HIT THE SACK", "Thành ngữ chỉ việc leo lên giường đi ngủ sau ngày mệt mỏi tiếng Anh là gì?", 2, "ĐI NGỦ", "13-thanh-ngu-cum-tu-hay.txt"),
    ("SPILL THE BEANS", "Thành ngữ chỉ việc vô tình làm lộ bí mật tiếng Anh là gì?", 2, "TIẾT LỘ BÍ MẬT, LÀM LỘ BÍ MẬT", "13-thanh-ngu-cum-tu-hay.txt"),
    ("SEE EYE TO EYE", "Thành ngữ chỉ hai người hoàn toàn đồng tình và hiểu ý nhau tiếng Anh là gì?", 2, "ĐỒNG TÌNH, HIỂU Ý NHAU", "13-thanh-ngu-cum-tu-hay.txt"),
    ("CALL IT A DAY", "Thành ngữ chỉ việc quyết định dừng làm việc kết thúc ngày làm tiếng Anh là gì?", 2, "NGHỈ TAY, KẾT THÚC CÔNG VIỆC", "13-thanh-ngu-cum-tu-hay.txt"),
    ("BITE THE BULLET", "Thành ngữ cắn răng chịu đựng một tình huống khó khăn tiếng Anh là gì?", 3, "CẮN RĂNG CHỊU ĐỰNG", "13-thanh-ngu-cum-tu-hay.txt"),
    ("BURNING THE MIDNIGHT OIL", "Thành ngữ thức khuya học bài hoặc làm việc đêm khuya tiếng Anh là gì?", 3, "THỨC KHUYA, LÀM VIỆC ĐÊM", "13-thanh-ngu-cum-tu-hay.txt"),
    ("BARKING UP THE WRONG TREE", "Thành ngữ tìm sai chỗ hoặc trách nhầm người tiếng Anh là gì?", 3, "TRÁCH NHẦM NGƯỜI, TÌM SAI CHỖ", "13-thanh-ngu-cum-tu-hay.txt"),
    ("COST AN ARM AND A LEG", "Thành ngữ chỉ một món đồ cực kỳ đắt đỏ tốn kém tiếng Anh là gì?", 2, "RẤT ĐẮT ĐỎ, ĐẮT CẮT CỔ", "13-thanh-ngu-cum-tu-hay.txt"),
    ("BLESSING IN DISGUISE", "Thành ngữ trong cái rủi lại có cái may tiếng Anh là gì?", 3, "TRONG CÁI RỦI CÓ CÁI MAY", "13-thanh-ngu-cum-tu-hay.txt"),
    ("ACTIONS SPEAK LOUDER THAN WORDS", "Thành ngữ hành động giá trị hơn lời nói suông tiếng Anh là gì?", 2, "HÀNH ĐỘNG HƠN LỜI NÓI", "13-thanh-ngu-cum-tu-hay.txt"),

    # 16-do-vat-dung-cu.txt
    ("SCISSORS", "Cái kéo dùng để cắt giấy vải tiếng Anh là gì?", 1, "CÁI KÉO, CHIẾC KÉO", "16-do-vat-dung-cu.txt"),
    ("HAMMER", "Cây búa dùng đóng đinh tiếng Anh là gì?", 1, "CÂY BÚA, CÁI BÚA", "16-do-vat-dung-cu.txt"),
    ("SCREWDRIVER", "Cây tua vít dùng vặn ốc vít tiếng Anh là gì?", 2, "TUA VÍT, TÔ VÍT", "16-do-vat-dung-cu.txt"),
    ("WRENCH", "Chiếc cờ lê dùng vặn bu lông đai ốc tiếng Anh là gì?", 2, "CỜ LÊ, MỎ LẾT, SPANNER", "16-do-vat-dung-cu.txt"),
    ("FLASHLIGHT", "Chiếc đèn pin cầm tay chiếu sáng trong đêm tiếng Anh là gì?", 1, "ĐÈN PIN, TORCH", "16-do-vat-dung-cu.txt"),
    ("TAPE MEASURE", "Chiếc thước dây rút dùng đo đạc chiều dài tiếng Anh là gì?", 2, "THƯỚC DÂY, THƯỚC ĐO", "16-do-vat-dung-cu.txt"),
    ("LADDER", "Chiếc thang leo lên vị trí trên cao tiếng Anh là gì?", 1, "CÁI THANG, CHIẾC THANG", "16-do-vat-dung-cu.txt"),
    ("BROOM", "Cây chổi dùng quét sạch rác bụi tiếng Anh là gì?", 1, "CÂY CHỔI, CHỔI QUÉT NHÀ", "16-do-vat-dung-cu.txt"),
    ("DUSTPAN", "Cái hốt rác gom bụi bẩn tiếng Anh là gì?", 2, "CÁI HỐT RÁC, XẺNG HỐT RÁC", "16-do-vat-dung-cu.txt"),
    ("THERMOMETER", "Chiếc nhiệt kế đo nhiệt độ cơ thể khi sốt tiếng Anh là gì?", 2, "NHIỆT KẾ", "16-do-vat-dung-cu.txt"),
]

# Write verified items
added = 0
by_file = {}

for ans, prompt, lvl, alts, fname in vocab_data:
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
