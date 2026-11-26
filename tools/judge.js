// node tools/judge.js <level.gdlvl> [--json] [--vs <marks.json>]
//   -- the judge: reads a level's saved route (tools/solutions.js) and writes the notes Evgeni writes when he looks at a
//      layout, each pinned to a moment and a block (the user, 2026-11-25: "i want some kind of validation or judge that
//      would say those comments"). Calibrated on his 11 marks on GDLM 44 hellgate v4 (tests/judge.js); every family below
//      is one of his notes, written in knowledge/checklist.md ("Balanced sections" ... "Every orb has an obvious reason"):
//   few clicks      a section (between mode / speed portals) with far fewer clicks per second than the level's own
//                   ("this whole section has 2 clicks? we need balanced sections. with somewhat similar cps")
//   gap             a ground stretch with nothing to press for over GAP s ("too big gap")
//   long corridor   one flying stretch over FLYMAX s ("way too long corridor")
//   same corridor   a flying stretch whose walls follow the same shape as an earlier one ("again same corridor")
//   no variety      a ground section over 4 s built from one kind of obstacle ("bit too long without variety")
//   pointless orb   an orb the route never uses, or with no hazard to clear near it ("i dont get this orb")
//   too easy        a section whose presses all have far wider windows than the level's ("gameplay too easy compared")
//   --vs <marks>: his marks ({x, note} in blocks) against the judge's notes: a mark is found by a note of the kind its words
//   ask for (WORDS below) within 6 blocks of the note's span; prints the misses and the notes he did not make (they may still
//   be right). Thresholds are named below; change them with his next marks. tests/judge.js: 11 of his 13 v4 marks (2026-11-26).
//   Not judged yet (his other two v4 marks): "unseen roof" (a corridor entered from above with its top off screen) and
//   "flat ending" (the last seconds a plain walk to the signature) -- knowledge/checklist.md has both.
"use strict";
const fs = require("fs"), path = require("path");
const GAP = 1.2, FLYMAX = 4.0, FEWCPS = 0.5, SAME = 0.75, VARIETY_S = 4.0;
const FLY = new Set(["ship", "wave", "swing"]);

function judge(file) {
  const { readGdlvl, GD } = require("./io.js"), S = require("./solutions.js"), O = require("../lib/objects.js");
  const L = readGdlvl(file), sol = S.get(L.levelStr, true);
  if (!sol || !sol.events) throw new Error("no saved route for " + file + ": node tools/solutions.js " + file);
  const w = GD.makeWorld(L.level.objects, L.level.header), run = GD.run(w, sol.events), p = run.path, TPS = 240;
  const prog = s => GD.progressX ? GD.progressX(s) : s.x, blk = s => +(prog(s) / 30).toFixed(1), tt = k => +(k / TPS).toFixed(2);
  const presses = sol.events.filter(e => e.type === "press").map(e => e.tick);
  // sections: spans of one mode and speed
  const secs = [];
  for (let k = 0; k < p.length; k++) { const s = p[k], key = s.mode + "@" + s.sp;
    if (!secs.length || secs[secs.length - 1].key !== key) secs.push({ key, mode: s.mode, sp: s.sp, a: k, b: k }); else secs[secs.length - 1].b = k; }
  // merge blips under 0.3 s into the one before (a portal grazed for a tick)
  for (let i = secs.length - 1; i > 0; i--) if (secs[i].b - secs[i].a < 0.3 * TPS) { secs[i - 1].b = secs[i].b; secs.splice(i, 1); }
  for (const s of secs) { s.dur = (s.b - s.a) / TPS; s.n = presses.filter(t => t >= s.a && t <= s.b).length; s.cps = s.n / Math.max(s.dur, 0.01); }
  const P_ = k => p[Math.max(0, Math.min(k, p.length - 1))];
  // a note pins a moment and, for a stretch, its span (x0..x1 in blocks): a mark anywhere on the span is the same note
  const notes = [], at = (k, kind, note, a, b) => notes.push(Object.assign({ t: tt(k), x: blk(P_(k)), y: Math.round(GD.worldXY ? GD.worldXY(P_(k)).y : P_(k).y), kind, note }, a != null ? { x0: blk(P_(a)), x1: blk(P_(b)) } : {}));
  const med = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };
  const levelCps = presses.length / (p.length / TPS);
  // few clicks
  for (const s of secs) if (s.dur >= 2 && s.cps < FEWCPS * levelCps)
    at((s.a + s.b) >> 1, "few clicks", `${s.mode} ${s.sp}: ${s.n} click${s.n === 1 ? "" : "s"} in ${s.dur.toFixed(1)} s (${s.cps.toFixed(1)}/s; the level ${levelCps.toFixed(1)}/s)`, s.a, s.b);
  // gaps on the ground (from a section's start or a press to the next press)
  for (const s of secs) { if (FLY.has(s.mode)) continue;
    const ts = [s.a, ...presses.filter(t => t > s.a && t <= s.b), s.b];
    for (let i = 1; i < ts.length; i++) if ((ts[i] - ts[i - 1]) / TPS > GAP) at((ts[i - 1] + ts[i]) >> 1, "gap", `${((ts[i] - ts[i - 1]) / TPS).toFixed(1)} s with nothing to press (${s.mode})`, ts[i - 1], ts[i]); }
  // flying stretches: too long, and the same wall shape as an earlier one
  // a corridor's shape = its floor, block by block: the top of the highest solid under the route (from the start's)
  const solids = L.level.objects.filter(o => (O.objInfo(o.id) || {}).kind === "solid");
  const byCol = new Map(); for (const o of solids) { const c = Math.floor(o.x / 30); if (!byCol.has(c)) byCol.set(c, []); byCol.get(c).push(o.y); }
  const shape = s => { const out = []; let f0 = null;
    for (let k = s.a; k <= s.b; k += 8) { const q = p[k], c = Math.floor(q.x / 30), ys = (byCol.get(c) || []).filter(y => y < q.y);
      const f = ys.length ? Math.max(...ys) : 0; if (f0 == null) f0 = f; if (!out.length || out[out.length - 1].c !== c) out.push({ c, f: f - f0 }); }
    return out.map(o => o.f); };
  const fly = secs.filter(s => FLY.has(s.mode) && s.dur >= 1.5);
  fly.forEach((s, i) => {
    if (s.dur > FLYMAX) at((s.a + s.b) >> 1, "long corridor", `${s.mode} ${s.sp}: ${s.dur.toFixed(1)} s of one corridor (want ${FLYMAX} s or less per idea)`, s.a, s.b);
    s.sh = shape(s);
    for (let j = 0; j < i; j++) { const sim = similar(s.sh, fly[j].sh); if (sim >= SAME) { at((s.a + s.b) >> 1, "same corridor", `corridor shaped like the ${fly[j].mode} at ${tt(fly[j].a)} s (${Math.round(sim * 100)}% alike)`, s.a, s.b); break; } }
  });
  // variety: a long ground section made of one hazard kind
  const objs = L.level.objects, kindOf = o => (O.objInfo(o.id) || {}).kind;
  for (const s of secs) { if (FLY.has(s.mode) || s.dur < VARIETY_S) continue;
    const x0 = prog(p[s.a]), x1 = prog(p[s.b]), ids = new Set(objs.filter(o => o.x >= x0 && o.x <= x1 && /hazard|orb|pad/.test(kindOf(o) || "")).map(o => o.id));
    if (ids.size <= 1) at((s.a + s.b) >> 1, "no variety", `${s.mode}: ${s.dur.toFixed(1)} s with ${ids.size ? "one kind of obstacle" : "no obstacles"}`, s.a, s.b); }
  // orbs: used by the route? something to clear near it?
  const used = new Set(); for (const s of p) for (const u of s.used || []) used.add(u);
  const hz = objs.filter(o => kindOf(o) === "hazard");
  objs.forEach((o, i) => { if (kindOf(o) !== "orb") return;
    const near = hz.some(h => h.x > o.x - 30 && h.x < o.x + 150 && Math.abs(h.y - o.y) < 150);
    const k = p.findIndex(s => s.x >= o.x);
    const touched = used.has(i) || used.has(o) || used.size === 0;
    if (!near || !touched) at(k < 0 ? p.length - 1 : k, "pointless orb", !touched ? "an orb the route never uses" : "an orb with nothing to clear near it"); });
  // too easy: a section whose median window is far wider than the level's
  if (sol.windows) {
    const win = sol.windows.filter(x => x[0] === 0).map(x => ({ k: x[1], ms: (x[3] - x[2]) / 0.24 })), lv = med(win.map(x => x.ms));
    for (const s of secs) { const m = win.filter(x => x.k >= s.a && x.k <= s.b).map(x => x.ms);
      if (m.length >= 2 && med(m) > 2 * lv) at((s.a + s.b) >> 1, "too easy", `${s.mode}: its presses have ${Math.round(med(m))} ms windows, the level ${Math.round(lv)} ms`, s.a, s.b); }
  }
  notes.sort((a, b) => a.t - b.t);
  return { file, levelCps: +levelCps.toFixed(2), sections: secs.map(s => ({ mode: s.mode, sp: s.sp, t0: tt(s.a), dur: +s.dur.toFixed(1), clicks: s.n })), notes };
}
// how alike two corridors are: each floor as its run of plateaus (heights held 3+ columns), compared in order (longest
// common run / the longer list). Width-free, so the same recipe at another speed or flat length still matches (v4's ship,
// swing and 3x ship: one recipe, Evgeni: "again same corridor", "same corridor x3")
function similar(a, b) {
  const pl = v => { const out = []; let run = 1; for (let i = 1; i <= v.length; i++) { if (i < v.length && Math.abs(v[i] - v[i - 1]) <= 15) { run++; continue; }
    if (run >= 3 && (!out.length || Math.abs(out[out.length - 1] - v[i - 1]) > 15)) out.push(v[i - 1]); run = 1; } return out; };
  const A = pl(a || []), B = pl(b || []); if (A.length < 3 || B.length < 3) return 0;
  const L = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
  for (let i = 1; i <= A.length; i++) for (let j = 1; j <= B.length; j++) L[i][j] = Math.abs(A[i - 1] - B[j - 1]) <= 15 ? L[i - 1][j - 1] + 1 : Math.max(L[i - 1][j], L[i][j - 1]);
  return L[A.length][B.length] / Math.max(A.length, B.length);
}

if (require.main === module) {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  if (!a[0]) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  const r = judge(a[0]);
  if (a.includes("--json")) { console.log(JSON.stringify(r, null, 1)); process.exit(0); }
  console.log(`${path.basename(a[0])}: ${r.notes.length} notes (level ${r.levelCps} clicks/s)`);
  for (const n of r.notes) console.log(`  ${String(n.t).padStart(6)} s  block ${String(n.x).padStart(6)}  ${n.kind.padEnd(14)} ${n.note}`);
  if (opt("--vs")) {
    const marks = JSON.parse(fs.readFileSync(opt("--vs"), "utf8")), R = 6;   // a mark is found by a note of its kind within 6 blocks (of its span)
    // which note kinds answer a mark, from its words (a mark with "kinds" keeps its own)
    const WORDS = [[/same|again|x3/i, ["same corridor"]], [/long corridor|too long corridor/i, ["long corridor"]], [/gap/i, ["gap", "few clicks"]],
      [/clicks|cps|balanced/i, ["few clicks"]], [/orb/i, ["pointless orb"]], [/variet|veriat/i, ["no variety"]], [/easy/i, ["too easy", "few clicks"]],
      [/top|roof|secret/i, ["unseen roof"]], [/last|end|sign/i, ["flat ending"]]];
    const kindsOf = m => m.kinds || [].concat(...WORDS.filter(([re]) => re.test(m.note)).map(w => w[1]));
    let hit = 0; console.log("\nagainst the marks:");
    const near = (n, x) => n.x0 != null ? x >= n.x0 - R && x <= n.x1 + R : Math.abs(n.x - x) <= R;
    for (const m of marks) { const ks = kindsOf(m), n = r.notes.filter(n => near(n, m.x) && (!ks.length || ks.includes(n.kind))); if (n.length) hit++;
      console.log(`  ${n.length ? "FOUND " : "missed"} block ${m.x}: "${m.note}"${n.length ? "  <- " + n.map(z => z.kind).join(", ") : ""}`); }
    const extra = r.notes.filter(n => !marks.some(m => near(n, m.x) && kindsOf(m).includes(n.kind)));
    console.log(`  ${hit}/${marks.length} marks found; ${extra.length} notes he did not make`);
  }
}
module.exports = { judge, similar, GAP };
