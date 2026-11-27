// node tools/zoomlab.js [--zoom 0.8] [--rows 14] [--seed 3]  -> specs/lab_zoom_out.json (then: node tools/make.js specs/lab_zoom_out.json)
// Lab for a zoomed-out camera over tall gameplay (Evgeni 2026-11-27: "maybe we need to zoom out a bit to allow bigger
// gameplay ... that way we can use more height of the screen"). The same tall cube climb is played twice: first at the
// normal zoom, then under a GD camera zoom trigger (1913, key 371 = zoom) at --zoom, back to 1 at its end, so the two can
// be compared in the game. The climb is a generated staircase (tools/sectiongen.js) going up, then the same mirrored back
// down. Ends with the outro and the Claude signature. Open: does the zoom read well on the phone; how far is too far.
const fs = require("fs"), path = require("path");
const SG = require("./sectiongen.js"), LC = require("./layoutcheck.js");
const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf("--" + k); return i >= 0 ? a[i + 1] : d; };
const ZOOM = +arg("zoom", 0.8), ROWS = +arg("rows", 14), SEED = +arg("seed", 3);

const up = SG.make("staircase", { cols: 50, rows: ROWS, seed: SEED, tier: "normal" }).map;
const flip = { "/": "\\", "\\": "/", "7": "r", "r": "7" };
const down = up.map(l => [...l].reverse().map(ch => flip[ch] || ch).join(""));
const hill = up.map((l, i) => l + down[i]);                 // up, then down: one tall hill
const flat = up.map((l, i) => (i === up.length - 1 ? "#" : ".").repeat(12));
const map = hill.map((l, i) => l + flat[i] + hill[i]);       // the hill at zoom 1, a breather, the hill zoomed out
const z = { key: "zoomlab", name: "zoom lab", mode: "cube", map };
const S = LC.specOf(z), W1 = hill[0].length;
const zoomAt = (col, to) => [1913, col, ROWS + 2, { props: { 10: "0.6", 30: "0", 36: "1", 85: "2", 371: String(to) } }];
const c0 = S.x0 + W1 + 12;                                   // the second hill's first column
S.spec.objects.push(zoomAt(c0 - 4, ZOOM), zoomAt(c0 + W1 + 2, 1));
Object.assign(S.spec, { name: "GDLM lab zoom out", desc: `Lab: the same tall climb twice, the second under a camera zoom of ${ZOOM} (Claude, 2026-11-27). Does the zoomed-out one read better?`,
  outro: 43, signature: {}, sightread: false, structures: false });
const out = path.join(__dirname, "..", "specs", "lab_zoom_out.json");
fs.writeFileSync(out, JSON.stringify(S.spec, null, 1) + "\n");
console.log(`-> ${out}: ${map[0].length} cols, ${ROWS} rows, zoom ${ZOOM} from col ${c0 - 4} to ${c0 + W1 + 2}`);
