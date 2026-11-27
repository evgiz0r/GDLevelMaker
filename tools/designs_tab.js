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
  #designs .lyh{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:6px 8px;font-size:12px}#designs .lfold{cursor:pointer;color:var(--mute)}#designs .tfold{cursor:pointer}#designs .rfold{cursor:pointer;color:var(--mute);padding:2px 6px;white-space:nowrap}#designs .tfc{padding:4px 0}
  #designs .lyh button{background:#241d3d;color:#ddd;border:1px solid #444;border-radius:6px;padding:2px 7px;font-size:12px}#designs .lyh .pen.on{outline:2px solid currentColor}
  #designs .ink{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none}#designs .ink.on{pointer-events:auto;cursor:crosshair;touch-action:none;outline:2px dashed #ffd84d}
  #designs .tiles .grid line{stroke:#ffffff30;stroke-width:1px;vector-effect:non-scaling-stroke}#designs .plr{position:absolute;left:0;top:0;background:#c8ff3c;border:2px solid #10301a;box-sizing:border-box;pointer-events:none;z-index:5}#designs .plr[data-m="1"]{border-radius:40% 70% 70% 40%}#designs .plr[data-m="2"]{border-radius:50%}#designs .zb .aplay,#designs .zb .aspd{min-width:28px}#designs .tiles,#designs .tiles *{pointer-events:auto!important}#designs .tiles{cursor:pointer;display:block;touch-action:none;background:#1a1636;max-width:none}#designs .lay .wide{padding:4px 8px}#designs .ptool.on{outline:2px solid #ffd84d}#designs .tiles .rte,#designs .tiles .rte *{pointer-events:none!important}#designs .lroute.on{outline:2px solid #7be3ff}
  #designs .lnr{display:flex;gap:6px;align-items:center;padding:2px 8px 10px}#designs .lnote{flex:1;min-width:0;background:#0f0c2b;color:inherit;border:1px solid var(--line);border-radius:6px;padding:5px 8px;font:13px system-ui}#designs .lpn{font-size:11px;color:var(--mute);padding:2px 8px}#designs .lsz button,#designs .ldel{background:#241d3d;color:#ddd;border:1px solid #444;border-radius:6px;padding:1px 6px;font-size:11px;margin-left:3px}#designs .lay{margin:6px 0 14px}#designs .lpt.on{outline:1px solid #7be38a}
  #designs .board.fs{position:fixed;inset:0;z-index:1000;background:#0f0c2b;overflow:auto}#designs .board.fs .wide{overflow:auto}
  #designs .lk.blank img{visibility:hidden}#designs .lk.blank{background:#1a1636;background-image:linear-gradient(#ffffff10 1px,transparent 1px),linear-gradient(90deg,#ffffff10 1px,transparent 1px);background-size:20px 20px}
  #designs .pens{display:flex;flex-wrap:wrap;gap:4px;align-items:center}#designs .pcol{width:22px;height:22px;padding:0!important;border-radius:11px!important}#designs .pcol.on,#designs .pw.on,#designs .perase.on{outline:2px solid #ffd84d}
  #designs .pany{width:26px;height:24px;padding:0;border:0;background:none}#designs .pw i{display:block;width:16px;background:#ddd;border-radius:2px}
  #designs .ink polyline{fill:none;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
  #designs .zw{position:relative}#sendall.ready,#designs .msend.ready{background:#3ddc84!important;color:#04210f!important;box-shadow:0 0 10px #3ddc84}#designs .cst{font-size:12px;margin:2px 0 8px;padding:3px 8px;border-radius:6px;background:#ffffff10;color:#cfd3ff}#designs .cst-applied{background:#3ddc8422;color:#9ff0c0}#designs .cst-question{background:#ffd84d22;color:#ffe48a}#designs .cst-new{background:#ff8a8a1c;color:#ffb0b0}#designs .cst-sent{color:#aab}#designs .fxc{position:absolute;left:0;top:0;pointer-events:none;mix-blend-mode:screen}#designs .zb{position:absolute;right:6px;top:6px;display:flex;gap:4px}
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
  // THE SOLVER'S PATH (Evgeni 2026-11-27: "add the path of the solver in some soft way on the layout, and add a control to
  // toggle"): tools/layoutcheck.js solves each section alone and keeps its route, presses and windows
  // (knowledge/layout_check.json, published as layout_check.json); drawn faint over each section, 〰 turns it off
  let LCHK = {}; try { LCHK = await (await fetch("layout_check.json", { cache: "no-store" })).json(); } catch (e) {}
  // the same hash tools/layoutcheck.js hashMap() takes of the map it solved: differs once he drew since -> "old"
  const hashTiles = T => { const cells = T.map(z => z.t + "," + z.c + "," + z.r).sort(); let h = 0; for (const ch of cells.join(";")) h = (h * 31 + ch.charCodeAt(0)) | 0; return h; };
  let LASTC = "";   // the last time Claude read the queue (designsend docs with by: "claude")
  // WHAT CLAUDE DID WITH EACH THING HE SENT (Evgeni 2026-11-27: "i should be able to understand whether some request already
  // applied after i sent it. its just not clear to me what is known and if something is lost or unread"): Claude writes a
  // revision to collection "claudestatus" per part ({part: "sec:ball" | "gen:..." | "theme:hellgate", state: applied |
  // read | question | passed, reply, at}); each section, note and generated piece shows one line: not sent yet / sent,
  // waiting / read by Claude / ✓ applied + Claude's answer. Newer edits of his than Claude's answer reopen it.
  const CST = {};
  const hm = a => a ? new Date(a).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  function stLine(part) {
    const n = NOTES[part], d = DRAW["layout:" + part], s = CST[part];
    const mineN = n && (n.note || "").trim() ? String(n.at || "") : "", mineD = d && d.by !== "claude" && (d.tiles || (d.strokes || []).length) ? String(d.at || "") : "";
    const mine = mineN > mineD ? mineN : mineD;
    if (s && (!mine || String(s.at) >= mine)) { const ic = { applied: "✓", question: "❓", passed: "➜", read: "👀" }[s.state] || "✓";
      return `<div class="cst cst-${esc(s.state || "applied")}">${ic} Claude ${esc(s.state || "applied")} ${hm(s.at)}${s.reply ? ": " + esc(s.reply) : ""}</div>`; }
    if (!mine) return "";
    const unsentNow = (mine === mineN && noteUnsent(part)) || (mine === mineD && String(d.at || "") > LAST && (d.sentAt || "") !== (d.at || "x"));
    if (unsentNow) return `<div class="cst cst-new">✎ saved, Claude hasn't read it yet (it reads it on its next wake; 📨 or a word in chat wakes it)</div>`;
    if (LASTC && LASTC >= mine) return `<div class="cst cst-read">👀 Claude read it ${hm(LASTC)}, working on it</div>`;
    return `<div class="cst cst-sent">📨 sent, waiting for Claude</div>`; }
  let LAST = "2026-11-27T14:40:00.000Z";   // the last send (collection "designsend"; this default: when the stamp started)
  let VOTES = {}, DB = null, CM = null, CAN_SEND = false, MODE = "designs", MARKS = [], MARKING = null;
  // typed mark notes not yet confirmed by the database: they win over snapshots, so a re-render never drops text
  const PENS = { block: "#ffffff", hazard: "#ff5a5a", note: "#ffd84d" }, PENL = { block: "▭ block", hazard: "▲ hazard", note: "✎ note" };
  let DRAWING = null, PEN = "block", PCOL = "#ffffff", PW_ = 4, ERASE = false, FS = null; const DRAW = {}, DST = {}, BG = {};
  const COLS = ["#ffffff", "#ff5a5a", "#ffd84d", "#5ad1ff", "#7be38a", "#ff9a3c", "#c77dff", "#111111"];
  const PEND = {}, MST = {}; let saveT = null, lastKey = 0, holdT = null, readyT = null;
  // a note per layout section (Evgeni 2026-11-27: "give me place for comments on each of the sections"): typed, saved as it
  // is typed (revision docs in collection "designnotes": {part, note, sentNote, at}), sent with 📨 only when changed
  const NOTES = {}, NST = {}; let noteT = null;
  const noteUnsent = k => { const n = NOTES[k]; return !!(n && (n.note || "").trim() && (n.note || "").trim() !== (n.sentNote || "")); };
  async function saveNote(k) { const n = NOTES[k]; if (!n) return; const st = root.querySelector(`.lnst[data-n="${CSS.escape(k)}"]`);
    try { if (!DB) throw new Error("saves on the claude.ai page"); n.at = new Date().toISOString();
      await DB.collection("designnotes").doc(k.replace(/[^A-Za-z0-9_-]/g, "_") + "-" + Date.now().toString(36)).set({ part: k, note: n.note || "", sentNote: n.sentNote || "", at: n.at }); NST[k] = "saved"; }
    catch (x) { NST[k] = "not saved: " + (x && (x.code || x.message) || x); }
    if (st) st.textContent = NST[k]; }
  // claude.ai refuses a send-to-Claude within ~6 s of a key typed in the page ("Not sent to Claude. Your last key or click
  // may not have been meant for this artifact"), so 📨 waits out the typing with a countdown (Evgeni 2026-11-27)
  const HOLD = 8000;
  const unready = () => { for (const b of document.querySelectorAll(".ready")) b.classList.remove("ready"); };
  document.addEventListener("keydown", () => { lastKey = Date.now(); unready(); holdSend(); }, true);
  // a tap anywhere but a send button counts too (the app's hold is on any click in the page)
  document.addEventListener("pointerdown", e => { if (e.target.closest && e.target.closest(".msend, #sendall, #rfb")) return; lastKey = Date.now(); unready(); holdSend(); }, true);
  // the countdown made the buttons annoying (Evgeni 2026-11-27: "something bugged with those new and sends, need to find
  // something less annoying"): no countdown, no disabled buttons any more; a refused send just says to press again
  function holdSend() { return;
    clearInterval(holdT); const tick = () => { const left = HOLD - (Date.now() - lastKey);
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
    // theme cards start folded, one header line each (Evgeni 2026-11-27: "when i stop the firey it shows the next theme.
    // make them all collapsed"); a tap opens one, and the open ones are remembered per viewer
    if (d.kind === "theme" && open["theme:" + d.id] !== true) {
      return `<div class="dc k-theme tfc" data-id="${esc(d.id)}"><div class="dt tfold" role="button" tabindex="0" data-tf="${esc(d.id)}">▸ <span class="dn">${d.n ? d.n + " " : ""}${esc(d.name)}</span>${d.note ? ` <span class="ds">${esc(d.note)}</span>` : ""}</div></div>`; }
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
    // each theme's layout starts folded (Evgeni 2026-11-27: folding the fire theme's showed the next theme's: "make them all collapsed")
    const lo = open["layout:" + d.id] === true, dr = DRAWING === d.id, sk = (DRAW[d.id] || {}).strokes || [];
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
      + `<div class="zb">${d.anim ? `<button class="aplay" title="play / pause the scene at game speed">${PLAY && PLAY.id === d.id && !PLAY.paused ? "⏸" : "▶"}</button>${PLAY && PLAY.id === d.id ? `<button class="astop" title="stop, back to the start">⏹</button>` : ""}` : ""}${FR("zb:" + d.id, "⚙", `${d.anim ? `<button class="aspd" title="speed">${ASPD}x</button><select class="asty" title="animation style">${Object.entries(FXS).map(([k, f]) => `<option value="${k}"${styOf(d.id) === k ? " selected" : ""}>${esc(f.name)}</option>`).join("")}</select><select class="acol" title="number of colours">${[1, 2, 3, 4, 5, 6, 8, 12, 16].map(n => `<option value="${n}"${+(open["acol:" + d.id] || 4) === n ? " selected" : ""}>${n} colour${n > 1 ? "s" : ""}</option>`).join("")}</select>` : ""}<button class="zoom" data-z="-1" title="zoom out">−</button><button class="zoom" data-z="1" title="zoom in">＋</button>`)}`
      // ACTIONS ARE BUTTONS (Evgeni 2026-11-27: "whenever is some operations i should do, like say build, lets move that
      // as a button for example on the theme"): the button sends Claude the request; the page never runs the job itself
      + `<button class="abuild" title="ask Claude to rebuild this theme's scene from the current layout">🔨 build</button><span class="ds abst">${esc(AST[d.id] || "")}</span></div></div>`
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
      <div class="dt${d.kind === "theme" ? " tfold" : ""}"${d.kind === "theme" ? ` role="button" tabindex="0" data-tf="${esc(d.id)}"` : ""}>${d.kind === "theme" ? "▾ " : ""}<span class="dn">${d.n ? d.n + " " : ""}${esc(d.name)}</span>${d.note ? `<div class="dm">${esc(d.note)}</div>` : ""}</div>
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
  // sections he adds himself (Evgeni 2026-11-27: "give me option to add one more section"): collection "designsecs",
  // revision docs {key, name, mode, w, h, after, at, deleted?, sentAt?}; drawn like the others (tiles in designdraw)
  const ADDED = {}; let ADDFORM = false;
  const MODES = ["cube", "ship", "wave", "ufo", "ball", "robot", "spider", "swing"];
  async function saveSec(k, sent) { const z = ADDED[k]; z.at = new Date().toISOString(); if (sent) z.sentAt = z.at;
    try { if (!DB) throw new Error("saves on the claude.ai page"); await DB.collection("designsecs").doc(k.replace(/[^A-Za-z0-9_-]/g, "_") + "-" + Date.now().toString(36)).set(JSON.parse(JSON.stringify(z))); DST.layout = "saved"; }
    catch (x) { DST.layout = "not saved: " + (x && (x.code || x.message) || String(x)); } }
  // the base parts with his added sections put in after the section each follows
  function withAdded(base) { const out = base.filter(p => !(ADDED[p[0].slice(4)] || {}).deleted);
    for (const z of Object.values(ADDED).filter(z => !z.deleted).sort((a, b) => String(a.key) < String(b.key) ? -1 : 1)) {
      if (out.some(p => p[0] === "sec:" + z.key)) continue;   // already in the repo's list (applied)
      const q = ["sec:" + z.key, z.name, z.w, z.h, z.mode, "your section"], i = out.findIndex(p => p[0] === "sec:" + z.after);
      if (i >= 0) out.splice(i + 1, 0, q); else out.push(q); }
    return out; }
  // a section's size, changed on its header line (Evgeni 2026-11-27: "give me controls to make the section bigger on the
  // y"): collection "designsize", revision docs {part, w, h, at}; rows are counted from the ground, so a taller section
  // gains rows on top. His added sections keep their size in their own doc.
  const SIZE = {};
  async function resize(k, dw, dh) { const q = LPARTS.find(z => z[0] === k); if (!q) return; const id = k.slice(4);
    const w = Math.max(8, Math.min(120, q[2] + dw)), h = Math.max(4, Math.min(30, q[3] + dh));
    if (ADDED[id]) { ADDED[id].w = w; ADDED[id].h = h; await saveSec(id); }
    else { SIZE[k] = { part: k, w, h, at: new Date().toISOString() };
      try { if (!DB) throw new Error("saves on the claude.ai page"); await DB.collection("designsize").doc(k.replace(/[^A-Za-z0-9_-]/g, "_") + "-" + Date.now().toString(36)).set(SIZE[k]); DST.layout = "saved"; }
      catch (x) { DST.layout = "not saved: " + (x && (x.code || x.message) || String(x)); } }
    render(); }
  let LPARTS = [];   // [key, name, w, h, mode, note]: set by layoutSection() from the theme entry
  let LACT = "layout:play", TOOL = "#", painting = null; const HIST = [], HAZ = new Set(["^", "v", "o", "q", "s"]);
  // a part's tiles: Evgeni's edited copy once he changed it, else the layout as built (designs.json tiles0)
  const tilesOf = k => k === "layout:play" ? sceneTiles() : (DRAW[k] && DRAW[k].tiles) || ((L.find(d => d.tiles0) || {}).tiles0 || {})[k.slice(7)] || [];
  // THE CURRENT SCENE = the sections joined in order (Evgeni 2026-11-27: "lets make the current scene the combination of the
  // layouts for now"): built here from each section as it stands now, his edits included, so it follows every edit; it is
  // not edited itself. The theme cards are rebuilt from it only on demand ("dont want to burn updating the whole universe").
  const SECS = () => LPARTS.filter(q => q[0].startsWith("sec:"));
  // Between two sections a JOIN (lib/scenejoin.js, the same code as tools/layoutsections.js joined()): the floor ramps by
  // 45-degree slopes; two corridors' ceilings merge into one sloping ceiling, a lone ceiling tapers up (Evgeni 2026-11-27:
  // "our scene doesnt connect well in some places are blocked"; then on fly -> wave: "it should merge in the same y locations")
  // SCENE_SEGS: where each section and join sits in the scene, so a tap on the scene edits its section (Evgeni 2026-11-27:
  // "let me also edit the current scene and it will edit the proper section, put some soft marker on where the sections are")
  let SCENE_SEGS = [];
  function sceneTiles() { const out = [], segs = []; let off = 0, prev = null;
    for (const q of SECS()) { const T = tilesOf("layout:" + q[0]), cur = { T, w: q[2], h: q[3], mode: q[4] };
      if (prev) { const j = window.SceneJoin.join(prev, cur); for (const z of j.tiles) out.push({ t: z.t, c: z.c + off, r: z.r }); segs.push({ join: true, c0: off, w: j.n, name: prev.name + " → " + q[1] }); off += j.n; }
      for (const z of T) out.push({ t: z.t, c: z.c + off, r: z.r }); segs.push({ key: "layout:" + q[0], name: q[1], c0: off, w: q[2], h: q[3] }); off += q[2]; prev = Object.assign(cur, { name: q[1] }); }
    SCENE_SEGS = segs; return out; }
  const segAt = c => SCENE_SEGS.find(z => c >= z.c0 && c < z.c0 + z.w);
  const sceneSnap = () => ({ multi: SCENE_SEGS.filter(z => z.key).map(z => ({ k: z.key, tiles: (DRAW[z.key] || {}).tiles ? JSON.parse(JSON.stringify(DRAW[z.key].tiles)) : null })) });
  const sceneW = () => { let w = 0, prev = null; for (const q of SECS()) { const cur = { T: tilesOf("layout:" + q[0]), w: q[2], h: q[3] }; if (prev) w += window.SceneJoin.join(prev, cur).n; w += q[2]; prev = cur; } return w; };
  let TILE = () => "", ROUTE1 = () => "";
  // MORE THAN 4 BUTTONS FOLD (Evgeni 2026-11-27: "any UI as well over some kind of view. everything under collapsible
  // sections above like 4 buttons"): a row of controls longer than ~4 sits behind one ▸ label, folded by default,
  // remembered per viewer (open["rf:<key>"]); the one or two main actions stay outside it
  const FR = (key, label, html) => { const o = open["rf:" + key] === true;
    return `<span class="rfold" role="button" tabindex="0" data-rf="${esc(key)}">${o ? "▾" : "▸"} ${label}</span>` + (o ? html : ""); };
  // ---- ▶ play (Evgeni 2026-11-27: "theme animations, so we might see how it looks in the game if we press play") ----
  let PLAY = null, ASPD = 1; const AST = {};
  // send Claude a request for a job (build, rebuild ...): one line, anchored on the card it is about
  async function ask(el, id, text) { AST[id] = "sending ..."; const st = el.closest(".dc").querySelector(".abst"); if (st) st.textContent = AST[id];
    try { if (!CM || !CM.sendToClaude) throw new Error("only on the claude.ai page"); const anchor = await CM.anchorFor(el.closest(".dc")); await CM.sendToClaude({ anchor, text });
      AST[id] = "asked Claude " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
    catch (x) { AST[id] = "not sent (" + (x && (x.code || x.message) || x) + "): wait a few seconds, tap again"; }
    if (st) st.textContent = AST[id]; }
  // ANIMATION STYLES (Evgeni 2026-11-27: "lets add several animations possible to play, in the dropdown. we will start with -
  // static, nine circles styles"): drawn by the page over the scene while ▶ plays, on a canvas the size of the view, blended
  // as light (screen). A style is f(ctx, w, h, t, beat, P) with t seconds, beat = t in beats (BPM below until the theme
  // gallery has a song), P = the player on the canvas. More styles: one entry here.
  const BPM = 128;
  // ANIMATION STYLES of the theme cards (Evgeni 2026-11-27: "lets think of some other effects, and obviously we can control
  // the number of colors - some rotating movement - some pulsing effects in the cube - smaller/arbitrary slice than a single
  // block * going up and down * beats with the song or when the player has to jump (as some kind of an indicator)").
  // Every style lights the scene's play blocks (designs.js cellsOf; slopes as their triangle) in the theme's own colours
  // (designs.js fxColsOf), with N colours from the card's colour picker. A style is light(cell, F) -> [alpha, colour
  // index] or a list of sub-pieces; F = the frame: b (beats), ph (phase in the beat), N, the screen centre, the player,
  // the last press. In a level each maps to colour channels + colour / pulse triggers on the beats (EFFECTS.md).
  const BANDS = (v, N) => ((Math.floor(v) % N) + N) % N;
  const flow = (v, b, N) => { const n = Math.floor(b), ph = b - n, band = BANDS(v, N), lit = ((n - band) % N + N) % N;
    return [lit === 0 ? 0.6 * (1 - ph * 0.6) : lit === 1 ? 0.2 * (1 - ph) : 0, band]; };
  const FXS = {
    static: { name: "static" },
    // NINE CIRCLES (Evgeni: "when our structure has 4 channels and it does 'waves', not the background"): diagonal bands
    // (column + row), a band every half beat, faster than the player ("original vibe was ... diagonal")
    // MORE COLOURS = THINNER SLICES (Evgeni 2026-11-27: "when we mean 8 colors, we want the slices smaller. not just
    // increasing the number of colors"): one turn of the pattern keeps its length, so N colours make bands 8 / N columns
    // wide, and a "fine" style cuts each block into strips (N / 4 of them) so a band can be thinner than a block
    nine: { name: "nine circles", fine: true, light: ([x, y, col], F) => flow((col + Math.round(y / 22.5)) * F.N / 8, F.b * 2, F.N) },
    nineAlong: { name: "nine circles, along", fine: true, light: ([x, y, col], F) => flow(col * F.N / 8, F.b, F.N) },
    // ROTATING (Evgeni 2026-11-27: "should be many small rotating structures not 1"): the scene cut into 4 x 4 block
    // tiles, each a little wheel turning round its own centre, neighbours turning the other way
    rotate: { name: "rotating", fine: true, light: ([x, y], F) => { const T = 90, i = Math.floor(x / T), j = Math.floor(y / T), dir = (i + j) % 2 ? 1 : -1;
      const a = Math.atan2(y - (j + 0.5) * T, x - (i + 0.5) * T) / (2 * Math.PI) + 0.5;
      return flow(a * F.N + (i + j) * 0.5, F.b * 2 * dir, F.N); } },
    // PULSE: each block's light grows from its centre on the beat and fades, the colour moving on a beat
    pulse: { name: "pulse in the blocks", light: ([x, y, col], F) => { const e = Math.pow(1 - F.ph, 2);
      return { a: 0.55 * e, ci: BANDS(F.n + col / 3, F.N), scale: 0.25 + 0.75 * e }; } },
    // SLICES: every block cut in 3 strips, the diagonal flow running strip by strip (finer than a block)
    // SLICES: thin strips, every strip its own colour of the palette in order, the colours drifting one strip every two beats
    // with a soft glow wave over them (Evgeni 2026-11-27: "slices is a bit too flashy movement, need slower or more slices
    // and more colors": it stepped 2K strips a beat with on/off flashes; now 2 strips per colour, a slow drift, no flashes)
    slices: { name: "slices", light: ([x, y, col], F) => { const K = Math.max(6, F.N * 2), t = F.b / 2;
      return Array.from({ length: K }, (_, k) => { const pos = col * K + k + Math.round(y / 22.5) * 2;
        return { a: 0.18 + 0.22 * (0.5 + 0.5 * Math.sin((pos / K - t / 4) * Math.PI * 2 / 3)), ci: BANDS((pos - t) / 2, F.N), part: [k / K, 1 / K] }; }); } },
    // UP AND DOWN: a line of light rises and falls through the rows, one row a half beat, rippling along the columns
    updown: { name: "up and down", light: ([x, y, col], F) => { const row = 13 - y / 22.5, top = 6, h = (Math.sin((F.b * 2 + col * 0.25) * Math.PI / 4) + 1) / 2 * top, d = Math.abs(row - h);
      return [d < 0.8 ? 0.55 * (1 - d / 0.8) : 0, BANDS(row / 2, F.N)]; } },
    // ON THE BEAT: every block flashes on each beat, the next colour each beat
    beat: { name: "on the beat", light: (c, F) => [0.5 * Math.pow(1 - F.ph, 3), BANDS(F.n, F.N)] },
    // ON THE JUMPS (an indicator): a ring of light runs out of every press the route makes, over the structures nearby
    jump: { name: "on the jumps", light: ([x, y], F) => { if (!F.tap) return [0, 0]; const d = Math.hypot(x - F.tap[0], y - F.tap[1]) / 22.5, r = F.tapAge * 14, k = Math.abs(d - r);
      return [k < 1.2 && F.tapAge < 0.6 ? 0.65 * (1 - k / 1.2) * (1 - F.tapAge / 0.6) : 0, BANDS(F.taps, F.N)]; } } };
  // colours: the theme's light roles; more than it has are made between them, fewer are its first ones
  function fxPal(cols, N) { const C = cols && cols.length ? cols : [[255, 120, 60], [255, 180, 80], [255, 220, 140], [255, 160, 60]], out = [];
    // round the palette (the last colour blends back into the first), so colours that drift in a cycle never jump
    for (let i = 0; i < N; i++) { const p = i * C.length / N, a = Math.floor(p), t = p - a, A = C[a % C.length], B = C[(a + 1) % C.length];
      out.push(A.map((v, j) => Math.round(v + (B[j] - v) * t))); } return out; }
  function fxDraw(st, g, w, h, cells, F, cols) { if (!st.light || !cells) return; const C = fxPal(cols, F.N), sz = 22.5 * F.f;
    const tri = (X, Y, sh, s) => { const k = sh - 1, fx = k & 1, fy = k & 2, q = k >> 2, hh = s / 2;
      let P = [[-hh, hh], [hh, hh], [hh, -hh]].map(([u, v]) => [fx ? -u : u, fy ? -v : v]);
      for (let j = 0; j < q; j++) P = P.map(([u, v]) => [-v, u]);
      g.beginPath(); P.forEach(([u, v], j) => j ? g.lineTo(X + u, Y + v) : g.moveTo(X + u, Y + v)); g.closePath(); g.fill(); };
    const K = st.fine ? Math.max(1, Math.round(F.N / 4)) : 1;   // strips a block for a fine style (thinner than a block)
    for (const cell of cells) { const [x, y, col, sh] = cell, X = x * F.f - F.sl, Y = y * F.f; if (X < -sz || X > w + sz) continue;
      let L;
      if (K > 1 && !sh) L = Array.from({ length: K }, (_, k) => { const o = (k + 0.5) / K - 0.5, q = st.light([x + o * 22.5, y, col + o, sh], F), r = Array.isArray(q) ? { a: q[0], ci: q[1] } : q; return Object.assign({}, r, { part: [k / K, 1 / K] }); });
      else L = st.light(cell, F);
      if (Array.isArray(L) && typeof L[0] === "number") L = { a: L[0], ci: L[1] };
      for (const q of [].concat(L)) { if (!q || q.a < 0.03) continue; const c = C[q.ci % C.length]; g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${q.a.toFixed(3)})`;
        const s = sz * (q.scale || 1);
        if (sh) tri(X, Y, sh, s); else if (q.part) g.fillRect(X - sz / 2 + q.part[0] * sz, Y - sz / 2, q.part[1] * sz, sz); else g.fillRect(X - s / 2, Y - s / 2, s, s); } } }
  const styOf = id => FXS[open["anim:" + id]] ? open["anim:" + id] : "static";
  function startPlay(id) { stopPlay(); PLAY = { id, t0: performance.now(), i: 0 }; for (const b of root.querySelectorAll(`.dc[data-id="${CSS.escape(id)}"] .aplay`)) b.textContent = "⏸"; requestAnimationFrame(stepPlay); }
  // PAUSE (Evgeni 2026-11-27: "i cant pause a theme run i can only restart"): ⏸ holds the frame, ▶ goes on from it, ⏹ resets
  function pausePlay() { if (!PLAY || PLAY.paused) return; PLAY.paused = true; for (const b of root.querySelectorAll(`.dc[data-id="${CSS.escape(PLAY.id)}"] .aplay`)) b.textContent = "▶"; }
  function resumePlay() { if (!PLAY || !PLAY.paused) return; const d = L.find(x => x.id === PLAY.id), A = d && d.anim; if (!A) return;
    PLAY.paused = false; PLAY.t0 = performance.now() - PLAY.i / (A.fps * ASPD) * 1000;
    for (const b of root.querySelectorAll(`.dc[data-id="${CSS.escape(PLAY.id)}"] .aplay`)) b.textContent = "⏸"; requestAnimationFrame(stepPlay); }
  function stopPlay() { if (!PLAY) return; const id = PLAY.id; PLAY = null; for (const p of root.querySelectorAll(".plr, .fxc")) p.remove(); for (const b of root.querySelectorAll(`.dc[data-id="${CSS.escape(id)}"] .aplay`)) b.textContent = "▶"; }
  function stepPlay(now) {
    if (!PLAY) return; const d = L.find(x => x.id === PLAY.id), A = d && d.anim; if (!A) return stopPlay();
    // paused: draw the held frame once (a re-render rebuilt the card) and stop asking for frames
    const i = PLAY.paused ? PLAY.i : Math.max(0, Math.floor((now - PLAY.t0) / 1000 * A.fps * ASPD));   // the first frame's rAF time can be before t0
    // stop at the end of the last section (Evgeni 2026-11-27: "fix the out of bounds, it should stop when reaching the end
    // of the last section"): the last play block's x, not the card's last route point
    const endX = d.cells && d.cells.length ? Math.max(...d.cells.map(c => c[0])) + 15 : Infinity;
    PLAY.i = i; if (i >= A.pts.length || A.pts[i][0] > endX) return stopPlay();   // ends with the scene (was on the comment's line: it never stopped)
    const mk = root.querySelector(`.dc[data-id="${CSS.escape(PLAY.id)}"] .zw .mk`); if (!mk) return requestAnimationFrame(stepPlay);
    const img = mk.querySelector("img"), f = img && img.naturalHeight ? img.clientHeight / img.naturalHeight : 1, w = mk.closest(".wide");
    let p = mk.querySelector(".plr"); if (!p) { p = document.createElement("span"); p.className = "plr"; mk.appendChild(p); }
    const [x, y, rot, mode] = A.pts[i], sz = 30 * A.s * f;
    p.dataset.m = mode; p.style.width = p.style.height = sz + "px"; p.style.transform = `translate(${x * f - sz / 2}px, ${y * f - sz / 2}px) rotate(${(rot % 360 + 360) % 360}deg)`;
    if (w) w.scrollLeft = Math.max(0, x * f - w.clientWidth * 0.35);
    const fx = FXS[styOf(PLAY.id)], zw = mk.closest(".zw"); let cv = zw && zw.querySelector(".fxc");
    if (fx.light && zw && w) { if (!cv) { cv = document.createElement("canvas"); cv.className = "fxc"; zw.appendChild(cv); }
      const W = w.clientWidth, H = w.clientHeight; if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const g = cv.getContext("2d"), t = i / A.fps; g.clearRect(0, 0, W, H);
      const b = t * BPM / 60, tps = (A.taps || []).filter(k => k <= i), tk = tps.length ? tps[tps.length - 1] : null;
      const F = { b, n: Math.floor(b), ph: b - Math.floor(b), N: +(open["acol:" + d.id] || 4), f, sl: w.scrollLeft, cx: W / 2, cy: H / 2,
        tap: tk !== null ? A.pts[tk] : null, tapAge: tk !== null ? (i - tk) / A.fps : 9, taps: tps.length };
      fxDraw(fx, g, W, H, d.cells, F, d.fxcols); }
    else if (cv) cv.remove();
    if (!PLAY.paused) requestAnimationFrame(stepPlay);
  }
  function layoutSection() {
    const t = L.find(d => d.kind === "theme" && d.lparts); if (!t) return "";
    LPARTS = withAdded(t.lparts).map(q => SIZE[q[0]] ? [q[0], q[1], SIZE[q[0]].w, SIZE[q[0]].h, q[4], q[5]] : q);
    { const S = SECS(); LPARTS = LPARTS.map(q => q[0] !== "play" ? q : ["play", "current scene", sceneW(), Math.max(...S.map(z => z[3])), "all", "the sections joined in order; draw on it and the edit goes to its section (the joins follow)"]); }
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
        // gravity portals (Evgeni 2026-11-27: "i need also reverse gravity portals in the layouts"): G upside down (yellow),
        // N back to normal (blue); drawn 3 rows tall like the game's portal, centred on its cell
        // a hidden portal of the section's own mode: it moves the band (the room) to its height
        // 📍 MARKER (Evgeni 2026-11-27: "give me a marker to add to a level, so i put like a marker block ... after its fixed you
        // can remove the marker"): a "look here" pin with no gameplay (sampleOf ignores it); Claude removes it once fixed
        case "@": return `<g class="tl"><circle cx="${x + 0.5}" cy="${y + 0.38}" r="0.3" fill="#ff4d6d" stroke="#fff" style="stroke-width:1.5px;vector-effect:non-scaling-stroke" /><path d="M${x + 0.3} ${y + 0.55} L${x + 0.5} ${y + 0.98} L${x + 0.7} ${y + 0.55}Z" fill="#ff4d6d" /></g>`;
        case "W": case "R": case "H": case "U": case "A": case "L": case "P": return `<rect class="tl" x="${x + 0.3}" y="${y - 1}" width="0.4" height="3" rx="0.2" fill="none" stroke="#c77dff" stroke-dasharray="0.2 0.15" style="stroke-width:1.5px;vector-effect:non-scaling-stroke" />`;
        case "G": case "N": return `<rect class="tl" x="${x + 0.25}" y="${y - 1}" width="0.5" height="3" rx="0.25" fill="${q.t === "G" ? "#ffe000" : "#38c8ff"}" fill-opacity="0.85" />`;
        // orbs (Y yellow, B blue, E green) and pads (J yellow, K blue)
        case "Y": case "B": case "E": return `<circle class="tl" cx="${x + 0.5}" cy="${y + 0.5}" r="0.4" fill="none" stroke="${q.t === "Y" ? "#ffe000" : q.t === "B" ? "#38c8ff" : "#40ff60"}" stroke-width="0.14" /><circle class="tl" cx="${x + 0.5}" cy="${y + 0.5}" r="0.18" fill="${q.t === "Y" ? "#ffe000" : q.t === "B" ? "#38c8ff" : "#40ff60"}" />`;
        case "J": case "K": return `<rect class="tl" x="${x + 0.1}" y="${y + 0.8}" width="0.8" height="0.2" rx="0.08" fill="${q.t === "J" ? "#ffe000" : "#38c8ff"}" />`;
        case "o": case "q": case "s": return `<circle class="tl" cx="${x + 0.5}" cy="${y + 0.5}" r="${q.t === "o" ? 0.48 : 0.36}" fill="#ff6b6b" />`;
        default: return `<rect class="tl" x="${x + 0.03}" y="${y + 0.03}" width="0.94" height="0.94" fill="#e8e8f0" />`; } };
    TILE = tile;
    const grid = q => { const [k, , W, H] = q, key = "layout:" + k;
      return `<svg class="tiles" data-k="${key}" data-w="${W}" data-h="${H}" data-vh="${H + 0.25}" data-g="0" viewBox="0 0 ${W} ${H + 0.25}" style="width:${W * cs}px;height:${(H + 0.25) * cs}px">`
        + `<g class="grid">${Array.from({ length: W + 1 }, (_, c) => `<line x1="${c}" y1="0" x2="${c}" y2="${H}" />`).join("")}${Array.from({ length: H + 1 }, (_, r) => `<line x1="0" y1="${r}" x2="${W}" y2="${r}" />`).join("")}</g>`
        + `<rect x="0" y="${H}" width="${W}" height="0.25" fill="#7be38a55" />` + (() => { const T = tilesOf(key); return (k === "play" ? marks(H) : "") + T.map(z => tile(z, H)).join("") + routeSvg(k, H, W) + bandSvg(q[4], H, W); })() + `</svg>`; };
    // THE MODE'S BAND (found 2026-11-27 on his spider and ball-portal drawings): a ball / spider / flying portal sets a
    // floor and a ceiling around the portal (lib/physics.js BAND: ball 8 rows, spider 9, ship / ufo / wave / swing 10);
    // entered from the ground, nothing above that line can be reached -- the spider's flip lands on the band's roof.
    // A dashed line and a shade above it on every such section
    const BANDR = { ball: 8, spider: 9, ship: 10, ufo: 10, wave: 10, swing: 10 };
    const bandSvg = (mode, H, W) => { const n = BANDR[mode]; if (!n || n >= H) return "";
      return `<g style="pointer-events:none"><rect x="0" y="0" width="${W}" height="${H - n}" fill="#ff5a5a14" /><line x1="0" y1="${H - n}" x2="${W}" y2="${H - n}" stroke="#ff8a8a" stroke-dasharray="0.3 0.2" style="stroke-width:1.5px;vector-effect:non-scaling-stroke" /><text x="0.2" y="${H - n - 0.2}" font-size="0.55" fill="#ff8a8acc">${esc(mode)} band: ${n} rows from the ground, nothing above is reachable</text></g>`; };
    // the route: a soft line through the player's centre, a dot at each press; dashed and greyer when the section was
    // changed after it was solved (then it is the old route, until the next check)
    const routeOne = ROUTE1 = (C, H, W, dc, old) => { if (!C || !C.ok || !C.route) return "";
      const P = C.route.filter(z => z[0] >= 0 && z[0] <= W - dc).map(z => (z[0] + dc).toFixed(2) + "," + (H - z[1] - 0.5).toFixed(2)).join(" "), col = old ? "#b0b0c0" : "#7be3ff";
      return `<g class="rte" style="pointer-events:none"><polyline points="${P}" fill="none" stroke="${col}" stroke-opacity="${old ? 0.35 : 0.55}" stroke-linejoin="round" stroke-linecap="round"${old ? ' stroke-dasharray="4 4"' : ""} style="stroke-width:2.5px;vector-effect:non-scaling-stroke" />`
        + (C.taps || []).filter(z => z[0] >= 0 && z[0] <= W - dc).map(z => `<circle cx="${(z[0] + dc).toFixed(2)}" cy="${(H - z[1] - 0.5).toFixed(2)}" r="0.22" fill="${old ? "#b0b0c0" : "#ffe36b"}" fill-opacity="0.8" />`).join("") + `</g>`; };
    const chkOf = k => { const C = LCHK[k.slice(4)]; return C ? { C, old: C.mapHash !== undefined && C.mapHash !== hashTiles(tilesOf("layout:" + k)) } : null; };
    const routeSvg = (k, H, W) => { if (open.route === false) return "";
      if (k.startsWith("sec:")) { const x = chkOf(k); return x ? routeOne(x.C, H, W, 0, x.old) : ""; }
      if (k === "play") return SCENE_SEGS.filter(z => z.key).map(z => { const x = chkOf(z.key.slice(7)); return x ? routeOne(x.C, H, z.c0 + z.w, z.c0, x.old) : ""; }).join("");
      return ""; };
    // the check's numbers on the section's header line
    const chkLine = k => { const x = k.startsWith("sec:") && chkOf(k); if (!x) return "";
      if (!x.C.ok) return ` · <span style="color:#ff8a8a">❌ does not solve (col ${x.C.dieCol})</span>`;
      const t = (x.C.tight || [])[0]; return ` · <span style="color:${x.old ? "#999" : "#7be3ff"}">〰 ${x.C.presses} presses · ${esc(x.C.label || "")}${t ? " · tightest " + t.ms + " ms" : ""}${x.C.spread ? ` · height ${Math.round(x.C.spread.used * 100)}% of rows${x.C.spread.used < 0.6 || x.C.spread.even < 0.6 ? " (narrow)" : ""}` : ""}${x.old ? " · changed since, route is old" : ""}</span>`; };
    // soft markers on the current scene: a faint band over each join, a dashed line and the name where each section starts
    const marks = H => SCENE_SEGS.map(z => z.join ? `<rect x="${z.c0}" y="0" width="${z.w}" height="${H}" fill="#ffffff0d" />`
      : `<line x1="${z.c0}" y1="0" x2="${z.c0}" y2="${H}" stroke="#ffd84d66" stroke-dasharray="0.3 0.3" style="stroke-width:1px;vector-effect:non-scaling-stroke" /><text x="${z.c0 + 0.2}" y="0.7" font-size="0.6" fill="#ffd84daa" style="pointer-events:none">${esc(z.name)}</text>`).join("");
    const n = LPARTS.filter(q => q[0] !== "play" && (DRAW["layout:" + q[0]] || {}).tiles).length;   // parts he has edited
    const TOOLS = [["#", "▭ block"], ["/", "◢ slope"], ["\\", "◣ slope"], ["7", "◥ ceiling slope"], ["r", "◤ ceiling slope"], ["^", "▲ spike"], ["v", "▼ hanging spike"], ["o", "⚙ saw"], ["G", "🟡 gravity up"], ["N", "🔵 gravity back"], ["W", "┊ swing room mover"], ["H", "┊ ship room mover"], ["U", "┊ ufo room mover"], ["Y", "◎ yellow orb"], ["B", "◎ blue orb"], ["E", "◎ green orb"], ["J", "▬ yellow pad"], ["K", "▬ blue pad"], ["@", "📍 marker"], ["erase", "⌫ erase"]];
    const chips = `<span class="pens">` + LPARTS.map(q => `<button class="lpt${show(q[0]) ? " on" : ""}" data-p="${esc(q[0])}" title="${esc(q[5] || "")}">${show(q[0]) ? "☑" : "☐"} ${esc(q[1])}${q[0] !== "play" && (DRAW["layout:" + q[0]] || {}).tiles ? " ✏" : ""}</button>`).join("")
      + `<button class="lall">all</button><button class="lnone">none</button><button class="ladd">＋ section</button></span>`
      + (ADDFORM ? `<span class="pens laddf"><input class="lan" placeholder="name, e.g. robot stairs" maxlength="40">`
        + `<select class="lam">${MODES.map(m => `<option>${m}</option>`).join("")}</select>`
        + `<label>width <input class="law" type="number" min="8" max="80" value="32" style="width:52px"></label>`
        + `<label>height <input class="lah" type="number" min="4" max="14" value="10" style="width:46px"></label>`
        + `<label>after <select class="laa">${SECS().map(q => `<option value="${esc(q[0].slice(4))}"${q === SECS()[SECS().length - 1] ? " selected" : ""}>${esc(q[1])}</option>`).join("")}</select></label>`
        + `<button class="lago">add</button><button class="lacancel">cancel</button></span>` : "");
    const curTool = (TOOLS.find(t => t[0] === TOOL) || [, "pick a piece"])[1];
    const tools = FR("ltools", "pieces · " + esc(curTool), `<span class="pens">` + TOOLS.map(([k, l]) => `<button class="ptool${TOOL === k ? " on" : ""}" data-t="${esc(k)}">${l}</button>`).join("")
      + `<button class="pundo">↶ undo</button><button class="pclear">🗑 clear shown</button><button class="preset">↺ shown back to ours</button></span>`)
      + ` ` + FR("lview", "view", `<span class="pens"><button class="lroute${open.route === false ? "" : " on"}" title="the solver's route over each section">〰 solver path</button><button class="zoom" data-z="-1">−</button><button class="zoom" data-z="1">＋</button><button class="pfs">${fs ? "⤡ exit" : "⛶ full screen"}</button></span>`) + ` <span class="pens">`
      // a plain save, no sending (Evgeni: "i need a save there, without sending ... i would need to change a bit before
      // updating"); every edit also saves itself, the button saves the shown parts again and says when
      + `<button class="lsave">💾 save</button>`
      + (n || LPARTS.some(q => noteUnsent(q[0])) ? `<button class="msend" data-label="📨 send to Claude"${CAN_SEND ? "" : " disabled"}>📨 send to Claude</button>` : "") + `<span class="ds pst">${esc(DST.layout || "")}</span></span>`;
    return `<section data-g="layoutsec"><h2 class="stitle fold-h" role="button" tabindex="0" aria-expanded="${isOpen}">${isOpen ? "▾" : "▸"} Theme layout <span class="ds">the same for every theme · one part per kind of play · tap to place${n ? " · ✏ " + n : ""}</span></h2>`
      + (isOpen ? `<div class="dc lay board${fs ? " fs" : ""}" data-id="${LACT}"><div class="lyh">${FR("lsecs", "sections (" + LPARTS.filter(q => show(q[0])).length + " shown)", chips)}</div><div class="lyh">${tools}</div>`
        + LPARTS.filter(q => show(q[0])).map(q => `<div class="lpn"><b>${esc(q[1])}</b> · ${esc(q[4] || "")} · ${q[2]} x ${q[3]}${q[5] ? " · " + esc(q[5]) : ""}${chkLine(q[0])}${q[0].startsWith("sec:") ? ` ${FR("lsz:" + q[0], "size", `<span class="lsz" data-k="${esc(q[0])}"><button data-d="0,1" title="one row taller">⬆ taller</button><button data-d="0,-1" title="one row shorter">⬇ shorter</button><button data-d="2,0" title="two columns wider">➡ wider</button><button data-d="-2,0" title="two columns narrower">⬅ narrower</button></span>`)}` : ""}${ADDED[q[0].slice(4)] ? ` <button class="ldel" data-k="${esc(q[0].slice(4))}">✕ remove</button>` : ""}</div><div class="wide" data-w="L:${esc(q[0])}">${grid(q)}</div>`
          + `<div class="lnr"><input class="lnote" data-n="${esc(q[0])}" placeholder="your notes on ${esc(q[1])} ..." value="${esc((NOTES[q[0]] || {}).note || "")}"><span class="ds lnst" data-n="${esc(q[0])}">${esc(NST[q[0]] || "")}</span></div>${stLine(q[0])}`).join("")
        + genPanel() + `</div>` : "") + `</section>`;
  }
  // 🎲 THE GENERATOR (Evgeni 2026-11-27: "i want a button generate below the current that will just make a new one for me to
  // see and comment for the generation process"): tools/sectiongen.js runs right in the page (bundled into designs.js as
  // window.SectionGen), a type + length + difficulty -> a fresh section from the type's concept; his comment on it saves
  // as he types (a note on "gen:<type>:<seed>:<cols>:<tier>") and goes with 📨, so the generator can be fixed from it.
  // Not solver-checked in the page (that is node: tools/sectiongen.js check)
  let GENS = null; try { GENS = JSON.parse(localStorage.getItem("designs-gen") || "null"); } catch (e) {}
  // 〰 THE PATH OF A GENERATED PIECE (Evgeni 2026-11-27: "its generated with a path? show it, or give a button to see"): the
  // page can't solve, so every piece he generates is queued in collection "genroute" (doc id = its gen key, state "asked");
  // Claude solves it with tools/genroute.js (the same check as the board's 〰 solver path) and writes the route back into
  // that doc, and the page draws it as soon as it lands. 〰 path also pings Claude so it is solved now, not at the next wake.
  const GROUTE = {}, gid = gk => gk.replace(/[^A-Za-z0-9_\-.~:@+]/g, "_");
  async function askRoute(g, ping) { if (!DB || !g || !g.map) return; const gk = genKey(g), id = gid(gk);
    if (!GROUTE[id]) { GROUTE[id] = { state: "asked" };
      try { await DB.collection("genroute").doc(id).set({ gen: gk, key: g.key, seed: g.seed, cols: g.cols, tier: g.tier, map: g.map, mode: g.mode || "", state: "asked", at: new Date().toISOString() }); } catch (e) { GROUTE[id] = null; } }
    if (ping && CM && CM.sendToClaude) { const el = root.querySelector(".gpath"); try { await CM.sendToClaude({ anchor: await CM.anchorFor(el || root), text: "〰 solve the path of " + gk + " (collection genroute)" }); GROUTE[id].pinged = true; } catch (e) { GROUTE[id].pinged = false; } render(); } }
  const genKey = g => "gen:" + g.key + ":" + g.seed + ":" + g.cols + ":" + g.tier + (g.hf && g.hf !== 1 ? ":h" + g.hf : "");
  function generate(f) { const SG = window.SectionGen; if (!SG) return;
    const key = f.querySelector(".gk").value, cols = Math.max(12, Math.min(200, +f.querySelector(".gc").value || 40)), tier = f.querySelector(".gt").value, seed = 1 + Math.floor(Math.random() * 99999);
    // TALLER (Evgeni 2026-11-27: "can we increase the heights of the generations? by like 1.5 for now?"): the type's own
    // height times the chosen factor (default 1.5)
    const hf = +((f.querySelector(".gh") || {}).value || 1.5);
    try { let z = SG.make(key, { cols, seed, tier }); if (hf !== 1) z = SG.make(key, { cols, seed, tier, rows: Math.round(z.map.length * hf) });
      GENS = { key, cols, tier, seed, hf, map: z.map, mode: z.mode, concept: z.concept || "" }; askRoute(GENS, false); }
    catch (x) { GENS = { key, cols, tier, seed, err: String(x && x.message || x) }; }
    try { localStorage.setItem("designs-gen", JSON.stringify(GENS)); } catch (e) {} render(); }
  function genPanel() { const SG = window.SectionGen; if (!SG) return "";
    const nm = k => ((SECS().find(q => q[0] === "sec:" + k) || [])[1]) || k, g = GENS || { key: SG.KEYS[0], cols: 40, tier: "normal" };
    let out = `<div class="lpn" style="margin-top:14px"><b>🎲 generator</b> · a new section from a type's concept, any length and difficulty · your comment goes to Claude with 📨</div>`
      + `<div class="lyh gform"><span class="pens"><select class="gk">${SG.KEYS.map(k => `<option value="${esc(k)}"${k === g.key ? " selected" : ""}>${esc(nm(k))}</option>`).join("")}</select>`
      + `<label>length <input class="gc" type="number" min="12" max="200" value="${g.cols}" style="width:56px"></label>`
      + `<select class="gt">${["easy", "normal", "hard", "harder", "extreme"].map(t => `<option${t === g.tier ? " selected" : ""}>${t}</option>`).join("")}</select>`
      + `<select class="gh" title="height: the type's own times this">${[1, 1.25, 1.5, 2].map(v => `<option value="${v}"${v === (g.hf || 1.5) ? " selected" : ""}>height ×${v}</option>`).join("")}</select>`
      + `<button class="ggo">🎲 generate</button></span></div>`;
    if (GENS && GENS.err) out += `<div class="lpn" style="color:#ff8a8a">${esc(GENS.err)}</div>`;
    else if (GENS && GENS.map) { const H = GENS.map.length, W = GENS.map[0].length, cs = Math.round(26 * (open["zoom:layout"] || 1)), T = [];
      GENS.map.forEach((l, i) => [...l].forEach((ch, c) => { if (ch !== ".") T.push({ t: ch, c, r: H - 1 - i }); }));
      const gk = genKey(GENS), GR = GROUTE[gid(gk)];
      out += `<div class="lpn"><b>${esc(nm(GENS.key))}</b> · ${esc(GENS.mode || "")} · ${W} x ${H} · ${esc(GENS.tier)} · seed ${GENS.seed}${GENS.concept ? " · " + esc(GENS.concept) : ""}</div>`
        + `<div class="wide"><svg class="gtiles" viewBox="0 0 ${W} ${H + 0.25}" style="width:${W * cs}px;height:${(H + 0.25) * cs}px;background:#1a1636;display:block;max-width:none">`
        + `<g class="grid">${Array.from({ length: W + 1 }, (_, c) => `<line x1="${c}" y1="0" x2="${c}" y2="${H}" stroke="#ffffff30" style="stroke-width:1px;vector-effect:non-scaling-stroke" />`).join("")}${Array.from({ length: H + 1 }, (_, r) => `<line x1="0" y1="${r}" x2="${W}" y2="${r}" stroke="#ffffff30" style="stroke-width:1px;vector-effect:non-scaling-stroke" />`).join("")}</g>`
        + `<rect x="0" y="${H}" width="${W}" height="0.25" fill="#7be38a55" />` + T.map(z => TILE(z, H)).join("") + (GR && GR.ok ? ROUTE1(GR, H, W, 0, false) : "") + `</svg></div>`
        + `<div class="lyh"><button class="gpath" title="the solver's route over this piece (Claude solves it)">〰 path</button><button class="guse" title="put this piece in the layout as the ${esc(nm(GENS.key))} section, to see it in the scene and edit it there (the old drawing stays in the history)">✏ use in layout</button><span class="ds">${!GR ? "not asked yet" : GR.state === "done" ? (GR.ok ? `〰 ${GR.presses} presses · ${esc(GR.label || "")}${(GR.tight || [])[0] ? " · tightest " + GR.tight[0].ms + " ms" : ""}` : `<span style="color:#ff8a8a">❌ does not solve (col ${GR.dieCol}): ${esc(GR.why || "")}</span>`) : "asked Claude" + (GR.pinged === false ? " (the app held the ping back: it is solved at Claude's next look)" : "") + " · the path shows here when solved"}</span></div>`
        + `<div class="lnr"><input class="lnote" data-n="${esc(gk)}" placeholder="what's good or wrong in this one ..." value="${esc((NOTES[gk] || {}).note || "")}"><span class="ds lnst" data-n="${esc(gk)}">${esc(NST[gk] || "")}</span></div>${stLine(gk)}`; }
    return out; }
  // 📨 sends EVERYTHING new on the page in one message (marks of every theme, layout notes, drawings), whichever 📨 is
  // pressed: the top one beside ⟳, a card's, or ⟳ itself (Evgeni 2026-11-27: a note typed after a send stayed "not sent
  // yet" -- he pressed a theme card's 📨, which sent only that card's marks; "maybe it should send new stuff at some button
  // near refresh, or do it when i click refresh"). A drawing's sent state is saved too (a revision with sentAt), so a
  // refresh doesn't show it as new again.
  function collectNew() {
    const ms = MARKS.filter(unsent).sort((a, b) => (a.design > b.design ? 1 : a.design < b.design ? -1 : a.fx - b.fx));
    const keys = Object.keys(DRAW).filter(k => k !== "layout:play");
    // NEW = changed after the last send (one time stamp, collection "designsend"), not by Claude (Claude's revisions carry
    // sentAt == at). One stamp instead of a sent flag on every item: the flags went wrong (a drawing Claude had already
    // applied still showed as new), Evgeni 2026-11-27
    const after = x => x && String(x.at || "") > LAST && (x.sentAt || "") !== (x.at || "x");
    const fresh = keys.filter(k => DRAW[k] && (DRAW[k].tiles || (DRAW[k].strokes || []).length) && after(DRAW[k]));
    const nts = LPARTS.filter(q => noteUnsent(q[0]) && String((NOTES[q[0]] || {}).at || "") > LAST);
    const nss = Object.values(ADDED).filter(after);
    for (const k of Object.keys(NOTES)) if (k.startsWith("gen:") && noteUnsent(k) && String(NOTES[k].at || "") > LAST) nts.push([k, "🎲 generated " + k.split(":")[1] + " (seed " + k.split(":")[2] + ", " + k.split(":")[3] + " cols, " + k.split(":")[4] + ")"]);
    return { ms, fresh, nts, nss, n: ms.length + fresh.length + nts.length + nss.length };
  }
  async function sendNew(anchorEl, st) {
    const { ms, fresh, nts, nss, n } = collectNew(), say = t => { if (st) st.textContent = t; const g = document.getElementById("sendall-st"); if (g) g.textContent = t; };
    if (!n) { say("nothing new: everything was sent already"); return true; }
    if (!CM || !CM.sendToClaude) { say("not sent: only on the claude.ai page"); return false; }
    const nameOf = id => (L.find(x => x.id === id) || { name: id }).name;
    const byTheme = {}; for (const m of ms) (byTheme[m.design] = byTheme[m.design] || []).push(m);
    const text = Object.keys(byTheme).map(id => `📍 marks on the ${nameOf(id)} theme scene (catalogue Themes tab):\n` + byTheme[id].map((m, i) => `${i + 1}. col ${m.col}, row ${m.row} (x ${m.x}, y ${m.y}): ${noteOf(m).trim() || "(no note)"}`).join("\n") + "\n").join("")
      + nss.map(z => z.deleted ? `➖ section removed from the theme layout: ${z.name} (sec:${z.key})\n` : `➕ new section on the theme layout: ${z.name} (sec:${z.key}), ${z.mode}, ${z.w} x ${z.h}, after ${z.after}\n`).join("")
      + nts.map(q => `💬 note on the theme layout, ${q[1]} (${q[0]}): ${NOTES[q[0]].note.trim()}\n`).join("")
      + fresh.map(k => `✏ drawing on the ${k.startsWith("layout:") ? "theme layout, " + ((LPARTS.find(q => "layout:" + q[0] === k) || [])[1] || k) : k}: edited (${(DRAW[k].tiles || []).length} pieces; the whole map is in collection designdraw)`).join("\n");
    say("sending " + n + " ...");
    // claude.ai refuses a send within ~6 s of the last key or click in the page (taps on the board count too), and the send
    // must come straight from the click on 📨: a send delayed by a timer is refused as well (Evgeni 2026-11-27, after a
    // version that waited and retried by itself: "send to claude doesnt send"). So: inside the hold, count down and let him
    // press again; never send later by itself
    let sent = false, why = "";
    try { const anchor = await CM.anchorFor(anchorEl || root); await CM.sendToClaude({ anchor, text: text.slice(0, 4000) }); sent = true; }
    catch (x) { why = x && (x.code || x.message) || String(x); lastKey = Date.now(); holdSend(); }
    // READY CUE (Evgeni 2026-11-27: "happens too much how can we workaround it"): the app's hold can't be skipped, and a
    // send must come from his tap, so the page only says WHEN a tap will go through: the 📨 buttons light up "tap now" once
    // the hold since his last key or tap is over (a label change; nothing is sent by itself). And he can always just write
    // "comments" in the chat: everything is saved in the db, Claude reads what is new since the last send from there.
    if (!sent) { say("saved ✓ — the app didn't pass the wake-up on, but Claude reads everything saved whenever it wakes; a word in the chat wakes it now");
      clearTimeout(readyT); const cue = () => { const left = HOLD - (Date.now() - lastKey); if (left > 0) { readyT = setTimeout(cue, left + 100); return; }
        for (const b of document.querySelectorAll("#sendall, .msend")) { b.classList.add("ready"); if (b.id === "sendall") b.textContent = "📨 tap now"; }
        say("saved ✓ — tap 📨 again to wake Claude, or write any word in the chat"); };
      // the refused tap is itself the app's "last click": the next send is allowed only a full hold after it (the cue lit up
      // 1.5 s after a refusal and the green tap was refused again, Evgeni 2026-11-27: "that green msg doesnt work still")
      lastKey = Date.now(); cue(); return false; }
    LAST = new Date().toISOString(); try { if (DB) await DB.collection("designsend").doc("s-" + Date.now().toString(36)).set({ at: LAST }); } catch (x) {}
    for (const q of nts) NST[q[0]] = "sent";
    for (const m of ms) { PEND[m.mid] = noteOf(m); m.sentNote = noteOf(m).trim(); m.sent = new Date().toISOString(); await saveMark(m.mid); }
    say("sent " + n + " to Claude " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })); render(); return true;
  }
  // the top 📨 beside ⟳ (tools/snippets/refresh.html calls window.rfBeforeReload before it reloads)
  function topSend() { const rf = document.getElementById("rf"); if (!rf) return; let b = document.getElementById("sendall");
    if (!b) { b = document.createElement("button"); b.id = "sendall"; b.title = "send everything new to Claude"; b.style.cssText = "width:auto;border-radius:15px;padding:0 10px;font-size:13px";
      const s2 = document.createElement("span"); s2.id = "sendall-st"; rf.prepend(s2); rf.insertBefore(b, document.getElementById("rfb"));
      b.onclick = () => sendNew(null, null); }
    const n = collectNew().n; if (!b.classList.contains("ready") || !n) { b.classList.remove("ready"); b.textContent = n ? "📨 " + n + " new" : "📨"; } b.disabled = !n;
    b.title = "send everything new to Claude" + (LASTC ? " · Claude last read the queue " + new Date(LASTC).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""); }
  setInterval(() => { try { topSend(); } catch (x) {} }, 1500);
  // ⟳ tries to send what is new, and reloads either way (nothing is lost: everything is saved in the page's database)
  window.rfBeforeReload = async () => { if (collectNew().n) { try { await sendNew(null, null); } catch (x) {} } return true; };
  function render() {
    keepScroll(); try { topSend(); } catch (x) {}
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
    putScroll(); if (PLAY && PLAY.paused) requestAnimationFrame(stepPlay);
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
    if (lf) { const k = "layout:" + lf.dataset.lf; open[k] = open[k] !== true; try { localStorage.setItem("designs-open", JSON.stringify(open)); } catch (x) {} render(); return; }
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
    if (e.target.closest(".ggo")) { generate(e.target.closest(".gform")); return; }
    if (e.target.closest(".gpath")) { askRoute(GENS, true); return; }
    // a generated piece into the layout editor (Evgeni 2026-11-27: "i cant see them in the editor (the layout for example
    // ball corridor)"): it becomes that section's newest drawing, at its size, so it shows in the current scene and can be edited
    if (e.target.closest(".guse") && GENS && GENS.map) { const H = GENS.map.length, W = GENS.map[0].length, id = "layout:sec:" + GENS.key, T = [];
      GENS.map.forEach((l, i) => [...l].forEach((ch, c) => { if (ch !== ".") T.push({ c, r: H - 1 - i, t: ch }); }));
      DRAW[id] = Object.assign(DRAW[id] || {}, { strokes: [], tiles: T }); saveDraw(id);
      const k = "sec:" + GENS.key, id2 = GENS.key;
      if (ADDED[id2]) { ADDED[id2].w = W; ADDED[id2].h = H; saveSec(id2); }
      else { SIZE[k] = { part: k, w: W, h: H, at: new Date().toISOString() };
        if (DB) DB.collection("designsize").doc(k.replace(/[^A-Za-z0-9_-]/g, "_") + "-" + Date.now().toString(36)).set(SIZE[k]).catch(() => {}); }
      e.target.closest(".guse").textContent = "✓ in the layout"; render(); return; }
    if (e.target.closest(".lroute")) { open.route = open.route === false; try { localStorage.setItem("designs-open", JSON.stringify(open)); } catch (x) {} render(); return; }
    const lsz = e.target.closest(".lsz button"); if (lsz) { const [dw, dh] = lsz.dataset.d.split(",").map(Number); await resize(lsz.closest(".lsz").dataset.k, dw, dh); return; }
    if (e.target.closest(".ladd")) { ADDFORM = !ADDFORM; render(); const i = root.querySelector(".lan"); if (i) i.focus(); return; }
    if (e.target.closest(".lacancel")) { ADDFORM = false; render(); return; }
    if (e.target.closest(".lago")) { const f = e.target.closest(".laddf"), v = c => f.querySelector(c).value;
      const name = v(".lan").trim() || "new section", key = "my-" + Date.now().toString(36);
      ADDED[key] = { key, name, mode: v(".lam"), w: Math.max(8, Math.min(80, +v(".law") || 32)), h: Math.max(4, Math.min(14, +v(".lah") || 10)), after: v(".laa") };
      ADDFORM = false; open["lpart:sec:" + key] = true; try { localStorage.setItem("designs-open", JSON.stringify(open)); } catch (x) {}
      await saveSec(key); render(); return; }
    const ldel = e.target.closest(".ldel"); if (ldel) { const z = ADDED[ldel.dataset.k]; if (z) { z.deleted = true; await saveSec(z.key); render(); } return; }
    const lpt = e.target.closest(".lpt"); if (lpt) { const k = "lpart:" + lpt.dataset.p; open[k] = !lsh(lpt.dataset.p); try { localStorage.setItem("designs-open", JSON.stringify(open)); } catch (x) {} render(); return; }
    const pc = e.target.closest(".pcol"); if (pc) { PCOL = pc.dataset.c; ERASE = false; render(); return; }
    const pw = e.target.closest(".pw"); if (pw) { PW_ = +pw.dataset.w; render(); return; }
    if (e.target.closest(".perase")) { ERASE = !ERASE; render(); return; }
    if (e.target.closest(".pfs")) { const id0 = e.target.closest(".dc").dataset.id, id = id0.startsWith("layout") ? "layout" : id0; FS = FS === id ? null : id; render(); return; }
    if (e.target.closest(".lay") && e.target.closest(".pundo")) { const h = HIST.pop(); if (h) { for (const x of h.multi || [h]) { const was = JSON.stringify((DRAW[x.k] || {}).tiles || null); if (was === JSON.stringify(x.tiles)) continue; DRAW[x.k] = Object.assign(DRAW[x.k] || {}, { tiles: x.tiles }); saveDraw(x.k); } render(); } return; }
    if (e.target.closest(".lay") && e.target.closest(".preset")) { for (const q of LPARTS) { const k = "layout:" + q[0]; if (q[0] !== "play" && (DRAW[k] || {}).tiles && lsh(q[0])) { HIST.push({ k, tiles: DRAW[k].tiles }); DRAW[k].tiles = null; saveDraw(k); } } render(); return; }
    if (e.target.closest(".lay") && e.target.closest(".pclear")) { for (const q of LPARTS) { const k = "layout:" + q[0]; if (!lsh(q[0]) || q[0] === "play") continue; HIST.push({ k, tiles: (DRAW[k] || {}).tiles || null }); DRAW[k] = Object.assign(DRAW[k] || {}, { tiles: [] }); saveDraw(k); } render(); return; }
    if (e.target.closest(".pundo") || e.target.closest(".pclear")) { const id = e.target.closest(".dc").dataset.id, D0 = DRAW[id] || { strokes: [] };
      DRAW[id] = { strokes: e.target.closest(".pclear") ? [] : D0.strokes.slice(0, -1) }; render(); saveDraw(id); return; }
    // ▶ play: the camera and the player along the route at game speed (designs.js animOf); ■ stops, the speed button
    // steps 1x -> 0.5x -> 0.25x
    const ab = e.target.closest(".abuild"); if (ab) { const id = ab.closest(".dc").dataset.id, d = L.find(x => x.id === id) || {};
      await ask(ab, id, `🔨 build request: rebuild the ${d.name || id} theme (${id}) from the current scene of the theme layout (every section joined), then republish its card.`); return; }
    const ap = e.target.closest(".aplay"); if (ap) { const id = ap.closest(".dc").dataset.id; if (PLAY && PLAY.id === id) { if (PLAY.paused) resumePlay(); else pausePlay(); } else { startPlay(id); render(); } return; }
    if (e.target.closest(".astop")) { stopPlay(); render(); return; }
    const asp = e.target.closest(".aspd"); if (asp) { ASPD = ASPD === 1 ? 0.5 : ASPD === 0.5 ? 0.25 : 1; if (PLAY) { PLAY.t0 = performance.now() - PLAY.i / 60 / ASPD * 1000; } for (const b of root.querySelectorAll(".aspd")) b.textContent = ASPD + "x"; return; }
    const zb = e.target.closest(".zoom");
    if (zb) { const id0 = zb.closest(".dc").dataset.id, id = id0.startsWith("layout") ? "layout" : id0, k = "zoom:" + id, z = open[k] || 1;
      open[k] = Math.max(0.5, Math.min(3, +(z * (+zb.dataset.z > 0 ? 1.4 : 1 / 1.4)).toFixed(3)));
      try { localStorage.setItem("designs-open", JSON.stringify(open)); } catch (x) {} render(); return; }
    const rf = e.target.closest(".rfold");
    if (rf) { const k = "rf:" + rf.dataset.rf; open[k] = !open[k]; try { localStorage.setItem("designs-open", JSON.stringify(open)); } catch (x) {} render(); return; }
    const tf = e.target.closest(".tfold");
    if (tf) { const k = "theme:" + tf.dataset.tf; open[k] = !open[k]; if (!open[k] && PLAY && PLAY.id === tf.dataset.tf && typeof stopPlay === "function") stopPlay();
      try { localStorage.setItem("designs-open", JSON.stringify(open)); } catch (x) {} render(); return; }
    const mf = e.target.closest(".mfold");
    if (mf) { const k = "marks:" + mf.dataset.mf; open[k] = !open[k]; try { localStorage.setItem("designs-open", JSON.stringify(open)); } catch (x) {} render(); return; }
    const sh = e.target.closest(".mseen-h");
    if (sh) { const k = "seen:" + sh.dataset.seen; open[k] = !open[k]; try { localStorage.setItem("designs-open", JSON.stringify(open)); } catch (x) {} render(); return; }
    const snd = e.target.closest(".msend");
    if (snd) { const c = snd.closest(".dc"); sendNew(c, c.querySelector(".msst") || c.querySelector(".pst")); return; }
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
  function paint(k, cell, first) { if (!cell) return;
    if (k === "layout:play") { const st = root.querySelector(".lay .pst"), z = segAt(cell[0]);
      if (!z || z.join) { if (st) st.textContent = z ? `this is the join ${z.name}: it follows the sections around it` : "outside the scene"; return; }
      if (cell[1] >= z.h) { if (st) st.textContent = `${z.name} is ${z.h} rows high`; return; }
      const done = painting.done, key = k + ":" + cell.join(","); if (!first && done.has(key)) return;
      const inner = { ...painting, done: new Set(first ? [] : [...done].filter(x => x.startsWith(z.key + "|")).map(x => x.slice(z.key.length + 1))) };
      const outer = painting; painting = inner; paint(z.key, [cell[0] - z.c0, cell[1]], first); outer.mode = inner.mode; outer.changed = outer.changed || inner.changed;
      for (const x of inner.done) done.add(z.key + "|" + x); painting = outer; (painting.touched = painting.touched || new Set()).add(z.key);
      if (first) painting.mode = inner.mode; drawTiles(k); if (st) st.textContent = `${z.name}: col ${cell[0] - z.c0}, row ${cell[1]}`; return; }
    const D0 = DRAW[k] = DRAW[k] || {}; if (!D0.tiles) D0.tiles = tilesOf(k).map(q => Object.assign({}, q));
    const i = D0.tiles.findIndex(q => q.c === cell[0] && q.r === cell[1]);
    if (first) painting.mode = TOOL === "erase" || (i >= 0 && D0.tiles[i].t === TOOL) ? "del" : "put";
    const key = cell.join(","); if (painting.done.has(key)) return; painting.done.add(key);
    if (painting.mode === "del") { if (i >= 0) D0.tiles.splice(i, 1); } else { if (i >= 0) D0.tiles.splice(i, 1); D0.tiles.push({ t: TOOL, c: cell[0], r: cell[1] }); }
    orient(D0.tiles); painting.changed = true; drawTiles(k); }
  // spikes point away from what holds them (Evgeni 2026-11-27: "i put spikes on the roof so reverse them if needed"): a
  // spike with a block over it and nothing under it hangs (v), one on a block or the ground stands (^). Same rule in
  // tools/designs.js orient() when his map is applied.
  function orient(T) { const at = new Map(T.map(q => [q.c + "," + q.r, q.t])), solid = (c, r) => r < 0 || /[#7r\/\\]/.test(at.get(c + "," + r) || "");
    for (const q of T) if (q.t === "^" && !solid(q.c, q.r - 1) && solid(q.c, q.r + 1)) q.t = "v"; else if (q.t === "v" && solid(q.c, q.r - 1) && !solid(q.c, q.r + 1)) q.t = "^"; }
  function drawTiles(k) { const svg = root.querySelector(`.tiles[data-k="${k}"]`); if (!svg) return; for (const el of svg.querySelectorAll(".tl")) el.remove();
    const tmp = document.createElement("div"); tmp.innerHTML = `<svg>${tilesOf(k).map(z => TILE(z, +svg.dataset.h)).join("")}</svg>`; for (const el of [...tmp.firstChild.childNodes]) svg.appendChild(el); }
  // the board's svg under a tap, also when the tap lands on its holder: the claude.ai app can lay its own layer or rules
  // over svg (Evgeni 2026-11-27: "regardless of what i select ... nothing happens" there, while a plain browser drew)
  const tilesAt = e => { const t = e.target; if (!t || !t.closest) return null; const s = t.closest(".tiles"); if (s) return s;
    const w = t.closest(".lay .wide"); return w ? w.querySelector(".tiles") : null; };
  root.addEventListener("pointerdown", e => { const ts = tilesAt(e); if (!ts) return; e.preventDefault();
    try { ts.setPointerCapture(e.pointerId); } catch (x) {} const k = ts.dataset.k; LACT = k; const w = ts.closest(".dc"); if (w) w.dataset.id = k;
    HIST.push(k === "layout:play" ? sceneSnap() : { k, tiles: (DRAW[k] || {}).tiles ? JSON.parse(JSON.stringify(DRAW[k].tiles)) : null }); if (HIST.length > 50) HIST.shift();
    painting = { k, svg: ts, done: new Set(), changed: false }; const c0 = cellOf(ts, e); paint(k, c0, true);
    const st = root.querySelector(".lay .pst"); if (st) st.textContent = c0 ? `${TOOL === "erase" ? "erase" : TOOL} at col ${c0[0]}, row ${c0[1]}` : "tap outside the grid"; }, true);
  root.addEventListener("pointermove", e => { if (!painting) return; paint(painting.k, cellOf(painting.svg, e), false); }, true);
  let lastPaint = 0;
  // a stroke on the current scene saves the sections it touched
  const saveStroke = p => { for (const k of p.k === "layout:play" ? [...(p.touched || [])] : [p.k]) saveDraw(k); };
  const endPaint = () => { if (!painting) return; const p = painting; painting = null; lastPaint = Date.now(); if (p.changed) { saveStroke(p); render(); } };
  // a tap also arrives as a click (Evgeni 2026-11-27: "i click nothing happens, im on blocks"): when no pointer stroke
  // handled it just before (some views never pass pointer events on), the click places or takes away the tile itself
  root.addEventListener("click", e => { const ts = tilesAt(e); if (!ts || Date.now() - lastPaint < 400) return;
    const k = ts.dataset.k, cell = cellOf(ts, e); LACT = k; const st = root.querySelector(".lay .pst");
    if (!cell) { if (st) st.textContent = "tap outside the grid"; return; }
    HIST.push(k === "layout:play" ? sceneSnap() : { k, tiles: (DRAW[k] || {}).tiles ? JSON.parse(JSON.stringify(DRAW[k].tiles)) : null });
    painting = { k, svg: ts, done: new Set(), changed: false }; paint(k, cell, true); const p = painting; painting = null; lastPaint = Date.now();
    if (p.changed) { saveStroke(p); render(); } }, true);
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
  root.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.classList && e.target.classList.contains("lan")) { e.preventDefault(); const b = root.querySelector(".lago"); if (b) b.click(); return; }
    if (e.key === "Enter" && e.target.classList && e.target.classList.contains("lnote")) { e.preventDefault(); clearTimeout(noteT); saveNote(e.target.dataset.n); return; }
    if (e.key === "Enter" && e.target.closest && e.target.closest("[data-m]")) { e.preventDefault(); const row = e.target.closest("[data-m]"); PEND[row.dataset.m] = e.target.value; saveMark(row.dataset.m); return; } if (e.key === "Enter" && e.target.classList.contains("fold-h")) e.target.click(); });
  root.addEventListener("input", e => {
    if (e.target.classList && e.target.classList.contains("lnote")) { const k = e.target.dataset.n; NOTES[k] = Object.assign(NOTES[k] || {}, { note: e.target.value });
      lastKey = Date.now(); holdSend(); NST[k] = "…"; const st = root.querySelector(`.lnst[data-n="${CSS.escape(k)}"]`); if (st) st.textContent = "…";
      clearTimeout(noteT); noteT = setTimeout(() => saveNote(k), 700); return; }
    const mrow = e.target.closest("[data-m]"); if (!mrow) return;
    const mid = mrow.dataset.m; PEND[mid] = e.target.value; lastKey = Date.now(); holdSend(); MST[mid] = "…"; const st = mrow.querySelector(".mst"); if (st) st.textContent = "…";
    clearTimeout(saveT); saveT = setTimeout(() => saveMark(mid), 700);
  });
  root.addEventListener("focusout", e => { if (e.target.classList && e.target.classList.contains("lnote")) { clearTimeout(noteT); const k = e.target.dataset.n; if (NST[k] === "…") saveNote(k); return; } });
  root.addEventListener("focusout", e => { if (e.target.closest && e.target.closest("[data-m]")) flushMarks(); });
  root.addEventListener("change", async e => {
    if (e.target.id === "dvf") return render();
    // the animation style: kept per card, starts ▶ at once so the choice is seen
    if (e.target.classList.contains("acol")) { const id = e.target.closest(".dc").dataset.id; open["acol:" + id] = e.target.value;
      try { localStorage.setItem("designs-open", JSON.stringify(open)); } catch (x) {} if (!PLAY || PLAY.id !== id) startPlay(id); return; }
    if (e.target.classList.contains("asty")) { const id = e.target.closest(".dc").dataset.id; open["anim:" + id] = e.target.value;
      try { localStorage.setItem("designs-open", JSON.stringify(open)); } catch (x) {} if (!PLAY || PLAY.id !== id) startPlay(id); return; }
    if (e.target.classList.contains("pany")) { PCOL = e.target.value; ERASE = false; render(); return; }
    if (e.target.classList.contains("pbg")) { const id0 = e.target.closest(".dc").dataset.id; BG[id0.startsWith("layout") ? "layout" : id0] = e.target.value; render(); return; }
    const mrow = e.target.closest("[data-m]");
    if (mrow) { PEND[mrow.dataset.m] = e.target.value; await saveMark(mrow.dataset.m); return; }
    if (e.target.tagName !== "TEXTAREA") return;
    const c = e.target.closest(".dc"), st = c.querySelector(".ds");
    st.textContent = "saving ...";
    try { await save(c.dataset.id, { comment: e.target.value.trim() }); st.textContent = "saved"; } catch (x) { st.textContent = "not saved: " + x.message; }
  });
  // any error in the board shows on its status line, so "nothing happens" always says why
  addEventListener("error", e => { const st = root.querySelector(".lay .pst"); if (st) st.textContent = "error: " + (e.message || e); });
  render();
  for (let k = 0; k < 15 && !(window.claude && window.claude.use); k++) await new Promise(r => setTimeout(r, 200));
  try {
    if (window.claude && window.claude.use) DB = await window.claude.use("db");
    if (DB) DB.collection("designvotes").onSnapshot(snap => {
      const v = {}; for (const d of snap.docs) { const b = d.data(); if (b && b.id) v[b.id] = b; }
      VOTES = v; if (!root.contains(document.activeElement) || document.activeElement.tagName !== "TEXTAREA") render();
    }, () => {});
    if (DB) DB.collection("designdraw").onSnapshot(snap => {
      for (const d of snap.docs.map(x => x.data())) if (d && d.design && (!DRAW[d.design] || !DRAW[d.design].at || String(d.at) > String(DRAW[d.design].at))) if (!cur) { DRAW[d.design] = JSON.parse(JSON.stringify(d)); if (DRAW[d.design].tiles) orient(DRAW[d.design].tiles); }   // a plain copy: the db hands back frozen objects, and editing one in place threw (2026-11-27: taps and clear did nothing in the app)
      if (!cur && !(document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName))) render();
    }, () => {});
    if (DB) DB.collection("designsize").onSnapshot(snap => {
      for (const d of snap.docs.map(x => JSON.parse(JSON.stringify(x.data())))) if (d && d.part && (!SIZE[d.part] || String(d.at) > String(SIZE[d.part].at))) SIZE[d.part] = d;
      if (!(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) render();
    }, () => {});
    if (DB) DB.collection("designsecs").onSnapshot(snap => {
      for (const d of snap.docs.map(x => JSON.parse(JSON.stringify(x.data())))) if (d && d.key && (!ADDED[d.key] || String(d.at) > String(ADDED[d.key].at || ""))) ADDED[d.key] = d;
      if (!(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) render();
    }, () => {});
    // the last send AND the last time Claude read the queue (Evgeni 2026-11-27: "those 6 new, you really didnt see them? i
    // sent them"): the old listener used snap.forEach, which the app's snapshot lacks, so after a reload LAST fell back to
    // its default and everything since 14:40 counted as new again. Claude writes a stamp here too ({at, by: "claude"})
    // each time it reads the queue, so what Claude has seen stops counting as new without any send
    if (DB) DB.collection("designsend").onSnapshot(snap => { let m = LAST; for (const d of snap.docs.map(x => JSON.parse(JSON.stringify(x.data() || {})))) { const a = String(d.at || ""); if (a > m) m = a; if (d.by === "claude" && a > LASTC) LASTC = a; }
      if (m !== LAST) { LAST = m; try { topSend(); } catch (x) {} if (!(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) render(); } }, () => {});
    if (DB) DB.collection("genroute").onSnapshot(snap => {
      for (const x of snap.docs) { const d = JSON.parse(JSON.stringify(x.data() || {})); const old = GROUTE[x.id]; GROUTE[x.id] = Object.assign({}, d, old && old.pinged != null ? { pinged: old.pinged } : {}); }
      if (!(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) render(); }, () => {});
    if (DB) DB.collection("claudestatus").onSnapshot(snap => {
      for (const d of snap.docs.map(x => JSON.parse(JSON.stringify(x.data() || {})))) if (d.part && (!CST[d.part] || String(d.at) > String(CST[d.part].at))) CST[d.part] = d;
      if (!(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) render(); }, () => {});
    if (DB) DB.collection("designnotes").onSnapshot(snap => {
      for (const d of snap.docs.map(x => JSON.parse(JSON.stringify(x.data())))) if (d && d.part && (!NOTES[d.part] || !NOTES[d.part].at || String(d.at) > String(NOTES[d.part].at))) {
        const el = document.activeElement; if (el && el.classList && el.classList.contains("lnote") && el.dataset.n === d.part) continue;   // never under his typing
        NOTES[d.part] = d; }
      if (!(document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName))) render();
    }, () => {});
    if (DB) DB.collection("designmarks").onSnapshot(snap => {
      const local = MARKS.filter(m => MST[m.mid] !== "saved" && !m.seen);
      MARKS = latest(snap.docs.map(d => JSON.parse(JSON.stringify(d.data()))));
      for (const m of local) if (!MARKS.some(z => z.mid === m.mid)) MARKS.push(m);
      if (!root.contains(document.activeElement) || !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) render();
    }, () => {});
    if (window.claude && window.claude.use) CM = await window.claude.use("comments");
    // the button shows whenever the page can comment; whether a Claude session takes it is checked on the tap
    CAN_SEND = !!(CM && CM.sendToClaude); if (CAN_SEND && !(document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName))) render();
  } catch (e) {}
};
