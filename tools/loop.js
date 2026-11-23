// node tools/loop.js <specs/NN.json | briefs/NN.json | level.gdlvl> [--look] [--brief briefs/NN.json]
//                    [--render] [--map] [--session <name> [--note "..."]] [--wait <min>] [--eta]
// node tools/loop.js --times            -- the time table: how long each step took on this PC (local/timings.jsonl)
// node tools/loop.js --time <step> <command ...>   -- time any other job into the same table, e.g.
//      --time push git push origin HEAD:main   |   --time install node tools/install.js <lvl>  (publisher only)
//
// The whole make-or-iterate loop in ONE command, wrapping the existing tools (it forks none of their logic):
//   slot    one heavy job at a time on this 16 GB PC: every step's tool takes the shared lock itself
//           (tools/heavy.js) and waits for a free slot (--wait minutes, default 120); loop.js shows who
//           holds it, echoes the "heavy: waiting for ..." lines, and leaves the wait out of the step's time
//   eta     prints how long each step should take, from earlier runs of the same step on similar-length
//           levels (local/timings.jsonl, shared by every session; built-in guesses until there are some)
//   make    tools/make.js <spec> [--look]  (a brief: tools/compose.js, which runs its own score/repair rounds)
//   score   tools/score.js <level> --json [--brief]: every gate incl. fairness; stops on a FAIL
//   render  --render: tools/shoot.js <level> (GD-art frames every 2 s, local/shots/)
//   map     --map (or --render): tools/levelmap.js <level> (local/maps/<name>.jpg)
//   wip     --session <name>: tools/wip.js put (viewer "in progress" + the phone row; then send the
//           ArtifactData call it prints, PHONE.md)
//   owners  first of all: stops when another worktree has uncommitted changes to the spec or level, or
//           another session put the same level in work in progress in the last 3 h (--anyway overrides)
// Stops at the first failing step with the reason, then prints one short result: READY / NOT READY
// (which gates), presses, tightest window, picture paths, wip version, time taken vs the ETA.
// Each step's full output goes to local/loop/<level>.<step>.log; each step's duration to local/timings.jsonl.
// It NEVER installs into the game or uploads: those stay with the coordinator and the publisher, on the user's yes.
// --eta: print the plan and the ETA, run nothing.   Test: node tests/loop.js
const fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process");
const ROOT = path.join(__dirname, "..");
const TIMINGS = process.env.GDLM_TIMINGS || path.join(ROOT, "local", "timings.jsonl");
const LOGDIR = process.env.GDLM_LOOPLOGS || path.join(ROOT, "local", "loop");

// built-in guesses (seconds) until timings.jsonl has real runs of a step: [fixed, per level-second]
const GUESS = { make: [5, 1.5], "make --look": [3, 0.05], compose: [60, 10], score: [10, 2.5], render: [25, 0.3], map: [30, 0.5], wip: [3, 0.1] };

// ---------- pure helpers (tested in tests/loop.js) ----------
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
// ETA of one step: the 3 earlier runs of it nearest in level length, each scaled to this length
function eta(step, levelSecs, rows) {
  const L = Math.max(levelSecs || 0, 3);
  const same = rows.filter(r => r.step === step && r.ok !== false && r.secs > 0);
  if (!same.length) { const g = GUESS[step] || [10, 1]; return { secs: g[0] + g[1] * L, from: 0 }; }
  const withLen = same.filter(r => r.levelSecs > 0);
  if (!levelSecs || !withLen.length) return { secs: median(same.map(r => r.secs)), from: same.length };
  const near = withLen.map(r => ({ r, d: Math.abs(Math.log(r.levelSecs / L)) })).sort((a, b) => a.d - b.d).slice(0, 3);
  // scale linearly in length, but never by more than 4x either way (a solve is not linear)
  return { secs: median(near.map(({ r }) => r.secs * Math.min(4, Math.max(0.25, L / r.levelSecs)))), from: near.length };
}
const fmt = s => s < 90 ? `${Math.round(s)} s` : s < 5400 ? `${(s / 60).toFixed(s < 600 ? 1 : 0)} min` : `${(s / 3600).toFixed(1)} h`;
function readTimings(file = TIMINGS) {
  try { return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean); } catch (e) { return []; }
}
// the time table from the log: per step and level-length bucket, median and range
function table(rows) {
  const bucket = r => !(r.levelSecs > 0) ? "-" : r.levelSecs < 30 ? "< 30 s" : r.levelSecs < 75 ? "30-75 s" : "> 75 s";
  const g = {};
  for (const r of rows) if (r.secs > 0 && r.ok !== false) (g[r.step + "|" + bucket(r)] = g[r.step + "|" + bucket(r)] || []).push(r.secs);
  return Object.entries(g).map(([k, v]) => { const [step, len] = k.split("|"); return { step, len, n: v.length, median: median(v), min: Math.min(...v), max: Math.max(...v) }; })
    .sort((a, b) => a.step.localeCompare(b.step) || a.len.localeCompare(b.len));
}

// ---------- the machine ----------
const heavy = require("./heavy.js"), freeMB = heavy.freeMB;
function slotStatus() {
  const hs = heavy.holders(), free = freeMB();
  console.log(hs.length ? `slot: ${hs.length} heavy job(s) running: ${hs.map(heavy.describe).join("; ")}; ${free} MB free -- each step waits its turn`
    : `slot: free, ${free} MB free`);
  return { others: hs.length, free };
}

// run one tool as a child (its own memory), full output to the step's log; resolves {code, out, secs}
function run(step, args, logBase) {
  return new Promise(res => {
    const t0 = Date.now();
    const ch = cp.spawn(process.execPath, args, { cwd: ROOT, windowsHide: true });
    let out = "", shown = 0;
    // echo the lock's waiting lines live (the rest goes to the log)
    const echo = () => { const lines = out.split(/\r?\n/); for (; shown < lines.length - 1; shown++) if (lines[shown].startsWith("heavy:")) console.log("   " + lines[shown]); };
    ch.stdout.on("data", d => { out += d; echo(); }); ch.stderr.on("data", d => out += d);
    ch.on("close", code => {
      const waited = +((out.match(/heavy: got the slot after waiting (\d+) s/) || [])[1] || 0);
      const secs = (Date.now() - t0) / 1000 - waited;   // the step's own time, without the wait for a slot
      fs.mkdirSync(LOGDIR, { recursive: true });
      fs.writeFileSync(path.join(LOGDIR, `${logBase}.${step.replace(/\W+/g, "_")}.log`), `$ node ${args.join(" ")}\n${out}\n(exit ${code}, ${secs.toFixed(1)} s)\n`);
      res({ code, out, secs });
    });
  });
}
function logTiming(row) {
  try { fs.mkdirSync(path.dirname(TIMINGS), { recursive: true }); fs.appendFileSync(TIMINGS, JSON.stringify(row) + "\n"); } catch (e) {}
}

// a level's length in seconds (through speed portals) and object count, from its objects
function lengthOf(level) {
  const { GD } = require("./io.js"); Object.assign(GD, require("../lib/sync.js"));
  const w = GD.makeWorld(level.objects, level.header);
  return { levelSecs: +GD.SYNC.tOfX(GD.SYNC.timeline(w), w.endX).toFixed(1), objects: level.objects.length };
}
// what a spec builds to, without solving (make.js's build, its prints muted)
function specInfo(file) {
  const make = require("./make.js"), spec = JSON.parse(fs.readFileSync(file, "utf8"));
  const out = path.join(ROOT, "levels", make.slug(spec.name) + ".gdlvl");
  // the last build's length when there is one (building a scene level just for the ETA took minutes)
  if (fs.existsSync(out)) { try { return Object.assign({ out, name: spec.name }, lengthOf(require("./io.js").readGdlvl(out).level)); } catch (e) {} }
  const log = console.log; console.log = () => {};
  try { const b = make.build(spec, file); return Object.assign({ out, name: spec.name }, lengthOf(b.level)); }
  catch (e) { return { out, name: spec.name }; }
  finally { console.log = log; }
}

// Is someone else working on this level right now? (gd-style was changing 47 while a timing run of it
// started, 2026-11-23.) Looks at every OTHER git worktree for uncommitted changes to the spec/brief or
// the level file, and at local/wip/<other session>/ for the same level put in the last 3 hours.
// Returns [reasons]; loop.js stops on any unless --anyway.
function othersAtWork(files, session, wipHours = 3, wipDir = path.join(ROOT, "local", "wip")) {
  const why = [], here = path.resolve(ROOT).toLowerCase();
  let wts = [];
  try { wts = cp.execFileSync("git", ["worktree", "list", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).split(/\r?\n/).filter(l => l.startsWith("worktree ")).map(l => l.slice(9).trim()); } catch (e) {}
  const rel = files.filter(Boolean).map(f => path.relative(ROOT, path.resolve(f)).replace(/\\/g, "/")).filter(f => !f.startsWith(".."));
  for (const wt of wts) {
    if (path.resolve(wt).toLowerCase() === here || !rel.length || !fs.existsSync(wt)) continue;
    try {
      const st = cp.execFileSync("git", ["-C", wt, "status", "--porcelain", "--", ...rel], { encoding: "utf8", timeout: 30000 }).trimEnd();
      if (st) why.push(`uncommitted changes in worktree ${path.basename(wt)}: ${st.split(/\r?\n/).map(l => l.slice(3)).join(", ")}`);
    } catch (e) {}
  }
  const bases = files.filter(Boolean).map(f => path.basename(f).replace(/\.(json|gdlvl)$/, ""));
  try {
    for (const s of fs.readdirSync(wipDir)) {
      if (s === session) continue;
      for (const f of fs.readdirSync(path.join(wipDir, s)).filter(f => f.endsWith(".gdlvl") && bases.includes(f.replace(/\.gdlvl$/, "")))) {
        const age = (Date.now() - fs.statSync(path.join(wipDir, s, f)).mtimeMs) / 3600e3;
        if (age < wipHours) why.push(`session "${s}" put ${f} in work in progress ${age < 1 ? Math.round(age * 60) + " min" : age.toFixed(1) + " h"} ago`);
      }
    }
  } catch (e) {}
  return why;
}

async function main() {
  const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  if (args[0] === "--time") {
    // time any other job into the same table (install, an upload, a push, an official solve): the rest is the command
    const step = args[1], cmd = args.slice(2);
    if (!step || !cmd.length) { console.log("usage: node tools/loop.js --time <step name> <command ...>"); return 1; }
    slotStatus();   // a heavy tool takes the lock itself (tools/heavy.js); a plain command just runs
    const t0 = Date.now(), r = cp.spawnSync(cmd[0], cmd.slice(1), { cwd: process.cwd(), stdio: "inherit", shell: process.platform === "win32" });
    const secs = (Date.now() - t0) / 1000;
    logTiming({ at: new Date().toISOString(), step, secs: +secs.toFixed(1), ok: r.status === 0, cmd: cmd.join(" ").slice(0, 200), freeMB: freeMB() });
    console.log(`time: ${step} took ${fmt(secs)} (exit ${r.status}) -> ${path.relative(ROOT, TIMINGS)}`);
    return r.status || 0;
  }
  if (args.includes("--times")) {
    const rows = readTimings();
    if (!rows.length) { console.log("no timings yet (" + TIMINGS + ")"); return 0; }
    console.log("step          level      runs  median   range");
    for (const t of table(rows)) console.log(`${t.step.padEnd(13)} ${t.len.padEnd(9)} ${String(t.n).padStart(5)}  ${fmt(t.median).padStart(7)}   ${fmt(t.min)} - ${fmt(t.max)}`);
    return 0;
  }
  const input = args.find((a, i) => !a.startsWith("--") && !["--brief", "--session", "--note", "--wait"].includes(args[i - 1]));
  if (!input) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); return 1; }
  const look = args.includes("--look"), render = args.includes("--render"), map = render || args.includes("--map");
  const session = (opt("--session") || "").replace(/[^\w-]+/g, ""), note = opt("--note") || "";
  const isLevel = input.endsWith(".gdlvl"), isBrief = !isLevel && /(^|[\\/])briefs[\\/]/.test(input);
  let brief = opt("--brief") || (isBrief ? input : null);
  const T0 = Date.now();

  // what will be built, and how long it is
  let info;
  if (isLevel) { const L = require("./io.js").readGdlvl(input); info = Object.assign({ out: path.resolve(input), name: L.name }, lengthOf(L.level)); }
  else if (isBrief) { const b = JSON.parse(fs.readFileSync(input, "utf8")); info = { out: path.join(ROOT, "levels", require("./make.js").slug(b.name) + ".gdlvl"), name: b.name }; }
  else info = specInfo(input);
  const base = path.basename(info.out, ".gdlvl");
  const steps = [];
  if (!isLevel) steps.push(isBrief ? "compose" : look ? "make --look" : "make");
  steps.push("score"); if (render) steps.push("render"); if (map) steps.push("map"); if (session) steps.push("wip");

  const rows = readTimings();
  const etas = steps.map(s => ({ s, e: eta(s, info.levelSecs, rows) }));
  const total = etas.reduce((a, x) => a + x.e.secs, 0);
  console.log(`== loop: ${info.name}${info.levelSecs ? ` (${info.levelSecs} s level, ${info.objects} objects)` : ""}`);
  console.log(`   ETA ~${fmt(total)}: ` + etas.map(x => `${x.s} ${fmt(x.e.secs)}${x.e.from ? "" : "?"}`).join(", ") + (etas.some(x => !x.e.from) ? "  (? = a guess, no timed run yet)" : ""));
  if (args.includes("--eta")) return 0;

  const busy = othersAtWork([isLevel ? null : input, info.out], session);
  if (busy.length && !args.includes("--anyway")) {
    console.log(`STOP someone else is working on this level:\n   ${busy.join("\n   ")}\n   ask them first; to time a run, build a copy (local/tmp/) instead; --anyway to go ahead`);
    return 4;
  }
  for (const b of busy) console.log(`WARN ${b} (--anyway)`);
  if (opt("--wait")) process.env.GDLM_HEAVY_WAIT = opt("--wait");
  const g = slotStatus();
  const T1 = Date.now(), waited = (T1 - T0) / 1000;
  const result = { name: info.name, ready: false, steps: [] };
  const stamp = (step, r, ok, extra) => {
    const row = Object.assign({ at: new Date().toISOString(), step, secs: +r.secs.toFixed(1), ok, level: base, levelSecs: info.levelSecs, objects: info.objects,
      session: session || undefined, others: g.others, freeMB: g.free }, extra || {});
    logTiming(row); result.steps.push(row);
    const e = etas.find(x => x.s === step);
    console.log(`   ${ok ? "ok  " : "FAIL"} ${step.padEnd(11)} ${fmt(r.secs)}${e ? ` (ETA ${fmt(e.e.secs)})` : ""}`);
  };
  const stop = (why) => { console.log(`\nSTOP ${why}\n   full output: ${path.relative(ROOT, LOGDIR)}/${base}.*.log`); finish(); return 2; };
  const finish = () => {
    const secs = (Date.now() - T1) / 1000;
    console.log(`   took ${fmt(secs)} (ETA ${fmt(total)})` + (waited > 20 ? `, after waiting ${fmt(waited)} for a free slot` : "") + (secs > 2 * total + 30 || secs < total / 3 - 30 ? "  -- far off the ETA: correct CLAUDE.md's time table if this keeps happening" : ""));
  };

  // make / compose
  if (steps[0] !== "score") {
    const r = isBrief ? await run("compose", [path.join("tools", "compose.js"), input], base)
      : await run(steps[0], [path.join("tools", "make.js"), input].concat(look ? ["--look"] : []), base);
    const important = r.out.split(/\r?\n/).filter(l => /WARN|PREJUMP|NOT |NOTE|Error|error|READY|round \d+|not beaten|dies/.test(l));
    if (r.code !== 0 || !fs.existsSync(info.out)) { stamp(steps[0], r, false); important.slice(-8).forEach(l => console.log("     " + l.trim())); return stop(`${steps[0]} failed (exit ${r.code})`); }
    // make.js does not exit non-zero when the level cannot be beaten: its check prints NOT BEATABLE
    const nb = r.out.split(/\r?\n/).find(l => /NOT BEATABLE/.test(l));
    const L = require("./io.js").readGdlvl(info.out); Object.assign(info, lengthOf(L.level));
    stamp(steps[0], r, !nb, { levelSecs: info.levelSecs, objects: info.objects });
    important.filter(l => !/NOT BEATABLE/.test(l)).slice(0, 12).forEach(l => console.log("     " + l.trim()));
    if (nb) return stop(`not beatable: ${nb.trim().replace(/^NOT BEATABLE with cube physics: /, "")}`);
  }

  // score: every gate
  {
    const r = await run("score", [path.join("tools", "score.js"), info.out, "--json"].concat(brief ? ["--brief", brief] : []), base);
    const line = r.out.split(/\r?\n/).find(l => l.startsWith("{"));
    if (!line) { stamp("score", r, false); return stop(`score crashed (exit ${r.code}): ${r.out.trim().split(/\r?\n/).slice(-3).join(" | ")}`); }
    const s = JSON.parse(line);
    stamp("score", r, s.ok);
    for (const gt of s.gates) if (gt.status !== "PASS") console.log(`     ${gt.status.padEnd(4)} ${gt.name.padEnd(11)} ${gt.value}${gt.note ? "  -- " + gt.note : ""}`);
    const gv = n => (s.gates.find(x => x.name === n) || {}).value || "";
    result.presses = gv("beatable"); result.timing = gv("timing");
    result.fails = s.gates.filter(x => x.status === "FAIL").map(x => x.name);
    result.ready = s.ok;
    if (!s.ok) { summary(result); return stop(`gates failed: ${result.fails.join(", ")}`); }
  }

  // pictures
  if (render) {
    const r = await run("render", [path.join("tools", "shoot.js"), info.out], base);
    const pngs = r.out.split(/\r?\n/).map(l => l.trim()).filter(l => /\.png$/i.test(l));
    stamp("render", r, r.code === 0 && pngs.length > 0, { frames: pngs.length });
    if (pngs.length) result.shots = `${pngs.length} frames in ${path.dirname(pngs[0])}`;
    else return stop("render made no frames: " + r.out.trim().split(/\r?\n/).slice(-2).join(" | "));
  }
  if (map) {
    const r = await run("map", [path.join("tools", "levelmap.js"), info.out].concat(brief ? ["--brief", brief] : []), base);
    const jpg = (r.out.match(/\S+\.jpg/) || [])[0];
    stamp("map", r, r.code === 0);
    if (r.code !== 0) return stop("level map failed: " + r.out.trim().split(/\r?\n/).slice(-2).join(" | "));
    result.map = jpg || "local/maps/";
  }

  // work in progress + the phone row
  if (session) {
    const r = await run("wip", [path.join("tools", "wip.js"), "put", info.out, "--session", session].concat(note ? ["--note", note] : []), base);
    stamp("wip", r, r.code === 0);
    const v = (r.out.match(/ v(\d+) /) || [])[1], phone = r.out.split(/\r?\n/).find(l => l.startsWith("phone:"));
    if (r.code !== 0) return stop("wip put failed: " + r.out.trim().split(/\r?\n/).slice(-2).join(" | "));
    result.wip = `${session} v${v}`; result.phone = phone;
  }
  summary(result); finish();
  return result.ready ? 0 : 2;
}
function summary(r) {
  console.log(`\n== ${r.name}: ${r.ready ? "READY" : "NOT READY" + (r.fails && r.fails.length ? " (" + r.fails.join(", ") + ")" : "")}`);
  if (r.presses) console.log(`   ${r.presses}; ${r.timing}`);
  if (r.shots) console.log(`   frames: ${r.shots}`);
  if (r.map) console.log(`   map: ${r.map}`);
  if (r.wip) console.log(`   wip: ${r.wip}` + (r.phone ? `\n   ${r.phone}` : ""));
  console.log("   (never installed or uploaded: that is the coordinator's / publisher's, on the user's yes)");
}

module.exports = { othersAtWork, eta, table, readTimings, median, fmt, lengthOf };
if (require.main === module) main().then(c => process.exit(c || 0), e => { console.error(e); process.exit(1); });
