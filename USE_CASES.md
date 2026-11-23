# Use cases -- what someone can ask this project to do

The user's list (2026-11-23), kept so every session knows what the project is FOR and what each
use case still lacks. Status: **works** (end to end today), **parts** (the pieces exist, no single
path), **not yet**. Update the status when a use case moves; add new ones as they come up.

| # | Use case | Status | What exists | What is missing |
|---|---|---|---|---|
| 1 | **Prompt -> level.** "A happy level, 1:40, Normal" | works | compose/make.js, the structure library, every gate in score.js, `tools/loop.js` one command, wip + phone page | quality (QUALITY.md, CRAFT.md, ART.md); a QA pass, or sensible defaults when the user just lets it run |
| 2 | **Fix a level from a prompt.** "Make me a copy / fix this level here" -- ours or an existing one | parts | `tools/polish.js`, the soft rules (`tools/rules.js`, indicators, clusters, readability, orbarc) | one entry point that takes any level (a save name, an ID, a file) and a request in words; a copy by default, never overwriting the original |
| 3 | **Improve a level** -- an iterated process that makes it nicer | works (by session) | the polish rounds (POLISH.md), before/after renders | a repeatable "round" recipe any session can run; a stop rule (when it is good enough) |
| 4 | **Level -> issue report**: each issue with its fix effort and its effect | parts | score.js gates, rules.js, readability.js, indicators.js, clusters.js, fairness.js, windows | one `tools/review.js <level>` that runs them all and prints a ranked list (issue, where, effect on the player, effort to fix) |
| 5 | **Measure a level's difficulty** from its timings and what we learn | works | the difficulty model (DIFFICULTY.md; 0.87 against stars on clean routes), lib/windows.js | per-section difficulty, real attempt counts (real_stats) to calibrate, the no-skip re-solves |
| 6 | **Design a level in chat** with a drawing widget (or whatever we make) | parts | the free-draw widget (pens, orb/portal dropdowns) -> SKETCH.md reading rules -> GDLM 46 | the widget itself needs iterating (layers, beats on the page, a preview of the result); a saved home for it |
| 7 | **Show me the level** in the simulation | works | viewer (localhost:8765/viewer/), the phone page, level map, `tools/shoot.js` stills in GD art | the render beside the real game (VISUALS.md "render vs game") |
| 8 | **Combine / cut / split** levels, or parts of levels | not yet | -- | a tool that joins sections (fixing modes, speed, colours, sync at the seam), trims, or cuts a level into practice parts |
| 9 | **Create a track and a level from a prompt** | not yet | -- | research: making original music (a generator or tools), where it may live (a custom song needs a Newgrounds / music-library ID for anyone else to hear it), and then build the level on it |
| 10 | **Put it on my phone** | works | the publisher (install.js `--slot phone` / `--slot lab`), unlisted, the user's yes per upload | -- |
| 11 | **Play it and learn from my play** (recording -> what happened) | works | tools/record.sh on "record", physics' video readers, real_stats.jsonl, the taste data | the tracker for small icons; practice vs normal in the death list |
| 12 | **Restyle a level** ("make it spooky", another palette or theme) | not yet | the look pass (make.js --look), vfxkit, props (ART.md, in progress) | a theme swap that keeps the gameplay and the saved route |
| 13 | **Make it easier / harder** (retarget the difficulty) | not yet | the difficulty model, windows, the structure library's difficulty tags | a tool that widens or tightens windows and swaps structures toward a star target |
| 14 | **Move a level to another song** (re-sync) | not yet | beats.js, sync.js, the scene planner (in progress) | re-timing sections and portals to the new song's beats |
| 15 | **Compare levels** (ours vs official vs a level I liked) | parts | `tools/quality.js` (QUALITY.md), craft.js, the taste corpus | one picture-plus-table page per comparison |
| 16 | **Add / move / change one thing by prompt** ("an orb here", "lower this block", "make this a wave") | not yet | make.js specs, the viewer's coordinates and #lv links | a small edit tool: a level + a spot (x, block or a viewer link) + the change in words -> a copy with only that changed, re-solved, gates re-run |
| 17 | **Edit by prompt + picture** (a screenshot or a viewer mark with a drawing on it) | parts | the user's marks and annotated screenshots (read by hand today), soft rules | read the mark's spot and drawing, propose the change, apply it as 16, and learn the family as a soft rule |
| 18 | **Prompt + Q&A -> level**: a short interview (song, length, difficulty, theme, modes, mood) before building | not yet | compose briefs, the scene planner | the question set with good defaults ("let it run" = defaults), turning the answers into a brief |
| 19 | **Explain a level**: why this jump is hard, where people die, what to practise | parts | difficulty per input, windows, fairness, real deaths | a readable per-spot explanation in the viewer |
| 20 | **Practice helpers**: start positions or a practice copy at the hard parts | not yet | difficulty per section | start-position objects placed at section starts, a "practice copy" of a level |
| 21 | **Decorate my own level**: keep the user's gameplay, add the look | parts | polish.js look pass, props, craft rules | read a level from the user's save, decorate in a copy, show before/after |
| 22 | **Finish my level**: the user builds a part in GD, Claude builds the rest in the same style | not yet | reading the save, structures, style learning | learn the user's part's style and continue it, matching the song |
| 23 | **Level from a picture / drawing** | parts | the free-draw widget -> GDLM 46, picture -> GD art (ART.md) | a photo or sketch of a layout -> a level |
| 24 | **A preview video** of a level to share | parts | GamePlatform's record tools idea, shoot.js frames | a short rendered video with the song |
| 25 | **Learn my skill**: personalised difficulty from my recordings | parts | real_stats, the taste rows | a per-user difficulty curve that picks what's right for them |
| 26 | **Verify in the real game automatically** (the PC plays the level itself) | not yet | computer use, the publisher | inputs from the route sent to GD, recorded, compared -- the strongest fidelity check |
| 27 | **Platformer mode** levels | not yet | -- | the 2.2 platformer physics and controls |

When a session builds one of these, it updates this row in the same commit.
