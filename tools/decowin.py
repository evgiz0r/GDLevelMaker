# python tools/decowin.py <job.json> <out.png> -- draws tools/decowin.js windows (art-free, flat shapes).
import json, sys, math
from PIL import Image, ImageDraw, ImageFont
job = json.load(open(sys.argv[1])); s = job["ppu"]
try: font = ImageFont.truetype("arialbd.ttf", 15)
except Exception: font = ImageFont.load_default()
Y0, Y1 = -90, 420                       # units shown: a little ground, up to ~14 rows
rows = []
for w in job["wins"]:
    W, H = int(w["w"] * 30 * s), int((Y1 - Y0) * s)
    im = Image.new("RGB", (W, H), tuple(int(v) for v in w["bg"])); d = ImageDraw.Draw(im, "RGBA")
    gy = H - (0 - Y0) * s
    d.rectangle([0, gy, W, H], fill=tuple(int(v) for v in w["ground"]))
    for it in w["items"]:
        X, Y = it["x"] * s, H - (it["y"] - Y0) * s
        hw, hh = it["w"] * s / 2, it["h"] * s / 2
        col = tuple(int(v) for v in it["rgb"]); a = 150 if it["blend"] else 255
        ang = math.radians(it["rot"])
        def pts(p):
            return [(X + px * math.cos(ang) - py * math.sin(ang), Y + px * math.sin(ang) + py * math.cos(ang)) for px, py in p]
        if it["kind"] == "solid":
            d.polygon(pts([(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)]), fill=(10, 10, 14), outline=col)
        elif it["kind"] == "hazard":
            sy = 1 if not it["fy"] else -1
            d.polygon(pts([(-hw, hh * sy), (hw, hh * sy), (0, -hh * sy)]), fill=(8, 8, 10), outline=col)
        elif it["tri"]:
            fx = -1 if it["fx"] else 1; fy = -1 if it["fy"] else 1
            d.polygon(pts([(-hw * fx, hh * fy), (hw * fx, hh * fy), (hw * fx, -hh * fy)]), fill=col + (a,))
        elif it["kind"] in ("orb", "pad", "portal"):
            d.ellipse([X - hw, Y - hh, X + hw, Y + hh], outline=(255, 230, 80), width=2)
        else:
            d.polygon(pts([(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)]), fill=col + (a if it["id"] in (211, 1764, 1765) or it["w"] < 200 else 60,))
    d.text((8, 6), f"{job['title']}  block {w['at']}-{w['at'] + w['w']}  {w['perBlock']} objects/block", fill=(255, 255, 255), font=font)
    rows.append(im)
out = Image.new("RGB", (max(r.width for r in rows), sum(r.height + 6 for r in rows)), (0, 0, 0)); y = 0
for r in rows: out.paste(r, (0, y)); y += r.height + 6
out.save(sys.argv[2]); print("wrote", sys.argv[2], out.size)
