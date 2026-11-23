# python tools/props_sheet.py <job.json> <out.png>
# Draws the prop contact sheet that tools/props.js sheet writes the job for: each prop's objects as
# GD would fill them (deco square 211 = a plain rectangle in its channel colour; GD pieces -- chain 110,
# cogwheel 85 -- as simple stand-ins), with name, object count, size and attach point under it.
# Art-free (no GD sprites): fine for the phone and for committing. The GD-art version: tools/props.js gdsheet.
import json, sys, math
from PIL import Image, ImageDraw, ImageFont

job = json.load(open(sys.argv[1], encoding="utf8"))
cells, cols, S = job["cells"], job.get("cols", 6), job.get("scale", 1.6)  # px per unit
cw, ch = job.get("cellW", 300), job.get("cellH", 330)
rows = math.ceil(len(cells) / cols)
bg = tuple(job.get("bg", [34, 30, 44]))
im = Image.new("RGB", (cols * cw, rows * ch + 40), bg)
d = ImageDraw.Draw(im)
try:
    font = ImageFont.truetype("arial.ttf", 15); big = ImageFont.truetype("arialbd.ttf", 20)
except Exception:
    font = big = ImageFont.load_default()
d.text((10, 8), job.get("title", "props"), fill=(240, 240, 240), font=big)
for i, c in enumerate(cells):
    ox, oy = (i % cols) * cw, (i // cols) * ch + 40
    d.rectangle([ox + 4, oy + 4, ox + cw - 4, oy + ch - 4], outline=(70, 64, 86))
    objs = c["objects"]
    if not objs:
        continue
    xs = [o["x"] for o in objs]; ys = [o["y"] for o in objs]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    s = min(S, (cw - 40) / max(30, c["w"] * 30 + 10), (ch - 90) / max(30, c["h"] * 30 + 10))
    base_x, base_y = ox + cw / 2, oy + (ch - 70) / 2 + 6
    # one block for scale, bottom-left
    d.rectangle([ox + 10, oy + ch - 70 - 30 * s, ox + 10 + 30 * s, oy + ch - 70], outline=(90, 84, 110))
    for o in sorted(objs, key=lambda o: (int(o["props"].get("24", 0)), int(o["props"].get("25", 0)))):
        p = o["props"]; col = tuple(c["colours"].get(p.get("21", ""), [255, 255, 255]))
        sx = float(p.get("128", p.get("32", 1))); sy = float(p.get("129", p.get("32", 1)))
        X, Y = base_x + (o["x"] - cx) * s, base_y - (o["y"] - cy) * s
        if o["id"] == 211:
            w, h = 15 * sx * s, 15 * sy * s
            d.rectangle([X - w, Y - h, X + w - 1, Y + h - 1], fill=col)
        elif o["id"] == 85:  # cogwheel stand-in: a toothed disc
            r = 35 * sx * s
            for k in range(12):
                a = k * math.pi / 6
                d.ellipse([X + math.cos(a) * r * 0.9 - r * 0.16, Y + math.sin(a) * r * 0.9 - r * 0.16, X + math.cos(a) * r * 0.9 + r * 0.16, Y + math.sin(a) * r * 0.9 + r * 0.16], fill=col)
            d.ellipse([X - r * 0.85, Y - r * 0.85, X + r * 0.85, Y + r * 0.85], fill=col)
        elif o["id"] == 110:  # chain link stand-in
            w, h = 9.75 * sx * s, 17 * sx * s
            d.ellipse([X - w * 0.6, Y - h, X + w * 0.6, Y + h], outline=col, width=max(1, int(3 * s)))
        else:
            d.ellipse([X - 8 * s, Y - 8 * s, X + 8 * s, Y + 8 * s], outline=col)
    t = f'{c["name"]}'
    d.text((ox + 12, oy + ch - 62), t, fill=(250, 250, 250), font=big)
    d.text((ox + 12, oy + ch - 36), f'{c["count"]} objects  {c["w"]:.1f}x{c["h"]:.1f} blocks  {c["attach"]}  {c["ncol"]} col', fill=(190, 186, 210), font=font)
im.save(sys.argv[2])
print("wrote", sys.argv[2], im.size)
