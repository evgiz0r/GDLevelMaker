# Publishing levels to play them on the phone

The user's phone runs GD where file import is blocked (Geode doesn't support their version), so a
level reaches the phone as an **unlisted upload from the PC game**, found on the phone by
Search -> its level ID. IDs so far: `local/phone_ids.json` (level, ID, version, date).

| level | ID | version | date |
|---|---|---|---|
| GDLM 44 hellgate | 152848491 | v10 (16e82a4) | 2026-11-23 |

## Rule: every upload needs the user's yes

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

## Updating a level that is already on the phone (same ID)

Pressing Share again on the SAME local level updates the upload in place (same ID, GD bumps the
version). Our side: GD writes the online ID (`k1`, plus `k16` version, `k60` account) into the save
when it exits; `tools/install.js` replaces a level by name but now keeps those keys
(`tests/install_keeps_id.js`). So: close GD -> `node tools/install.js levels/<name>.gdlvl` (prints
"kept online ID N") -> open GD -> the level -> Share (settings as before) after the user's yes.
If install.js does not print "kept online ID", GD had not saved the ID yet (it was not closed
since the upload) -- a Share then would make a NEW level with a new ID. Not yet tried end to end.

## Open

- Re-share of an updated level (same ID) not yet done in practice; check the ID stays and the
  phone gets the new version (the phone may cache the old download: re-download from the level page).
- The GD window's button positions above are for a 1866x1080 window; other sizes move them.
