// node tests/sketchfit.js -- the layout fitter (lib/sketchfit.js, DRAW.md "The layout fitter") on small drawn sketches:
// a ground line over things is a ceiling, floating spikes get a block, portals go onto the floor, a slightly-off
// mark is timed, an orb off the path is pulled onto it, and a sketch that cannot play says where and why.
const F = require("../lib/sketchfit.js");
let fail = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fail++; };
const line = (pen, pts) => ({ k: "stroke", pen, pts });

// 1. reading: ceiling vs floor, spikes, portal
{
  const sk = { v: 1, speed: 1, items: [line("ground", [[300, 200], [700, 205]]), { k: "stamp", what: "orb:yellow", x: 500, y: 90 },
    line("ground", [[800, 58], [1100, 62]]), line("spikes", [[1300, 95], [1400, 92]]), { k: "stamp", what: "portal:ship", x: 900, y: 140 }] };
  const ch = []; F.tidy(sk, ch);
  ok(sk.items[0].role === "ceiling" && sk.items[2].role === "floor", "a line with an orb under it is a ceiling, the other a floor");
  ok(sk.items[0].built.every(b => b.y >= 200), "the ceiling's blocks are above its line");
  ok(sk.items[3].built.some(b => b.id === 1) && sk.items[3].built.some(b => b.id === 8), "a floating spike line gets blocks under it");
  ok(Math.abs(sk.items[4].y - (60 + 60)) < 1, "the ship portal sits where a player on the floor still touches it, so its band starts there (" + sk.items[4].y + ")");
}
// 2. a mark drawn a bit late over spikes: timed, clears, the mark kept
{
  const sk = { v: 1, speed: 1, items: [line("spikes", [[400, 2], [460, 2]]), { k: "press", x: 400, y: 300 }] };
  const r = F.fit(sk);
  ok(r.clear && r.presses === 1, `one mark a bit late over two spikes: clears with 1 press (${r.clear}, ${r.presses}, ${r.changes.map(c => c.text).join("; ")})`);
}
// 3. an orb drawn off the path: pulled onto it
{
  const sk = { v: 1, speed: 1, items: [line("spikes", [[300, 2], [700, 2]]), { k: "press", x: 270 }, { k: "stamp", what: "orb:yellow", x: 470, y: 190 }, { k: "press", x: 460 }] };
  const r = F.fit(sk);
  ok(r.clear, "a jump, an orb drawn too high, a second jump: clears (" + r.changes.map(c => c.mark + " " + c.text).join("; ") + ")");
}
// 4. impossible: a wall of spikes with no marks after the limit -> stops and says where
{
  const sk = { v: 1, speed: 1, items: [line("platform", [[300, 15], [300, 400]])] };
  const r = F.fit(sk, { maxRemove: 2 });
  ok(!r.clear ? r.changes.some(c => /stopped here|taken out/.test(c.text)) : true, "a wall it cannot get past: it says where (" + (r.clear ? "cleared" : "block " + (r.dieX / 30).toFixed(1)) + ")");
}
{ // one-tap choices: a ✕ / ~ carries plain ops; "📌 keep mine" pins the piece and the next fit leaves it alone
  const sk = { v: 1, speed: 1, items: [line("ground", [[0, 0], [900, 0]]), { k: "stamp", what: "orb:yellow", x: 400, y: 200 }, { k: "press", x: 380, y: 60 }, line("spikes", [[420, 0], [480, 0]])] };
  const r = F.fit(sk), withC = r.changes.filter(c => (c.choices || []).length);
  ok(withC.length === r.changes.filter(c => c.mark).length - r.changes.filter(c => c.mark && c.x == null).length, `every placed change offers a choice (${withC.length}/${r.changes.length})`);
  const mv = r.changes.find(c => c.item === 1 && c.choices);
  if (mv) { F.apply(sk, mv.choices.find(c => c.ops[0].op === "pin").ops); const r2 = F.fit(sk);
    ok(sk.items[1].pin && !r2.changes.some(c => c.item === 1 && c.mark === "~"), "a pinned orb is not moved again"); }
  F.apply(sk, [{ op: "press", x: 300 }, { op: "delete", item: 2 }]);
  ok(sk.items.filter(i => i.k === "press").length === 1 && sk.items.some(i => i.k === "press" && i.x === 300), "apply: add a jump, delete a mark");
}
{ // the spikes pen means any hazard: three short spike runs, one jump each -> spikes, kill-ground and saws, and it still clears
  const sk = { v: 1, speed: 1, items: [line("ground", [[0, 0], [1500, 0]]), line("spikes", [[300, 0], [330, 0]]), { k: "press", x: 270 }, line("spikes", [[600, 0], [630, 0]]), { k: "press", x: 570 },
    line("spikes", [[900, 0], [930, 0]]), { k: "press", x: 870 }] };
  const r = F.fit(sk), ids = new Set(r.level.play.map(o => o.id));
  const mix = r.changes.find(c => /mix of hazards/.test(c.text));
  ok(r.clear && mix && (ids.has(9) || ids.has(89) || ids.has(98)) && ids.has(8), `spikes become a mix of hazards and the marks still clear it (${[...ids].join(",")}; ${mix && mix.text})`);
  if (mix) { F.apply(sk, mix.choices[0].ops); const r2 = F.fit(sk); ok(!r2.level.play.some(o => [9, 89, 98].includes(o.id)), "▲ spikes only: back to spikes"); }
}
console.log(fail ? fail + " failed" : "all ok"); process.exit(fail ? 1 : 0);
