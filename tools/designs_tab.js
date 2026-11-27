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
  #designs .k-theme .wide img{height:220px}
  #designs .mk{position:relative;display:inline-block;line-height:0}#designs .mk img{display:block}
  #designs .mk.on{cursor:crosshair;outline:2px dashed #ffd84d}
  #designs .pin{position:absolute;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;background:#ffd84d;color:#000;font:700 11px/20px system-ui;text-align:center;border:2px solid #000;pointer-events:none}
  #designs .mks{font-size:12px;margin:4px 0}#designs .mks div{display:flex;gap:6px;align-items:center;margin:2px 0}
  #designs .mks input{flex:1;min-width:0;background:#141024;color:#eee;border:1px solid #444;border-radius:6px;padding:4px 6px}
  #designs .pin.seen{background:#7be38a;opacity:.7}
  #designs .mseen-h{cursor:pointer;color:var(--mute);margin:4px 0}#designs .mks .mseen{color:var(--mute);flex-wrap:wrap}#designs .mseen i{flex-basis:100%;padding-left:16px;color:#9fd6a8}
  #designs .msend{margin-top:4px}
  #designs .mks button{background:#241d3d;color:#ddd;border:1px solid #444;border-radius:6px;padding:2px 7px}
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
  try { L = await (await fetch("designs.json")).json(); } catch (e) { root.querySelector("#dgroups").textContent = "designs.json did not load"; return; }
  let VOTES = {}, DB = null, CM = null, CAN_SEND = false, MODE = "designs", MARKS = [], MARKING = null;
  // typed mark notes not yet confirmed by the database: they win over snapshots, so a re-render never drops text
  const PEND = {}, MST = {}; let saveT = null;
  // a mark is sent once: 📨 sends only marks never sent, or whose note changed since (no repeats; Evgeni 2026-11-27)
  const unsent = m => !m.seen && noteOf(m).trim() && m.sentNote !== noteOf(m).trim();
  const noteOf = m => PEND[m.mid] !== undefined ? PEND[m.mid] : (m.note || "");
  async function saveMark(mid) {
    const m = MARKS.find(z => z.mid === mid); if (!m) return;
    if (PEND[mid] !== undefined) m.note = PEND[mid].trim();
    m.at = new Date().toISOString(); const want = m.note;
    const st = root.querySelector(`[data-m="${mid}"] .mst`);
    try { if (!DB) throw new Error("saves on the claude.ai page"); await DB.collection("designmarks").doc(mid).set(Object.assign({}, m));
      if (PEND[mid] !== undefined && PEND[mid].trim() === want) delete PEND[mid]; MST[mid] = "saved"; }
    catch (x) { MST[mid] = "not saved: " + (x && (x.code || x.message) || x); }
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
    const media = d.kind === "theme" ? `<div class="wide"><div class="mk${MARKING === d.id ? " on" : ""}">${img}${pins}</div></div>`
      + `<div class="mks">${ms.map((m, i) => `<div data-m="${esc(m.mid)}"><b>${i + 1}</b><input value="${esc(noteOf(m))}" placeholder="what is off here"><button class="mdel" title="remove">✕</button><span class="ds mst">${esc(MST[m.mid] || "")}</span></div>`).join("")}`
      + (seen.length ? `<div class="mseen-h" role="button" data-seen="${esc(d.id)}">${so ? "▾" : "▸"} ✓ ${seen.length} seen by Claude, being fixed</div>`
        + (so ? seen.map(m => `<div class="mseen" data-m="${esc(m.mid)}">✓ <span>${esc(m.note || "")}</span>${m.reply ? `<i>${esc(m.reply)}</i>` : ""}<button class="mdel" title="remove">✕</button></div>`).join("") : "") : "")
      + (CAN_SEND && ms.some(unsent) ? `<button class="msend" title="send the new notes to Claude">📨 send ${ms.filter(unsent).length} new to Claude</button><span class="ds msst"></span>` : ms.length && CAN_SEND ? `<span class="ds">all sent to Claude</span>` : "") + `</div>`
      : d.kind === "structure" ? `<div class="wide">${img}</div>` : img;
    return `<div class="dc k-${d.kind}" data-id="${esc(d.id)}">${media}
      <div class="dt"><span class="dn">${d.n ? d.n + " " : ""}${esc(d.name)}</span>${d.note ? `<div class="dm">${esc(d.note)}</div>` : ""}</div>
      <div class="dv"><button class="up${v.vote > 0 ? " on" : ""}" title="I like it">👍</button><button class="down${v.vote < 0 ? " on" : ""}" title="not so much">👎</button>
      <button class="com" title="a comment">💬${v.comment ? "•" : ""}</button>${d.kind === "theme" ? `<button class="mark${MARKING === d.id ? " on" : ""}" title="mark a spot on the scene">📍</button>` : ""}<span class="ds">${v.at ? "saved" : ""}</span>
      <textarea hidden placeholder="what is good or off about it">${esc(v.comment || "")}</textarea></div></div>`;
  }
  function render() {
    const f = root.querySelector("#dvf").value, G = GROUPS.filter(([k]) => (MODE === "themes") === (k === "theme"));
    const ok = d => { const v = VOTES[d.id]; return !f || (f === "up" ? v && v.vote > 0 : f === "down" ? v && v.vote < 0 : !v || !v.vote); };
    let n = 0;
    root.querySelector("#dgroups").innerHTML = G.map(([k, title, sub]) => {
      const ds = L.filter(d => d.kind === k && ok(d)); n += ds.length;
      const isOpen = open[k] !== false;
      return `<section data-g="${k}"><h2 class="stitle fold-h" role="button" tabindex="0" aria-expanded="${isOpen}">${isOpen ? "▾" : "▸"} ${title} <span class="ds">${ds.length}${sub ? " · " + sub : ""}</span></h2>
        <div class="dgrid"${isOpen ? "" : " hidden"}>${ds.map(card).join("")}</div></section>`;
    }).join("");
    root.querySelector("#dcount").textContent = `${n} designs`;
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
    const sh = e.target.closest(".mseen-h");
    if (sh) { const k = "seen:" + sh.dataset.seen; open[k] = !open[k]; try { localStorage.setItem("designs-open", JSON.stringify(open)); } catch (x) {} render(); return; }
    const snd = e.target.closest(".msend");
    if (snd) { const c = snd.closest(".dc"), id = c.dataset.id, st = c.querySelector(".msst"), d = L.find(x => x.id === id);
      const ms = MARKS.filter(m => m.design === id && unsent(m)).sort((a, b) => a.fx - b.fx);
      const text = `📍 marks on the ${d.name} theme scene (catalogue Themes tab):\n` + ms.map((m, i) => `${i + 1}. col ${m.col}, row ${m.row} (x ${m.x}, y ${m.y}): ${noteOf(m).trim() || "(no note)"}`).join("\n");
      st.textContent = "sending ...";
      try { const anchor = await CM.anchorFor(c); await CM.sendToClaude({ anchor, text: text.slice(0, 4000) });
        for (const m of ms) { PEND[m.mid] = noteOf(m); m.sentNote = noteOf(m).trim(); m.sent = new Date().toISOString(); await saveMark(m.mid); }
        render(); }
      catch (x) { st.textContent = "not sent: " + (x && (x.code || x.message) || x); }
      return; }
    const h = e.target.closest(".fold-h");
    if (h) { const k = h.parentNode.dataset.g; open[k] = open[k] === false; try { localStorage.setItem("designs-open", JSON.stringify(open)); } catch (x) {} render(); return; }
    // 📍 marks on a theme's scene (collection "designmarks"; tools/designs.js marks reads them)
    const im = e.target.closest(".mk.on img");
    if (im) { const d = L.find(x => x.id === MARKING), r = im.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height, g = d.geo || {};
      const x = ((g.c0 || 0) + fx * ((g.c1 || 0) - (g.c0 || 0))) * 30, y = (1 - fy) * (g.hU || 435) - (g.ground || 45);
      const m = { mid: "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), design: d.id, fx: +fx.toFixed(4), fy: +fy.toFixed(4), x: Math.round(x), y: Math.round(y),
        col: Math.floor(x / 30) - (g.sc || 0), row: Math.floor(y / 30), note: "", at: new Date().toISOString() };
      MARKS.push(m); MARKING = null; render();
      const inp = root.querySelector(`[data-m="${m.mid}"] input`); if (inp) inp.focus();
      await saveMark(m.mid);
      return; }
    const del = e.target.closest(".mdel");
    if (del) { const mid = del.parentNode.dataset.m; MARKS = MARKS.filter(m => m.mid !== mid); render(); try { if (DB) await DB.collection("designmarks").doc(mid).delete(); } catch (x) {} return; }
    const b = e.target.closest(".dv button"); if (!b) return;
    if (b.classList.contains("mark")) { const id = b.closest(".dc").dataset.id; MARKING = MARKING === id ? null : id; render(); return; }
    const c = b.closest(".dc"), id = c.dataset.id, st = c.querySelector(".ds");
    if (b.classList.contains("com")) { const t = c.querySelector("textarea"); t.hidden = !t.hidden; if (!t.hidden) t.focus(); return; }
    const n = b.classList.contains("up") ? 1 : -1, cur = (VOTES[id] || {}).vote || 0;
    st.textContent = "saving ...";
    try { await save(id, { vote: cur === n ? 0 : n }); c.outerHTML = card(L.find(x => x.id === id)); } catch (x) { st.textContent = "not saved: " + x.message; }
  });
  root.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.closest && e.target.closest("[data-m]")) { e.preventDefault(); const row = e.target.closest("[data-m]"); PEND[row.dataset.m] = e.target.value; saveMark(row.dataset.m); return; } if (e.key === "Enter" && e.target.classList.contains("fold-h")) e.target.click(); });
  root.addEventListener("input", e => {
    const mrow = e.target.closest("[data-m]"); if (!mrow) return;
    const mid = mrow.dataset.m; PEND[mid] = e.target.value; MST[mid] = "…"; const st = mrow.querySelector(".mst"); if (st) st.textContent = "…";
    clearTimeout(saveT); saveT = setTimeout(() => saveMark(mid), 700);
  });
  root.addEventListener("focusout", e => { if (e.target.closest && e.target.closest("[data-m]")) flushMarks(); });
  root.addEventListener("change", async e => {
    if (e.target.id === "dvf") return render();
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
    if (DB) DB.collection("designmarks").onSnapshot(snap => {
      const local = MARKS.filter(m => MST[m.mid] !== "saved" && !m.seen);
      MARKS = snap.docs.map(d => d.data()).filter(m => m && m.mid);
      for (const m of local) if (!MARKS.some(z => z.mid === m.mid)) MARKS.push(m);
      if (!root.contains(document.activeElement) || !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) render();
    }, () => {});
    if (window.claude && window.claude.use) CM = await window.claude.use("comments");
    if (CM && CM.canSendToClaude) { CAN_SEND = (await CM.canSendToClaude()) === "available"; if (CAN_SEND && !(document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName))) render(); }
  } catch (e) {}
};
