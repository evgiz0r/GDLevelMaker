// node tools/bot.js levels/<name>.gdlvl [--attempts 3] [--offset 20]
// node tools/bot.js --probe      (look only: checks the bot can see the game; presses nothing)
//
// Plays the solver's clicks for a level in the user's real game, by pressing Space -- no mod, no
// install (tools/keybot.cs, compiled on the fly by Windows PowerShell). Use it to check that a level
// the sim calls beatable really is: a clear means the sim and the game agree; a death says roughly
// where they do not (record with tools/record.sh to see it).
//
// 1. Install the level (tools/install.js), start GD, open the level's page.
// 2. Run this. 3. Press Play in GD and take your hands off: the bot finds the start of each attempt
//    on screen, presses on time, and tries again after a death, up to --attempts.
// GD must stay the active window (the bot pauses while it is not). Normal mode works; in practice
// mode a death restarts from a checkpoint, which the bot does not follow.
// --offset (ms): a fixed correction to the press times (negative = earlier). The bot also measures
// its own lag from the first ground jumps and corrects later attempts; the value it prints at the
// end is a good --offset for next time.
const path = require("path"), fs = require("fs"), os = require("os"), { spawnSync } = require("child_process");
const { GD, readGdlvl } = require("./io.js");

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf("--" + name); return i >= 0 ? args.splice(i, 2)[1] : def; };
const attempts = +opt("attempts", 3), offset = +opt("offset", 20); // measured on the first real run (GDLM 42, 2026-11-22)
const cs = path.join(__dirname, "keybot.cs").replace(/'/g, "''");
// the bot sees the screen through ffmpeg (Desktop Duplication), as tools/record.sh does
if (!process.env.GDLM_FFMPEG) {
  const w = spawnSync("where", ["ffmpeg"], { windowsHide: true, encoding: "utf8" });
  const found = w.status === 0 && w.stdout.split(/\r?\n/)[0].trim();
  const winget = path.join(process.env.LOCALAPPDATA || "", "Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.0.1-full_build/bin/ffmpeg.exe");
  process.env.GDLM_FFMPEG = found || (fs.existsSync(winget) ? winget : "ffmpeg");
}
if (args.includes("--probe")) {
  // look only: is the game window found, and do the screen grabs see the cube? Presses nothing.
  const res = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", `Add-Type -Path '${cs}'; exit [KeyBot]::Probe(30)`], { windowsHide: true, stdio: "inherit" });
  process.exit(res.status === null ? 1 : res.status);
}
const file = args[0];
if (!file) { console.log("usage: node tools/bot.js levels/<name>.gdlvl [--attempts 3] [--offset 20]"); process.exit(1); }

const L = readGdlvl(file);
const w = GD.makeWorld(L.level.objects, L.level.header);
console.log(`${L.name}: solving...`);
const r = GD.solveAny(w);
if (!r.ok) { console.log(`the sim cannot beat it (stops at block ${(r.dieAt.x / 30).toFixed(1)}, ${r.why}); nothing to play`); process.exit(1); }
const ev = r.events.slice().sort((a, b) => a.tick - b.tick);
// the solver taps for 1 tick; the game reads keys once a frame, so hold a tap 8 ticks (2 frames)
// unless the next press comes sooner. Then check the sim still clears with the longer holds.
for (let i = 0; i + 1 < ev.length; i++) {
  if (ev[i].type !== "press" || ev[i + 1].type !== "release" || ev[i + 1].tick - ev[i].tick >= 8) continue;
  const next = ev[i + 2] ? ev[i + 2].tick - 1 : Infinity;
  ev[i + 1] = { tick: Math.min(ev[i].tick + 8, next), type: "release" };
}
if (!GD.run(w, ev).done) { console.log("longer taps would change the run in the sim; keeping the solver's own taps"); ev.splice(0, ev.length, ...r.events.slice().sort((a, b) => a.tick - b.tick)); }
const run = GD.run(w, ev);
const jumps = ev.filter(e => e.type === "press" && run.path[e.tick + 1] && run.path[e.tick + 1].act === "jump").map(e => e.tick);
const presses = ev.filter(e => e.type === "press").length;
console.log(`${presses} presses, level ${(run.path.length / 240).toFixed(1)} s. ${jumps.length} of them are ground jumps (used to measure lag).`);
if (r.clicks) { const tight = r.clicks.filter(c => c.ms).map(c => c.ms).sort((a, b) => a - b)[0]; if (tight && tight < 34) console.log(`note: tightest timing window ${tight} ms; the bot is good to about one frame, so a death there may be the bot`); }

const tmp = path.join(os.tmpdir(), "gdlm_bot.json");
fs.writeFileSync(tmp, JSON.stringify({ ticks: ev.map(e => e.tick), downs: ev.map(e => e.type === "press"), jumps, end: run.path.length }));
const js = tmp.replace(/'/g, "''");
const log = path.join(__dirname, "..", "local", "bot.log").replace(/'/g, "''");
fs.mkdirSync(path.join(__dirname, "..", "local"), { recursive: true });
const ps = `$ErrorActionPreference='Stop'; Add-Type -Path '${cs}';
$j = Get-Content -Raw '${js}' | ConvertFrom-Json;
$code = [KeyBot]::Run([int[]]$j.ticks, [bool[]]$j.downs, [int[]]$j.jumps, [double]$j.end, ${attempts}, ${offset}, '${log}'); exit $code`;
const res = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps], { windowsHide: true, stdio: "inherit" });
process.exit(res.status === null ? 1 : res.status);
