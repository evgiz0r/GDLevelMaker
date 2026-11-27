// node tools/indstyles.js list                 the jump indicator styles
// node tools/indstyles.js spec [--out specs/lab_indicators.json]   the gallery level (then: node tools/make.js <it>)
//
// JUMP INDICATOR STYLES (DECOART.md "Indicator styles"; Evgeni 2026-11-26: "and stylish indicator, maybe regardless of the
// designs ( dont want to confuse blocks and indicators imo )"). A style is a few flat pieces round the mark's spot, all in
// the indicator group (decorate.js INDICATOR.group, faded soft by its alpha trigger) and on the indicator's own channel
// (white 1011 unless the spec says), never in a block's or spike's colours, never shaped like a hazard: small, soft, above
// the play. One style for the whole level (knowledge/checklist.md "One block design and one spike design at a time").
//   expand(marks, opts)  -> each single mark from decorate.js jumpIndicators replaced by its style's pieces;
//                           opts.style a name, or [[column, name], ...] (from that column on; the gallery uses it; "none" = no marks)
// Spec: "indicators": {"style": "caret"} (make.js; id / ch / scale as before).
//   "colour": "auto" -> a soft colour of its own on channel CH (970), its hue opposite the level's hazard colours (the
//   hazards' channels and their spike-design dressing within a block), so a mark never reads as part of a spike
//   (Evgeni: "indicators can also have color ingame, probably something different from the hazard spike design of that
//   level"); [r, g, b] = that colour. Without it: white (1011).
//   colourFor(objects, header) -> {rgb, hazardHue, why}; applyColour(objects, header, opts) -> header with channel 970.
// Pieces point DOWN at the surface for a normal jump; upside down the whole piece set turns over.
"use strict";
const K = require("./scenekit.js");

// each style: (put) -> put(id, dx, dy, {rot, s, sx, sy, dim}) in units round the mark's centre, pointing down
const STYLES = {
  chevron: { note: "the classic: one d_arrow_02 turned to point down (the default)", draw(put) { put(460, 0, 0, { rot: 90, s: 0.7 }); } },
  "double chevron": { note: "two small chevrons, the upper one dimmer: a soft 'down, down'", draw(put) {
    put(460, 0, -5, { rot: 90, s: 0.5 }); put(460, 0, 7, { rot: 90, s: 0.5, dim: 0.5 }); } },
  caret: { note: "a thin line 'v', two strokes: crisp and light", draw(put) {
    for (const sx of [-1, 1]) put(211, sx * 3.5, 0, { rot: -sx * 45, sx: 0.36, sy: 0.08 }); } },
  drop: { note: "a falling drop: a dot with a fading line above it", draw(put) {
    put(1764, 0, -6, { s: 1.1 }); put(211, 0, 5, { sx: 0.06, sy: 0.4, dim: 0.6 }); put(211, 0, 13, { sx: 0.05, sy: 0.15, dim: 0.35 }); } },
  halo: { note: "a small dot in a faint glow (kept small: a big round mark reads as an orb)", draw(put) { put(497, 0, 0, { s: 0.24, dim: 0.25 }); put(1764, 0, 0, { s: 0.9 }); } },
  spark: { note: "a little four-point star: 'here', no direction", draw(put) {
    put(211, 0, 0, { sx: 0.5, sy: 0.07 }); put(211, 0, 0, { sx: 0.07, sy: 0.5 }); put(211, 0, 0, { s: 0.16, rot: 45, dim: 0.7 }); } },
  pointer: { note: "a small solid triangle pointing down over a dim glow", draw(put) {
    put(497, 0, 2, { s: 0.3, dim: 0.25 }); put(693, 0, 3, { rot: 45, s: 0.3 }); } },
  bracket: { note: "a line 'v' with a dot under its tip", draw(put) {
    for (const sx of [-1, 1]) put(211, sx * 3, 4, { rot: -sx * 45, sx: 0.3, sy: 0.07, dim: 0.7 }); put(1764, 0, -5, { s: 0.8 }); } },
};

const styleAt = (opts, x) => {
  const s = opts && opts.style;
  if (!Array.isArray(s)) return s || "chevron";
  let cur = s.length ? s[0][1] : "chevron";
  for (const [c, n] of s) if (x >= c * 30) cur = n;
  return cur;
};
// marks (decorate.js jumpIndicators output: {id, x, y, rot, props}) -> style pieces
function expand(marks, opts = {}) {
  const IND = require("./decorate.js").INDICATOR;
  const out = [];
  for (const m of marks) {
    const name = styleAt(opts, m.x);
    if (name === "chevron" && !opts.style) { out.push(m); continue; }   // the old single mark, unchanged
    if (name === "none") continue;   // a stretch with no marks (the gallery's outro)
    const st = STYLES[name]; if (!st) throw new Error("no indicator style " + name);
    const down = ((m.rot - (opts.rot ?? IND.rot)) % 360 + 360) % 360 < 90;   // jumpIndicators adds 180 upside down
    const k = (opts.scale ?? IND.scale) / IND.scale, ch = opts.chAt ? opts.chAt(m.x) : (opts.ch ?? IND.ch), g = opts.group ?? IND.group;
    st.draw((id, dx, dy, o = {}) => {
      const p = K.obj(id, m.x + dx * k, m.y + (down ? dy : -dy) * k, { ch, z: "T2", zo: 20, groups: [g],
        s: o.s != null ? o.s * k : undefined, sx: o.sx != null ? o.sx * k : undefined, sy: o.sy != null ? o.sy * k : undefined,
        rot: down ? (o.rot || 0) : (o.rot || 0) + 180, hsv: o.dim ? `0a1a${o.dim}a0a0` : null });
      if (m.why) p.why = m.why;
      out.push(p);
    });
  }
  return out;
}

// the gallery: a flat run, a spike to jump every 7 blocks, each style on 4 jumps (one of them upside down would need a
// gravity portal: kept to normal jumps), its name over it
function spec() {
  const objects = ["// every jump indicator style on four jumps each; flat run"], styles = [], per = 4, gap = 9;
  let c = 14;
  for (const name of Object.keys(STYLES)) {
    styles.push([c - 3, name]);
    for (let i = 0; i < per; i++) objects.push(["spike", c + i * gap, 0]);
    c += per * gap + 6;
  }
  styles.push([c - 3, "none"]);
  return {
    name: "GDLM indicator styles", desc: "Jump indicator styles, apart from block and spike designs (tools/indstyles.js).",
    notes: "Evgeni 2026-11-26: 'stylish indicator, maybe regardless of the designs ( dont want to confuse blocks and indicators imo )'; DECOART.md 'Indicator styles'",
    colours: { bg: [12, 16, 34], ground: [5, 7, 16] }, indicators: { style: styles, colour: "auto" }, scene: "tools/scenes/indgallery.js",
    labels: styles, outro: 76, signature: {}, objects,
  };
}

// ---- colour: away from the hazards ----
const CH = 970;
function rgbHsv([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [((h * 60) + 360) % 360, mx ? d / mx : 0, mx]; }
function hsvRgb(h, s, v) { const f = n => { const k = (n + h / 60) % 6; return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1)))); }; return [f(5), f(3), f(1)]; }
function colourFor(objects, header) {
  const GD = Object.assign({}, require("../lib/objects.js")), LOOK = require("../lib/look.js").LOOK || require("../lib/look.js");
  const col = LOOK.headerColours(header), kind = id => (GD.objInfo ? GD.objInfo(id).kind : "");
  const haz = objects.filter(o => kind(o.id) === "hazard");
  // the hazards' own channel, and deco dressing a hazard (spike designs: within 20 units of one)
  const chans = haz.map(o => +((o.props && o.props[21]) || 1004));
  const hx = haz.map(o => [o.x, o.y]);
  for (const o of objects) if (kind(o.id) === "decoration" && o.props && o.props[21] && hx.some(([x, y]) => Math.abs(o.x - x) < 20 && Math.abs(o.y - y) < 20)) chans.push(+o.props[21]);
  let sx = 0, sy = 0, wsum = 0;
  for (const ch of chans) { const c = col[ch]; if (!c) continue; const [h, s, v] = rgbHsv(c), w = s * v;
    sx += Math.cos(h * Math.PI / 180) * w; sy += Math.sin(h * Math.PI / 180) * w; wsum += w; }
  if (!chans.length || wsum / chans.length < 0.15) return { rgb: hsvRgb(190, 0.45, 1), hazardHue: null, why: "hazards have no colour (white / grey): a soft cyan" };
  const hh = (Math.atan2(sy, sx) * 180 / Math.PI + 360) % 360, h = (hh + 180) % 360;
  return { rgb: hsvRgb(h, 0.5, 1), hazardHue: Math.round(hh), why: `hazards at hue ${Math.round(hh)}: the opposite hue ${Math.round(h)}, soft` };
}
// put the colour channel in the header and the marks on it (the pieces carry opts.ch, so call before expand, or pass ch)
// opts.colour: "auto", [r, g, b], or per section [[column, "auto" | [r, g, b]], ...] (design themes: each section's marks
// opposite ITS hazards); sections take channels 970, then 960-969. Returns chAt(x) for expand().
const CHS = [CH, 960, 961, 962, 963, 964, 965, 966, 967, 968, 969];
function applyColour(objects, header, opts = {}) {
  if (!opts.colour) return { header, ch: null };
  const per = Array.isArray(opts.colour) && Array.isArray(opts.colour[0]) ? opts.colour : [[0, opts.colour]];
  const xs = per.map(p => p[0] * 30), why = [], rgbs = [];
  per.forEach(([c0, col], i) => {
    const x0 = xs[i], x1 = i + 1 < xs.length ? xs[i + 1] : Infinity;
    const c = col === "auto" ? colourFor(objects.filter(o => o.x >= x0 && o.x < x1), header) : { rgb: col, why: "given" };
    header = K.channels(header, { [CHS[i]]: { rgb: c.rgb } }); rgbs.push(c.rgb); why.push(per.length > 1 ? `from ${c0}: ${c.why}` : c.why);
  });
  const chAt = x => { let k = 0; xs.forEach((x0, i) => { if (x >= x0 - 1) k = i; }); return CHS[k]; };
  return { header, ch: CH, chAt, rgb: rgbs[0], why: why.join("; ") };
}

module.exports = { STYLES, expand, styleAt, spec, colourFor, applyColour, CH };
if (require.main === module) {
  const a = process.argv.slice(2);
  if (a[0] === "list") for (const [n, s] of Object.entries(STYLES)) console.log(n.padEnd(16) + s.note);
  else if (a[0] === "spec") { const out = a.includes("--out") ? a[a.indexOf("--out") + 1] : "specs/lab_indicators.json";
    require("fs").writeFileSync(out, JSON.stringify(spec(), null, 1) + "\n"); console.log("wrote " + out); }
  else console.log(require("fs").readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n"));
}
