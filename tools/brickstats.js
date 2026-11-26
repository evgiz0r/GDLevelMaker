// node tools/brickstats.js [--write] [--json]
//   -- clicks and timing of every lego brick (local/lego/pieces.json, tools/lego.js mine) by its level's difficulty tier:
//      bricks, levels, no-click share, clicks per second p10 / median / p90 (presses / seconds of the brick), the tightest
//      window's median / p10 (tightMs), and the mode mix. Official levels go by their in-game tier, community levels by their
//      rating (local/lego/collect.jsonl, local/community/latest_rated.json, the save's catalogue), ours as "ours".
//   --write: the numbers (no level data) to knowledge/brick_tiers.json, the per-tier targets tools/tempo.js prints.
//   Measured 2026-11-26 on 4298 bricks: median CPS 1.8 (Easy) .. 2.15 (Demon), p90 2.4 .. 3.6; tightest-window p10
//   142 ms (Easy) .. 67 ms (Demon); ours median 1.19. LEGO.md "Clicks and timing by tier".
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), LOCAL = path.join(ROOT, "local");
const OFFICIAL = { 1: "Easy", 2: "Easy", 3: "Normal", 4: "Normal", 5: "Hard", 6: "Hard", 7: "Harder", 8: "Harder", 9: "Harder",
  10: "Insane", 11: "Insane", 12: "Insane", 13: "Insane", 14: "Demon", 15: "Insane", 16: "Insane", 17: "Harder", 18: "Demon",
  19: "Harder", 20: "Demon", 21: "Insane", 22: "Harder" };
const ORDER = ["Auto", "Easy", "Normal", "Hard", "Harder", "Insane", "Demon", "?", "ours"];
const readJ = f => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return null; } };

function communityTiers() {
  const t = {};
  try { for (const l of fs.readFileSync(path.join(LOCAL, "lego", "collect.jsonl"), "utf8").split("\n")) if (l.trim()) { const r = JSON.parse(l); if (r.tier && r.tier !== "?") t[r.id] = r.tier; } } catch (e) {}
  const lr = readJ(path.join(LOCAL, "community", "latest_rated.json")); if (lr && lr.rows) for (const r of lr.rows) t[+r[0]] = r[3];
  const st = readJ(path.join(LOCAL, "difficulty", "user_stats_online.json"));
  if (st && st.levels) for (const l of st.levels) if (!t[l.id]) t[l.id] = String(l.tier).endsWith("Demon") ? "Demon" : l.tier;
  const dl = readJ(path.join(LOCAL, "community", "demonlist.json"));
  const arr = dl ? (Array.isArray(dl) ? dl : dl.levels || Object.values(dl)) : [];
  for (const x of arr) if (x && x.id) t[+x.id] = "Demon";
  return t;
}

function stats() {
  const P = readJ(path.join(LOCAL, "lego", "pieces.json")); if (!P) throw new Error("no local/lego/pieces.json (node tools/lego.js mine)");
  const A = Array.isArray(P) ? P : P.pieces, ct = communityTiers();
  const tierOf = p => p.src === "official" ? OFFICIAL[parseInt(p.level)] : p.src === "community" ? (ct[parseInt(String(p.level).slice(1))] || "?") : p.src === "ours" ? "ours" : null;
  const q = (v, f) => v.length ? v[Math.min(v.length - 1, Math.floor(v.length * f))] : null, r2 = x => x == null ? null : +x.toFixed(2);
  const g = {};
  for (const p of A) {
    const t = tierOf(p); if (!t || !(p.s > 0)) continue;
    const e = g[t] = g[t] || { n: 0, zero: 0, cps: [], tight: [], lv: new Set(), modes: {} };
    e.n++; e.lv.add(p.level);
    if (!p.presses) { e.zero++; continue; }
    e.cps.push(p.presses / p.s); if (p.tightMs) e.tight.push(p.tightMs); e.modes[p.mode] = (e.modes[p.mode] || 0) + 1;
  }
  const out = {};
  for (const k of ORDER) {
    const e = g[k]; if (!e) continue;
    e.cps.sort((a, b) => a - b); e.tight.sort((a, b) => a - b);
    out[k] = { bricks: e.n, levels: e.lv.size, noClick: r2(e.zero / e.n),
      cps: { p10: r2(q(e.cps, 0.1)), median: r2(q(e.cps, 0.5)), p90: r2(q(e.cps, 0.9)) },
      tightMs: { median: q(e.tight, 0.5), p10: q(e.tight, 0.1), under50: e.tight.length ? r2(e.tight.filter(x => x < 50).length / e.tight.length) : null },
      modes: Object.fromEntries(Object.entries(e.modes).sort((a, b) => b[1] - a[1]).map(([m, n]) => [m, r2(n / e.cps.length)])) };
  }
  return { at: new Date().toISOString(), bricks: A.length, tiers: out };
}
module.exports = { stats, OFFICIAL };

if (require.main === module) {
  const A = process.argv.slice(2), s = stats();
  if (A.includes("--json")) console.log(JSON.stringify(s, null, 1));
  else {
    console.log(`${s.bricks} bricks. tier: bricks (levels) no-click | CPS p10 / median / p90 | tightest window median / p10 ms | modes`);
    for (const [k, e] of Object.entries(s.tiers))
      console.log(`${k.padEnd(7)} ${String(e.bricks).padStart(5)} (${e.levels}) ${Math.round(100 * e.noClick)}% | ${e.cps.p10} / ${e.cps.median} / ${e.cps.p90} | ${e.tightMs.median} / ${e.tightMs.p10} | ${Object.entries(e.modes).slice(0, 4).map(([m, f]) => m + " " + Math.round(100 * f) + "%").join(", ")}`);
  }
  if (A.includes("--write")) { fs.writeFileSync(path.join(ROOT, "knowledge", "brick_tiers.json"), JSON.stringify(s, null, 1) + "\n"); console.log("-> knowledge/brick_tiers.json"); }
}
