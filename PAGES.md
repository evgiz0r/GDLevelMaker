# The public viewer (GitHub Pages)

The viewer as a public site, built by `tools/pages.js` on every push to main (`.github/workflows/pages.yml`).
Status: **live at https://evgiz0r.github.io/GDLevelMaker/** (switched on 2026-11-23 with the user's OK; every push to
main rebuilds it). Checked live: our 16 levels load and replay, build commit in the footer, no art button, no
official levels.

## What is on it, what never is

On it: the viewer and its libraries (`lib/`), and **only the levels the user chose** for it: opt-in, one by one, in
`knowledge/public_levels.json` (from `levels/` and `examples/`). It is EMPTY: the user, 2026-11-24, "all those levels
are bad for now. lets publish a real there when we have something decent" -- the 16 GDLM levels were taken off.
With none, the page says "First levels coming soon"; on the user's PC it opens the first official level (bridge).
Add a level to the list only when the user says so for that level.

Never on it: anything from `local/` -- **official levels** (RobTop's: our rule is that other people's levels need
*their* OK, and the user's OK cannot stand in for RobTop's), community levels, songs, recordings, marks, work in
progress -- and no GD sprite, image or song file. The build refuses (exit 1) when its output would hold a file
from local/, an image / audio / plist / video, or a level that is not ours; `node tests/pages_build.js` checks a
build and plants forbidden files to prove the refusal works. A scan of a build found no name, e-mail or PC path.

## Songs on the site (2026-11-25)

The user: "what songs can we put in git that [are] free ... those can be published freely". A level whose song is in
`knowledge/free_songs.json` (Creative Commons, `hostable`) with its file in `songs/free/<id>.mp3` gets that file at
`songs/<id>.mp3` on the site (`free_songs.js` maps id -> file + credit) and plays it at once; the credit shows under the
player. `checkDir` allows exactly those files (byte-equal to songs/free/); any other audio is still refused. Every other
song: "add song" as before. The list and rules: knowledge/free_songs.md.

## Candidates

`knowledge/public_shortlist.md` (2026-11-26): every free-song level of ours scored with score.js, ranked, with what each one
lacks. Re-run it when a level changes or a new one is built on a free song. Nothing on it is public until the user names it.

## On the user's own PC

With `tools/serve.js` running (http://localhost:8765), the public page fetches from it: the songs (music in
sync), GD's own art (the "GD art" button), the beat grids, and the 22 official levels (`viewer/levels.local.js`,
the user's own copies). serve.js answers only the Pages origin (`PAGES_ORIGINS`), only GET on `/version`,
`/song/`, `/gdres/` (scripts load without CORS), with Chrome's Private Network Access preflight; it refuses any
write from that origin. Elsewhere all of that fails quietly: shapes look, our levels, "add song" (the visitor
picks the file from their device; it is kept per song in their browser's IndexedDB), or the click sound.
Checked: elsewhere (a static copy on another origin) -- art button hidden, "add song" shown, only our 16 levels.
Not checked yet: the bridge from the live site. The app's built-in browser blocks a public page's requests to
localhost (ERR_BLOCKED_BY_CLIENT), so it could not be tried there; the server side is checked (it answers the Pages
origin with CORS and the Private Network Access header). In the user's own Chrome, recent versions first ask
"allow this site to access devices on your local network?" -- allow it once for evgiz0r.github.io, with serve.js
running, and the music, GD art, beat lines and official levels appear.

## Songs from Newgrounds directly

Checked 2026-11-25 on the live site in the user's PC browser:
- `fetch()` of `audio.ngfiles.com/...mp3` fails (no CORS), so the viewer's Web Audio path (`decodeAudioData`) cannot use it.
- An `<audio>` element plays it, but Newgrounds serves only a **10 s clip** to a request with another site's referrer.
  With `<meta name="referrer" content="no-referrer">` the full song plays (Dot: 101.6 s). That sidesteps Newgrounds'
  clip limit, so it is the user's call, and it may stop working.
- RobTop's library CDN (`geometrydashfiles.b-cdn.net/music/<id>.ogg`): `fetch()` fails from the Pages origin too.

**Song licenses** (each song's Newgrounds page, "Licensing Terms", 2026-11-25). Creative Commons, so a copy may be
hosted with a credit line (non-commercial): 1175526 Two Moons ft. Geyser (jamatar, BY-NC-ND), 557117 Golden Haze
(DetiousMusic, BY-NC-SA), 1086693 Eclipse (Uxvellda, BY), 575768 Thumper (Waterflame, BY-NC-SA), 343707 Infertehno 2
(SOcollab, BY-NC; third-party samples, "free for web-based games"). Not CC ("contact me" / all rights reserved):
1290936 Dot (bpi9), 183718, 1289772 (a remix), 619544, 311087, 216300. Ask the user before hosting any song.

## How it was turned on

`gh api -X POST repos/evgiz0r/GDLevelMaker/pages -f build_type=workflow`, then `gh workflow run pages.yml` (later
pushes rebuild it). The site: https://evgiz0r.github.io/GDLevelMaker/
