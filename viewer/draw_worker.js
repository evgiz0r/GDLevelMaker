// The whiteboard's solver (viewer/draw.html "✓ check"), off the page's thread so a phone stays usable. The page sends
// {libs: [absolute lib URLs], level: levelStr}; the answer is the solver's route or where nothing gets through.
self.window = self;
let loaded = false;
onmessage = e => {
  try {
    if (!loaded) { importScripts(...e.data.libs); loaded = true; }
    const lv = GD.parseLevel(e.data.level), w = GD.makeWorld(lv.objects, lv.header), r = GD.solveAny(w);
    if (r.ok) postMessage({ ok: true, events: r.events, clicks: (r.clicks || []).map(c => ({ tick: c.tick, x: c.x, ms: c.ms, type: c.type })) });
    else postMessage({ ok: false, events: r.trail || [], dieX: r.dieAt && r.dieAt.x, dieY: r.dieAt && r.dieAt.y, why: r.why || "", skipped: r.skipped || "" });
  } catch (err) { postMessage({ ok: false, events: [], why: "the solver failed: " + err.message }); }
};
