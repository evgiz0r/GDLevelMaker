// node tools/lego.js page [--public] [--out dir]   (this file builds it; LEGO.md)
// A browsable page of the lego catalogue: the family mix (official vs ours) and a thumbnail per piece, filterable by
// source, family, mode, wrapper and text. Writes <dir>/index.html + <dir>/pieces.json.
// Default dir: local/lego/page (everything, official layouts included: RobTop's, so it stays on the PC).
// --public: our levels, the sketches and the official NUMBERS only (no official layouts), for the phone Artifact.
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");

// the build stamp: a hash of the code that makes the page, written into it; tools/serve.js rebuilds when it differs
// (an mtime check let a build started by older code overwrite the page after newer code had arrived, 2026-11-25)
function stamp() {
  const h = require("crypto").createHash("sha1");
  for (const f of ["lego.js", "lego_page.js", "lego_page.html", "../lib/look.js"]) h.update(fs.readFileSync(path.join(__dirname, f)));
  return h.digest("hex").slice(0, 12);
}
function build(all, o = {}) {
  // --private: everything (main-level bricks included) for Evgeni's PRIVATE claude.ai catalogue page (his choice,
  // 2026-11-25: "Yes, private page only"); votes go to the page's database like the public copy. Never published elsewhere.
  const dir = o.out || path.join(ROOT, "local", "lego", o.priv ? "page_private" : o.pub ? "page_public" : "page");
  fs.mkdirSync(dir, { recursive: true });
  // the mix: family / mode / wrap shares per source (numbers only, safe to publish)
  const mix = {}, tot = { official: 0, ours: 0, sketch: 0, library: 0 };
  for (const p of all) { if (p.grain === "brick") continue; const k = p.family + " · " + p.mode + " · " + p.wrap + (p.spiky ? " +spikes" : "") + (p.gates ? " +gates" : ""); const m = mix[k] = mix[k] || { k, official: 0, ours: 0, sketch: 0, library: 0 }; m[p.src]++; tot[p.src]++; }
  const rows = Object.values(mix).sort((a, b) => (b.official / tot.official + b.ours / tot.ours) - (a.official / tot.official + a.ours / tot.ours)).slice(0, 26);
  const pieces = all.filter(p => !o.pub || p.src !== "official").map(p => ({
    id: p.id, grain: p.grain || "piece", auto: !!p.auto, src: p.src, level: p.level, mode: p.mode, family: p.family, wrap: p.wrap, sig: p.sig, x: p.x, w: p.w, s: p.s,
    presses: p.presses, hold: p.hold, gap: p.gap, yRange: p.yRange, hz: p.hzPer100, flips: p.flips, gates: p.gates || 0, spiky: !!p.spiky,
    turns: p.turns, pathKind: p.pathKind, mech: Object.keys(p.mech || {}), midline: p.midline, verified: !!p.verified, why: p.why || "",
    shape: (p.shape || []).slice(0, 500), path: p.path || [], clicks: p.clicks || [], diff: p.diff == null ? null : p.diff, tightMs: p.tightMs == null ? null : p.tightMs, tight: p.tight || 0, speed: p.speed,
    colors: p.colors || null, cuts: p.cuts || [], empty: !!p.empty, smooth: p.smooth !== false, steps: p.steps || 0, dupOf: p.dupOf || "", copies: p.copies || 1, alsoIn: (p.alsoIn || []).slice(0, 12),
    // solid floor / roof right under / over the route per column, drawn as filled walls (the sim culls inner blocks);
    // spikes are not walls, and a slope column's wall stops under the ramp (the ramp itself is drawn as a triangle)
    walls: (p.cols || []).map(c => [c.fk === "S" ? Math.max(0, c.f - (c.fs ? 1 : 0)) : 0, c.rk === "S" ? c.r + (c.rs ? 1 : 0) : null]) }));
  fs.writeFileSync(path.join(dir, "pieces.json"), "[\n" + pieces.map(p => JSON.stringify(p)).join(",\n") + "\n]\n");
  const html = fs.readFileSync(path.join(__dirname, "lego_page.html"), "utf8")
    .replace("<script>/*LOOK*/</script>", () => "<script>" + fs.readFileSync(path.join(ROOT, "lib", "look.js"), "utf8").replace(/<\/script/gi, "<\\/script") + "</script>")
    .replace("/*MIX*/null", JSON.stringify({ rows, tot }))
    .replace("/*PUB*/false", o.pub || o.priv ? "true" : "false").replace("/*PRIV*/false", o.priv ? "true" : "false") + `\n<!--lego-build:${stamp()}-->\n`;
  fs.writeFileSync(path.join(dir, "index.html"), html);
  console.log(`${pieces.length} pieces -> ${path.relative(ROOT, dir)}/index.html${o.pub ? " (public: no official layouts)" : " (local only: official layouts inside)"}`);
  return dir;
}
module.exports = { build, stamp };
