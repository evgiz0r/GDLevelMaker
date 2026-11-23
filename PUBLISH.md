# Publishing levels to play them on the phone

The user's phone runs GD where file import is blocked (Geode doesn't support their version), so a
level reaches the phone as an **unlisted upload from the PC game**, found on the phone by
Search -> its level ID. The slot and what it holds: `local/phone_ids.json`.

| level | ID | version | date |
|---|---|---|---|
| GDLM 44 hellgate (the phone slot, see below) | 152848491 | v10 (16e82a4) | 2026-11-23 |
| GDLM 44 hellgate, update into the slot | 152848491 | v11 (dc72b09) | 2026-11-23 |

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
   Never kill GD.
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

Done this way once: hellgate v10 -> v11 (2026-11-23), Upload Complete, ID unchanged. So the phone
always shows the name "GDLM 44 hellgate", even when the slot holds another level. The description
(k3) comes from the new level; whether the server takes a new description on update is unchecked.

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
