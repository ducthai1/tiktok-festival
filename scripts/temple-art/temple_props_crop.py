# Tách đồ vật từ ảnh sư (đã tách nền): mõ + đệm (không có sư, không có dùi) và quả chuông + móc treo
# (không có khung gỗ). Xuất WebP + thêm mục "props" vào sprites.json.
# Dùng: python -I temple_props_crop.py <thư mục keyed> <public/assets/temple>
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image

keyed, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
props = out_dir / "props"
props.mkdir(parents=True, exist_ok=True)
load = lambda name: np.asarray(Image.open(keyed / f"{name}.png").convert("RGBA")).copy()

# mõ: vùng mõ + đệm đỏ trong ảnh sư gõ mõ (548×507), cắt trên đầu mõ để bỏ dùi
mo = load("link2-01")[252:385, 366:530]
# chuông (776×537): thân + móc; bỏ hai xà gỗ phía trên (chỉ giữ cột móc treo ở giữa)
X0, Y0, X1, Y1 = 184, 66, 414, 442
bell_a = load("link2-03")[Y0:Y1, X0:X1]
hook = (np.arange(X1 - X0) >= 252 - X0) & (np.arange(X1 - X0) <= 336 - X0)
bell_a[: 135 - Y0, ~hook, 3] = 0


def save(arr, name):
    Image.fromarray(arr, "RGBA").save(props / f"{name}.webp", "WEBP", quality=90, method=6, exact=True)
    return {"file": f"props/{name}.webp", "px": [arr.shape[1], arr.shape[0]]}

manifest_path = out_dir / "sprites.json"
manifest = json.loads(manifest_path.read_text())
manifest.pop("monk", None)  # ảnh sư chỉ dùng để tách đồ vật, game không vẽ sư nữa
manifest["props"] = {
    "mo": save(mo, "mo"),
    "chuong": {**save(bell_a, "chuong"), "pivot": [round((294 - X0) / (X1 - X0), 3), 0.0]},  # móc treo ở đỉnh, giữa
}
manifest_path.write_text(json.dumps(manifest, indent=1, ensure_ascii=False))
print(json.dumps(manifest["props"]))
