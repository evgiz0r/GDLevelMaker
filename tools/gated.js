// node tools/gated.js briefs/<NN_name>.json [--timeout-min 240] [--priority high|normal|low]
//
// A composed build with a user gate after the layout (the user wants to see and steer every build; visuals'
// tools/stages.js and the viewer's ✓ ok / redo). Never holds the heavy lock while waiting:
//   1. node tools/compose.js <brief> --until layout   (a heavy job: variants, the layout with its planned presses,
//      put with gate: true; the plan is saved to local/wip/<session>/<base>.compose_state.json; the job ends)
//   2. wait for the user's answer on the layout stage (tools/stages.js waitApproval: polls a file, no lock)
//   3. ok   -> node tools/compose.js <brief> --resume  (a new heavy job: repair rounds, path, deco, final)
//      redo -> the section at the user's spot (or the note's section name) is rebuilt from another plan
//              (its "reseed:<si>" + 1 in the saved plan), the layout is put again, and it waits again
// The heavy lock is taken by each compose run itself (tools/heavy.js); this driver only starts them.
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, "..");
const args = process.argv.slice(2), briefFile = args.find(a => a.endsWith(".json"));
if (!briefFile) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).slice(0, 12).join("\n")); process.exit(1); }
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const brief = JSON.parse(fs.readFileSync(briefFile, "utf8"));
const { slug } = require("./make.js"), ST = require("./stages.js");
const session = brief.session || "style", base = slug(brief.name);
const stateFile = path.join(ROOT, "local", "wip", session, base + ".compose_state.json");
const env = Object.assign({}, process.env, { GDLM_HEAVY_PRIORITY: opt("--priority", process.env.GDLM_HEAVY_PRIORITY || "normal") });
const run = extra => cp.spawnSync(process.execPath, [path.join(__dirname, "compose.js"), briefFile, ...extra], { stdio: "inherit", env, windowsHide: true }).status;

(async () => {
  if (run(["--until", "layout"]) !== 0) { console.log("compose --until layout failed"); process.exit(2); }
  for (let round = 1; round <= 6; round++) {
    console.log(`waiting for the user on ${brief.name}'s layout (viewer: ⏸ the build waits for you on layout) ...`);
    let r;
    try { r = await ST.waitApproval(session, base, "layout", { timeoutMin: +opt("--timeout-min", 240) }); }
    catch (e) { console.log("no answer: " + e.message + ". The plan stays saved; run node tools/compose.js " + briefFile + " --resume to go on."); process.exit(3); }
    if (r.verdict === "ok") { console.log("the user: ok" + (r.note ? ` (${r.note})` : "") + " -- resuming"); process.exit(run(["--resume"]) || 0); }
    // redo: which section? the spot's x, else a section named in the note, else every important one
    const st = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    const C = require("./compose.js"), { ranges } = C.compose(brief, st.tweaks);
    let si = r.spot && r.spot.x != null ? ranges.findIndex(rg => r.spot.x >= rg[2] * 30 && r.spot.x < rg[3] * 30) : -1;
    if (si < 0 && r.note) si = brief.sections.findIndex(s => r.note.toLowerCase().includes(s.name.toLowerCase()));
    const which = si >= 0 ? [si] : brief.sections.map((s, i) => i).filter(i => brief.sections[i].use && !brief.sections[i].rest);
    for (const i of which) st.tweaks["reseed:" + i] = (st.tweaks["reseed:" + i] || 0) + 1;
    st.redo = (st.redo || []).concat([{ at: new Date().toISOString(), note: r.note || "", spot: r.spot || null, sections: which.map(i => brief.sections[i].name) }]);
    fs.writeFileSync(stateFile, JSON.stringify(st, null, 1));
    console.log(`the user: redo${r.note ? ` ("${r.note}")` : ""} -- rebuilding ${which.map(i => brief.sections[i].name).join(", ")} from another plan`);
    // the layout again from the changed plan (compose --until layout with the saved tweaks: --resume skips the variants)
    if (run(["--resume", "--until", "layout"]) !== 0) { console.log("compose failed on the redo"); process.exit(2); }
  }
  console.log("six redos: stopping here; the plan is saved"); process.exit(4);
})();
