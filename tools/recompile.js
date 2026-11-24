// node tools/recompile.js <level> --name "GDLM NN name" [--spec my.vibe.json] [--from <step>] [--to <step>] [--tier Normal]
//                         [--pictures] [--session showcase]
//   <level>  official:N | c<id> (local/community) | a .gdlvl
//
// The reverse-engineering round trip, one step -> one artifact, each shown in the viewer as a build stage of the rebuild
// (the user, 2026-11-24: "level -> sections -> spec -> sections -> level -> compare to original"; BUILDING.md section 6,
// USE_CASES 31, VIBES.md). Stop at any step (--to), edit its artifact, and go on from the next (--from):
//   1 decompile  level -> sections: cut at the song's sections (tools/compare_sections.js, the same cut taste uses), each
//                with its type (intro/build/drop/calm/groove/flight/ending), modes, speeds, energy (tools/energy.js),
//                density, colours and moments (tools/storyboard.js)          -> sections.json      (stage "original")
//   2 abstract   sections -> spec: the vibe sheet (tools/vibe.js format, the user's layers: intent, experience curve,
//                scenes and roles, motifs, rhythm). The LOSSY step: no blocks, no positions. --spec <file> uses a
//                person's sheet instead of the machine's                    -> spec.json, spec.md  (stage "spec")
//   3 plan       spec -> sections again: the compose brief (tools/vibe.js), the collab split with its seams pinned to song
//                time (tools/collab.js split) and the coordinator's roles (tools/coordinator.js plan), from the spec
//                ALONE                                                      -> briefs/<NN>.json, plan.json (stage "plan")
//   4 build      sections -> level: every part built alone, then joined (tools/collab.js build / join)
//                                                                           -> levels/<slug>.gdlvl (stages layout..final)
//   5 compare    the rebuild vs the original: (a) spec vs spec -- the rebuild decompiled and abstracted by steps 1-2 and
//                its spec diffed with the original's, beat by beat: a gap here was lost in the BUILD (steps 3-4), a gap
//                between the original and its own spec was lost in the SPEC (step 2); (b) tools/vibediff.js on the
//                original's beats; (c) taste's section comparison (tools/compare_sections.js, --pictures renders the
//                side-by-side sheets)                                       -> compare.md          (stage "compare")
// Artifacts: local/recompile/<slug>/ (the original's numbers are other people's work: local only). The brief and the
// spec of OUR rebuild go in briefs/ (committed). Not a heavy job itself: each tool it runs takes the heavy slot.
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, "..");
const STEPS = ["decompile", "abstract", "plan", "build", "compare"];
const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const rd = f => JSON.parse(fs.readFileSync(f, "utf8")), wr = (f, j) => fs.writeFileSync(f, JSON.stringify(j, null, 1) + "\n");
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN;
const OFFICIAL_SONG = ["StereoMadness", "BackOnTrack", "Polargeist", "DryOut", "BaseAfterBase", "CantLetGo", "Jumper", "TimeMachine", "Cycles", "xStep", "Clutterfunk", "TheoryOfEverything", "ElectromanAdventures", "Clubstep", "Electrodynamix", "HexagonForce", "BlastProcessing", "TheoryOfEverything2", "GeometricalDominator", "Deadlocked", "Fingerdash", "Dash"];

// ---------- 1 decompile ----------
function decompile(src) {
  const CS = require("./compare_sections.js"), EN = require("./energy.js"), SB = require("./storyboard.js");
  const L = CS.load(src), E = CS.events(L), secs = CS.sections(L, E);
  const c = EN.curve({ header: L.header, objects: L.objects, grid: L.grid });
  const a = SB.analyse({ name: L.name, levelStr: L.levelStr }, { every: 1 }), off = E.off;
  const song = /^official_/.test(L.songKey) ? { official: OFFICIAL_SONG.indexOf(L.songKey.replace("official_", "")) + 1 } : { custom: +L.songKey.replace("custom_", "") };
  const out = secs.map(s => {
    const lt0 = s.t0 - off, lt1 = s.t1 - off, inS = a.sections.filter(q => q.t1 > lt0 + 0.3 && q.t0 < lt1 - 0.3);
    const dur = q => Math.min(q.t1, lt1) - Math.max(q.t0, lt0);
    const modes = []; for (const q of inS) { const last = modes[modes.length - 1]; if (last && last.mode === q.mode) last.secs += dur(q); else modes.push({ mode: q.mode, speed: q.speed, from: +(Math.max(q.t0, lt0) + off).toFixed(2), secs: dur(q) }); }
    const wsum = inS.reduce((t, q) => t + dur(q), 0) || 1, w = k => inS.reduce((t, q) => t + q[k] * dur(q), 0) / wsum;
    const bgs = []; for (let t = lt0; t < lt1; t += 0.5) { const b = a.bgAtT(t); if (bgs[bgs.length - 1] !== b) bgs.push(b); }
    const eb = c.bars.filter(b => b.t0 >= s.t0 - 0.05 && b.t0 < s.t1 - 0.05);
    return { i: s.i, t: [+s.t0.toFixed(2), +s.t1.toFixed(2)], type: s.type, songKind: s.kind || null, loudPct: +s.loudPct.toFixed(2),
      modes: modes.map(m => ({ mode: m.mode, speed: m.speed, from: m.from, secs: +m.secs.toFixed(1) })), energy: +mean(eb.map(b => b.e)).toFixed(2),
      hazPerBlock: +w("hazards").toFixed(2), playPerBlock: +w("gameplay").toFixed(1), decoPerBlock: +w("deco").toFixed(1), kinds: Math.round(w("kinds")),
      bgs, bgSwitches: a.bgSwitches.filter(t => t >= lt0 && t < lt1).map(t => +(t + off).toFixed(2)),
      moments: a.moments.filter(m => m.t >= lt0 && m.t < lt1).map(m => ({ t: +(m.t + off).toFixed(1), what: m.what })) };
  });
  return { level: L.name, src, song: Object.assign(song, { key: L.songKey, offset: off }), grid: { bpm: L.grid.bpm, t0: L.grid.t0 }, seconds: a.seconds,
    zoomPulses: a.zoomPulses, moments: a.moments.map(m => ({ t: +(m.t + off).toFixed(1), what: m.what })), sections: out };
}

// ---------- 2 abstract ----------
const ROLE = { intro: "intro", groove: "build", build: "build", drop: "drop", calm: "calm", ending: "finale" };
const lum = h => { const n = parseInt(String(h).slice(1), 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
const hueName = h => { const n = parseInt(String(h).slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510;
  if (mx < 40) return "black"; if (mx - mn < 25) return l > 0.8 ? "white" : "grey";
  let hh = mx === r ? ((g - b) / (mx - mn)) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4; hh = (hh * 60 + 360) % 360;
  const nm = hh < 15 ? "red" : hh < 40 ? "orange" : hh < 65 ? "yellow" : hh < 150 ? "green" : hh < 190 ? "teal" : hh < 250 ? "blue" : hh < 290 ? "purple" : hh < 335 ? "pink" : "red";
  return (l < 0.25 ? "dark " : l > 0.7 ? "pale " : "") + nm; };
function abstract(D, o = {}) {
  const beats = D.sections.map((s, i) => {
    // the modes in order (1.5 s or longer, repeats merged): "cube then robot then ship", with the switch times
    const main = []; for (const m of s.modes.filter(m => m.secs >= 1.5)) { const md = m.mode.replace(/ mirrored/g, ""); if (!main.length || main[main.length - 1].mode !== md) main.push(Object.assign({}, m, { mode: md })); }
    const first = main[0] || s.modes[0] || { mode: "cube", speed: "1x" };
    const vehicle = { mode: main.length >= 2 ? main.map(m => m.mode).join(" then ") : first.mode.replace(/ mirrored/g, ""), speed: first.speed || "1x" };
    if (main.length >= 2) vehicle.at = main.slice(1).map(m => +(m.from - D.song.offset).toFixed(2));
    if (main.length >= 2 && new Set(main.map(m => m.speed)).size > 1) vehicle.speeds = main.map(m => m.speed);
    const role = s.type === "flight" ? (s.loudPct >= 0.6 ? "drop" : "build") : ROLE[s.type] || "build";
    const bg = s.bgs[Math.floor(s.bgs.length / 2)] || s.bgs[0] || "#287dff";
    const e = Number.isFinite(s.energy) ? s.energy : 0.5;
    const mood = [e < 0.35 ? "calm" : e < 0.6 ? "steady" : e < 0.8 ? "driving" : "intense", lum(bg) < 0.15 ? "dark" : lum(bg) > 0.5 ? "bright" : ""].filter(Boolean).join(", ");
    const pick = s.moments.find(m => /^palette/.test(m.what)) || s.moments.find(m => /^speed|^shake|^zoom|^static/.test(m.what)) || s.moments.find(m => /densest/.test(m.what));
    const look = { palette: { bg } }; if (s.bgs.length >= 3) look.palettes = s.bgs.slice(0, 6);
    const sw0 = s.bgSwitches[0], fade = (s.moments.find(m => /^palette/.test(m.what) && /fade/.test(m.what)) || {}).what;
    const trans = sw0 != null && sw0 - s.t[0] < 1.5 ? { in: fade && /(\d+(\.\d+)?)s fade/.test(fade) ? "fade " + Math.round(+/(\d+(\.\d+)?)s fade/.exec(fade)[1]) : "instant" } : {};
    const rel = t => +(t - D.song.offset).toFixed(2);
    return { id: `${role} ${i + 1}`, t: [rel(s.t[0]), rel(s.t[1])], role, energy: +e.toFixed(2), place: `a ${hueName(bg)} place`, mood, vehicle,
      moment: pick ? `${pick.what} at ${rel(pick.t)} s` : "", look, transition: trans };
  });
  if (beats.length) { beats[0].role = "intro"; beats[beats.length - 1].role = "finale"; }
  const pal = D.moments.filter(m => /^palette/.test(m.what)), shakes = D.moments.filter(m => /^shake x/.test(m.what)), speeds = D.moments.filter(m => /^speed/.test(m.what));
  const motifs = [];
  if (pal.length >= 3) motifs.push(`a palette switch ${pal.length} times (${pal.filter(m => /instant/.test(m.what)).length} instant, ${pal.filter(m => /fade/.test(m.what)).length} fades)`);
  if (shakes.length) motifs.push(`screen shakes on the beat (${shakes.map(m => m.what.replace(/ \(on the beat\)/, "")).join("; ")})`);
  if (D.zoomPulses > 10) motifs.push(`zoom pulses (${D.zoomPulses})`);
  if (speeds.length >= 3) motifs.push(`speed changes as punctuation (${speeds.length})`);
  const upsides = D.sections.filter(s => s.modes.some(m => /upside/.test(m.mode))).length; if (upsides >= 2) motifs.push(`upside-down moments in ${upsides} sections`);
  const mirr = D.sections.filter(s => s.modes.some(m => /mirrored/.test(m.mode))).length; if (mirr) motifs.push(`a flipped (mirrored) screen in ${mirr} sections`);
  const big = D.moments.filter(m => /^palette/.test(m.what)).sort((p, q) => q.what.length - p.what.length)[0] || D.moments.find(m => /densest/.test(m.what));
  const speedCount = {}; for (const s of D.sections) for (const m of s.modes) speedCount[m.speed] = (speedCount[m.speed] || 0) + m.secs;
  const modeStretch = +(D.seconds / Math.max(1, D.sections.reduce((n, s) => n + s.modes.length, 0))).toFixed(1);
  return {
    title: o.name || D.level, desc: `${D.level}, decompiled and rebuilt from its spec alone.`,
    journey: beats.map(b => `${b.role} (${b.vehicle.mode}, ${b.place.replace(/^a /, "")})`).join(" -> "),
    oneImage: big ? `${big.what} at ${(big.t - D.song.offset).toFixed(1)} s` : "",
    never: [],
    song: { [D.song.official ? "official" : "custom"]: D.song.official || D.song.custom, from: D.song.offset },
    feel: { tier: o.tier || "Normal", modeStretch, density: `${mean(D.sections.map(s => s.hazPerBlock)).toFixed(2)} hazards per block` },
    lookRule: pal.length >= 3 ? "per-part" : "shared", camera: D.zoomPulses > 10 ? "zoom pulses" : "plain",
    motifs, rhythm: { sync: "portals", speed: Object.entries(speedCount).sort((p, q) => q[1] - p[1])[0][0] },
    beats, machine: true,
  };
}
function specMd(v) {
  const L = [`# ${v.title}`, "", `**Intent.** ${v.journey}`, "", `**The one image.** ${v.oneImage || "-"}`, ""];
  if (v.never && v.never.length) L.push(`**Never.** ${v.never.join("; ")}`, "");
  L.push(`**Experience curve.** tier ${v.feel.tier}, a mode lasts ~${v.feel.modeStretch} s, ${v.feel.density}; energy per beat: ${v.beats.map(b => b.energy).join(" ")}`, "");
  L.push(`**Look.** ${v.lookRule}; camera: ${v.camera}. **Rhythm.** ${v.rhythm.sync}, ${v.rhythm.speed}.`, "", `**Motifs.** ${(v.motifs || []).join("; ") || "-"}`, "");
  L.push("| t (s) | role | energy | place | mood | vehicle | moment |", "|---|---|---|---|---|---|---|");
  for (const b of v.beats) L.push(`| ${b.t[0]}-${b.t[1]} | ${b.role} | ${b.energy} | ${b.place || ""} | ${b.mood || ""} | ${b.vehicle.mode} ${b.vehicle.speed || ""} | ${b.moment || ""} |`);
  return L.join("\n");
}

// ---------- 5 compare: spec vs spec ----------
function specDiff(A, B) {   // A: the original's spec, B: the rebuild's; per beat of A, B's beats overlapping it
  const rows = [];
  for (const a of A.beats) {
    const ov = B.beats.filter(b => b.t[1] > a.t[0] + 0.5 && b.t[0] < a.t[1] - 0.5);
    const e = ov.length ? mean(ov.map(b => b.energy)) : NaN, d = [];
    if (!ov.length) d.push("nothing there");
    else {
      if (Math.abs(e - a.energy) > 0.25) d.push(`energy ${e.toFixed(2)} vs ${a.energy}`);
      const vm = x => x.vehicle.mode.replace(/upside |mini |dual /g, "").split(" then ");
      const am = vm(a), bm = [...new Set([].concat(...ov.map(vm)))];
      if (am.some(m => !bm.includes(m))) d.push(`vehicle ${bm.join("+")} vs ${am.join("+")}`);
      if (!ov.some(b => b.role === a.role)) d.push(`role ${ov.map(b => b.role).join("+")} vs ${a.role}`);
      const pa = a.look.palette.bg, pb = ov[0].look.palette.bg;
      if (hueName(pa) !== hueName(pb)) d.push(`colour ${hueName(pb)} vs ${hueName(pa)}`);
    }
    rows.push({ id: a.id, t: a.t, got: ov.map(b => `${b.role} ${b.vehicle.mode} e${b.energy}`).join(" / "), want: `${a.role} ${a.vehicle.mode} e${a.energy}`, diff: d.length ? d : ["same"] });
  }
  return rows;
}

// ---------- the steps, run ----------
function run(cmd, a) {
  console.log(`   $ node ${cmd} ${a.join(" ")}`);
  const r = cp.spawnSync(process.execPath, [path.join(__dirname, cmd), ...a], { cwd: ROOT, encoding: "utf8", windowsHide: true, maxBuffer: 1 << 26 });
  const out = (r.stdout || "") + (r.stderr || ""); return { ok: r.status === 0, out, status: r.status };
}
function main() {
  const src = args[0];
  if (!src || src.startsWith("--") || !opt("--name")) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  const name = opt("--name"), nn = (/GDLM (\d+)/.exec(name) || [])[1], slug = name.toLowerCase().replace(/^gdlm /, "gdlm_").replace(/[^\w]+/g, "_");
  if (!nn) throw new Error("--name must be 'GDLM NN name' (a free number: check levels/ and every wip)");
  const briefFile = path.join(ROOT, "briefs", `${nn}_${slug.replace(/^gdlm_\d+_/, "")}.json`), vibeFile = briefFile.replace(/\.json$/, ".vibe.json");
  const dir = path.join(ROOT, "local", "recompile", slug); fs.mkdirSync(dir, { recursive: true });
  const from = STEPS.indexOf(opt("--from") || "decompile"), to = STEPS.indexOf(opt("--to") || "compare");
  const session = opt("--session") || "showcase", ST = require("./stages.js");
  const stage = (st, o) => { try { ST.put(Object.assign({ session, base: slug, name, stage: st }, o)); } catch (e) { console.log("   (stage " + st + ": " + e.message + ")"); } };
  const songData = D => ({ url: D.song.official ? "/song/official/" + OFFICIAL_SONG[D.song.official - 1] + ".mp3" : "/song/custom/" + D.song.custom + ".mp3", id: D.song.custom, offset: D.song.offset });
  const t00 = Date.now(), step = (i, f) => { if (i < from || i > to) return; const t0 = Date.now(); console.log(`== ${i + 1} ${STEPS[i]}`); f(); console.log(`   ${((Date.now() - t0) / 1000).toFixed(0)} s`); };
  let D, V, levelOut;
  step(0, () => {
    D = decompile(src); wr(path.join(dir, "sections.json"), D);
    console.log(`   ${D.level}: ${D.sections.length} sections -> ${path.relative(ROOT, path.join(dir, "sections.json"))}`);
    for (const s of D.sections) console.log(`     ${s.t[0]}-${s.t[1]} ${s.type.padEnd(7)} ${s.modes.map(m => m.mode + " " + m.speed).join(", ")}  e ${s.energy}  ${s.bgs.join(" ")}`);
    const lv = /^official:/.test(src) ? rd(path.join(ROOT, "local", `official_${String(+src.split(":")[1]).padStart(2, "0")}.json`)).level : require("./io.js").readGdlvl(/^c\d+$/.test(src) ? path.join(ROOT, "local", "community", src.slice(1) + ".gdlvl") : src).levelStr;
    stage("original", { levelStr: lv, note: `1 decompile: ${D.level} cut into ${D.sections.length} sections`, data: { song: songData(D), sections: D.sections.map(s => ({ name: `${s.type} (${s.modes.map(m => m.mode).join(", ")})`, from: s.t[0] - D.song.offset, to: s.t[1] - D.song.offset })) } });
  });
  step(1, () => {
    D = D || rd(path.join(dir, "sections.json"));
    V = opt("--spec") ? rd(opt("--spec")) : abstract(D, { name, tier: opt("--tier") });
    V.title = name; wr(path.join(dir, "spec.json"), V); fs.writeFileSync(path.join(dir, "spec.md"), specMd(V) + "\n"); wr(vibeFile, V);
    console.log(`   ${opt("--spec") ? "a person's spec" : "the machine's spec"} -> ${path.relative(ROOT, vibeFile)}, ${path.relative(ROOT, path.join(dir, "spec.md"))}`);
    stage("spec", { note: "2 abstract: the vibe sheet (no blocks)", data: { song: songData(D), md: specMd(V), sections: V.beats.map(b => ({ name: `${b.role}: ${b.vehicle.mode}, e ${b.energy}`, from: b.t[0], to: b.t[1] })) } });
  });
  step(2, () => {
    D = D || rd(path.join(dir, "sections.json")); V = V || rd(vibeFile);
    const b = require("./vibe.js").brief(V, { name }); wr(briefFile, b);
    for (const n of b.vibeNotes) console.log("   note: " + n);
    let r = run("collab.js", ["split", path.relative(ROOT, briefFile)]); console.log(r.out.split("\n").map(l => "   " + l).join("\n"));
    if (!r.ok) throw new Error("collab split failed");
    r = run("coordinator.js", ["plan", path.relative(ROOT, briefFile)]); console.log(r.out.split("\n").slice(-6).map(l => "   " + l).join("\n"));
    const plan = rd(path.join(ROOT, "local", "collab", path.basename(briefFile, ".json"), "plan.json")); wr(path.join(dir, "plan.json"), plan);
    stage("plan", { note: `3 plan: ${b.sections.length} sections in ${plan.parts.length} parts, seams on song time`, data: { song: songData(D), sections: plan.parts.map(p => ({ name: `${p.id} ${p.name}`, from: p.t[0], to: p.t[1] })) } });
  });
  step(3, () => {
    const plan = rd(path.join(dir, "plan.json")), bf = path.relative(ROOT, briefFile); let collabFailed = null;
    try { fs.unlinkSync(path.join(dir, "build_note.txt")); } catch (e) {}
    // a part that fails a gate is built again with another seed (collab.js build makes one attempt): up to 3 tries
    for (let k = 0; k < plan.parts.length; k++) {
      let r;
      for (let a = 0; a < 3; a++) {
        r = run("collab.js", ["build", bf, String(k), "--by", "recompile"].concat(a ? ["--seed", String(100 + 17 * a + k)] : []));
        console.log(r.out.split("\n").filter(l => l.trim() && !/heavy: waiting/.test(l)).slice(-4).map(l => "   " + l).join("\n"));
        if (r.ok) break;
      }
      if (!r.ok) { collabFailed = `part ${k} failed its gates 3 times (collab builds a part in one try, no repair rounds)`; break; }
    }
    // the fallback: the same brief as ONE level through compose's repair rounds (a pipeline gap, said in compare.md)
    if (collabFailed) {
      console.log(`   collab: ${collabFailed} -> compose with repair rounds`);
      fs.writeFileSync(path.join(dir, "build_note.txt"), `collab: ${collabFailed}; built by compose.js with repair rounds instead\n`);
      const r = run("compose.js", [bf]); console.log(r.out.split("\n").filter(l => l.trim() && !/heavy: waiting/.test(l)).slice(-8).map(l => "   " + l).join("\n"));
      const out = path.join("levels", slug + ".gdlvl");
      if (!fs.existsSync(path.join(ROOT, out))) throw new Error("compose made no " + out);
      levelOut = out; fs.writeFileSync(path.join(dir, "level.txt"), levelOut + "\n"); return;
    }
    const r = run("collab.js", ["join", bf]); console.log(r.out.split("\n").map(l => "   " + l).join("\n"));
    const m = /-> (levels[\\/][^\s]+\.gdlvl)/.exec(r.out); if (!m) throw new Error("join made no level");
    levelOut = m[1]; fs.writeFileSync(path.join(dir, "level.txt"), levelOut + "\n");
  });
  step(4, () => {
    D = D || rd(path.join(dir, "sections.json")); V = V || rd(path.join(dir, "spec.json"));
    levelOut = levelOut || fs.readFileSync(path.join(dir, "level.txt"), "utf8").trim();
    const D2 = decompile(levelOut), V2 = abstract(D2, { name }); wr(path.join(dir, "rebuild.sections.json"), D2); wr(path.join(dir, "rebuild.spec.json"), V2);
    const Vm = abstract(D, { name });   // the original's machine spec: what step 2 keeps of it
    const lost = specDiff(Vm, V), built = specDiff(V, V2);
    const VD = require("./vibediff.js"), lvO = /^official:/.test(src) ? (() => { const j = rd(path.join(ROOT, "local", `official_${String(+src.split(":")[1]).padStart(2, "0")}.json`)); return { name: j.name, levelStr: j.level }; })() : require("./io.js").readGdlvl(/^c\d+$/.test(src) ? path.join(ROOT, "local", "community", src.slice(1) + ".gdlvl") : src);
    const vd = VD.diff(lvO, require("./io.js").readGdlvl(path.join(ROOT, levelOut)), V);
    const md = [`# Round trip: ${D.level} -> ${name}`, "",
      "Two diffs tell where a gap comes from. **Spec**: the original's own spec (the machine's, from steps 1-2) against the spec used (a person's when one was given): what the spec chose to drop or change. **Build**: the spec used against the rebuild decompiled by steps 1-2: what steps 3-4 could not deliver.", "",
      ...(fs.existsSync(path.join(dir, "build_note.txt")) ? ["**Build:** " + fs.readFileSync(path.join(dir, "build_note.txt"), "utf8").trim(), ""] : []),
      "## Spec (the original vs the spec used)", "", "| beat | t | spec used | original | gap |", "|---|---|---|---|---|",
      ...specDiff(V, Vm).map(r => `| ${r.id} | ${r.t[0]}-${r.t[1]} | ${r.want} | ${r.got} | ${r.diff.join("; ")} |`), "",
      "## Build (the spec used vs the rebuild)", "", "| beat | t | spec | rebuild | gap |", "|---|---|---|---|---|",
      ...built.map(r => `| ${r.id} | ${r.t[0]}-${r.t[1]} | ${r.want} | ${r.got} | ${r.diff.join("; ")} |`), "",
      "## The levels side by side (tools/vibediff.js, on the spec's beats)", "", VD.md(vd).split("\n").slice(2).join("\n")].join("\n");
    fs.writeFileSync(path.join(dir, "compare.md"), md + "\n"); console.log("   -> " + path.relative(ROOT, path.join(dir, "compare.md")));
    const ref = /^official:/.test(src) ? src : /^c\d+$/.test(src) ? src : path.relative(ROOT, src);
    const r = run("compare_sections.js", ["--ours", levelOut, "--refs", ref, "--out", path.relative(ROOT, path.join(dir, "compare_sections"))].concat(args.includes("--pictures") ? [] : ["--no-render"]));
    console.log(r.out.split("\n").slice(-8).map(l => "   " + l).join("\n"));
    let lvStr = null; try { lvStr = require("./io.js").readGdlvl(path.join(ROOT, levelOut)).levelStr; } catch (e) {}
    stage("compare", Object.assign({ note: `5 compare: spec gaps ${specDiff(V, Vm).filter(r => r.diff[0] !== "same").length}, build gaps ${built.filter(r => r.diff[0] !== "same").length} of ${V.beats.length} beats; energy curve r ${vd.level.energyCorr}`, data: { song: songData(D), md } }, lvStr ? { levelStr: lvStr } : {}));
    void lost;
  });
  console.log(`recompile ${STEPS.slice(from, to + 1).join(" -> ")} done in ${((Date.now() - t00) / 1000).toFixed(0)} s; artifacts in ${path.relative(ROOT, dir)}`);
}
module.exports = { decompile, abstract, specDiff, specMd, STEPS };
if (require.main === module) try { main(); } catch (e) { console.error("recompile: " + e.message); process.exit(1); }
