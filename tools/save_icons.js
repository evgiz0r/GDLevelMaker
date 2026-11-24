// node tools/save_icons.js  -- the player's own icons and colours, read (never written) from the game's save
// (CCGameManager.dat, the same decoding as tools/save_stats.js), so the viewer draws the user's runs as THEM (the user,
// 2026-11-24: "it doesnt show me in the proper icon"). GET /me/icons (tools/serve.js) serves it to the PC viewer only;
// nothing from the save is committed or sent anywhere else.
// Keys (GameManager, 2.2): playerFrame (cube), playerShip, playerBall, playerBird (UFO), playerDart (wave), playerRobot,
// playerSpider, playerSwing, playerColor (colour 1), playerColor2 (colour 2), playerGlow (glow on). A key the save leaves
// out is GD's default: icon 1, colour 1 = index 0, colour 2 = index 3, no glow.
// Colours are GD's palette indices; COLORS below holds the ones we are sure of (index 0 and 3 are GD's default icon
// colours, matched against the user's recordings: lib/look.js). Another index comes back as null: the viewer then keeps
// the default colour for it and says so, rather than guessing a colour.
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const SAVE = process.env.GD_SAVE_FILE || path.join(process.env.LOCALAPPDATA || "", "GeometryDash", "CCGameManager.dat");
const COLORS = { 0: [125, 255, 0], 3: [0, 255, 255] };
let CACHE = null;
function read() {
  let st; try { st = fs.statSync(SAVE); } catch (e) { return null; }
  if (CACHE && CACHE.mtime === st.mtimeMs) return CACHE.out;
  const b = fs.readFileSync(SAVE);
  for (let i = 0; i < b.length; i++) b[i] ^= 11;
  const xml = zlib.gunzipSync(Buffer.from(b.toString("latin1").replace(/\0/g, "").replace(/-/g, "+").replace(/_/g, "/"), "base64")).toString("utf8");
  const at = xml.indexOf("<k>playerFrame</k>"), seg = at >= 0 ? xml.slice(Math.max(0, at - 2000), at + 3000) : "";
  const num = (k, def) => { const m = new RegExp(`<k>${k}</k><i>(-?\\d+)</i>`).exec(seg); return m ? +m[1] : def; };
  const bool = k => new RegExp(`<k>${k}</k><t ?/>`).test(seg);
  const c1 = num("playerColor", 0), c2 = num("playerColor2", 3);
  const out = { icons: { cube: num("playerFrame", 1), ship: num("playerShip", 1), ball: num("playerBall", 1), ufo: num("playerBird", 1), wave: num("playerDart", 1),
                         robot: num("playerRobot", 1), spider: num("playerSpider", 1), swing: num("playerSwing", 1) },
                color1: { index: c1, rgb: COLORS[c1] || null }, color2: { index: c2, rgb: COLORS[c2] || null }, glow: bool("playerGlow") };
  CACHE = { mtime: st.mtimeMs, out }; return out;
}
module.exports = { read, COLORS };
if (require.main === module) console.log(JSON.stringify(read(), null, 1));
