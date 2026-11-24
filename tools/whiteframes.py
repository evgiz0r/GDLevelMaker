# python tools/whiteframes.py <video.mkv> [--every 2] [--from S] [--to S] [--out local/whiteframes/<name>]
# After every user recording (CLAUDE.md "Calibration"): find stretches where the GAME shows large PURE WHITE shapes --
# deco the game could not colour (a channel nothing defines: tools/channels.js). The user, 2026-11-24, after GDLM 67:
# "our deco being pure white within the game is still expected?" and "why we never saw it". Samples a frame every
# --every s (ffmpeg, never copies the video), marks pixels with all of R, G, B >= 253 (GD's white; the Claude app's light
# theme is ~228, so the desktop around GD does not count), and flags a frame when a white run is TALL (a column of
# >= 22% of the frame height, >= 6 px wide) -- text and the death flash are short or round. Writes a contact sheet of
# flagged frames with red boxes (only shapes with GAME colour beside them: an app window's white panels do not count)
# + a JSON list (seconds, boxes). Then compare those seconds with the viewer at the same
# level time and run node tools/channels.js on the level played. Light: no heavy slot needed.
import json, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image, ImageDraw
args = sys.argv[1:]
def opt(n, d):
    return args[args.index(n) + 1] if n in args else d
video = args[0]; every = float(opt("--every", 2)); t0 = float(opt("--from", 0)); t1 = opt("--to", None)
name = os.path.splitext(os.path.basename(video))[0].replace(" ", "_")
out = opt("--out", os.path.join("local", "whiteframes", name)); os.makedirs(out, exist_ok=True)
NOWIN = 0x08000000 if os.name == "nt" else 0   # CREATE_NO_WINDOW: never pop a console (CLAUDE.md)
tmp = tempfile.mkdtemp()
vf = f"fps=1/{every},scale=960:-1"
cmd = ["ffmpeg", "-v", "error", "-ss", str(t0)] + (["-to", str(t1)] if t1 else []) + ["-i", video, "-vf", vf, os.path.join(tmp, "f%05d.png")]
subprocess.run(cmd, creationflags=NOWIN)
hits = []
for i, f in enumerate(sorted(os.listdir(tmp))):
    t = round(t0 + i * every, 2)
    im = Image.open(os.path.join(tmp, f)).convert("RGB"); a = np.asarray(im); H, W = a.shape[:2]
    m = (a >= 253).all(2)
    # tallest vertical white run per column
    best = np.zeros(W, int)
    for x in range(W):
        col = m[:, x]
        if not col.any(): continue
        d = np.diff(np.concatenate([[0], col.astype(int), [0]])); s = np.where(d == 1)[0]; e = np.where(d == -1)[0]
        best[x] = (e - s).max()
    tall = best >= 0.22 * H
    boxes = []; x = 0
    while x < W:
        if tall[x]:
            x2 = x
            while x2 + 1 < W and tall[x2 + 1]: x2 += 1
            if x2 - x + 1 >= 6:
                ys = np.where(m[:, x:x2 + 1].any(1))[0]; y0, y1 = int(ys.min()), int(ys.max())
                # inside the GAME: the strips beside it are coloured (GD's scenery), not the grey/white of an app window
                side = np.concatenate([a[y0:y1 + 1, max(0, x - 12):max(0, x - 4)].reshape(-1, 3), a[y0:y1 + 1, x2 + 4:x2 + 12].reshape(-1, 3)]).astype(int)
                if len(side) and np.median(side.max(1) - side.min(1)) >= 50: boxes.append([int(x), y0, int(x2), y1])
            x = x2 + 1
        else: x += 1
    if boxes: hits.append({"t": t, "boxes": boxes, "img": os.path.join(tmp, f)})
# static white things on the desktop (a window edge, a scrollbar) sit at the same x in most frames: drop them
from collections import Counter
nf = max(1, len(os.listdir(tmp))); cnt = Counter(b[0] // 8 for h in hits for b in h["boxes"])
static = {k for k, v in cnt.items() if v > 0.3 * nf}
for h in hits: h["boxes"] = [b for b in h["boxes"] if b[0] // 8 not in static and (b[0] // 8) - 1 not in static and (b[0] // 8) + 1 not in static]
hits = [h for h in hits if h["boxes"]]
print(f"{name}: {len(os.listdir(tmp))} frames sampled every {every} s, {len(hits)} with tall pure-white shapes")
for h in hits[:40]: print(f"  {h['t']:8.1f} s  {len(h['boxes'])} shape(s)  x {[b[0] for b in h['boxes']][:6]}")
if hits:
    thumbs = []
    for h in hits[:24]:
        im = Image.open(h["img"]).convert("RGB"); d = ImageDraw.Draw(im)
        for b in h["boxes"]: d.rectangle(b, outline=(255, 0, 0), width=3)
        d.text((8, 8), f"{h['t']} s", fill=(255, 0, 0)); thumbs.append(im.resize((480, int(480 * im.height / im.width))))
    cols = 3; tw, th = thumbs[0].size; rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new("RGB", (tw * cols, th * rows))
    for k, im in enumerate(thumbs): sheet.paste(im, ((k % cols) * tw, (k // cols) * th))
    sheet.save(os.path.join(out, "white.png")); print("sheet:", os.path.join(out, "white.png"))
json.dump([{"t": h["t"], "boxes": h["boxes"]} for h in hits], open(os.path.join(out, "white.json"), "w"))
