// node tools/uninstall.js --keep "GDLM 44 hellgate" --keep "GDLM 77 ..." [--keep-prefix "GDLM auto "] [--dry] [--save <path>] [--wait-close]
//
// Clears our levels out of the user's My Levels (Evgeni 2026-11-28: "remove all the other garbage level hanging there, we
// will install when we need (besides the already shared one)"). Removes only levels whose name starts with "GDLM ",
// never one that has an online ID (k1: shared, e.g. the phone slot -- PUBLISH.md; the 2026-11-24 cleanup lost the slot's
// ID that way), never one named by --keep / --keep-prefix, and never any of the user's own (non-GDLM) levels.
// GD must be closed (it rewrites the save on exit); --wait-close waits for GD to exit, then runs. Backs the save up to
// GeometryDash\gdlm_backups\ first (restore = copy it back). Also drops removed names still waiting in the running-game
// install inbox, so the mod does not put them back at the next start. Every level is in the repo: install.js brings any back.
"use strict";
const fs = require("fs"), path = require("path");
const I = require("./install.js");
const args = process.argv.slice(2);
const many = k => args.map((a, n) => (args[n - 1] === k ? a : null)).filter(a => a !== null);
const keep = new Set(many("--keep")), keepPre = many("--keep-prefix"), dry = args.includes("--dry");
const si = args.indexOf("--save");
const save = si >= 0 ? args[si + 1] : path.join(require("./gdpaths.js").SAVE, "CCLocalLevels.dat");

function run() {
  if (!dry && si < 0 && I.gameRunning()) { console.log("GD is running: close it first (it rewrites the save on exit), or pass --wait-close"); process.exit(3); }
  const xml = I.decodeSave(fs.readFileSync(save));
  const parts = I.splitLevels(xml);
  if (I.joinLevels(parts) !== xml) throw new Error("save did not split/join cleanly; refusing to touch it");
  const removed = [], kept = [];
  parts.items = parts.items.filter(it => {
    const name = I.nameOf(it.inner), online = /<k>k1<\/k><i>\d+<\/i>/.test(it.inner);
    const ours = name.startsWith("GDLM ");
    if (!ours || online || keep.has(name) || keepPre.some(p => name.startsWith(p))) { kept.push(name + (online ? " (shared)" : "")); return true; }
    removed.push(name); return false;
  });
  console.log(`remove (${removed.length}): ${removed.join(" | ")}`);
  console.log(`keep (${kept.length}): ${kept.join(" | ")}`);
  const out = I.joinLevels(parts), enc = I.encodeSave(out);
  if (I.decodeSave(enc) !== out) throw new Error("re-encoded save does not decode back; not writing");
  if (dry) { console.log("dry run: nothing written"); return; }
  const bdir = path.join(path.dirname(save), "gdlm_backups");
  fs.mkdirSync(bdir, { recursive: true });
  const backup = path.join(bdir, `CCLocalLevels.${new Date().toISOString().replace(/[:.]/g, "-")}.dat`);
  fs.copyFileSync(save, backup);
  fs.writeFileSync(save, enc);
  console.log(`written. backup: ${backup}`);
  if (si < 0) try { const gone = require("./hotinstall.js").dropPending(removed); if (gone.length) console.log(`dropped inbox requests: ${gone.join(", ")}`); } catch (e) {}
}
if (args.includes("--wait-close") && !dry) {
  console.log("waiting for GD to close ...");
  const t = setInterval(() => { if (!I.gameRunning()) { clearInterval(t); setTimeout(run, 3000); } }, 5000);
} else run();
