// The lego catalogue's "Designs" tab (published as designs.js beside designs.json and cards/; tools/designs.js page).
// Loaded only when the tab is first opened, so the structures view pays nothing for it. One small card per design (fire
// beside ice for blocks), 👍 / 👎 and a comment on the card itself (theme scenes also take 📍 marks: a spot + a note,
// collection "designmarks", read by tools/designs.js marks; a note saves as it is typed; Claude sets seen + reply on a mark
// it has read (folded away) and deletes it once fixed; 📨 sends a theme's open marks to Claude as a comment); votes go to the page's database, collection
// "designvotes" (read back with tools/designs.js votes). Every group is collapsible (the catalogue UI rule, CLAUDE.md).
window.initDesigns = async function (root) {
  "use strict";
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const css = `
  #designs .dgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin:8px 0 18px}
  #designs .dc{background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden}
  #designs .dc img{display:block;width:100%;aspect-ratio:2/1;object-fit:cover;background:#0f0c2b}
  #designs .dc.k-spike img,#designs .dc.k-saw img,#designs .dc.k-indicator img{aspect-ratio:auto}
  #designs .dc.k-structure,#designs .dc.k-theme{grid-column:1/-1}
  #designs .dc .wide{overflow-x:auto;background:#0f0c2b;-webkit-overflow-scrolling:touch}
  #designs .dc .wide img{width:auto;height:130px;max-width:none;aspect-ratio:auto}
  #designs .k-theme .wide img{height:var(--zh,220px)}
  #designs .lyh{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:6px 8px;font-size:12px}#designs .lfold{cursor:pointer;color:var(--mute)}
  #designs .lyh button{background:#241d3d;color:#ddd;border:1px solid #444;border-radius:6px;padding:2px 7px;font-size:12px}#designs .lyh .pen.on{outline:2px solid currentColor}
  #designs .ink{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none}#designs .ink.on{pointer-events:auto;cursor:crosshair;touch-action:none;outline:2px dashed #ffd84d}
  #designs .tiles .grid line{stroke:#ffffff30;stroke-width:1px;vector-effect:non-scaling-stroke}#designs .plr{position:absolute;left:0;top:0;background:#c8ff3c;border:2px solid #10301a;box-sizing:border-box;pointer-events:none;z-index:5}#designs .plr[data-m="1"]{border-radius:40% 70% 70% 40%}#designs .plr[data-m="2"]{border-radius:50%}#designs .zb .aplay,#designs .zb .aspd{min-width:28px}#designs .tiles{cursor:pointer;display:block;touch-action:none;background:#1a1636;max-width:none}#designs .lay .wide{padding:4px 8px}#designs .ptool.on{outline:2px solid #ffd84d}
  #designs .lpn{font-size:11px;color:var(--mute);padding:2px 8px}#designs .lay{margin:6px 0 14px}#designs .lpt.on{outline:1px solid #7be38a}
  #designs .board.fs{position:fixed;inset:0;z-index:1000;background:#0f0c2b;overflow:auto}#designs .board.fs .wide{overflow:auto}
  #designs .lk.blank img{visibility:hidden}#designs .lk.blank{background:#1a1636;background-image:linear-gradient(#ffffff10 1px,transparent 1px),linear-gradient(90deg,#ffffff10 1px,transparent 1px);background-size:20px 20px}
  #designs .pens{display:flex;flex-wrap:wrap;gap:4px;align-items:center}#designs .pcol{width:22px;height:22px;padding:0!important;border-radius:11px!important}#designs .pcol.on,#designs .pw.on,#designs .perase.on{outline:2px solid #ffd84d}
  #designs .pany{width:26px;height:24px;padding:0;border:0;background:none}#designs .pw i{display:block;width:16px;background:#ddd;border-radius:2px}
  #designs .ink polyline{fill:none;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
  #designs .zw{position:relative}#designs .zb{position:absolute;right:6px;top:6px;display:flex;gap:4px}
  #designs .zb button{width:30px;height:30px;border-radius:15px;border:1px solid #555;background:#1b1538cc;color:#fff;font:700 16px/1 system-ui}
  #designs .mk{position:relative;display:inline-block;line-height:0}#designs .mk img{display:block}
  #designs .mk.on{cursor:crosshair;outline:2px dashed #ffd84d}
  #designs .pin{position:absolute;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;background:#ffd84d;color:#000;font:700 11px/20px system-ui;text-align:center;border:2px solid #000;pointer-events:none}
  #designs .mks{font-size:12px;margin:4px 0}
  #designs .mks-b>[data-m]{display:flex;gap:6px;align-items:center;margin:3px 0}#designs .mks-b>[data-m]>b{flex:0 0 auto;width:14px;text-align:right}
  #designs .mks input{flex:1;min-width:0;background:#141024;color:#eee;border:1px solid #444;border-radius:6px;padding:4px 6px}
  #designs .pin.seen{background:#7be38a;opacity:.7}
  #designs .mks-h{display:flex;gap:8px;align-items:center;padding:0 8px 6px}#designs .mfold{cursor:pointer;color:var(--mute)}
  #designs .mks-b{display:block;max-height:180px;overflow:auto;padding:0 8px 6px}
  #designs .mseen-h{cursor:pointer;color:var(--mute);margin:4px 0}#designs .mks-b>.mseen{display:grid;grid-template-columns:14px 1fr auto;gap:2px 6px;align-items:start;color:var(--mute);padding:4px 0;border-top:1px solid #2a2450}#designs .mseen>span{grid-column:2}#designs .mseen>i{grid-column:2;color:#9fd6a8}#designs .mseen>.mdel{grid-column:3;grid-row:1}
  #designs .msend{margin-top:4px}
  #designs .mks button{flex:0 0 auto;background:#241d3d;color:#ddd;border:1px solid #444;border-radius:6px;padding:1px 6px;font-size:11px;line-height:16px}#designs .mks .mst{flex:0 0 auto}
  #designs .dc .dt{padding:6px 8px;font-size:13px;line-height:1.3}
  #designs .dc .dn{font-weight:700}
  #designs .dc .dm{color:var(--mute);font-size:12px}
  #designs .dv{display:flex;gap:6px;align-items:center;padding:0 8px 8px;flex-wrap:wrap}
  #designs .dv button{min-height:36px;padding:4px 10px;font-size:16px;background:var(--panel);color:var(--ink);border:1px solid var(--line)}
  #designs .dv button.on.up{background:#1f6b3a;border-color:#7dff9c}#designs .dv button.on.down{background:#7a1f33;border-color:#ff9db0}
  #designs .dv textarea{flex:1 1 100%;min-height:38px;font:14px Archivo,sans-serif;background:#16123a;color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:6px}
  #designs .ds{font-size:12px;color:var(--mute)}
  #designs .dbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:4px 0 6px}`;
  document.head.insertAdjacentHTML("beforeend", `<style>${css}</style>`);
  root.innerHTML = `<div class="dbar"><select id="dvf"><option value="">any vote</option><option value="up">👍 liked</option><option value="down">👎 disliked</option><option value="none">not voted yet</option></select><span class="ds" id="dcount"></span></div><div id="dgroups">loading ...</div>`;
  let L = [];
  try { L = await (await fetch("designs.json", { cache: "no-store" })).json(); } catch (e) { root.querySelector("#dgroups").textContent = "designs.json did not load"; return; }
  let VOTES = {}, DB = null, CM = null, CAN_SEND = false, MODE = "designs", MARKS = [], MARKING = null;
  // typed mark notes not yet confirmed by the database: they win over snapshots, so a re-render never drops text
  const PENS = { block: "#ffffff", hazard: "#ff5a5a", note: "#ffd84d" }, PENL = { block: "▭ block", hazard: "▲ hazard", note: "✎ note" };
  let DRAWING = null, PEN = "block", PCOL = "#ffffff", PW_ = 4, ERASE = false, FS = null; const DRAW = {}, DST = {}, BG = {};
  const COLS = ["#ffffff", "#ff5a5a", "#ffd84d", "#5ad1ff", "#7be38a", "#ff9a3c", "#c77dff", "#111111"];
  const PEND = {}, MST = {}; let saveT = null, lastKey = 0, holdT = null;
  // claude.ai refuses a send-to-Claude within ~6 s of a key typed in the page ("Not sent to Claude. Your last key or click
  // may not have been meant for this artifact"), so 📨 waits out the typing with a countdown (Evgeni 2026-11-27)
  const HOLD = 6500;
  function holdSend() { clearInterval(holdT); const tick = () => { const left = HOLD - (Date.now() - lastKey);
      for (const b of root.querySelectorAll(".msend")) { b.disabled = left > 0; b.textContent = left > 0 ? `📨 in ${Math.ceil(left / 1000)} s` : b.dataset.label || b.textContent; }
      if (left <= 0) clearInterval(holdT); };
    for (const b of root.querySelectorAll(".msend")) if (!b.dataset.label) b.dataset.label = b.textContent;
    tick(); holdT = setInterval(tick, 500); }
  // a mark is sent once: 📨 sends only marks never sent, or whose note changed since (no repeats; Evgeni 2026-11-27)
  const unsent = m => !m.seen && noteOf(m).trim() && m.sentNote !== noteOf(m).trim();
  const noteOf = m => PEND[m.mid] !== undefined ? PEND[m.mid] : (m.note || "");
  // EVERY SAVE IS A NEW DOCUMENT (a revision: id = mark id + "-" + time, field mid = the mark): rewriting a mark's own
  // document never landed from the page (2026-11-27: every note stayed "" while creating worked), so nothing is ever
  // overwritten; a reader takes each mark's newest revision by `at` (rev), `deleted: true` is a removal. Claude's seen /
  // reply are revisions too. tools/designs.js marks reads it the same way.
  const putRev = m => DB.collection("designmarks").doc(m.mid + "-" + Date.now().toString(36)).set(Object.assign({}, m, { at: new Date().toISOString() }));
  const latest = docs => { const by = new Map(); for (const d of docs) { if (!d || !d.mid) continue; const o = by.get(d.mid); if (!o || String(d.at) >= String(o.at)) by.set(d.mid, d); }
    return [...by.values()].filter(d => !d.deleted); };
  async function saveMark(mid) {
    const m = MARKS.find(z => z.mid === mid); if (!m) return;
    if (PEND[mid] !== undefined) m.note = PEND[mid].trim();
    m.at = new Date().toISOString(); const want = m.note;
    const st = root.querySelector(`[data-m="${mid}"] .mst`);
    try { if (!DB) throw new Error("saves on the claude.ai page"); try { await putRev(m); } catch (e1) { console.warn("designmarks write failed, retrying", e1); await new Promise(r => setTimeout(r, 1500)); await putRev(m); }
      if (PEND[mid] !== undefined && PEND[mid].trim() === want) delete PEND[mid]; MST[mid] = "saved"; }
    catch (x) { console.warn("designmarks write failed", x); MST[mid] = "not saved: " + (x && (x.code || x.message) || String(x)); }
    if (st) st.textContent = MST[mid];
  }
  // save every typed note now (before a new pin, a re-render, sending)
  async function flushMarks() { clearTimeout(saveT); const a = document.activeElement;
    if (a && a.closest && a.closest("[data-m]")) PEND[a.closest("[data-m]").dataset.m] = a.value;
    await Promise.all(Object.keys(PEND).map(saveMark)); }
  // the catalogue's Themes tab shows the same cards, only the design themes (Evgeni: "additional tab with themes")
  window.designsShow = m => { MODE = m === "themes" ? "themes" : "designs"; render(); };
  const vkey = id => id.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120);
  const GROUPS = [["block", "Blocks", "one block, fire left, ice right"], ["structure", "Structures", "one design on every join, slopes too · scroll sideways"],
    ["spike", "Spikes", "ice standing, fire hanging"], ["saw", "Saws", ""], ["indicator", "Indicators", "jump marks, apart from blocks"], ["theme", "Themes", "one scene per theme: pieces, sky, backdrop, holders · scroll sideways"]];
  const open = {}; try { Object.assign(open, JSON.parse(localStorage.getItem("designs-open") || "{}")); } catch (e) {}
  function card(d) {
    const v = VOTES[d.id] || {};
    const img = `<img loading="lazy" decoding="async" src="${esc(d.card)}" alt="${esc(d.name)}">`;
    // a theme's scene takes 📍 marks: tap the 📍 button, then a spot on the picture, then type the note
    // a mark is open (Evgeni's note), seen (Claude read it: seen + reply) or gone (fixed: Claude deletes it, the log stays in
    // knowledge/design_marks.json). Seen ones fold away so the list never just grows.
    const all = d.kind === "theme" ? MARKS.filter(m => m.design === d.id).sort((a, b) => a.fx - b.fx) : [];
    const ms = all.filter(m => !m.seen), seen = all.filter(m => m.seen), so = open["seen:" + d.id] === true;
    const pins = ms.map((m, i) => `<span class="pin" style="left:${(m.fx * 100).toFixed(2)}%;top:${(m.fy * 100).toFixed(2)}%">${i + 1}</span>`).join("")
      + (so ? seen.map(m => `<span class="pin seen" style="left:${(m.fx * 100).toFixed(2)}%;top:${(m.fy * 100).toFixed(2)}%">✓</span>`).join("") : "");
    // zoom (Evgeni 2026-11-27: "need some zooming options"): the scene's height, ­/＋ in the card's top corner, kept per viewer
    const zh = Math.round(220 * (open["zoom:" + d.id] || 1));
    // the pure layout above the scene (Evgeni 2026-11-27: "lets also put the pure layout above (also collapsible)"), with
    // a whiteboard on it ("where is the white board we wanted for the layout"): ✏ draw, a pen per kind (block, hazard,
    // note), strokes saved as revisions in collection "designdraw" (tools/designs.js drawings renders them)
    const lo = open["layout:" + d.id] !== false, dr = DRAWING === d.id, sk = (DRAW[d.id] || {}).strokes || [];
    // FREE BOARD (Evgeni 2026-11-27: "give me some freer controls, where i free draw for now"): draw over the layout, the
    // scene or a blank page; any colour, three sizes, an eraser that takes out the strokes it touches, undo, clear and a
    // full-screen board. A stroke is {c colour, w width, p [[fx, fy] ...] in 0..1 of the picture}.
    const bg = BG[d.id] || "layout", fs = FS === d.id;
    const svg = `<svg class="ink${dr ? " on" : ""}" viewBox="0 0 1000 100" preserveAspectRatio="none">${sk.map(st => `<polyline points="${st.p.map(q => (q[0] * 1000).toFixed(1) + "," + (q[1] * 100).toFixed(2)).join(" ")}" stroke="${esc(st.c || PENS[st.k] || "#fff")}" style="stroke-width:${+st.w || 3}px" />`).join("")}</svg>`;
    const tools = `<span class="pens">${COLS.map(c => `<button class="pcol${PCOL === c && !ERASE ? " on" : ""}" data-c="${c}" style="background:${c}"></button>`).join("")}`
      + `<input type="color" class="pany" value="${PCOL}" title="any colour">`
      + [2, 4, 8].map(w => `<button class="pw${PW_ === w ? " on" : ""}" data-w="${w}"><i style="height:${w}px"></i></button>`).join("")
      + `<button class="perase${ERASE ? " on" : ""}">⌫ eraser</button><button class="pundo">↶</button><button class="pclear">🗑</button>`
      + `<select class="pbg">${[["layout", "on the layout"], ["scene", "on the scene"], ["blank", "blank page"]].map(([v, t]) => `<option value="${v}"${bg === v ? " selected" : ""}>${t}</option>`).join("")}</select>`
      + `<button class="pfs">${fs ? "⤡ exit full screen" : "⛶ full screen"}</button><button class="pdone">✓ done</button></span>`;
    const layoutUI = d.kind !== "theme" || !d.layout ? "" : `<div class="board${fs ? " fs" : ""}"><div class="lyh"><span class="lfold" role="button" data-lf="${esc(d.id)}">${lo ? "▾" : "▸"} layout${sk.length ? ` · ✏ ${sk.length}` : ""}</span>`
      + (lo ? (dr ? tools : `<button class="pdraw">✏ draw</button>`) + (sk.length && !ms.length ? `<button class="msend" data-label="📨 send to Claude"${CAN_SEND ? "" : " disabled"}>📨 send to Claude</button>` : "") + `<span class="ds pst">${esc(DST[d.id] || "")}</span>` : "") + `</div>`
      + (lo ? `<div class="wide" data-w="L:${esc(d.id)}"><div class="mk lk${bg === "blank" ? " blank" : ""}" style="--zh:${fs ? "calc(100vh - 120px)" : zh + "px"}"><img loading="lazy" src="${esc(bg === "scene" ? d.card : d.layout)}" alt="layout">${svg}</div></div>` : "") + `</div>`;
    const media = d.kind === "theme" ? `<div class="zw"><div class="wide" data-w="${esc(d.id)}"><div class="mk${MARKING === d.id ? " on" : ""}" style="--zh:${zh}px">${img}${pins}</div></div>`
      + `<div class="zb">${d.anim ? `<button class="aplay" title="play the scene at game speed">${PLAY && PLAY.id === d.id ? "■" : "▶"}</button><button class="aspd" title="speed">${ASPD}x</button>` : ""}<button class="zoom" data-z="-1" title="zoom out">−</button><button class="zoom" data-z="1" title="zoom in">＋</button></div></div>`
      : d.kind === "structure" ? `<div class="wide">${img}</div>` : img;
    // the marks panel sits UNDER the buttons as one folded line (Evgeni 2026-11-27: "mark ui grows too big and pushes the ui
    // to the bottom"); open, it scrolls inside a capped box, so the card never grows past it
    const mo = open["marks:" + d.id] === true, nu = ms.filter(unsent).length;
    const marksUI = d.kind !== "theme" || !(ms.length || seen.length) ? "" : `<div class="mks">`
      + `<div class="mks-h"><span class="mfold" role="button" data-mf="${esc(d.id)}">${mo ? "▾" : "▸"} 📍 ${ms.length} open${seen.length ? ` · ✓ ${seen.length} seen` : ""}</span>`
      + (ms.length ? `<button class="msend" data-label="📨 send to Claude" title="send the notes Claude has not got yet"${CAN_SEND ? "" : " disabled"}>📨 send to Claude</button>` : "") + `<span class="ds msst"></span></div>`
      + (mo ? `<div class="mks-b">` + ms.map((m, i) => `<div data-m="${esc(m.mid)}"><b>${i + 1}</b><input value="${esc(noteOf(m))}" placeholder="what is off here"><button class="mdel" title="remove">✕</button><span class="ds mst">${esc(MST[m.mid] || "")}</span></div>`).join("")
        + (seen.length ? `<div class="mseen-h" role="button" data-seen="${esc(d.id)}">${so ? "▾" : "▸"} ✓ ${seen.length} seen by Claude</div>`
          + (so ? seen.map(m => `<div class="mseen" data-m="${esc(m.mid)}">✓ <span>${esc(m.note || "")}</span>${m.reply ? `<i>${esc(m.reply)}</i>` : ""}<button class="mdel" title="remove">✕</button></div>`).join("") : "") : "")
        + `</div>` : "") + `</div>`;
    return `<div class="dc k-${d.kind}" data-id="${esc(d.id)}">${media}
      <div class="dt"><span class="dn">${d.n ? d.n + " " : ""}${esc(d.name)}</span>${d.note ? `<div class="dm">${esc(d.note)}</div>` : ""}</div>
      <div class="dv"><button class="up${v.vote > 0 ? " on" : ""}" title="I like it">👍</button><button class="down${v.vote < 0 ? " on" : ""}" title="not so much">👎</button>
      <button class="com" title="a comment">💬${v.comment ? "•" : ""}</button>${d.kind === "theme" ? `<button class="mark${MARKING === d.id ? " on" : ""}" title="mark a spot on the scene">📍</button>` : ""}<span class="ds">${v.at ? "saved" : ""}</span>
      <textarea hidden placeholder="what is good or off about it">${esc(v.comment || "")}</textarea></div>${marksUI}</div>`;
  }
  // a re-render rebuilds the scene scrollers: keep where each one was (Evgeni: "when i click mark it puts the scene back
  // to the start"), as a share of its width so a zoom keeps the same spot in view
  const SCR = {};
  function keepScroll() { for (const w of root.querySelectorAll(".wide[data-w]")) { const W = w.scrollWidth - w.clientWidth;
    SCR[w.dataset.w] = W > 0 ? (w.scrollLeft + w.clientWidth / 2) / w.scrollWidth : SCR[w.dataset.w] || 0; } }
  function putScroll() { for (const w of root.querySelectorAll(".wide[data-w]")) { const f = SCR[w.dataset.w]; if (f == null) continue;
    const go = () => { w.scrollLeft = f * w.scrollWidth - w.clientWidth / 2; }; go(); const im = w.querySelector("img"); if (im && !im.complete) im.addEventListener("load", go, { once: true }); } }
  // THE THEME LAYOUT, one for all themes (Evgeni 2026-11-27: "dont put the layout for every theme [...] one for all the
  // themes here", "one extra section of the theme layout", "make it two parts, that i could look both/one of them: the
  // blocks spike hazard layout (just hanging) and the gameplay layout"). A free board: drawing is always on, no draw button
  // ("i tap over the layout nothing happens").
  let LPARTS = [];   // [key, name, w, h, mode, note]: set by layoutSection() from the theme entry
  let LACT = "layout:play", TOOL = "#", painting = null; const HIST = [], HAZ = new Set(["^", "v", "o", "q", "s"]);
  // a part's tiles: Evgeni's edited copy once he changed it, else the layout as built (designs.json tiles0)
  const tilesOf = k => (DRAW[k] && DRAW[k].tiles) || ((L.find(d => d.tiles0) || {}).tiles0 || {})[k.slice(7)] || [];
  let TILE = () => "";
  // ---- ▶ play (Evgeni 2026-11-27: "theme animations, so we might see how it looks in the game if we press play") ----
  let PLAY = null, ASPD = 1;
  function startPlay(id) { stopPlay(); PLAY = { id, t0: performance.now(), i: 0 }; for (const b of root.querySelectorAll(`.dc[data-id="${CSS.escape(id)}"] .aplay`)) b.textContent = "■"; requestAnimationFrame(stepPlay); }
  function stopPlay() { if (!PLAY) return; const id = PLAY.id; PLAY = null; for (const p of root.querySelectorAll(".plr")) p.remove(); for (const b of root.querySelectorAll(`.dc[data-id="${CSS.escape(id)}"] .aplay`)) b.textContent = "▶"; }
  function stepPlay(now) {
    if (!PLAY) return; const d = L.find(x => x.id === PLAY.id), A = d && d.anim; if (!A) return stopPlay();
    const i = Math.floor((now - PLAY.t0) / 1000 * A.fps * ASPD); PLAY.i = i; if (i >= A.pts.length) return stopPlay();
    const mk = root.querySelector(`.dc[data-id="${CSS.escape(PLAY.id)}"] .zw .mk`); if (!mk) return requestAnimationFrame(stepPlay);
    const img = mk.querySelector("img"), f = img && img.naturalHeight ? img.clientHeight / img.naturalHeight : 1, w = mk.closest(".wide");
    let p = mk.querySelector(".plr"); if (!p) { p = document.createElement("span"); p.className = "plr"; mk.appendChild(p); }
    const [x, y, rot, mode] = A.pts[i], sz = 30 * A.s * f;
    p.dataset.m = mode; p.style.width = p.style.height = sz + "px"; p.style.transform = `translate(${x * f - sz / 2}px, ${y * f - sz / 2}px) rotate(${(rot % 360 + 360) % 360}deg)`;
    if (w) w.scrollLeft = Math.max(0, x * f - w.clientWidth * 0.35);
    requestAnimationFrame(stepPlay);
  }
  function layoutSection() {
    const t = L.find(d => d.kind === "theme" && d.lparts); if (!t) return "";
    LPARTS = t.lparts;
    const isOpen = open.layoutsec !== false, fs = FS === "layout", cs = Math.round(26 * (open["zoom:layout"] || 1));
    // SECTIONS (Evgeni 2026-11-27: "i want the layout to have specific sections ... and each of those can be viewed
    // separately"): one chip per part, each shown or hidden; at first only the first section
    const first = (LPARTS.find(q => q[0].startsWith("sec:")) || LPARTS[0])[0];
    const show = q => open["lpart:" + q] === undefined ? q === first : open["lpart:" + q] !== false;
    // TAP TO PLACE (Evgeni: "i dont like the fact i need to hold and not just click on a spot"): a tool, then a tap on a
    // cell places it (a tap on the same thing takes it away), a drag paints. Cells are drawn big (26 px, zoom -/+) and
    // the grid is the part itself, no picture under it (Evgeni: "i cant draw on the layout properly, zoom doesnt work":
    // the old grid lay over a 130 px picture and zoom never reached it). Tiles: {t, c, r}, c from the part's left, r rows up
    const tile = (q, h) => { const x = q.c, y = h - q.r - 1, P = pts => `<polygon class="tl" points="${pts.map(z => (x + z[0]) + "," + (y + z[1])).join(" ")}" fill="${HAZ.has(q.t) ? "#ff6b6b" : "#e8e8f0"}" />`;
      switch (q.t) {
        case "/": return P([[0, 1], [1, 1], [1, 0]]); case "\\": return P([[0, 0], [0, 1], [1, 1]]);
        case "7": return P([[0, 0], [1, 0], [1, 1]]); case "r": return P([[0, 0], [1, 0], [0, 1]]);
        case "^": return P([[0.1, 1], [0.5, 0.1], [0.9, 1]]); case "v": return P([[0.1, 0], [0.5, 0.9], [0.9, 0]]);
        case "o": case "q": case "s": return `<circle class="tl" cx="${x + 0.5}" cy="${y + 0.5}" r="${q.t === "o" ? 0.48 : 0.36}" fill="#ff6b6b" />`;
        default: return `<rect class="tl" x="${x + 0.03}" y="${y + 0.03}" width="0.94" height="0.94" fill="#e8e8f0" />`; } };
    TILE = tile;
    const grid = q => { const [k, , W, H] = q, key = "layout:" + k;
      return `<svg class="tiles" data-k="${key}" data-w="${W}" data-h="${H}" data-vh="${H + 0.25}" data-g="0" viewBox="0 0 ${W} ${H + 0.25}" style="width:${W * cs}px;height:${(H + 0.25) * cs}px">`
        + `<g class="grid">${Array.from({ length: W + 1 }, (_, c) => `<line x1="${c}" y1="0" x2="${c}" y2="${H}" />`).join("")}${Array.from({ length: H + 1 }, (_, r) => `<line x1="0" y1="${r}" x2="${W}" y2="${r}" />`).join("")}</g>`
        + `<rect x="0" y="${H}" width="${W}" height="0.25" fill="#7be38a55" />` + tilesOf(key).map(z => tile(z, H)).join("") + `</svg>`; };
    const n = LPARTS.filter(q => (DRAW["layout:" + q[0]] || {}).tiles).length;   // parts he has edited
    const TOOLS = [["#", "▭ block"], ["/", "◢ slope"], ["\\", "◣ slope"], ["7", "◥ ceiling slope"], ["r", "◤ ceiling slope"], ["^", "▲ spike"], ["v", "▼ hanging spike"], ["o", "⚙ saw"], ["erase", "⌫ erase"]];
    const chips = `<span class="pens">` + LPARTS.map(q => `<button class="lpt${show(q[0]) ? " on" : ""}" data-p="${esc(q[0])}" title="${esc(q[5] || "")}">${show(q[0]) ? "☑" : "☐"} ${esc(q[1])}${(DRAW["layout:" + q[0]] || {}).tiles ? " ✏" : ""}</button>`).join("")
      + `<button class="lall">all</button><button class="lnone">none</button></span>`;
    const tools = `<span class="pens">` + TOOLS.map(([k, l]) => `<button class="ptool${TOOL === k ? " on" : ""}" data-t="${esc(k)}">${l}</button>`).join("")
      + `<button class="pundo">↶ undo</button><button class="pclear">🗑 clear shown</button><button class="preset">↺ shown back to ours</button>`
      + `<button class="zoom" data-z="-1">−</button><button class="zoom" data-z="1">＋</button><button class="pfs">${fs ? "⤡ exit" : "⛶ full screen"}</button>`
      // a plain save, no sending (Evgeni: "i need a save there, without sending ... i would need to change a bit before
      // updating"); every edit also saves itself, the button saves the shown parts again and says when
      + `<button class="lsave">💾 save</button>`
      + (n ? `<button class="msend" data-label="📨 send to Claude"${CAN_SEND ? "" : " disabled"}>📨 send to Claude</button>` : "") + `<span class="ds pst">${esc(DST.layout || "")}</span></span>`;
    return `<section data-g="layoutsec"><h2 class="stitle fold-h" role="button" tabindex="0" aria-expanded="${isOpen}">${isOpen ? "▾" : "▸"} Theme layout <span class="ds">the same for every theme · one part per kind of play · tap to place${n ? " · ✏ " + n : ""}</span></h2>`
      + (isOpen ? `<div class="dc lay board${fs ? " fs" : ""}" data-id="${LACT}"><div class="lyh">${chips}</div><div class="lyh">${tools}</div>`
        + LPARTS.filter(q => show(q[0])).map(q => `<div class="lpn"><b>${esc(q[1])}</b> · ${esc(q[4] || "")} · ${q[2]} x ${q[3]}${q[5] ? " · " + esc(q[5]) : ""}</div><div class="wide" data-w="L:${esc(q[0])}">${grid(q)}</div>`).join("")
        + `</div>` : "") + `</section>`;
  }
  function render() {
    keepScroll();
    const f = root.querySelector("#dvf").value, G = GROUPS.filter(([k]) => (MODE === "themes") === (k === "theme"));
    const ok = d => { const v = VOTES[d.id]; return !f || (f === "up" ? v && v.vote > 0 : f === "down" ? v && v.vote < 0 : !v || !v.vote); };
    let n = 0;
    root.querySelector("#dgroups").innerHTML = (MODE === "themes" ? layoutSection() : "") + G.map(([k, title, sub]) => {
      const ds = L.filter(d => d.kind === k && ok(d)); n += ds.length;
      const isOpen = open[k] !== false;
      return `<section data-g="${k}"><h2 class="stitle fold-h" role="button" tabindex="0" aria-expanded="${isOpen}">${isOpen ? "▾" : "▸"} ${title} <span class="ds">${ds.length}${sub ? " · " + sub : ""}</span></h2>
        <div class="dgrid"${isOpen ? "" : " hidden"}>${ds.map(card).join("")}</div></section>`;
    }).join("");
    root.querySelector("#dcount").textContent = `${n} designs`;
    putScroll();
    if (Date.now() - lastKey < HOLD) holdSend();
  }
  async function save(id, patch) {
    const d = L.find(x => x.id === id), old = VOTES[id] || {};
    const v = Object.assign({ id, kind: d.kind, name: d.name, vote: old.vote || 0, comment: old.comment || "" }, patch, { at: new Date().toISOString(), from: "phone" });
    if (!DB) throw new Error("votes save on the claude.ai page");
    await DB.collection("designvotes").doc(vkey(id)).set(v);
    VOTES[id] = v;
  }
  root.addEventListener("click", async e => {
    if (Object.keys(PEND).length || (document.activeElement && document.activeElement.closest && document.activeElement.closest("[data-m]"))) flushMarks();
    const sv = e.target.closest(".msave");
    if (sv) { const row = sv.closest("[data-m]"); PEND[row.dataset.m] = row.querySelector("input").value; const st = row.querySelector(".mst"); if (st) st.textContent = "saving ..."; await saveMark(row.dataset.m); return; }
    const lf = e.target.closest(".lfold");
    if (lf) { const k = "layout:" + lf.dataset.lf; open[k] = open[k] === false; try { localStorage.setItem("designs-open", JSON.stringify(open)); } catch (x) {} render(); return; }
    if (e.target.closest(".pdraw")) { DRAWING = e.target.closest(".dc").dataset.id; render(); return; }
    if (e.target.closest(".pdone")) { DRAWING = null; FS = null; ERASE = false; render(); return; }
    const ptl = e.target.closest(".ptool"); if (ptl) { TOOL = ptl.dataset.t; render(); return; }
    const lsh = k => { const q = LPARTS.find(z => z[0] === k), first = (LPARTS.find(z => z[0].startsWith("sec:")) || LPARTS[0])[0]; return open["lpart:" + k] === undefined ? k === first : open["lpart:" + k] !== false; };
    if (e.target.closest(".lall") || e.target.closest(".lnone")) { const on = !!e.target.closest(".lall"); for (const q of LPARTS) open["lpart:" + q[0]] = on; try { localStorage.setItem("designs-open", JSON.stringify(open)); } catch (x) {} render(); return; }
    if (e.target.closest(".lsave")) { const st = root.querySelector(".lay .pst"); if (st) st.textContent = "saving ...";
      const ks = LPARTS.filter(q => lsh(q[0]) && (DRAW["layout:" + q[0]] || {}).tiles).map(q => "layout:" + q[0]);
      if (!ks.length) { DST.layout = "nothing changed to save"; if (st) st.textContent = DST.layout; return; }
      for (const k of ks) await saveDraw(k);
      DST.layout = ks.every(k => DST[k] === "saved") ? "saved " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " (" + ks.length + ")" : ks.map(k => DST[k]).find(v => v !== "saved");
      if (st) st.textContent = DST.layout; return; }
    const lpt = e.target.closest(".lpt"); if (lpt) { const k = "lpart:" + lpt.dataset.p; open[k] = !lsh(lpt.dataset.p); try { localStorage.setItem("designs-open", JSON.stringify(open)); } catch (x) {} render(); return; }
    const pc = e.target.closest(".pcol"); if (pc) { PCOL = pc.dataset.c; ERASE = false; render(); return; }
    const pw = e.target.closest(".pw"); if (pw) { PW_ = +pw.dataset.w; render(); return; }
    if (e.target.closest(".perase")) { ERASE = !ERASE; render(); return; }
    if (e.target.closest(".pfs")) { const id0 = e.target.closest(".dc").dataset.id, id = id0.startsWith("layout") ? "layout" : id0; FS = FS === id ? null : id; render(); return; }
    if (e.target.closest(".lay") && e.target.closest(".pundo")) { const h = HIST.pop(); if (h) { DRAW[h.k] = Object.assign(DRAW[h.k] || {}, { tiles: h.tiles }); render(); saveDraw(h.k); } return; }
    if (e.target.closest(".lay") && e.target.closest(".preset")) { for (const q of LPARTS) { const k = "layout:" + q[0]; if ((DRAW[k] || {}).tiles && lsh(q[0])) { HIST.push({ k, tiles: DRAW[k].tiles }); DRAW[k].tiles = null; saveDraw(k); } } render(); return; }
    if (e.target.closest(".lay") && e.target.closest(".pclear")) { for (const q of LPARTS) { const k = "layout:" + q[0]; if (!lsh(q[0])) continue; HIST.push({ k, tiles: (DRAW[k] || {}).tiles || null }); DRAW[k] = Object.assign(DRAW[k] || {}, { tiles: [] }); saveDraw(k); } render(); return; }
    if (e.target.closest(".pundo") || e.target.closest(".pclear")) { const id = e.target.closest(".dc").dataset.id, D0 = DRAW[id] || { strokes: [] };
      DRAW[id] = { strokes: e.target.closest(".pclear") ? [] : D0.strokes.slice(0, -1) }; render(); saveDraw(id); return; }
    // ▶ play: the camera and the player along the route at game speed (designs.js animOf); ■ stops, the speed button
    // steps 1x -> 0.5x -> 0.25x
    const ap = e.target.closest(".aplay"); if (ap) { const id = ap.closest(".dc").dataset.id; if (PLAY && PLAY.id === id) stopPlay(); else startPlay(id); return; }
    const asp = e.target.closest(".aspd"); if (asp) { ASPD = ASPD === 1 ? 0.5 : ASPD === 0.5 ? 0.25 : 1; if (PLAY) { PLAY.t0 = performance.now() - PLAY.i / 60 / ASPD * 1000; } for (const b of root.querySelectorAll(".aspd")) b.textContent = ASPD + "x"; return; }
    const zb = e.target.closest(".zoom");
    if (zb) { const id0 = zb.closest(".dc").dataset.id, id = id0.startsWith("layout") ? "layout" : id0, k = "zoom:" + id, z = open[k] || 1;
      open[k] = Math.max(0.5, Math.min(3, +(z * (+zb.dataset.z > 0 ? 1.4 : 1 / 1.4)).toFixed(3)));
      try { localStorage.setItem("designs-open", JSON.stringify(open)); } catch (x) {} render(); return; }
    const mf = e.target.closest(".mfold");
    if (mf) { const k = "marks:" + mf.dataset.mf; open[k] = !open[k]; try { localStorage.setItem("designs-open", JSON.stringify(open)); } catch (x) {} render(); return; }
    const sh = e.target.closest(".mseen-h");
    if (sh) { const k = "seen:" + sh.dataset.seen; open[k] = !open[k]; try { localStorage.setItem("designs-open", JSON.stringify(open)); } catch (x) {} render(); return; }
    const snd = e.target.closest(".msend");
    if (snd) { const c = snd.closest(".dc"), id = c.dataset.id, st = c.querySelector(".msst") || c.querySelector(".pst"), d = L.find(x => x.id === id) || { name: "shared" };
      const ms = MARKS.filter(m => m.design === id && unsent(m)).sort((a, b) => a.fx - b.fx);
      const keys = id.startsWith("layout") ? LPARTS.map(q => "layout:" + q[0]) : [id];
      const fresh = keys.filter(k => DRAW[k] && (DRAW[k].tiles || (DRAW[k].strokes || []).length) && (DRAW[k].sentAt || "") !== (DRAW[k].at || "x"));
      if (!ms.length && !fresh.length) { st.textContent = "nothing new: everything was sent already"; return; }
      const text = (ms.length ? `📍 marks on the ${d.name} theme scene (catalogue Themes tab):\n` + ms.map((m, i) => `${i + 1}. col ${m.col}, row ${m.row} (x ${m.x}, y ${m.y}): ${noteOf(m).trim() || "(no note)"}`).join("\n") + "\n" : "")
        + fresh.map(k => `✏ drawing on the ${k.startsWith("layout:") ? "theme layout, " + ((LPARTS.find(q => "layout:" + q[0] === k) || [])[1] || k) : k}: edited (${(DRAW[k].tiles || []).length} pieces; the whole map is in collection designdraw)`).join("\n");
      st.textContent = "sending ...";
      try { const anchor = await CM.anchorFor(c); await CM.sendToClaude({ anchor, text: text.slice(0, 4000) });
        for (const k of fresh) DRAW[k].sentAt = DRAW[k].at;
        for (const m of ms) { PEND[m.mid] = noteOf(m); m.sentNote = noteOf(m).trim(); m.sent = new Date().toISOString(); await saveMark(m.mid); }
        render(); }
      catch (x) { st.textContent = "not sent (" + (x && (x.code || x.message) || x) + "): tap outside, wait a few seconds, tap 📨 again"; }
      return; }
    const h = e.target.closest(".fold-h");
    if (h) { const k = h.parentNode.dataset.g; open[k] = open[k] === false; try { localStorage.setItem("designs-open", JSON.stringify(open)); } catch (x) {} render(); return; }
    // 📍 marks on a theme's scene (collection "designmarks"; tools/designs.js marks reads them)
    const im = e.target.closest(".mk.on img");
    if (im) { const d = L.find(x => x.id === MARKING), r = im.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height, g = d.geo || {};
      const x = ((g.c0 || 0) + fx * ((g.c1 || 0) - (g.c0 || 0))) * 30, y = (1 - fy) * (g.hU || 435) - (g.ground || 45);
      const m = { mid: "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), design: d.id, fx: +fx.toFixed(4), fy: +fy.toFixed(4), x: Math.round(x), y: Math.round(y),
        col: Math.floor(x / 30) - (g.sc || 0), row: Math.floor(y / 30), note: "", at: new Date().toISOString() };
      MARKS.push(m); MARKING = null; open["marks:" + d.id] = true; render();
      const inp = root.querySelector(`[data-m="${m.mid}"] input`); if (inp) inp.focus();
      await saveMark(m.mid);
      return; }
    const del = e.target.closest(".mdel");
    if (del) { const mid = del.parentNode.dataset.m, m = MARKS.find(z => z.mid === mid); MARKS = MARKS.filter(z => z.mid !== mid); delete PEND[mid]; render();
      try { if (DB && m) await putRev(Object.assign({}, m, { deleted: true })); } catch (x) {} return; }
    const b = e.target.closest(".dv button"); if (!b) return;
    if (b.classList.contains("mark")) { const id = b.closest(".dc").dataset.id; MARKING = MARKING === id ? null : id; render(); return; }
    const c = b.closest(".dc"), id = c.dataset.id, st = c.querySelector(".ds");
    if (b.classList.contains("com")) { const t = c.querySelector("textarea"); t.hidden = !t.hidden; if (!t.hidden) t.focus(); return; }
    const n = b.classList.contains("up") ? 1 : -1, cur = (VOTES[id] || {}).vote || 0;
    st.textContent = "saving ...";
    try { await save(id, { vote: cur === n ? 0 : n }); c.outerHTML = card(L.find(x => x.id === id)); } catch (x) { st.textContent = "not saved: " + x.message; }
  });
  let cur = null;
  const ptOf = (svg, e) => { const r = svg.getBoundingClientRect(); return [+((e.clientX - r.left) / r.width).toFixed(4), +((e.clientY - r.top) / r.height).toFixed(4)]; };
  // tiles: the cell under the pointer; a tap toggles, a drag paints the same action on every cell it crosses
  const cellOf = (svg, e) => { const r = svg.getBoundingClientRect(), W = +svg.dataset.w, H = +svg.dataset.h, g = +svg.dataset.g;
    const vh = +(svg.dataset.vh || H), c = Math.floor((e.clientX - r.left) / r.width * W), row = Math.floor(H - g - (e.clientY - r.top) / r.height * vh); return c >= 0 && c < W && row >= 0 && row < H - g ? [c, row] : null; };
  function paint(k, cell, first) { if (!cell) return; const D0 = DRAW[k] = DRAW[k] || {}; if (!D0.tiles) D0.tiles = tilesOf(k).map(q => Object.assign({}, q));
    const i = D0.tiles.findIndex(q => q.c === cell[0] && q.r === cell[1]);
    if (first) painting.mode = TOOL === "erase" || (i >= 0 && D0.tiles[i].t === TOOL) ? "del" : "put";
    const key = cell.join(","); if (painting.done.has(key)) return; painting.done.add(key);
    if (painting.mode === "del") { if (i >= 0) D0.tiles.splice(i, 1); } else { if (i >= 0) D0.tiles.splice(i, 1); D0.tiles.push({ t: TOOL, c: cell[0], r: cell[1] }); }
    painting.changed = true; drawTiles(k); }
  function drawTiles(k) { const svg = root.querySelector(`.tiles[data-k="${k}"]`); if (!svg) return; for (const el of svg.querySelectorAll(".tl")) el.remove();
    const tmp = document.createElement("div"); tmp.innerHTML = `<svg>${tilesOf(k).map(z => TILE(z, +svg.dataset.h)).join("")}</svg>`; for (const el of [...tmp.firstChild.childNodes]) svg.appendChild(el); }
  root.addEventListener("pointerdown", e => { const ts = e.target.closest && e.target.closest(".tiles"); if (!ts) return; e.preventDefault();
    ts.setPointerCapture(e.pointerId); const k = ts.dataset.k; LACT = k; const w = ts.closest(".dc"); if (w) w.dataset.id = k;
    HIST.push({ k, tiles: (DRAW[k] || {}).tiles ? JSON.parse(JSON.stringify(DRAW[k].tiles)) : null }); if (HIST.length > 50) HIST.shift();
    painting = { k, svg: ts, done: new Set(), changed: false }; const c0 = cellOf(ts, e); paint(k, c0, true);
    const st = root.querySelector(".lay .pst"); if (st) st.textContent = c0 ? `${TOOL === "erase" ? "erase" : TOOL} at col ${c0[0]}, row ${c0[1]}` : "tap outside the grid"; }, true);
  root.addEventListener("pointermove", e => { if (!painting) return; paint(painting.k, cellOf(painting.svg, e), false); }, true);
  let lastPaint = 0;
  const endPaint = () => { if (!painting) return; const { k, changed } = painting; painting = null; lastPaint = Date.now(); if (changed) { saveDraw(k); render(); } };
  // a tap also arrives as a click (Evgeni 2026-11-27: "i click nothing happens, im on blocks"): when no pointer stroke
  // handled it just before (some views never pass pointer events on), the click places or takes away the tile itself
  root.addEventListener("click", e => { const ts = e.target.closest && e.target.closest(".tiles"); if (!ts || Date.now() - lastPaint < 400) return;
    const k = ts.dataset.k, cell = cellOf(ts, e); LACT = k; const st = root.querySelector(".lay .pst");
    if (!cell) { if (st) st.textContent = "tap outside the grid"; return; }
    HIST.push({ k, tiles: (DRAW[k] || {}).tiles ? JSON.parse(JSON.stringify(DRAW[k].tiles)) : null });
    painting = { k, svg: ts, done: new Set(), changed: false }; paint(k, cell, true); const ch = painting.changed; painting = null; lastPaint = Date.now();
    if (ch) { saveDraw(k); render(); } }, true);
  root.addEventListener("pointerup", endPaint, true); root.addEventListener("pointercancel", endPaint, true);
  root.addEventListener("pointerdown", e => { const svg = e.target.closest && e.target.closest(".ink.on:not(.tiles)"); if (!svg) return; e.preventDefault();
    svg.setPointerCapture(e.pointerId); const id = svg.dataset.k || svg.closest(".dc").dataset.id; if (svg.dataset.k) { LACT = id; const w = svg.closest(".dc"); if (w) w.dataset.id = id; }
    if (ERASE) { cur = { id, svg, erase: true }; eraseAt(id, svg, e); return; }
    cur = { id, svg, st: { c: PCOL, w: PW_, p: [ptOf(svg, e)] } };
    const pl = document.createElementNS("http://www.w3.org/2000/svg", "polyline"); pl.setAttribute("stroke", PCOL); pl.style.strokeWidth = PW_ + "px"; svg.appendChild(pl); cur.pl = pl; });
  // the eraser takes out every stroke with a point within ~12 px of it
  function eraseAt(id, svg, e) { const D0 = DRAW[id]; if (!D0 || !D0.strokes.length) return; const r = svg.getBoundingClientRect(), q = ptOf(svg, e);
    const near = st => st.p.some(z => Math.hypot((z[0] - q[0]) * r.width, (z[1] - q[1]) * r.height) < 12);
    const keep = D0.strokes.filter(st => !near(st)); if (keep.length === D0.strokes.length) return;
    DRAW[id] = { strokes: keep }; cur.erased = true; const pls = svg.querySelectorAll("polyline"); D0.strokes.forEach((st, k) => { if (near(st) && pls[k]) pls[k].remove(); }); }
  root.addEventListener("pointermove", e => { if (!cur) return; if (cur.erase) return eraseAt(cur.id, cur.svg, e); const q = ptOf(cur.svg, e), l = cur.st.p[cur.st.p.length - 1];
    if (Math.abs(q[0] - l[0]) + Math.abs(q[1] - l[1]) < 0.002) return; cur.st.p.push(q);
    cur.pl.setAttribute("points", cur.st.p.map(z => (z[0] * 1000).toFixed(1) + "," + (z[1] * 100).toFixed(2)).join(" ")); });
  const endStroke = () => { if (!cur) return; const { id, st } = cur, er = cur.erase && cur.erased; cur = null;
    if (er) { render(); saveDraw(id); return; } if (!st || st.p.length < 2) return;
    (DRAW[id] = DRAW[id] || { strokes: [] }).strokes.push(st); saveDraw(id); };
  root.addEventListener("pointerup", endStroke); root.addEventListener("pointercancel", endStroke);
  // each save a new document (the marks lesson: rewrites never landed); readers take the newest per design
  async function saveDraw(id) { const st = root.querySelector(`.dc[data-id="${CSS.escape(id)}"] .pst`) || root.querySelector(".lay .pst");
    try { if (!DB) throw new Error("saves on the claude.ai page"); const at = new Date().toISOString(); await DB.collection("designdraw").doc(id.replace(/[^A-Za-z0-9_-]/g, "_") + "-" + Date.now().toString(36)).set({ design: id, strokes: DRAW[id].strokes || [], tiles: DRAW[id].tiles || null, at }); DRAW[id].at = at; DST[id] = "saved"; }
    catch (x) { DST[id] = "not saved: " + (x && (x.code || x.message) || String(x)); }
    if (st) st.textContent = DST[id]; }
  root.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.closest && e.target.closest("[data-m]")) { e.preventDefault(); const row = e.target.closest("[data-m]"); PEND[row.dataset.m] = e.target.value; saveMark(row.dataset.m); return; } if (e.key === "Enter" && e.target.classList.contains("fold-h")) e.target.click(); });
  root.addEventListener("input", e => {
    const mrow = e.target.closest("[data-m]"); if (!mrow) return;
    const mid = mrow.dataset.m; PEND[mid] = e.target.value; lastKey = Date.now(); holdSend(); MST[mid] = "…"; const st = mrow.querySelector(".mst"); if (st) st.textContent = "…";
    clearTimeout(saveT); saveT = setTimeout(() => saveMark(mid), 700);
  });
  root.addEventListener("focusout", e => { if (e.target.closest && e.target.closest("[data-m]")) flushMarks(); });
  root.addEventListener("change", async e => {
    if (e.target.id === "dvf") return render();
    if (e.target.classList.contains("pany")) { PCOL = e.target.value; ERASE = false; render(); return; }
    if (e.target.classList.contains("pbg")) { const id0 = e.target.closest(".dc").dataset.id; BG[id0.startsWith("layout") ? "layout" : id0] = e.target.value; render(); return; }
    const mrow = e.target.closest("[data-m]");
    if (mrow) { PEND[mrow.dataset.m] = e.target.value; await saveMark(mrow.dataset.m); return; }
    if (e.target.tagName !== "TEXTAREA") return;
    const c = e.target.closest(".dc"), st = c.querySelector(".ds");
    st.textContent = "saving ...";
    try { await save(c.dataset.id, { comment: e.target.value.trim() }); st.textContent = "saved"; } catch (x) { st.textContent = "not saved: " + x.message; }
  });
  render();
  for (let k = 0; k < 15 && !(window.claude && window.claude.use); k++) await new Promise(r => setTimeout(r, 200));
  try {
    if (window.claude && window.claude.use) DB = await window.claude.use("db");
    if (DB) DB.collection("designvotes").onSnapshot(snap => {
      const v = {}; for (const d of snap.docs) { const b = d.data(); if (b && b.id) v[b.id] = b; }
      VOTES = v; if (!root.contains(document.activeElement) || document.activeElement.tagName !== "TEXTAREA") render();
    }, () => {});
    if (DB) DB.collection("designdraw").onSnapshot(snap => {
      for (const d of snap.docs.map(x => x.data())) if (d && d.design && (!DRAW[d.design] || !DRAW[d.design].at || String(d.at) > String(DRAW[d.design].at))) if (!cur) DRAW[d.design] = d;
      if (!cur) render();
    }, () => {});
    if (DB) DB.collection("designmarks").onSnapshot(snap => {
      const local = MARKS.filter(m => MST[m.mid] !== "saved" && !m.seen);
      MARKS = latest(snap.docs.map(d => d.data()));
      for (const m of local) if (!MARKS.some(z => z.mid === m.mid)) MARKS.push(m);
      if (!root.contains(document.activeElement) || !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) render();
    }, () => {});
    if (window.claude && window.claude.use) CM = await window.claude.use("comments");
    // the button shows whenever the page can comment; whether a Claude session takes it is checked on the tap
    CAN_SEND = !!(CM && CM.sendToClaude); if (CAN_SEND && !(document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName))) render();
  } catch (e) {}
};
