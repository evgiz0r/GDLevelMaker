# python tools/mapbeats.py <map.jpg> <bpm> [--rows 4] [--row-seconds 15.31] [--out f.jpg]
#   -- beat and bar lines over a level map from tools/levelmap.js (the phone .jpg, 1600 px, 4 rows at 1x), so the layout can
#   be read against the music (Evgeni, 2026-11-25: "can i see the layout with the beats?"). Assumes beat 1 at the level's
#   start (a spec with "offset" on a downbeat, as GDLM 44 v3) and the map's default geometry (0 s at x 7, 103.5 px a second,
#   row bands 70-245 / 300-475 / 530-705 / 760-935); check the b21 / mode lines land on the portals before trusting it.
#   Next: draw these lines inside levelmap.js itself from the level's song grid.
import sys
from PIL import Image, ImageDraw
a = sys.argv[1:]; opt = lambda k, d: a[a.index(k) + 1] if k in a else d
src, bpm = a[0], float(a[1]); P = 60 / bpm; rs = float(opt("--row-seconds", 15.31)); pps = (1560 - 7) / 15.0
out = opt("--out", src.replace(".jpg", "_beats.jpg"))
im = Image.open(src).convert("RGBA"); ov = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
for k in range(int(opt("--rows", 4))):
    y0, y1, t0, b = 70 + 230 * k, 245 + 230 * k, k * rs, 0
    while b * P <= t0 + rs + 0.1:
        t = b * P; x = 7 + (t - t0) * pps
        if t >= t0 - 0.01 and x <= im.size[0] - 5:
            bar = b % 4 == 0
            d.line([(x, y0), (x, y1)], fill=(255, 255, 255, 150 if bar else 45), width=2 if bar else 1)
            if bar: d.text((x + 2, y1 - 12), "b%d" % (b + 1), fill=(255, 255, 255, 200))
        b += 1
Image.alpha_composite(im, ov).convert("RGB").save(out, quality=88); print("->", out)
