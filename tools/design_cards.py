# python tools/design_cards.py -- picture cards for the design catalogue (tools/designs.js page):
#   blocks: crops each of the 22 block designs (fire beside ice) out of shoot.js frames of
#           levels/gdlm_block_designs.gdlvl, taken by tools/designs.js cards with each third design centred
#           (local/shots/block_cards/t*.png); spikes and saws: cut from the hazards gallery sheet
#           (/mnt/project-files/hazards/spike_designs.jpg, or --spikes <sheet>: 4 columns x 3 rows, plain + 10 spikes,
#           a saw design above each spike) -> local/designs/cards/<kind>-<name>.jpg (GD art: private page only).
import sys, json, os, glob
from PIL import Image
ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "local", "designs", "cards"); os.makedirs(OUT, exist_ok=True)
plan = json.load(open(os.path.join(ROOT, "local", "designs", "cards_plan.json")))
W = 240  # card width in px
made = []
for fr in plan["frames"]:
    im = Image.open(fr["file"]).convert("RGB")
    for d in fr["designs"]:
        cx = 960 + d["dx"] * 607.5
        # fire (row 5, y ~210) and ice (row 2, y ~512) side by side, the label left to the page
        c = Image.new("RGB", (280, 140))
        c.paste(im.crop((int(cx - 70), 140, int(cx + 70), 280)), (0, 0))
        c.paste(im.crop((int(cx - 70), 442, int(cx + 70), 582)), (140, 0))
        c = c.resize((W, int(W * c.height / c.width)), Image.LANCZOS)
        f = os.path.join(OUT, "block-%s.jpg" % d["key"]); c.save(f, quality=82); made.append(f)
sheet = sys.argv[sys.argv.index("--spikes") + 1] if "--spikes" in sys.argv else plan.get("spikeSheet")
if sheet and os.path.exists(sheet):
    im = Image.open(sheet).convert("RGB"); cw = im.width / 4; ch = (im.height - 50) / 3
    for k, name in enumerate(plan["spikes"]):          # cell k: plain, then designs 1..10
        x0, y0 = (k % 4) * cw, 50 + (k // 4) * ch
        c = im.crop((int(x0 + 60), int(y0 + ch * 0.58), int(x0 + cw - 60), int(y0 + ch)))
        c = c.resize((W, int(W * c.height / c.width)), Image.LANCZOS)
        f = os.path.join(OUT, "spike-%s.jpg" % name); c.save(f, quality=82); made.append(f)
    for name, k in plan["saws"].items():               # a cell whose saw is that design
        x0, y0 = (k % 4) * cw, 50 + (k // 4) * ch
        c = im.crop((int(x0 + 85), int(y0 + ch * 0.2), int(x0 + cw - 85), int(y0 + ch * 0.55)))
        c = c.resize((W, int(W * c.height / c.width)), Image.LANCZOS)
        f = os.path.join(OUT, "saw-%s.jpg" % name); c.save(f, quality=82); made.append(f)
print(len(made), "cards ->", os.path.relpath(OUT, ROOT))
