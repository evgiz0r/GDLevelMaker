// node tools/sign_board.js [--no-shots] [--notes]  -- the "Ending sign" section of the GD Work Board (board/README.md):
//   builds the short beat ending with the Claude sign on its own (a level that is only the ending, on Can't Let Go's beat),
//   finds the ending in our auto levels (each fits its own song), renders two frames of each (tools/shoot.js: a bounce and the
//   sign) into local/board/img/, and writes them as state.sign in local/board/state.json. Evgeni writes a note under any
//   picture (picks.sign_notes); --notes prints them. Run it on the PC (GD's art in the shots); a cloud session asks a PC
//   session to run it. Evgeni, 2026-11-26: "lets add the sign into the workboard, with a screenshot. and ill comment from there
//   if i want to improve. the pure one, and some of the endings in level as it mighty be different and has to match the
//   specific beat".
if (require.main === module && !process.argv.includes("--notes")) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs"), path = require("path"), cp = require("child_process");
const { GD, readGdlvl } = require("./io.js");
const ROOT = path.join(__dirname, ".."), DIR = path.join(ROOT, "local", "board"), IMG = path.join(DIR, "img");
const argv = process.argv.slice(2);
const TPS = 240, B = 30;

function readJson(f, d) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return d; } }
function writeJson(f, j) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + ".tmp", JSON.stringify(j, null, 1)); fs.renameSync(f + ".tmp", f); }

if (argv.includes("--notes")) {
  const n = (readJson(path.join(DIR, "picks.json"), {}).sign_notes) || {};
  const ks = Object.keys(n); if (!ks.length) console.log("no notes yet");
  for (const k of ks) console.log(`${k} (${n[k].at}): ${n[k].text}`);
  process.exit(0);
}

// the pure one: a level that is only the ending, on a song's beat grid
function pure(song) {
  const AB = require("./autobeat.js"), BE = require("./beatend.js");
  const g = AB.loadGrid ? AB.loadGrid(song) : null;
  const base = GD.DEFAULT_HEADER + ";1,1764,2,15,3,1500;";
  const be = BE.beatEnd(base, { period: g.period, t0: g.t0, fromX: 60 });
  const str = base + be.objects.map(o => `1,${o.id},2,${o.x.toFixed(2)},3,${o.y.toFixed(2)};`).join("");
  const lv = GD.parseLevel(str), q = GD.run(GD.makeWorld(lv.objects, lv.header), []);
  const out = path.join(ROOT, "local", "tmp", "sign_pure.gdlvl");
  AB.write(out, { song, g, lv: { str, sig: { col: be.signCol, floorY: be.floorY, beat: be.beats } }, fin: { p: q.path } }, "GDLM sign (ending only)");
  return out;
}

// where a level's ending is: the first of the sign's stage objects (channel group 960+) and the portal column before it
function moments(file) {
  const L = readGdlvl(file), lv = GD.parseLevel(L.levelStr), q = GD.run(GD.makeWorld(lv.objects, lv.header), []), p = q.path;
  const texts = lv.objects.filter(o => o.id === 914);
  const sx = texts.length ? Math.max(...texts.map(o => o.x)) : p[p.length - 1].x;
  const tOf = x => { const i = p.findIndex(s => s.x >= x); return (i < 0 ? p.length - 1 : i) / TPS; };
  const tSign = tOf(sx - 4 * B), tBounce = Math.max(0, tSign - 1.6);
  return [+tBounce.toFixed(2), +tSign.toFixed(2)];
}

function shots(file, id) {
  const [a, b] = moments(file), out = path.join(ROOT, "local", "shots", "sign_" + id);
  cp.spawnSync(process.execPath, [path.join(__dirname, "shoot.js"), file, "--at", `${a},${b}`, "--out", out], { stdio: "inherit", windowsHide: true });
  fs.mkdirSync(IMG, { recursive: true });
  const got = fs.existsSync(out) ? fs.readdirSync(out).filter(f => /\.png$/.test(f)).sort() : [];
  return got.map((f, i) => { const name = `sign_${id}_${i + 1}.png`; fs.copyFileSync(path.join(out, f), path.join(IMG, name)); return name; });
}

const items = [
  { id: "pure", title: "The sign on its own (Can't Let Go's beat)", file: () => pure("CantLetGo"), note: "A portal column on a beat, two pad bounces (each pad and each landing on a beat), then the sign; the robot, the human and the spark hop on the beats." },
  { id: "auto2", title: "In GDLM auto beat 2 (Can't Let Go)", file: () => path.join(ROOT, "levels", "lab", "auto_beat_2.gdlvl"), note: "The ending after the level's last section." },
];
// the first auto lab level, rebuilt with the new ending only if it has one (its cleared version v14 keeps the old outro)
const ab1 = path.join(ROOT, "levels", "lab", "auto_beat.gdlvl");
items.push({ id: "auto1", title: "In GDLM auto beat (Geometrical Dominator)", file: () => {
  const AB = require("./autobeat.js"), b = AB.build({ song: "GeometricalDominator", seed: 3, quiet: true });
  const out = path.join(ROOT, "local", "tmp", "sign_auto1.gdlvl"); AB.write(out, b, "GDLM auto beat (new ending)"); return out; },
  note: "The same ending on a faster, busier song: the pads and landings move to its beats." });

const state = readJson(path.join(DIR, "state.json"), {});
const sign = [];
for (const it of items) {
  let f; try { f = it.file(); } catch (e) { console.log(it.id + ": " + (process.env.DEBUG ? e.stack : e.message)); continue; }
  const imgs = argv.includes("--no-shots") ? [] : shots(f, it.id);
  imgs.forEach((img, i) => sign.push({ id: it.id + "_" + (i + 1), title: it.title + (i === 0 ? " -- the bounces" : " -- the sign"), img, note: i === 0 ? it.note : "", link: null }));
  console.log(`${it.id}: ${path.relative(ROOT, f)} -> ${imgs.join(", ")}`);
}
state.sign = sign; state.updated_at = new Date().toISOString();
writeJson(path.join(DIR, "state.json"), state);
console.log(`state.sign: ${sign.length} pictures -> local/board/state.json (board: http://localhost:8765/board/, "Ending sign")`);
