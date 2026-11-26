// node tools/beatend.js <level.gdlvl> [--song Name | --period P --t0 T] [--from-x X] [--bounces 2] [--out file.gdlvl] [--name "..."]
//   -> the SHORT beat ending (Evgeni, 2026-11-26, on the old outro: "its too big, way too much without anything happening and
//      it doesnt match the beat ... lets start with something small half screen of auto gameplay, that matches the beat. if
//      possible in any song. with the sign there"). From where the level's run is at X (default: its end), with no press:
//   1. on a beat, one column of portals brings any arrival to a plain cube (cube, normal gravity, normal size, 1x);
//   2. once it lands: 2-3 pad bounces, each pad hit ON a beat and each landing ON a later beat -- the landing ledge's height
//      is tuned by the sim so the cube comes down on the beat (a little staircase, up or down);
//   3. a last landing on the ground on a beat, the cube runs under the floating signature (tools/signature.js), which bobs on
//      the beats, and the level ends just past it.
//   Every pad and ledge is placed by sim replays, so it is exact for this level's song, speed and arrival. About half a screen
//   of play (10-16 blocks) plus the sign. AUTO.md "The beat ending". Library: beatEnd(levelStr, {period, t0, fromX, events}).
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs"), path = require("path");
const { GD, readGdlvl, writeGdlvl } = require("./io.js");
const ROOT = path.join(__dirname, "..");
const TPS = 240, B = 30;

// the run of a level string with the given presses, to its end, as a light path
function runOf(str, events, farX) {
  const lv = GD.parseLevel(str + (farX ? `1,1764,2,${farX.toFixed(2)},3,1500;` : ""));
  const w = GD.makeWorld(lv.objects, lv.header), r = GD.run(w, events || []);
  return { path: r.path, dead: r.dead || (r.path.length && r.path[r.path.length - 1].dead), why: r.why };
}
const X = s => GD.progressX ? GD.progressX(s) : s.x;
const objStr = o => `1,${o.id},2,${o.x.toFixed(2)},3,${o.y.toFixed(2)}` + (o.flipY ? ",5,1" : "") + (o.extra || "") + ";";

// beats as level times from a grid
function beatTimes(g, upto) { const out = []; for (let k = 0; ; k++) { const t = g.t0 + k * g.period; if (t > upto) break; if (t >= 0) out.push(t); } return out; }

// the ending: returns { objects: [{id,x,y,flipY}], signCol, endX, beats (the ones it used), notes }
function beatEnd(levelStr, o = {}) {
  const P = o.period, t0 = o.t0 || 0, notes = [];
  const base = levelStr.endsWith(";") ? levelStr : levelStr + ";";
  const add = [];
  const strOf = extra => base + add.concat(extra || []).map(objStr).join("");
  // where the run is at fromX
  let r = runOf(base, o.events, 1e6);
  const p = r.path;
  let ti = p.findIndex(s => X(s) >= (o.fromX != null ? o.fromX : Infinity));
  if (ti < 0) ti = p.length - 1;
  if (r.dead && ti >= p.length - 1) throw new Error("the level dies before its end (" + r.why + ")");
  const beatAfter = t => { const k = Math.ceil((t - t0) / P - 1e-9); return t0 + k * P; };
  const xAt = (path, t) => { const i = Math.min(path.length - 1, Math.max(0, Math.round(t * TPS))); return X(path[i]); };
  const used = [];
  // 1. the portal column on the first beat at least 0.25 s ahead
  let tb = beatAfter(ti / TPS + 0.25);
  const sp0 = p[ti].sp != null ? p[ti].sp : null;
  let xb = X(p[ti]) + (tb - ti / TPS) * (p.length > ti + 1 ? (X(p[ti + 1]) - X(p[ti])) * TPS : 311.58);
  for (let k = 0; k < 14; k++) {
    const y = 15 + 60 * k;
    add.push({ id: 12, x: xb, y }, { id: 10, x: xb + 4, y }, { id: 99, x: xb + 8, y }, { id: 201, x: xb + 12, y });
  }
  used.push(tb);
  // the ground the ending runs on: blocks under y 0 from the column on (a level may end over a pit)
  const floorFrom = Math.floor(xb / B) * B;
  const floor = (x0, x1) => { for (let x = x0 + 15; x < x1; x += B) add.push({ id: 1, x, y: -15 }); };
  r = runOf(strOf(), o.events, xb + 60 * B);
  if (r.dead) throw new Error("the portal column dies: " + r.why);
  // 2. the landing after the column: the first grounded plain cube tick
  const groundedAfter = (path, from) => { for (let t = from; t < path.length; t++) { const s = path[t]; if (s.mode === "cube" && s.grounded && s.grav === 1 && Math.abs(s.vy) < 1e-6) return t; } return -1; };
  let tl = groundedAfter(r.path, Math.round(tb * TPS));
  if (tl < 0) throw new Error("no landing after the portal column");
  // bounces: pad on a beat, ledge tuned so the cube lands on a later beat
  const bounces = o.bounces || 2, look = o.look || "floating";
  let floorTop = 0;
  const pads = [{ id: 35, name: "yellow" }, { id: 140, name: "pink" }];
  for (let k = 0; k < bounces; k++) {
    const tPad = beatAfter(tl / TPS + (look === "ground" ? 0.1 : 2 / TPS));   // ground: a pad right at the landing is touched in the air
    // each pad kind: placed where the cube is on the beat (fixed by the launch tick), then the beats on its way down; the
    // landing ledge's top is the feet there. Pick the pad and beat whose ledge comes closest to the target height: a block
    // up on the first bounces, back to the ground on the last, so the sign stays in view (a 5-block staircase put its title
    // above the screen, 2026-11-26)
    const target = look === "ground" || k === bounces - 1 ? 0 : floorTop === 0 ? 30 : 0;
    const vx = 311.58 * 1.0;
    let pick = null;
    for (const pad of pads) {
      let xp = X(r.path[tl]) + (tPad - tl / TPS) * vx, launch = -1, rr = null;
      for (let it = 0; it < 4; it++) {
        rr = runOf(strOf([{ id: pad.id, x: xp, y: floorTop + 2 }]), o.events, xp + 60 * B);
        launch = -1;
        for (let t = tl; t < rr.path.length - 1; t++) if (rr.path[t + 1].vy > 5 && rr.path[t].vy <= 0.5) { launch = t + 1; break; }
        if (launch < 0) break;
        const err = launch / TPS - tPad;
        if (Math.abs(err) * TPS <= 1) break;
        xp -= err * vx;
      }
      if (o.debug) console.log("  pad", pad.name, "launch", launch, "dead", rr && rr.dead, rr && rr.why);
      if (launch < 0 || rr.dead) continue;
      for (let m = 1; m <= 6; m++) {
        const tb2 = tPad + m * P, i = Math.round(tb2 * TPS);
        if (i >= rr.path.length) break;
        const s = rr.path[i];
        if (look === "ground") {               // no ledge: the cube comes down on the ground where it will; cost = off the beat
          const tg = groundedAfter(rr.path, launch + 2); if (tg < 0) break;
          const off = Math.abs(tg / TPS - tb2) * 1000;
          if (off < 120 && (!pick || off < pick.cost)) pick = { pad, xp, rr, launch, tLand: tb2, feet: 0, cost: off, ground: true };
          continue;
        }
        if (s.vy >= 0) continue;               // still rising
        const f = s.y - 15;
        if (f < -0.5) break;
        const cost = Math.abs(f - target) + (pick && pick.pad === pad ? 0 : 0);
        if (!pick || cost < pick.cost) pick = { pad, xp, rr, launch, tLand: tb2, feet: Math.max(0, f), cost };
      }
    }
    if (!pick) { notes.push(`bounce ${k + 1}: no pad lands on a beat`); break; }
    const pad = pick.pad, xp = pick.xp, launch = pick.launch, arc = pick.rr.path, tLand = pick.tLand, feet = pick.feet;
    add.push({ id: pad.id, x: xp, y: floorTop + 2 });
    used.push(tPad);
    if (tLand < 0) { notes.push(`bounce ${k + 1}: no beat on the way down above the ground`); r = runOf(strOf(), o.events, xp + 60 * B); tl = groundedAfter(r.path, launch + 2); continue; }
    if (!pick.ground && feet > 0.5) add.push(...ledge(arc, Math.round(tLand * TPS), feet, look));
    r = runOf(strOf(), o.events, xp + 60 * B);
    if (r.dead) throw new Error(`bounce ${k + 1}: the ledge kills (${r.why})`);
    tl = groundedAfter(r.path, launch + 2);
    floorTop = feet;
    used.push(tl / TPS);
    notes.push(`bounce ${k + 1}: ${pad.name} pad on beat ${((tPad - t0) / P).toFixed(2)}, lands ${((tl / TPS - tLand) * 1000).toFixed(0)} ms off beat ${((tLand - t0) / P).toFixed(2)} ${feet > 0.5 ? "on a ledge at y " + feet.toFixed(1) : "on the ground"}`);
  }
  // 3. the signature: the stage starts 2 blocks after the last landing (the cube runs on under it), the level ends past it
  const xl = X(r.path[Math.max(0, tl)]);
  const signCol = Math.ceil(xl / B) + 2;
  const endX = require("./signature.js").extent(signCol).x1;   // nothing past the sign: it stays on the last screen (signature.js extent)
  // the ledge the cube stands on runs on to the end, so it never drops in front of the sign
  // (on the grid of the last ledge's blocks, so ledge and run-on are one slab and dress as one)
  const lastLedge = add.filter(q => q.id === 1 && Math.abs(q.y - (floorTop - 15)) < 0.01), gx = lastLedge.length ? lastLedge[lastLedge.length - 1].x : Math.floor(xl / B) * B + 15;
  for (let x = gx + B; x < endX - 15; x += B) if (floorTop > 0) add.push({ id: 1, x, y: floorTop - 15 });
  const fin = runOf(strOf(), o.events, endX);
  if (fin.dead) throw new Error("the ending dies: " + fin.why);
  return { objects: add, signCol, floorY: floorTop, endX, beats: used, notes, startX: xb, look };
}
// a ledge whose top is the cube's feet at tick i: from where the cube is then, 6 blocks on (a pad a beat later is still on it)
// look "plain": a column down to the ground (the old ending: Evgeni, 2026-11-26, "not to have the basic blocks on the bottom
// there"); "floating" (default): one row floating at that height, dressed and hung by endDeco
function ledge(path, i, top, look) {
  const s = path[i], x0 = X(s) - 8, out = [];
  for (let c = 0; c < 6; c++) for (let y = top - 15; y > -15; y -= B) { out.push({ id: 1, x: x0 + 15 + c * B, y }); if (look !== "plain") break; }
  return out;
}

// The ending's look (deco only, no gameplay): its blocks dressed by the structure deco pass (tools/structdeco.js: a design along
// the whole slab, 3D, holders), and a little of tools/decofx.js around the sign. Called by a builder after beatEnd, with the
// level's parsed {header, objects}; returns {header, objects} to add. Looks (AUTO.md "The beat ending: looks"):
//   floating  slabs in the level's palette, layered + depth, hung on chains, embers / snow motes over the ending
//   ground    no blocks at all: every bounce lands on the ground, motes only
//   plain     nothing (the old columns of plain blocks)
const DRESS = {
  floating: { design: "layered", effects: ["depth"], holders: "chain", fx: ["motes"] },
  ice: { design: "nested frames", pal: "ice", effects: ["bevel"], holders: "rope", fx: ["motes"] },
  ground: { fx: ["motes"] },
};
function endDeco(level, be, o = {}) {
  const look = o.dress || be.look, d = DRESS[look];
  if (!d) return { header: level.header, objects: [] };
  const theme = o.theme || d.pal || "fire", x0 = be.startX - 60, x1 = be.endX;
  let header = level.header; const out = [];
  const mine = level.objects.filter(q => q.x >= x0 && q.x <= x1 && q.id === 1);
  if (d.design && mine.length) {
    // the slabs sit at the heights the beats asked for, off the 30-unit grid the structure pass works on: dress each height on
    // the grid and move its deco back by the same offset (one pass for all put the design a row under the blocks)
    const byY = new Map(); for (const q of mine) { const k = q.y.toFixed(2) + "|" + ((((q.x - 15) % B) + B) % B).toFixed(1); if (!byY.has(k)) byY.set(k, []); byY.get(k).push(q); }
    for (const grp of byY.values()) {
      const dy = (((grp[0].y - 15) % B) + B) % B, dx = (((grp[0].x - 15) % B) + B) % B;
      const moved = grp.map(q => Object.assign({}, q, { x: q.x - dx, y: q.y - dy }));
      const r = require("./structdeco.js").pass({ header, objects: moved }, [], { design: d.design, pal: d.pal || theme, effects: d.effects, holders: d.holders, interior: true });
      header = r.header; out.push(...r.objects.map(q => Object.assign(q, { x: q.x + dx, y: q.y + dy })));
    }
  }
  if (d.fx) {
    const K = require("./scenekit.js"), r = require("./decofx.js").fx(level, x0, x1, { theme, fx: d.fx });
    header = K.channels(header, r.channels); out.push(...r.objects.filter(q => q.x <= x1));
  }
  return { header, objects: out };
}

module.exports = { beatEnd, beatTimes, endDeco, DRESS };

if (require.main === module) {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  const file = a[0], L = readGdlvl(file);
  let period = opt("--period") != null ? +opt("--period") : null, t0 = +(opt("--t0") || 0);
  if (opt("--song")) { const g = require("./autobeat.js").loadGrid ? null : null; }
  if (period == null) {
    const w = {}; new Function("window", fs.readFileSync(path.join(ROOT, "viewer", "song_grids.js"), "utf8"))(w);
    const g = w.SONG_GRIDS["/song/official/" + (opt("--song") || "") + ".mp3"];
    if (!g) throw new Error("give --song <Official> or --period/--t0"); period = g.period; t0 = g.t0;
  }
  const res = beatEnd(L.levelStr, { period, t0, fromX: opt("--from-x") != null ? +opt("--from-x") : undefined, bounces: +(opt("--bounces") || 2) });
  console.log(res.notes.join("\n"));
  console.log(`ending: ${(res.endX - res.startX) / B | 0} blocks from the portal column, sign at column ${res.signCol}, ${res.objects.length} objects`);
}
