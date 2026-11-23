// node tools/craft.js roles <level> [--per 30] [--json]      every object's role, per screen
// node tools/craft.js check <level> [--look=1.x|2.2]          the craft numbers vs the targets for its look
//
// How a level USES its objects (CRAFT.md). Object count is not what separates our levels from RobTop's
// (Jumper 3.2 objects/block, ours 5-9): the difference is where the objects go. Every object gets one role:
//   solid      gameplay block / slab / slope (has a hitbox, you stand on it)
//   hazard     kills (spikes, pits, saws)
//   play       orbs, pads, portals, coins
//   trigger    colour / move / alpha / enter-effect triggers
//   fill       decoration inside a structure (a deco block between solids: the body of a pillar)
//   top        decoration standing on a solid's top (rods, crystals on a ledge)
//   hang       decoration hanging under a solid (chains under a ceiling or a floating block)
//   side       decoration against a solid's side
//   ground     decoration on the bare floor (row 0) away from any structure
//   near       decoration within 2 blocks of a structure or hazard, not touching it
//   back       decoration far from everything (clouds, balls, background pieces)
// "structural deco" = fill + top + hang + side: deco that belongs to a structure.
// Also: block skins -- the share of solid cells whose outlined sides are exactly its open sides (skins
// 1-7, lib/look.js), and hazards by where they sit (floor / on a block / under a block / side / free).
//   <level>  a .gdlvl, local/official_NN.json or official:N (RobTop's data: output stays on screen)
// Library: roles(objects) -> { counts, perScreen, hazards, skins } for score.js / make.js.
const fs = require("fs"), path = require("path");
const { GD, readGdlvl } = require("./io.js");
const ROOT = path.join(__dirname, "..");

const PLAY = new Set(["orb", "pad", "gravity", "mode", "speed", "size", "special", "teleport", "unsupported"]);
const SKIN_EDGES = { 1: "URDL", 2: "U", 3: "UL", 4: "", 5: "", 6: "URL", 7: "RL" };
const CW = { U: "R", R: "D", D: "L", L: "U" };
function skinEdges(o) {
  let e = (SKIN_EDGES[o.id] || "").split("");
  if (o.flipX) e = e.map(s => ({ L: "R", R: "L" })[s] || s);
  if (o.flipY) e = e.map(s => ({ U: "D", D: "U" })[s] || s);
  let r = Math.round(((o.rot || 0) % 360 + 360) % 360 / 90) % 4;
  while (r-- > 0) e = e.map(s => CW[s]);
  return e.sort().join("");
}
const cellOf = o => [Math.floor(o.x / 30), Math.floor(o.y / 30)];
const key = (c, r) => c + "," + r;

function kindOf(o) {
  const k = GD.objInfo(o.id).kind;
  if (k === "slope") return "solid";
  if (PLAY.has(k)) return "play";
  return k; // solid, hazard, trigger, decoration
}

// the signature (tools/signature.js: channels 988-999) is ours by design, not level deco: left out
const isSignature = o => { const ch = +((o.props || {})[21] || 0); return ch >= 988 && ch <= 999; };
// rods (15-17) and chains (41) that hang on something: within 12 units across and 80 along of a solid,
// hazard, orb or pad -- or of another chain that does (a chain stack up to the ceiling)
function hangers(objects) {
  const things = objects.filter(o => { const k = kindOf(o); return k === "solid" || k === "hazard" || k === "play" || (o.id >= 1 && o.id <= 7); });
  const hs = objects.filter(o => [15, 16, 17, 41].includes(o.id)), ok = new Set();
  const touch = (a, b) => Math.abs(a.x - b.x) < 12 && Math.abs(a.y - b.y) < 80;
  for (const h of hs) if (things.some(t => touch(h, t))) ok.add(h);
  for (let grew = true; grew;) { grew = false; for (const h of hs) if (!ok.has(h) && h.id === 41 && [...ok].some(g => g.id === 41 && touch(h, g))) { ok.add(h); grew = true; } }
  ok.total = hs.length; return ok;
}
function roles(objects) {
  const solid = new Set(), hazard = new Set(), structure = new Set();
  for (const o of objects) {
    const k = kindOf(o), [c, r] = cellOf(o);
    if (k === "solid") { solid.add(key(c, r)); structure.add(key(c, r)); }
    if (k === "hazard") hazard.add(key(c, r));
  }
  // deco blocks in skins 1-7's family (5 = the plain fill) count as structure cells too: a pillar's body
  for (const o of objects) if (kindOf(o) === "decoration" && o.id >= 1 && o.id <= 7) structure.add(key(...cellOf(o)));
  const near = (c, r, d) => { for (let i = -d; i <= d; i++) for (let j = -d; j <= d; j++) if (structure.has(key(c + i, r + j)) || hazard.has(key(c + i, r + j))) return true; return false; };
  const counts = {}, per = {}, hz = {}, out = [];
  let maxc = 0;
  const attachedHang = hangers(objects);
  for (const o of objects) {
    const k = kindOf(o), [c, r] = cellOf(o); let role;
    if (isSignature(o)) role = "signature";
    else if (k !== "decoration") role = k === "trigger" ? "trigger" : k;
    else if (attachedHang.has(o)) role = "hang";
    else if (structure.has(key(c, r)) && (o.id <= 7 || solid.has(key(c, r)))) role = "fill";
    else if (structure.has(key(c, r - 1))) role = "top";
    else if (structure.has(key(c, r + 1))) role = "hang";
    else if (structure.has(key(c - 1, r)) || structure.has(key(c + 1, r))) role = "side";
    else if (r <= 0 && !near(c, r, 2)) role = "ground";
    else if (near(c, r, 2)) role = "near";
    else role = "back";
    if (k === "hazard") {
      const where = r <= 0 && !structure.has(key(c, r - 1)) ? "floor" : structure.has(key(c, r - 1)) ? "on block" : structure.has(key(c, r + 1)) ? "under block"
        : (structure.has(key(c - 1, r)) || structure.has(key(c + 1, r))) ? "side" : "free";
      hz[where] = (hz[where] || 0) + 1;
    }
    counts[role] = (counts[role] || 0) + 1;
    const s = Math.floor(c / 30); maxc = Math.max(maxc, s);
    (per[s] = per[s] || {})[role] = (per[s][role] || 0) + 1;
    out.push(role);
  }
  // skins: solid cells (skins 1-7 as solids or deco) whose outline is exactly their open sides
  let skinOk = 0, skinN = 0;
  for (const o of objects) {
    if (!(o.id >= 1 && o.id <= 7)) continue;
    const [c, r] = cellOf(o);
    const open = ((structure.has(key(c, r - 1)) || r <= 0) ? "" : "D") + (structure.has(key(c - 1, r)) ? "" : "L") + (structure.has(key(c + 1, r)) ? "" : "R") + (structure.has(key(c, r + 1)) ? "" : "U");
    skinN++; if (skinEdges(o) === open.split("").sort().join("")) skinOk++;
  }
  counts.signature = counts.signature || 0;
  const deco = ["fill", "top", "hang", "side", "ground", "near", "back"].reduce((a, k) => a + (counts[k] || 0), 0);
  const structural = ["fill", "top", "hang", "side"].reduce((a, k) => a + (counts[k] || 0), 0);
  return { counts, perScreen: per, hazards: hz, skins: { n: skinN, exact: skinN ? skinOk / skinN : NaN }, deco, structural, roles: out, screens: maxc + 1 };
}

// The craft numbers (CRAFT.md "Numbers"): how a level builds its structures and dresses them.
//   pieces100    structure pieces (4-connected groups of solid cells) per 100 blocks of length
//   pieceCells   median cells per piece (small, many pieces: Jumper 3, xStep 3; a long mass is 30+)
//   floorHaz     share of the level's columns with a hazard on the floor (row 0 / -1)
//   underArmed   share of exposed undersides above air (a ceiling, a hanging column, a floating block)
//                with a hazard or a hanger under it
//   topsDressed  share of exposed tops with a spike, a rod or other deco, or an orb/pad on them
//   attached     share of rods (15-17) and chains (41) that touch a structure or an orb/pad
//   pillarDelta  share of neighbouring ground pillars (<= 2 wide, <= 8 apart) whose heights differ
//   backDeco     share of decoration that belongs to no structure ("back" + "ground" roles)
function numbers(objects) {
  const R = roles(objects);
  const S = new Set(), H = new Set(), P = new Set(), D = new Set();
  let maxc = 0;
  objects.forEach((o, i) => {
    const [c, r] = cellOf(o), k = key(c, r), role = R.roles[i]; maxc = Math.max(maxc, c);
    if (role === "solid" || (role === "fill" && o.id <= 7)) S.add(k); else if (role === "hazard") H.add(k);
    else if (role === "play") P.add(k); else if (role !== "trigger" && role !== "signature") D.add(k);
  });
  const blocks = Math.max(1, maxc);
  // pieces
  const seen = new Set(), comps = [];
  for (const k of S) {
    if (seen.has(k)) continue; const st = [k], cs = []; seen.add(k);
    while (st.length) { const q = st.pop(); cs.push(q); const [c, r] = q.split(",").map(Number);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = key(c + dc, r + dr); if (S.has(n) && !seen.has(n)) { seen.add(n); st.push(n); } } }
    const xs = cs.map(q => +q.split(",")[0]), ys = cs.map(q => +q.split(",")[1]);
    comps.push({ n: cs.length, x0: Math.min(...xs), w: Math.max(...xs) - Math.min(...xs) + 1, y0: Math.min(...ys), h: Math.max(...ys) - Math.min(...ys) + 1 });
  }
  const med = a => { if (!a.length) return NaN; a = [...a].sort((x, y) => x - y); return a[a.length >> 1]; };
  let tops = 0, topsD = 0, unders = 0, undersA = 0;
  const hangAt = (c, r) => { for (let d = 1; d <= 3; d++) if (D.has(key(c, r - d)) || P.has(key(c, r - d))) return true; return false; };
  for (const k of S) {
    const [c, r] = k.split(",").map(Number);
    if (!S.has(key(c, r + 1))) { tops++; const a = key(c, r + 1); if (H.has(a) || P.has(a) || D.has(a) || D.has(key(c, r + 2))) topsD++; }
    if (r > 0 && !S.has(key(c, r - 1)) && r >= 2) { unders++; if (H.has(key(c, r - 1)) || hangAt(c, r)) undersA++; }
  }
  let floor = 0; for (let c = 0; c <= maxc; c++) if (H.has(key(c, 0)) || H.has(key(c, -1))) floor++;
  // rods and chains: touching a structure / play object (within 2.5 blocks along their axis)
  const H2 = hangers(objects), hang = H2.total, hangOk = H2.size;
  const gp = comps.filter(c => c.y0 <= 0 && c.w <= 2).sort((a, b) => a.x0 - b.x0);
  let pn = 0, pd = 0;
  for (let i = 1; i < gp.length; i++) { if (gp[i].x0 - (gp[i - 1].x0 + gp[i - 1].w) > 8) continue; pn++; if (gp[i].h !== gp[i - 1].h) pd++; }
  return {
    pieces100: 100 * comps.length / blocks, pieceCells: med(comps.map(c => c.n)), floorHaz: floor / (maxc + 1),
    underArmed: unders ? undersA / unders : NaN, topsDressed: tops ? topsD / tops : NaN, attached: hang ? hangOk / hang : NaN,
    pillarDelta: pn ? pd / pn : NaN, backDeco: R.deco ? ((R.counts.back || 0) + (R.counts.ground || 0)) / R.deco : 0,
    hazards100: 100 * ((R.counts.hazard) || 0) / blocks, structuralDeco: R.deco ? R.structural / R.deco : 0, blocks,
  };
}
// Targets: the low end of the 10 official 1.x levels (Stereo Madness .. xStep), measured 2026-11-23
// (CRAFT.md "Numbers"); "min" = a level below it gets a warning. Soft: a level may miss one with a reason.
const TARGETS = {
  pieces100: { min: 12, doc: "structure pieces per 100 blocks (official 15-24)" },
  floorHaz: { min: 0.35, doc: "floor columns with a hazard (official 39-69%)" },
  underArmed: { min: 0.35, doc: "exposed undersides with a spike or a hanger (official ~50%)" },
  topsDressed: { min: 0.12, doc: "exposed tops with a spike, rod or deco (official 18-34%)" },
  attached: { min: 0.9, doc: "rods and chains attached to something (official ~100%)" },
  pillarDelta: { min: 0.7, doc: "neighbouring ground pillars of different heights (official 75-90%)" },
  backDeco: { max: 0.2, doc: "decoration that belongs to no structure (official 0-1%; the user: \"way too flashy\")" },
  hazards100: { min: 45, max: 110, doc: "hazards per 100 blocks (official 62-191; featured Easy/Normal ~75-81, spike spam marks the plain level: TASTE_DATA.md)" },
};
// The floor share and the loose-deco limit are RobTop-1.x-look targets (the taste session, 308 community
// levels, TASTE_DATA.md "Per band"): featured Easy/Normal levels have 16-21% hazard floors and 2.0-2.2 ones
// 30-52% loose deco (more on epic than featured). A 2.2-look level keeps a lighter floor target and leaves
// loose deco to tools/readability.js (contrast and clutter: what the user objected to on hellgate).
const LOOK = { "1.x": {}, "2.2": { floorHaz: { min: 0.15, doc: "floor columns with a hazard (featured Easy/Normal 16-21%)" }, backDeco: null } };
// a level's look: 2.2 when a third of its decoration is 2.0+ objects (ids >= 1000) -- scene levels, the modern pass
function lookOf(objects) {
  const deco = objects.filter(o => kindOf(o) === "decoration" && !isSignature(o));
  return deco.length && deco.filter(o => o.id >= 1000).length / deco.length > 0.33 ? "2.2" : "1.x";
}
function check(objects, look) {
  look = look || lookOf(objects);
  const N = numbers(objects), out = [], T = Object.assign({}, TARGETS, LOOK[look] || {});
  for (const [k, t] of Object.entries(T)) {
    const v = N[k]; if (!t || !Number.isFinite(v)) continue;
    const bad = (t.min != null && v < t.min) || (t.max != null && v > t.max);
    out.push({ key: k, value: v, ok: !bad, doc: t.doc, target: [t.min != null ? ">= " + t.min : "", t.max != null ? "<= " + t.max : ""].filter(Boolean).join(", ") });
  }
  return { look, numbers: N, checks: out, warn: out.filter(c => !c.ok) };
}

function load(spec) {
  const m = /^official:(\d+)$/.exec(spec);
  if (m) spec = path.join(ROOT, "local", "official_" + String(m[1]).padStart(2, "0") + ".json");
  if (spec.endsWith(".json")) { const j = JSON.parse(fs.readFileSync(spec, "utf8")); return { name: j.name || path.basename(spec), level: GD.parseLevel(j.level) }; }
  const r = readGdlvl(spec); return { name: r.name, level: r.level };
}

if (require.main === module) {
  const [cmd, spec, ...rest] = process.argv.slice(2);
  if (!cmd || !spec) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  const { name, level } = load(spec), R = roles(level.objects);
  if (rest.includes("--json")) { delete R.roles; console.log(JSON.stringify(R)); process.exit(0); }
  const N = level.objects.length, pc = x => Math.round(100 * x) + "%";
  console.log(`${name}: ${N} objects, ${R.screens} screens of 30 blocks`);
  console.log("roles: " + Object.entries(R.counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", "));
  console.log(`deco ${R.deco}: structural ${pc(R.structural / Math.max(1, R.deco))} (fill/top/hang/side), ground ${pc((R.counts.ground || 0) / Math.max(1, R.deco))}, near ${pc((R.counts.near || 0) / Math.max(1, R.deco))}, back ${pc((R.counts.back || 0) / Math.max(1, R.deco))}`);
  console.log(`skins: ${R.skins.n} skin blocks, ${pc(R.skins.exact)} outlined exactly on their open sides`);
  console.log("hazards: " + Object.entries(R.hazards).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", "));
  if (cmd === "map") {
    // text picture with deco: # solid, = deco fill, ^ hazard (v under a block), o orb/pad/portal,
    // t on top, h hanging, s side, . near, , back; --from/--to columns, --rows N
    const gi = (f, d) => { const i = rest.indexOf(f); return i >= 0 ? +rest[i + 1] : d; };
    const from = gi("--from", 0), to = gi("--to", from + 120), rows = gi("--rows", 12), row0 = gi("--row0", -1);
    const G = {}, pri = { "#": 9, "=": 5, "^": 8, v: 8, o: 9, t: 4, h: 4, s: 4, ".": 2, ",": 1 };
    level.objects.forEach((o, i) => {
      const role = R.roles[i], [c, r] = cellOf(o); if (c < from || c >= to || role === "trigger") return;
      let ch = { solid: "#", fill: "=", play: "o", top: "t", hang: "h", side: "s", near: ".", back: ",", ground: "." }[role];
      if (role === "hazard") ch = GD.objInfo(o.id).kind === "hazard" && (o.flipY || Math.abs((o.rot || 0) % 360) === 180) ? "v" : "^";
      const k = key(c, r); if (!G[k] || pri[ch] > pri[G[k]]) G[k] = ch;
    });
    for (let r = row0 + rows - 1; r >= row0; r--) { let s = ""; for (let c = from; c < to; c++) s += G[key(c, r)] || " "; console.log(String(r).padStart(3) + " " + s); }
    let ruler = ""; for (let c = from; c < to; c++) ruler += c % 10 === 0 ? "|" : " "; console.log("    " + ruler + "  (| every 10 from " + from + ")");
    process.exit(0);
  }
  if (cmd === "check") {
    const C = check(level.objects, (rest.find(a => a.startsWith("--look=")) || "").slice(7) || null);
    console.log(`look: ${C.look} (targets for it; --look=1.x | --look=2.2)`);
    for (const c of C.checks) console.log(`${c.ok ? "ok  " : "WARN"} ${c.key.padEnd(12)} ${(c.value < 2 && c.key !== "pieces100" ? Math.round(100 * c.value) + "%" : c.value.toFixed(1)).padStart(6)}  (${c.target}) ${c.doc}`);
    console.log(`     hazards/100 blocks ${C.numbers.hazards100.toFixed(0)}, piece median ${C.numbers.pieceCells} cells`);
  }
  if (cmd === "roles") {
    const cols = ["solid", "hazard", "play", "fill", "top", "hang", "side", "ground", "near", "back", "trigger"];
    console.log("screen " + cols.map(c => c.padStart(6)).join(""));
    for (let s = 0; s < R.screens; s++) console.log(String(s).padStart(6) + " " + cols.map(c => String((R.perScreen[s] || {})[c] || 0).padStart(6)).join(""));
  }
}
module.exports = { roles, numbers, check, lookOf, TARGETS, LOOK, load, skinEdges };
