#!/usr/bin/env node
// Frame-by-frame check of a GDLM Probe log against our sim replaying the same presses (PHYSICS.md "The probe logs, step by step").
// usage: node tools/probe_frames.js <log.jsonl> <level | official:N> steps <from> <to>   -- game vs sim per step (game tick n = sim path[n-1])
//        node tools/probe_frames.js <log.jsonl> <level | official:N> jumps                -- every cube jump: fresh / held through a landing,
//            and whether the game's position at the next frame is the sim's (positions, not the logged vy: the log reads vy before
//            the step's gravity, so a jump's vy shows a tick early)
// The level must be the version that was played (git show <commit>:levels/...). Light: no heavy slot.
"use strict";
const fs = require("fs");
const { GD } = require("./io.js");
const { levelOf } = require("./shoot.js");
const [file, lvl, cmd, a, b] = process.argv.slice(2);
if (!file || !lvl) { console.error("usage: node tools/probe_frames.js <log.jsonl> <level> steps <from> <to> | jumps"); process.exit(1); }
const rows = fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const T = rows.filter((r) => r.t === "tick"), byN = {};
for (const t of T) byN[t.n] = t;
const frames = new Set();
for (let i = 1; i < T.length; i++) if (T[i].p[0] !== T[i - 1].p[0]) frames.add(T[i].n);
const L = levelOf(lvl), lv = GD.parseLevel(L.levelStr), w = GD.makeWorld(lv.objects, lv.header);
const ev = rows.filter((r) => r.t === "btn" && r.button === 1 && r.p1).map((r) => ({ tick: r.n, type: r.down ? "press" : "release" }));
const P = GD.run(w, ev).path;
const DY = 90;   // the game's y is ours + 90
if (cmd === "steps") {
  for (let n = +a; n <= +b; n++) {
    const t = byN[n], q = P[n - 1];
    if (!t || !q) break;
    const g = t.p, f = (v) => (typeof v === "number" ? v.toFixed(3) : v);
    console.log(`${n}${frames.has(n) ? "*" : " "} game x ${f(g[0])} y ${f(g[1])} vy ${f(g[2])} ${g[3]} ground ${g[5]} | sim x ${f(q.x)} y ${f(q.y + DY)} vy ${f(q.vy)} ${q.mode} ground ${q.grounded ? 1 : 0}${frames.has(n) && (Math.abs(g[0] - q.x) > 0.01 || Math.abs(g[1] - q.y - DY) > 0.01) ? "  <-- differs" : ""}`);
  }
} else {
  const lastPress = (n) => { let p = null; for (const e of ev) { if (e.tick > n) break; if (e.type === "press") p = e.tick; } return p; };
  const tab = {};
  for (let J = 2; J < P.length - 12; J++) {
    if (!(P[J - 1].grounded && !P[J].grounded && P[J].mode === "cube" && P[J].vy > 5 && P[J].vy < 12.5)) continue;
    let pre = null; for (let n = J; n > J - 8; n--) if (frames.has(n) && byN[n]) { pre = byN[n].p[1] - (P[n - 1].y + DY); break; }
    if (pre === null || Math.abs(pre) > 0.01) continue;   // already apart before the jump: not this jump's fault
    let post = null; for (let n = J + 2; n < J + 12; n++) if (frames.has(n) && byN[n]) { post = byN[n].p[1] - (P[n - 1].y + DY); break; }
    if (post === null) continue;
    const p = lastPress(J - 1); let Lg = J - 1; while (Lg > 0 && P[Lg - 1].grounded) Lg--;
    const kind = p === null ? "no press" : p < Lg ? "held through landing" : "fresh";
    const k = `${kind}: ${Math.abs(post) < 0.01 ? "same" : "game - sim " + post.toFixed(2)}`;
    tab[k] = (tab[k] || 0) + 1;
    if (Math.abs(post) >= 0.01) console.log(`  jump at step ${J} (${kind}, press ${p}, landed ${Lg}): game - sim ${post.toFixed(2)} at the next frame`);
  }
  for (const [k, v] of Object.entries(tab)) console.log(`${k} x${v}`);
}
