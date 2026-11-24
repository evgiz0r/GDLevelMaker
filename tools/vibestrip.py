# python tools/vibestrip.py <frames dir> <storyboard.json> <out.jpg> [--cols 5] [--w 480]
#   -- a level's thumbnails (tools/shoot.js frames named tNNN.NN.png) as one strip, each frame labelled with its time
#      and the section there from tools/storyboard.js --json (mode, speed, hazards per block). For VIBES.md
#      storyboards; the frames hold RobTop's art and other people's levels, so the strip stays in local/.
import sys, os, json, re
from PIL import Image, ImageDraw, ImageFont
a = sys.argv[1:]
if len(a) < 3: print(open(__file__).read().split("\nimport")[0]); sys.exit(1)
src, sbf, out = a[0], a[1], a[2]
opt = lambda k, d: a[a.index(k) + 1] if k in a else d
cols, W = int(opt("--cols", 5)), int(opt("--w", 480))
sb = json.load(open(sbf, encoding="utf8"))
files = sorted([f for f in os.listdir(src) if re.match(r"t[\d.]+\.png$", f)], key=lambda f: float(f[1:-4]))
H = W * 9 // 16; L = 22
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (cols * W, rows * (H + L) + 28), "black")
d = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype("arial.ttf", 15); big = ImageFont.truetype("arial.ttf", 18)
except Exception: font = big = ImageFont.load_default()
d.text((6, 4), f"{sb['name']}  ({sb['seconds']} s, {len(sb['sections'])} sections)", fill="white", font=big)
for i, f in enumerate(files):
    t = float(f[1:-4]); im = Image.open(os.path.join(src, f)).convert("RGB").resize((W, H))
    x, y = (i % cols) * W, 28 + (i // cols) * (H + L)
    sheet.paste(im, (x, y))
    s = next((s for s in sb["sections"] if s["t0"] <= t < s["t1"]), sb["sections"][-1])
    d.text((x + 4, y + H + 3), f"{t:g} s  {s['mode']} {s['speed']}  haz {s['hazards']}/b", fill="#ffe080", font=font)
sheet.save(out, quality=85)
print(out, len(files), "frames")
