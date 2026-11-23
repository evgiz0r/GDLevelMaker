// node tools/score.js <level.gdlvl> [--brief briefs/NN.json] [--json]
//
// Every gate a level must pass before the user sees it, in one report (STYLE.md "The loop").
// Each gate is PASS, WARN (worth a look, does not block) or FAIL (blocks the hand-over).
//   beatable     the solver beats it (cube/ship/... physics, lib/physics.js)
//   prejumps     no press is committed far ahead of its cue (tools/sightread.js; the user's rule)
//   timing       tightest press window >= the brief's minWindowMs (default 60)
//   recovery     time from landing to the END of the next press's window >= minRecoveryMs (default Easy 150,
//                Normal 100, harder: none). Land-and-jump-at-once chains were the wall in GDLM 42
//                (the user's normal-mode deaths, mouse, recording 19:45): fine for the solver, hard
//                for a person without holding the button.
//   difficulty   lib/difficulty.js label vs the brief's target (one step off = WARN)
//   pacing       calm start and end, rests, a rising curve (numbers from the official levels)
//   variety      not one chunk over and over (unless the brief says "repeat": true)
//   readability  spike-like decoration (18-21) never within 2 columns of a hazard
//   colour       a colour change per section (when the brief has sections)
//   sync         with a song: portals on bar starts, and not too many presses pinned to beats (WARN only)
//   lead-in      Easy/Normal: blocks from each mode portal to the first hazard after it, against
//                the medians of 63 rated 2.0-2.1 levels (knowledge/levels/modes_low_tier.md): cube 6,
//                ship 8, wave/robot 3, UFO 2 (Hard and up: 0). WARN under 60% of it.
//   skips        the solved run goes through every mode/gravity/speed portal (FAIL) and uses every
//                orb (WARN): a "secret way" past part of the level means a path should be blocked
//   fairness     no death that is not the player's fault (tools/fairness.js: forced input right after
//                a portal, a mark with no jump, a sloped floor at a portal exit, an orb chain with
//                nothing to correct, too-fast wave turns: FAIL; a blind two-step opener: WARN).
//                Fitted on the user's labelled deaths (DIFFICULTY.md "Fairness"). ~1 min more.
//   route        the shown (natural) route flies cleanly: a wave leg that takes more than one press
//                (inputs under 100 ms apart: FAIL, the corridor can't be flown in its native zigzag), or
//                flying ticks within 12 units of a wall (WARN). The user on GDLM 45: "way too many clicks
//                in these wave corridors. and way too close to the borders" (lib/natural.js routeCheck).
//                Also WARN: a press the route can drop and still finish (an arrow would mark a jump
//                that is not needed; the user on GDLM 44 v12, "some places mark to jump but no need").
//   objects      gameplay objects with unconfirmed hitboxes (sure:false; WARN only)
// Cost: two solves of the level (a few seconds for a 30 s cube level). One at a time.
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs");
const { GD, readGdlvl } = require("./io.js");
Object.assign(GD, require("../lib/difficulty.js"), require("../lib/sync.js"));
const { sightread } = require("./sightread.js");
const { chunks } = require("./style.js");

const LABELS = ["Easy", "Normal", "Hard", "Harder", "Insane", "Demon"];
const SPIKY_DECO = new Set([18, 19, 20, 21]);

function scoreLevel(level, brief, opts = {}) {
  brief = brief || {};
  const want = brief.difficulty || {};
  const minMs = want.minWindowMs ?? 60;
  const gates = [];
  const gate = (name, status, value, note) => gates.push({ name, status, value, note: note || "" });

  const w = GD.makeWorld(level.objects, level.header);
  const r = GD.solveAny(w);
  gate("beatable", r.ok ? "PASS" : "FAIL", r.ok ? `${r.clicks.filter(c => c.type === "press").length} presses` :
    `dies at block ${(r.dieAt.x / 30).toFixed(1)} (${r.why})`);
  const presses = r.ok ? r.clicks.filter(c => c.type === "press") : [];
  // the player's route (lib/natural.js: one tap per jump), computed once, shared by the gates that judge
  // the level as it is played: skips, hazards matter, reactive. null when it does not finish.
  let natCache;
  const natural = () => {
    if (natCache !== undefined) return natCache;
    natCache = null;
    try { const N = require("../lib/natural.js"), n = N.naturalPlan(w, r, level.objects); if (n && n.path[n.path.length - 1].done) natCache = { ok: true, events: n.events }; } catch (e) {}
    return natCache;
  };

  let bad = [];
  if (r.ok) {
    const s = sightread(level);
    bad = s.ok ? s.presses.filter(p => p.flag) : [];
    // approximate on levels with modes (sweep solver, fixed later inputs): a WARN, not a FAIL
    gate("prejumps", bad.length ? (s.approx ? "WARN" : "FAIL") : "PASS", bad.length ? bad.map(p => `block ${p.to.toFixed(0)} (${p.lead.toFixed(1)} ahead of ${p.cue} at ${p.cueAt.toFixed(0)})`).join("; ") + (s.approx ? " (approximate: level with modes)" : "") : "none");
  }

  // windows: the exact solver gives them per press; the sweep solver (ship, wave ... levels) does
  // not, so take lib/difficulty.js's measured windows for every input (press and release)
  let diff = null, pathCache = null;
  const runPath = () => pathCache || (pathCache = GD.run(w, r.events).path);
  if (r.ok) diff = GD.difficulty(w, r);
  const exact = presses.length && presses.every(c => c.ms > 0);
  const inputs = exact ? presses.map(c => ({ x: c.x, ms: c.ms, kind: "press" }))
    : (diff ? diff.actions.map(a => ({ x: (runPath()[a.tick] || {}).x || 0, ms: a.ms, kind: a.type || "input" })) : []);
  const tight = inputs.filter(c => c.ms < minMs);
  if (r.ok) gate("timing", tight.length ? "FAIL" : "PASS",
    inputs.length ? `tightest ${Math.min(...inputs.map(c => c.ms))} ms over ${inputs.length} inputs, want >= ${minMs}` + (exact ? "" : " (measured windows)") : "no inputs",
    tight.map(c => `block ${(c.x / 30).toFixed(0)} ${c.kind} ${c.ms} ms`).join("; "));

  // recovery: landing -> next press window
  const RECOVERY = { Easy: 150, Normal: 100 };
  const minRec = want.minRecoveryMs ?? RECOVERY[want.label] ?? null;
  let chains = [];
  if (r.ok && presses.length > 1) {
    const path = GD.run(w, r.events).path;
    for (let i = 1; i < presses.length; i++) {
      let t = presses[i - 1].tick + 2;
      while (t < path.length && !path[t].grounded) t++;
      if (t > presses[i].lo) continue; // pressed in the air (orbs): not a landing
      // only jumping modes land and jump again: a wave or ship touching a floor is not a landing (GDLM
      // 47's wave turns read as land-and-jump chains)
      if (!/^(cube|robot)$/.test((path[presses[i].tick] || {}).mode || "cube")) continue;
      // from landing to the LAST moment the next press still works: a window that opens on landing but
      // stays open is no chain (GDLM 47: a step 2 blocks past the landing read as "0 ms"); what kills is
      // having to press within ~100 ms of touching down (GDLM 42 v3)
      const ms = ((presses[i].hi ?? presses[i].lo) - t) / GD.PHYS.TPS * 1000;
      if (minRec != null ? ms < minRec : ms < 100) chains.push({ x: path[presses[i].tick].x, ms: Math.round(ms) });
    }
    gate("recovery", chains.length && minRec != null ? "FAIL" : chains.length ? "WARN" : "PASS",
      chains.length ? `${chains.length} press(es) right after landing` + (minRec != null ? ` (< ${minRec} ms)` : " (< 100 ms)") : `every press >= ${minRec ?? 100} ms after landing`,
      chains.map(c => `block ${(c.x / 30).toFixed(0)} ${c.ms} ms`).join("; "));
  }

  // static soft rules (deco coverage, symmetry, jump marks): staticRules() below, shared with tools/rules.js
  for (const g of staticRules(level)) gate(g.name, g.status, g.value, g.note);

  // height and repetition (the user on GDLM 47's upside-down part: "some sections are somewhat boring. all
  // in flat area. no change of height really ... robtop levels do show decent change of height in their
  // play, trying not to repeat exact gameplay for a long while"). tools/flow.js on the player's route, in
  // the jumping modes; targets from the 22 official levels (STRUCTURES.md "Height and repetition"):
  // floor changes >= 10 per 10 s (official median 13.6, lowest 8.1), median height range >= 3 blocks per
  // 10 s, no 10 s without a change, bare ground <= 45% of standing (official median 28%), repeated
  // 4-move patterns <= 5% (official ~0). WARN; levels with under 10 s of jumping play are not judged.
  if (r.ok) {
    const F = require("./flow.js").measure(level, (natural() || r).events), miss = [];
    if (F.jumpS >= 10) {
      if (F.changesPer10s < 10) miss.push(`${F.changesPer10s} floor changes per 10 s (want 10+)`);
      if (F.range != null && F.range < 3) miss.push(`height range ${F.range} blocks per 10 s (want 3+)`);
      if (F.flat10 > 0) miss.push(`${Math.round(F.flat10 * 100)}% of 10 s windows flat`);
      if (F.ground > 0.45) miss.push(`${Math.round(F.ground * 100)}% of standing on the bare floor (want 45% or less)`);
    }
    gate("height", miss.length ? "WARN" : "PASS", F.jumpS < 10 ? "under 10 s of jumping play: not judged" : miss.length ? miss.join("; ") : `${F.changesPer10s} changes per 10 s, range ${F.range}, ${Math.round(F.ground * 100)}% on the floor`);
    gate("repetition", F.jumpS >= 10 && F.repeat > 0.05 ? "WARN" : "PASS", F.repeat == null ? "no move patterns" : `${Math.round(F.repeat * 100)}% of 4-move patterns repeat within 10 s (want 5% or less)`);
  }

  // hazards matter: every hazard either needs an action or clearly reads as scenery (the user on GDLM 47
  // ~18.7 s, slabs over spike pairs crossed without a jump: "dunno if we have to jump or not, simulation
  // says we don't but then there is no point in those spikes"). On the player's route (lib/natural.js):
  // a hazard passed just over (within 2.5 rows: slabs keep the cube 2 rows up) while not in a jump --
  // walked across a gap above it. WARN. (A "never comes near" rule flagged every orb pit at 2x, whose
  // spikes do matter: left out.)
  if (r.ok) {
    const inert = inertHazards(level, w, natural() || r);
    gate("hazards matter", inert.length ? "WARN" : "PASS", inert.length ? `${inert.length} hazard group(s) that need no action` : "every hazard is part of the play",
      inert.map(s => `blocks ${s.a}-${s.b}: ${s.why}`).join("; "));
  }

  // reactive: cube parts are played on reaction, not memorised (the user on GDLM 45 v6, blocks 50-75:
  // "such pattern is awkward, as it creates very specific cube jumps I need to do, instead of being able
  // to react"). Flags (1) a landing on a spot at most 1 block wide (a lone block, a slab between spikes)
  // that forces the next press within 250 ms (to the end of its window); (2) 3+ presses in a row each
  // forced within 250 ms of its landing, whatever the width: a run of exact hops. FAIL at Easy/Normal,
  // else WARN. Levels with modes (sweep solver) have no windows: the planned press stands for it.
  const nr = r.ok ? natural() : null;
  const reactive = nr ? reactiveSpots(level, w, nr, nr.events.filter(e => e.type === "press").map(e => ({ tick: e.tick })), { natural: true }) : reactiveSpots(level, w, r, presses);
  if (r.ok) {
    const hard = want.label && !["Easy", "Normal"].includes(want.label);
    gate("reactive", reactive.length ? (want.label && !hard ? "FAIL" : "WARN") : "PASS",
      reactive.length ? `${reactive.length} spot(s) that need exact hops` : "every landing leaves room to react",
      reactive.map(s => `block ${s.block}: ${s.why}`).join("; "));
    // player timing: every input of the player's route (lib/natural.js, what the viewer and the game show)
    // with lib/windows.js's player window (later inputs re-planned; the same number as the viewer and
    // lib/difficulty.js: physics 05abaf7, tests/windows_shared.js). The timing gate above measures the
    // solver's route, which can take a different line: GDLM 47 v2 passed it at 113 ms while the player's
    // route had an 8 ms jump at block 67 (a spike, then a block 3 later: landing between them).
    if (nr) {
      try {
        const WI = require("../lib/windows.js"), np = GD.run(w, nr.events).path;
        const ws = (WI.inputWindows || GD.inputWindows)(w, nr.events, np, {}).map(x => ({ x: (np[x.tick] || {}).x || 0, t: x.tick / GD.PHYS.TPS, type: x.type, ms: Math.round((x.hi - x.lo + 1) / GD.PHYS.TPS * 1000) }));
        const pw = ws.filter(x => x.ms < minMs);
        if (ws.length) gate("player timing", pw.length ? "FAIL" : "PASS",
          `tightest ${Math.min(...ws.map(x => x.ms))} ms over ${ws.length} inputs on the player's route, want >= ${minMs}`,
          pw.map(x => `block ${(x.x / 30).toFixed(1)} (${x.t.toFixed(2)} s) ${x.type} ${x.ms} ms`).join("; "));
      } catch (e) { gate("player timing", "WARN", "lib/windows.js failed: " + e.message); }
    }
  }

  if (r.ok) {
    const lab = GD.difficultyLabel(diff.logAttempts);
    const off = want.label ? Math.abs(LABELS.indexOf(lab) - LABELS.indexOf(want.label)) : 0;
    gate("difficulty", off >= 2 ? "FAIL" : off === 1 ? "WARN" : "PASS",
      `${lab} (${diff.logAttempts.toFixed(2)} = ~${Math.round(10 ** diff.logAttempts)} attempts)` + (want.label ? `, want ${want.label}` : ""));
  }

  // pacing, from hazard columns
  const haz = level.objects.filter(o => GD.objInfo(o.id).kind === "hazard").map(o => Math.floor(o.x / 30)).sort((a, b) => a - b);
  const endCol = Math.max(...level.objects.map(o => o.x)) / 30;
  if (haz.length) {
    const startRest = haz[0], endRest = endCol - haz[haz.length - 1];
    let longest = 0, runStart = haz[0];
    for (let i = 1; i < haz.length; i++) if (haz[i] - haz[i - 1] > 6) { longest = Math.max(longest, haz[i - 1] - runStart); runStart = haz[i]; }
    longest = Math.max(longest, haz[haz.length - 1] - runStart);
    const third = endCol / 3;
    const d1 = haz.filter(c => c < third).length, d3 = haz.filter(c => c >= 2 * third).length;
    const probs = [];
    if (startRest < 10) probs.push(`start rest ${startRest} < 10 blocks`);
    if (endRest < 10) probs.push(`end rest ${endRest.toFixed(0)} < 10 blocks`);
    if (longest > 60) probs.push(`${longest} blocks with no 6-block rest`);
    if (d3 < d1) probs.push(`last third calmer than the first (${d3} vs ${d1} hazards)`);
    gate("pacing", probs.length ? "WARN" : "PASS", `start ${startRest}, end ${endRest.toFixed(0)}, longest busy ${longest}, hazards first/last third ${d1}/${d3}`, probs.join("; "));
  }

  // variety: how often the most common chunk shows up
  const ch = chunks({ objects: level.objects });
  if (ch.length >= 6) {
    const n = new Map();
    for (const c of ch) n.set(c.pic, (n.get(c.pic) || 0) + 1);
    const top = Math.max(...n.values());
    const share = top / ch.length;
    gate("variety", brief.repeat ? "PASS" : share > 0.5 || n.size < 3 ? "WARN" : "PASS",
      `${n.size} different chunks in ${ch.length}, most common ${Math.round(share * 100)}%` + (brief.repeat ? " (repetition intended)" : ""));
  }

  // readability: spike-looking decoration next to real hazards
  const hazCols = new Set(haz);
  const near = level.objects.filter(o => SPIKY_DECO.has(o.id)).filter(o => { const c = Math.floor(o.x / 30); return [-2, -1, 0, 1, 2].some(d => hazCols.has(c + d)); });
  gate("readability", near.length ? "FAIL" : "PASS", near.length ? `${near.length} spike-like decorations within 2 columns of a hazard` : "decoration clear of hazards");

  if (brief.sections) {
    const colourT = level.objects.filter(o => o.id === 899 || o.id === 29 || o.id === 30).length;
    const need = brief.sections.filter(s => s.bg).length;
    gate("colour", colourT >= need ? "PASS" : "WARN", `${colourT} colour triggers for ${need} coloured sections`);
  }

  // sync, loosely (the user: "too synced may sound forced", not every click is on the beat; the
  // official levels put portals on bar starts and barely lean presses to the beat -- SYNC.md
  // "How much to sync"). PASS when the mode/speed portals sit on bar starts and at most 60% of the
  // presses are pinned to a beat; WARN otherwise. Never a FAIL.
  if (brief.grid && r.ok) {
    const grid = Object.assign({}, brief.grid, { period: brief.grid.period || 60 / brief.grid.bpm, t0: brief.grid.t0 || 0 });
    const off = brief.offset || 0, down = brief.grid.downbeat || 0;
    const beatAt = sec => GD.SYNC.timeToBeat(grid, off, sec);        // 1 = the first beat
    const path = runPath();
    const tickAtX = x => { for (let t = 0; t < path.length; t++) if (path[t].x >= x) return t; return path.length - 1; };
    const portals = level.objects.filter(o => ["mode", "speed"].includes(GD.objInfo(o.id).kind));
    const onBar = portals.filter(o => { const b0 = beatAt(tickAtX(o.x) / GD.PHYS.TPS) - 1 - down; const m = ((b0 % 4) + 4) % 4; return Math.min(m, 4 - m) < 0.25; }).length;
    const pw = GD.SYNC.pressWindows(w, r.events);
    let pinned = 0, n = 0;
    if (pw) for (const p of pw.windows) { n++; const mid = beatAt((p.lo + p.hi) / 2 / GD.PHYS.TPS); if (Math.abs(mid - Math.round(mid)) * grid.period < 0.035) pinned++; }
    const portalsOk = portals.length < 2 || onBar / portals.length >= 0.5, pinOk = !n || pinned / n <= 0.6;
    gate("sync", portalsOk && pinOk ? "PASS" : "WARN",
      `${onBar}/${portals.length} portals on a bar start, ${pinned}/${n} presses centred on a beat`,
      [!portalsOk ? "portals off the bars: put mode/speed changes on bar starts" : "", !pinOk ? "most presses pinned to beats: can sound forced, loosen some" : ""].filter(Boolean).join("; "));
  }

  // lead-in after mode portals (low tiers only)
  if (["Easy", "Normal"].includes(want.label || "Easy")) {
    const LEAD = { cube: 6, ship: 8, wave: 3, robot: 3, ufo: 2, ball: 3, spider: 3, swing: 3 };
    const ports = level.objects.filter(o => GD.objInfo(o.id).kind === "mode").sort((a, b) => a.x - b.x);
    const hx = level.objects.filter(o => GD.objInfo(o.id).kind === "hazard").map(o => GD.hitbox(o)).filter(Boolean).map(h => h.x0).sort((a, b) => a - b);
    const short = [];
    for (const p of ports) {
      const m = GD.objInfo(p.id).mode, need = LEAD[m] || 3;
      const first = hx.find(x => x > p.x);
      if (first == null) continue;
      const lead = (first - p.x) / 30;
      if (lead < 0.6 * need) short.push(`${m} at block ${((p.x - 15) / 30).toFixed(0)}: ${lead.toFixed(1)} blocks (typical ${need})`);
    }
    if (ports.length) gate("lead-in", short.length ? "WARN" : "PASS", short.length ? short.join("; ") : `${ports.length} mode portals with a calm lead-in`);
  }
  // mode entry: a mode portal right at a raised block's end (or above its top) lets the player reach
  // it still on the block, and the new mode starts on a corner -- GDLM 44's wave: the user landed on
  // the 3-high block, touched the portal there without holding and died sliding off its end (physics
  // session, recording 2026-11-23 02:51; 92 ms to survive). The portal goes over open air instead.
  {
    const ports = level.objects.filter(o => GD.objInfo(o.id).kind === "mode" && GD.objInfo(o.id).mode !== "cube");
    const tops = level.objects.filter(o => GD.objInfo(o.id).kind === "solid").map(o => GD.hitbox(o)).filter(h => h && h.y1 > 2);
    const bad = ports.filter(p => tops.some(h => h.x1 >= p.x - 45 && h.x0 <= p.x + 15 && h.y1 <= p.y + 10 && h.y1 >= p.y - 60))
      .map(p => `${GD.objInfo(p.id).mode} at block ${((p.x - 15) / 30).toFixed(0)}`);
    if (ports.length) gate("mode entry", bad.length ? "WARN" : "PASS", bad.length ? bad.join("; ") + " sits at a raised block's end: the new mode can start on its corner" : "mode portals over open space");
  }

  // skips: which portals and orbs the solved run never touched -- and the player's route (lib/natural.js,
  // what the viewer and shoot.js show): GDLM 51's natural replay flew over the last cube portal that the
  // solver went through, and the level ended as a ship (showcase, 2026-11-23). A portal is missed when
  // either run misses it; an orb only when both do.
  if (r.ok) {
    const paths = [runPath()];
    if (natural()) paths.push(GD.run(w, natural().events).path);
    const touchedIn = (path, o) => {
      const hb = GD.hitbox(o); if (!hb) return true;
      for (let t = 0; t < path.length; t += 2) { const p = path[t]; if (p.x + 15 >= hb.x0 && p.x - 15 <= hb.x1 && p.y + 15 >= hb.y0 && p.y - 15 <= hb.y1) return true; }
      return false;
    };
    const portals = level.objects.filter(o => ["mode", "gravity", "speed"].includes(GD.objInfo(o.id).kind));
    const orbs = level.objects.filter(o => GD.objInfo(o.id).kind === "orb");
    const missedP = portals.filter(o => !paths.every(p => touchedIn(p, o))), missedO = orbs.filter(o => !paths.some(p => touchedIn(p, o)));
    gate("skips", missedP.length ? "FAIL" : missedO.length ? "WARN" : "PASS",
      missedP.length || missedO.length ? [...missedP, ...missedO].map(o => `${GD.objInfo(o.id).name} at block ${((o.x - 15) / 30).toFixed(0)}`).join("; ") + " not touched by the solved run: block that way past it" : `all ${portals.length} portals and ${orbs.length} orbs on the path`);
  }

  // deaths that would not be the player's fault (tools/fairness.js, fitted on the user's labelled
  // GDLM 44/46 deaths: forced inputs after a portal, misleading marks, sloped portal exits, orb
  // chains with nothing to correct, blind two-step openers, too-fast wave turns)
  if (r.ok && opts.fairness !== false) {
    const FA = require("./fairness.js"), fl = FA.flags(FA.analyse(w, r));
    const fail = fl.filter(f => f.severity === "FAIL");
    gate("fairness", fail.length ? "FAIL" : fl.length ? "WARN" : "PASS",
      fl.length ? fl.map(f => `${f.family} at block ${(f.x0 / 30).toFixed(0)}: ${f.note}`).join("; ") : "no unfair spots found");
  }

  if (r.ok && opts.route !== false) {
    const N = require("../lib/natural.js");
    let ev = r.events;
    try { const n = N.naturalPlan(w, r, level.objects); if (n && n.path[n.path.length - 1].done) ev = n.events; } catch (e) {}
    const st = N.routeCheck(w, ev, level.objects), jit = st.filter(x => x.shortLegs), close = st.filter(x => x.closeTicks);
    const extra = N.extraPresses(w, ev);
    if (extra.length) st.push({ mode: "presses not needed", from: extra[0].x, to: extra[extra.length - 1].x, presses: extra.length, closeTicks: 0, shortLegs: 0 });
    gate("route", jit.length ? "FAIL" : close.length || extra.length ? "WARN" : "PASS",
      st.length ? st.map(x => `${x.mode} ${(x.from / 30).toFixed(0)}-${(x.to / 30).toFixed(0)}: ${x.presses} presses` + (x.shortLegs ? `, ${x.shortLegs} legs under 100 ms` : "") + (x.closeTicks ? `, ${(x.closeTicks / 2.4).toFixed(0)} cs within 12 of a wall` : "")).join("; ") : "no flying parts",
      jit.length ? "a wave corridor that needs extra presses per leg: widen it or straighten it (tell style)" : "");
  }

  const unsure = level.objects.filter(o => { const d = GD.objInfo(o.id); return ["solid", "hazard", "orb", "pad", "slope"].includes(d.kind) && d.sure === false; });
  const ids = [...new Set(unsure.map(o => o.id))];
  gate("objects", unsure.length ? "WARN" : "PASS", unsure.length ? `${unsure.length} gameplay objects with unconfirmed hitboxes (ids ${ids.join(", ")})` : "all hitboxes confirmed");

  // soft rules (the user, 2026-11-23: "each fix to be somewhat a soft rule. and reapplied across the
  // level and anything in the future"): a brief may accept a gate with a stated reason,
  // "accept": {"<gate>": "<why this level breaks it>"}; the gate then reads ACCEPT and does not count.
  for (const g of gates) if (brief.accept && brief.accept[g.name] && g.status !== "PASS") { g.note = `accepted: ${brief.accept[g.name]}` + (g.note ? " -- " + g.note : ""); g.status = "ACCEPT"; }

  const fails = gates.filter(g => g.status === "FAIL").length, warns = gates.filter(g => g.status === "WARN").length;
  return { ok: fails === 0, fails, warns, gates, solution: r, prejumps: bad, tight, chains, difficulty: diff };
}

// the soft rules that need no route: deco coverage, symmetry, jump marks -> [{name, status, value, note}]
function staticRules(level) {
  const out = [], gate = (name, status, value, note) => out.push({ name, status, value, note: note || "" });
  // deco coverage: no empty patches (the user on GDLM 45 v6 at ~24.7 s: "some places are very empty in
  // deco"). Decoration objects per block in each screen-wide window (16 blocks, half-overlapping); a
  // window under HALF the level's own average is flagged (WARN; 45 v6: 1.1-1.4 against 2.8). Levels with almost no deco
  // (under 1 per block on average: the old plain look) are not judged.
  {
    const deco = level.objects.filter(o => GD.objInfo(o.id).kind === "decoration").map(o => o.x / 30);
    const endB = Math.max(...level.objects.map(o => o.x)) / 30, mean = deco.length / Math.max(1, endB);
    const thin = [];
    if (mean >= 1) for (let a = 0; a + 16 <= endB; a += 8) {
      const n = deco.filter(x => x >= a && x < a + 16).length / 16;
      if (n < mean / 2) thin.push(`blocks ${a}-${a + 16}: ${n.toFixed(1)}/block`);
    }
    gate("deco coverage", thin.length ? "WARN" : "PASS", mean < 1 ? `plain look (${mean.toFixed(1)} deco per block): not judged`
      : thin.length ? `${thin.length} stretch(es) under half the level's ${mean.toFixed(1)} deco per block` : `every screen within reach of the level's ${mean.toFixed(1)} deco per block`, thin.join("; "));
  }

  // symmetry: an orb over a row of floor (or ceiling) spikes sits over the row's centre, within half a
  // block (the user on GDLM 45 v6: "it's not pretty that the orbs are not symmetrical to their structure.
  // symmetry = good"). make.js's orb-pit centres itself; a hand-placed or chained orb is checked here. WARN.
  {
    const hz = level.objects.filter(o => GD.objInfo(o.id).kind === "hazard").map(o => ({ c: Math.round((o.x - 15) / 30), y: o.y }));
    const off = [];
    for (const o of level.objects.filter(o => GD.objInfo(o.id).kind === "orb")) {
      const oc = Math.round((o.x - 15) / 30);
      for (const yy of [...new Set(hz.map(h => h.y))]) {
        if (Math.abs(yy - o.y) > 150 || !hz.some(h => h.y === yy && Math.abs(h.c - oc) <= 0)) continue;
        let a = oc, b = oc;
        while (hz.some(h => h.y === yy && h.c === a - 1)) a--;
        while (hz.some(h => h.y === yy && h.c === b + 1)) b++;
        if (b - a < 2) continue;                                // a row of 3+
        const cx = (a + b) / 2 * 30 + 15;
        if (Math.abs(o.x - cx) > 15) off.push(`orb at block ${oc} over spikes ${a}-${b} (centre ${((cx - 15) / 30).toFixed(1)})`);
      }
    }
    gate("symmetry", off.length ? "WARN" : "PASS", off.length ? `${off.length} orb(s) off the centre of their spike row` : "orbs centred on their structures", off.join("; "));
  }

  // jump marks (decorate.js INDICATOR: id 460 on group 990): never over a hazard (an arrow pointing into a
  // spike reads as "jump onto it"), never two closer than 2 blocks (the user on GDLM 45 v5: "the second
  // indicator is wrong", marks crowding a stretch). WARN.
  {
    const marks = level.objects.filter(o => o.id === 460 && String((o.props || {})[57] || "").split(".").includes("990")).sort((a, b) => a.x - b.x);
    const hz = level.objects.filter(o => GD.objInfo(o.id).kind === "hazard");
    const bad = [];
    for (const m of marks) if (hz.some(h => Math.abs(h.x - m.x) < 15 && m.y > h.y && m.y - h.y < 75)) bad.push(`block ${((m.x - 15) / 30).toFixed(0)}: over a hazard`);
    for (let i = 1; i < marks.length; i++) if (marks[i].x - marks[i - 1].x < 60) bad.push(`blocks ${((marks[i - 1].x - 15) / 30).toFixed(0)}-${((marks[i].x - 15) / 30).toFixed(0)}: two marks under 2 blocks apart`);
    gate("jump marks", bad.length ? "WARN" : "PASS", marks.length ? (bad.length ? `${bad.length} mark(s) misplaced` : `${marks.length} marks, none over a hazard or crowded`) : "no jump marks", bad.join("; "));
  }

  return out;
}

// hazards no player action deals with (the "hazards matter" gate)
// r: the run to judge, best the player's route (scoreLevel passes lib/natural.js's)
function inertHazards(level, w, r) {
  const ev = r.events;
  const path = GD.run(w, ev).path, TPS = GD.PHYS.TPS, AIR = Math.round(0.45 * TPS);
  const pressT = ev.filter(e => e.type === "press").map(e => e.tick);
  const inJump = t => pressT.some(p => p <= t && t - p < AIR);
  const hz = level.objects.filter(o => GD.objInfo(o.id).kind === "hazard");
  const bad = [];
  for (const h of hz) {
    const near = [];
    for (let t = 0; t < path.length; t += 2) { const q = path[t]; if (Math.abs(q.x - h.x) <= 45) near.push([t, q]); }
    if (!near.length) continue;
    const over = near.filter(([t, q]) => Math.abs(q.x - h.x) < 15 && /^(cube|robot)$/.test(q.mode) && Math.abs(q.y - h.y) >= 15 && Math.abs(q.y - h.y) <= 75);
    if (over.length && over.every(([t]) => !inJump(t))) { bad.push({ c: Math.round((h.x - 15) / 30), why: "walked over without a jump (a gap above it is crossed on foot)" }); continue; }
  }
  // contiguous columns with the same reason -> one group
  bad.sort((a, b) => a.c - b.c);
  const out = [];
  for (const b of bad) { const g = out[out.length - 1]; if (g && g.why === b.why && b.c - g.b <= 1) g.b = b.c; else out.push({ a: b.c, b: b.c, why: b.why }); }
  return out;
}

// landings that force an exact hop (the "reactive" gate). Exported for tools/structures.js.
const REACT_MS = 250;
function reactiveSpots(level, w, r, presses, opts = {}) {
  if (!r || !r.ok) return [];
  // judged on the way a player plays it (lib/natural.js: one tap per jump), not the solver's fewest
  // clicks: the solver hops over a lone block that a player lands on
  if (!opts.natural) {
    try {
      const N = require("../lib/natural.js"), n = N.naturalPlan(w, r, level.objects);
      if (n && n.path[n.path.length - 1].done) { r = { ok: true, events: n.events }; presses = n.events.filter(e => e.type === "press").map(e => ({ tick: e.tick })); }
    } catch (e) {}
  }
  if (presses.length < 2) return [];
  const path = GD.run(w, r.events).path, TPS = GD.PHYS.TPS;
  const solids = [], hazards = [];
  for (const o of level.objects) {
    const d = GD.objInfo(o.id);
    if (d.kind === "solid" && !d.oneway) solids.push({ c: Math.floor(o.x / 30), top: o.y + (d.hit ? d.hit.h / 2 : 15) });
    else if (d.kind === "hazard") hazards.push({ c: Math.floor(o.x / 30), y: o.y });
  }
  // how many columns, from the landing one on, the surface at height `top` goes on with nothing deadly on it
  const width = (c0, top) => {
    let n = 0;
    for (let c = c0; c < c0 + 4; c++) {
      const floor = top <= 0.5 || solids.some(s => s.c === c && Math.abs(s.top - top) < 2);
      const wall = solids.some(s => s.c === c && s.top > top + 2 && s.top - 30 < top + 28);
      const spike = hazards.some(h => h.c === c && h.y > top && h.y < top + 30);
      if (!floor || wall || spike) break;
      n++;
    }
    return n;
  };
  const out = [];
  let run = [];
  // is the jump after this landing still alive when pressed REACT_MS after touching down? (the press and
  // its release moved later, every other input as planned; alive until the jump has landed or the next
  // planned press). Works the same on the exact solver's plan, the sweep's and a saved natural replay.
  const REACT = Math.round(REACT_MS / 1000 * TPS);
  const lateOk = (pressTick, at) => {
    const ev = r.events.map(e => ({ ...e })), k = ev.findIndex(e => e.type === "press" && e.tick === pressTick);
    if (k < 0) return true;
    const d = at - pressTick, rel = ev.findIndex((e, j) => j > k && e.type === "release");
    const next = ev.find((e, j) => j > k && e.type === "press");
    ev[k].tick += d;
    if (rel >= 0) ev[rel].tick = Math.max(ev[rel].tick + d, ev[k].tick + 1);
    if (next && next.tick <= ev[k].tick + 1) return false;      // the next input comes before it: a chain
    const res = GD.run(w, ev.sort((a, b) => a.tick - b.tick));
    const horizon = Math.min(at + Math.round(0.5 * TPS), next ? next.tick : Infinity);
    return !res.dead || res.path.length - 1 >= horizon;
  };
  // a jump over a spike must not also need timing around a block (the user on GDLM 45 v6, ~21.5 s: an
  // upside-down jump between hanging spikes with a ceiling step right after: "as if I need to time not to
  // hit the block ... ruins the flowy window"). The press is moved earlier and later (every other input as
  // planned); where the window ends because the cube hits a block or slope -- not the hazard -- and the
  // window is under 250 ms, or the block splits it in two, it is flagged.
  const SOLID = /^(block|block edge|slope)$/;
  const tryAt = (pressTick, at) => {
    const ev = r.events.map(e => ({ ...e })), k = ev.findIndex(e => e.type === "press" && e.tick === pressTick);
    const d = at - pressTick, rel = ev.findIndex((e, j) => j > k && e.type === "release");
    const next = ev.find((e, j) => j > k && e.type === "press"), prev = ev.slice(0, k).reverse().find(e => e.type === "release");
    if ((next && at >= next.tick - 1) || (prev && at <= prev.tick)) return { ok: false, why: "input order" };
    ev[k].tick = at;
    if (rel >= 0) ev[rel].tick = Math.max(ev[rel].tick + d, at + 1);
    const res = GD.run(w, ev.sort((a, b) => a.tick - b.tick));
    const horizon = Math.min(Math.max(at, pressTick) + Math.round(0.5 * TPS), next ? next.tick : Infinity);
    return { ok: !res.dead || res.path.length - 1 >= horizon, why: res.why || "" };
  };
  const SPAN = Math.round(0.2 * TPS), STEP = 2;
  for (const pr of opts.noWindows ? [] : presses) {   // opts.noWindows: skip the per-jump scan (fast sweeps)
    const q = path[pr.tick] || {};
    if (!/^(cube|robot)$/.test(q.mode || "cube")) continue;
    const res = [];
    for (let d = -SPAN; d <= SPAN; d += STEP) res.push({ d, ...tryAt(pr.tick, pr.tick + d) });
    const i0 = res.findIndex(x => x.d === 0);
    if (!res[i0].ok) continue;
    let a = i0, b = i0;
    while (a > 0 && res[a - 1].ok) a--;
    while (b < res.length - 1 && res[b + 1].ok) b++;
    const ms = (res[b].d - res[a].d + STEP) / TPS * 1000;
    // a block on one side of the window and the hazard on the other: the jump clears a hazard AND must
    // be timed around a block. (A plain step jump ends at the block's face by nature: not flagged.)
    const HAZ = /^(spike|saw)$/;
    const lo = a > 0 ? res[a - 1].why : "", hi = b < res.length - 1 ? res[b + 1].why : "";
    const cutLo = SOLID.test(lo) && HAZ.test(hi), cutHi = SOLID.test(hi) && HAZ.test(lo);
    const split = res.some((x, j) => x.ok && (j < a - 1 || j > b + 1)) && (SOLID.test(lo) || SOLID.test(hi));
    if ((cutLo || cutHi) && ms < REACT_MS || split) out.push({ block: Math.floor(q.x / 30),
      why: `the jump over a hazard must also be timed around a block: its window (${Math.round(ms)} ms) is ${split ? "split" : "cut"} by a ${SOLID.test(hi) ? hi : lo}` });
  }
  for (let i = 1; i < presses.length; i++) {
    let t = presses[i - 1].tick + 2;
    while (t < path.length && !path[t].grounded) t++;
    const p = path[Math.min(t, path.length - 1)] || {};
    const landed = t <= presses[i].tick && /^(cube|robot)$/.test(p.mode || "cube") && p.grav !== -1;
    if (!landed) { run = []; continue; }
    const forced = presses[i].tick < t + REACT && !lateOk(presses[i].tick, t + REACT);
    const col = Math.floor(p.x / 30), wd = width(col, Math.round(p.y - 15));
    if (forced && wd <= 1) out.push({ block: col, why: `lands on a ${wd || "<1"}-block spot and must jump again within ${REACT_MS} ms` });
    if (forced) { run.push(col); if (run.length === 3) out.push({ block: run[0], why: `3+ hops in a row, each forced within ${REACT_MS} ms of landing (blocks ${run.join(", ")})` }); }
    else run = [];
  }
  // spike then a step: a floor hazard the route jumps, then the floor rising (a step, a wall) where that
  // jump comes down -- from 2 blocks past the hazard to its landing (half a jump) plus 250 ms of run. The
  // player either lands and must jump at once or must time the first jump to land on top (the user on
  // GDLM 47 ~29.3 s: "the same awkward jump, where you fall before a hill and it's hard to calculate where
  // you need to jump"). Fine: the step right after the spike (one jump lands on it), or farther away.
  // Jump length per speed from lib/physics.js: 0.5x 3.5, 1x 4.5, 2x 5.7, 3x 6.7 blocks; 0.43 s in the air.
  const byCol = new Map();
  for (const s of solids) { if (!byCol.has(s.c)) byCol.set(s.c, []); byCol.get(s.c).push(s.top); }
  const floorTop = (c, below) => Math.max(below <= 0.5 ? 0 : -1, ...(byCol.get(c) || []).filter(t => t <= below + 2));
  const seen = new Set();
  for (const h of hazards) {
    const ti = path.findIndex(q => q.x >= h.c * 30 + 15);
    const q = path[ti]; if (!q || !/^(cube|robot)$/.test(q.mode) || q.grav === -1) continue;
    const f = Math.max(0, ...(byCol.get(h.c) || []).filter(t => t <= h.y)), vx = ti > 0 ? (q.x - path[ti - 1].x) * TPS : 0;
    if (h.y > f + 30 || vx <= 0) continue;                       // a floor hazard only
    const L = 0.43 * vx / 30, zone = L / 2 + 0.25 * vx / 30;
    for (let c = h.c + 1; c <= h.c + Math.ceil(zone); c++) {
      if (hazards.some(z => z.c === c && z.y > f && z.y < f + 30)) break;   // more spikes: one wider jump
      const rise = (byCol.get(c) || []).some(t => t > f + 2 && t - 30 < f + 2);
      if (!rise) { if (floorTop(c, f) < f - 2) break; continue; }   // a drop ends it
      if (c - h.c >= 2 && !seen.has(c)) { seen.add(c); out.push({ block: h.c, why: `a spike then a step ${c - h.c} blocks after it: the jump comes down right before the step (put the step right after the spike, or ${Math.ceil(zone) + 1}+ blocks away)` }); }
      break;
    }
  }
  const res = out.filter((s, i, a) => a.findIndex(z => z.block === s.block && z.why === s.why) === i);
  return res;
}

function print(name, s) {
  console.log(`== ${name}: ${s.ok ? "READY" : "NOT READY"} (${s.fails} fail, ${s.warns} warn)`);
  for (const g of s.gates) console.log(`   ${g.status.padEnd(4)} ${g.name.padEnd(11)} ${g.value}${g.note ? "  -- " + g.note : ""}`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const bi = args.indexOf("--brief");
  const brief = bi >= 0 ? JSON.parse(fs.readFileSync(args[bi + 1], "utf8")) : null;
  const files = args.filter((a, i) => a.endsWith(".gdlvl") && args[i - 1] !== "--brief");
  if (!files.length) { console.log("usage: node tools/score.js <level.gdlvl> [--brief briefs/NN.json] [--json]"); process.exit(1); }
  let bad = 0;
  for (const f of files) {
    const L = readGdlvl(f);
    const s = scoreLevel(L.level, brief);
    if (args.includes("--json")) console.log(JSON.stringify({ name: L.name, ok: s.ok, gates: s.gates }));
    else print(L.name, s);
    if (!s.ok) bad++;
  }
  process.exit(bad ? 2 : 0);
}
module.exports = { scoreLevel, print, reactiveSpots, inertHazards, staticRules };
