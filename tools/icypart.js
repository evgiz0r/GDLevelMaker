// node tools/icypart.js [--bays 5] [--seed 1] > specs/74_icy_part.json
// A short icy part with almost no gameplay (deco-art thread, Evgeni 2026-11-26: "a small part with icy deco, really like
// almost no gameplay. but decent amount of spikes bricks and deco, in some coherent not too random way").
// One structure repeated as "bays" with small variations, so the spikes and blocks read as designed, not scattered:
//   floor     a one-block ice walkway the player runs on (row 0), entered by one step jump
//   pit       each bay ends in a 3-wide gap with a row of pit spikes (the bay's one click)
//   ceiling   a hanging ice mass (rows 7-8) with a full row of icicle spikes under it (row 6, out of jump reach), stepped at
//             its ends; it arches up (row 8 only, no spikes) over each pit, so the opening frames the jump
//   accents   bay 3 swaps the pit for a double floor spike, bay 4 widens the pit to 4 with a spike on its far lip
// Then the ice theme (tools/scenes/theme.js), the outro and the signature. Dress further with tools/decoart.js + decofx.js.
"use strict";
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? +args[i + 1] : d; };
const BAYS = opt("--bays", 5), W = 32, X0 = 10, LOW0 = args.includes("--low"), MIX = args.includes("--mix");
// --low: the tunnel version (v2): icicles at row 3, a block over the running cube, so they guard the lane as rated levels
//   do (HAZARDS.md: guard above 10-23% of hazards; v1's row-6 icicles counted as fill), the arch opens wider over each jump
// --mix (v3): low tunnel in every other bay, high cave between (v2 had 86% of hazards guarding from above, rated 10-23%)
const o = [];
const put = (t, c, r, e) => o.push(e ? [t, c, r, e] : [t, c, r]);
o.push("// intro: ground, then the step onto the walkway");
const end = X0 + BAYS * W;
for (let b = 0; b < BAYS; b++) {
  const LOW = MIX ? b % 2 === 1 : LOW0, SP = LOW ? 3 : 6, M1 = SP + 1, M2 = SP + 2, AW = LOW ? 3 : 2;
  const c0 = X0 + b * W, accent = b === 2 ? "double" : b === 3 ? "wide" : "pit";
  const gap = accent === "wide" ? 4 : accent === "pit" ? 3 : 0, g0 = c0 + W - (LOW ? 9 : 6);   // pit columns g0 .. g0+gap-1
  o.push(`// bay ${b + 1}: ${accent}`);
  for (let c = c0; c < c0 + W; c++) {
    const inGap = gap && c >= g0 && c < g0 + gap;
    if (!inGap) put("block", c, 0); else put("spike", c, 0);
    // ceiling: arch over the pit (and over the double spike), stepped ends, icicles under the mass
    const FAR = LOW && accent === "wide" ? 2 : 0;   // the wide pit + lip spike lands later
    const k = c - c0, arch = (gap ? c >= g0 - AW && c < g0 + gap + AW + FAR : k >= 10 - AW && k < 13 + AW);
    if (arch) { put("block", c, LOW ? 6 : 8); if (LOW) put("block", c, 7); continue; }
    put("block", c, M2); put("block", c, M1); if (LOW) for (let r = M2 + 1; r <= 7; r++) put("block", c, r);
    const edge = (gap ? c === g0 - AW - 1 || c === g0 + gap + AW + FAR : k === 9 - AW || k === 13 + AW) || k === 0;
    put(edge ? "small spike" : "spike", c, SP, { rot: 180 });
  }
  if (accent === "double") { put("spike", c0 + 11, 1); put("spike", c0 + 12, 1); }
  if (accent === "wide") put("small spike", g0 + gap, 1);
}
// the walkway ends: step down to the ground
const spec = {
  name: MIX ? "GDLM 74 icy part v3" : LOW0 ? "GDLM 74 icy part v2" : "GDLM 74 icy part", desc: "A short icy stretch, almost no gameplay: deco, spikes and ice structure (deco-art lab).",
  notes: "tools/icypart.js; Evgeni 2026-11-26: a small icy part, little gameplay, coherent spikes, bricks and deco, to compare with rated levels",
  song: { custom: 1290936 }, offset: 0, grid: { bpm: 140.022, t0: 0.0794 },
  colours: { bg: [8, 18, 46], ground: [3, 8, 22] },
  scene: "tools/scenes/theme.js", theme: { name: "ice", variant: "caves" },
  outro: 74, signature: {},
  objects: [...o, ["block", end, 0]].slice(0, -1),
};
process.stdout.write(JSON.stringify(spec, null, 1) + "\n");
