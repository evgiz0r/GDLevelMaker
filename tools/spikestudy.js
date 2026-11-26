// node tools/spikestudy.js [--era 2.2] [--top 40] [--min-levels 2] [--write] [--json]
//
// How rated levels dress ONE spike or saw (Evgeni, 2026-11-26: "do we have designs of singular spikes? like a spike inside a
// smaller spike? ... more smaller stuff, glow, layers"). For every spike / saw in the community levels (local/community/)
// and the main levels, everything else whose centre sits inside its box -- deco, a second hazard, a no-touch copy -- is a
// "part" of its design, measured in the hazard's own frame (rotation and flips undone, in units of the hazard's size): id,
// offset, scale against the hazard's, z layer / order, colour channels, HSV. A design is the set of parts; the same set in
// several levels is a recurring design. Prints the designs used by the most levels, the parts most used inside a spike, and
// what changes with the era. --write -> knowledge/spike_designs.json (numbers and ids only, no level data).
// Seconds for the ~150 levels (no solve).
const fs = require("fs"), path = require("path");
const { GD, readGdlvl } = require("./io.js");
const ROOT = path.join(__dirname, ".."), LOCAL = path.join(ROOT, "local");
const args = process.argv.slice(2), has = k => args.includes(k), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const readJ = f => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return null; } };

const SPIKES = new Set([8, 39, 103, 392, 9, 61, 243, 244, 363, 364, 365, 366, 367, 368, 446, 447, 667, 989, 991, 720, 421, 422, 768, 1715, 1714, 1716, 1717, 1718, 1719, 1720, 1721, 1722, 1723, 1724, 1725, 1726, 1727, 1728, 1729, 1730, 1731, 1732, 1733]);
function hazKind(o) {
  const inf = GD.objInfo(o.id); if (inf.kind !== "hazard") return null;
  const n = (inf.name || "").toLowerCase();
  if (/saw|blade|gear|wheel|round/.test(n)) return "saw";
  if (/spike|thorn|pit|triangle/.test(n) || SPIKES.has(o.id)) return "spike";
  return "other";
}
const P = (o, k, d) => { const v = (o.props || {})[k]; return v == null || v === "" ? d : +v; };
const scaleOf = o => { const s = P(o, "32", 1); return [P(o, "128", 1) * s, P(o, "129", 1) * s]; };
// a point in the hazard's frame: undo its rotation and flips; in units of its own (scaled) half size
function local(h, d) {
  let dx = d.x - h.x, dy = d.y - h.y; const a = -(h.rot || 0) * Math.PI / 180;
  // GD's rotation is clockwise in degrees; undo it
  const rx = dx * Math.cos(a) + dy * Math.sin(a), ry = -dx * Math.sin(a) + dy * Math.cos(a);
  dx = rx; dy = ry; if (h.flipX) dx = -dx; if (h.flipY) dy = -dy;
  const [sx, sy] = scaleOf(h); return [dx / (15 * sx), dy / (15 * sy)];
}
const q = (v, s) => Math.round(v / s) * s;
// editor-only objects (collision blocks, particle / damage helpers: catalogue group "triggers") are not dressing
const EDITOR = new Set(); try { for (const l of fs.readFileSync(path.join(ROOT, "knowledge", "objects", "catalogue.tsv"), "utf8").split("\n")) { const c = l.split("\t"); if (c[1] === "triggers") EDITOR.add(+c[0]); } } catch (e) {}

function levels() {
  const out = [], list = readJ(path.join(LOCAL, "community", "list.json")) || [];
  const meta = {}; for (const m of list) meta[m.id] = m;
  for (const f of fs.existsSync(path.join(LOCAL, "community")) ? fs.readdirSync(path.join(LOCAL, "community")) : []) {
    if (!f.endsWith(".gdlvl")) continue; const id = f.replace(".gdlvl", "");
    try { const r = readGdlvl(path.join(LOCAL, "community", f)), m = meta[id] || {};
      out.push({ key: "c" + id, name: m.name || r.name, era: m.era || null, tier: m.tier || null, rated: !!m.rating, objects: r.level.objects }); } catch (e) {}
  }
  try { const C = require("./corpus.js"); for (let n = 1; n <= 22; n++) { try { const L = C.official(n);
    out.push({ key: "official:" + n, name: L.short, era: n <= 13 ? "1.x" : n <= 20 ? "2.0-2.1" : "2.2", tier: "official", rated: true, objects: L.objects }); } catch (e) {} } } catch (e) {}
  return out;
}

function study(lv) {
  const objs = lv.objects.filter(o => o && Number.isFinite(o.x));
  const cell = {}; const key = (x, y) => Math.floor(x / 30) + "," + Math.floor(y / 30);
  for (const o of objs) { const k = key(o.x, o.y); (cell[k] = cell[k] || []).push(o); }
  const designs = [];
  for (const h of objs) {
    const kind = hazKind(h); if (kind !== "spike" && kind !== "saw") continue;
    const [sx, sy] = scaleOf(h), R = 15 * Math.max(sx, sy);
    const parts = [];
    for (let cx = Math.floor((h.x - R) / 30); cx <= Math.floor((h.x + R) / 30); cx++)
      for (let cy = Math.floor((h.y - R) / 30); cy <= Math.floor((h.y + R) / 30); cy++)
        for (const d of cell[cx + "," + cy] || []) {
          if (d === h || EDITOR.has(d.id)) continue; const inf = GD.objInfo(d.id); if (inf.kind === "trigger" || inf.kind === "solid") continue;
          const [lx, ly] = local(h, d); if (Math.abs(lx) > 1 || Math.abs(ly) > 1) continue;
          const [dsx, dsy] = scaleOf(d);
          parts.push({ id: d.id, kind: inf.kind, same: d.id === h.id, dx: +lx.toFixed(2), dy: +ly.toFixed(2),
            s: +(Math.max(dsx, dsy) / Math.max(sx, sy)).toFixed(2), rot: ((d.rot || 0) - (h.rot || 0) + 720) % 360,
            z: P(d, "24", 0), zo: P(d, "25", 0), c1: P(d, "21", 0), c2: P(d, "22", 0), hsv: !!((d.props || {})["41"] || (d.props || {})["43"]),
            noTouch: P(d, "121", 0) === 1 });
        }
    const sig = parts.length ? parts.map(p => `${p.kind === "hazard" ? (p.same ? "same" : "haz:" + p.id) : p.id}@${q(p.s, 0.25)}${Math.abs(p.dy) > 0.2 ? (p.dy > 0 ? "^" : "v") : ""}`).sort().join("+") : "";
    designs.push({ kind, id: h.id, z: P(h, "24", 0), c1: P(h, "21", 0), hsv: !!((h.props || {})["41"]), parts, sig });
  }
  return designs;
}

function main() {
  const eraWant = opt("--era", null), top = +opt("--top", 40), minL = +opt("--min-levels", 2);
  const all = levels().filter(l => !eraWant || l.era === eraWant);
  const bySig = {}, partUse = {}, eraStat = {}, perLevel = [];
  for (const lv of all) {
    const ds = study(lv); if (!ds.length) continue;
    const dressed = ds.filter(d => d.parts.length);
    const es = eraStat[lv.era || "?"] = eraStat[lv.era || "?"] || { levels: 0, hazards: 0, dressed: 0, inner: 0, layered: 0, ownCh: 0 };
    es.levels++; es.hazards += ds.length; es.dressed += dressed.length;
    es.inner += ds.filter(d => d.parts.some(p => p.s < 0.85 && Math.abs(p.dx) < 0.35)).length;
    es.layered += ds.filter(d => d.parts.length >= 2).length; es.ownCh += ds.filter(d => d.c1 > 0).length;
    const seenSig = new Set(), seenPart = new Set();
    for (const d of dressed) {
      const k = d.kind + ": " + d.sig;
      const b = bySig[k] = bySig[k] || { kind: d.kind, sig: d.sig, n: 0, levels: 0, ex: null, parts: d.parts };
      b.n++; if (!seenSig.has(k)) { seenSig.add(k); b.levels++; if (!b.ex) b.ex = lv.key + " " + lv.name; }
      for (const p of d.parts) {
        const pk = d.kind + ":" + (p.kind === "hazard" ? (p.same ? "same" : "haz:" + p.id) : p.id);
        const u = partUse[pk] = partUse[pk] || { n: 0, levels: 0, s: [], dy: [], behind: 0, front: 0, ownCh: 0, hsv: 0, noTouch: 0 };
        u.n++; if (!seenPart.has(pk)) { seenPart.add(pk); u.levels++; } u.s.push(p.s); u.dy.push(p.dy);
        if (p.zo < 0 || (p.z && p.z < 0)) u.behind++; else if (p.zo > 0 || p.z > 0) u.front++; if (p.c1 || p.c2) u.ownCh++; if (p.hsv) u.hsv++; if (p.noTouch) u.noTouch++;
      }
    }
    perLevel.push({ key: lv.key, era: lv.era, hazards: ds.length, dressed: +(100 * dressed.length / ds.length).toFixed(0) });
  }
  const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
  const name = id => { const m = /^(\w+):(.*)$/.exec(id); const raw = m ? m[2] : id; if (raw === "same") return "same hazard"; const n = /haz:(\d+)/.exec(raw);
    const i = n ? +n[1] : +raw; return (n ? "hazard " : "") + i + " " + ((GD.objInfo(i) || {}).name || ""); };
  const sigs = Object.values(bySig).filter(b => b.levels >= minL).sort((a, b) => b.levels - a.levels || b.n - a.n).slice(0, top);
  const parts = Object.entries(partUse).filter(([, u]) => u.levels >= minL).sort((a, b) => b[1].levels - a[1].levels).slice(0, top)
    .map(([k, u]) => ({ part: k, name: name(k), levels: u.levels, n: u.n, scale: med(u.s), dy: med(u.dy), behindPct: Math.round(100 * u.behind / u.n), frontPct: Math.round(100 * u.front / u.n), ownChPct: Math.round(100 * u.ownCh / u.n), hsvPct: Math.round(100 * u.hsv / u.n), noTouchPct: Math.round(100 * u.noTouch / u.n) }));
  const era = Object.fromEntries(Object.entries(eraStat).map(([e, s]) => [e, { levels: s.levels, hazards: s.hazards,
    dressedPct: +(100 * s.dressed / s.hazards).toFixed(1), innerPct: +(100 * s.inner / s.hazards).toFixed(1), layeredPct: +(100 * s.layered / s.hazards).toFixed(1), ownChannelPct: +(100 * s.ownCh / s.hazards).toFixed(1) }]));
  const res = { generated: new Date().toISOString().slice(0, 10), levels: all.length, era, parts,
    designs: sigs.map(b => ({ kind: b.kind, design: b.sig, levels: b.levels, n: b.n })) };
  if (has("--json")) { console.log(JSON.stringify(res, null, 1)); return; }
  console.log(`${all.length} levels`); console.table(era);
  console.log("\nparts inside a hazard (by how many levels use them):");
  console.table(parts.map(p => ({ part: p.part, name: p.name.slice(0, 28), levels: p.levels, n: p.n, scale: p.scale, dy: p.dy, behind: p.behindPct, front: p.frontPct, ownCh: p.ownChPct, hsv: p.hsvPct })));
  console.log("\nrecurring designs:");
  for (const b of sigs) console.log(`${String(b.levels).padStart(3)} levels ${String(b.n).padStart(6)}x  ${b.kind}: ${b.sig}   e.g. ${b.ex}`);
  if (has("--write")) { fs.writeFileSync(path.join(ROOT, "knowledge", "spike_designs.json"), JSON.stringify(res, null, 1) + "\n"); console.log("wrote knowledge/spike_designs.json"); }
}
if (require.main === module) main();
module.exports = { study, levels, hazKind };
