// The viewer's timing windows, worked out off the page's thread (viewer/index.html windowsLater; the phone page
// ships this file too, tools/web.js). A player's window (lib/windows.js + lib/difficulty.js) can take seconds
// for one input (3.7 s on GDLM 45's worst), which froze the page when it ran there.
// The page sends { libs: [lib URLs it loaded], objects, header, events }; this posts { wins: [...] } as each
// input's window is found, then { done: true }.
self.window = self;
onmessage = e => {
  const d = e.data;
  try {
    importScripts(...d.libs);
    const w = GD.makeWorld(d.objects, d.header), path = GD.run(w, d.events).path;
    let from = 0;
    for (;;) {
      const r = GD.inputWindows(w, d.events, path, { from, out: [], budget: 1 }); // budget 1: one input at a time
      postMessage({ wins: Array.from(r) });
      if (r.next === null) break;
      from = r.next;
    }
    postMessage({ done: true });
  } catch (err) { postMessage({ error: err.message }); }
};
