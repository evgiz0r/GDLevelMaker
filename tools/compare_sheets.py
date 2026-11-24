# python tools/compare_sheets.py <sheets.json> <out dir>  -- image sheets for tools/compare_sections.js (which calls it):
# sheet_<level>.png per our level (each pair: title, the side-by-side frame, both sides' numbers) and gaps.png (the ranked
# "where we're off" list, one picture each). 1200 px wide, for the phone. Local only (RobTop's art, others' levels).
import json, sys, os, re
from PIL import Image, ImageDraw, ImageFont

W = 1200
def font(sz, bold=False):
    for f in (["arialbd.ttf", "DejaVuSans-Bold.ttf"] if bold else ["arial.ttf", "DejaVuSans.ttf"]):
        try: return ImageFont.truetype(f, sz)
        except OSError: pass
    return ImageFont.load_default()
F_T, F_N, F_S = font(20, True), font(15), font(15, True)
BG, FG, DIM, OURS, REF, BAD = (18, 18, 24), (235, 235, 240), (150, 150, 165), (255, 196, 90), (120, 200, 255), (255, 110, 110)

def wrap(d, text, f, width):
    out, line = [], ""
    for w in text.split(" "):
        t = (line + " " + w).strip()
        if d.textlength(t, font=f) > width and line: out.append(line); line = w
        else: line = t
    return out + [line]

def frame(png):
    if png and os.path.exists(png):
        im = Image.open(png).convert("RGB"); return im.resize((W, round(im.height * W / im.width)))
    im = Image.new("RGB", (W, 120), (40, 40, 48)); ImageDraw.Draw(im).text((20, 50), "(no picture)", fill=DIM, font=F_N); return im

def pair_block(p):
    img = frame(p["png"]); tmp = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    title = wrap(tmp, p["title"], F_T, W - 20)
    rows = p["rows"]; cols = 3; per = (len(rows) + cols - 1) // cols; colw = W // cols
    h = 10 + 26 * len(title) + img.height + 30 + 22 * per + 14
    b = Image.new("RGB", (W, h), BG); d = ImageDraw.Draw(b); y = 8
    for t in title: d.text((10, y), t, fill=FG, font=F_T); y += 26
    b.paste(img, (0, y)); y += img.height + 6
    d.text((10, y), "measure", fill=DIM, font=F_S);
    for c in range(cols):
        d.text((c * colw + colw - 150, y), "ours", fill=OURS, font=F_S); d.text((c * colw + colw - 80, y), "real", fill=REF, font=F_S)
    y += 24
    for i, (area, label, o, r) in enumerate(rows):
        c, k = divmod(i, per); x, yy = c * colw, y + 22 * k
        d.text((x + 10, yy), label[:34], fill=FG, font=F_N)
        d.text((x + colw - 150, yy), o, fill=OURS, font=F_N); d.text((x + colw - 80, yy), r, fill=REF, font=F_N)
    return b

def stack(blocks, path):
    h = sum(b.height for b in blocks) + 6 * len(blocks)
    s = Image.new("RGB", (W, h), (0, 0, 0)); y = 0
    for b in blocks: s.paste(b, (0, y)); y += b.height + 6
    s.save(path, quality=88); print("  ", path)

data = json.load(open(sys.argv[1], encoding="utf8")); out = sys.argv[2]
levels = []
for p in data["pairs"]:
    if p["level"] not in levels: levels.append(p["level"])
for lv in levels:
    stack([pair_block(p) for p in data["pairs"] if p["level"] == lv], os.path.join(out, "sheet_" + re.sub(r"\W+", "_", lv.lower()).strip("_") + ".jpg"))
gb = []
def black_ref(png):
    # the right half (the reference) nearly black: a trigger-built level, nothing drawn where its objects start
    try:
        im = Image.open(png).convert("L"); r = im.crop((im.width // 2, 0, im.width, im.height)).resize((80, 45))
        return sum(r.get_flattened_data()) / (80 * 45) < 25   # Subwoofer Lullaby (2.2, trigger-built) reads 2-15; dark real levels 40+
    except Exception: return True
for g in data["gaps"]:
    opts = g.get("options") or [{"png": g.get("png"), "sub": g.get("sub", "")}]
    pick = next((o for o in opts if o["png"] and not black_ref(o["png"])), opts[0]); g["png"], g["sub"] = pick["png"], pick["sub"]
    img = frame(g["png"]); tmp = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    t = wrap(tmp, g["title"], F_T, W - 20); s = wrap(tmp, g["sub"], F_N, W - 20)
    b = Image.new("RGB", (W, 12 + 26 * len(t) + 20 * len(s) + img.height + 8), BG); d = ImageDraw.Draw(b); y = 8
    for x in t: d.text((10, y), x, fill=BAD, font=F_T); y += 26
    for x in s: d.text((10, y), x, fill=DIM, font=F_N); y += 20
    b.paste(img, (0, y + 4)); gb.append(b)
if gb: stack(gb, os.path.join(out, "gaps.jpg"))
