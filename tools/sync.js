// node tools/sync.js [--official] [--repo] [--save] [file.gdlvl ...]  -- how well levels follow
// their song's beat (default: --official --repo).
//
//   --official  the game's 22 levels (Resources/levels/<n>.txt); presses only where tools/official.js
//               has a solution in local/, the rest by object positions
//   --repo      examples/*.gdlvl and levels/*.gdlvl (solved here: cube levels are quick)
//   --save      the user's created levels in CCLocalLevels.dat (object positions only, no solving)
//
// Needs the beat grids from `node tools/beats.js`. Writes local/sync/<which>.json (gitignored: it holds
// numbers about RobTop's levels and songs). Method and findings: SYNC.md.
//
// Per level and per kind of event (press = when the player must click, from the solution's
// timing windows; touch = orbs, pads and portals; obstacle = each run of spikes) it prints
// kappa on the beat and on the half-beat (1 = all on it, 0 = no better than luck), p (chance of
// doing that well by luck) and the phase offset of the events from the beat in ms.
const fs = require("fs"), path = require("path");
const { GD, unpack, readGdlvl } = require("./io.js");
Object.assign(GD, require("../lib/sync.js"));
const { loadBeats, OFFICIAL } = require("./beats.js");
const S = GD.SYNC;
const ROOT = path.join(__dirname, "..");
const GAME = require("./gdpaths.js").GAME;
const NAMES = ["Stereo Madness", "Back On Track", "Polargeist", "Dry Out", "Base After Base", "Cant Let Go", "Jumper",
  "Time Machine", "Cycles", "xStep", "Clutterfunk", "Theory of Everything", "Electroman Adventures", "Clubstep",
  "Electrodynamix", "Hexagon Force", "Blast Processing", "Theory of Everything 2", "Geometrical Dominator",
  "Deadlocked", "Fingerdash", "Dash"];
const offsetOf = h => { const m = /(?:^|,)kA13,([-0-9.]+)/.exec(h || ""); return m ? +m[1] : 0; };

function songUrl(rec, header) {
  const custom = GD.getField(rec, "k45");
  if (custom && custom !== "0") return "/song/custom/" + custom + ".mp3";
  const k8 = +(GD.getField(rec, "k8") || 0);
  return "/song/official/" + OFFICIAL[k8] + ".mp3";
}

// measure one level. src: {name, levelStr, song (url), solution: {events} | null, solve: bool}
function measure(src) {
  const L = GD.parseLevel(src.levelStr);
  const world = GD.makeWorld(L.objects, L.header);
  const offset = offsetOf(L.header);
  const beats = loadBeats(src.song);
  const res = { name: src.name, song: src.song, offset, objects: L.objects.length };
  if (!beats || !beats.ok) { res.skip = "no beat grid for " + src.song + " (run tools/beats.js; is the song on this PC?)"; return res; }
  res.bpm = beats.bpm; res.beatConf = beats.conf;
  const tl = S.timeline(world);
  let events = src.solution && src.solution.ok ? src.solution.events : null;
  if (!events && src.solve) { const r = GD.solveAny(world); if (r.ok) events = r.events; }
  let windows = null;
  if (events) {
    const pw = S.pressWindows(world, events);
    if (pw) {
      windows = pw.windows;
      // the x->time map must agree with the replay (speed portals)
      let err = 0;
      for (let k = 0; k < pw.path.length; k += 24) err = Math.max(err, Math.abs(S.xOfT(tl, k / GD.PHYS.TPS) - pw.path[k].x));
      res.timelineErr = +err.toFixed(1);
    }
  }
  const ev = S.levelEvents(world, tl, windows);
  res.seconds = +S.tOfX(tl, world.endX).toFixed(1);
  res.beats = +(S.timeToBeat(beats, offset, res.seconds)).toFixed(0);
  const kinds = { press: e => e.kind === "press", orb: e => e.kind === "orb", pad: e => e.kind === "pad", portal: e => e.kind === "portal", obstacle: e => e.kind === "obstacle" };
  res.score = {};
  for (const [k, f] of Object.entries(kinds)) {
    const list = ev.filter(f);
    if (!list.length) continue;
    res.score[k] = { beat: S.score(list, beats, offset, 1), half: S.score(list, beats, offset, 2) };
  }
  if (windows) res.windowMs = Math.round(windows.reduce((a, w) => a + (w.hi - w.lo + 1), 0) / windows.length / GD.PHYS.TPS * 1000);
  // the beat each press could land on: the share of press windows that contain a beat
  // song beat index (0 = the grid's t0) of each event, for the pooled summary
  const songBeat = t => (t + offset - beats.t0) / beats.period;
  res.events = ev.map(e => ({ k: e.kind, s: e.sub, b0: +songBeat(e.t0).toFixed(3), b1: +songBeat(e.t1).toFixed(3), b: +songBeat(e.mid).toFixed(3), l: e.label }));
  res.downbeat = beats.downbeat; res.sections = beats.sections; res.songBeats = beats.beats;
  res.firstBeat = +songBeat(0).toFixed(3); res.lastBeat = +songBeat(res.seconds).toFixed(3);
  return res;
}

function sources(args) {
  const out = [];
  const want = f => args.includes(f) || (!args.some(a => a.startsWith("--")) && !args.some(a => !a.startsWith("--")) && f !== "--save");
  if (want("--official")) for (let n = 1; n <= 22; n++) {
    const f = path.join(GAME, "Resources", "levels", n + ".txt");
    if (!fs.existsSync(f)) continue;
    const sol = path.join(ROOT, "local", `official_${String(n).padStart(2, "0")}.json`);
    const main = path.join(ROOT, "..", "..", "..", "local", `official_${String(n).padStart(2, "0")}.json`); // the main checkout's local/, from a worktree
    const sf = fs.existsSync(sol) ? sol : fs.existsSync(main) ? main : null;
    out.push({ name: `official ${n} ${NAMES[n - 1]}`, levelStr: unpack(fs.readFileSync(f, "utf8")), song: "/song/official/" + OFFICIAL[n - 1] + ".mp3",
               solution: sf ? JSON.parse(fs.readFileSync(sf, "utf8")).solution : null });
  }
  if (want("--repo")) for (const dir of ["examples", "levels"]) {
    const d = path.join(ROOT, dir);
    if (fs.existsSync(d)) for (const f of fs.readdirSync(d).sort()) if (f.endsWith(".gdlvl")) out.push(fromFile(path.join(d, f), dir + "/" + f));
  }
  if (args.includes("--save")) {
    const SAVE = require("./gdpaths.js").SAVE;
    const xml = decodeSave(fs.readFileSync(path.join(SAVE, "CCLocalLevels.dat")));
    for (const rec of savedLevels(xml)) {
      const k4 = GD.getField(rec, "k4");
      if (!k4) continue;
      const levelStr = unpack(k4);
      out.push({ name: "save: " + GD.getField(rec, "k2"), levelStr, song: songUrl(rec, levelStr.split(";")[0]), solution: null });
    }
  }
  for (const a of args) if (!a.startsWith("--")) out.push(fromFile(a, a));
  return out;
}
// the save: XOR 11 -> base64url -> gzip (as in tools/install.js)
function decodeSave(buf) {
  const t = Buffer.from(buf.map(b => b ^ 11)).toString("latin1").replace(/\x00/g, "").trim();
  return require("zlib").gunzipSync(Buffer.from(t.replace(/-/g, "+").replace(/_/g, "/"), "base64")).toString("utf8");
}
function fromFile(file, name) {
  const L = readGdlvl(file);
  return { name: L.name + "  (" + name + ")", levelStr: L.levelStr, song: songUrl(L.rec, L.level.header), solution: null, solve: true };
}
function savedLevels(xml) {
  const start = xml.indexOf("<k>LLM_01</k><d>");
  const recs = [];
  const re = /<k>k_\d+<\/k><d>/g;
  re.lastIndex = start;
  let m;
  while ((m = re.exec(xml))) {
    let i = m.index + m[0].length, depth = 1;
    while (depth > 0) { const o = xml.indexOf("<d>", i), c = xml.indexOf("</d>", i); if (o >= 0 && o < c) { depth++; i = o + 3; } else { depth--; i = c + 4; } }
    recs.push(GD.parseRecord("<plist><dict>" + xml.slice(m.index + m[0].length, i - 4) + "</dict></plist>"));
    re.lastIndex = i;
  }
  return recs;
}

const f2 = v => v === undefined ? "  -  " : (v >= 0 ? " " : "") + v.toFixed(2);
function row(r) {
  if (r.skip) return `${r.name.padEnd(40)} ${r.skip}`;
  const c = k => { const s = r.score[k]; if (!s) return "".padEnd(34); const b = s.beat, h = s.half;
    return `${String(b.n).padStart(3)} ${f2(b.kappa)} ${f2(h.kappa)} p${b.p.toFixed(2)} ${String(b.offsetMs).padStart(4)}ms`.padEnd(34); };
  return `${r.name.slice(0, 40).padEnd(40)} ${r.bpm.toFixed(0).padStart(3)} ${r.beatConf.padEnd(6)} ${c("press")}${c("orb")}${c("portal")}${c("obstacle")}` +
    (r.windowMs ? ` win ${r.windowMs}ms` : "") + (r.timelineErr > 2 ? ` (timeline off by ${r.timelineErr})` : "");
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const list = sources(args);
  console.log(`${"level".padEnd(40)} BPM conf   ${"press: n kappa(beat) kappa(half) p offset".padEnd(34)}${"orb".padEnd(34)}${"portal".padEnd(34)}obstacle (spike runs)`);
  const all = [];
  for (const s of list) { const r = measure(s); all.push(r); console.log(row(r)); }
  const off = all.filter(r => !r.skip && /^official/.test(r.name));
  if (off.length > 1) pooled(off);
  fs.mkdirSync(path.join(ROOT, "local", "sync"), { recursive: true });
  const tag = args.filter(a => a.startsWith("--")).map(a => a.slice(2)).join("_") || "official_repo";
  fs.writeFileSync(path.join(ROOT, "local", "sync", tag + ".json"), JSON.stringify(all));
}

// ---- pooled over many levels (the official ones): what kind of thing is put on the beat?
function pooled(levels) {
  console.log(`
pooled over ${levels.length} levels -- phase R (1 = all at one phase of the beat; ~1/sqrt(n) by luck), at phase (beats)`);
  const groups = {};
  for (const r of levels) for (const e of r.events) {
    const key = e.k === "portal" ? "portal:" + e.s : e.k;
    (groups[key] = groups[key] || []).push({ ...e, lvl: r });
  }
  const phaseR = (list, per) => {
    let cx = 0, cy = 0;
    for (const e of list) { const a = 2 * Math.PI * e.b / per; cx += Math.cos(a); cy += Math.sin(a); }
    return { R: Math.hypot(cx, cy) / list.length, ph: Math.atan2(cy, cx) / (2 * Math.PI) * per };
  };
  for (const [k, list] of Object.entries(groups).sort()) {
    const b = phaseR(list, 1), h = phaseR(list, 0.5), luck = 1 / Math.sqrt(list.length);
    // bar position: beats after the downbeat, rounded
    const bar = [0, 0, 0, 0];
    for (const e of list) bar[(((Math.round(e.b) - e.lvl.downbeat) % 4) + 4) % 4]++;
    console.log(`  ${k.padEnd(16)} n ${String(list.length).padStart(5)}  beat R ${b.R.toFixed(3)} (x${(b.R / luck).toFixed(1)} luck) at ${b.ph >= 0 ? "+" : ""}${b.ph.toFixed(3)}` +
      `  half-beat R ${h.R.toFixed(3)} (x${(h.R / luck).toFixed(1)})  bar position 1-4: ${bar.map(v => Math.round(v / list.length * 100) + "%").join(" ")}`);
  }
  // section changes (drops, breaks) in the song vs portals: how many changes inside the level
  // have a portal within 2 beats, against the same with the changes slid to random places
  let have = 0, n = 0, chanceSum = 0;
  for (const r of levels) {
    const ports = r.events.filter(e => e.k === "portal").map(e => e.b);
    const inside = (r.sections || []).filter(s => s[0] > r.firstBeat + 4 && s[0] < r.lastBeat - 4);
    const near = b => ports.some(p => Math.abs(p - b) <= 2);
    for (const s of inside) { n++; if (near(s[0])) have++; }
    let c = 0, K = 0;
    for (let b = Math.ceil(r.firstBeat + 4); b < r.lastBeat - 4; b++) { K++; if (near(b)) c++; }
    chanceSum += inside.length * (K ? c / K : 0);
  }
  if (n) console.log(`  song section changes inside the levels: ${n}; with a portal within 2 beats: ${have} (${Math.round(have / n * 100)}%), by luck ${Math.round(chanceSum / n * 100)}%`);
}

module.exports = { measure, sources, row, pooled };
