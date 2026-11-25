// node tools/inputgap.js <official:N | levels/x.gdlvl> [--t <video s>] [--back 3]
// Was an input missed by the logger? A recorded attempt the sim cannot follow (local/attempts/<base>.jsonl) gets ONE
// extra input pair tried at every spot in the last --back seconds before the sim's death: a release + press inside a
// logged hold, or a press + release inside a logged gap (whole frames, gaps 50-400 ms). Prints how far each gets, best
// first. If one pair lets the sim go much further (or clear, as the user did), the log most likely missed it -- a
// chance fit rarely survives the rest of the level. If none helps, the input log is not the cause there: look at the
// physics. (2026-11-24: the 02:33 recording's hook logger is known to drop clicks -- Electroman; PHYSICS.md "Fidelity".)
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs");
const { GD, readGdlvl, unpack } = require("./io.js");
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf("--" + k); return i < 0 ? d : a[i + 1]; };
const lv = a.find((x, i) => !x.startsWith("--") && !(a[i - 1] || "").startsWith("--"));
if (!lv) { console.log(fs.readFileSync(__filename, "utf8").split("\n")[0]); process.exit(1); }
const SRC = require("./gdpaths.js").LEVELS;
const levelStr = lv.startsWith("official:") ? unpack(fs.readFileSync(SRC + lv.slice(9) + ".txt", "utf8")) : readGdlvl(lv).levelStr;
const L = GD.parseLevel(levelStr), w = GD.makeWorld(L.objects, L.header);
const lines = require("./attempts.js").read(lv).filter(o => o.source === "video" && o.events && o.events.length);
const T = opt("t"), o = T ? lines.find(l => l.video && Math.abs(l.video.t - +T) < 1) : lines.find(l => l.agree === false) || lines[0];
if (!o) { console.log("no video attempt for " + lv); process.exit(1); }
const ev = o.events, q0 = GD.run(w, ev), dk = q0.path.length - 1, BACK = Math.round(+opt("back", 3) * 240);
const pct = x => (Math.min(x, w.endX) / w.endX * 100).toFixed(1);
console.log(`${lv} @${o.video.t} s: the user ${o.result}${o.result === "died" ? " " + o.pct + "%" : ""}; the sim with the logged inputs ${q0.dead ? "dies at " + pct(q0.end.x) + "% (" + q0.end.why + ")" : "clears"}`);
const res = [];
for (let i = -1; i < ev.length; i++) {
  const lo = i < 0 ? 0 : ev[i].tick, hi = ev[i + 1] ? ev[i + 1].tick : dk;
  if (hi < dk - BACK || lo > dk) continue;
  const inHold = i >= 0 && ev[i].type === "press";
  for (let t1 = Math.max(lo + 4, dk - BACK); t1 < Math.min(hi, dk) - 4; t1 += 4) for (const g of [12, 24, 36, 48, 72, 96]) {
    const t2 = t1 + g; if (t2 >= hi - 4) continue;
    const ins = inHold ? [{ type: "release", tick: t1 }, { type: "press", tick: t2 }] : [{ type: "press", tick: t1 }, { type: "release", tick: t2 }];
    const q = GD.run(w, ev.slice(0, i + 1).concat(ins, ev.slice(i + 1)));
    res.push({ x: q.dead ? q.end.x : Infinity, why: q.dead ? q.end.why : "", ins: ins.map(e => e.type + " " + (e.tick / 240).toFixed(3)).join(", ") });
  }
}
res.sort((u, v) => v.x - u.x);
const clears = res.filter(r => r.x === Infinity).length, past = res.filter(r => r.x > q0.end.x + 60).length;
console.log(`${res.length} single pairs tried in the last ${(BACK / 240).toFixed(1)} s: ${clears} clear the level, ${past} get 2+ blocks further`);
for (const r of res.slice(0, 8)) console.log(`  ${r.x === Infinity ? "CLEAR" : "dies " + pct(r.x) + "% (" + r.why + ")"}  with ${r.ins}`);
