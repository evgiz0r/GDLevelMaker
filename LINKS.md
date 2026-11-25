# Level links: a link that opens the level we are talking about

The user (2026-11-24): "Can you just paste link and it will open on the level we are talking about." A link opens the
viewer on one level, at a version and a moment, and optionally on one of the user's runs. It works on the PC, on the
phone over the home wifi, and on the phone page from anywhere.

**Rule (CLAUDE.md): every session that names a level in a report gives its link.** `node tools/link.js <level> [--t 40]
[--run <id>]` prints the links (`--md` prints one markdown line for a chat).

## The three links

| where | link | what it opens |
|---|---|---|
| **phone, anywhere** | `<phone page>#gdlm_64_golden_hour--v4--t40` | the phone page (PHONE.md, the user's private Artifact; its address is in `local/phone/url.txt`) on that level and moment. No GD art, songs or runs there (RobTop rule). |
| PC | `http://localhost:8765/viewer/#lv=local%2Fwip%2Fstyle%2Fgdlm_64_golden_hour.gdlvl&v=4&t=40&run=<id>` | the PC viewer, with everything: GD art, the song, the run. |
| phone on the home wifi | `http://<PC's LAN address>:8765/viewer/#lv=...` (the same as the PC link) | the full PC viewer on the phone while `tools/serve.js` runs. The LAN address comes from DHCP, so it can change. Checked 2026-11-24: the PC is 192.168.1.189 on a network Windows calls Public, and the Node.js inbound rule allows Public. The page answers on that address from the PC itself, but **no phone has opened it yet**. Anyone on that wifi can reach the viewer: it is the user's home network. |

## The two forms (one parser: `parseLink` in viewer/index.html)

- **Long**: `#lv=<file>&v=<version>&t=<seconds>&run=<attempt id>`. The PC viewer keeps its address bar in this form, and its
  🔗 button copies it. The same button's notice also gives the phone link.
- **Short**: `#<base>--v<version>--t<seconds>--r<attempt id>`, made of letters, digits, `_` and `-` only, every part after
  the base optional. A claude.ai Artifact address keeps a plain `#name` and drops a `#lv=...&t=...` hash (PHONE.md), so the
  phone page's links use this form. The PC viewer opens it too.
- `<base>` is the file name without `.gdlvl` / `.json`: `gdlm_64_golden_hour`, `official_16`, `gdlm_64_golden_hour_v5`.
  The level is found by its file first, else by base name. Among several matches (a wip and its levels/ copy), the version
  asked for wins, then the newest. A link to a version that is gone opens the newest and says so.
- A whole URL, or just its `#` part, can be pasted into the phone page's **🔗 open link** box. That covers the case where the
  phone browser drops the hash.

## Checked

- PC, in the app's browser pane (2026-11-24): `#gdlm_44_hellgate--t12.5` opened GDLM 44 at 12.5 s;
  `#official_16--t5--ramwu2hku50` opened Hexagon Force at 5 s with the user's run; `#gdlm_64_golden_hour--t20` opened the
  wip. A hash change while the page is open re-opens.
- Phone page: see "Open" below.

## Open

- Whether claude.ai passes the short hash into the Artifact's frame on the phone. If it does not, the 🔗 open link box
  is the way in. Test it once the page is republished, then write the answer here.
- The LAN link from the user's phone (never tried). serve.js serves the LAN on purpose: it lets in only private addresses, and only the viewer's files (VIEWER.md "On the home Wi-Fi"). `tools/link.js --md` adds the home Wi-Fi link beside the phone page's.

## View options in a link (2026-11-25)
`&z=0.5` opens the level zoomed out (0.25-3), `&beats=1` with the beat lines on (`&beats=0` off). `node tools/link.js <level> --zoom 0.5 --beats`.
Use them whenever a level is shown to the user to look at and mark (CLAUDE.md "Every level you name comes with its link").
