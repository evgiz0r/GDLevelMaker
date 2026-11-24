// node tools/lab67.js  -- writes specs/67_physics_questions_lab.json: GDLM 67, the lab level for the physics questions
//   still open on 2026-11-24 (PHYSICS.md "Landing buffer", "GDLM 60 physics lab", "Moving objects", "Dual", the
//   official re-solves). Then: node tools/make.js specs/67_physics_questions_lab.json.
// Each numbered station asks ONE question: its label says what to do, its note says what the sim predicts. A run of
// it (practice mode, hitboxes on, the input logger and sound on: tools/record.sh) answers them; a death where the sim
// says "lives" (or the other way round) is a calibration fact. Every station has a RULER beside it (deco squares a
// block apart, rows 0-9): heights are read against the ruler in the same frame, never the screen (GD's camera moves:
// PHYSICS.md "Fidelity" blocker). Stations whose answer is a choice ("does it land?", "does the marker rise?") never
// kill either way. Read it: tools/replay_run.js (inputs) and tools/lab_read.js --spec specs/67_physics_questions_lab.json.
const fs = require("fs"), path = require("path");
const b64 = s => Buffer.from(s).toString("base64");
const objs = [], lab = [];
let col = 22;   // GD's "Attempt N" text covers the first ~12 blocks (a label must start after it)
const label = (c, text, row = 6.5) => objs.push([914, c, row, { props: { "31": b64(text), "32": "0.5" } }]);
const ruler = (c, from = 0, to = 9) => { for (let r = from; r <= to; r++) objs.push([211, c, r]); };
const trig = (id, c, row, props, extra) => objs.push([id, c, row, Object.assign({ props }, extra || {})]);
const station = (name, width, metrics, note, build) => {
  const n = lab.length + 1, from = col;
  build(col, n);
  lab.push({ n, name, from, to: from + width, metrics: typeof metrics === "function" ? metrics(from) : metrics, note });
  col += width;
};
const CUBE = 12, SHIP = 13, BALL = 47, UFO = 111, ROBOT = 745, SPIDER = 1331, SWING = 1933, WAVE = 660, MINI = 101, NORMAL = 99;
const portal = (id, c, row = 1) => objs.push([id, c, row]);

// ---- landing buffer: how long is a press made in the air kept? (sim: falling = until landing, rising = 40 ticks)
// A spike to jump, then a spike right where the cube lands: only a jump ON landing clears it. Jump the first spike and
// tap AGAIN once in the air as the label says, then do not press: a buffered press jumps the second spike.
const bufferStation = (when, note) => station(`landing buffer: tap again ${when}`, 18, [{ m: "alive" }], note, c => {
  label(c, `${lab.length + 1} jump, tap again ${when}, then NO press`);
  objs.push(["spike", c + 6, 0], ["spike", c + 10, 0]);   // a jump from +3.4..+5.2 lands +7.9..+9.7; a jump there clears +10, walking on hits it
  ruler(c + 15, 0, 5);
});
bufferStation("EARLY (going up)", "a tap ~0.1 s after the jump, still rising, ~0.35 s before landing: sim keeps a rising press 40 ticks (0.17 s) -> it has run out: DIES at the second spike. Lives = the game keeps rising presses longer");
bufferStation("AT THE TOP", "a tap at the peak (vy ~0): sim treats it as falling -> kept until landing: LIVES. Dies = the falling threshold is after the peak");
bufferStation("on the way DOWN", "a tap while falling: sim keeps it until landing (seen twice in Clutterfunk) -> LIVES");

// ---- orb hold (GDLM 63 stations 9/11 left it open: the user tapped). A roof after the jump's apex stops a fresh jump
// from clearing the pit on its own; holding the jump's press through the orb is the only way over.
station("orb: hold the jump into the orb", 16, [{ m: "alive" }], "jump and keep HOLDING into the yellow orb: sim: a press held since the ground jump does NOT fire the orb (it was used up by the jump) -> falls in the pit. Lives = the game fires an orb on a held press", c => {
  label(c, `${lab.length + 1} jump and HOLD into the orb, never release`);
  objs.push([36, c + 8, 2]);
  for (let k = c + 7; k <= c + 10; k++) objs.push(["spike", k, 0]);
  for (let k = c + 9; k <= c + 12; k++) objs.push(["block", k, 5]);
  ruler(c + 14, 0, 5);
});

// ---- pink orb from the ground, mid-air green orb: launch speeds against a ruler (GDLM 60 left pink at 0.5-0.63 vs sim 0.72)
station("pink orb launch", 14, c => [{ m: "launch", at: c + 5 }], "walk under the pink orb and tap it once: sim launches at 0.72 of a ground jump (apex ~2.1 blocks over the orb). Read the apex on the ruler", c => {
  label(c, `${lab.length + 1} pink orb: one tap, read the top on the ruler`);
  objs.push([141, c + 5, 1]); ruler(c + 8, 0, 9);
});
station("green orb in the air", 18, c => [{ m: "launch", at: c + 6 }, { m: "alive" }], "jump, tap the green orb at the top of the jump: sim flips gravity and throws the cube DOWN first (away from its new floor, the roof), then it falls up to the roof; the gravity portal under the roof brings it back", c => {
  label(c, `${lab.length + 1} jump, tap the green orb at the top`);
  objs.push([1022, c + 6, 3]);
  for (let k = c + 4; k <= c + 14; k++) objs.push(["block", k, 8]);
  objs.push([10, c + 12, 6]);
  ruler(c + 9, 0, 7);
});

// ---- ship: where it rests and slides (Stereo Madness ~0.5 unit low, Back On Track ~1 block high after a slide)
station("ship heights: floor, roof, slide", 46, c => [{ m: "yAt", at: [c + 12, c + 22, c + 31, c + 40] }, { m: "alive" }], "ship: 1) let go and rest on the floor, 2) hold and ride the roof, 3) let go onto the long block, slide off its end. Read each height on the rulers: sim (lab67.js --check) rests at y 15 on the floor, ~272 held under the band roof, ~118 riding the block (top 90), and is back on the floor (~20) by the last ruler. Back On Track ends ~1 block high after a slide", c => {
  label(c, `${lab.length + 1} ship: rest on floor, hold to roof, slide on block`);
  portal(SHIP, c + 2);
  ruler(c + 12, 0, 9);
  ruler(c + 22, 0, 9);
  for (let k = c + 26; k <= c + 34; k++) objs.push(["block", k, 2]);
  ruler(c + 31, 0, 9); ruler(c + 40, 0, 9);
  portal(CUBE, c + 44);
});
station("ship corridor", 26, [{ m: "alive" }], "ship in a 3-block corridor with spikes top and bottom (Stereo Madness's ship stretch clears only with 14-18 presses a second in the sim): fly it the way you naturally would; the input log shows whether a person needs that many", c => {
  label(c, `${lab.length + 1} ship corridor: fly it naturally`);
  portal(SHIP, c + 2);
  for (let k = c + 6; k <= c + 20; k++) { objs.push(["spike", k, 0], ["block", k, 4], ["spike", k, 3, { rot: 180 }]); }
  ruler(c + 22, 0, 9);
  portal(CUBE, c + 24);
});

// ---- mini cube: can it jump onto a step whose top is 56 up? (Dash's invisible platforms: sim says a mini jump's
// feet peak at 40.7, so it needs a top <= 55.7; a normal cube reaches 63.9). Never kills.
station("mini step", 20, c => [{ m: "yAt", at: [c + 9.5] }], "mini cube: jump at the low step (top 56 units, under 2 blocks): sim says the mini cube CANNOT land on it (peaks 4.3 short with the 15-unit snap). Landing on it = the mini jump or snap is bigger in the game", c => {
  label(c, `${lab.length + 1} mini: try to jump ONTO the step`);
  portal(MINI, c + 2);
  objs.push(["block", c + 9, 0.8667], ["block", c + 10, 0.8667]);
  ruler(c + 12, 0, 4);
  portal(NORMAL, c + 17);
});

// ---- modes nobody has measured in the user's game: UFO, robot, spider, swing. GDLM 60 passed them but the tracker lost
// the small icons; here each has a ruler in every frame and a plain open stretch.
for (const [id, name, what] of [[UFO, "UFO", "tap 3 times, slow, read each top on the ruler: sim flaps to 7 units/tick (apex ~2.3 blocks above a flap from rest)"],
  [ROBOT, "robot", "one long HOLD from the ground: sim hovers 67 ticks (0.28 s) then falls; jump 0.5x a cube's"],
  [SPIDER, "spider", "tap once, then once more: sim teleports to the roof and back (instant)"],
  [SWING, "swing", "tap 4 times, slowly: sim flips gravity a tick after each press, vy x0.8"]]) {
  station(`${name}: free flight`, 22, [{ m: "accel" }, { m: "alive" }], `${name}: ${what}`, c => {
    label(c, `${lab.length + 1} ${name}: ${what.split(":")[0]}`);
    portal(id, c + 2);
    ruler(c + 8, 0, 9); ruler(c + 14, 0, 9);
    portal(CUBE, c + 20);
  });
}

// ---- triggers (the dual/moving-objects session's code): what does the game do?
// a) a touch trigger's box grows with its scale (fixed in the sim 2026-11-24 from Dash): two invisible touch triggers 31
//    units above the walking cube's centre, one scaled 1.2 in y: sim: only the scaled one moves its red block up
station("touch trigger scale", 20, [{ m: "alive" }], "walk under both (no jump): sim: the LEFT block (its touch trigger scaled 1.2) rises 2 blocks, the RIGHT one (unscaled, same height) stays. Both rise = GD's touch box is bigger; neither = smaller", c => {
  label(c, `${lab.length + 1} walk, no jump: which block rises?`);
  trig(901, c + 4, 46 / 30 - 0.5, { "51": "71", "29": "60", "10": "0.3", "11": "1", "129": "1.2" });
  trig(901, c + 9, 46 / 30 - 0.5, { "51": "72", "29": "60", "10": "0.3", "11": "1" });
  objs.push(["block", c + 12, 3, { group: 71 }], ["block", c + 16, 3, { group: 72 }]);
  ruler(c + 14, 0, 6);
});
// b) a collision trigger (1815): a block with collision block A drops onto collision block B; the trigger spawns the group
//    of a move that raises a marker. The sim does NOT model collision blocks: it says the marker stays.
station("collision trigger", 24, [{ m: "alive" }], "watch the falling block meet the low one: sim: nothing happens (collision blocks not modelled). If the marker rises when they meet, GD's collision trigger SPAWNS its target group (Dash's spike drop uses it)", c => {
  label(c, `${lab.length + 1} watch: does the marker rise when they meet?`);
  trig(1815, c + 1, 9, { "80": "1", "95": "2", "51": "75", "56": "1" });
  objs.push([1816, c + 14, 6, { group: 73, props: { "80": "1", "94": "1" } }], ["block", c + 14, 6, { group: 73 }]);
  objs.push([1816, c + 14, 1, { props: { "80": "2" } }], ["block", c + 14, 1]);
  trig(901, c + 2, 9, { "51": "73", "29": "-120", "10": "1.5" });
  trig(901, c + 3, 8, { "51": "74", "29": "60", "10": "0.3", "62": "1" }, { group: 75 });
  objs.push(["block", c + 20, 3, { group: 74 }]);
  ruler(c + 17, 0, 7);
});
// c) a stop trigger stops the moves of the triggers IN its target group (Dash 107.5 relies on it)
station("stop trigger", 24, [{ m: "alive" }], "watch the rising block: a move (in group 76) lifts it 4 blocks over 3 s; a stop trigger on group 76 fires halfway through: sim: it STOPS about halfway (y ~163, 2 blocks up). Rising all the way = GD's stop acts on something else", c => {
  label(c, `${lab.length + 1} watch: does the rising block stop halfway?`);
  trig(901, c + 1, 9, { "51": "77", "29": "120", "10": "3" }, { group: 76 });
  trig(1616, c + 16, 9, { "51": "76" });
  objs.push(["block", c + 20, 3, { group: 77 }]);
  ruler(c + 19, 0, 9);
});

// ---- dual ball: the band height of a ball pair is ASSUMED (cube measured 9.9 blocks)
station("dual ball band", 26, c => [{ m: "yAt", at: [c + 10, c + 16] }], "two balls, no tap needed: sim's band for a ball pair is 8 blocks (ball 240; ASSUMED, only the cube's 9.9 is measured): player 2 rolls upside down at y 225 (its top at 240). Read player 2's roof on the ruler", c => {
  label(c, `${lab.length + 1} dual ball: where is the roof?`);
  portal(BALL, c + 2); portal(286, c + 4);   // ball first: a mode portal in dual changes only its toucher
  ruler(c + 10, 0, 10); ruler(c + 16, 0, 10);
  portal(287, c + 21); portal(CUBE, c + 23);
});

objs.push(["block", col + 2, 0]);

const spec = { name: "GDLM 67 physics questions lab", desc: "Practice, hitboxes on, record. Do what each label says; read heights on the rulers. Dying or not, both answer it.", lab, objects: objs };
const out = path.join(__dirname, "..", "specs", "67_physics_questions_lab.json");
if (!process.argv.includes("--check")) {
  fs.writeFileSync(out, JSON.stringify(spec, null, 0).replace(/\],\[/g, "],\n["));
  console.log("wrote", out, objs.length, "objects,", lab.length, "stations,", col + 3, "columns");
} else check();

// node tools/lab67.js --check  -- plays each station's instructed input in the sim (from the built level's solved route
// at the station's start) and prints what the sim does: the predictions in the notes, checked. Light: a few runs.
function check() {
  const { GD, readGdlvl } = require("./io.js"), sols = require("./solutions.js");
  const lv = readGdlvl(path.join(__dirname, "..", "levels", "gdlm_67_physics_questions_lab.gdlvl"));
  const sol = sols.get(lv.levelStr, true); if (!sol) { console.log("no saved route: build it first (make.js)"); return; }
  const w = GD.makeWorld(lv.level.objects, lv.level.header), route = GD.run(w, sol.events).path;
  const at = c => { const i = route.findIndex(s => s.x >= c * 30); return { ...route[i], used: route[i].used.slice() }; };
  // play from column `from` with policy(s, k, mem) -> held, until column `to` or death
  const play = (from, to, policy) => {
    const s = at(from), mem = {}; let held = false, k = 0, maxY = -1e9; const trail = [];
    while (!s.dead && s.x < to * 30 && k < 5000) { const h = !!policy(s, k, mem); GD.step(w, s, { press: h && !held, held: h }); held = h; k++; maxY = Math.max(maxY, s.y); trail.push({ x: s.x, y: s.y, g: s.grounded }); }
    return { s, maxY, trail };
  };
  const by = name => lab.find(l => l.name.startsWith(name));
  const jumpAt = (c, extra) => (s, k, m) => { if (!m.j && s.x >= c * 30) { m.j = s.tick; return true; } return extra ? extra(s, k, m) : false; };
  const out = (n, txt) => console.log(`${String(n).padStart(2)} ${txt}`);
  for (const [name, tap] of [["landing buffer: tap again EARLY", (s, m) => s.tick === m.j + 24],
    ["landing buffer: tap again AT THE TOP", (s, m) => !m.t && s.vy <= 0 && (m.t = 1)],
    ["landing buffer: tap again on the way DOWN", (s, m) => !m.t && s.vy < -5 && (m.t = 1)]]) {
    const L = by(name), r = play(L.from, L.to, jumpAt(L.from + 3.4, (s, k, m) => m.j && s.tick > m.j + 1 && !s.grounded && tap(s, m)));
    out(L.n, `${name}: ${r.s.dead ? "dies at block +" + (r.s.x / 30 - L.from).toFixed(1) : "lives"}`);
  }
  { const L = by("orb: hold"), r = play(L.from, L.to, s => s.x >= (L.from + 5) * 30); out(L.n, `orb hold: ${r.s.dead ? "dies (" + r.s.why + ") at +" + (r.s.x / 30 - L.from).toFixed(1) : "lives"}`); }
  { const L = by("mini step"); let best = null;
    for (let jc = L.from + 6; jc <= L.from + 9.6; jc += 0.1) {
      const r = play(L.from, L.from + 11, jumpAt(jc)), on = r.trail.some(p => p.g && p.y > 50 && p.x > (L.from + 8.4) * 30);
      const top = Math.max(...r.trail.filter(p => p.x >= jc * 30).map(p => p.y));
      if (on) { best = { jc, maxY: top, on }; break; } if (!best || top > best.maxY) best = { jc, maxY: top, on };
    }
    out(L.n, `mini step (top 56): ${best.on ? "LANDS on it (jump at +" + (best.jc - L.from).toFixed(1) + ")" : "never lands; highest centre y " + best.maxY.toFixed(1) + " (feet " + (best.maxY - 9).toFixed(1) + ")"}`); }
  const groupY = (s, g) => { const p = GD.posedObjects(w, s).find(q => String((q.o.props && q.o.props["57"]) || "").split(".").includes(String(g))); return p ? Math.round(p.o.y) : null; };
  { const L = by("touch trigger"), r = play(L.from, L.to, () => false); out(L.n, `touch: left block y ${groupY(r.s, 71)}, right block y ${groupY(r.s, 72)} (both start at 105)`); }
  { const L = by("collision trigger"), r = play(L.from, L.to, () => false); out(L.n, `collision: falling block y ${groupY(r.s, 73)} (from 195), marker y ${groupY(r.s, 74)} (from 105)`); }
  { const L = by("stop trigger"), r = play(L.from, L.to, () => false); out(L.n, `stop: rising block y ${groupY(r.s, 77)} (from 105; all the way: 225; halfway: 165)`); }
  { const L = by("ship heights"), r = play(L.from, L.from + 43, s => s.x > (L.from + 14) * 30 && s.x < (L.from + 24) * 30);
    const yAt = c => { const p = r.trail.find(q => q.x >= c * 30); return p ? p.y.toFixed(1) : "-"; };
    out(L.n, `ship: floor y ${yAt(L.from + 12)}, roof y ${yAt(L.from + 22)}, on the block y ${yAt(L.from + 31)}, after it y ${yAt(L.from + 40)}${r.s.dead ? " (died: " + r.s.why + ")" : ""}`); }
  { const L = by("dual ball"), r = play(L.from, L.from + 19, () => false); out(L.n, `dual ball: player 1 y ${r.s.y.toFixed(0)}, player 2 y ${r.s.p2 ? r.s.p2.y.toFixed(0) : "-"}`); }
}
