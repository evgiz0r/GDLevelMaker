// node tools/channels.js [level.gdlvl ...] [--all] [--json]  -- deco that the GAME will draw white (or not as we meant)
// The user, 2026-11-24, after GDLM 67 in the real game: "our deco being pure white within the game is still expected?"
// GD colours an object by its channel (key 21 main, 22 detail); with no key it uses the object's DEFAULT channel
// (knowledge/objects/catalogue.tsv ch_main / ch_detail: 1 for the 211 / 693 squares and triangles). A channel 1-999 that
// the header (kS38) does not define is WHITE in the game. The viewer draws an object with no key in the object colour
// (1004), so the two can differ. Flags, per level:
//   undefined   an object's channel (its key, or its default) is a user channel 1-999 not in the header and not set
//               by a colour trigger at or before it (one by x 60 counts from the start)
//   nokey       deco with no channel key (it takes its default: white unless that channel is defined)
// FAIL when any deco lands on an undefined channel (score.js gate "channels"); `nokey` alone is a note.
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), O = require("../lib/objects.js");
const CAT = {};
for (const line of fs.readFileSync(path.join(ROOT, "knowledge", "objects", "catalogue.tsv"), "utf8").split("\n").slice(1)) { const c = line.split("\t"); if (c.length >= 10) CAT[c[0]] = { main: +c[8] || 0, detail: +c[9] || 0 }; }
function defined(header) {
  const m = /(?:^|,)kS38,([^,]*)/.exec(header || ""), set = new Set();
  if (m) for (const s of m[1].split("|")) { const x = /(?:^|_)6_(\d+)/.exec(s); if (x) set.add(+x[1]); }
  return set;
}
function check(L) {
  // a colour trigger (899, key 23 = its target channel) defines the channel from its x on (GD fires it as the player
  // crosses it; the scene levels set channels 20-39 with triggers at x 15, duration 0)
  const def = defined(L.header), bad = {}, nokey = {}, trig = {};
  for (const o of L.objects) if (o.id === 899 && o.props && o.props[23] != null) { const c = +o.props[23]; trig[c] = Math.min(trig[c] ?? Infinity, o.x); }
  const isDef = (ch, x) => def.has(ch) || (trig[ch] != null && trig[ch] <= Math.max(x, 60));
  let deco = 0;
  for (const o of L.objects) {
    const k = (O.objInfo(o.id) || {}).kind;
    if (k !== "decoration" && k !== "deco" && k != null) continue;
    if (o.id === 914) continue;   // text: white by design unless coloured
    deco++;
    const p = o.props || {}, c = CAT[o.id] || {};
    const main = p[21] != null && p[21] !== "" ? +p[21] : c.main;
    if (p[21] == null || p[21] === "") nokey[o.id] = (nokey[o.id] || 0) + 1;
    for (const ch of [main, p[22] != null && p[22] !== "" ? +p[22] : null]) if (ch && ch < 1000 && !isDef(ch, o.x)) { const key = o.id + " ch " + ch; bad[key] = (bad[key] || 0) + 1; }
  }
  const nBad = Object.values(bad).reduce((a, b) => a + b, 0);
  return { deco, undefinedCount: nBad, undefined: bad, nokey, ok: nBad === 0 };
}
module.exports = { check, defined };
if (require.main === module) {
  const args = process.argv.slice(2);
  let list = args.filter(a => !a.startsWith("--"));
  if (args.includes("--all") || !list.length) list = list.concat(fs.readdirSync(path.join(ROOT, "levels")).filter(f => /^gdlm.*\.gdlvl$/.test(f)).map(f => path.join(ROOT, "levels", f)));
  const out = [];
  for (const f of list) {
    let L; try { L = require("./contrast.js").load(f); } catch (e) { console.log(`${f}: ${e.message}`); continue; }
    const r = check(L); out.push(Object.assign({ level: path.basename(f) }, r));
    console.log(`${r.ok ? "ok  " : "FAIL"} ${path.basename(f).padEnd(44)} deco ${String(r.deco).padStart(5)}  white in game: ${r.undefinedCount}${r.undefinedCount ? "  (" + Object.entries(r.undefined).map(([k, v]) => `${k} x${v}`).join(", ") + ")" : ""}`);
  }
  if (args.includes("--json")) console.log(JSON.stringify(out));
  if (out.some(r => !r.ok)) process.exitCode = 1;
}
