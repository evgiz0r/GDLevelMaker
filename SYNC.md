# Music sync

How the levels follow their songs: beat detection, a sync score per level, what the official
levels do, and how to write a synced level. The numbers come from the songs and levels on the
user's PC; the per-level data lives in `local/` (gitignored) because it is about RobTop's levels
and songs.

## Commands

| step | command | time |
|---|---|---|
| beat grids of every song on this PC | `node tools/beats.js` (`--force` to redo) | ~1 s per song, 45 s for all 41 |
| check the beat finder on made-up songs | `node tests/beats_synth.js` | ~50 s |
| check the official grids against published tempos | `node tests/beats_published.js` | ~10 s |
| windows as the game sees them (60 fps presses) | `node tools/frames.js levels/<name>.gdlvl` | a few s per level |
| songs on this PC and their grids | `ls local/beats/` (`official_<Name>`, `custom_<Newgrounds id>`) | |
| sync of the official + repo levels | `node tools/sync.js` | ~7 s |
| ... of the user's own levels in the save | `node tools/sync.js --save` | ~5 s (positions only, no solving) |
| a level written in beats | `node tools/make.js specs/02_on_the_beat.json` | a few s |
| songs: beat clarity, beatless share, sections and drops; levels vs that structure | `node tools/songmap.js` (`--songs`, `--levels`, `--json`) | ~30 s first time, then ~10 s |
| check the section finder on a made-up song | `node tests/songmap_synthetic.js` | ~5 s |
| a song's real hits per half-beat (kick / snare / accent) | `node tools/hits.js <song id>` | ~2 s |
| how many of a level's presses sit on a real hit (+-1 frame) | `node tools/hits.js --level levels/<name>.gdlvl [--skip a-b]` | ~2 s (needs a saved solution) |
| an ultra-synced level from a list of hits | `node tools/hitlevel.js briefs/<NN>.hits.json --check` -> spec | instant |

`tools/beats.js` writes `local/beats/<song>.json` and `viewer/beats.local.js` (the viewer's
beat lines). `tools/sync.js` writes `local/sync/*.json`. All are gitignored.

## 1. Finding the beat

No dependencies (librosa could not be installed here, and the repo has none): ffmpeg decodes
to mono 22050 Hz, the rest is plain JS in `tools/beats.js`:

1. 2048-point FFT every 11.6 ms, 40 log-spaced bands, log-compressed; onset envelope = summed
   positive change (spectral flux) minus its 1 s moving average. The bands under 150 Hz give a
   second, kick-drum envelope.
2. Tempo candidates from the envelope's autocorrelation (60-240 BPM). Each candidate and its
   3/2, 2/3, 2 and 1/2 is fitted as one fixed grid `t0 + k*period` over the whole song (period
   to 0.002%, phase to 0.6 ms). The winner is the grid whose beats carry the most onset energy
   compared with the song overall ("ratio"). A slow grid wins that too easily, so a grid whose
   half-beats are also strong counts as its double. A mild 140 BPM preference breaks near-ties.
3. Downbeat = the beat (mod 4) with the most kick-drum flux. Section changes = beats where the
   next 8 beats are 3 dB or more louder or quieter than the previous 8.
4. Confidence: high = ratio >= 3 and the best local phase never strays more than 25 ms from
   the grid in any 15 s piece; medium = ratio >= 2.3 and drift <= 60 ms; else low.

**Checks.** On made-up songs (kick per beat, accented downbeat, off-beat hi-hats, noise;
100-174 BPM) the tempo is within 0.004 BPM, the phase within 4 ms and the downbeat right
(5/5). The flux peak comes 28 ms before the true onset (the onset is in the second half of the
window); that is corrected (`LAG`). On the 22 official songs it finds whole-number tempos (a
good sign for electronic music made on a grid): Stereo Madness 160, Back On Track 142,
Polargeist 163, Dry Out 145, Base After Base 141, Can't Let Go 170, Jumper 178, Time Machine
143, Cycles 140, xStep 130, Clutterfunk 140, Theory of Everything 130, Electroman 170,
Clubstep 128, Electrodynamix 127, Hexagon Force 163, Blast Processing 135, ToE 2 132,
Geometrical Dominator 148, Deadlocked 135, Fingerdash 112, Dash 128. 21 high, Clubstep low
(its grid drifts ~120 ms in places). The levels then agree with these grids (section 3), which
checks the tempos and the time mapping together. Picking by the z-score instead chose 3/2
tempos (ToE 195, Deadlocked 202) whose grids the levels do not follow; the ratio rule fixed
that.

**Against published tempos.** A player-made BPM list (gdforum.freeforums.net thread 59158,
"List of BPM of Geometry Dash Songs", 2018) gives 21 of the 22 (not Dash). 19 agree within
1 BPM (Hexagon Force is listed as 81, half of 163; ToE is 130 there and 132 in a second list
in the same thread). Two disagree, and the audio sides with the grid both times:
Polargeist is listed as "~175": a fixed grid at 175 does not fit (ratio 1.2, drifts 85 ms),
at 163 it fits to 4 ms over the whole song (z 94). Jumper is listed as 175: started at 175,
the fit slides to 178.00 with no drift.

**Not checked:** custom songs with tempo changes. `drift` flags them: custom songs 10000912,
10007496, 10010007, 685746 and 850364 drift 70-170 ms from one fixed grid somewhere in the song
(low confidence). A level on such a song needs local grids, which are not built.

## 2. Measuring sync

`lib/sync.js` (node and browser), driven by `tools/sync.js`:

- **Level time to song time.** Song second = level offset (`kA13`) + level time; level time
  comes from x through the speed portals (`timeline`), as the physics moves the cube. It
  matches the replayed run exactly (0 units off) on every solved level. A scan of an "effective
  speed" factor 0.8-1.2 over all 22 official levels peaks at exactly 1.000, and the portals sit
  0.03 beat (~12 ms) before the beat by their centres: the mapping has no hidden offset.
- **Events:** presses (from a solution), orbs, pads, portals, spike runs (hazards less than a
  block apart are one obstacle, timed at the first). Objects are timed when the cube's centre
  passes the object's centre. That is how the official levels line up: by first contact the
  portals would sit 0.3 beat early.
- **Windows, not ticks.** For each press of a known solution, `pressWindows` shifts it (and its
  release) one 240 Hz step at a time and replays; the window is every shift that still beats
  the level. An orb's window is the time the cube overlaps it. "On the beat" = the window
  comes within 35 ms of a beat line.
- **Scores per level and kind:** `kappa = (hit - chance) / (1 - chance)`, where chance = the
  hit rate with the beat grid slid to 48 other phases (a wide window hits by luck; this says how
  often). 1 = everything on the beat, 0 = no better than luck. `p` = share of slid grids doing
  at least as well. `R` = how tightly the events cluster at one phase of the beat (1 = all
  together; about 1/sqrt(n) by luck), with that phase in ms.

Presses exist only where the physics can beat the level: the official levels the difficulty and
physics sessions have solved into the shared `local/` (each file names the physics commit; on
Nov 22, after physics 1503b03: levels 2-17; the files carry the human route, one tap per jump)
and the repo's levels. The rest are measured by object positions only. A saved
solution only counts while it still replays; `tools/sync.js` checks that and leaves the presses
out otherwise.

## 3. Findings: what the official levels put on the beat

Pooled over all 22 official levels:

| kind | n | beat R | vs luck | phase | on the 1st beat of a bar |
|---|---|---|---|---|---|
| speed portals | 67 | 0.36 | x2.9 | +0.10 beat | **76%** |
| mode portals | 178 | 0.27 | x3.6 | -0.04 beat | **60%** |
| gravity portals | 248 | 0.14 | x2.2 | -0.03 beat | 31% |
| orbs | 730 | 0.08 | x2.0 | -0.03 beat | 22% |
| pads | 504 | 0.05 | x1.0 | - | 24% |
| spike runs | 1207 | 0.04 | x1.3 | - | 26% |
| presses (levels 2-17) | 1785 | 0.04 | x1.7 | +0.01 beat | 26% |

(25% = luck for the bar column.)

- **Transitions are synced, obstacles are not.** RobTop puts a portal's centre on the beat,
  most often the first beat of a bar. 49% of those bar-start portals open a 4-bar (16-beat)
  phrase (luck: 25%). The gaps between mode portals are most often 16 beats (37 times), then 8
  (28) and 32 (13): a new section of the level comes with a new 4- or 8-bar phrase.
- **Spikes and presses keep the rhythm locally, not the phase.** Over 6 events in a row,
  orbs agree on a phase at the song's tempo (R 0.44 vs 0.34 +- 0.03 at unrelated tempos, about
  3.7 sigma) and spike runs weakly (0.39 vs 0.34, about 2 sigma). Over a whole level the phase
  is lost. One reason: GD's block grid does not divide the beat (at 1x and 160 BPM a beat is
  3.9 blocks), so a pattern spaced in whole blocks drifts against the music.
- **Presses (levels 2-17, 1785 presses, physics 1503b03): barely a lean.** Pooled R 0.04, 1.7
  times luck, on the beat's phase (+0.01 beat), bar positions flat (26/25/25/24%). Per level the
  press kappa (window within 35 ms of a beat): Jumper 0.50 (p 0.06), Time Machine 0.39 (p 0.12),
  Can't Let Go 0.27; every other level near 0 or below (Clutterfunk -0.21). No level's presses
  beat luck at p < 0.05. (With the earlier physics, levels 1-8 gave R 0.07; Stereo Madness was
  -0.29.) GDLM 02 (every press on a beat) is therefore more
  on the beat than any official level.
- **Song section changes** (my loudness-based detector) have a portal within 2 beats 39% of
  the time against 32% by luck: weak. The detector is crude; the bar and phrase result is the
  solid one.

Per level (mode + speed portals within 0.15 beat of a beat (luck 30%) and of a bar start
(luck 7.5%); gravity portals on a beat; orb kappa; spike-run R; press kappa where solved):

| level | BPM | portals | on beat | on bar | grav. on beat | orb kappa | spike R | press kappa |
|---|---|---|---|---|---|---|---|---|
| xStep | 130 | 7 | 86% | 86% | 65% of 20 | 0.53 | 0.10 | |
| Hexagon Force | 163 | 16 | 81% | 81% | 55% of 11 | -0.12 | | |
| Blast Processing | 135 | 11 | 73% | 73% | 20% of 5 | 0.21 | | |
| Deadlocked | 135 | 40 | 63% | 60% | 41% of 32 | 0.17 | | |
| Theory of Everything 2 | 132 | 29 | 45% | 45% | 41% of 29 | 0.12 | | |
| Fingerdash | 112 | 21 | 48% | 43% | 25% of 4 | 0.05 | 0.04 | |
| Electrodynamix | 127 | 13 | 46% | 38% | 36% of 14 | 0.44 | 0.33 | |
| Theory of Everything | 130 | 11 | 36% | 18% | 29% of 21 | 0.13 | 0.21 | |
| Time Machine | 143 | 3 | 33% | 0% | 40% of 10 | **0.84** | 0.21 | 0.37 |
| Electroman Adventures | 170 | 11 | 36% | 0% | 50% of 6 | **0.79** | 0.18 | |
| Clubstep | 128 | 13 | 38% | 8% | 35% of 23 | -0.11 | 0.04 | |
| Geometrical Dominator | 148 | 19 | 21% | 11% | 0% of 4 | 0.10 | | |
| Dash | 128 | 25 | 16% | 4% | 25% of 8 | 0.03 | 0.18 | |
| Stereo Madness | 160 | 4 | 25% | 0% | | | **0.39** of 50 | -0.29 |
| Back On Track | 142 | 2 | 50% | 50% | | | 0.17 | 0.07 |
| Polargeist | 163 | 2 | 0% | 0% | | 0.11 | 0.05 | 0.08 |
| Clutterfunk | 140 | 4 | 0% | 0% | 18% of 17 | -0.16 | 0.09 | |

(Levels with 2-4 portals say little either way.)

- **Most synced:** xStep, Hexagon Force, Blast Processing, Deadlocked. Their portals and
  section changes land on bar starts. Time Machine and Electroman put their orbs on beats
  (kappa 0.8). Stereo Madness is the only one whose spikes keep one phase across the level.
- **Least synced:** Clutterfunk, Polargeist, Dash, Geometrical Dominator, Clubstep (whose own
  beat grid is the least certain).
- **The user's levels** (`--save`, 22 levels, 5 on songs not on this PC): mostly short tests
  with too few events to score. "cube timings" puts all 5 of its orbs on beats (kappa 1.0); its
  presses are loose (kappa 0.18, 12 presses; 0.23 before the replay-checked windows of physics
  a8a2220, Nov 23). GDLM 02 keeps all 11 presses on a beat with the narrower windows. No user level is synced at the official levels' bar level.

How GD makers place sync, from this: build a section per 4- or 8-bar phrase and start it with
a portal (or a speed change) whose centre is on that bar's first beat; put orbs on beats when
the music has a clear hit; let spikes follow the rhythm loosely (the block grid makes exact
phase impossible at most tempos). Clicks on the beat are a choice of the level maker, not
something the official levels do throughout.

### How much to sync (the user, Nov 22)

Sync does not have to be perfect: too synced sounds forced, and not everything in the game is
clicked on the beat. Some music has no beat to follow, just a vibe; that suits ship and wave
parts. The official levels agree (above). So:

- **Sync the moments**: portals and speed changes on bar starts, the drop and section changes,
  orbs on the clear hits. These are what a player hears as "synced".
- **Leave most clicks free.** Pin a click to a beat (`"jN"`) where the music has an accent
  worth hitting, not everywhere. make.js prints `sync: k/n presses centred on a beat` and a note
  when more than 60% are pinned (GDLM 02 is 10/11 on purpose: it was a test of the sync itself).
- **Beatless parts follow the vibe**: a pad, a build-up, an ambient intro has no grid worth
  matching (low-confidence grids, quiet sections). Match intensity instead: calm and open where the
  song is quiet, dense where it gets loud (`loud` and `sections` in `local/beats/`). make.js says
  so when the grid is low-confidence.

## 4. Writing levels in beats

`tools/make.js` specs take a song and beat positions (full syntax at the top of the file):

```json
{ "name": "GDLM 02 on the beat", "song": {"official": 1}, "speed": "1x",
  "grid": {"bpm": 160.0, "t0": 0.2443},
  "objects": [ ["spike", "j9", 0], ["yellow orb", "b18", 1], ["spike", "b18+1", 0] ] }
```

- `"bN"`: where the cube's centre is on level beat N (beat 1 = the first beat at or after the
  level start, `kA13`). Orbs, pads and portals placed there are hit on the beat, as the
  official levels do it. `"b16.5"` is the half-beat; `"b16+2"` is two blocks later.
- `"jN"`: a spike placed so that the jump over it is pressed on beat N. It starts from the
  one-spike jump lead (below). Then make.js solves the level, finds the press that clears each
  jN group (all objects with the same jN) and slides the group until that press's window is
  centred on the beat (up to 6 rounds). Spike runs, double spikes and orbs then still land on
  the beat.
- Speed portals placed by beat are placed first and change the timing after them.
- `"grid"` pins the beat grid so the spec works without the song; without it, make.js takes
  `local/beats` and prints the grid to paste in.
- After building, make.js prints each press's window in beats and how many can land on a beat
  or half-beat. `specs/02_on_the_beat.json` gets 11/11 and passes the sight-read check (no prejumps).

Cube limits (from the physics, one jump on flat ground):

| speed | jump lead (blocks) | in the air | press window | fastest tempo for a jump on every beat | blocks per beat at 140 BPM |
|---|---|---|---|---|---|
| 0.5x | 1.74 | 0.417 s | 192 ms | 144 BPM | 3.59 |
| 1x | 2.22 | 0.429 s | 238 ms | 140 BPM | 4.45 |
| 2x | 2.88 | 0.442 s | 275 ms | 136 BPM | 5.53 |
| 3x | 3.35 | 0.408 s | 279 ms | 147 BPM | 6.69 |
| 4x | 4.16 | 0.375 s | 292 ms | 160 BPM | 8.23 |

So at most GD tempos (130-180 BPM) a cube jumps on every other beat. Steps on every beat or
half-beat need orbs, pads or ship/ball modes. make.js warns when two jN are closer than a jump
lasts.

## 5. In the viewer

With `node tools/serve.js` and the song on this PC, the viewer shows:

- a line per beat in the level (brighter and numbered on bar starts);
- a strip under the level with every beat, the song's section changes (orange = louder,
  violet = quieter), the presses and the playhead; click it to seek;
- the beat in the clock and in the click table.

The "beats" button hides them. Levels whose song has no grid say so in the Level card.

**On the phone**: PHONE.md (the page, its live data, songs added from the phone).

## 6. Songs: where they come from

Official songs are in the game install (`Resources/<Name>.mp3`). Custom songs are looked up by
id: first the game's own save folder (`%LOCALAPPDATA%/GeometryDash/<id>.mp3|ogg`, what the user
downloaded in GD), then the shared cache `local/songs/` (never committed). `tools/songs.js` fills
the cache the way GD does: it asks GD's server for the song's info (`getGJSongInfo.php`: name,
artist, size, the Newgrounds mp3 url) and downloads it; ids from 10000000 up are GD 2.2's music
library, `.ogg` from RobTop's CDN (`geometrydashfiles.b-cdn.net/music/<id>.ogg`, checked: 200,
audio/ogg). One request at a time, 3 s apart. `tools/serve.js` and `tools/beats.js` use both
places (`songFile` in songs.js), so a fetched song gets beat lines and a beat grid like any other.

| step | command |
|---|---|
| what is used and where it is | `node tools/songs.js --list` |
| name, artist, size, url only (downloads nothing) | `node tools/songs.js --info <id>...` or `--levels --info` |
| fetch the missing songs of the repo's levels, examples/ and local/community/ | `node tools/songs.js --levels`, then `node tools/beats.js` |
| songs for the phone page | `node tools/songs.js --phone` (into OneDrive `GD songs/`) |

On Nov 22 2026 the levels used 85 custom songs; 6 were on the PC. Of the 79 missing, 72 have a
Newgrounds url (608 MB in all), 5 are library songs, and 2 (628806, 1268427) the server refuses
("-2": removed or not allowed in GD). Fetched Nov 23 with the user's OK: 76 of 79 (655 MB in
local/songs/); 709117's Newgrounds file is gone (HTTP 404). Beat grids for all 118 songs: 2m40s. Meta (name, artist, url) is in `local/songs/<id>.json`.

## 7. Song structure: sections, drops, beatless parts (Nov 23 2026)

Beats (sections 1-3) are the small scale. `tools/songmap.js` looks at the large scale: per bar of
the beat grid it measures 16 band energies, loudness and **beat clarity** (spectral flux on the
bar's 4 beats over the bar's mean flux: a steady pad is ~1.5, real GD songs have a median of 2-4,
under 1.8 counts as beatless). **Sections** come from novelty on the bars' self-similarity
(Foote, 4-bar kernel), each typed drop (>= 4 dB louder or clearer beats), break (>= 4 dB quieter)
or change. Checked on a made-up song (`tests/songmap_synthetic.js`): its drop and break are found
on the right bar, and its pad reads beatless. This replaces the loudness-only section finder in
`local/beats/` (which got 39% vs 32% luck).

**The songs** (118 on the PC since Nov 23: 22 official, 86 Newgrounds, 10 from GD's library;
`local/songmap/songs.txt` has the table):
- Every official song has a clear, steady beat: median clarity 2.5-4.1, beatless bars 0-15%
  (Back On Track 15%, Theory of Everything 8%, xStep 9%, the rest under 8%).
- Custom songs vary more. Median beatless share: official 2%, Newgrounds 8%, GD library 18%;
  songs with 20% or more: 0 of 22 official, 17 of 86 Newgrounds, 4 of 10 library. Among the first
  ones measured: 644761, 467267 (33%), 10000912 (29%), 343707 (26%, GDLM 44 hellgate's), 685746
  (24%), 10004401 (21%). These are the songs where "follow the vibe, not the grid" applies.
- Sections start on a 4-bar phrase line (bar 0, 4, 8... from the grid's downbeat) 46% of the
  time in the official songs (41 of 90; luck 25%, about 4.5 sigma), 32% in the custom songs (whose
  downbeats are less sure). The rest are off by a bar or two: use a section as "around here", and
  snap it to the nearest phrase line when placing a portal.

**The levels** (22 official; 84 of the 91 downloaded community levels, all whose songs are now on
the PC; the GDLM levels. Transitions = mode and speed portals and colour triggers. Numbers in
`local/songmap/levels.txt`):
- **Portals mark section changes.** Novelty (z) where a mode or speed portal sits on a bar line:
  official 0.41 (n 94, 36% in the song's top-20% bars, luck 20%: about 4 sigma), community 0.25
  (n 797, 29%: about 6 sigma). Colour triggers do not (official -0.05, community 0.02, both 19-20%):
  most are pulses and decoration.
- Counting the other way, a song's section changes get a transition within 1 beat 57% of the time in
  official levels (luck 44%, sliding the sections by whole bars) and 55% in community levels
  (luck 35%). Drops: official 62% met, community 63%.
- **Density follows loudness, more in the official levels**: hazards per bar vs the bar's loudness,
  Spearman r median 0.18, positive in 16 of 22 official levels (sign test p ~0.03); community
  median 0.07, positive in 57% of 84.
- **No mode lives in the calm parts.** Per-song percentile of the bars each mode is played in
  (0.5 = typical): official ship clarity 0.49, loudness 0.51; wave 0.49 / 0.57; cube 0.50 /
  0.44; every mode has 12-21% of its bars in the song's calmest 20% (luck 20%). UFO, wave and ball
  sit in slightly louder bars than cube. The official songs barely have beatless parts.
- **In bars with no beat (clarity < 1.8), community makers play cube, ship and wave as often as
  anywhere, and avoid the tap modes.** Share of each mode's bars that have no beat: cube 10.4%
  (of 2232), ship 10.6% (951), wave 11.5% (504), robot 8.5%, UFO 4.7% (380), spider 2.9%, ball
  2.8% (286; luck ~10%, so ball and UFO are well under it). So the user's "beatless parts suit ship/wave"
  holds in the weaker form: holding modes and the cube go anywhere, but the modes you tap in
  rhythm (ball, UFO, spider) are kept where there is a beat to tap to.

For writing levels: start a new mode or speed at a section change (the strong novelty bars),
make it denser where the song is louder, and in a song's beatless stretches use ship, wave or
cube, not ball, UFO or spider.

## 8. Ultra-synced levels: every press on a real hit (GDLM 62, Nov 23 2026)

The user asked for an "ultra-synced" level, not too hard. The grid alone is not enough: a song with a
half-time feel (Subwoofer Lullaby, 148 BPM) has a kick on beat 1 and a snare on beat 3 and nothing
on beats 2 and 4, so "on a beat" can still be on silence. So:

1. **Pick a song by beat clarity**: `node tools/songmap.js --songs`, sort by clarity among `high`
   confidence. 1289772 (Subwoofer Lullaby [Remix], RunoNG, 68 s) was 5.98, the clearest of 118, and
   about a minute long by itself.
2. **Map its real hits**: `node tools/hits.js <id>` -> one line per bar, K kick / S snare / K! S!
   accents / x lesser / . nothing, per half-beat (z-scores of band flux over the song; written to
   local/hits/<id>.json with make.js beat numbers).
3. **Write the level as hits**: `briefs/<NN>.hits.json` lists sections (mode, look, from a beat on
   songmap's changes) and cells `[beat, kind]` (cube: spike, double, up, down, orb, pad; ball: floor,
   roof). `node tools/hitlevel.js <plan> --check` refuses a cell on a slot with no hit and writes the
   spec; every press is a `jN` group (make.js slides it until the press is on beat N).
   At 148 BPM a cube press every 2 beats (0.81 s) is a comfortable Easy-Normal pace; an orb-pit jump on
   a hit puts its orb tap half a beat later (look for a K on the half-beat).
4. **Measure**: `node tools/hits.js --level <gdlvl> --skip <ship seconds>`: the share of presses
   within +-1 frame of a hit. A ship's holds follow the music's flow, not its hits: skip them.

, music sync session, branch claude/sync-6e196a)

Done and on main: beat grids for all 42 songs on the PC (22 official, all checked against
published tempos; 20 Newgrounds), sync scores for the 22 official levels (presses for 1-8, from
the difficulty session's solutions with the current physics) and the repo's levels, specs in
beats, beat lines in the viewer and on the phone page, the "how much to sync" rule in make.js.

Good numbers: portals on bar starts 60-76% (luck 25%); orbs R 0.08 (x2 luck); presses R 0.04
(x1.7 luck, levels 2-17, no level p < 0.05); cube airtime at 1x 0.43 s, so a jump on every beat only up to
~140 BPM; beat phase error <= 4 ms on synthetic songs.

Asked of others: the style session's `score.js` sync gate warns below 60% of presses on a beat;
asked them (Nov 22) to grade portals and drops instead, per the user's "not forced" rule.

## Open

- **Presses, more levels**: redone after the physics change (Nov 22, 1503b03) for 2-17. Stereo
  Madness's file (6f10058) no longer replays and the difficulty session re-solves it last; 18-22
  are being solved. When they land: `node tools/sync.js --official --repo` (light, ~20 s), update
  section 3. Never solve them here (one heavy job at a time).

- Presses for official levels 9-22 need solutions (other game modes in the physics).
- Not yet felt in the game: whether "on the beat" by this measure feels on the beat to the
  user (the official portals say the time mapping is right; GD's audio latency on the user's
  PC is not measured).
- Section detection: now spectral novelty (section 7). Not yet: whether its drops are where a
  listener hears them (no labels; the user could mark a few in the viewer). The detector's bar can
  be off by one.
- 7 community levels still unmeasured (songs refused or gone: 628806, 1268427, 709117). The
  user's own save levels are not in songmap yet (sync.js has the reader).
- make.js / compose.js do not yet read songmap's sections: a spec could say "new section at the
  song's next section change" instead of a beat number.
- Songs with tempo changes need local grids. Low-confidence songs: custom 343707 (GDLM 44
  hellgate, 145 BPM, drifts 100 ms), 685746, 850364, 10000912, 10007496, 10010007, and Clubstep.
- Beatless or ambient parts: the rule is "follow loudness and sections", but nothing yet places
  objects by loudness; a spec key for it (e.g. density per section) would make that writable.
- Not felt in the game yet: GDLM 02 (built as a test of "on the beat", not as a style).
