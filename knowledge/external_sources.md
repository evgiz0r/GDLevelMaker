# External GD sources: level databases, creation tools, records, AI level makers

A survey made 2026-11-26 for Evgeni ("dbs of levels, dbs of level creations -- guides, tools, dbs of level records",
and "creating a level like this with AI, is it a thing?"). Research only: nothing was sent to any site.
**Checked** = page read on 2026-11-26. **Memory** = known from earlier, not re-checked that day; check before relying on it.
Rule for everything here: other people's levels and RobTop's data stay in `local/` (CLAUDE.md), numbers only in git.

## Top picks for this project

1. **Hugging Face `yusp48/geometry-dash-levels`** -- a 62.8 GB dump of level strings plus ratings (2024: ~300k levels;
   2026: ~50k rated/featured, scraped Feb 2026), with likes, downloads, stars, length, editor time. One download replaces
   thousands of `fetch_level.js` calls: brick mining (LEGO.md), taste corpus (TASTE_DATA.md), deco study (DECOART.md),
   hazards study. No licence on the card: treat as local-only measuring data, like local/community/.
2. **GDHistory API** (history.geometrydash.eu) -- old versions of levels and their likes/downloads over time. Gives
   taste a time axis (how fast a level gained likes) and older copies of levels that changed. Unfinished, no stated limits.
3. **GDDL, the Demon Ladder** (gdladder.com) -- 39 community difficulty tiers plus a 0-10 enjoyment score per demon.
   The best outside target for the difficulty fit (DIFFICULTY.md wants "community tier lists") and an enjoyment signal for
   taste. No public API found; a Google Sheets backup exists.
4. **AREDL + Pointercrate** -- record lists. Pointercrate we already use (tools/demonlist.js); AREDL covers every rated
   extreme with an API (api.aredl.net/v2). Victor counts per level = a difficulty signal for the top end.
5. **EditorAI** (Geode mod + Qwen fine-tunes) -- the closest thing to us online; worth a look to know the field (below).

## 1. Level databases

| source | what | API / export | terms | use here | status |
|---|---|---|---|---|---|
| GD's own server (boomlings.com/database, `downloadGJLevel22.php`, `getGJLevels21.php`) | every online level, search, comments, scores | the game's POST API, documented by gddocs | RobTop's | **we use it**: tools/fetch_level.js | memory |
| GDBrowser (gdbrowser.com, GDColon) | browser over GD's server + level analysis | JSON `/api/level/<id>`, `/api/search/`, `/api/comments/`, `/api/mappacks` | open source; be polite | **we use it**: community.js, taste.js | memory |
| HF dataset `yusp48/geometry-dash-levels` | ~300k (2024) + ~50k rated (2026) level strings with metadata, JSONL/Parquet | bulk download (huggingface `datasets`) | no licence stated | top pick 1 | checked |
| GDHistory (history.geometrydash.eu, cvolton/gdhistory) | archive of levels over time ("2/3 of levels indexed") | `/api/v1/level/{id}/`, `/user/{id}/`, `/search/level/advanced/` (limit 1000), `/daily/`, `/counts/` | none stated; "very unfinished" | top pick 2 | checked |
| gddocs (gd-programming / wyliemaster gddocs) | the server endpoints, level-string keys, object and trigger keys | docs | open | cross-check lib/gd.js keys and trigger keys | memory |
| client libraries: gd.py (Python), gd.js, jdash (Java), gdlib (Rust, has trigger structs), GD-NodeJS-API | wrappers for the server and level strings | code | various open licences | key references when a trigger key is unknown (gdlib's triggers.rs) | checked (listed) |
| Level Thumbnails / in-game level pages | likes, downloads, length, rating, creator | via GDBrowser | -- | already in taste corpus | memory |

## 2. Level creation: guides, tools, references

| source | what | use here | status |
|---|---|---|---|
| RobTop's `GDEditor.pdf` and `GDRating.pdf` (robtopgames.com/files) | the official editor guide and rating guidelines | rating.md already cites GDRating.pdf; GDEditor.pdf for trigger meanings | checked (found) |
| SPWN (Spu7Nix/SPWN-language) | a language that compiles to GD triggers | reference for trigger groups/keys; not needed to build | checked (listed) |
| GDShare (HJfod/GDShare-mod) | import/export .gmd/.gdr in game | **known**: tools/export_gmd.js, PUBLISH.md | checked |
| BetterEdit, Editor Collab, Circle Tool, GD Guidelines (BPM guide lines), Git Editor (`imes.git-editor`: collab, history, backup) | editor mods | GD Guidelines = how creators mark beats in the editor; Git Editor = level history | checked (listed) |
| image2gd, GD Pixel Art (GDColon), gd-image-to-text, Geometrize-style converters | picture -> GD objects | we have our own (lib/pixelart.js, lib/paintfit.js); image2gd's object choices are a comparison point for DECOART.md | checked (listed) |
| `rgc_exists.objectstoimage` (Geode) | GD objects -> picture in game | a real-game render to check our viewer's look | checked (found) |
| Geome3Dash (`rainixgd.geome3dash`, Geode) | the level drawn in 3D | curiosity only | checked (found) |
| Blender workflows | no GD exporter found; creators use Blender only for art they then convert as images | nothing to adopt | checked (search) |
| GD wiki (geometry-dash.fandom.com) | object ids, trigger pages, hitbox notes | object ids for `sure:false` entries in lib/objects.js | memory |
| Physics: gdsolver, camila314/gdp, iArtie decompile, OpenGD | -- | **we use them all** (CLAUDE.md "Physics sources") | -- |

## 3. Records, tier lists, stats

| source | what | API / export | use here | status |
|---|---|---|---|---|
| Pointercrate (pointercrate.com) | main / extended / legacy demon list, records with videos, players | `/api/v1/` + some v2, JSON, paginated (limit 100); reads public, writes need a token; no redistribution of their content without permission | **we use it**: tools/demonlist.js | checked |
| AREDL (aredl.net) | every rated extreme demon, records, packs | API v2 at api.aredl.net/v2/docs (page renders in JS, endpoints not read) | victor counts, list position as a top-end difficulty scale | checked (site), API unread |
| GDDL / Demon Ladder (gdladder.com) | 39 tiers (Easy demon 1-5 ... Extreme 21-39) by community vote + enjoyment 0-10 | none found; Google Sheets backup | top pick 3: difficulty fit + enjoyment | checked (wiki page) |
| NLW (Non-List-Worthy extremes) / IDS (Insane Demon Spreadsheet) | community tier sheets for extremes / insane demons, with enjoyment columns | Google Sheets; `nlw-api` (git.oat.zone/oat/nlw-api) wraps the NLW sheet | more tier data in the Insane range | checked (found) |
| GDDP (demon progression packs), Challenge List, Platformer list | other community lists | sites / sheets | low priority | memory |
| Ydis (exyl-exe/ydis), GD Save Explorer (gdcolon.com/gdsave) | attempt stats from one's own save | local | we have tools/save_stats.js already | checked (listed) |
| Attempt / death stats across many players | **not public**: GD's server shares no per-player attempts; only lists' records and creators' own posts | -- | our own data (his runs, probe logs) stays the main source | -- |

## 4. "Making levels with AI" online (Evgeni's question)

Yes, people have tried, but what we found is much simpler than ours. All take a language model and have it write level
data or a made-up format; none we found checks the level can be beaten, solves it, syncs it to the song or scores
difficulty and fairness.

| project | what | how far |
|---|---|---|
| **EditorAI** (Entity12208/EditorAI, Geode mod; models on Hugging Face `EditorAI-Geode`, Apache-2.0) | Qwen2.5 fine-tunes (1.5B, 7B, 14B "flagship") run locally (Ollama / llama.cpp); the mod asks for a level and places the objects in the editor | the most serious one; no training-data description or quality evaluation published; last model update ~June 2026 |
| GD-Level-Generator (same author, MIT) | an LLM writes a text format, Python turns it into a .gdr for GDShare | discontinued, replaced by EditorAI |
| DashAI (jarvisdevlin) | an LLM writes level data and injects it into the editor through the WSLiveEditor mod | 5 commits, 0 stars |
| AI-level-maker (gdSkypulse) | a Gemini web app (AI Studio template) | 3 commits, 0 stars |
| glif "Geometry Dash Level Generator" workflow, a "GD Level AI Assistant" app, a YouTube "I made an AI level generator" video | prompt-to-level toys | not inspected in detail (video page could not be read) |
| Research papers | PCGRL and other procedural-generation work exist for games in general; none found on Geometry Dash (arXiv 2510.15120 is a Unity game, not GD) | -- |

How we differ: a tick-level 2.2 physics sim checked against the real game (probe mod, recordings), a solver and human
route on every level, beat-first building from the song's measured hits, verified bricks mined from real levels, a
difficulty model fitted on real runs, a fairness model, taste learned from ~330 rated levels, and the user's playtests
fed back as soft rules. As far as this search shows, no public project does the solve / sync / check part.
The search was a few queries, not exhaustive: Discord-only or non-English projects may exist.

## Open

- Fetch GDDL's sheet (or a page per demon) into local/ and add its tiers to the difficulty fit as a target.
- Read api.aredl.net's raw spec (the docs page needs JavaScript).
- Try the HF dataset's 2026 rated subset as the taste and brick-mining corpus (size first: ~19 GB).
- Try EditorAI once to see what it produces, as a baseline for QUALITY.md.
