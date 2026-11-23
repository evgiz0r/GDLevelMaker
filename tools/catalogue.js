// node tools/catalogue.js <step>   -- the deco catalogue: what every GD object id looks like (VISUALS.md,
// knowledge/objects/README.md)
//   index            knowledge/objects/catalogue.tsv: id, group, family, frame, kind, size in blocks,
//                    default layer / channels, looks-like note (committed: facts only, no art)
//   sheets [port]    contact sheets of every id with its picture -> local/catalogue/<group>_NN.png (never
//                    committed: RobTop's art). Starts tools/serve.js on the port (default 8767) unless one
//                    answers there, then headless Edge/Chrome on viewer/catalogue.html?save=1. ~1 GB of
//                    browser memory for ~1 min: one heavy job at a time.
//                    To browse instead: node tools/serve.js, open http://localhost:8765/viewer/catalogue.html
//   usage            what decoration good levels use: per family, how many levels / objects (local/community
//                    rated levels + official + the user's examples), by tier and era; which families appear
//                    together; layers and colour keys -> knowledge/objects/usage.json (numbers only)
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), C = require("../lib/catalogue.js").CATALOGUE, O = require("../lib/objects.js");
const ART = require("../lib/art.js").ART_LIB;
const OUT = path.join(ROOT, "knowledge", "objects");
const GAME = process.env.GD_GAME || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash";
const step = process.argv[2];

function sheetsFrames() {
  const have = {}, R = path.join(GAME, "Resources");
  try { for (const n of ART.SHEETS.concat(ART.ICONS)) Object.assign(have, ART.parsePlist(fs.readFileSync(path.join(R, n + "-uhd.plist"), "utf8"))); } catch (e) {}
  return have;
}
const LAYER = { "-5": "B5", "-3": "B4", "-1": "B3", 1: "B2", 3: "B1", 5: "T1", 7: "T2", 9: "T3", 11: "T4" };

if (step === "index") {
  const have = sheetsFrames();
  if (!Object.keys(have).length) console.log("(game not found: sizes left empty; set GD_GAME)");
  const rows = [["id", "group", "family", "frame", "kind", "w_blocks", "h_blocks", "layer", "ch_main", "ch_detail", "parts", "note"].join("\t")];
  for (const id of C.ids()) {
    const fr = C.frameOf(id), f = have[fr], inf = ART.info(id) || { src: "none", z: "", ch1: "", ch2: -1 }, d = O.objInfo(id);
    const t = ART.tree(id, n => have[n] ? [have[n].sw / 4, have[n].sh / 4] : null);
    rows.push([id, C.group(id), C.family(fr), fr, d.kind, f ? (f.sw / 120).toFixed(2) : "", f ? (f.sh / 120).toFixed(2) : "",
      inf.src === "gd22" ? "?" : LAYER[inf.z] || inf.z, inf.src === "gd22" ? "?" : inf.ch1, inf.src === "gd22" ? "?" : (inf.ch2 > 0 ? inf.ch2 : ""),
      ART.framesOf(t).length, C.note(fr)].join("\t"));
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "catalogue.tsv"), rows.join("\n") + "\n");
  const g = {}; for (const id of C.ids()) g[C.group(id)] = (g[C.group(id)] || 0) + 1;
  console.log("wrote knowledge/objects/catalogue.tsv,", rows.length - 1, "ids", g);
} else if (step === "sheets") {
  const dir = path.join(ROOT, "local", "catalogue"); fs.mkdirSync(dir, { recursive: true });
  require("./headless.js").headless("viewer/catalogue.html?save=1", path.join(dir, ".done"), { port: +(process.argv[3] || 8767) }).then(r => {
    const pngs = fs.readdirSync(dir).filter(f => f.endsWith(".png"));
    console.log(r.ok ? `done: ${pngs.length} sheets in local/catalogue/ (${r.seconds.toFixed(0)} s)` : "timed out; sheets so far: " + pngs.length);
    process.exit(r.ok ? 0 : 1);
  }, e => { console.log(e.message); process.exit(1); });
} else if (step === "usage") {
  const { readGdlvl } = require("./io.js");
  const levels = [];
  const DIRC = path.join(ROOT, "local", "community");
  let list = []; try { list = JSON.parse(fs.readFileSync(path.join(DIRC, "list.json"), "utf8")); } catch (e) {}
  const meta = {}; for (const l of list) meta[l.id] = l;
  for (const f of fs.existsSync(DIRC) ? fs.readdirSync(DIRC).filter(f => f.endsWith(".gdlvl")) : []) {
    try { const L = readGdlvl(path.join(DIRC, f)), id = f.replace(".gdlvl", ""); levels.push({ src: "community", id, tier: (meta[id] || {}).tier || "?", era: (meta[id] || {}).era || "?", objects: L.level.objects }); } catch (e) {}
  }
  for (const f of fs.readdirSync(path.join(ROOT, "local")).filter(f => /^official_\d+\.json$/.test(f))) {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, "local", f), "utf8"));
    levels.push({ src: "official", id: j.name, tier: "official", era: "official", objects: require("../lib/gd.js").parseLevel(j.level).objects });
  }
  const isDeco = id => { const g = C.group(id); return g.startsWith("deco") || g === "pixel" || g === "effects"; };
  const fam = {}, pairs = {}, perLevel = [], layers = {}, keys = { colour21: 0, colour22: 0, layer24: 0, order25: 0, scale32: 0, group57: 0, total: 0 };
  for (const L of levels) {
    const here = {}; let deco = 0, all = 0, maxX = 0;
    for (const o of L.objects) {
      all++; maxX = Math.max(maxX, o.x || 0);
      if (!C.frameOf(o.id) || !isDeco(o.id)) continue;
      deco++; keys.total++;
      const p = o.props || {};
      if (p[21]) keys.colour21++; if (p[22]) keys.colour22++; if (p[24]) { keys.layer24++; layers[LAYER[p[24]] || p[24]] = (layers[LAYER[p[24]] || p[24]] || 0) + 1; }
      if (p[25]) keys.order25++; if (p[32] && p[32] !== "1") keys.scale32++; if (p[57]) keys.group57++;
      const k = C.group(o.id) + ":" + C.family(C.frameOf(o.id));
      here[k] = (here[k] || 0) + 1;
    }
    for (const k in here) {
      const e = fam[k] = fam[k] || { levels: 0, objects: 0, tiers: {}, eras: {} };
      e.levels++; e.objects += here[k]; e.tiers[L.tier] = (e.tiers[L.tier] || 0) + 1; e.eras[L.era] = (e.eras[L.era] || 0) + 1;
    }
    const ks = Object.keys(here).filter(k => here[k] >= 3).sort();
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) { const pk = ks[i] + " + " + ks[j]; pairs[pk] = (pairs[pk] || 0) + 1; }
    perLevel.push({ src: L.src, id: L.id, tier: L.tier, era: L.era, objects: all, deco, decoShare: +(deco / Math.max(1, all)).toFixed(3), decoPerBlock: +(deco / Math.max(1, maxX / 30)).toFixed(2), families: Object.keys(here).length });
  }
  const top = Object.entries(fam).sort((a, b) => b[1].levels - a[1].levels || b[1].objects - a[1].objects);
  const res = { levels: levels.length, bySource: levels.reduce((m, l) => (m[l.src] = (m[l.src] || 0) + 1, m), {}), families: Object.fromEntries(top),
    pairs: Object.fromEntries(Object.entries(pairs).sort((a, b) => b[1] - a[1]).slice(0, 60)), keys, layers, perLevel };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "usage.json"), JSON.stringify(res, null, 1) + "\n");
  console.log("levels", res.levels, res.bySource);
  console.log("top families (levels using, objects):");
  for (const [k, v] of top.slice(0, 40)) console.log("  " + k.padEnd(38) + String(v.levels).padStart(4) + String(v.objects).padStart(8));
  console.log("pairs:", Object.entries(res.pairs).slice(0, 15).map(e => e.join(" ")).join("\n  "));
  console.log("keys on deco objects:", keys, "layers:", layers);
} else {
  console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n"));
}
