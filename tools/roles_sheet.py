# python tools/roles_sheet.py <job.json> -- tools/roles.js --shots: the worst sections' frames, each labelled with its
# level, time and the role pairs that mix (path/deco, hazard/bg ...), stacked into one sheet (job["out"]).
import json, sys
from PIL import Image, ImageDraw, ImageFont
job = json.load(open(sys.argv[1]))
try: font = ImageFont.truetype("arialbd.ttf", 26); small = ImageFont.truetype("arial.ttf", 22)
except Exception: font = small = ImageFont.load_default()
rows = []
for it in job["items"]:
    im = Image.open(it["png"]).convert("RGB"); im = im.resize((im.width * 2 // 3, im.height * 2 // 3))
    d = ImageDraw.Draw(im, "RGBA"); lines = [it["label"]] + it["fails"]
    d.rectangle([0, 0, im.width, 14 + 32 * len(lines)], fill=(0, 0, 0, 190))
    for i, t in enumerate(lines): d.text((12, 8 + 32 * i), t, fill=(255, 255, 255) if i == 0 else (255, 140, 120), font=font if i == 0 else small)
    rows.append(im)
out = Image.new("RGB", (max(r.width for r in rows), sum(r.height + 8 for r in rows)), (0, 0, 0)); y = 0
for r in rows: out.paste(r, (0, y)); y += r.height + 8
out.save(job["out"], quality=85); print("wrote", job["out"], out.size)
