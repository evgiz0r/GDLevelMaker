// node tools/themedemo.js <theme> [--no-props] [--joined] [--song <custom id>]  -> specs/lab_theme_<theme>.json  (then: node tools/make.js <that spec>)
// One design theme's demo (Evgeni 2026-11-27, on the fiery theme: "lets find some more decorations ... and do we have
// background examples?"): the theme's scene (tools/designthemes.js sceneFor) played three times, each with another of
// its skies and background options (a, b, c) -- the short sample scene, or with --joined the whole theme layout (long) --, its dressed GD props on (tools/themeprops.js), a label over each. One theme
// only, so a change to one theme never rebuilds the whole gallery (Evgeni: "on demand"). Outro + signature.
"use strict";
const fs = require("fs"), path = require("path"), DT = require("./designthemes.js");
const a = process.argv.slice(2), name = a[0];
if (!name || !DT.THEMES[name]) { console.log("usage: node tools/themedemo.js <" + Object.keys(DT.THEMES).join("|") + "> [--no-props]"); process.exit(1); }
const t = DT.THEMES[name], S = a.includes("--joined") ? DT.sceneFor(name) : { sample: DT.SAMPLE, w: DT.SCENE[0].length }, opts = Object.keys(t.backdrops || { a: 1 });
const objects = [`// ${name}: the scene once per background option`], sections = [], labels = [];
let c = 12;
opts.forEach((b, i) => {
  sections.push(Object.assign({ from: c - 6, theme: name, backdrop: b, sky: i % (t.skies || [1]).length }, a.includes("--no-props") ? { props: [] } : {}));
  labels.push([c - 6, `${name} ${b}: ${[].concat(t.backdrops[b]).join(" + ")}`]);
  for (const [kind, dc, r, ex] of S.sample) objects.push(ex ? [kind, c + dc, r, ex] : [kind, c + dc, r]);
  c += S.w + 16;
});
// The theme's own song (Evgeni 2026-11-28: the hellgate lab played Stereo Madness -- a level with no song gets GD's
// default, official song 1). --song <custom id> overrides; a theme with none here keeps no song.
const SONGS = { hellgate: 343707 };
const si = a.indexOf("--song"), songId = si >= 0 ? Number(a[si + 1]) : SONGS[name];
const spec = { name: `GDLM theme ${name}`, desc: `The ${name} design theme with each of its backgrounds and its dressed props (tools/themedemo.js).`,
  colours: { bg: t.skies[0].bg, ground: t.skies[0].ground },
  structures: { sections, ch0: [700, 710, 720, 730, 740], hazCh0: [750, 757, 764, 771, 778], bgCh0: [880, 884, 888, 892, 896], maxLooks: 4 },
  indicators: { all: true, style: [[0, t.indicator]], colour: [[0, "auto"]] },
  scene: "tools/scenes/themegallery.js", labels, outro: 76, signature: {}, objects };
if (songId) spec.song = { custom: songId };
const out = path.join(__dirname, "..", "specs", `lab_theme_${name}.json`);
fs.writeFileSync(out, JSON.stringify(spec, null, 1) + "\n");
console.log(`-> ${out}: ${opts.length} backgrounds, ${c} cols`);
