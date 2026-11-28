// node tools/secretways.js [key ...] [--cols 60] [--rows R] [--seeds 1,2] [--tiers normal,harder] [--json out.json]
// SECRET WAYS AND SKIPS in the generated section types (Evgeni 2026-11-28: "be careful for secret ways and skipping the
// structures (in wave for example)"). Every presses-first type builds its map around a planned route; this lets the solver
// loose on the finished section (tools/layoutcheck.js check: fewest presses, then the natural route) and compares:
//   presses  the solver's presses / the plan's: far fewer (under 0.6) = a way that leaves out part of the structure
//   off      share of the solver's route points (inside the section) more than 3 rows from the plan's path at that column
//   out      route points outside the map (above its top row or under the ground): flying round the whole structure
// A section is flagged SKIP when out > 0 or off > 0.25. Fewer presses alone is not a skip (first sweep, 2026-11-28, 44
// sections at 60 cols): a held button jumps on every landing as one press (open cube 3 / 6 on the plan's own path), and a
// ship / wave / ufo flies the same corridor with longer holds (fly harder 8 / 23, off 0%): that is the corridor being
// roomier than the plan's rhythm, a difficulty question, so it is printed (LOOSE under 0.6) but not flagged. A different
// but fair route (the other side of a pole) is not a skip by itself either: look at the --show picture (* the solver's
// route, P its presses) before changing the generator. The one real skip found: the spider landing on bare ground in the
// column between two ground spike groups (now a half-buried saw there, tools/sectiongen.js rollers).
// For a whole level (a saved route flown over or under a corridor) see tools/outside.js; this one is per generated section.
"use strict";
if (require.main === module) require("./heavy.js").claim();
const SG = require("./sectiongen.js"), LC = require("./layoutcheck.js");

function judge(z) { const c = LC.check(z); if (!c.ok) return { ok: false, why: c.why, dieCol: c.dieCol };
  const plan = z.path || [], W = z.map[0].length, H = z.map.length, pts = (c.route || []).filter(q => q[0] >= 0 && q[0] <= W);
  const near = col => { let b = null; for (const q of plan) if (!b || Math.abs(q[0] - col) < Math.abs(b[0] - col)) b = q; return b; };
  let off = 0, out = 0; for (const [cc, r] of pts) { if (r > H + 0.5 || r < -0.6) out++; const p = near(cc); if (p && Math.abs(p[0] - cc) < 1 && Math.abs(p[1] - r) > 3) off++; }
  const np = (z.presses || []).length, ratio = np ? c.presses / np : null, offS = pts.length ? off / pts.length : 0;
  const skip = out > 0 || offS > 0.25, loose = np >= 4 && ratio != null && ratio < 0.6;
  return { ok: true, skip, loose, presses: c.presses, plan: np, ratio: ratio != null ? +ratio.toFixed(2) : null, off: +offS.toFixed(2), out, show: c.show }; }

module.exports = { judge };
if (require.main === module) {
  const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf("--" + k); return i >= 0 ? a[i + 1] : d; };
  const pos = []; for (let i = 0; i < a.length; i++) { if (a[i].startsWith("--")) { if (a[i] !== "--show") i++; continue; } pos.push(a[i]); }
  const cols = arg("cols", "60").split(",").map(Number), seeds = arg("seeds", "1,2").split(",").map(Number), tiers = arg("tiers", "normal,harder").split(","), rows = arg("rows") ? +arg("rows") : undefined;
  const keys = pos.length ? pos : SG.KEYS.filter(k => k !== "entrance" && k !== "hanging"), res = [], log = console.log;
  for (const key of keys) for (const tier of tiers) for (const W of cols) for (const seed of seeds) {
    const z = SG.make(key, { cols: W, rows, seed, tier }); if (!z.presses) { log(`${key.padEnd(13)} ${tier.padEnd(6)} ${W} seed ${seed}: shape first, no plan`); continue; }
    console.log = () => {}; let j; try { j = judge(z); } finally { console.log = log; }
    res.push(Object.assign({ key, tier, cols: W, rows: z.map.length, seed }, j, { show: undefined }));
    log(`${key.padEnd(13)} ${tier.padEnd(6)} ${W}x${z.map.length} seed ${seed}: ` + (!j.ok ? `does not solve (${j.why} at ${j.dieCol})` :
      `${j.skip ? "SKIP " : j.loose ? "LOOSE" : "ok   "} solver ${j.presses} / plan ${j.plan} presses, off the plan ${Math.round(j.off * 100)}%, outside ${j.out}`));
    if (j.skip && a.includes("--show")) log(j.show.map(l => "   " + l).join("\n")); }
  const sk = res.filter(r => r.skip).length; log(`${sk} of ${res.length} flagged`);
  if (arg("json")) require("fs").writeFileSync(arg("json"), JSON.stringify(res, null, 1));
}
