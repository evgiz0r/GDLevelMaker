// node tools/storyboard.js <level.gdlvl | c<id> | <id> | official:N> [--every 2] [--json out.json]
//   -- a level read back as the timeline its designer would have imagined (VIBES.md): its sections (cut at mode, speed,
//      gravity, size, dual and mirror portals) with time, mode, speed, hazards / gameplay / deco per block, the
//      background colour there and the effects (camera, shake, pulse, move); an intensity strip every --every seconds
//      (hazards + orbs + pads per block, deco per block, background brightness); and the "moments" -- palette switches,
//      speed-ups, camera moves, shakes, the densest deco set pieces. Reads only; no solve (so it works on demons).
//   A bare number is a community level (local/community/<id>.gdlvl, never committed). Triggers fired by spawn or touch
//   (2.2 trigger groups) are counted apart: their moment is not their x.
"use strict";
const fs = require("fs"), path = require("path");
const { readGdlvl, GD } = require("./io.js");
const O = require("../lib/objects.js");
const ROOT = path.join(__dirname, "..");

const SPEED = { 0: 251.16, 1: 311.58, 2: 387.42, 3: 468, 4: 576 };   // units per second (lib/physics.js SPEEDS, x60)
const TRIG = { 29: "bg", 30: "ground", 899: "colour", 901: "move", 1006: "pulse", 1007: "alpha", 1049: "toggle", 1268: "spawn",
  1346: "rotate", 1347: "follow", 1520: "shake", 1913: "zoom", 1914: "static cam", 1916: "cam offset", 2015: "cam rotate",
  2062: "cam edge", 1934: "song", 1935: "time warp", 3006: "area move", 3010: "area tint", 2903: "gradient", 1818: "bg fx on" };
const CAM = new Set([1913, 1914, 1916, 2015, 2062]);

function load(w) {
  let m;
  if (/^\d+$/.test(w)) w = path.join(ROOT, "local", "community", w + ".gdlvl");
  else if ((m = /^c(\d+)$/.exec(w))) w = path.join(ROOT, "local", "community", m[1] + ".gdlvl");
  if ((m = /^official:(\d+)$/.exec(w))) { const j = JSON.parse(fs.readFileSync(path.join(ROOT, "local", `official_${String(+m[1]).padStart(2, "0")}.json`), "utf8")); return { name: j.name, levelStr: j.level }; }
  return readGdlvl(w);
}
function startColours(header) {
  const s = typeof header === "string" ? header : JSON.stringify(header || "");
  const m = /kS38,([^,;]*)/.exec(s), out = {};
  if (m) for (const part of m[1].split("|")) { const a = part.split("_"), kv = {}; for (let i = 0; i + 1 < a.length; i += 2) kv[a[i]] = a[i + 1]; if (kv[6]) out[+kv[6]] = [+kv[1] || 0, +kv[2] || 0, +kv[3] || 0]; }
  // 1.x levels: kS1..kS3 = bg rgb
  const r = /kS1,(\d+),kS2,(\d+),kS3,(\d+)/.exec(s); if (r && !out[1000]) out[1000] = [+r[1], +r[2], +r[3]];
  return out;
}
const hex = c => c ? "#" + c.map(v => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, "0")).join("") : "?";
const lum = c => c ? (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255 : 0;
const BARS = " ▁▂▃▄▅▆▇█";
const spark = (vals, max) => vals.map(v => BARS[Math.max(0, Math.min(8, Math.round(v / (max || 1) * 8)))]).join("");

function analyse(lv, o = {}) {
  const level = GD.parseLevel(lv.levelStr), objs = level.objects.slice().sort((a, b) => a.x - b.x);
  const every = o.every || 2;
  const kindOf = ob => { const d = O.objInfo(ob.id); return d ? d.kind : "decoration"; };
  const portals = [], trig = [], byKind = { hazard: [], gameplay: [], deco: [] };
  let endX = 0, spawnTrig = 0; const gpIds = [];
  for (const ob of objs) {
    const k = kindOf(ob), p = ob.props || {};
    if (["mode", "speed", "gravity", "size", "dual"].includes(k) || ob.id === 45 || ob.id === 46) portals.push({ x: ob.x, id: ob.id, k, d: O.objInfo(ob.id) });
    else if (k === "trigger") { if (p[62] === "1" || p[11] === "1") { spawnTrig++; continue; } trig.push(ob); continue; }
    if (k === "hazard") { byKind.hazard.push(ob.x); gpIds.push([ob.x, ob.id]); }
    else if (["solid", "slope", "orb", "pad"].includes(k)) { byKind.gameplay.push(ob.x); gpIds.push([ob.x, ob.id]); }
    else if (k !== "trigger") byKind.deco.push(ob.x);
    if (k !== "decoration" && k !== "trigger") endX = Math.max(endX, ob.x);
  }
  if (!endX) endX = objs.length ? objs[objs.length - 1].x : 0;
  // time of x through the speed portals (height ignored, as lib/sync.js)
  const sp0 = { 0: 1, 1: 0, 2: 2, 3: 3, 4: 4 }[+((/kA4,(\d)/.exec(String(level.header)) || [])[1] || 0)] ?? 1;
  const tl = [{ x: 0, t: 0, v: SPEED[sp0], sp: sp0 }];
  for (const p of portals.filter(p => p.k === "speed")) { const g = tl[tl.length - 1]; if (p.x <= g.x) continue; tl.push({ x: p.x, t: g.t + (p.x - g.x) / g.v, v: SPEED[p.d.speed], sp: p.d.speed }); }
  const tOf = x => { let s = tl[0]; for (const g of tl) if (g.x <= x) s = g; return s.t + (x - s.x) / s.v; };
  const len = tOf(endX);
  // background colour over x: start colour, then colour / bg triggers on channel 1000 by their x
  const cols = startColours(level.header);
  const bgEv = [{ x: -1e9, c: cols[1000] || [40, 125, 255] }];
  for (const t of trig) { const p = t.props; if ((t.id === 899 && +p[23] === 1000) || t.id === 29) bgEv.push({ x: t.x, c: [+p[7] || 0, +p[8] || 0, +p[9] || 0], fade: +p[10] || 0 }); }
  const bgAt = x => { let c = bgEv[0].c; for (const e of bgEv) if (e.x <= x) c = e.c; return c; };
  // sections at portals (a section under 1 s joins the next)
  const st = { mode: "cube", sp: sp0, grav: 1, mini: false, dual: false, mirror: false };
  const cuts = [{ x: 0, st: Object.assign({}, st) }];
  for (const p of portals) {
    if (p.k === "mode") st.mode = p.d.mode; else if (p.k === "speed") st.sp = p.d.speed; else if (p.k === "gravity") st.grav = p.d.grav === 0 ? -st.grav : p.d.grav;
    else if (p.k === "size") st.mini = p.d.mini; else if (p.k === "dual") st.dual = p.d.dual; else st.mirror = p.id === 45;
    const last = cuts[cuts.length - 1];
    if (JSON.stringify(last.st) === JSON.stringify(st)) continue;
    if (tOf(p.x) - tOf(last.x) < 1 && cuts.length > 1) last.st = Object.assign({}, st); else cuts.push({ x: p.x, st: Object.assign({}, st) });
  }
  const count = (arr, x0, x1) => { let n = 0; for (const x of arr) if (x >= x0 && x < x1) n++; return n; };
  const sections = cuts.map((c, i) => {
    const x0 = c.x, x1 = i + 1 < cuts.length ? cuts[i + 1].x : endX, blocks = Math.max(1, (x1 - x0) / 30);
    const fx = {}; for (const t of trig) if (t.x >= x0 && t.x < x1) { const n = TRIG[t.id]; if (n) fx[n] = (fx[n] || 0) + 1; }
    const s = c.st;
    return { t0: +tOf(x0).toFixed(1), t1: +tOf(x1).toFixed(1), x0: Math.round(x0), x1: Math.round(x1),
      mode: (s.mini ? "mini " : "") + (s.grav < 0 ? "upside " : "") + (s.dual ? "dual " : "") + s.mode + (s.mirror ? " mirrored" : ""), speed: ["0.5x", "1x", "2x", "3x", "4x"][s.sp],
      hazards: +(count(byKind.hazard, x0, x1) / blocks).toFixed(2), gameplay: +(count(byKind.gameplay, x0, x1) / blocks).toFixed(1), deco: +(count(byKind.deco, x0, x1) / blocks).toFixed(1),
      bg: hex(bgAt((x0 + x1) / 2)), kinds: new Set(gpIds.filter(([x]) => x >= x0 && x < x1).map(e => e[1])).size, fx };
  });
  // strips every `every` seconds
  const strip = [];
  for (let t = 0; t < len; t += every) {
    let x0 = null, x1 = null; for (let x = 0; x <= endX + 30; x += 15) { const tt = tOf(x); if (x0 === null && tt >= t) x0 = x; if (tt >= t + every) { x1 = x; break; } }
    if (x0 === null) break; if (x1 === null) x1 = endX; const blocks = Math.max(1, (x1 - x0) / 30);
    strip.push({ t, play: (count(byKind.hazard, x0, x1) + 0.5 * count(byKind.gameplay, x0, x1)) / blocks, deco: count(byKind.deco, x0, x1) / blocks, bg: lum(bgAt((x0 + x1) / 2)) });
  }
  // moments
  const moments = [];
  for (let i = 1; i < bgEv.length; i++) { const a = bgEv[i - 1].c, b = bgEv[i].c, d = Math.abs(lum(a) - lum(b)) + (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 765;
    if (d > 0.25 && bgEv[i].x > 0) moments.push({ t: +tOf(bgEv[i].x).toFixed(1), what: `palette ${hex(a)} -> ${hex(b)}${bgEv[i].fade ? ` (${bgEv[i].fade}s fade)` : " (instant)"}` }); }
  for (const p of portals) if (p.k === "speed") moments.push({ t: +tOf(p.x).toFixed(1), what: `speed ${["0.5x", "1x", "2x", "3x", "4x"][p.d.speed]}` });
  const camT = trig.filter(t => CAM.has(t.id)), shk = trig.filter(t => t.id === 1520);
  // zoom: only where the level settles on a new zoom (repeated pulses to the same value are one line: "zoom pulses")
  let zLast = 1, zPulse = 0;
  for (const t of camT) {
    if (t.id === 1913) { const z = +(t.props[371] || 1); if (Math.abs(z - zLast) < 0.05) { zPulse++; continue; } zLast = z; moments.push({ t: +tOf(t.x).toFixed(1), what: `zoom ${z}` }); continue; }
    moments.push({ t: +tOf(t.x).toFixed(1), what: TRIG[t.id] });
  }
  for (const t of shk) moments.push({ t: +tOf(t.x).toFixed(1), what: "shake" });
  const decoPeaks = strip.map((s, i) => ({ i, d: s.deco })).sort((a, b) => b.d - a.d).slice(0, 3);
  for (const p of decoPeaks) moments.push({ t: strip[p.i].t, what: `densest deco (${p.d.toFixed(0)}/block)` });
  moments.sort((a, b) => a.t - b.t);
  // merge same-kind moments within 1 s
  const merged = []; for (const m of moments) { const l = merged[merged.length - 1]; if (l && m.t - l.t < 1 && l.what.split(" ")[0] === m.what.split(" ")[0]) { l.n = (l.n || 1) + 1; continue; } merged.push(m); }
  // a run of the same effect on a beat (shakes every bar) is one line: "shake x18, 36.6-50.8 s, every ~0.8 s"
  const runs = []; for (const m of merged) { const k = m.what.split(" ")[0], l = runs[runs.length - 1];
    if (l && l.k === k && (k === "shake" || k === "zoom") && m.t - l.t1 < 3) { l.t1 = m.t; l.n++; continue; } runs.push({ k, t: m.t, t1: m.t, n: 1, m }); }
  const moments2 = runs.map(r => r.n > 2 ? { t: r.t, what: `${r.k} x${r.n}, ${r.t}-${r.t1} s, every ~${((r.t1 - r.t) / (r.n - 1)).toFixed(1)} s (on the beat)` } : r.m);
  if (moments2.length < merged.length) { merged.length = 0; merged.push(...moments2); }
  const portalTimes = portals.map(p => ({ t: +tOf(p.x).toFixed(3), kind: p.k }));
  const bgSwitches = bgEv.slice(1).filter(e => e.x > 0).map(e => +tOf(e.x).toFixed(2));
  return { name: lv.name, portalTimes, bgSwitches, bgAtT: t => { let x = 0; while (x < endX && tOf(x) < t) x += 15; return hex(bgAt(x)); }, zoomPulses: zPulse, objects: objs.length, seconds: +len.toFixed(1), spawnTriggers: spawnTrig, sections, strip, moments: merged, every };
}

function print(a) {
  console.log(`${a.name}: ${a.objects} objects, ${a.seconds} s, ${a.sections.length} sections${a.spawnTriggers ? `, ${a.spawnTriggers} spawn/touch triggers (timed by groups, not by x)` : ""}`);
  console.log(`\n  t        mode                 speed  haz/b  play/b deco/b  bg       effects`);
  for (const s of a.sections) console.log(`  ${(s.t0 + "-" + s.t1).padEnd(9)}${s.mode.padEnd(21)}${s.speed.padEnd(7)}${String(s.hazards).padEnd(7)}${String(s.gameplay).padEnd(7)}${String(s.deco).padEnd(7)}${s.bg}  ${Object.entries(s.fx).map(([k, v]) => k + " " + v).join(", ")}`);
  const maxP = Math.max(...a.strip.map(s => s.play)), maxD = Math.max(...a.strip.map(s => s.deco));
  console.log(`\n  every ${a.every} s (each mark = ${a.every} s):`);
  console.log(`  intensity  ${spark(a.strip.map(s => s.play), maxP)}  (max ${maxP.toFixed(1)} hazards+gameplay/block)`);
  console.log(`  deco       ${spark(a.strip.map(s => s.deco), maxD)}  (max ${maxD.toFixed(0)}/block)`);
  console.log(`  bg light   ${spark(a.strip.map(s => s.bg), 1)}`);
  console.log(`\n  moments:`); for (const m of a.moments) console.log(`    ${String(m.t).padStart(6)} s  ${m.what}${m.n ? ` (x${m.n})` : ""}`);
}
module.exports = { analyse };
if (require.main === module) {
  const args = process.argv.slice(2), opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  if (!args[0]) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  const a = analyse(load(args[0]), { every: +(opt("--every") || 2) });
  if (opt("--json")) fs.writeFileSync(opt("--json"), JSON.stringify(a, null, 1));
  print(a);
}
