# python tools/design_strips.py -- wide cards for the design catalogue's Structures and Indicators groups (tools/designs.js
# cards --more): stitches shoot.js frames of levels/gdlm_structure_designs.gdlvl edge to edge into one strip per gallery copy
# (the whole connector sheet in that design: every join, slopes too), and crops each indicator style off
# levels/gdlm_indicator_styles.gdlvl frames. Reads local/designs/strips_plan.json -> local/designs/cards/ (GD art: private only).
import json, os
from PIL import Image
ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "local", "designs", "cards"); os.makedirs(OUT, exist_ok=True)
plan = json.load(open(os.path.join(ROOT, "local", "designs", "strips_plan.json")))
PX = 3.375; made = []
for s in plan["strips"]:
    fr = [Image.open(f).convert("RGB") for f in s["files"]]
    full = Image.new("RGB", (1920 * len(fr), 1080))
    for k, im in enumerate(fr): full.paste(im, (1920 * k, 0))
    x0, x1 = int(s["px0"]), int(s["px1"])
    c = full.crop((x0, s["y0"], x1, s["y1"]))
    h = 150; c = c.resize((int(c.width * h / c.height), h), Image.LANCZOS)
    f = os.path.join(OUT, s["card"].split("/")[-1]); c.save(f, quality=84); made.append(f)
for s in plan["indicators"]:
    im = Image.open(s["file"]).convert("RGB")
    c = im.crop((s["x0"], 560, s["x0"] + 640, 780)).resize((320, 110), Image.LANCZOS)
    f = os.path.join(OUT, s["card"].split("/")[-1]); c.save(f, quality=84); made.append(f)
print(len(made), "cards ->", os.path.relpath(OUT, ROOT))
