# python3 tools/contactsheet.py <dir of tNNN.NN.png> <out prefix> [--cols 3 --rows 3 --w 640]
# Tiles shoot.js frames (tools/shoot.js --trail --label) into contact sheets for the visual judge
# (knowledge/visual_judge.md): each tile stamped with its level time, sheets <prefix>_1.jpg, _2.jpg, ...
import sys, os, re
from PIL import Image, ImageDraw, ImageFont
a = sys.argv[1:]; src, pre = a[0], a[1]
def opt(n, d): return int(a[a.index(n) + 1]) if n in a else d
C, R, TW = opt("--cols", 3), opt("--rows", 3), opt("--w", 640); TH = TW * 9 // 16
fs = sorted(f for f in os.listdir(src) if re.match(r"t\d+\.\d+\.png$", f))
try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 26)
except Exception: font = ImageFont.load_default()
n = C * R
for s in range(0, len(fs), n):
    sheet = Image.new("RGB", (C * TW + (C - 1) * 4, R * TH + (R - 1) * 4), (255, 255, 255))
    for i, f in enumerate(fs[s:s + n]):
        im = Image.open(os.path.join(src, f)).convert("RGB").resize((TW, TH), Image.LANCZOS)
        d = ImageDraw.Draw(im); t = float(f[1:-4]); lab = f"{t:.0f}s"
        d.rectangle([0, TH - 34, 80, TH], fill=(0, 0, 0)); d.text((6, TH - 32), lab, fill=(255, 255, 0), font=font)
        sheet.paste(im, ((i % C) * (TW + 4), (i // C) * (TH + 4)))
    out = f"{pre}_{s // n + 1}.jpg"; sheet.save(out, quality=85); print(out)
