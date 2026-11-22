#!/usr/bin/env python3
"""Track the player in a recording of the user's game, one row per video frame.

  python tools/track.py VIDEO --from 8.2 --to 8.9 [--crop x,y,w,h] [--color lime|r,g,b] [--tol 60]
                              [--rows]  [--sheet out.png --every 1]

Prints CSV: t (real frame time from the container's pts), cx, cy (centre of the colour blob in
screen px, full-frame coordinates), n (pixels), x0,x1,y0,y1 (blob box).
--rows also prints, per frame, the y of strong horizontal edges in the crop (ground line, ceiling
rows): GD's camera moves up and down, so heights must be measured against those, not the screen.
--sheet writes a contact sheet of the frames instead (to look at them).

Facts (CLAUDE.md "Calibration"): at 1080p one unit = 3.375 px (a block is 101 px). Game Bar
captures are variable ~30 fps, so frame times come from pts, never from an assumed rate; our own
tools/record.sh captures are constant 60 fps. The default cube colour is lime (the user's icon).
Hitbox-on practice runs draw the exact hitbox each step: the best data.

Needs ffmpeg/ffprobe on PATH (or FFMPEG/FFPROBE env) and numpy. Reads the video, never writes it.
"""
import argparse, json, os, shutil, subprocess, sys
import numpy as np

COLORS = {"lime": (125, 255, 0), "cyan": (0, 255, 255), "yellow": (255, 255, 0)}


def tool(name):
    return os.environ.get(name.upper()) or shutil.which(name) or name


def frame_times(video, t0, t1):
    """Presentation times of the frames in [t0, t1), sorted (packets come in decode order)."""
    out = subprocess.run([tool("ffprobe"), "-v", "error", "-select_streams", "v:0", "-read_intervals",
                          f"{max(t0 - 2, 0)}%{t1 + 1}", "-show_entries", "packet=pts_time", "-of", "csv=p=0", video],
                         capture_output=True, text=True).stdout.split()
    ts = sorted(float(x.strip(",")) for x in out if x.strip(",") not in ("", "N/A"))
    return [t for t in ts if t0 - 1e-6 <= t < t1]


def frames(video, t0, t1, crop):
    """Yields (t, rgb array) for each frame in [t0, t1). Uses -copyts so times match pts."""
    probe = json.loads(subprocess.run([tool("ffprobe"), "-v", "error", "-select_streams", "v:0", "-show_entries",
                                       "stream=width,height", "-of", "json", video], capture_output=True, text=True).stdout)
    W, H = probe["streams"][0]["width"], probe["streams"][0]["height"]
    x, y, w, h = crop or (0, 0, W, H)
    ts = frame_times(video, t0, t1)
    vf = f"crop={w}:{h}:{x}:{y}"
    p = subprocess.Popen([tool("ffmpeg"), "-v", "error", "-ss", str(max(t0 - 0.5, 0)), "-copyts", "-i", video,
                          "-vf", f"select='gte(t\\,{t0 - 1e-4})*lt(t\\,{t1})',{vf}", "-vsync", "passthrough",
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    n = w * h * 3
    for t in ts:
        buf = p.stdout.read(n)
        if len(buf) < n:
            break
        yield t, np.frombuffer(buf, np.uint8).reshape(h, w, 3)
    p.stdout.close()
    p.wait()


def blob(img, rgb, tol):
    d = np.abs(img.astype(np.int16) - np.array(rgb, np.int16)).max(axis=2)
    ys, xs = np.nonzero(d <= tol)
    if len(xs) < 20:
        return None
    # keep the largest group: the cube, not lime bits of the background/UI
    mx, my = np.median(xs), np.median(ys)
    keep = (np.abs(xs - mx) < 120) & (np.abs(ys - my) < 120)
    xs, ys = xs[keep], ys[keep]
    return xs.mean(), ys.mean(), len(xs), xs.min(), xs.max(), ys.min(), ys.max()


def rows(img, k=4):
    """y of the k strongest horizontal brightness edges (ground line, block rows)."""
    g = img.mean(axis=2)
    e = np.abs(np.diff(g, axis=0)).mean(axis=1)
    out = []
    for y in np.argsort(e)[::-1]:
        if all(abs(y - o) > 6 for o in out):
            out.append(int(y))
        if len(out) == k:
            break
    return sorted(out)


def main():
    a = argparse.ArgumentParser()
    a.add_argument("video")
    a.add_argument("--from", dest="t0", type=float, default=0)
    a.add_argument("--to", dest="t1", type=float, default=1e9)
    a.add_argument("--crop", help="x,y,w,h in screen px")
    a.add_argument("--color", default="lime")
    a.add_argument("--tol", type=int, default=60)
    a.add_argument("--rows", action="store_true")
    a.add_argument("--sheet")
    a.add_argument("--every", type=int, default=1)
    o = a.parse_args()
    crop = tuple(int(v) for v in o.crop.split(",")) if o.crop else None
    rgb = COLORS.get(o.color) or tuple(int(v) for v in o.color.split(","))
    ox, oy = (crop[0], crop[1]) if crop else (0, 0)
    if o.sheet:
        imgs = [im for i, (t, im) in enumerate(frames(o.video, o.t0, o.t1, crop)) if i % o.every == 0]
        if not imgs:
            sys.exit("no frames")
        cols = min(6, len(imgs))
        rws = -(-len(imgs) // cols)
        h, w, _ = imgs[0].shape
        sheet = np.zeros((rws * h, cols * w, 3), np.uint8)
        for i, im in enumerate(imgs):
            sheet[(i // cols) * h:(i // cols + 1) * h, (i % cols) * w:(i % cols + 1) * w] = im
        subprocess.run([tool("ffmpeg"), "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s",
                        f"{sheet.shape[1]}x{sheet.shape[0]}", "-i", "-", o.sheet], input=sheet.tobytes())
        print(f"{len(imgs)} frames -> {o.sheet}")
        return
    print("t,cx,cy,n,x0,x1,y0,y1" + (",rows" if o.rows else ""))
    for t, im in frames(o.video, o.t0, o.t1, crop):
        b = blob(im, rgb, o.tol)
        line = f"{t:.4f}," + (",".join(f"{v:.1f}" for v in (b[0] + ox, b[1] + oy)) + f",{b[2]}," +
                              ",".join(str(int(v)) for v in (b[3] + ox, b[4] + ox, b[5] + oy, b[6] + oy)) if b else ",,0,,,,")
        if o.rows:
            line += "," + " ".join(str(r + oy) for r in rows(im))
        print(line)


if __name__ == "__main__":
    main()
