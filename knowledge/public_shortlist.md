# Public viewer shortlist (2026-11-26)

Asked for overnight (2026-11-26, "Shortlist for the morning"): which of our GDLM levels could go on the public viewer
(https://evgiz0r.github.io/GDWorkbench/, PAGES.md). **Nothing is published.** `knowledge/public_levels.json` is still
empty, and a level goes on it only when Evgeni names it. The same list is a decision card in the viewer's Work panel.

Keep in mind: on 2026-11-25 Evgeni archived every level except 44 ("not a fan of any current levels"). So this list
answers *what could go up if one of them should*. It is not a claim that any of them is good enough.

## The rules a public level has to meet

1. **Its song is in `knowledge/free_songs.md`** (Creative Commons, hostable), with the file in `songs/free/<id>.mp3`.
   This is required. GD's own songs (RobTop's library, `k8`) and every non-CC Newgrounds song are out. Fixing that means
   swapping the song, which in practice is a rebuild on the new song's beats.
2. **score.js has no FAIL** (READY). WARNs don't block.
3. Fair (score.js's "fairness" gate), and no worse than our others in `node tools/quality.js`.

## How each one was measured

`node tools/score.js <level> --json` on every free-song level in `levels/` and `levels/archive/`, today's code
(cb2cb34 + main), at low priority through the heavy lock. Each run took 33 s to 15 min of work, plus lock waits.
`tools/quality.js --cached` has no current rows: the archived levels are out of its sweep, and the cached rows were
made with older code. So the quality numbers below come from score.js's own gates (length, height, mode changes,
timing, difficulty, taste), the same measures quality.js uses. The official ranges are from QUALITY.md: length 78-95 s,
floor changes 12-22 per 10 s, mode changes 1.3-5.2 a minute.

## Ranked

| # | level | song (licence) | score.js | why | what's missing to go public | link |
|---|---|---|---|---|---|---|
| 1 | GDLM 50 eclipse | Eclipse, Uxvellda (CC BY; file in git) | **READY**: 0 fail, 14 warn | best taste score of ours (65/100), fair, Easy (~2 attempts), tightest press 96 ms, no repeats; "one idea carries a level" (TASTE.md) | nothing blocks. Weak spots: 38 s (official 78-95), 9.4 mode changes a minute (official 1.3-5.2), 72% on the bare floor, contrast "stark" (blocks vs sky 16 against rated levels' 6.5) | [gdlm_50_eclipse](https://claude.ai/artifact/7bXiT1gGnJWjESC8fy3oZH#gdlm_50_eclipse) ([home Wi-Fi, full viewer](http://192.168.1.189:8765/viewer/#lv=levels%2Farchive%2Fgdlm_50_eclipse.gdlvl)) |
| 2 | GDLM 61 lantern towers | Thumper, Waterflame (CC BY-NC-SA; **file not in git yet**) | 1 FAIL: a prejump at block 639 (6.2 blocks ahead of its spike) | closest to the official levels on gameplay: the only one that passes "height" (12.2 floor changes / 10 s, 39% on the floor), 72 s, 5 mode changes a minute, Normal (~3 attempts), no repeats; the 1.x craft look (CRAFT.md) | fix the one prejump (a small edit with `tools/edit.js`); copy `local/songs/575768.mp3` to `songs/free/`; a WARN on a jump mark with no jump (block 54); taste 46 | [gdlm_61_lantern_towers](https://claude.ai/artifact/7bXiT1gGnJWjESC8fy3oZH#gdlm_61_lantern_towers) ([home Wi-Fi, full viewer](http://192.168.1.189:8765/viewer/#lv=levels%2Farchive%2Fgdlm_61_lantern_towers.gdlvl)) |
| 3 | GDLM 71 two moons | Two Moons ft. Geyser, jamatar (CC BY-NC-ND: the audio must not be edited; file in git) | **READY**: 0 fail, 16 warn | the longest (127 s) and fullest: a space journey, 67% flying, fair, Hard (~24 attempts) | nothing blocks. Weak spots: one mini-structure repeated 19 times in the middle (13% of 4-move patterns repeat; taste 29 after the repetition rule), 17 mode changes (8 a minute), contrast 79/100. Not checked: whether your "solid background is confusing" mark is fully fixed in this copy | [gdlm_71_two_moons](https://claude.ai/artifact/7bXiT1gGnJWjESC8fy3oZH#gdlm_71_two_moons) ([home Wi-Fi, full viewer](http://192.168.1.189:8765/viewer/#lv=levels%2Farchive%2Fgdlm_71_two_moons.gdlvl)) |
| 4 | GDLM 64 golden hour v6 | Golden Haze, DetiousMusic (CC BY-NC-SA; file in git) | 2 FAIL: roles (18/95 sections put deco in the path's colours; official 0-5%), channels (key 155 written: the game would draw the deco in one colour) | 101 s, Normal (~4 attempts), fair, tightest press 108 ms, 2.4 mode changes a minute (in the official range) | channels: re-save through tools/io.js, which strips key 155 (a `make.js --look` does it). roles: recolour the deco that sits in the path's colours. Also: blocks show their raw grid skin in the noon ship (BUILDS.md), taste 31 | [gdlm_64_golden_hour_v6](https://claude.ai/artifact/7bXiT1gGnJWjESC8fy3oZH#gdlm_64_golden_hour_v6) ([home Wi-Fi, full viewer](http://192.168.1.189:8765/viewer/#lv=levels%2Farchive%2Fgdlm_64_golden_hour_v6.gdlvl)) |
| 5 | GDLM 66 collab long | Golden Haze, DetiousMusic (CC BY-NC-SA; file in git) | 2 FAIL: channels (96 deco on undefined channels 973-975: WHITE in the game), one ending (7 end texts, one from each collab part) | 100 s, 7 parts, every seam holds, fair, tightest press 133 ms | define channels 973-975 (or recolour that deco); keep only the last part's end text. Then: Hard (~16 attempts) on a Normal-feeling song, taste 23 | [gdlm_66_collab_long](https://claude.ai/artifact/7bXiT1gGnJWjESC8fy3oZH#gdlm_66_collab_long) ([home Wi-Fi, full viewer](http://192.168.1.189:8765/viewer/#lv=levels%2Farchive%2Fgdlm_66_collab_long.gdlvl)) |
| 6 | GDLM 65 single builder test | Golden Haze, DetiousMusic (CC BY-NC-SA; file in git) | **READY**: 0 fail, 10 warn | passes, fair, Normal (~3 attempts) | it is a test build (the one-builder baseline for the collab), 49 s, taste 15 (the lowest), a jump mark with no jump at block 139. Not recommended | [gdlm_65_single_builder_test](https://claude.ai/artifact/7bXiT1gGnJWjESC8fy3oZH#gdlm_65_single_builder_test) ([home Wi-Fi, full viewer](http://192.168.1.189:8765/viewer/#lv=levels%2Farchive%2Fgdlm_65_single_builder_test.gdlvl)) |

Left out because a newer version supersedes them (same song, more FAILs): GDLM 64 golden hour (prejump + roles),
64 v5 (4 prejumps + roles), 65 collab test (channels/key 155 + 2 end texts).

## Still being built tonight

- **GDLM 73 sunny streets** (session sunny-level). Song: Walking In Style, G4lvatron (CC BY, on the free list; the file is
  not in `songs/free/` yet). Last copy: v1 at 04:30, **NOT READY** (beatable; fairness after portals; prejumps at gates;
  white slopes). Its session was still fixing these, and its build stages were last updated at 06:07. If it lands READY,
  it is the obvious first pick: it was built from a free song on purpose, and it is the newest kit (the sunny theme).
  [gdlm_73_sunny_streets v1](https://claude.ai/artifact/7bXiT1gGnJWjESC8fy3oZH#gdlm_73_sunny_streets--v1) ([home Wi-Fi, full viewer](http://192.168.1.189:8765/viewer/#lv=local%2Fwip%2Fsunny-level%2Fgdlm_73_sunny_streets.gdlvl&v=1))

## Not possible without a new song

These need a song swap, which means a rebuild on the new song's beats. Not ranked:
- GDLM 44 hellgate (the one active level, uploaded): Infertehno 2 is CC but can't be hosted (third-party samples). It also
  FAILs prejumps and channels in its last score log.
- GDLM 47 sunny side (101 s), 51 adrift, 52 necromancy, 62 low end lullaby, 70 candy night, 72 FROSTBITE: none of their
  songs is CC.
- GDLM 01-43, 46, 60, 63, 67-69 and the prop test use a GD library song (RobTop's), and most are labs or tests anyway.

## About the links

The phone links (claude.ai/artifact/...#name) open the phone page. That page may only list the pushed levels in
`levels/`, so an archived level might not open there. The "home Wi-Fi, full viewer" link always opens it while
`tools/serve.js` runs on the PC.

## How to pick

Tick the levels on the viewer's decision card (Work panel), or name them in chat. For each one picked, a session then:
fixes what the "missing" column says, re-runs score.js to READY, adds the song file to `songs/free/` if needed, adds the
level to `knowledge/public_levels.json`, runs `node tests/pages_build.js`, and pushes.
