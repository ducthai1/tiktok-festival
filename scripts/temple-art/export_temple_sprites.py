# Xuất sprite chùa: chọn ảnh tốt nhất cho từng tư thế, quy về mét theo "họ tư thế" (cùng khung vẽ),
# tính mốc chân (giữa bàn chân/gối) + đỉnh đầu, lưu WebP + sprites.json cho game đọc.
# Dùng: python -I export_temple_sprites.py <thư mục keyed> <report.json> <public/assets/temple> <nền.png>
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image

keyed, report_path, out_root, backdrop = sys.argv[1:5]
report = json.loads(Path(report_path).read_text())
out = Path(out_root)

# tên trong game ← ảnh nguồn, cùng "họ" thì dùng chung tỉ lệ điểm ảnh/mét (Gemini giữ khung khi sửa)
# ref = (ảnh chuẩn của họ, chiều cao thật tính bằng mét của phần đo được, đo từ đỉnh đầu nếu "head")
DEVOTEES = {
    "nam": {
        "families": {
            "back": (["dung-sau", "di-sau-1", "di-sau-2"], ("dung-sau", 1.66, "box")),
            "arms": (["dang-le-sau"], ("dang-le-sau", 1.66, "head")),
            "kneel": (["quy-sau", "vai-quy-sau"], ("quy-sau", 1.12, "box")),
            "prostrate": (["lay-sau"], ("lay-sau", 0.96, "box")),
            "side": (["dung-nghieng", "di-nghieng-1", "di-nghieng-2", "cam-huong-nghieng", "vai-huong-nghieng"], ("dung-nghieng", 1.66, "box")),
        },
        "src": {"dung-sau": "link1-01", "di-sau-1": "link1-03", "di-sau-2": "link1-04", "quy-sau": "link1-05", "vai-quy-sau": "link1-06",
                "lay-sau": "link1-07", "dang-le-sau": "link1-08", "dung-nghieng": "link1-09", "di-nghieng-1": "link1-10",
                "di-nghieng-2": "link1-11", "cam-huong-nghieng": "link1-12", "vai-huong-nghieng": "link1-13"},
    },
    "nu": {
        "families": {
            "back": (["dung-sau", "di-sau-1", "di-sau-2"], ("dung-sau", 1.58, "box")),
            "arms": (["dang-le-sau"], ("dang-le-sau", 1.58, "head")),
            "kneel": (["quy-sau", "vai-quy-sau"], ("quy-sau", 1.06, "box")),
            "side": (["dung-nghieng", "di-nghieng-1", "di-nghieng-2", "cam-huong-nghieng", "vai-huong-nghieng"], ("dung-nghieng", 1.58, "box")),
        },
        # ảnh lạy của nữ (link1-18) vẽ nhìn từ phía trước nên không dùng; game thay bằng vái quỳ cúi sâu
        "src": {"dung-sau": "link1-02", "di-sau-1": "link1-14", "di-sau-2": "link1-15", "quy-sau": "link1-16", "vai-quy-sau": "link1-17",
                "dang-le-sau": "link1-19", "dung-nghieng": "link1-20", "di-nghieng-1": "link1-23", "di-nghieng-2": "link1-21",
                "cam-huong-nghieng": "link1-24", "vai-huong-nghieng": "link1-25"},
    },
}
# Sư: sprite cảnh cố định, chỉ cần tỉ lệ đúng giữa hai khung (ảnh sửa giữ khung y hệt)
MONKS = {"go-mo-1": ("link2-01", 1.0), "go-mo-2": ("link2-02", 1.0), "thinh-chuong-1": ("link2-03", 2.3), "thinh-chuong-2": ("link2-04", 2.3)}


def foot_anchor(alpha):
    # tâm theo chiều ngang của phần chạm đất (6% hàng dưới cùng có điểm đục)
    rows = np.where((alpha > 128).any(axis=1))[0]
    bottom = rows.max()
    band = alpha[max(0, bottom - int(alpha.shape[0] * 0.06)): bottom + 1] > 128
    xs = np.where(band.any(axis=0))[0]
    weights = band.sum(axis=0)[xs]
    return float((xs * weights).sum() / weights.sum())


def save_webp(im, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "WEBP", quality=88, method=6, exact=True)
    return path.stat().st_size


manifest = {"devotee": {}, "monk": {}}
total = 0
for gender, spec in DEVOTEES.items():
    frames = {}
    for family, (names, (ref, meters, how)) in spec["families"].items():
        ref_rep = report[spec["src"][ref]]
        span = ref_rep["size"][1] - (ref_rep["head"]["top"] if how == "head" else 0)
        ppm = span / meters
        for name in names:
            src = spec["src"][name]
            im = Image.open(Path(keyed) / f"{src}.png")
            alpha = np.asarray(im)[..., 3]
            w, h = im.size
            head_top = report[src]["head"]["top"] if report[src]["head"] else 0
            total += save_webp(im, out / "devotee" / gender / f"{name}.webp")
            frames[name] = {"w": round(w / ppm, 4), "h": round(h / ppm, 4), "ax": round(foot_anchor(alpha) / w, 4),
                            "head": round((h - head_top) / ppm, 4), "family": family}
    manifest["devotee"][gender] = frames
for name, (src, height) in MONKS.items():
    im = Image.open(Path(keyed) / f"{src}.png")
    w, h = im.size
    total += save_webp(im, out / "monk" / f"{name}.webp")
    manifest["monk"][name] = {"w": round(w / h * height, 4), "h": height, "ax": 0.5}
bg = Image.open(backdrop).convert("RGB")
total += save_webp(bg, out / "chua-nen.webp")
manifest["backdrop"] = {"file": "chua-nen.webp", "w": bg.width, "h": bg.height}
(out / "sprites.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False))
print(json.dumps(manifest, ensure_ascii=False)[:1500])
print("tổng dung lượng", round(total / 1024), "KB")
