# python tools/claude_kits_sheet.py <job.json> <out.png> -- the Claude icon KIT concepts side by side
# (tools/claude_icons.js kits): one row per kit, its 8 modes at GD icon size (2 px / pixel) and 3x, glow on.
import json, sys
from PIL import Image, ImageDraw, ImageFont
job = json.load(open(sys.argv[1]))
try: font = ImageFont.truetype("arialbd.ttf", 18); small = ImageFont.truetype("arial.ttf", 13)
except Exception: font = small = ImageFont.load_default()

def draw_icon(d, ic, P, GLOW, ox, oy, s):
    w, h, c = ic["w"], ic["h"], ic["c"]
    get = lambda x, y: c[y * w + x] if 0 <= x < w and 0 <= y < h else None
    for y in range(-1, h + 1):
        for x in range(-1, w + 1):
            if get(x, y) is None and any(get(x + dx, y + dy) is not None for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                d.rectangle([ox + (x + 1) * s, oy + (y + 1) * s, ox + (x + 2) * s - 1, oy + (y + 2) * s - 1], fill=GLOW + (140,))
    for y in range(h):
        for x in range(w):
            v = get(x, y)
            if v is not None: d.rectangle([ox + (x + 1) * s, oy + (y + 1) * s, ox + (x + 2) * s - 1, oy + (y + 2) * s - 1], fill=P[v])

CW, RH = 120, 190
im = Image.new("RGB", (20 + CW * 8, 60 + RH * len(job["kits"])), (16, 14, 22))
d = ImageDraw.Draw(im, "RGBA")
d.text((12, 10), "Claude icon kits -- pick one (each row: one kit, one motif + palette on all 8 modes; small = GD icon size, big = 3x)", fill=(240, 230, 220), font=small)
d.text((12, 30), "our own art (lib/claude_icons.js): no logos, nothing of RobTop's", fill=(170, 160, 150), font=small)
for r, kit in enumerate(job["kits"]):
    P = {k: tuple(v) for k, v in kit["palette"].items()}; G = tuple(kit["glow"])
    y0 = 55 + r * RH
    d.rectangle([10, y0, 10 + CW * 8, y0 + RH - 12], fill=(36, 78, 180))
    d.text((18, y0 + 4), kit["title"], fill=(255, 255, 255), font=font)
    for i, ic in enumerate(kit["icons"]):
        ox = 14 + i * CW
        draw_icon(d, ic, P, G, ox + 4, y0 + 34 + (20 - ic["h"]), 2)
        s3 = 3 if ic["w"] <= 26 else 3
        draw_icon(d, ic, P, G, ox + (CW - (ic["w"] + 2) * s3) // 2, y0 + RH - 18 - (ic["h"] + 2) * s3, s3)
        d.text((ox + 60, y0 + 36), ic["mode"], fill=(220, 225, 255), font=small)
im.save(sys.argv[2]); print("wrote", sys.argv[2], im.size)
