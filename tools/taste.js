// node tools/taste.js <step> [options]     -- learn taste from real levels (TASTE_DATA.md)
//
//   corpus [--per small|full]   list levels with their quality signals from GDBrowser's search: per tier
//                               Easy..Insane featured / epic / legendary / mythic, star-rated but not
//                               featured, unrated (popular and poorly liked), lengths Medium..XL, no
//                               platformers. Merges local/community/list.json and fills likes/downloads for
//                               every listed id -> local/taste/corpus.json (no level data: metadata only)
//   fetch                       download the listed levels that are not in local/community/ yet
//                               (tools/fetch_level.js, one every 2 s)
//   measure [--fresh] [--only id]  static measures of every downloaded level + the 22 official levels
//                               -> local/taste/feat/<id>.json (one child process per level, cached)
//   learn                       per-feature effect within (tier band x era), held-out model, rule verdicts
//                               -> local/taste/report.md, knowledge/taste_model.json (aggregates only)
//   score <level.gdlvl|official:N> [--json]  the taste score of one level (0-100) and what drives it
//   one <file> [--id x]         (internal) the measures of one level as JSON
//
// No solving: every measure is static (the objects as placed), so it runs on hundreds of levels in
// minutes. Route measures (windows, fairness, flow on the played route) need a solve per level: open.
// Everything downloaded stays in local/ (git-ignored, never committed or published); only aggregate
// numbers (medians, weights, verdicts) go to the repo. One heavy job at a time (tools/heavy.js).
const fs = require("fs"), path = require("path"), https = require("https"), cp = require("child_process");
const ROOT = path.join(__dirname, "..");
const LOCAL = (() => { try { return fs.realpathSync(path.join(ROOT, "local")); } catch (e) { return path.join(ROOT, "local"); } })();
const DIR = path.join(LOCAL, "taste"), FEAT = path.join(DIR, "feat"), COMM = path.join(LOCAL, "community");
const CORPUS = path.join(DIR, "corpus.json"), MODEL = path.join(ROOT, "knowledge", "taste_model.json");
const VERSION = 4;   // bump when a measure changes: cached rows of an older version are re-measured

const args = process.argv.slice(2), opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = u => new Promise(res => https.get(u, { headers: { "User-Agent": "GDLevelMaker-research" }, timeout: 30000 }, r => {
  let d = ""; r.on("data", c => d += c); r.on("end", () => { try { res(JSON.parse(d)); } catch (e) { res(null); } });
}).on("error", () => res(null)));
const TIER = { 1: "Easy", 2: "Normal", 3: "Hard", 4: "Harder", 5: "Insane" };
const eraOf = v => /^1\.|^pre/i.test(v || "") ? "1.x" : /^2\.[01]/.test(v || "") ? "2.0-2.1" : "2.2";
// quality label: 0 unrated, 1 rated, 2 featured, 3 epic, 4 legendary, 5 mythic
const rankOf = l => l.mythic ? 5 : l.legendary ? 4 : l.epic ? 3 : l.featured ? 2 : (l.stars > 0 ? 1 : 0);
const RANK = ["unrated", "rated", "featured", "epic", "legendary", "mythic"];

// ---------------- corpus ----------------
function row(l, pick) {
  return { id: String(l.id), name: (l.name || "").trim(), author: l.author, tier: l.difficulty, stars: +l.stars || 0,
    featured: !!l.featured, epic: !!l.epic, legendary: !!l.legendary, mythic: !!l.mythic, rank: rankOf(l),
    likes: +l.likes || 0, downloads: +l.downloads || 0, disliked: !!l.disliked, ver: l.gameVersion, era: eraOf(l.gameVersion),
    length: l.length, objects: +l.objects || 0, coins: +l.coins || 0, song: `${l.songName} / ${l.songAuthor}`, pick };
}
async function corpus() {
  fs.mkdirSync(DIR, { recursive: true });
  const old = fs.existsSync(CORPUS) ? JSON.parse(fs.readFileSync(CORPUS, "utf8")) : [];
  const out = new Map(old.map(l => [l.id, l]));
  const full = opt("--per") !== "small";
  // [filter, sort, count, page, keep(level) ] per tier
  const plan = [
    ["featured", "mostliked", full ? 8 : 3, 0, l => !l.epic], ["featured", "mostdownloaded", full ? 6 : 2, 4, l => !l.epic],
    ["epic", "mostliked", full ? 6 : 2, 0], ["legendary", "mostliked", 4, 0], ["mythic", "mostliked", 3, 0],
    ["starred", "mostdownloaded", full ? 20 : 6, 1, l => !l.featured], ["starred", "awarded", full ? 10 : 4, 0],
    ["noStar", "mostdownloaded", full ? 8 : 3, 0], ["noStar", "mostliked", full ? 5 : 2, 2], ["noStar", "magic", full ? 12 : 4, 0],
  ];
  for (const d of [1, 2, 3, 4, 5]) for (const [filter, type, count, page, keep] of plan) {
    const L = await getJSON(`https://gdbrowser.com/api/search/*?diff=${d}&type=${type}&${filter}&len=2,3,4&count=${Math.min(count * 2, 40)}&page=${page}`);
    let n = 0;
    for (const l of Array.isArray(L) ? L : []) {
      if (n >= count) break;
      if (l.platformer || out.has(String(l.id)) || (keep && !keep(l))) continue;
      out.set(String(l.id), row(l, `${filter}/${type}`)); n++;
    }
    console.log(TIER[d], filter, type, n);
    await sleep(1500);
  }
  // the community study's list (tools/community.js) and any downloaded level without metadata
  const known = fs.existsSync(path.join(COMM, "list.json")) ? JSON.parse(fs.readFileSync(path.join(COMM, "list.json"), "utf8")) : [];
  const ids = new Set([...known.map(l => String(l.id)), ...fs.readdirSync(COMM).filter(f => f.endsWith(".gdlvl")).map(f => f.replace(".gdlvl", ""))]);
  for (const id of ids) {
    if (out.has(id) && out.get(id).downloads) continue;
    const l = await getJSON(`https://gdbrowser.com/api/level/${id}`);
    if (l && l.id) out.set(id, row(l, (out.get(id) || {}).pick || "community.js")); else console.log("no metadata for", id);
    await sleep(1200);
  }
  const all = [...out.values()];
  fs.writeFileSync(CORPUS, JSON.stringify(all, null, 1));
  const c = {}; for (const l of all) { const k = `${l.tier} ${RANK[l.rank]}`; c[k] = (c[k] || 0) + 1; }
  console.log(all.length, "levels ->", CORPUS); console.log(c);
}
function fetch() {
  const L = JSON.parse(fs.readFileSync(CORPUS, "utf8"));
  const miss = L.filter(l => !fs.existsSync(path.join(COMM, l.id + ".gdlvl"))).map(l => l.id);
  console.log(miss.length, "to download, ~" + Math.round(miss.length * 2.5 / 60) + " min");
  for (let i = 0; i < miss.length; i += 20)
    cp.execFileSync(process.execPath, [path.join(__dirname, "fetch_level.js"), ...miss.slice(i, i + 20), "--out", COMM], { stdio: "inherit" });
}

// ---------------- measures of one level (static) ----------------
function measureOne(file) {
  const { GD, readGdlvl } = require("./io.js"), style = require("./style.js"), craft = require("./craft.js"), clusters = require("./clusters.js");
  let L;
  if (typeof file === "object") L = Object.assign({ name: "test", short: "test", source: "object" }, file);
  else if (/^official:/.test(file)) {
    const n = +file.split(":")[1], j = JSON.parse(fs.readFileSync(path.join(LOCAL, `official_${String(n).padStart(2, "0")}.json`), "utf8"));
    const lv = GD.parseLevel(j.level); L = { name: j.name || "official " + n, short: j.name, source: "official", header: lv.header, objects: lv.objects };
  } else { const r = readGdlvl(file); L = { name: r.name, short: r.name, source: "file", header: r.level.header, objects: r.level.objects }; }
  const objs = L.objects, info = o => GD.objInfo(o.id) || {};
  const live = o => !(o.props && (o.props[121] === "1" || o.props[134] === "1"));
  const a = style.analyse(L);
  const F = {};
  const secs = Math.max(1, a.secs), mins = secs / 60, blocks = Math.max(1, a.blocks);
  // --- size, pace, variety (style.js) ---
  F.secs = a.secs; F.objPerBlock = objs.length / blocks; F.decoShare = a.decoShare;
  F.modes = new Set(a.sections.map(s => s.mode)).size; F.speeds = new Set(a.sections.map(s => s.speed)).size;
  F.sectionsPerMin = a.sections.length / mins;
  F.hazPer10 = a.sections.reduce((t, s) => t + s.hazards * s.blocks, 0) / blocks;
  F.orbsPadsPerMin = a.sections.reduce((t, s) => t + s.orbsPads, 0) / mins;
  F.restsPerMin = a.rests.length / mins;
  F.distinctIds = Object.keys(a.ids).length;
  F.channels = a.channels;
  const T = a.triggers, tsum = re => Object.entries(T).filter(([k]) => re.test(k)).reduce((s, [, v]) => s + v, 0);
  F.triggersPerMin = (a.by.trigger || 0) / mins;
  F.moveTrigPerMin = (T.move || 0) / mins;
  F.colourTrigPerMin = a.colourTriggers / mins;
  F.alphaPerMin = tsum(/alpha/i) / mins;
  F.hiddenShare = a.hidden / Math.max(1, objs.length);
  // --- craft.js: structures and attached deco ---
  const C = craft.numbers(objs);
  for (const k of ["pieces100", "pieceCells", "floorHaz", "underArmed", "topsDressed", "attached", "pillarDelta", "backDeco", "hazards100", "structuralDeco"]) F[k] = C[k];
  // --- layers and colour on deco (key 24 z-layer, 25 z-order, 41/43 HSV, 21 colour) ---
  let deco = 0, front = 0, hsv = 0, coloured = 0;
  for (const o of objs) { if (info(o).kind !== "decoration") continue; deco++;
    const z = +(o.props[24] || 0); if (z >= 3 || (z === 0 && +(o.props[25] || 0) > 0)) front++;
    if (o.props[41] === "1" || o.props[43] === "1") hsv++; if (o.props[21] || o.props[22]) coloured++; }
  F.frontShare = deco ? front / deco : 0; F.hsvShare = deco ? hsv / deco : 0; F.colouredDeco = deco ? coloured / deco : 0;
  // --- x -> seconds through speed portals ---
  const KA4 = { 0: 1, 1: 0, 2: 2, 3: 3, 4: 4 }, hd = style.headerInfo(L.header);
  const sp = objs.filter(o => info(o).kind === "speed").sort((p, q) => p.x - q.x);
  const tOf = x => { let s = KA4[hd.startSpeed] ?? 1, x0 = 0, t = 0;
    for (const p of sp) { if (p.x > x) break; t += (p.x - x0) / (GD.SPEEDS[s].x * 60); x0 = p.x; s = info(p).speed; }
    return t + (x - x0) / (GD.SPEEDS[s].x * 60); };
  // --- flashy (rule "too flashy"): pulses, quick background colour jumps ---
  const lum = (r, g, b) => { const f = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const hk = {}; { const p = L.header.split(","); for (let i = 0; i + 1 < p.length; i += 2) hk[p[i]] = p[i + 1]; }
  const chan = {}; for (const c of (hk.kS38 || "").split("|")) { const f = c.split("_"), o = {}; for (let i = 0; i + 1 < f.length; i += 2) o[f[i]] = f[i + 1]; if (o[6]) chan[o[6]] = [+o[1], +o[2], +o[3]]; }
  if (!chan[1000] && hk.kS1) chan[1000] = [+hk.kS1, +hk.kS2, +hk.kS3];   // 1.x header colours
  if (!chan[1000] && hk.kS29) { const f = hk.kS29.split("_"); chan[1000] = [+f[1], +f[3], +f[5]]; }
  const bgEv = [];
  let pulses = 0, flashes = 0;
  for (const o of objs) {
    const p = o.props; if (info(o).kind !== "trigger") continue;
    const target = o.id === 29 ? 1000 : +(p[23] || 0);
    if (o.id === 1006) { pulses++; if (+(p[45] || 0) <= 0.1 && (target === 1000 || target === 0 || +p[52] === 1)) { const L2 = lum(+p[7] || 255, +p[8] || 255, +p[9] || 255); if (L2 > 0.3) flashes++; } }
    if ((o.id === 899 || o.id === 29) && target === 1000 && p[7] !== undefined) bgEv.push({ t: tOf(o.x), L: lum(+p[7], +p[8], +p[9]), d: +(p[10] || 0) });
  }
  bgEv.sort((p, q) => p.t - q.t);
  const bg0 = chan[1000] ? lum(...chan[1000]) : lum(40, 125, 255);
  let prev = bg0, jumps = 0; const bgL = [bg0];
  for (const e of bgEv) { if (Math.abs(e.L - prev) > 0.2 && e.d <= 0.3) jumps++; prev = e.L; bgL.push(e.L); }
  F.pulsesPerMin = pulses / mins; F.flashesPerMin = (flashes + jumps) / mins;
  // contrast proxy: white-ish hazards (or their channel's header colour) vs the median background
  const med = v => { v = v.filter(Number.isFinite).sort((x, y) => x - y); return v.length ? v[v.length >> 1] : NaN; };
  const hz = objs.filter(o => info(o).kind === "hazard" && live(o));
  const hzL = med(hz.slice(0, 3000).map(o => { const c = chan[o.props[21]] || chan[1004]; return c ? lum(...c) : 1; }));
  const bgM = med(bgL), hi = Math.max(hzL, bgM), lo = Math.min(hzL, bgM);
  F.contrastProxy = (hi + 0.05) / (lo + 0.05);
  // --- clusters.js: overlapping / ragged / crowded hazards per 100 hazards ---
  const cl = clusters.check(objs);
  F.clusterIssues100 = 100 * cl.length / Math.max(1, hz.length);
  // --- grid of solids and hazards (cells of 30 units) ---
  const S = new Map(), H = new Set(), key = (c, r) => c + "," + r;
  for (const o of objs) { const k = info(o).kind, c = Math.floor(o.x / 30), r = Math.floor(o.y / 30);
    if ((k === "solid" || k === "slope") && live(o)) { if (!S.has(c)) S.set(c, new Set()); S.get(c).add(r); }
    if (k === "hazard" && live(o)) H.add(key(c, r)); }
  const solidAt = (c, r) => S.has(c) && S.get(c).has(r);
  // the floor under (c, r): the top of the highest solid below row r, or the ground (-1)
  const floorUnder = (c, r) => { let best = -1; for (const q of S.get(c) || []) if (q < r && q > best) best = q; return best; };
  // modes per column (from the sections)
  const modeAt = []; for (const s of a.sections) for (let c = Math.floor(s.from); c < s.from + s.blocks; c++) modeAt[c] = s.mode;
  const JUMP = /^(cube|robot|ball|spider)$/;
  // --- rule "flat ground under mode portals": the 4 columns before the portal on one floor with no hazard on it;
  // into a ground mode also the 3 after (the portal's own column is its frame, skipped) ---
  let portals = 0, flatPortals = 0;
  const flatRun = (c1, c2, r0) => { let f0 = null;
    for (let c = c1; c <= c2; c++) { const f = floorUnder(c, r0); if (f0 === null) f0 = f; if (f !== f0) return false;
      if (H.has(key(c, f + 1)) || H.has(key(c, f + 2)) || (f === -1 && H.has(key(c, 0)))) return false; }
    return true; };
  for (const o of objs) {
    const d = info(o); if (d.kind !== "mode") continue;
    const c0 = Math.floor(o.x / 30), r0 = Math.ceil(o.y / 30) + 1; portals++;
    if (flatRun(c0 - 4, c0 - 1, r0) && (!JUMP.test(d.mode) || flatRun(c0 + 1, c0 + 3, r0))) flatPortals++;
  }
  F.portalFlat = portals ? flatPortals / portals : NaN;
  // --- rule "symmetric orbs": an orb over a row of hazards sits over the row's centre (within half a block) ---
  let orbRows = 0, orbCentred = 0; const offs = [];
  for (const o of objs) {
    const d = info(o); if (d.kind !== "orb" || d.act === "dash") continue;
    const c0 = Math.floor(o.x / 30), r0 = Math.floor(o.y / 30);
    let row = null;
    for (let r = r0 - 1; r >= r0 - 5 && row === null; r--) for (let dc = -2; dc <= 2; dc++) if (H.has(key(c0 + dc, r))) { row = r; break; }
    if (row === null) continue;
    let lo2 = c0 + 2, hi2 = c0 - 2; for (let dc = -2; dc <= 2; dc++) if (H.has(key(c0 + dc, row))) { lo2 = Math.min(lo2, c0 + dc); hi2 = Math.max(hi2, c0 + dc); }
    while (H.has(key(lo2 - 1, row)) || H.has(key(lo2 - 2, row))) lo2 -= H.has(key(lo2 - 1, row)) ? 1 : 2;
    while (H.has(key(hi2 + 1, row)) || H.has(key(hi2 + 2, row))) hi2 += H.has(key(hi2 + 1, row)) ? 1 : 2;
    if (hi2 - lo2 > 12) continue;
    const off = Math.abs(o.x / 30 - (lo2 + hi2 + 1) / 2); orbRows++; offs.push(off); if (off <= 0.5) orbCentred++;
  }
  F.orbCentred = orbRows ? orbCentred / orbRows : NaN; F.orbOffset = offs.length ? med(offs) : NaN;
  // --- rule "spike then step": a floor hazard group followed 2-5 blocks later by a step up (bad) vs 0-1 (fine) ---
  let groups = 0, stepBad = 0, stepNear = 0;
  for (const k of H) {
    const [c, r] = k.split(",").map(Number);
    if (H.has(key(c - 1, r))) continue;                 // a group's first column only
    let e = c; while (H.has(key(e + 1, r))) e++;
    const f = floorUnder(c, r + 1); if (f !== r - 1 && !(r <= 0 && f === -1)) continue;   // stands on a floor
    groups++;
    for (let k2 = 1; k2 <= 6; k2++) {
      const cc = e + k2; if (solidAt(cc, r) || (r <= 0 && solidAt(cc, 0))) { if (k2 >= 3) stepBad++; else stepNear++; break; }
      if (H.has(key(cc, r))) break;
    }
  }
  F.spikeStepBad = groups ? stepBad / groups : NaN; F.spikeStepNear = groups ? stepNear / groups : NaN;
  // --- rule "flat height": in jumping-mode columns, the floor you can stand on: the highest walkable top within
  // reach (row <= 6, two free rows above it, no hazard on it; the ground when nothing else); a change counts when
  // the new floor holds for 2+ columns. Static proxy of tools/flow.js (which needs a solved route). ---
  const walk = c => { let best = null;
    for (const t of S.get(c) || []) if (t <= 6 && !solidAt(c, t + 1) && !solidAt(c, t + 2) && !H.has(key(c, t + 1)) && (best === null || t > best)) best = t;
    if (best === null && !H.has(key(c, 0)) && !solidAt(c, 0)) best = -1; return best; };
  let cur = -1, changes = 0, ground = 0, n = 0, pend = null, pendN = 0; const rows = [];
  const maxC = Math.max(0, ...S.keys(), ...modeAt.keys());
  for (let c = 0; c <= maxC; c++) {
    if (!JUMP.test(modeAt[c] || "")) continue;
    const w = walk(c);
    if (w !== null && w !== cur) { if (w === pend) pendN++; else { pend = w; pendN = 1; } if (pendN >= 2) { changes++; cur = w; pend = null; } }
    else pend = null;
    n++; if (cur === -1) ground++; rows.push(cur);
  }
  F.heightChanges10 = n ? 10 * changes / n : NaN; F.groundShare = n ? ground / n : NaN;
  const sr = [...rows].sort((x, y) => x - y); F.heightRange = rows.length ? sr[Math.floor(sr.length * 0.95)] - sr[Math.floor(sr.length * 0.05)] : NaN;
  F.jumpShare = n / Math.max(1, maxC + 1);
  // --- rule "empty deco": share of 30-block screens with at least half the level's median deco per block ---
  const perScr = []; for (const o of objs) if (info(o).kind === "decoration") { const s = Math.floor(o.x / 900); perScr[s] = (perScr[s] || 0) + 1; }
  const scr = Array.from({ length: Math.max(1, Math.ceil(blocks / 30)) }, (_, i) => perScr[i] || 0), m = med(scr);
  F.decoCoverage = m > 0 ? scr.filter(v => v >= m / 2).length / scr.length : 0;
  // --- repetition: share of gameplay chunks that repeat an earlier identical one ---
  const ch = style.chunks(L), seen = new Set(); let rep = 0;
  for (const k of ch) { if (seen.has(k.pic)) rep++; seen.add(k.pic); }
  F.chunkRepeat = ch.length ? rep / ch.length : NaN;
  F.staticEmpty = hz.length < 20 || (F.moveTrigPerMin > 60 && F.hazPer10 < 1) ? 1 : 0;   // trigger-built 2.2 levels measure as empty
  for (const k in F) if (typeof F[k] === "number" && Number.isFinite(F[k])) F[k] = +F[k].toFixed(4);
  return { name: L.name, v: VERSION, F };
}

// ---------------- measure all ----------------
function measure() {
  fs.mkdirSync(FEAT, { recursive: true });
  const L = JSON.parse(fs.readFileSync(CORPUS, "utf8"));
  const jobs = L.filter(l => fs.existsSync(path.join(COMM, l.id + ".gdlvl"))).map(l => ({ id: l.id, file: path.join(COMM, l.id + ".gdlvl") }));
  for (let n = 1; n <= 22; n++) if (fs.existsSync(path.join(LOCAL, `official_${String(n).padStart(2, "0")}.json`))) jobs.push({ id: "official" + n, file: "official:" + n });
  const only = opt("--only"), fresh = args.includes("--fresh");
  let done = 0, failed = 0;
  for (const j of jobs) {
    if (only && j.id !== only) continue;
    const out = path.join(FEAT, j.id + ".json");
    if (!fresh && fs.existsSync(out) && JSON.parse(fs.readFileSync(out, "utf8")).v === VERSION) continue;
    try {
      const r = cp.execFileSync(process.execPath, ["--max-old-space-size=1200", __filename, "one", j.file], { encoding: "utf8", maxBuffer: 1 << 26, timeout: 300000, env: Object.assign({}, process.env, { GDLM_HEAVY_HELD: "1" }) });
      fs.writeFileSync(out, r); done++;
      if (done % 20 === 0) console.log(done, "measured");
    } catch (e) { failed++; console.log(j.id, "failed:", String(e.message).split("\n")[0].slice(0, 120)); }
  }
  console.log(done, "measured,", failed, "failed ->", FEAT);
}

// ---------------- learn ----------------
// Bands compare like with like: the tier (Easy+Normal, Hard+Harder, Insane) and the era (the rating system changed).
const bandOf = l => (/Easy|Normal|Auto/.test(l.tier) ? "EN" : /Hard/.test(l.tier) ? "HH" : "I") + "|" + (l.era === "2.2" ? "2.2" : "old");
const FEATURES = ["objPerBlock", "decoShare", "modes", "speeds", "sectionsPerMin", "hazPer10", "orbsPadsPerMin", "restsPerMin", "distinctIds", "channels",
  "triggersPerMin", "moveTrigPerMin", "colourTrigPerMin", "alphaPerMin", "pieces100", "pieceCells", "floorHaz", "underArmed", "topsDressed", "attached",
  "pillarDelta", "backDeco", "structuralDeco", "frontShare", "hsvShare", "colouredDeco", "pulsesPerMin", "flashesPerMin", "contrastProxy",
  "clusterIssues100", "portalFlat", "orbCentred", "orbOffset", "spikeStepBad", "spikeStepNear", "heightChanges10", "groundShare", "heightRange",
  "decoCoverage", "chunkRepeat", "secs"];
// the user's soft rules (knowledge/checklist.md) as hypotheses: feature and the direction the rule wants
const RULES = [
  { rule: "flat ground under mode portals", f: "portalFlat", dir: +1 },
  { rule: "orbs centred over their spike row (symmetry)", f: "orbCentred", dir: +1 },
  { rule: "no step 2-5 blocks after a spike", f: "spikeStepBad", dir: -1 },
  { rule: "calm, not flashy (pulses)", f: "pulsesPerMin", dir: -1 },
  { rule: "calm, not flashy (flashes)", f: "flashesPerMin", dir: -1 },
  { rule: "hazards stand out (contrast)", f: "contrastProxy", dir: +1 },
  { rule: "no empty deco patches", f: "decoCoverage", dir: +1 },
  { rule: "height changes, not flat", f: "heightChanges10", dir: +1 },
  { rule: "not all on the bare floor", f: "groundShare", dir: -1 },
  { rule: "no repeated chunks", f: "chunkRepeat", dir: -1 },
  { rule: "clean spike groups", f: "clusterIssues100", dir: -1 },
  { rule: "deco attached to structures, not floating", f: "backDeco", dir: -1 },
  { rule: "built on many small pieces", f: "pieces100", dir: +1 },
  { rule: "2.2 budget: objects per block", f: "objPerBlock", dir: +1 },
  { rule: "variety: modes", f: "modes", dir: +1 },
];
const mean = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);
function ranks(v) { const ix = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]), r = new Array(v.length);
  for (let i = 0; i < ix.length;) { let j = i; while (j + 1 < ix.length && ix[j + 1][0] === ix[i][0]) j++; for (let k = i; k <= j; k++) r[ix[k][1]] = (i + j) / 2; i = j + 1; } return r; }
function spearman(x, y) { const rx = ranks(x), ry = ranks(y), mx = mean(rx), my = mean(ry);
  let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < x.length; i++) { sxy += (rx[i] - mx) * (ry[i] - my); sxx += (rx[i] - mx) ** 2; syy += (ry[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0; }
function cliff(a, b) { if (!a.length || !b.length) return NaN; let g = 0; for (const x of a) for (const y of b) g += x > y ? 1 : x < y ? -1 : 0; return g / (a.length * b.length); }
function auc(score, lab) { const p = score.filter((_, i) => lab[i]), n = score.filter((_, i) => !lab[i]); return (cliff(p, n) + 1) / 2; }
// a seeded RNG so a report is the same every run
function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

function loadRows() {
  const L = JSON.parse(fs.readFileSync(CORPUS, "utf8")), rows = [];
  for (const l of L) { const f = path.join(FEAT, l.id + ".json"); if (!fs.existsSync(f)) continue;
    const m = JSON.parse(fs.readFileSync(f, "utf8")); rows.push(Object.assign({}, l, { F: m.F, band: bandOf(l) })); }
  const off = [];
  for (let n = 1; n <= 22; n++) { const f = path.join(FEAT, "official" + n + ".json"); if (fs.existsSync(f)) off.push({ id: "official" + n, n, name: JSON.parse(fs.readFileSync(f, "utf8")).name, F: JSON.parse(fs.readFileSync(f, "utf8")).F }); }
  return { rows, off };
}
// within-band percentile of a value (0..1), from the band's sorted values
function pct(sorted, v) { if (!sorted.length || !Number.isFinite(v)) return 0.5; let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < v) lo = m + 1; else hi = m; }
  let e = lo; while (e < sorted.length && sorted[e] === v) e++; return (lo + e) / 2 / sorted.length; }

function learn() {
  const { rows, off } = loadRows();
  const use = rows.filter(r => !r.F.staticEmpty && r.F.secs >= 20);
  const out = [];
  const P = s => out.push(s);
  const bands = {}; for (const r of use) (bands[r.band] = bands[r.band] || []).push(r);
  P(`# Taste data report (tools/taste.js learn, ${new Date().toISOString().slice(0, 10)})\n`);
  P(`${rows.length} levels measured, ${use.length} used (${rows.length - use.length} dropped: under 20 s or built by triggers, which static measures see as empty). Officials: ${off.length}.\n`);
  P("| band | n | unrated | rated | featured | epic+ |\n|---|---|---|---|---|---|");
  for (const [b, R] of Object.entries(bands).sort()) P(`| ${b} | ${R.length} | ${R.filter(r => r.rank === 0).length} | ${R.filter(r => r.rank === 1).length} | ${R.filter(r => r.rank === 2).length} | ${R.filter(r => r.rank >= 3).length} |`);
  // labels: good = featured or better; plain = rated without feature, or unrated. Also likes per download (all levels).
  const good = r => r.rank >= 2, ldr = r => Math.log10(Math.max(1, r.likes) / Math.max(10, r.downloads));
  // per feature: within-band Cliff's delta (good vs plain), within-band Spearman vs likes/downloads; pooled by n
  const eff = {};
  for (const f of FEATURES) {
    let wd = 0, wn = 0, ws = 0, wsn = 0; const per = {};
    for (const [b, R] of Object.entries(bands)) {
      const R2 = R.filter(r => Number.isFinite(r.F[f])); if (R2.length < 8) continue;
      const g = R2.filter(good).map(r => r.F[f]), p = R2.filter(r => !good(r)).map(r => r.F[f]);
      if (g.length >= 3 && p.length >= 3) { const d = cliff(g, p), w = Math.min(g.length, p.length); wd += d * w; wn += w; per[b] = +d.toFixed(2); }
      const s = spearman(R2.map(r => r.F[f]), R2.map(ldr)); ws += s * R2.length; wsn += R2.length;
    }
    // bootstrap over levels within bands: the pooled delta's 90% interval
    const rnd = rng(7), boots = [];
    for (let it = 0; it < 200; it++) { let bd = 0, bn = 0;
      for (const R of Object.values(bands)) { const R2 = R.filter(r => Number.isFinite(r.F[f])); if (R2.length < 8) continue;
        const S = R2.map(() => R2[Math.floor(rnd() * R2.length)]); const g = S.filter(good).map(r => r.F[f]), p = S.filter(r => !good(r)).map(r => r.F[f]);
        if (g.length >= 3 && p.length >= 3) { const w = Math.min(g.length, p.length); bd += cliff(g, p) * w; bn += w; } }
      if (bn) boots.push(bd / bn); }
    boots.sort((x, y) => x - y);
    eff[f] = { delta: wn ? wd / wn : NaN, lo: boots[Math.floor(boots.length * 0.05)], hi: boots[Math.floor(boots.length * 0.95)], rhoLD: wsn ? ws / wsn : NaN, per };
  }
  P("\n## Per feature: featured+ vs the rest, within band\n\nCliff's delta (+1: every featured level is higher), its 90% bootstrap interval, and Spearman with likes per download. |delta| >= 0.15 with an interval clear of 0 counts.\n");
  P("| feature | delta | 90% | rho likes/dl | per band |\n|---|---|---|---|---|");
  const fmt = (v, d = 2) => Number.isFinite(v) ? v.toFixed(d) : "-";
  for (const f of [...FEATURES].sort((x, y) => Math.abs(eff[y].delta || 0) - Math.abs(eff[x].delta || 0)))
    P(`| ${f} | ${fmt(eff[f].delta)} | ${fmt(eff[f].lo)}..${fmt(eff[f].hi)} | ${fmt(eff[f].rhoLD)} | ${Object.entries(eff[f].per).map(([b, d]) => b + " " + d).join(", ")} |`);
  // ---- model: features as within-band percentiles, the strong ones, logistic ridge; held-out by 5 folds ----
  const strong = FEATURES.filter(f => f !== "secs" && Number.isFinite(eff[f].delta) && Math.abs(eff[f].delta) >= 0.1 && Math.sign(eff[f].lo) === Math.sign(eff[f].hi));
  const sorted = {}; for (const [b, R] of Object.entries(bands)) { sorted[b] = {}; for (const f of FEATURES) sorted[b][f] = R.map(r => r.F[f]).filter(Number.isFinite).sort((x, y) => x - y); }
  const xOf = (r, b) => strong.map(f => pct(sorted[b] ? sorted[b][f] : [], r.F[f]) - 0.5);
  function fit(R) { const w = new Array(strong.length).fill(0); let b0 = 0; const lr = 0.5, lam = 0.02;
    for (let it = 0; it < 600; it++) { const gw = new Array(w.length).fill(0); let gb = 0;
      for (const r of R) { const x = xOf(r, r.band), z = b0 + x.reduce((s, v, i) => s + v * w[i], 0), p = 1 / (1 + Math.exp(-z)), e = p - (good(r) ? 1 : 0);
        gb += e; x.forEach((v, i) => gw[i] += e * v); }
      b0 -= lr * gb / R.length; w.forEach((_, i) => w[i] -= lr * (gw[i] / R.length + lam * w[i])); }
    return { w, b0 }; }
  const score = (m, r) => m.b0 + xOf(r, r.band).reduce((s, v, i) => s + v * m.w[i], 0);
  const rnd = rng(11), folds = use.map(() => Math.floor(rnd() * 5)), held = new Array(use.length);
  for (let k = 0; k < 5; k++) { const m = fit(use.filter((_, i) => folds[i] !== k)); use.forEach((r, i) => { if (folds[i] === k) held[i] = score(m, r); }); }
  const lab = use.map(good), aucAll = auc(held, lab);
  const perBandAuc = {}; for (const b of Object.keys(bands)) { const ix = use.map((r, i) => r.band === b ? i : -1).filter(i => i >= 0); if (ix.filter(i => lab[i]).length >= 3 && ix.filter(i => !lab[i]).length >= 3) perBandAuc[b] = +auc(ix.map(i => held[i]), ix.map(i => lab[i])).toFixed(2); }
  const rhoHeld = spearman(held, use.map(ldr)), rhoRank = spearman(held, use.map(r => r.rank));
  const M = fit(use);
  P(`\n## Combined model (held out, 5 folds)\n\nFeatures used: ${strong.join(", ") || "(none passed)"}.\n`);
  P(`- AUC featured+ vs rest: **${fmt(aucAll)}** (0.5 = chance); per band: ${Object.entries(perBandAuc).map(([b, v]) => b + " " + v).join(", ")}`);
  P(`- Spearman with the rating rank (0 unrated .. 5 mythic): ${fmt(rhoRank)}; with likes per download: ${fmt(rhoHeld)}`);
  P("\n| feature | weight (per 1.0 of band percentile) |\n|---|---|"); strong.forEach((f, i) => P(`| ${f} | ${fmt(M.w[i])} |`));
  // ---- the user's rules ----
  P("\n## The user's soft rules vs the data\n\nsupported: the rule's direction separates featured+ from the rest (delta >= 0.1 in the rule's direction, interval clear of 0). against: the data says the opposite. unclear: neither. Each rule stays a soft rule either way; supported ones weigh more.\n");
  P("| rule | measure | delta (rule's direction) | 90% | verdict | n with it |\n|---|---|---|---|---|---|");
  const verdicts = [];
  for (const R of RULES) { const e = eff[R.f], d = e.delta * R.dir, lo = Math.min(e.lo * R.dir, e.hi * R.dir), hi = Math.max(e.lo * R.dir, e.hi * R.dir);
    const v = d >= 0.1 && lo > 0 ? "supported" : d <= -0.1 && hi < 0 ? "against" : "unclear";
    const nn = use.filter(r => Number.isFinite(r.F[R.f])).length;
    verdicts.push({ rule: R.rule, feature: R.f, dir: R.dir, delta: +d.toFixed(3), lo: +lo.toFixed(3), hi: +hi.toFixed(3), verdict: v, n: nn });
    P(`| ${R.rule} | ${R.f} | ${fmt(d)} | ${fmt(lo)}..${fmt(hi)} | ${v} | ${nn} |`); }
  // ---- officials and medians of featured+ per band (targets) ----
  const targets = {}; for (const [b, R] of Object.entries(bands)) { targets[b] = {}; const G = R.filter(good);
    for (const f of FEATURES) { const v = G.map(r => r.F[f]).filter(Number.isFinite).sort((x, y) => x - y); if (v.length >= 3) targets[b][f] = { p25: v[Math.floor(v.length * .25)], med: v[v.length >> 1], p75: v[Math.floor(v.length * .75)] }; } }
  const model = { version: VERSION, made: new Date().toISOString().slice(0, 10), n: use.length, features: strong, weights: M.w.map(v => +v.toFixed(3)), bias: +M.b0.toFixed(3),
    heldOut: { auc: +aucAll.toFixed(3), perBand: perBandAuc, rhoRank: +rhoRank.toFixed(3), rhoLikesPerDl: +rhoHeld.toFixed(3) },
    // band percentiles: 21 quantiles per feature (aggregates only, no level is recoverable from them)
    quantiles: Object.fromEntries(Object.entries(sorted).map(([b, o]) => [b, Object.fromEntries(Object.entries(o).filter(([, v]) => v.length >= 8).map(([f, v]) => [f, Array.from({ length: 21 }, (_, i) => +v[Math.min(v.length - 1, Math.floor(i * (v.length - 1) / 20))].toFixed(4))]))])),
    targets, effects: Object.fromEntries(Object.entries(eff).map(([f, e]) => [f, { delta: +(+e.delta).toFixed(3), lo: +(+e.lo).toFixed(3), hi: +(+e.hi).toFixed(3), rhoLD: +(+e.rhoLD).toFixed(3) }])), rules: verdicts };
  // officials through the model (as EN|old: RobTop's levels are Easy..Harder of the 1.x/2.x era)
  P("\n## Official levels through the model (band EN|old or HH|old by their stars)\n\n| level | taste |\n|---|---|");
  const tasteOf = (F, b) => { const r = { F, band: b }; const z = score(M, r); return Math.round(100 / (1 + Math.exp(-z))); };
  for (const o of off) P(`| ${o.n} ${o.name} | ${tasteOf(o.F, o.n <= 4 || o.n === 8 ? "EN|old" : "HH|old")} |`);
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, "report.md"), out.join("\n") + "\n");
  fs.writeFileSync(MODEL, JSON.stringify(model, null, 1) + "\n");
  console.log(out.join("\n")); console.log("\n->", path.join(DIR, "report.md"), "and", MODEL);
}

// ---------------- score one level (library + CLI) ----------------
// taste(F, band) -> { score 0-100, band, parts: [{f, pct, contrib}], rules: [{rule, ok, value, target}] }
function taste(F, band = "EN|2.2", model) {
  model = model || JSON.parse(fs.readFileSync(MODEL, "utf8"));
  const Q = model.quantiles[band] || model.quantiles[Object.keys(model.quantiles)[0]];
  const pq = (f, v) => { const q = Q[f]; if (!q || !Number.isFinite(v)) return 0.5; let i = 0; while (i < 20 && q[i + 1] <= v) i++; return i / 20; };
  let z = model.bias; const parts = [];
  model.features.forEach((f, i) => { const p = pq(f, F[f]), c = (p - 0.5) * model.weights[i]; z += c; parts.push({ f, value: F[f], pct: Math.round(p * 100), contrib: +c.toFixed(2) }); });
  parts.sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib));
  const T = model.targets[band] || {};
  const rules = model.rules.map(r => { const t = T[r.feature]; if (!t || !Number.isFinite(F[r.feature])) return null;
    const ok = r.dir > 0 ? F[r.feature] >= t.p25 : F[r.feature] <= t.p75; return { rule: r.rule, verdict: r.verdict, ok, value: F[r.feature], target: r.dir > 0 ? ">= " + t.p25 : "<= " + t.p75 }; }).filter(Boolean);
  return { score: Math.round(100 / (1 + Math.exp(-z))), band, parts, rules, heldOutAuc: model.heldOut.auc };
}
function scoreCli(file) {
  const r = JSON.parse(cp.execFileSync(process.execPath, ["--max-old-space-size=1200", __filename, "one", file], { encoding: "utf8", maxBuffer: 1 << 26, env: Object.assign({}, process.env, { GDLM_HEAVY_HELD: "1" }) }));
  const band = opt("--band") || "EN|2.2", t = taste(r.F, band);
  if (args.includes("--json")) { console.log(JSON.stringify(t)); return; }
  console.log(`${r.name}: taste ${t.score}/100 (band ${band}; model held-out AUC ${t.heldOutAuc})`);
  for (const p of t.parts.slice(0, 8)) console.log(`  ${p.contrib >= 0 ? "+" : ""}${p.contrib.toFixed(2)}  ${p.f} = ${p.value} (band percentile ${p.pct})`);
  for (const q of t.rules) if (!q.ok) console.log(`  rule ${q.verdict}: ${q.rule}: ${q.f || ""}${q.value} (featured levels ${q.target})`);
}

module.exports = { measureOne, taste, FEATURES, RULES, bandOf };
if (require.main === module) {
  const step = args[0];
  if (step === "one") { process.stdout.write(JSON.stringify(measureOne(args[1]))); }
  else if (step === "corpus") corpus();
  else if (step === "fetch") fetch();
  else if (step === "measure") { require("./heavy.js").claim(); measure(); }
  else if (step === "learn") learn();
  else if (step === "score" && args[1]) { require("./heavy.js").claim(); scoreCli(args[1]); }
  else console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n"));
}
