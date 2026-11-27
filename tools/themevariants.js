// node tools/themevariants.js [--skies 0,1,2] [--bds a,b,c]   (~4 min a combo, measured: make --look + cards)
// Every theme card in every sky x background (Evgeni 2026-11-27: "how long to change background? dont want to send build
// everytime"): for each combo the gallery is rebuilt with that pick for every theme (GDLM_THEME_PICK, tools/designthemes.js
// picks), its theme cards are copied to local/designs/cards/theme-<name>-s<sky><bd>.jpg, and the catalogue card swaps the
// picture when he taps a chip (tools/designs_tab.js). The last pass rebuilds with the saved picks, so the gallery level is
// left as it was.
"use strict";
const { execFileSync } = require("child_process"), fs = require("fs"), path = require("path");
const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf("--" + k); return i >= 0 ? a[i + 1] : d; };
const skies = arg("skies", "0,1,2").split(",").map(Number), bds = arg("bds", "a,b,c").split(","), R = path.join(__dirname, "..");
const DIR = path.join(R, "local", "designs", "cards"), run = (env, ...args) => execFileSync("node", args, { cwd: R, env: Object.assign({}, process.env, env), stdio: "inherit", windowsHide: true });
for (const sky of skies) for (const bd of bds) {
  const t0 = Date.now(), env = { GDLM_THEME_PICK: sky + "," + bd };
  run(env, "tools/designthemes.js", "spec"); run(env, "tools/make.js", "specs/lab_design_themes.json", "--look"); run(env, "tools/designs.js", "cards", "--themes");
  for (const f of fs.readdirSync(DIR).filter(f => /^theme-[^-]+\.jpg$/.test(f) || /^theme-[a-z0-9]+\.jpg$/.test(f))) fs.copyFileSync(path.join(DIR, f), path.join(DIR, f.replace(/\.jpg$/, `-s${sky}${bd}.jpg`)));
  console.log(`variants: sky ${sky} background ${bd} done in ${Math.round((Date.now() - t0) / 1000)} s`);
}
run({}, "tools/designthemes.js", "spec"); run({}, "tools/make.js", "specs/lab_design_themes.json", "--look"); run({}, "tools/designs.js", "cards", "--themes");
