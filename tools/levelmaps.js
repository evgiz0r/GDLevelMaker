// node tools/levelmaps.js [--all] [--force]  -- make the level map (tools/levelmap.js) of every level that has none:
// ours (levels/, examples/) and the official ones (local/official_NN.json), named as the viewer's "level map" button
// asks for them (local/maps/<file name>.jpg), so it opens at once. One after another at LOW priority on the heavy
// lock (a session's own jobs go first). --force: make them again. Run it in the background; it can take an hour.
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."), MAPS = path.join(ROOT, "local", "maps"), force = process.argv.includes("--force");
const jobs = [];
for (const d of ["levels", "examples"]) for (const f of fs.readdirSync(path.join(ROOT, d)).filter(f => f.endsWith(".gdlvl") && !/^gdlm_tmp_/.test(f))) jobs.push(d + "/" + f);
for (const f of fs.readdirSync(path.join(ROOT, "local")).filter(f => /^official_\d+\.json$/.test(f)).sort()) jobs.push("local/" + f);
let made = 0, kept = 0;
for (const file of jobs) {
  const name = path.basename(file).replace(/\.(gdlvl|json)$/, "");
  if (!force && fs.existsSync(path.join(MAPS, name + ".jpg"))) { kept++; continue; }
  const t0 = Date.now();
  const r = cp.spawnSync(process.execPath, [path.join(__dirname, "levelmap.js"), file, "--name", name], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", windowsHide: true, env: Object.assign({}, process.env, { GDLM_HEAVY_PRIORITY: "low" }) });
  const ok = fs.existsSync(path.join(MAPS, name + ".jpg"));
  if (ok) made++;
  console.log(`${ok ? "made" : "FAILED"} ${name} (${((Date.now() - t0) / 1000).toFixed(0)} s)${ok ? "" : ": " + String(r.stderr || r.stdout).trim().split("\n").pop()}`);
}
console.log(`level maps: ${made} made, ${kept} there already (local/maps/)`);
