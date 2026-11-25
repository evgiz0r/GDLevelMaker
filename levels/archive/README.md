# Archived levels (2026-11-25)

Evgeni (2026-11-25): "i am not a fan of the any current levels, lets start over and keep only 44 for now as its uploaded."
Every GDLM level except GDLM 44 hellgate moved here. Nothing is deleted: the files, specs (`specs/`), briefs and their
history stay, and tests / tools that use one of them as a fixture point here now. The viewer's main list
(`tools/index_levels.js`, `viewer/levels.js`) reads only `levels/*.gdlvl`, so these are out of it; sweeps over `levels/`
(quality, taste, lego mining of "ours") now see only the active levels. Rebuilding one with `make.js` writes it back to
`levels/` -- do that only when Evgeni wants it back.
