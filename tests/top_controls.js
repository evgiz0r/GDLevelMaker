// node tests/top_controls.js  -- every control of the viewer is in the top bar (VIEWER.md "Controls only at the top"; the
// user, 2026-11-24: "i cant have buttons in the bottom, only in the top ui"). Two parts:
// 1. the page's own HTML: no <button>, <select>, <input> or <textarea> outside <header> and the overlays (picker, work
//    panel, task box, note box), except the timeline slider #scrub;
// 2. headless (tools/headless.js, a muted test page): the viewer opened on levels with runs, build stages and marks, a
//    run picked, lists every control on the page outside the top bar and the overlays (?check=controls -> POST
//    /selfcheck); none may be there, and "compare" is greyed until a run is picked. Skipped when no Edge/Chrome is found.
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let bad = 0; const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) bad++; };
// 1. static
{
  const html = fs.readFileSync(path.join(ROOT, "viewer", "index.html"), "utf8"), body = html.slice(html.indexOf("</header>"), html.indexOf("<script"));
  const cut = body.replace(/<div id="(picker|workBox|taskBox|noteBox)"[\s\S]*?<\/div><\/div><\/div>/g, "").replace(/<div id="(picker|workBox|taskBox|noteBox)"[\s\S]*?<\/div><\/div>/g, "");
  const left = [...cut.matchAll(/<(button|select|input|textarea)\b[^>]*>/g)].map(m => m[0]).filter(t => !/id="scrub"/.test(t) && !/type="file"/.test(t));
  // the recording compare's bar is moved into the header at start (viewer: "Every control lives in the top bar")
  const moved = left.filter(t => !/data-dt=|id="cmp(Rec|T0|Shot)"/.test(t));
  check(moved.length === 0, "the page's HTML has no control under the top bar" + (moved.length ? ": " + moved.join(" ") : ""));
}
// 2. headless
(async () => {
  let headless; try { headless = require("../tools/headless.js").headless; } catch (e) {}
  const pages = [["official 10 with runs", "local/official_10.json"], ["a build with stages", null], ["a level of ours", "levels/archive/gdlm_45_first_flight.gdlvl"]];
  // a build with stages, from the shared wip folder when there is one
  try { const wip = path.join(ROOT, "local", "wip"); for (const s of fs.readdirSync(wip)) { let fl = []; try { fl = fs.readdirSync(path.join(wip, s)); } catch (e) { continue; } for (const f of fl) if (f.endsWith(".stages") && !pages[1][1]) pages[1][1] = `local/wip/${s}/${f.replace(/\.stages$/, ".gdlvl")}`; } } catch (e) {}   // listed from its stages even before a wip put
  for (const [what, file] of pages) {
    if (!file || !/\/wip\//.test(file) && !fs.existsSync(path.join(ROOT, file))) { console.log(`skip ${what} (not on this PC)`); continue; }
    const id = "tc" + Date.now().toString(36), done = path.join(ROOT, "local", "tmp", "selfcheck", id + ".json");
    let r; try { r = await headless(`viewer/?check=controls&id=${id}#lv=${encodeURIComponent(file)}`, done, { port: 8797, timeoutMs: 60e3, width: 1280, height: 800 }); }
    catch (e) { console.log("skip the headless part: " + e.message); break; }
    if (!fs.existsSync(done)) { check(false, `${what}: the page answered the check (${file})`); continue; }
    const o = JSON.parse(fs.readFileSync(done, "utf8")); try { fs.unlinkSync(done); } catch (e) {}
    check(o.bad.length === 0, `${what} (${o.level}): no control outside the top bar${o.bad.length ? ": " + o.bad.join(", ") : ""}`);
    check(o.ghost || o.compareDisabled, `${what}: compare is ${o.ghost ? "on offer with a run picked" : "greyed with no run"}`);
  }
  // the header never covers the level, and is one row of controls from 800 px up (the user: "the menu on the top still
  // hides the view of the game"); a phone may take two rows, still above the level
  for (const w of [375, 800, 1200]) {
    const id = "tw" + w + Date.now().toString(36), done = path.join(ROOT, "local", "tmp", "selfcheck", id + ".json");
    try { await headless(`viewer/?check=controls&id=${id}#lv=${encodeURIComponent("local/official_16.json")}`, done, { port: 8797, timeoutMs: 60e3, width: w, height: 800 }); } catch (e) { console.log("skip widths: " + e.message); break; }
    if (!fs.existsSync(done)) { check(false, `${w} px: the page answered`); continue; }
    const o = JSON.parse(fs.readFileSync(done, "utf8")); try { fs.unlinkSync(done); } catch (e) {}
    check(o.headerBottom <= o.canvasTop && (w < 800 || o.headerRows === 1), `${w} px wide: the header ends at ${o.headerBottom} px, the level starts at ${o.canvasTop} px; ${o.headerRows} row(s) of controls`);
  }
  console.log(bad ? `${bad} failed` : "all passed"); process.exit(bad ? 1 : 0);
})();
