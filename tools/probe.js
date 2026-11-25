#!/usr/bin/env node
// Reads the GDLM Probe mod's attempt logs (mods/gdlm-probe, GEODE.md): the real game's player state every tick.
// usage: node tools/probe.js [list] [--dir <folder>]          every attempt: level, ticks, presses, result
//        node tools/probe.js show <file|index> [--every N]     the ticks (every Nth) and the presses
//        node tools/probe.js presses <file|index>              press / release ticks, for the sim's replay
//        node tools/probe.js play <level.gdlvl | save:<name>> ... | --all-gdlm [--attempts N] [--offset k] [--max-seconds s] [--stay] [--launch]
//            several levels = one batch in one GD launch (--all-gdlm: every GDLM level in the save with a saved route);
//            writes the mod's play.json from the level's saved route (local/solutions): GD opens the level from the
//            menu, the mod presses on the route's ticks, then GD quits without saving (--stay: no quit).
//            --launch starts GD through Steam (refused while it runs) and waits for the result.
//            The level must be in the user's save (Create) under the same name and start with "GDLM".
//        node tools/probe.js result [file|index] | --last-batch the last playback attempt (or the one given, or the whole batch):
//            cleared or where it died, and the first ticks where the game and our sim differ
// Default folder: %LOCALAPPDATA%/GeometryDash/geode/mods/gdlm.probe/attempts (GD's save folder on Windows).
"use strict";
const fs = require("fs");
const path = require("path");

function defaultDir() {
  const base = process.env.LOCALAPPDATA || path.join(require("os").homedir(), "AppData", "Local");
  return path.join(base, "GeometryDash", "geode", "mods", "gdlm.probe", "attempts");
}

function read(file) {
  const out = { file, start: null, ticks: [], btn: [], death: null, end: null };
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; } // a file cut short by a crash keeps its good lines
    if (o.t === "start") out.start = o;
    else if (o.t === "tick") out.ticks.push(o);
    else if (o.t === "btn") out.btn.push(o);
    else if (o.t === "death") out.death = o;
    else if (o.t === "end") out.end = o;
  }
  return out;
}

function files(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort().map((f) => path.join(dir, f));
}

// the level, its route (saved solution) and our sim's run of it
function routeOf(what) {
  const { levelOf } = require("./shoot.js");
  const L = levelOf(what);
  const sol = L.solution || require("./solutions.js").get(L.levelStr, true);
  if (!sol || !sol.ok || !sol.events) throw new Error(`no saved route for ${L.name}: node tools/solutions.js <level> first`);
  const { GD } = require("./io.js");
  const lv = GD.parseLevel(L.levelStr);
  const w = GD.makeWorld(lv.objects, lv.header);
  const run = GD.run(w, sol.events);
  return { name: L.name, events: sol.events, run };
}

function gdRunning() {
  const r = require("child_process").spawnSync("tasklist", ["/FI", "IMAGENAME eq GeometryDash.exe", "/NH"], { encoding: "utf8", windowsHide: true });
  return /GeometryDash\.exe/i.test(r.stdout || "");
}

function play(args, dir) {
  const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
  const attempts = Number(opt("--attempts", 1)), offset = Number(opt("--offset", 0));
  const maxSec = Number(opt("--max-seconds", 0));
  const stay = args.includes("--stay"), launch = args.includes("--launch"), allGdlm = args.includes("--all-gdlm");
  let whats = args.filter((x) => !x.startsWith("--"));
  if (allGdlm) whats = require("./corpus.js").mine().map((l) => l.short).filter((n) => /^GDLM/.test(n)).map((n) => "save:" + n);
  if (!whats.length) { console.error("usage: node tools/probe.js play <level | save:<name>> ... | --all-gdlm [--attempts N] [--offset k] [--max-seconds s] [--stay] [--launch]"); process.exit(2); }
  const entries = [];
  let ticks = 0;
  for (const what of whats) {
    let R;
    try { R = routeOf(what); } catch (e) { console.log(`skip ${what}: ${e.message}`); continue; }
    if (!/^GDLM/.test(R.name)) { console.log(`skip ${R.name}: playback is for GDLM levels only`); continue; }
    const len = (R.run.path.length - 1) / 240;
    if (maxSec && len > maxSec) { console.log(`skip ${R.name}: ${len.toFixed(0)} s > --max-seconds`); continue; }
    const presses = R.events.filter((e) => e.type === "press" || e.type === "release").map((e) => [e.tick, e.type === "press" ? 1 : 0, 0]);
    entries.push({ level: R.name, attempts, offset, presses });
    ticks += R.run.path.length;
    console.log(`  ${R.name}: ${presses.length / 2 | 0} presses, ${len.toFixed(0)} s, our sim ${R.run.done ? "clears" : "dies at x " + R.run.end.x.toFixed(1)}`);
  }
  if (!entries.length) { console.error("nothing to play"); process.exit(1); }
  const cmd = { autostart: true, quit: !stay, entries, made: new Date().toISOString() };
  const modDir = path.dirname(dir);
  fs.mkdirSync(modDir, { recursive: true });
  for (const f of ["play.finished.json", "play.results.jsonl"]) try { fs.unlinkSync(path.join(modDir, f)); } catch {}
  fs.writeFileSync(path.join(modDir, "play.json"), JSON.stringify(cmd));
  fs.writeFileSync(path.join(modDir, "play.batch.json"), JSON.stringify({ made: cmd.made, since: Date.now(), levels: entries.map((e) => e.level) }));
  console.log(`play.json: ${entries.length} level(s)`);
  if (!launch) { console.log("start GD: it opens the first level from the main menu"); return; }
  if (gdRunning()) { console.error("GeometryDash.exe is running: not launched (play.json waits for the next start)"); process.exit(1); }
  require("child_process").spawn("cmd", ["/c", "start", "", "steam://rungameid/322170"], { windowsHide: true, detached: true, stdio: "ignore" }).unref();
  const t0 = Date.now(), limit = (ticks / 240) * attempts * 1000 + 60000 + 15000 * entries.length;
  const fin = path.join(modDir, "play.finished.json");
  const wait = () => {
    if (fs.existsSync(fin)) { console.log(`finished in ${Math.round((Date.now() - t0) / 1000)} s`); setTimeout(() => batch(dir), 500); return; }
    if (Date.now() - t0 > limit) { console.error(`no result after ${Math.round(limit / 1000)} s (did the mod load? see GD's geode/logs)`); process.exit(1); }
    setTimeout(wait, 1000);
  };
  wait();
}

// the last batch: one line per level, then each playback attempt's comparison
function batch(dir) {
  const modDir = path.dirname(dir);
  let meta = {};
  try { meta = JSON.parse(fs.readFileSync(path.join(modDir, "play.batch.json"), "utf8")); } catch {}
  let res = [];
  try { res = fs.readFileSync(path.join(modDir, "play.results.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch {}
  console.log(`batch of ${(meta.levels || []).length} (${meta.made || "?"}): ${res.length} result(s)`);
  for (const r of res) console.log(`  ${r.level}: ${r.last} after ${r.attempts} attempt(s)`);
  const since = meta.since || 0;
  for (const f of files(dir)) {
    const st = read(f).start || {};
    if (st.playback && st.wall_ms >= since) { console.log(""); result(f); }
  }
}

function result(f) {
  const r = read(f);
  const s = r.start || {};
  const last = r.ticks[r.ticks.length - 1];
  console.log(`${s.level}${s.playback ? " (playback)" : ""}: ${r.end ? r.end.result : "cut"} after ${r.ticks.length} ticks` +
    (r.death ? `, died at x ${r.death.x.toFixed(1)} y ${r.death.y.toFixed(1)} by object ${r.death.obj} at (${r.death.ox}, ${r.death.oy})` : last ? `, x ${last.p[0].toFixed(1)}` : ""));
  let R;
  try { R = routeOf(/^GDLM/.test(s.level || "") ? "save:" + s.level : s.level); } catch (e) { console.log("no sim comparison: " + e.message); return; }
  const P = R.run.path;
  console.log(`our sim: ${R.run.done ? "clears" : "dies at x " + R.run.end.x.toFixed(1)} after ${P.length - 1} ticks`);
  // GD's y has its ground elsewhere: compare heights from the first tick's offset
  const t1 = r.ticks[0];
  if (!t1 || !P[t1.n]) return;
  if (t1.p.length >= 10) return perTick(r, R);
  // GD 2.2091 updates m_position once per frame (every 4th processCommands at 60 fps), a tick or two behind
  // the step it ran: compare heights at the same x (the sim's state where it reaches the game's x)
  const dy0 = t1.p[1] - P[0].y;
  console.log(`y offset: ${dy0.toFixed(2)} (GD's ground is that much higher)`);
  let shown = 0, prevX = null, cmp = 0, maxDy = 0, maxAt = 0, j = 0;
  for (const t of r.ticks) {
    const gx = t.p[0];
    const fresh = prevX === null || gx !== prevX;
    prevX = gx;
    if (!fresh) continue;
    while (j + 1 < P.length && P[j + 1].x <= gx + 1e-6) j++;
    if (j + 1 >= P.length) break;
    const q = P[j];
    cmp++;
    const dy = t.p[1] - q.y - dy0, lag = t.n - j;
    if (Math.abs(dy) > maxDy) { maxDy = Math.abs(dy); maxAt = t.n; }
    if (Math.abs(dy) > 0.5 || t.p[3] !== q.mode) {
      console.log(`tick ${t.n} (sim tick ${j}, lag ${lag}): game x ${gx.toFixed(2)} y ${t.p[1].toFixed(2)} vy ${t.p[2].toFixed(3)} ${t.p[3]} | sim y ${(q.y + dy0).toFixed(2)} vy ${q.vy.toFixed(3)} ${q.mode} | dy ${dy.toFixed(2)}`);
      if (++shown >= 10) break;
    }
  }
  console.log(`${cmp} fresh ticks compared; largest height gap ${maxDy.toFixed(2)} at tick ${maxAt}`);
  if (!shown) console.log("game and sim agree to 0.5 unit on every compared tick");
}

// per-step comparison with the physics position (px, py: probe v0.3.0+): the lag that lines x up, the first tick where
// the heights part, and every jump's start in the game vs the sim, against the press's place in the 60 fps frame
function perTick(r, R) {
  const P = R.run.path, T = r.ticks;
  // lag k: game tick n is the sim's tick n + k (from x)
  const lags = {};
  for (const t of T.slice(0, 2000)) {
    let j = Math.max(0, t.n - 8);
    while (j + 1 < P.length && P[j + 1].x <= t.p[8] + 1e-6) j++;
    if (Math.abs(P[j].x - t.p[8]) < 0.01) lags[j - t.n] = (lags[j - t.n] || 0) + 1;
  }
  const k = Number(Object.entries(lags).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0);
  const step = T.length > 2 ? T[2].p[8] - T[1].p[8] : 0;
  const dy0 = T[0].p[9] - P[Math.max(0, T[0].n + k)].y;
  console.log(`per-step position: x moves ${step.toFixed(4)} a step (sim ${(P[2].x - P[1].x).toFixed(4)}); game tick n = sim tick n${k >= 0 ? "+" : ""}${k} (x matches on ${lags[k] || 0} of the first ${Math.min(2000, T.length)} ticks); y offset ${dy0.toFixed(2)}`);
  let part = null, maxDy = 0;
  for (const t of T) {
    const q = P[t.n + k];
    if (!q) break;
    const dy = t.p[9] - q.y - dy0, dx = t.p[8] - q.x;
    if (Math.abs(dy) > maxDy) maxDy = Math.abs(dy);
    if (!part && (Math.abs(dy) > 0.5 || Math.abs(dx) > 0.5 || t.p[3] !== q.mode)) part = { n: t.n, dx, dy, t, q };
  }
  if (part) console.log(`first parting: tick ${part.n} (x ${part.t.p[8].toFixed(1)}): game y ${part.t.p[9].toFixed(2)} vy ${part.t.p[2].toFixed(3)} ${part.t.p[3]} | sim y ${(part.q.y + dy0).toFixed(2)} vy ${part.q.vy.toFixed(3)} ${part.q.mode} | dx ${part.dx.toFixed(2)} dy ${part.dy.toFixed(2)}`);
  else console.log("game and sim agree to 0.5 unit on every step");
  console.log(`largest height gap ${maxDy.toFixed(2)}`);
  // jump starts: vy rises by more than 2 in one step
  const gj = [], sj = [];
  for (let i = 1; i < T.length; i++) if (T[i].p[2] - T[i - 1].p[2] > 2) gj.push(T[i].n);
  for (let i = 1; i < P.length; i++) if (P[i].vy - P[i - 1].vy > 2) sj.push(i);
  // the frame phase: the drawn x changes on the step that ends a frame
  const fr = new Set();
  for (let i = 1; i < T.length; i++) if (T[i].p[0] !== T[i - 1].p[0]) fr.add(T[i].n);
  const phaseOf = (n) => { for (let d = 0; d < 8; d++) if (fr.has(n + d)) return d; return -1; };
  const presses = r.btn.filter((b) => b.down).map((b) => b.n);
  const tab = {};
  for (const s0 of sj) {
    const g = gj.reduce((best, x) => (Math.abs(x + k - s0) < Math.abs(best + k - s0) ? x : best), -1e9);
    const d = g + k - s0;
    if (Math.abs(d) > 6) continue;
    const pr = presses.filter((p) => p <= s0 - k).pop();
    const key = `phase ${pr == null ? "?" : phaseOf(pr)}`;
    tab[key] = tab[key] || {};
    tab[key][d] = (tab[key][d] || 0) + 1;
  }
  console.log(`jump starts, game minus sim in steps (${sj.length} in the sim, ${gj.length} in the game), by the press's steps to the end of its frame:`);
  for (const [ph, m] of Object.entries(tab).sort()) console.log(`  ${ph}: ${Object.entries(m).sort((a, b) => a[0] - b[0]).map(([d, c]) => (d > 0 ? "+" : "") + d + " x" + c).join(", ")}`);
}

function main() {
  const a = process.argv.slice(2);
  const opt = (k, d) => { const i = a.indexOf(k); if (i < 0) return d; const v = a[i + 1]; a.splice(i, 2); return v; };
  const dir = opt("--dir", defaultDir());
  const every = Number(opt("--every", 24));
  const cmd = a[0] || "list";
  const all = files(dir);
  const pick = (x) => (/^\d+$/.test(x || "") ? all[Number(x)] : x);
  if (cmd === "list") {
    if (!all.length) { console.log(`no attempts in ${dir}`); return; }
    all.forEach((f, i) => {
      const r = read(f);
      const s = r.start || {};
      const last = r.ticks[r.ticks.length - 1];
      const res = r.end ? r.end.result : "cut";
      const where = r.death ? ` at x ${r.death.x.toFixed(1)} (obj ${r.death.obj})` : last ? ` x ${last.p[0].toFixed(1)}` : "";
      console.log(`${i}\t${s.level} #${s.attempt}${s.practice ? " practice" : ""}\t${r.ticks.length} ticks\t` +
        `${r.btn.filter((b) => b.down).length} presses\t${res}${where}\t${path.basename(f)}`);
    });
  } else if (cmd === "show" || cmd === "presses") {
    const f = pick(a[1]);
    if (!f || !fs.existsSync(f)) { console.error("no such attempt: " + a[1]); process.exit(1); }
    const r = read(f);
    console.log(JSON.stringify(r.start));
    if (cmd === "presses") { for (const b of r.btn) console.log(`${b.n}\t${b.down ? "down" : "up"}\tbutton ${b.button}${b.p1 ? "" : " p2"}`); return; }
    const btnAt = new Map(r.btn.map((b) => [b.n, b]));
    for (const t of r.ticks) {
      const b = btnAt.get(t.n);
      if (t.n % every && !b) continue;
      const [x, y, vy, mode, up, g, size, sp] = t.p;
      console.log(`${t.n}\tx ${x.toFixed(2)}\ty ${y.toFixed(2)}\tvy ${vy.toFixed(3)}\t${mode}${up ? " up" : ""}${g ? " ground" : ""}` +
        `${size !== 1 ? " size " + size : ""}\tspeed ${sp}\tcam ${t.cam.map((c) => c.toFixed(1)).join(",")}${b ? `\t<- ${b.down ? "DOWN" : "UP"}` : ""}`);
    }
    if (r.death) console.log(JSON.stringify(r.death));
    if (r.end) console.log(JSON.stringify(r.end));
  } else if (cmd === "play") {
    play(a.slice(1), dir);
  } else if (cmd === "result" && a.includes("--last-batch")) {
    batch(dir);
  } else if (cmd === "result") {
    const f = a[1] ? pick(a[1]) : all.slice().reverse().find((x) => (read(x).start || {}).playback);
    if (!f || !fs.existsSync(f)) { console.error("no playback attempt in " + dir); process.exit(1); }
    result(f);
  } else {
    console.error("usage: node tools/probe.js [list | show <file|index> | presses <file|index> | play <level> | result] [--dir <folder>]");
    process.exit(1);
  }
}

if (require.main === module) main();
module.exports = { read, files, defaultDir };
