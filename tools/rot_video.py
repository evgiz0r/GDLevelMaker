#!/usr/bin/env python3
"""The player's drawn rotation in a recording, per video frame (VISUALS.md "render vs game").

  python tools/rot_video.py VIDEO --from 61.4 --to 62.2 [--color lime|r,g,b] [--tol 70] [--sym 90]

Finds the player's colour blob each frame (like tools/track.py) and the rotation of its outline: the angle, modulo
--sym degrees (90 for a cube: a square looks the same every quarter turn), that makes the blob's bounding box smallest.
Prints CSV: t, cx, cy, angle (degrees, 0..sym, counter-clockwise on screen), unwrapped angle, and the spin rate between
frames (deg/s). Frame times come from the container's pts (tools/track.py), never an assumed rate.
Needs ffmpeg/ffprobe and numpy. Reads the video, never writes it.
"""
import argparse, os, shutil, subprocess, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from track import frame_times, COLORS, tool  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video"); ap.add_argument("--from", dest="t0", type=float, required=True); ap.add_argument("--to", dest="t1", type=float, required=True)
    ap.add_argument("--color", default="lime"); ap.add_argument("--tol", type=float, default=70); ap.add_argument("--sym", type=float, default=90)
    a = ap.parse_args()
    col = np.array(COLORS.get(a.color) or [int(v) for v in a.color.split(",")], dtype=np.int32)
    ts = frame_times(a.video, a.t0, a.t1)
    pr = subprocess.run([tool("ffprobe"), "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", a.video], capture_output=True, text=True)
    W, H = [int(v) for v in pr.stdout.strip().split(",")[:2]]
    p = subprocess.Popen([tool("ffmpeg"), "-v", "error", "-ss", str(a.t0), "-i", a.video, "-t", str(a.t1 - a.t0), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    angs = np.radians(np.arange(0, a.sym, 0.5))
    cs, sn = np.cos(angs), np.sin(angs)
    print("t,cx,cy,angle,unwrapped,deg_per_s")
    prev = None; unw = 0.0; prev_t = None
    for t in ts:
        buf = p.stdout.read(W * H * 3)
        if len(buf) < W * H * 3: break
        fr = np.frombuffer(buf, np.uint8).reshape(H, W, 3).astype(np.int32)
        m = (np.abs(fr - col).sum(axis=2) < a.tol)
        ys, xs = np.nonzero(m)
        if len(xs) < 50: print(f"{t:.4f},,,,,"); continue
        # the biggest blob only: points within 120 px of the median
        mx, my = np.median(xs), np.median(ys); k = (np.abs(xs - mx) < 120) & (np.abs(ys - my) < 120); xs, ys = xs[k] - xs[k].mean(), ys[k] - ys[k].mean()
        # rotate the points by -angle; the angle whose box is smallest is the shape's own rotation
        rx = np.outer(cs, xs) + np.outer(sn, ys); ry = np.outer(-sn, xs) + np.outer(cs, ys)
        area = (rx.max(1) - rx.min(1)) * (ry.max(1) - ry.min(1))
        ang = float(np.degrees(angs[int(np.argmin(area))]))
        ang = (-ang) % a.sym   # screen y is down: report counter-clockwise
        if prev is None: unw = ang
        else:
            d = (ang - prev + a.sym / 2) % a.sym - a.sym / 2; unw += d
        rate = "" if prev_t is None else f"{(d if prev is not None else 0) / max(1e-6, t - prev_t):.0f}"
        print(f"{t:.4f},{mx:.1f},{my:.1f},{ang:.1f},{unw:.1f},{rate}")
        prev, prev_t = ang, t
    p.stdout.close(); p.wait()


if __name__ == "__main__":
    main()
