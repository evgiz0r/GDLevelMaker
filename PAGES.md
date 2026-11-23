# The public viewer (GitHub Pages)

The viewer as a public site, built by `tools/pages.js` on every push to main (`.github/workflows/pages.yml`).
Status: **built and tested locally; Pages is not switched on yet** (waiting for the user's OK, see the end).

## What is on it, what never is

On it: the viewer and its libraries (`lib/`), **our levels only** (`levels/` and `examples/`: the GDLM levels
and the user's own), their saved solutions and timing windows, the shapes look.

Never on it: anything from `local/` -- **official levels** (RobTop's: our rule is that other people's levels need
*their* OK, and the user's OK cannot stand in for RobTop's), community levels, songs, recordings, marks, work in
progress -- and no GD sprite, image or song file. The build refuses (exit 1) when its output would hold a file
from local/, an image / audio / plist / video, or a level that is not ours; `node tests/pages_build.js` checks a
build and plants forbidden files to prove the refusal works. A scan of a build found no name, e-mail or PC path.

## On the user's own PC

With `tools/serve.js` running (http://localhost:8765), the public page fetches from it: the songs (music in
sync), GD's own art (the "GD art" button), the beat grids, and the 22 official levels (`viewer/levels.local.js`,
the user's own copies). serve.js answers only the Pages origin (`PAGES_ORIGINS`), only GET on `/version`,
`/song/`, `/gdres/` (scripts load without CORS), with Chrome's Private Network Access preflight; it refuses any
write from that origin. Elsewhere all of that fails quietly: shapes look, our levels, "add song" (the visitor
picks the file from their device; it is kept per song in their browser's IndexedDB), or the click sound.
Checked: elsewhere (a static copy on another origin) -- art button hidden, "add song" shown, only our 16 levels.
Not checked yet: the bridge from the real github.io origin (needs the site live).

## Songs from Newgrounds directly

Not tried: a song's file URL needs its Newgrounds page (audio.ngfiles.com/<folder>/<id>_<name>.mp3), and
whether audio.ngfiles.com sends CORS headers is open. Open item.

## Turning it on

`gh api -X POST repos/evgiz0r/GDLevelMaker/pages -f build_type=workflow`, then run the workflow once (or push).
The site: https://evgiz0r.github.io/GDLevelMaker/
