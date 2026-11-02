# Tách nền hồng tím của ảnh nhân vật Gemini → PNG trong suốt + số đo (khung, đầu, chân).
# Dùng: python -I key_sprites.py <thư mục raw> <thư mục ra> <tên1> [tên2 ...]   (tên = link1-05 ...)
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image

raw_dir, out_dir, *names = sys.argv[1:]
out = Path(out_dir)
out.mkdir(parents=True, exist_ok=True)


def key(im):
    rgb = im.astype(np.float32)
    mag = lambda c: np.minimum(c[..., 0], c[..., 2]) - c[..., 1]   # độ "hồng tím"
    m = mag(rgb)
    h, w = m.shape
    # màu nền thật của ảnh này (trung vị các điểm chắc chắn là nền) → tách trộn chính xác ở viền
    bgc = np.median(rgb[m > 150], axis=0)
    mM = float(mag(bgc[None, None])[0, 0])
    alpha = np.clip((mM - m) / (mM - 25), 0, 1)       # điểm có độ hồng ≤ 25 coi là nhân vật đục hẳn
    alpha = np.clip((alpha - 0.12) / 0.88, 0, 1)       # cắt quầng mờ ngoài cùng
    alpha[int(h * 0.78):, int(w * 0.86):] = 0         # dấu ✦ của Gemini ở góc phải dưới
    a = np.maximum(alpha, 0.25)[..., None]
    fg = np.clip((rgb - (1 - a) * bgc) / a, 0, 255)    # gỡ phần màu nền đã trộn vào viền
    fg = np.where(alpha[..., None] >= 0.999, rgb, fg)
    # ám hồng còn sót ở viền: b không được vượt quá max(r, g) + 12
    edge = alpha < 0.999
    fg[..., 2] = np.where(edge, np.minimum(fg[..., 2], np.maximum(fg[..., 0], fg[..., 1]) + 12), fg[..., 2])
    # viền trong bị ánh nền hồng hắt lên (vẫn đục): trong dải 6px sát mép, gỡ phần hồng tím
    import cv2
    inside = (alpha > 0.5).astype(np.uint8)
    dist = cv2.distanceTransform(inside, cv2.DIST_L2, 3)
    band = np.clip(1 - dist / 6, 0, 1) * inside
    pink = np.clip(np.minimum(fg[..., 0], fg[..., 2]) - fg[..., 1], 0, None) * band
    fg[..., 0] -= pink * 0.95
    fg[..., 2] -= pink * 0.95
    # mép ngoài: bớt 1px cho gọn
    alpha = np.minimum(alpha, cv2.erode(alpha.astype(np.float32), np.ones((3, 3), np.uint8)) * 0.5 + alpha * 0.5)
    return np.dstack([np.clip(fg, 0, 255), alpha * 255]).astype(np.uint8)


def largest_blob(mask):
    # giữ thành phần liên thông lớn nhất (bỏ đốm lẻ do nhiễu nền)
    import cv2
    n, lab, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    if n <= 1:
        return mask
    keep = np.zeros(n, bool)
    big = stats[1:, cv2.CC_STAT_AREA].max()
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= big * 0.02:
            keep[i] = True
    return keep[lab]


report = {}
for name in names:
    im = np.asarray(Image.open(Path(raw_dir) / f"{name}.png").convert("RGB"))
    rgba = key(im)
    keep = largest_blob(rgba[..., 3] > 20)
    rgba[..., 3] = np.where(keep, rgba[..., 3], 0)
    ys, xs = np.where(rgba[..., 3] > 40)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    crop = rgba[y0:y1, x0:x1]
    # tóc đen: điểm tối + đục ở 40% trên của hình → bề ngang tóc ≈ bề ngang đầu
    lum = crop[..., :3].astype(np.float32).mean(axis=2)
    dark = (lum < 55) & (crop[..., 3] > 200)
    top = int(crop.shape[0] * 0.45)
    rows = np.where(dark[:top].sum(axis=1) > 3)[0]
    head = None
    if len(rows):
        hy0 = rows.min()
        band = dark[hy0: min(top, hy0 + int(crop.shape[0] * 0.12))]
        cols = np.where(band.sum(axis=0) > 1)[0]
        widths = [np.ptp(np.where(r)[0]) + 1 for r in band if r.sum() > 3]
        head = {"top": int(hy0), "cx": float((cols.min() + cols.max()) / 2), "width": int(np.percentile(widths, 90)) if widths else 0}
    Image.fromarray(crop, "RGBA").save(out / f"{name}.png")
    report[name] = {"size": [int(crop.shape[1]), int(crop.shape[0])], "box": [int(x0), int(y0), int(x1), int(y1)], "head": head}
    print(name, report[name])
(out / "report.json").write_text(json.dumps(report, indent=1))
