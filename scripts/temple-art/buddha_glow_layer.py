# Lớp hào quang cho tượng Phật trong tranh nền: tách dáng tượng (vàng đậm) khỏi tường/hào quang vẽ
# (vàng nhạt), rồi xuất 1 ảnh dữ liệu cho shader: R = viền sáng ôm sát dáng tượng, G = quầng rộng,
# B = mặt nạ tượng (để tia sáng không phủ lên mặt tượng). Toạ độ vùng cắt ghi vào sprites.json.
# Dùng: python -I buddha_glow_layer.py <nền 1080x1920 .png> <public/assets/temple> [ảnh xem thử .png]
import json, sys
from pathlib import Path
import cv2
import numpy as np

src, out_dir, *preview = sys.argv[1:]
RECT = (0.2, 0.12, 0.8, 0.47)  # vùng tượng + hào quang trên khung hình (trái, trên, phải, dưới)
img = cv2.imread(src)
H, W = img.shape[:2]
x0, y0, x1, y1 = int(RECT[0] * W), int(RECT[1] * H), int(RECT[2] * W), int(RECT[3] * H)
crop = img[y0:y1, x0:x1]
hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV).astype(np.float32)
h, s, v = hsv[..., 0] * 2, hsv[..., 1] / 255, hsv[..., 2] / 255
# Màu tượng và tường ánh nến gần như trùng nhau ⇒ dựng khung dáng tượng bằng tay (toạ độ trên vùng cắt
# 648×672: đầu, cổ, thân, chân xếp bằng), rồi chỉ dùng màu để tinh chỉnh mép trong dải ±10 px.
sx, sy = crop.shape[1] / 648, crop.shape[0] / 672
shape = np.zeros(crop.shape[:2], np.uint8)
cv2.ellipse(shape, (int(322 * sx), int(287 * sy)), (int(37 * sx), int(50 * sy)), 0, 0, 360, 255, -1)
cv2.rectangle(shape, (int(300 * sx), int(320 * sy)), (int(345 * sx), int(360 * sy)), 255, -1)
torso = np.array([(262, 350), (385, 350), (418, 398), (424, 472), (224, 472), (230, 398)]) * [sx, sy]
cv2.fillPoly(shape, [torso.astype(np.int32)], 255)
cv2.ellipse(shape, (int(325 * sx), int(505 * sy)), (int(142 * sx), int(42 * sy)), 0, 0, 360, 255, -1)
band = np.ones((21, 21), np.uint8)
statue_color = ((v > 0.55) & (s > 0.4) & (h > 24) & (h < 50)).astype(np.uint8) * 255
mask = (cv2.dilate(shape, band) & statue_color) | cv2.erode(shape, band)
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
flood = mask.copy()  # lấp lỗ (tóc xoắn sẫm, nếp áo tối) bên trong dáng tượng
cv2.floodFill(flood, np.zeros((mask.shape[0] + 2, mask.shape[1] + 2), np.uint8), (0, 0), 255)
mask = mask | cv2.bitwise_not(flood)
m = mask.astype(np.float32) / 255
soft_mask = cv2.GaussianBlur(m, (0, 0), 3)
tight = cv2.GaussianBlur(cv2.dilate(m, np.ones((9, 9), np.uint8)), (0, 0), 14)
wide = cv2.GaussianBlur(m, (0, 0), 55)
tight = np.clip(tight * (1 - soft_mask * 0.8), 0, 1)        # sáng ở mép ngoài, nhẹ trên mặt tượng
wide = np.clip(wide / max(wide.max(), 1e-6), 0, 1) * (1 - soft_mask * 0.6)
data = np.dstack([soft_mask, wide, tight])                  # BGR → khi đọc RGB: R=tight, G=wide, B=mask
half = cv2.resize((data * 255).astype(np.uint8), (crop.shape[1] // 2, crop.shape[0] // 2), interpolation=cv2.INTER_AREA)
out = Path(out_dir)
cv2.imwrite(str(out / "phat-hao-quang.png"), half)
manifest_path = out / "sprites.json"
manifest = json.loads(manifest_path.read_text())
# tâm tia sáng = tâm vầng hào quang vẽ sau đầu (đo tay trên tranh: (322, 282) của vùng cắt 648×672)
manifest["aura"] = {"file": "phat-hao-quang.png", "rect": list(RECT), "center": [round(322 / 648, 3), round(1 - 282 / 672, 3)]}
manifest_path.write_text(json.dumps(manifest, indent=1, ensure_ascii=False))
print("mask px", int((mask > 0).sum()), "size", half.shape)
if preview:
    show = crop.copy()
    glow = (np.dstack([tight * 120, tight * 210, tight * 255]) + np.dstack([wide * 40, wide * 90, wide * 140])).astype(np.float32)
    show = np.clip(show.astype(np.float32) + glow, 0, 255).astype(np.uint8)
    edge = cv2.Canny(mask, 50, 150)
    show[edge > 0] = (0, 255, 0)
    cv2.imwrite(preview[0], np.hstack([show, cv2.cvtColor(mask, cv2.COLOR_GRAY2BGR)]))
