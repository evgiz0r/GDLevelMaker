// node tests/edit_replays.js [--dry]
// Today's user marks replayed through tools/markedit.js on the level versions they were made on (from git), and
// checked against what the sessions did by hand: the right family, an edit at the right spot, the marked issue gone,
// still beaten, nothing changed away from the spot. EDITING.md "Results". Without --dry each case is a real edit
// (the saved route is re-planned: seconds to a minute each; the heavy slot).
//   44 hellgate round 2 (54704b4) "indicator inside spike"              -> by hand: marks kept 40 units in front (2424373)
//   50 eclipse v2 (d60d543) "arrow into the spike" / "too close ..."    -> by hand: softrules arrows + placement (701909b)
//   47 sunny side v2 (cae1b05) "not pretty ... symmetry"                -> by hand: orbs centred in the spec
//   45 first flight v6 (cae1b05) the orb over the 2nd of 5 spikes      -> by hand: symmetric orb pit (f31e4fc)
"use strict";
const dry = process.argv.includes("--dry");
if (!dry) require("../tools/heavy.js").claim();
const fs = require("fs"), path = require("path"), cp = require("child_process");
const M = require("../tools/markedit.js");
const ROOT = path.join(__dirname, ".."), DIR = path.join(ROOT, "local", "tmp", "replay");
fs.mkdirSync(DIR, { recursive: true });
const CASES = [
  { lv: "gdlm_44_hellgate", at: "54704b4", spot: "b41", note: "indicator inside spike", family: "jump marks", op: "clearmark", gone: ["arrows", 40.5] },
  { lv: "gdlm_50_eclipse", at: "d60d543", spot: "b24.5", note: "arrow into the spike", family: "jump marks", op: "clearmark", gone: ["arrows", 24] },
  { lv: "gdlm_50_eclipse", at: "d60d543", spot: "b42", note: "too close to the spike, almost inside it", family: "jump marks", op: "clearmark", gone: ["arrows", 41.5] },
  { lv: "gdlm_47_sunny_side", at: "cae1b05", spot: "b750", note: "it's not pretty that the orb is not over the centre of its spikes", family: "symmetry", op: "centre", gone: ["symmetry", 749] },
  { lv: "gdlm_45_first_flight", at: "cae1b05", spot: "b301.5", note: "it's not pretty that the orbs are not symmetrical to their structure", family: "symmetry", op: "centre", gone: ["symmetry", 301] },
];
let bad = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log("FAIL " + m); } };
for (const c of CASES) {
  const f = path.join(DIR, `${c.lv}@${c.at}.gdlvl`);
  if (!fs.existsSync(f)) fs.writeFileSync(f, cp.execFileSync("git", ["show", `${c.at}:levels/${c.lv}.gdlvl`], { windowsHide: true, cwd: ROOT }));
  const t0 = Date.now();
  let r; try { r = M.run({ level: f, at: c.spot, note: c.note, dry, noShots: true, noSweep: true }); } catch (e) { r = { ok: false, error: e.message, families: [] }; }
  const tag = `${c.lv}@${c.at} "${c.note}"`;
  ok(r.families[0] === c.family, `${tag}: family ${c.family} (got ${r.families.join(", ")})`);
  const ops = r.edit && r.edit.ops || [];
  ok(ops.some(o => o.op === c.op), `${tag}: a ${c.op} edit (got ${JSON.stringify(ops)} ${r.error || ""})`);
  if (r.edit && !dry) {
    ok(r.edit.beaten, `${tag}: still beaten (${r.edit.solve})`);
    ok(r.edit.elsewhere === 0, `${tag}: nothing changed away from the spot`);
    ok(r.edit.checks.fixed.some(q => q.rule === c.gone[0] && Math.abs(q.block - c.gone[1]) <= 1), `${tag}: the ${c.gone[0]} issue at ${c.gone[1]} is gone (gone: ${r.edit.checks.fixed.map(q => q.rule + "@" + q.block).join(", ")})`);
    ok(!r.edit.checks.added.length, `${tag}: no new issue (${r.edit.checks.added.map(q => q.rule + " " + q.text).join("; ")})`);
    console.log(`   ${tag}: ${r.edit.changes.map(x => x.what).join("; ")} [${r.edit.solve}, ${((Date.now() - t0) / 1000).toFixed(0)} s]`);
  }
}
console.log(`${n - bad}/${n} ok` + (dry ? " (dry)" : ""));
process.exit(bad ? 1 : 0);
