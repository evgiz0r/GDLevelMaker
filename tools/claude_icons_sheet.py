# python tools/claude_icons_sheet.py <job.json> <out.png> -- draws the Claude icon preview (tools/claude_icons.js sheet).
# Each icon at GD icon size (2 px a pixel) and 4x (8 px a pixel), with a 1-pixel glow, on dark and GD-blue.
import json, sys
from PIL import Image, ImageDraw, ImageFont

job = json.load(open(sys.argv[1]))
P = {k: tuple(v) for k, v in job["palette"].items()}
GLOW = tuple(job["glow"])
BGS = [(22, 20, 30), (40, 90, 200)]
try: font = ImageFont.truetype("arialbd.ttf", 16); small = ImageFont.truetype("arial.ttf", 13)
except Exception: font = small = ImageFont.load_default()

def draw_icon(im, ic, ox, oy, s, bg):
    w, h, c = ic["w"], ic["h"], ic["c"]
    get = lambda x, y: c[y * w + x] if 0 <= x < w and 0 <= y < h else None
    d = ImageDraw.Draw(im, "RGBA")
    for y in range(-1, h + 1):
        for x in range(-1, w + 1):
            if get(x, y) is not None: continue
            if any(get(x + dx, y + dy) is not None for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                d.rectangle([ox + (x + 1) * s, oy + (y + 1) * s, ox + (x + 2) * s - 1, oy + (y + 2) * s - 1], fill=GLOW + (150,))
    for y in range(h):
        for x in range(w):
            v = get(x, y)
            if v is not None: d.rectangle([ox + (x + 1) * s, oy + (y + 1) * s, ox + (x + 2) * s - 1, oy + (y + 2) * s - 1], fill=P[v])

cw, rows = 300, len(BGS)
W, H = cw * len(job["icons"]) // 2, 60 + 2 * (300 * rows // 2 + 160)
im = Image.new("RGB", (cw * 4 + 20, 70 + 2 * 380), (14, 12, 20))
d = ImageDraw.Draw(im)
d.text((12, 10), "Claude icon set (preview) -- lib/claude_icons.js, our own art: icon size (2 px / pixel) and 4x, glow on", fill=(240, 230, 220), font=font)
d.text((12, 34), "terracotta body, cream plates, a visor with two amber eyes (the signature robot's face); glow " + str(GLOW), fill=(180, 170, 160), font=small)
for i, ic in enumerate(job["icons"]):
    col, row = i % 4, i // 4
    ox, oy = 10 + col * cw, 70 + row * 380
    for b, bg in enumerate(BGS):
        y0 = oy + b * 170
        d.rectangle([ox, y0, ox + cw - 10, y0 + 160], fill=bg)
        draw_icon(im, ic, ox + 10, y0 + 10 + (32 - ic["h"]), 2, bg)          # icon size
        s4 = min(8, (cw - 80) // (ic["w"] + 2), 150 // (ic["h"] + 2))       # 4x of icon size, smaller only if it would not fit
        draw_icon(im, ic, ox + 70, y0 + (160 - (ic["h"] + 2) * s4) // 2, s4, bg)
    d.text((ox + 4, oy + 343), ic["mode"], fill=(240, 230, 220), font=font)
im.save(sys.argv[2])
print("wrote", sys.argv[2], im.size)
