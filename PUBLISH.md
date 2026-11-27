# Publishing levels to play them on the phone

The user's phone runs GD where file import is blocked (Geode doesn't support their version), so a
level reaches the phone as an **unlisted upload from the PC game**, found on the phone by
Search -> its level ID. The slot and what it holds: `local/phone_ids.json`.

| level | ID | version | date |
|---|---|---|---|
| GDLM 44 hellgate (the phone slot, see below) | 152848491 | v10 (16e82a4) | 2026-11-23 |
| GDLM 44 hellgate, update into the slot | 152848491 | v11 (dc72b09) | 2026-11-23 |
| GDLM 44 hellgate, update into the slot | 152848491 | v12 (4b8a308, end signature) | 2026-11-23 |
| GDLM 44 hellgate, update into the slot | 152848491 | polish v6 (ID put back with --ids-from) | 2026-11-24 |
| Claude Lab (the lab slot, see below) | not uploaded yet | -- | -- |

## Rule: every upload needs the user's yes

**A name is for good once uploaded** (the user, 2026-11-23: "We use the same name once uploaded,
no rename. Thats why we need pick proper names as well"). The server refuses a rename, and our
tools never try one. So choose a level's final name before its FIRST upload, and put it in the
upload question so the user can change it. The phone slot is named "GDLM 44 hellgate" for good.

**Don't fill the servers with AI levels** (the user, 2026-11-23: "I dont want to spam ai levels to
the server yet"). Upload only a level the user asks to play on the phone, never offer batches
or extra levels. To change one that is already up, re-share it under its ID (below) rather than
uploading a new copy.

Each Share press is outward-facing and the unlisted choice can't be undone. Before the final press,
tell the user the exact settings (unlisted, friends-only, notify, star request) and wait for a yes
for THAT level (they may answer from the phone). A yes for one level is not a yes for the next,
nor for a re-share of the same one. Never touch passwords, login or account settings; if GD asks,
stop and ask the user. GD's share form also says sharing gives RobTop rights to use the level --
say so in the question.

## The steps (computer use, GD 2.2 on Windows, no mods)

1. **GD must be windowed, never exclusive fullscreen.** In fullscreen the first computer-use
   screenshot hung for 300 s and locked computer use for the whole session (the first publisher
   session died of it). Check before any screenshot:
   `GetWindowRect` on GeometryDash's MainWindowHandle and its style -- windowed = caption bit
   0x00C00000 set (seen: rect 27,0-1893,1080, style 0x16CF0000). If in doubt, ask the user.
   Never kill GD. **Windowed is not enough:** on 2026-11-24 the first screenshot right after
   `Start-Process steam://...` + `open_application` hung for 300 s with GD windowed (style
   0x16CF0000, rect 152,70-1768,1009, responding), and every later computer-use call was refused
   as "still in progress". It had cleared by itself some time later. What worked the next time:
   start GD, wait 45 s (main menu loaded), check the style, then `open_application` + screenshot.
   **Focus:** clicks fail with "The desktop shell is frontmost" even right after `open_application`.
   Fix: from PowerShell `ShowWindow(h, 9)` + `SetForegroundWindow(h)` on GD's MainWindowHandle,
   then the click batch at once. **Window size moves the buttons:** in a 1616x939 window (rect
   152,70-1768,1009) the full-frame clicks were: wrench (962,394), Create tile (344,222), first View
   (1020,270), share (936,470), gear (1118,150), close Settings (352,192), Share Level (856,684),
   Upload Complete Back (728,682), main-menu X (160,114), Quit Yes (856,502). Always screenshot first.
2. Access: `request_access ["Geometry Dash"]` only grants the Steam launcher; the window belongs to
   **`geometrydash.exe`** -- request that basename too, or GD is masked in screenshots.
   `open_application` can't start GD (it maps to steam://); start it with
   `Start-Process steam://rungameid/322170`. If it starts minimized, `ShowWindow(h, 9)` +
   `SetForegroundWindow(h)` from PowerShell.
3. **Coordinates:** screenshots at `scale: 0.5` come back as a half-size image, but clicks use the
   full frame (1456x819 on the 1920x1080 screen). Double what you read off the half-size picture.
   (Three clicks went to the wrong place before this was noticed.)
4. Main menu -> wrench (Create, ~(1000,394)) -> Create tile (top-left, ~(284,194)) -> My Levels.
   The list scrolls slowly with the wheel; drag it instead. -> the level's **View**.
5. Level page: the share button is the right one of the three big circles (~(970,476)).
6. Share form: the gear top-right (~(1182,110), "options") opens Settings: tick **Unlisted**
   (~(382,306)) -> an info box "cannot change back to listed" -> OK -> close Settings (X top-left).
   Leave Friends Only, Notify Friends/Followers off, no Request Stars.
7. Ask the user (above). On yes: **Share Level** (~(878,724)) -> "Upload Complete" -> Back.
8. The level page now says "Uploaded" and shows **ID: N** at the bottom. Zoom on it to read it.
   Write it to `local/phone_ids.json` and the table here, and tell the main session.

Found: GD 2.2 accepted the upload of a level still marked **Unverified** (GDLM 44). So the user
doesn't have to beat a level before it can go to the phone.

## The phone slot: one online ID, whatever level is being played

The user (2026-11-23): "replace that level with a new version and that will be the place holder for
this level". So ID **152848491** is the single phone slot: the server never holds more than this one
AI level. Whatever the user wants on the phone next goes into that ID:

1. Close GD: main menu -> X (top-left) -> Quit Game "Yes" is a normal save-and-quit (GD writes the
   save on exit); never kill the process. It must have exited once since the last upload, or the
   save doesn't hold the ID yet, and install.js stops with exit code 4.
2. `node tools/install.js levels/<name>.gdlvl --slot phone` puts the level into the save record that
   holds the ID, moves it to the top of My Levels, and records it in `local/phone_ids.json`
   (`slots.phone.holds`, the old one into `history`, `shared: null`). The record keeps:
   - the slot's server NAME (`slots.phone.name`, "GDLM 44 hellgate") whatever level it holds:
     an update under a new name ("GDLM phone: 44 hellgate") failed twice with "Upload Failed.
     Please try again later." The server refuses a rename of a shared level.
   - `k1` (ID), `k79` (unlisted), and `k16`/`k60` if present.
   - but NOT `k15` ("this version is uploaded"): with it, Share says "This version has already
     been submitted" and uploads nothing. GD clears it itself when a level is edited.
3. Open GD -> My Levels -> the top level -> page shows ID 152848491 -> share button -> gear: Unlisted
   ticked (greyed, locked) -> the user's yes -> Share Level -> "Upload Complete". Then set
   `holds.shared` and `holds.version` in phone_ids.json.
4. On the phone: search 152848491 again. The phone may keep the old download; open the level page
   and download it again.

Done this way twice: hellgate v10 -> v11 (three tries, see above) and v11 -> v12 (first try), 2026-11-23, Upload Complete, ID unchanged. So the phone
always shows the name "GDLM 44 hellgate", even when the slot holds another level. The description
(k3) comes from the new level; whether the server takes a new description on update is unchecked.

## The lab slot: "Claude Lab", a general test slot (no ID yet)

The user named a second, reusable slot on 2026-11-23: **"Claude Lab"** (`slots.lab` in
`local/phone_ids.json`). It's general: any level we want to test on the phone goes in it, so the
server still holds at most two AI levels. The name is final. Its default description is the user's (below); `--desc` can
replace it for one upload.

- **Description** (the user picked it, 2026-11-23; `slots.lab.desc`): "This is a lab. You are the
  test. Thank you for your service. -- Made by Claude (and some humans)".
- `node tools/install.js levels/<name>.gdlvl --slot lab` installs the level at the top of My Levels
  as "Claude Lab", with that description: the slot's `desc` + " -- Made by Claude (and some humans)"
  (`tools/signature.js` describe). `--desc "..."` overrides it for one upload. Re-running it replaces the
  same record (found by name while the slot has no ID, `tests/install_keeps_id.js`).
- **Not uploaded yet.** Its FIRST upload creates the ID and needs the user's explicit yes for that
  specific level. In the share form, tick Unlisted by hand, as in step 6 above (install.js doesn't
  set k79 on a fresh slot; whether GD would honour it before the first share is unchecked).
- After that first upload: quit GD via its menu once (it writes k1), read the ID off the level page,
  put it in `slots.lab.id`, and set `holds.shared`. From then on it works like the phone slot (by ID,
  exit 4 if the save doesn't hold it, k79 forced, k15 dropped).

**The slot's record was deleted from the save** (2026-11-24: a cleanup removed every GDLM level,
and hellgate was re-added without its ID, so `--slot phone` stopped with exit 4): take the online
keys from an older save or backup with `--ids-from <file.dat>`
(`%LOCALAPPDATA%/GeometryDash/gdlm_backups/`). The same-named copy is replaced, so the save ends up
with one record that has the ID back. Tested in `tests/install_keeps_id.js`; used 2026-11-24 with
`CCLocalLevels.before-cleanup.2026-11-24T17-29-33-529Z.dat`.

## Song and length on install (2026-11-25)

A custom song shows "Unknown" in the level's page until the song's info is in the game's own song list
(CCGameManager.dat, `MDLM_001`): GDLM 72 FROSTBITE used Dot (1290936), a song the user had never picked, and GD showed
"Unknown" and would not play or upload it. `tools/install.js` now adds every installed level's song to that list (from GD's
song server getGJSongInfo, local/songs/<id>.json as the fallback; CCGameManager.dat backed up to gdlm_backups first; a
song already listed is left alone), and copies the song's mp3 from local/songs into GD's folder when GD has none: with
the list entry alone the level still had no music (GD plays <id>.mp3 from its folder; GDLM 72, 2026-11-25). It also writes the length label k23 from the level's real time (0 Tiny < 10 s,
1 Short < 30, 2 Medium < 60, 3 Long < 120, 4 XL): lib/gd.js newRecord writes 1, so every level showed "Short".
Open: GD's key 9 in a song entry (a number that differs per song) is left out; GD has not complained.

## Install queue: levels go into the save the moment GD closes

**Since 2026-11-27, with GD running, install.js goes through the probe mod (v0.6.1+) instead:** the mod adds the level to
My Levels on a menu, keeps the online ID, lets GD save, and install.js reads it back (GEODE.md "Install into a running GD").
The queue is the fallback when the mod is not loaded / older, and for `--slot` while GD runs. The user's "install" is still
needed for every level (CLAUDE.md "Viewer first, always").
Checked in the game 2026-11-27 (mod v0.6.1): a live install on the main menu takes ~1 s (the mod 0.4 s), the level is
replaced in place, GD saves it at once and it survives a restart. Throwaway test level: `node tools/hotinstall.js testlevel`.

Before that, install.js refused while GD runs (GD rewrites the save on exit), so levels used to wait for hours.
`tools/install_queue.js` (the user's request, 2026-11-23):

- `node tools/install_queue.js add <level.gdlvl> ... --by <who>` puts levels on the queue
  (`local/install_queue.json`, shared). **Only the coordinator (main) session or the user adds.**
  Queuing a name that is already there replaces the older entry.
- `node tools/install_queue.js watch` (run in the background) polls `tasklist` every 30 s; when GD is
  not running it runs install.js once on the whole queue (backup first, online IDs k1/k16/k60/k79
  kept, a same-name level replaced in place), reads the save back, checks each level (found by name,
  same level data as the file by sha1, object count, online ID) and writes
  `local/install_reports/<time>.json` + a line in `log.jsonl`, then empties the queue of what it
  processed. `report` prints the last one; `list` shows what is waiting.
- `add` copies each file into `local/install_queue_files/` (shared) and the watcher installs that copy,
  so a level queued from any checkout installs right wherever the watcher runs (a relative path once
  pointed into the watcher's own worktree: "file missing"). The copies go when the queue empties.
- It never uploads, never starts or closes GD, and it is light (one tasklist call per poll).
- **It never drops an online ID.** Before installing it notes each queued name's `k1` in the save;
  if the read-back lacks it, it copies install.js's backup back over the save and reports every level
  as failed. (Seen 2026-11-23: main's install.js before keepOnline dropped hellgate's 152848491 on a
  plain replace; the coordinator restored the backup by hand.)
- Descriptions: install.js (plain and `--slot`) takes the level spec's short `"desc"` (STYLE.md "Name
  and description") over an older note-like description in the file, plus the signature line.
  `--slot`: `--desc` > the slot's `desc` > the spec's.
- Test: `node tests/install_queue.js` (a save copy, a fake "GD running" marker).
- Note: installing a level whose name is a slot's record (e.g. "GDLM 44 hellgate", the phone slot)
  changes only the PC copy; the phone keeps the uploaded version until someone Shares (user's yes).

## Updating a level that is already on the phone (same ID)

Pressing Share again on the SAME local level updates the upload in place (same ID; the level
page still showed "Version: 0" after both uploads). Our side: GD writes the online ID (`k1`, plus `k16` version, `k60` account) into the save
when it exits; `tools/install.js` replaces a level by name but now keeps those keys
(`tests/install_keeps_id.js`). So: close GD -> `node tools/install.js levels/<name>.gdlvl` (prints
"kept online ID N") -> open GD -> the level -> Share (settings as before) after the user's yes.
If install.js does not print "kept online ID", GD had not saved the ID yet (it was not closed
since the upload) -- a Share then would make a NEW level with a new ID. The slot section above has
the details that made the update work (same name, no k15).

## Open

- The phone getting the new version after an update is unchecked (the phone may cache the old
  download: re-download from the level page). Ask the user what the phone shows.
- The GD window's button positions above are for a 1866x1080 window; other sizes move them.
