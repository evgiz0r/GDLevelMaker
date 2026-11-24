// node tests/run_player_drawn.js  -- every saved run of every level (local/attempts/, this version's), replayed in the viewer
// as the user sees it (headless, muted, test=1: ?check=runs): the player is drawn on every frame until the run's real end
// (a died run: GD's death %; a clear: the level's end). The user, 2026-11-24: "when i play my replay in clutterfunk my icon
// disappears" -- where our sim lost the run, the replay went on as a camera-only ghost with no player. Skipped when no
// Edge/Chrome is found or there are no runs on this PC.
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
(async () => {
  let headless; try { headless = require("../tools/headless.js").headless; } catch (e) { console.log("skip: " + e.message); return; }
  if (!fs.existsSync(path.join(ROOT, "local", "attempts"))) { console.log("skip: no runs on this PC"); return; }
  const id = "rp" + Date.now().toString(36), done = path.join(ROOT, "local", "tmp", "selfcheck", id + ".json");
  try { await headless(`viewer/?check=runs&id=${id}`, done, { port: 8798, timeoutMs: 15 * 60e3, width: 1280, height: 720 }); }
  catch (e) { console.log("skip: " + e.message); return; }
  if (!fs.existsSync(done)) { console.log("FAIL the page did not answer the check"); process.exit(1); }
  const rows = JSON.parse(fs.readFileSync(done, "utf8")); try { fs.unlinkSync(done); } catch (e) {}
  let bad = 0;
  for (const r of rows) {
    if (r.skip) { console.log(`skip ${r.level}: ${r.skip}`); continue; }
    const ok = !r.fail && r.missing === 0 && r.reachesEnd;
    if (!ok) bad++;
    console.log(`${ok ? "ok  " : "FAIL"} ${r.level} run ${r.run} (${r.result} ${r.pct}%): ${r.fail || `player drawn ${r.frames - r.missing}/${r.frames} frames${r.firstMissing != null ? ", first missing at " + r.firstMissing + " s" : ""}${r.reachesEnd ? "" : ", stops before the run's real end"}`}`);
  }
  console.log(rows.length ? (bad ? bad + " failed" : "all passed") : "no runs at this version");
  process.exit(bad ? 1 : 0);
})();
