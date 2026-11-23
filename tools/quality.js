// node tools/quality.js [--only <name part>] [--fresh] [--md]
//
// The quality scorecard: the official levels 1-10 next to every GDLM level (QUALITY.md). One row per level,
// the newest file of each: levels/gdlm_*.gdlvl and local/wip/<session>/gdlm_*.gdlvl ("_polished" counts as the
// same level). Columns, all measured on the route a person plays (lib/natural.js; tools/fairness.js analyse):
//   gameplay  length s, modes used, mode changes / min, presses / s (CPS), tightest and median input window
//             (lenient: lib/difficulty.js measureWindows), the difficulty score (log10 attempts) and stars
//   flow      surface changes / 10 s (landing on a new height), height range (5-95%, blocks), % of the time on the
//             bare floor (grounded at ground level), repeats: share of 4-input runs (mode + gap to the next input,
//             50 ms steps) that already happened in the 10 s before
//   look      objects / block, distinct ids, shares by catalogue group (knowledge/objects/catalogue.tsv):
//             gameplay (blocks, slopes, hazards, orbs...), structural deco (deco-blocks, deco-spikes: outlines,
//             corners, attached), background (scenery, shapes, pixel, effects); triggers / min
//   fair      tools/fairness.js flags: FAIL / WARN counts
// A row is cached in local/quality/<name>_<hash>_<physics>.json (official numbers stay in local/), so a re-run is
// seconds; a new or changed level gets measured (each in its own child process, one at a time; a level with no
// saved solution is solved first: heavy, check free memory). Prints narrow tables; --md writes the table block
// that QUALITY.md holds to local/quality/table.md. tools/loop.js can call it after a level changes.
const fs = require("fs"), path = require("path"), cp = require("child_process"), crypto = require("crypto");
const ROOT = path.join(__dirname, ".."), OUT = path.join(ROOT, "local", "quality");
const STARS = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10 };

// ---------- one level (child process) ----------
function measure(spec) {
  const { GD, readGdlvl } = require("./io.js"), corpus = require("./corpus.js"), FA = require("./fairness.js");
  let name, objects, header, sol = null;
  if (/^official:/.test(spec)) {
    const n = +spec.split(":")[1], j = JSON.parse(fs.readFileSync(path.join(ROOT, "local", `official_${String(n).padStart(2, "0")}.json`), "utf8"));
    const L = GD.parseLevel(j.level); name = corpus.NAMES[n - 1]; objects = L.objects; header = L.header; sol = j.solution;
  } else {
    const L = readGdlvl(spec); name = L.name; objects = L.level.objects; header = L.level.header;
    try { const s = require("./solutions.js").get(L.levelStr); if (s && s.events) sol = Object.assign({ ok: true }, s); } catch (e) {}
  }
  const w = GD.makeWorld(objects, header); w.name = name;
  if (!sol) sol = GD.solveAny(w);
  sol = Object.assign({ ok: sol.ok !== false && !!sol.events }, sol);
  const A = FA.analyse(w, sol), fl = FA.flags(A);
  const run = GD.run(w, A.events), P = run.path, TPS = 240, secs = P.length / TPS;
  // gameplay
  const modes = new Set(P.map(s => s.mode)); let changes = 0;
  for (let t = 1; t < P.length; t++) if (P[t].mode !== P[t - 1].mode) changes++;
  const presses = A.events.filter(e => e.type === "press");
  // flow
  let surf = 0, lastY = null, floorTicks = 0;
  for (let t = 0; t < P.length; t++) {
    const s = P[t];
    if (!s.grounded) continue;
    if (s.grav > 0 && s.y < 16) floorTicks++;
    if (lastY !== null && Math.abs(s.y - lastY) >= 15 && (t === 0 || P[t - 1].grounded === false)) surf++;
    lastY = s.y;
  }
  const ys = P.map(s => s.y).sort((a, b) => a - b), q = f => ys[Math.min(ys.length - 1, Math.floor(f * ys.length))];
  const tok = presses.map((e, i) => (P[Math.min(e.tick, P.length - 1)] || {}).mode + Math.round(((presses[i + 1] ? presses[i + 1].tick : e.tick + 240) - e.tick) / TPS * 20));
  let rep = 0, grams = 0;
  for (let i = 4; i + 4 <= tok.length; i++) {
    grams++;
    const g = tok.slice(i, i + 4).join(" ");
    for (let j = i - 4; j >= 0 && (presses[i].tick - presses[j].tick) / TPS <= 10; j--) if (tok.slice(j, j + 4).join(" ") === g) { rep++; break; }
  }
  // look
  const cat = {};
  for (const l of fs.readFileSync(path.join(ROOT, "knowledge", "objects", "catalogue.tsv"), "utf8").split("\n").slice(1)) { const f = l.split("\t"); if (f[0]) cat[f[0]] = f[1]; }
  const groups = { gameplay: 0, structural: 0, background: 0, triggers: 0, other: 0 };
  for (const o of objects) {
    const g = cat[o.id] || "";
    if (/^(blocks|slopes|hazards|interactive)$/.test(g)) groups.gameplay++;
    else if (/^(deco-blocks|deco-spikes)$/.test(g)) groups.structural++;
    else if (/^(deco-scenery|deco-shapes|deco-other|pixel|effects)$/.test(g)) groups.background++;
    else if (g === "triggers") groups.triggers++;
    else groups.other++;
  }
  const nonTrig = Math.max(1, objects.length - groups.triggers), blocks = w.endX / 30;
  return {
    name, complete: !!A.complete, secs: A.seconds || secs,
    modes: [...modes].join("/"), modeChangesPerMin: changes / secs * 60, cps: presses.length / secs,
    tightest: A.tightest, median: A.medianMs, score: A.logAttempts,
    surfPer10s: surf / secs * 10, heightRange: (q(0.95) - q(0.05)) / 30, bareFloor: floorTicks / P.length, repeats: grams ? rep / grams : 0,
    objPerBlock: objects.length / blocks, distinctIds: new Set(objects.map(o => o.id)).size,
    gameplayShare: groups.gameplay / nonTrig, structuralShare: groups.structural / nonTrig, backgroundShare: groups.background / nonTrig,
    triggersPerMin: groups.triggers / secs * 60,
    fails: fl.filter(f => f.severity === "FAIL").length, warns: fl.filter(f => f.severity === "WARN").length,
  };
}

if (process.argv[2] === "--one") { process.stdout.write(JSON.stringify(measure(process.argv[3]))); process.exit(0); }

// ---------- the list ----------
function levels() {
  const out = [];
  for (let n = 1; n <= 10; n++) out.push({ key: `official_${String(n).padStart(2, "0")}`, spec: `official:${n}`, file: path.join(ROOT, "local", `official_${String(n).padStart(2, "0")}.json`), stars: STARS[n], official: true });
  const cands = [];
  const add = (dir, tag) => { if (!fs.existsSync(dir)) return; for (const f of fs.readdirSync(dir)) if (/^gdlm_\d+.*\.gdlvl$/.test(f)) cands.push({ file: path.join(dir, f), tag, base: f.replace(/_polished/, "").replace(/\.gdlvl$/, ""), mt: fs.statSync(path.join(dir, f)).mtimeMs }); };
  add(path.join(ROOT, "levels"), "repo");
  const wip = path.join(ROOT, "local", "wip");
  if (fs.existsSync(wip)) for (const s of fs.readdirSync(wip)) add(path.join(wip, s), s + (s === "main" ? "" : ""));
  const best = {};
  for (const c of cands) if (!/gdlm_0[12]_/.test(c.base) && (!best[c.base] || c.mt > best[c.base].mt)) best[c.base] = c;
  for (const b of Object.keys(best).sort()) out.push({ key: b + (best[b].tag === "repo" ? "" : "@" + best[b].tag), spec: best[b].file, file: best[b].file, src: best[b].tag });
  return out;
}

function physicsStamp() { try { return cp.execSync("git log -1 --format=%h -- lib/physics.js lib/objects.js lib/difficulty.js lib/natural.js", { cwd: ROOT }).toString().trim(); } catch (e) { return "x"; } }

function main() {
  const args = process.argv.slice(2), only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
  fs.mkdirSync(OUT, { recursive: true });
  const ph = physicsStamp(), rows = [];
  for (const L of levels()) {
    if (only && !L.key.includes(only)) continue;
    if (!fs.existsSync(L.file)) { console.error(`(skip ${L.key}: ${L.file} missing)`); continue; }
    const h = crypto.createHash("md5").update(fs.readFileSync(L.file)).digest("hex").slice(0, 8);
    const cf = path.join(OUT, `${L.key.replace(/[^\w@.-]/g, "_")}_${h}_${ph}.json`);
    let r = null;
    if (fs.existsSync(cf) && !args.includes("--fresh")) r = JSON.parse(fs.readFileSync(cf, "utf8"));
    else {
      process.stderr.write(`measuring ${L.key} ... `);
      const t0 = Date.now();
      try { r = JSON.parse(cp.execFileSync(process.execPath, ["--max-old-space-size=1500", __filename, "--one", L.spec], { cwd: ROOT, maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "ignore"] }).toString()); }
      catch (e) { process.stderr.write("failed\n"); continue; }
      process.stderr.write(`${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
      fs.writeFileSync(cf, JSON.stringify(r));
    }
    rows.push(Object.assign(r, { key: L.key, official: !!L.official, stars: L.stars, src: L.src }));
  }
  const tables = render(rows);
  console.log(tables);
  if (args.includes("--md")) fs.writeFileSync(path.join(OUT, "table.md"), tables);
}

const f0 = x => x == null || !isFinite(x) ? "-" : Math.round(x).toString(), f1 = x => x == null || !isFinite(x) ? "-" : x.toFixed(1), f2 = x => x == null || !isFinite(x) ? "-" : x.toFixed(2), pc = x => x == null ? "-" : Math.round(100 * x) + "%";
const short = r => r.official ? r.name : (r.key.match(/gdlm_(\d+)/) || [, "?"])[1] + (r.src && r.src !== "repo" ? "*" : "") + " " + r.name.replace(/^GDLM \d+ /, "").slice(0, 12);
function table(rows, head, cols) {
  const lines = ["| level | " + head.join(" | ") + " |", "|---" + "|---".repeat(head.length) + "|"];
  for (const r of rows) lines.push("| " + short(r) + (r.complete === false ? " (part)" : "") + " | " + cols.map(c => c(r)).join(" | ") + " |");
  // official range row
  return lines.join("\n");
}
function render(rows) {
  const off = rows.filter(r => r.official), mine = rows.filter(r => !r.official), all = [...off, ...mine];
  const rng = (k, fmt) => { const v = off.map(r => r[k]).filter(x => x != null && isFinite(x)).sort((a, b) => a - b); return v.length ? `${fmt(v[0])}-${fmt(v[v.length - 1])}` : "-"; };
  const withRange = (t, ks, fmts) => t + "\n| *official range* | " + ks.map((k, i) => k ? rng(k, fmts[i]) : "").join(" | ") + " |";
  const g = withRange(table(all, ["s", "modes", "chg/min", "CPS", "min ms", "med ms", "score", "stars"],
    [r => f0(r.secs), r => r.modes.split("/").length, r => f1(r.modeChangesPerMin), r => f1(r.cps), r => f0(r.tightest), r => f0(r.median), r => f2(r.score), r => r.stars || "-"]),
    ["secs", null, "modeChangesPerMin", "cps", "tightest", "median", "score", null], [f0, f0, f1, f1, f0, f0, f2, f0]);
  const fl = withRange(table(all, ["surf/10s", "height", "floor", "repeat"],
    [r => f1(r.surfPer10s), r => f1(r.heightRange), r => pc(r.bareFloor), r => pc(r.repeats)]),
    ["surfPer10s", "heightRange", "bareFloor", "repeats"], [f1, f1, pc, pc]);
  const lk = withRange(table(all, ["obj/blk", "ids", "play", "struct", "bg", "trig/min", "fair"],
    [r => f0(r.objPerBlock), r => r.distinctIds, r => pc(r.gameplayShare), r => pc(r.structuralShare), r => pc(r.backgroundShare), r => f0(r.triggersPerMin), r => (r.fails ? r.fails + " FAIL" : "ok") + (r.warns ? " " + r.warns + "W" : "")]),
    ["objPerBlock", "distinctIds", "gameplayShare", "structuralShare", "backgroundShare", "triggersPerMin", null], [f0, f0, pc, pc, pc, f0, f0]);
  return `Gameplay\n\n${g}\n\nFlow\n\n${fl}\n\nLook and fairness\n\n${lk}\n\n* = a work-in-progress copy newer than levels/; (part) = the sim does not finish it`;
}

if (require.main === module) main();
module.exports = { measure, levels, render };
