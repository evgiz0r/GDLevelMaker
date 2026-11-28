# The first-contact showcase page (draft, NOT public)

Evgeni, 2026-11-28: a page he can point anyone to (players, creators with an audience) next to Hellgate in the game:
what the project can do -- layouts, section generators, solver paths, videos, themes, animations, use cases, the main
levels' difficulty, a review of Hellgate. Plus a short first message (`intro.md`).

- Draft as a private artifact: https://claude.ai/artifact/9oh2CEYyqSvwezNcKNptob (publish `showcase/index.html` with its
  `gens.js` and `img/` as files).
- **Public rules:** every picture is our own renderer (`shoot.js --shapes`, `levelmap.js --shapes`), never GD art; no song
  audio (Hellgate's 343707 is CC BY-NC but "not hosted": third-party samples, knowledge/free_songs.md); no main-level
  video, level data or bricks -- the main levels appear only as names and our numbers.
- **Not on GitHub Pages yet.** It goes up only on Evgeni's OK. Then: tools/pages.js copies `showcase/` to the site
  (its image refusal needs an allow-list for exactly these files, as it has for songs/free/), and the README links it.
- Rebuild the pictures: `node tools/shoot.js levels/<level>.gdlvl --shapes --at ...` (cloud: ~5-15 s per level);
  the two animations are 80 frames at 0.05 s (`--at 40.00,40.05,...`) made into webp (Python PIL, 640x360, ~1 MB each).
  `gens.js` = `tools/sectiongen.js` GEN[key]({cols: 60, seed, tier}) for 10 types x easy/normal/hard.
- Numbers on it: Hellgate's judge card = `levels/gdlm_44_hellgate.report.txt`; the main-level ladder = DIFFICULTY.md
  "v2 is the score"; beaten in sim = `knowledge/mains/routes.json` `ok`. Refresh them when those change.
