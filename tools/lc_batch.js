// node tools/lc_batch.js <in.json> <out.json> [--jobs N]  -- tools/layoutcheck.js check() on many section maps at once,
//   one child process per map, N at a time (default: the CPU count - 1, at least 1). in.json = [z, ...] (sectiongen maps
//   with speedName), out.json = [c, ...] in the same order. typebuild.js uses it to check a section's seeds in parallel
//   (`--jobs`): a 3-minute level's sections took ~2.5 h one seed at a time in the cloud (Hellgate full, 2026-11-28).
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), { fork } = require("child_process");
if (process.argv[2] === "--child") {
  process.on("message", z => { const c = require("./layoutcheck.js").check(z); process.send(c); process.exit(0); });
} else {
  const a = process.argv.slice(2), zs = JSON.parse(fs.readFileSync(a[0], "utf8"));
  const ji = a.indexOf("--jobs"), N = Math.max(1, ji >= 0 ? +a[ji + 1] : os.cpus().length - 1);
  const out = new Array(zs.length).fill(null); let next = 0, live = 0;
  const go = () => {
    while (live < N && next < zs.length) {
      const i = next++; live++;
      const ch = fork(__filename, ["--child"], { windowsHide: true, env: Object.assign({}, process.env, { GDLM_HEAVY: "off" }) });
      ch.on("message", c => { out[i] = c; });
      ch.on("exit", () => { live--; if (!out[i]) out[i] = { ok: false, why: "check crashed" }; if (next >= zs.length && live === 0) fs.writeFileSync(a[1], JSON.stringify(out)); else go(); });
      ch.send(zs[i]);
    }
  };
  if (!zs.length) fs.writeFileSync(a[1], "[]"); else go();
}
