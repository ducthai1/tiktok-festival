# Nền chánh điện: xoá dấu ✦ của Gemini (vá theo vùng xung quanh), phóng lên 1080×1920, làm nét nhẹ.
import sys
import numpy as np
import cv2
src, out_png, crop_png = sys.argv[1:4]
im = cv2.imread(src)
h, w = im.shape[:2]
# dấu ✦: hình sao sáng mờ quanh (479, 933) của ảnh 572×1024 → lấy điểm sáng hơn hẳn xung quanh trong bán kính 26px
cx, cy = int(479 * w / 572), int(933 * h / 1024)
lum = im.astype(np.float32).mean(axis=2)
local = lum - cv2.GaussianBlur(lum, (0, 0), 8)
mask = np.zeros((h, w), np.uint8)
cv2.circle(mask, (cx, cy), 26, 255, -1)
mask = ((local > 8) & (mask > 0)).astype(np.uint8) * 255
mask = cv2.dilate(mask, np.ones((7, 7), np.uint8))
print('sparkle px', int((mask > 0).sum()))
# vá bằng mảnh hoa văn ngay phía trên dọc theo viền thảm (viền chạy chéo hướng (-0.505, -0.863)),
# mép mảnh vá làm mềm để không lộ đường cắt
shift = np.array([-0.505, -0.863]) * 46
# donor(x, y) = im(x + sx, y + sy): lấy mảnh ở phía trên-trái dọc viền thảm
donor = cv2.warpAffine(im, np.float32([[1, 0, shift[0]], [0, 1, shift[1]]]), (w, h),
                       flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REFLECT)
soft = cv2.GaussianBlur(cv2.dilate(mask, np.ones((9, 9), np.uint8)).astype(np.float32) / 255, (0, 0), 3)[..., None]
fixed = (donor * soft + im * (1 - soft)).astype(np.uint8)
cv2.imwrite(crop_png, np.hstack([im[cy - 50:cy + 50, cx - 50:cx + 50], fixed[cy - 50:cy + 50, cx - 50:cx + 50]]))
big = cv2.resize(fixed, (1080, 1920), interpolation=cv2.INTER_LANCZOS4)
blur = cv2.GaussianBlur(big, (0, 0), 1.6)
sharp = cv2.addWeighted(big, 1.45, blur, -0.45, 0)
cv2.imwrite(out_png, sharp)
print('saved', out_png)
