#!/usr/bin/env node
// node tools/bandcheck.js <level.gdlvl> <probe log.jsonl> [--mode swing]
// Same-mode portals against a real-game probe log (PHYSICS.md "A portal of the mode you are in moves the band"): for each
// portal of that mode, whether the game's player went through its box (y at the portal's x), and per stretch after it the
// game's y range against the band each rule predicts -- the new rule (the band re-set around every portal of the mode you
// are in) and the old one (the first portal's band kept). A player out of a band's range without dying = no edge there.
"use strict";
const fs = require("fs");
const io = require("./io.js");
const [lvlF, logF] = process.argv.slice(2).filter(a => !a.startsWith("--"));
if (!lvlF || !logF) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
const mi = process.argv.indexOf("--mode"), MODE = mi > 0 ? process.argv[mi + 1] : "swing";
const PORTAL = { ship: 13, ufo: 111, wave: 660, swing: 1933, ball: 47, spider: 1331 }[MODE];
const BANDH = { ship: 300, ufo: 300, wave: 300, swing: 300, ball: 240, spider: 270 }[MODE];
const L = io.readGdlvl(lvlF).level;
const T = fs.readFileSync(logF, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)).filter(e => e.t === "tick");
const P = L.objects.filter(o => o.id === PORTAL).sort((a, b) => a.x - b.x);
const band = y => { const lo = Math.max(0, Math.floor((y - BANDH / 2) / 30) * 30); return [lo, lo + BANDH]; };
const first = P.length ? band(P[0].y) : null;
const GY = 90;   // probe logs are in game y (ground top 90); level objects in file y (ground top 0)
let lastTouched = null;
for (let i = 0; i < P.length; i++) {
  const o = P[i], near = T.filter(e => Math.abs(e.p[0] - o.x) <= 20);
  if (!near.length) { console.log(`portal x ${o.x} y ${o.y}: not reached`); continue; }
  const ys = near.map(e => e.p[1] - GY), lo = Math.min(...ys), hi = Math.max(...ys);
  const touch = hi >= o.y - 60 && lo <= o.y + 60;   // box 90 tall + half the player
  if (touch) lastTouched = o;
  const x1 = P[i + 1] ? P[i + 1].x : Infinity, seg = T.filter(e => e.p[3] === MODE && e.p[0] >= o.x && e.p[0] < x1);
  const sy = seg.map(e => e.p[1] - GY), slo = sy.length ? Math.min(...sy) : NaN, shi = sy.length ? Math.max(...sy) : NaN;
  const nb = lastTouched ? band(lastTouched.y) : first;
  console.log(`portal x ${o.x} y ${o.y}: player y ${lo.toFixed(0)}..${hi.toFixed(0)} at it -> ${touch ? "TOUCHED" : "missed"} | after it game y ${slo.toFixed(0)}..${shi.toFixed(0)}`
    + ` | new rule (last touched ${lastTouched ? lastTouched.x : "-"}) player ${nb[0] + 15}..${nb[1] - 15}${slo < nb[0] + 15 || shi > nb[1] - 15 ? " OUT" : ""}`
    + ` | old rule ${first[0] + 15}..${first[1] - 15}${slo < first[0] + 15 || shi > first[1] - 15 ? " OUT" : ""}`);
}
