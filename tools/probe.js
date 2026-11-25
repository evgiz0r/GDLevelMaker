#!/usr/bin/env node
// Reads the GDLM Probe mod's attempt logs (mods/gdlm-probe, GEODE.md): the real game's player state every tick.
// usage: node tools/probe.js [list] [--dir <folder>]          every attempt: level, ticks, presses, result
//        node tools/probe.js show <file|index> [--every N]     the ticks (every Nth) and the presses
//        node tools/probe.js presses <file|index>              press / release ticks, for the sim's replay
// Default folder: %LOCALAPPDATA%/GeometryDash/geode/mods/gdlm.probe/attempts (GD's save folder on Windows).
"use strict";
const fs = require("fs");
const path = require("path");

function defaultDir() {
  const base = process.env.LOCALAPPDATA || path.join(require("os").homedir(), "AppData", "Local");
  return path.join(base, "GeometryDash", "geode", "mods", "gdlm.probe", "attempts");
}

function read(file) {
  const out = { file, start: null, ticks: [], btn: [], death: null, end: null };
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; } // a file cut short by a crash keeps its good lines
    if (o.t === "start") out.start = o;
    else if (o.t === "tick") out.ticks.push(o);
    else if (o.t === "btn") out.btn.push(o);
    else if (o.t === "death") out.death = o;
    else if (o.t === "end") out.end = o;
  }
  return out;
}

function files(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort().map((f) => path.join(dir, f));
}

function main() {
  const a = process.argv.slice(2);
  const opt = (k, d) => { const i = a.indexOf(k); if (i < 0) return d; const v = a[i + 1]; a.splice(i, 2); return v; };
  const dir = opt("--dir", defaultDir());
  const every = Number(opt("--every", 24));
  const cmd = a[0] || "list";
  const all = files(dir);
  const pick = (x) => (/^\d+$/.test(x || "") ? all[Number(x)] : x);
  if (cmd === "list") {
    if (!all.length) { console.log(`no attempts in ${dir}`); return; }
    all.forEach((f, i) => {
      const r = read(f);
      const s = r.start || {};
      const last = r.ticks[r.ticks.length - 1];
      const res = r.end ? r.end.result : "cut";
      const where = r.death ? ` at x ${r.death.x.toFixed(1)} (obj ${r.death.obj})` : last ? ` x ${last.p[0].toFixed(1)}` : "";
      console.log(`${i}\t${s.level} #${s.attempt}${s.practice ? " practice" : ""}\t${r.ticks.length} ticks\t` +
        `${r.btn.filter((b) => b.down).length} presses\t${res}${where}\t${path.basename(f)}`);
    });
  } else if (cmd === "show" || cmd === "presses") {
    const f = pick(a[1]);
    if (!f || !fs.existsSync(f)) { console.error("no such attempt: " + a[1]); process.exit(1); }
    const r = read(f);
    console.log(JSON.stringify(r.start));
    if (cmd === "presses") { for (const b of r.btn) console.log(`${b.n}\t${b.down ? "down" : "up"}\tbutton ${b.button}${b.p1 ? "" : " p2"}`); return; }
    const btnAt = new Map(r.btn.map((b) => [b.n, b]));
    for (const t of r.ticks) {
      const b = btnAt.get(t.n);
      if (t.n % every && !b) continue;
      const [x, y, vy, mode, up, g, size, sp] = t.p;
      console.log(`${t.n}\tx ${x.toFixed(2)}\ty ${y.toFixed(2)}\tvy ${vy.toFixed(3)}\t${mode}${up ? " up" : ""}${g ? " ground" : ""}` +
        `${size !== 1 ? " size " + size : ""}\tspeed ${sp}\tcam ${t.cam.map((c) => c.toFixed(1)).join(",")}${b ? `\t<- ${b.down ? "DOWN" : "UP"}` : ""}`);
    }
    if (r.death) console.log(JSON.stringify(r.death));
    if (r.end) console.log(JSON.stringify(r.end));
  } else {
    console.error("usage: node tools/probe.js [list | show <file|index> | presses <file|index>] [--dir <folder>]");
    process.exit(1);
  }
}

if (require.main === module) main();
module.exports = { read, files, defaultDir };
