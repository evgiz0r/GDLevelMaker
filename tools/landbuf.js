// node tools/landbuf.js --video "<GD claude-rec ...mkv>" --inputs "<GD inputs raw ...csv>" --from S --to S [--window X,Y,W] [--k K]
// The cube's LANDING BUFFER measured straight from a recording, no sim: for every landing of the icon on the ground line
// (tools/track.py, real frame times), the last press before it -- how long before the landing it came, whether it was
// released before the landing -- and whether the game jumped at once (the icon leaves the ground within a frame) or the
// cube stayed down until a later press. Video time = log ms / 1000 + K (K from take-offs: tools/framecheck.js prints it;
// --k). One line per landing that had a press in the 0.6 s before it, sorted by that time: where "jumped" turns into
// "stayed" is the buffer's length. PHYSICS.md "Landing buffer".
// Limits: only landings on the ground line (cube on the floor, the ground in view); a frame is 1/60 s = 4 ticks, so each
// time is +-4 ticks; presses still held at the landing always jump (that is holding, not the buffer) and are listed apart.
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf("--" + k); return i < 0 ? d : a[i + 1]; };
if (!opt("video") || !opt("inputs") || !opt("from") || !opt("to")) { console.log(fs.readFileSync(__filename, "utf8").split("\n")[0]); process.exit(1); }
const ROOT = path.join(__dirname, ".."), CAP = path.join(process.env.USERPROFILE || "", "Videos", "Captures");
const video = fs.existsSync(opt("video")) ? opt("video") : path.join(CAP, opt("video"));
const inFile = fs.existsSync(opt("inputs")) ? opt("inputs") : path.join(ROOT, "local", "inputs", opt("inputs"));
const win = opt("window", "160,101,1600").split(",").map(Number), W = win[2], H = Math.round(W * 9 / 16), PX = 3.375 * W / 1920;
const K = +opt("k", 0.374), T0 = +opt("from"), T1 = +opt("to");
const OUT = path.join(ROOT, "local", "frames"); fs.mkdirSync(OUT, { recursive: true });
const cache = path.join(OUT, path.basename(video).replace(/\.\w+$/, "") + `_${T0}-${T1}.track.csv`);
const csv = fs.existsSync(cache) ? fs.readFileSync(cache, "utf8") : execFileSync("python", [path.join(__dirname, "track.py"), video, "--from", String(T0), "--to", String(T1),
  "--crop", `${win[0]},${win[1]},${W},${H}`, "--rows"], { windowsHide: true, encoding: "utf8", maxBuffer: 1 << 29, stdio: ["ignore", "pipe", "ignore"] });
if (!fs.existsSync(cache)) fs.writeFileSync(cache, csv);
const fr = [];
let last = null;
for (const l of csv.split(/\r?\n/).slice(1)) { const c = l.split(","); if (c.length < 9 || !c[1]) { fr.push({ t: +c[0], h: null }); continue; }
  const key = c.slice(1, 8).join(","); if (key === last) continue; last = key;   // repeated frames: the game drew none
  const cy = +c[2], gl = c[8].split(" ").map(Number).filter(e => isFinite(e) && e > cy && e > win[1] + H * 0.55).sort((p, q) => p - q)[0];
  fr.push({ t: +c[0], h: gl == null ? null : (gl - cy) / PX }); }
const log = fs.readFileSync(inFile, "utf8").split(/\r?\n/).filter(l => /^\d/.test(l)).map(l => { const c = l.split(","); return { t: +c[0] / 1000 + K, down: c[2] === "down" }; });
const onG = f => f.h != null && Math.abs(f.h - 15) < 1.6, inAir = f => f.h != null && f.h > 20 && f.h < 140;
const rows = [];
for (let i = 3; i < fr.length - 2; i++) {
  // a landing: the frame before is in the air (falling), this one on the ground
  if (!onG(fr[i]) || !inAir(fr[i - 1]) || !(fr[i - 2].h != null && fr[i - 2].h >= fr[i - 1].h)) continue;
  const tl = (fr[i - 1].t + fr[i].t) / 2;                                // the landing, +- half a frame
  const pr = log.filter(e => e.down && e.t < tl).pop(); if (!pr || tl - pr.t > 0.6) continue;
  const up = log.find(e => !e.down && e.t > pr.t), held = !up || up.t >= tl;
  // the air time before: the press must come after the previous take-off (else it was the jump's own press)
  let j = i - 1; while (j > 0 && !onG(fr[j])) j--; const tTake = fr[j + 1] ? fr[j].t : null;
  if (tTake != null && pr.t <= tTake + 0.02) continue;
  const next = fr.slice(i + 1, i + 4), jumped = next.length && next.some(f => f.h != null && f.h > 18) && onG(fr[i]);
  // stayed: on the ground for 3+ frames after landing
  const stayed = fr.slice(i, i + 4).every(onG);
  rows.push({ t: +tl.toFixed(3), before: Math.round((tl - pr.t) * 240), relBefore: held ? null : Math.round((tl - up.t) * 240), held, result: stayed ? "stayed" : jumped ? "jumped" : "?" });
}
rows.sort((p, q) => p.before - q.before);
console.log(`K ${K}; ${rows.length} landings with a press in the air before them (ticks of 1/240 s, +-4: one frame)`);
for (const r of rows) console.log(`  video ${r.t.toFixed(2)} s: press ${String(r.before).padStart(3)} ticks before the landing, ${r.held ? "held through it      " : "released " + String(r.relBefore).padStart(3) + " before it"} -> ${r.result}`);
const rel = rows.filter(r => !r.held);
const jumpMax = Math.max(-1, ...rel.filter(r => r.result === "jumped").map(r => r.before)), stayMin = Math.min(1e9, ...rel.filter(r => r.result === "stayed").map(r => r.before));
console.log(`released presses: the game jumped for presses up to ${jumpMax < 0 ? "-" : jumpMax} ticks before landing; stayed down from ${stayMin === 1e9 ? "-" : stayMin} ticks`);
