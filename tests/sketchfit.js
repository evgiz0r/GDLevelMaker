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
  ok(Math.abs(sk.items[4].y - (60 + 43)) < 1, "the portal stands on the floor next to it (" + sk.items[4].y + ")");
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
console.log(fail ? fail + " failed" : "all ok"); process.exit(fail ? 1 : 0);
