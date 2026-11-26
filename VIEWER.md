# The viewer -- the place the user steers development

The user (2026-11-24): "for the viewer to become the interaction in this development process". The PC viewer
(http://localhost:8765/viewer/, `tools/serve.js`) shows every level and every build as it is made, and every answer the
user gives there reaches the session that owns it at once. The phone page (PHONE.md) and the public site (PAGES.md)
are builds of the same page without these PC-only parts.

## What the user can do there

**Controls only at the top (a soft rule; the user, 2026-11-24: "i cant have buttons in the bottom, only in the top ui").** Every
button, picker and field is in the top bar: the main row, the ⚙ view menu, and the context rows under it that come with the
level (stage bar with ✓ ok / redo / find the route, sections, variants, the recording compare's controls, a picked mark's
done / reopen, the notice, the PC's task chip). The panels under the level (summary, clicks, marks) are read-only: a marks row
is clicked to go there. Overlays (the level picker, the work panel, the note box, the task box, the map) may have their own.
**compare** sits in the top bar, greyed with "pick a run first" until a run is loaded. `node tests/top_controls.js` fails on
any control outside the top bar (the page's HTML, and headless on a level with runs, a build with stages and one of ours).

**One row over the level.** The controls are one row from 800 px up (labels give way to their icons, the text stays as the
tooltip; the least used buttons move into ⋯), two at phone width, and never over the level; the clock is under the
timeline. In flying modes the camera centres the corridor when it fits, else follows the player with a block of ceiling
and floor in view. tests/top_controls.js checks 375, 800 and 1200 px.

**✏ draw: the whiteboard on the level** (2026-11-25, DRAW.md "In the viewer"). ✏ draw (key D) lays the whiteboard over the
canvas: draw with its pens and stamps, the viewer shows the level it becomes (🧩 layout on) at the board's camera; the board's
▶ and 🎮 replay and play it here. `node tests/viewer_draw.js`.

**Runs: picked in one place.** A run is picked only from L → "my runs" (each level one sentence: "you died at 40% · 22 min
ago · video"); a click opens the level already playing it. While a run is open the top bar has one chip, "▶ your run:
Hexagon Force · died 40% · 22 min ago ▾" (▾: this level's other runs), ✕ to leave run mode, and "⇄ vs solver" (greyed
when the level has no solved route). There is no other runs list.

**The solver looks like Claude.** The replay's player (the solver's route) is drawn with the Claude icon set (viewer/icons/claude/<mode>.png, art session, kit "spark"), so it never looks like the user.

**A run looks like you.** A run of the user's (and "you play") is drawn with the user's own icons and colours from their GD
save (`tools/save_icons.js`, GET /me/icons: cube, ship, ball, UFO, wave, robot, spider, swing, colour 1 / 2; read-only, this
PC only; colours known for GD's palette indices 0 and 3 so far, another index keeps the default). While a run is open it is
always the player; "⇄ vs solver" adds the solver with its Claude icon (the art session's set, viewer/icons/claude/: cream spark on terracotta), both labelled, and the solver's clicks in a lane
under "you". When the sim loses the run, a cross says so ("our bug, not your death") and the camera carries on to where
the real run ended, so every logged click is on the strip. Camera-only steps aside while a run is open.

**Presses as long as they act.** In the button band a tap is a short tick. A hold is a bar only where holding moves the player
(ship, wave, robot, a dash orb); a hold in cube, ball, UFO, spider or swing is a tick at each jump it makes on a thin line
("held 4.3 s · 12 jumps"), and a long hold that makes one jump is flagged "⚠ held N s, 1 jump" (a route problem, shown as it
is). A run whose last press has no release (it died holding) ends its hold where the run ends.

**Minimal by default (a soft rule for the viewer; the user, 2026-11-24: "the ui becomes a bit busy").** The default view is the
level, the player and the timeline: one header row (work, levels, refresh, link, play, restart, you play, mark, **⚙ view**) and
the button band with the presses only. Everything else is a toggle in **⚙ view** (speed, game look, GD art, level map, hitboxes,
compare, click sound, music, light, beats, the band's timing windows and legend), remembered per browser (`gdlm.v.*` in
localStorage, every access in try/catch, so a blocked storage just means the defaults), or appears only when it is relevant (the
stage bar, the sections strip, variants, your runs, the plan break, the work chip). A new feature follows the same rule: off or
hidden until it matters, never one more always-on layer. Beat lines, timing windows and the band legend are now off by default.

| Where | What | Who reads it |
|---|---|---|
| **Work** (button / key W; badge = what waits for you) | the decision cards sessions ask; every build with its stage and whether it waits for you; the PC's heavy-job queue with ETAs that say their basis ("~28 min (last run make jN, this level)") or "not measured" (tools/jobtime.js), and the last finished jobs, estimate vs actual ("off 3x" in red where it drifted). Live (5 s). | -- |
| **Decision card** (Work) | answer a session's question with one of its options or "other…" | the asking session (`tools/ask.js wait <id>`), the feed |
| **Stage bar** (a build being made: song › layout › path › deco › final) | open any stage; **✓ ok** or **redo…** with a note (the moment on screen goes with it); a gated stage shows "⏸ the build waits for you" | the builder (`tools/stages.js wait` / `waitApproval`), the feed |
| **✎ mark** (key M) | a note at a spot, with a kind (unfair / awkward / ugly / unclear / other) | marks.js, the feed |
| **Variants bar** | compare a section's variants, "pick" one | style (a variant-pick mark), the feed |
| Picker (L), level map, timing band, F counter, light | see everything at once (no UI action blocks > ~100 ms; nothing waits on a solve to be visible) | -- |
| **Sections strip** (a level built in sections: the stages index's `sections`, from briefs/NN.seams.json) | one chip per section with its roles' state (L layout, D deco, P playtest: planned / built / ok / redo; hover: the builder); the section under the playhead is outlined; click one to select it and jump there, then **✓ ok / redo…** for the open stage's role and for playtest -- that section only. Seams are dashed lines with the section's name on the level | the section's builder: `tools/stages.js wait <session> <base> <stage> --section s3 [--role playtest]` / `waitApproval(..., {section, role})`; the feed (redo / approve with section + role) |
| **🎮 you play** (button / key P) | play the open level or build stage yourself in the viewer: space / ↑ / W / Enter / click / tap = the button, R restart (practice: from the last checkpoint; Shift+R from the start), P or Esc back to the replay. **practice** (on by default): checkpoints at each section start and portal. The same sim live (`lib/liveplay.js`: pressing at a route's ticks = GD.run, `tests/liveplay.js`); presses land on the next tick, a frame boundary, as in the user's game. Works with no route at all: a layout can be tried minutes after it exists. Deaths show as red ticks on the ground; an attempt with no press is neither logged nor restarted by itself | the actions feed, type **play** (`{attempt, result: died / clear, x, pct, t, why, from, practice, stage}`; where the user dies = a soft signal for difficulty) |
| **community / demon list** (tabs of the level picker) | every level in local/community on this PC (other people's levels: the PC viewer only, never the repo, the public site or the phone page); "demon list" shows the ones on the demon list by list place (former Top 1s after), with creator, verifier and Top 1 history. A level's file is fetched and unpacked only when it is opened (Bloodbath, 157 KB, 24,746 objects: the click returns in 1 ms, one 114 ms step while it opens). Nothing solves them (most demons cannot be beaten in our sim): the camera runs through the layout and deco as a ghost | `GET /community/list` (`tools/community_index.js`: names cached in local/community/names.cache.json); the list itself: the taste session's `tools/demonlist.js` -> local/community/demonlist.json |
| **Every level to its end** | a level the sim does not beat (official ones we cannot clear yet: Deadlocked, Fingerdash, Dash, ToE2; demons) replays its furthest run, a red cross "the sim dies here: N%" where it dies, then the camera goes on as a ghost at the level's speed to the end: playback and the timeline cover the whole level. **camera only** (⚙ view, remembered): no player at all, the level from start to end at its speed. A large level (over 3000 objects) opened from a file is not solved in the page either | `load()` + `ghostExtend()`, `camViewApply()` in viewer/index.html |
| **my runs** (a tab of the level picker) | every level you played -- here 🎮 or in a GD recording 🎥 -- newest played first, each with its attempts, clears, best %, when last played, how many versions and ⚠ recordings the sim does not reproduce; a click opens the copy of the level that run was on and replays the latest run as the ghost (below). Renders from a small index in ~3 ms | `GET /attempts/index` (`tools/attempts.js index`); levels matched by `GD.attemptsBase` (lib/liveplay.js), the same key the server files runs by |
| **Your runs** (under the level's summary, when there are any) | the attempts at this exact version (its hash), "you play" ones 🎮 and real GD recordings 🎥, with how many cleared and where most deaths are; pick one: it **becomes the player**: the solved route (its player, trail and presses) is put away, the camera, the button band and the clicks table follow the run (a cross where it died). **⇄ compare with solver** (remembered; the user: "can i have a compare button, with a solved one also") plays both together: the route as the player labelled "solver", the run as a pink cube labelled "you", and the band splits into two press lanes, solver above, you below. When the game and the sim disagree on how a run ended, the line says both ("you: clear · sim: dies at 23% (spike)"; from `video.result` / `sim` once physics splits those fields, else the ghost's own end). One compact line says how its presses compare with the route's ("0 on time · 1 early · 4 missed · 20 extra": on time = within 2 ticks, pairs within 50 ms; only up to where the run ended), each press's offset on hover -- nothing in the band (the user, 2026-11-24: "i dont like the replays on the bottom. the ui becomes a bit busy"). Runs at older versions of the level are counted ("N at older versions"), not replayed. A recording the sim does not reproduce (replay_run's `res: "mismatch"`) is marked ⚠ with where the sim dies; the ghost stops there | `tools/attempts.js` (local/attempts/<base>.jsonl: one format for both sources, `list` / `deaths`; one key per level via `baseOf`: `official:7`, `local/official_07.json` -> `official_7`; `local/community/N.gdlvl` -> `cN`) |
| **A stage's plan, replayed at once** | a stage (layout, path) or a section variant with no route but a plan (`data.events`, else `data.planned` [{t, what}]; a variant's `planned`, or the layout's `data.alt[].options[].planned`) replays its planned presses through the sim in slices: no solve, ~a second. If it dies: "▶ The plan breaks here: block N, t s: why", a red cross at the spot, and the camera goes on as a ghost after it. The stage's `data.timing` / `target` show as "build time" | -- |
| **Level map, "draw it now"** | drawn in the page offscreen, one chunk per task with progress ("12/40"); the view and controls stay usable; GD art's new tints have a 40 ms budget per draw (lib/art.js `budget()`), the rest come on the next pass. GDLM 61, first visit: 3.8 s in all, one task of 140 ms (the first), the rest under 50 ms (was 8.8 s with 13 tasks of 140-280 ms and the view taken over) | -- |

## On the home Wi-Fi (the phone gets the whole PC viewer)

The user said yes on 2026-11-24 to serving the PC viewer on the home Wi-Fi. That covers official levels, the demon list,
GD art, songs and their runs. It is not public: not on Pages, not on the internet.
- **Address**: `http://192.168.1.189:8765/viewer/` while `tools/serve.js` runs. The router hands out that address (DHCP),
  so it can change. serve.js prints the current one when it starts, and `node tools/link.js <level>` gives the "lan:" link.
- **Who may ask**: only this PC (loopback) and private IPv4 addresses (192.168/16, 10/8, 172.16-31). Anything else gets 403.
- **What a LAN device gets**: the viewer pages, libs, levels/, examples/, `local/` beats, marks, official levels, maps,
  wip and community levels, songs, GD art, the API the viewer uses, and the viewer's own actions (marks, plays, stage
  reviews, answers, solve and map requests). Every one of these writes only under `local/` or starts a fixed tool on a
  level path that has been checked. Any other file of the repo is refused: `.git`, `.claude`, CLAUDE.md, `local/inputs`,
  `local/phone`, ... No sign-in, no installs, no uploads: nothing of that kind exists in serve.js.
- `--local-only`: this PC alone (listens on 127.0.0.1).
- **Firewall**: nothing to change. Windows already has an inbound allow rule for `C:\program files
odejs
ode.exe` (TCP,
  any port) on the Public profile, and the PC's network is set to Public. If a phone still cannot connect, the user can add
  this rule in an admin PowerShell:
  `New-NetFirewallRule -DisplayName "GDLM viewer (home Wi-Fi)" -Direction Inbound -Protocol TCP -LocalPort 8765 -RemoteAddress LocalSubnet -Action Allow -Profile Any`
- **Checked (2026-11-24)**: from the PC through its LAN address (192.168.1.189), the viewer loaded 568 levels, GD art and
  the user's icons, and a link opened Hexagon Force at 20 s. `.git/config`, CLAUDE.md, `local/inputs` and `local/phone/url.txt`
  were 403 there and still served on localhost. Not yet opened from the phone itself.

## Section lab (pick one of a few variants of one moment)

The user (2026-11-24): "smaller sections, with reviews". The style session's `tools/lab.js` builds one 10-20 s moment of a song
as ~6 variants, each with its own hook (speed-up, mode switch, orb trick, ...). The viewer shows a round as a **lab bar**:
the variants one tap apart (keys 1-9). A tap opens that variant and plays it from the start. Each variant has a line with
its hook, why, and its pace against real levels. **🎮 play it** (P) lets the user play it. A **why** box has chips (boring,
too slow, too hard, feels good, love the hook). **♥ pick vN** / **none: all dull** answers the round.
- How a variant plays (fixed 2026-11-25, the user: "running different sections is bugged cant see the play"): a variant is
  a stage-only card, so its route lives in its layout stage (`data.events`, the route `tools/lab.js build` solved), not in
  the solutions cache (a physics change makes that stale). The lab opens the variant with a change EVENT so the stage bar
  opens the stage and replays that route at once, and starts playing once the route (not the card's "no route yet" ghost)
  is loaded. Picking another level while a stage is open now opens that level's own stages; a stages fetch already in flight
  is not started again (three fetches each reopened the stage and stopped the play); the in-progress refresh (the lab's 15 s
  poll) keeps an open stage on screen. `node tests/lab_play.js` (headless, muted) checks all of it.
- Variants end ~0.5 s after their gameplay (`tools/lab.js trimEnd`, done by `build`; `node tools/lab.js trim <round>` for
  rounds built before 2026-11-25).
- Typing in any text box (a mark's note, the lab's why) never drives the replay: the replay keys (space, r, arrows) and
  m skip while a text field has focus (`node tests/note_typing.js`).
- Open: `#lab=r1` (`#lab` = the newest round), or the Work panel's "Section lab" rows. Works on the phone over the home
  Wi-Fi (the /lab routes and local/wip files are allowed from the LAN). Not on the phone page (no serve.js there).
- Data: `local/lab/r<N>/round.json` {id, moment, t, variants:[{k, hook, why, file?}], ask}, `v<k>.result.json` {ok, pace}.
  A variant's level is its stage card `local/wip/style/lab_r<N>_v<k>.gdlvl` (or the variant's `file`). A variant still
  building is greyed and shows up by itself: the bar polls every 15 s.
- A pick: `POST /lab/pick {round, k (0 = none), note}` answers the round's decision card with its option ("v3 orb-trick"),
  adds a line to `local/reviews.jsonl` {kind:"lab", round, k, hook, answer, note, file}, and to the actions feed. Picking
  again changes the answer. `test: true` stores nothing.
- Not built: a grid of 6 small live previews at once (the viewer draws one level; one tap apart was the quick way).
  The first open from a link does not start playing by itself; a tap does.

## For sessions

- **Experiments are silent and not the user's: open the viewer with `?test=1`** (e.g. `http://localhost:8765/viewer/?test=1#lv=...`):
  no music, no click sound, no preference saved, and every mark, attempt, review and answer it sends is marked as a test
  (marks and attempts go to the `.test.jsonl` files; reviews and answers are not stored at all). `?mute=1` only silences.
  tools/headless.js adds test=1 (and `--mute-audio`) to every page it opens (shoot, levelmap, perf, readability, catalogue).
- **Sections**: put them on the index with `put({..., sections})`, `setSections(session, base, sections)` or
  `node tools/stages.js sections <session> <base> briefs/NN.seams.json`; a section's status for a role set again to a new
  state clears its old review. A section's answer: `approve(..., {verdict, note, spot, section, role})`.

- **Ask the user**: `node tools/ask.js put <session> "question" "option A" "option B" ... [--level "GDLM 64 golden hour"]`
  prints the card id; `node tools/ask.js wait <id>` blocks until the answer (prints it; exit 2 on timeout).
- **Stages and gates**: `require("./stages.js").put({ session, base, name, stage, levelStr?, data?, note?, gate: true })`.
  A gated stage waits for the user: `await require("./stages.js").waitApproval(session, base, stage)` -> `{verdict: "ok" |
  "redo", note, spot: {t, x}}`, or `node tools/stages.js wait <session> <base> <stage>` (prints `ok`, or `redo<TAB>note`).
  After a redo, put the stage again (that clears the review) and wait again. No gate: approval is optional, still recorded.
- **The actions feed**: every user action is one line in `local/viewer_actions.jsonl` `{id, at, type: mark | approve |
  redo | answer | variant-pick, session, level, file, stage?, text, ...}`. The coordinator forwards them live:
  `node tools/actions.js tail --since <id>` (one short line per action, as they come; `--once` to print and stop).

## Files and tests

`lib/liveplay.js` (live play with each attempt's inputs, planEvents, levelHash, comparePresses; `node tests/liveplay.js`), POST /play and GET /attempts (tools/serve.js), `tools/attempts.js`, `tools/actions.js`, `tools/ask.js` (local/asks/), `tools/stages.js` (approve, waitApproval, gate), `tools/serve.js`
(POST /stages/review, GET /asks, POST /asks/answer; marks also go to the feed), viewer/index.html (Work, stage review).
Section lab: GET /lab/list, GET /lab/r<N>, POST /lab/pick (tools/serve.js; GDLM_LAB_DIR for tests), `labOpen` in viewer/index.html; `node tests/lab_view.js`, `node tests/lab_play.js` (each variant plays its route).
Tests: `node tests/work.js` (gate -> waiting -> review -> waitApproval; card put -> list -> answer; the feed and tail),
`node tests/stages.js`, `node tests/no_dialogs.js`.

## Layout on the PC (2026-11-25)

The user: "i want the ui more in the middle", "its way too stuck to the top, and the top ui hides the level a bit", "all
these clicks are still open". On a screen 900 px wide or more the level view is 16:9 (as GD frames it: 19 blocks across,
10.67 up), as tall as the window allows (window height - 230 px, at least 640 px wide), centred with a gap under the top
bar; the button strip, scrub bar, lab bar and the cards below share its width. The Clicks card is closed by default (its
title shows the count). Phones keep the old full-width layout.

## The level list's tabs (2026-11-25)

The user: "main has too many songs now ... its just spam. Lets do main for ready levels + official. Rest in the different
tabs". **main** = our pushed levels that are not lab / test / catalogue / sketch levels (a newer wip of one still sits on
its card) + the official ones; **in progress** = work in progress that is not the lab; **lab** = the section lab's
variants (LAB rN vK) and the lab / test levels (`pkLab` in viewer/index.html); ours, official, community, demon list, all
as before.

## Zoom the level only (2026-11-25)

The user: "how do i zoom out of the level? the big zoom of the whole ui is messy". The level view has its own zoom: the
mouse wheel or a trackpad pinch over the level, the − / 100% / + buttons in its top right corner (100% = the game's own
view), keys - and =. The page around it stays as it is; the zoom is remembered in this browser (localStorage gdlm.zoom).
Shots (tools/shoot.js) ignore it.

## Compact bars (2026-11-25)

The user: "The sections/stages take too much space in the ui". The stage bar, the sections bar and the variants bar are
one line each (scrolling sideways when long). The sections bar is folded by default: "▸ sections · N" plus the section
under the playhead (and the picked one, with its ✓ ok / redo); ▸ shows every chip, remembered per browser
(localStorage gdlm.secOpen).


## A build stage without its own route borrows one (2026-11-25)

The user, on FROSTBITE's stage bar: "path deco ... if i click them then it either dies and doesnt jump or not shown at
all". The path stage had only a plan that died at the second spike (its planned taps were not the layout's), and deco /
final had no plan and no fresh saved route, so they opened as a ghost. Now `stageOpen` (viewer/index.html) with no saved
route tries, on that stage's own level and without a solve: its own plan, then the nearest stages' routes and plans,
then the level's saved route (`stageRouteCands`). The first that clears is shown (a notice names whose route it is);
if none clears, the one that gets furthest, with where it dies. A builder should still put each stage's route
(`data.events`) with it; this only keeps the bar usable when it didn't. Test: `node tests/stage_borrow.js`.
Since the same day, `tools/make.js` also puts the checked route on every stage it clears (`stages.route`, after the check
and on `--look`), and a new layout drops the previous build's final (`stages.drop`): FROSTBITE's next build was a new
layout whose planned presses (the unrepaired intents, tools/intent.js) die at block 15.9, with no final yet and the
15-hour-old final of the earlier build still on the bar. Test: `node tests/stage_route.js`.

## Click sound: mouse or keyboard (2026-11-25)

The user: "can we do the click sound as a keyboard/mouse click?". Next to "click sound" a choice: 🖱 mouse (default),
⌨ keyboard, or the old beep; remembered per browser (`gdlm.clickKind`). Each press clicks and each release makes its
softer "up" sound (a held ship press is two sounds, like a real button). The samples are self-made in `lib/clicks.js`
(seeded noise through a band-pass plus a short decaying tone; four takes each, so fast chains don't sound like one
sample), no recorded or third-party audio, so they ship on the phone page and the public site too. `?mute=1` silences
them like every sound. Videos: `node tools/video.js <level> --clicks mouse|keyboard` mixes the same clicks under the song
(the shoot page hands video.js the presses and releases in its `.done`). Test: `node tests/clicks.js`.
