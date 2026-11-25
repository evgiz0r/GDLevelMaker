# Music control: the song's start point and song changes mid-level

The user (2026-11-25): "do we also control the music level, like starting from different place. or changing in the
middle to something else". Both are GD features; this doc is what we know, what we write, how it is checked, and
what is open. Code: `lib/music.js` (the model), `lib/sync.js` `beatToTimeSegs` (beats through a switch),
`tools/make.js` spec `"music"`, `lib/song.js` `musicPlayer` (viewer + phone page), `tools/video.js` (the mp4's sound).
Test: `node tests/music.js`.

## 1. The start point (song offset) -- already worked before this doc

The level header's `kA13` = the song second the level starts at. Spec / brief key `"offset"` (make.js, compose.js) sets
it; every beat (`"b12"`) counts from the first beat at or after it (lib/sync.js); the viewer, the phone page, video.js,
sync.js, hits.js, songmap.js and compare_sections.js all read it. `kA15` / `kA16` = fade in / fade out of the main song
(one second, gdlib's table; the GD docs' Primary Song page). DEFAULT_HEADER has `kA15,1` (fade in on).

## 2. Song changes mid-level: GD 2.2's Song and Edit Song triggers

GD 2.2 has 5 song channels (0-4). The level's main song always plays on channel 0. A **Song trigger (id 1934)** starts
a custom song on a channel, from a point, with fades; on channel 0 it replaces the main song. Using the main song's own
id with a new start point = a **seek** (rated levels do this to line sections up with a part of the song). An **Edit
Song trigger (id 3605)** stops a channel or changes its volume / speed over a duration. Official (RobTop) songs cannot
be played by Song triggers. Up to 21 song ids per level. Sources: the GD docs pages (uhdanke.github.io/gd_docs,
triggers/audio: song_trigger, edit_song, primary_song), gdlib 0.4.4's property table (`properties.rs`), and 21 rated
2.2 levels in the user's `local/community/` read on 2026-11-25 (12 use Song triggers, 9 of them Edit Song too).

### Keys

| key | Song (1934) | Edit Song (3605) |
|---|---|---|
| 392 | custom song id | |
| 432 | channel (absent = 0) | channel (absent = 0) |
| 406 | volume (1 = normal; seen 0.6-2) | target volume (with 418) |
| 404 | speed (seen -12..12; mapping not known) | target speed (with 419) |
| 408 / 410 | start / end, in ms of the song | |
| 409 / 411 | fade in / fade out, ms | |
| 413 | loop | |
| 399 | prep: load the song, do not play | |
| 400 | load prep: play what was prepped | |
| 417 | | stop the channel |
| 418 / 419 | | change volume / change speed |
| 10 | 0.5 on every one (GD's default) | duration of the change, seconds |
| 13, 36, 421 1, 422 0.5 | on every one (13 preview, 36 interactable; 421/422 unknown, GD's defaults) | 36, 421, 422 |

**Prep + load prep:** rated levels put a prep trigger (399) well before the switch and a load-prep trigger (400) with
the same song and start at the switch, so the new song is loaded when it is needed (the docs: "the track is replaced only
when the new track finishes loading" -- without prep a switch can come late). make.js does the same: a prep trigger 2 s
before by default (`"prep": 0` = none, `"prep": 4` = 4 s).

Triggers fire when the player's x passes theirs. Spawn-triggered (62) and touch-triggered (11) ones fire from other
triggers; `MUSIC.parse` skips and counts them (`skipped`), so for community levels that drive music from spawn chains
the viewer plays only the timed part.

## 3. Writing it: make.js `"music"` (also in compose briefs)

```json
"song": {"custom": 343707}, "offset": 12,
"music": [
  {"at": "b65", "song": 1234567, "from": 42.5, "fadeIn": 0.3},
  {"at": "t40", "volume": 0.2, "over": 1.5},
  {"at": "t44", "song": "main", "from": 120},
  {"at": "s170", "stop": true}
]
```
- `at`: `"b65"` a level beat, `"t40"` level seconds, `"s170"` a second of the main song. (Not a column: the beat map has
  to be known before speed portals are placed.)
- a song entry: `song` (id or `"main"` = seek), `from` / `to` (song seconds), `fadeIn` / `fadeOut` (s), `volume`,
  `channel` (0 replaces; 1-4 play on top), `loop`, `prep` (s, default 2), `grid` (`{bpm, t0}` of that song; else
  `local/beats` via tools/beats.js).
- `{"stop": true}`, or `{"volume": v, "over": s}` -> an Edit Song trigger on that channel.
- The record gets `k104` = every custom song the level plays (gdlib names it the level's song list), so GD knows to
  fetch the switched-to songs. NOT CHECKED in the game yet.

### Beats after a switch

Level beats count on through the whole level: in each part, the beats of the song playing on channel 0 there
(`GD.SYNC.beatToTimeSegs(segs, b)`, segs = `[{from, grid, songStart}]`; one segment gives `beatToTime` exactly). So in
a spec with `music`, a column `"b80"` after a switch lands on the new song's beat, and make.js's beat report counts the
same way. A switch whose song has no beat grid ends the beats there (a `b` column after it is an error).

## 4. Hearing it

- **Viewer / phone page**: `load()` -> `setMusic(level, world)`: a level with Song / Edit Song triggers gets
  `songInfo.music` (the spans) and `GD.musicPlayer` (lib/song.js): every span ahead is scheduled as its own buffer
  source with a gain envelope, on the main song's clock (`offset + level time`), so the replay's clock and seeking work
  as before. Each switched-to song is fetched from tools/serve.js `/song/custom/<id>.mp3` (in the GD save or
  `local/songs/`; `node tools/songs.js <id>` downloads one); a missing one is silent. On the phone page a song comes
  from the device ("add song"); `node tools/songs.js --phone` now copies the k104 songs too.
- **Video** (`tools/video.js`): each span cut from its file, its fades / ramps as a volume curve, delayed and mixed
  (`musicArgs`; checked by running ffmpeg on test tones in tests/music.js: a 0.25 ramp measured -12 dB).

## Open

- Nothing here is checked in the real game yet: the trigger keys are copied from rated levels, so GD reads them, but
  whether our k104 makes GD fetch the extra songs for a locally installed level, and how late a switch without prep
  comes, are unmeasured. First check: one test level with a seek and a switch, installed only after the user's OK.
- Speed (404) is not modelled (played at speed 1); its unit is not known.
- Spawn / touch-triggered song triggers are skipped (community levels with music driven by spawn chains).
- `vfxkit.beatPulses` and other tools that read `kA13` + one grid (sync.js, hits.js, songmap.js, compare_sections.js)
  still assume one song: right up to the first switch, wrong after it. Move them to `MUSIC.spans` + `beatToTimeSegs`
  when a level with switches needs them.
- The song stage / sections planner (compose, scenes.js) does not yet choose switches by itself; a brief can carry
  `"music"` by hand.
