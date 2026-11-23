// node tools/snip.js --out page.html "<title>|<before.gdlvl>|<after.gdlvl>|<fromBlock>|<toBlock>|<note>" [...]
//
// Before/after pictures of stretches of a level, as shapes (blocks, spikes, orbs, pads, portals) with the
// player's route over them (the saved solution's natural replay; a dot per press), in one self-contained
// page (no GD art: it can go on the phone). Each argument is one pair; "-" for a missing before/after.
// Uses tools/structures.js's drawing. For the user's notes on a level: what was there, what is there now.
"use strict";
const fs = require("fs"), path = require("path");
const { GD, readGdlvl } = require("./io.js");
const { svgOf } = require("./structures.js");

function picOf(file, a, b) {
  const L = readGdlvl(file), sol = require("./solutions.js").get(L.levelStr);
  if (!sol || !sol.events) throw new Error(`${file}: no saved solution (node tools/solutions.js ${file})`);
  const w = GD.makeWorld(L.level.objects, L.level.header), p = GD.run(w, sol.events).path;
  const x0 = a * 30, x1 = b * 30;
  return { name: L.name, pic: { x0, x1,
    objects: L.level.objects.filter(o => o.x >= x0 - 15 && o.x <= x1 + 15 && GD.objInfo(o.id).kind !== "decoration").map(o => [o.id, o.x, o.y, o.rot || 0, o.flipY ? 1 : 0]),
    path: p.filter((q, i) => q.x >= x0 && q.x <= x1 && i % 3 === 0).map(q => [Math.round(q.x), Math.round(q.y), q.mode]),
    presses: sol.events.filter(e => e.type === "press" && p[e.tick] && p[e.tick].x >= x0 && p[e.tick].x <= x1).map(e => [Math.round(p[e.tick].x), Math.round(p[e.tick].y)]) } };
}

if (require.main === module) {
  const args = process.argv.slice(2), oi = args.indexOf("--out");
  const out = oi >= 0 ? args[oi + 1] : path.join(__dirname, "..", "local", "shots", "snip.html");
  const pairs = args.filter((x, i) => x.includes("|") && i !== oi + 1);
  if (!pairs.length) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).slice(0, 6).join("\n")); process.exit(1); }
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const draw = (f, a, b) => { if (f === "-") return `<p class="none">(none)</p>`; const r = picOf(f, a, b); return svgOf({ id: r.name, pic: r.pic }, GD); };
  const cards = pairs.map(s => {
    const [title, before, after, a, b, note] = s.split("|");
    return `<section class="pair"><h2>${esc(title)}</h2>${note ? `<p class="note">${esc(note)}</p>` : ""}
<div class="row"><figure><figcaption>before</figcaption><div class="pic">${draw(before, +a, +b)}</div></figure>
<figure><figcaption>after</figcaption><div class="pic">${draw(after, +a, +b)}</div></figure></div></section>`;
  }).join("\n");
  const html = `<title>GDLM Before After</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* layout: one column of before/after pairs, each pair two pictures side by side (stacked on a phone) */
:root{--bg:#f3f4f7;--card:#fff;--ink:#1b1d24;--mute:#626775;--line:#dfe2ea;--sky:#e8f0fb;--ground:#b9bfcc;--block:#3d4658;--haz:#d8324a}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#12141a;--card:#1b1e27;--ink:#e9ebf1;--mute:#9aa0ae;--line:#2b2f3b;--sky:#172131;--ground:#3b4150;--block:#97a3bb;--haz:#ff5a6e;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#12141a;--card:#1b1e27;--ink:#e9ebf1;--mute:#9aa0ae;--line:#2b2f3b;--sky:#172131;--ground:#3b4150;--block:#97a3bb;--haz:#ff5a6e;color-scheme:dark}
body{background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
main{max-width:1000px;margin:0 auto;padding-block:16px 32px;display:flex;flex-direction:column;gap:14px}
h1{font-size:22px;margin:8px 0 0}h2{font-size:16px;margin:0}.note{color:var(--mute);margin:4px 0 8px;max-width:70ch}
.pair{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px}
.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media (max-width:640px){.row{grid-template-columns:1fr}}
figure{margin:0;min-width:0}figcaption{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--mute);margin-bottom:4px}
.pic{background:var(--sky);border-radius:6px;overflow:hidden}.pic svg{display:block;width:100%;height:auto}
.g{fill:var(--ground)}.b{fill:var(--block)}.h{fill:var(--haz)}.o{stroke:var(--ink);stroke-opacity:.25;stroke-width:2}.p{fill:var(--card);stroke:var(--ink);stroke-width:3}.none{color:var(--mute);padding:12px;margin:0}
</style>
<main><h1>Before and after</h1><p class="note">Shapes only: blocks, spikes (red), orbs and pads in their colours, portals as rings. The line is the route a player takes (green cube, pink ship, red ball, blue wave); white dots are presses.</p>
${cards}
</main>`;
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, html); console.log("->", out);
}
module.exports = { picOf };
