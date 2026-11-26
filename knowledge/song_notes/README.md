# Song notes: every note, impact and the music's speed, as numbers

One file per song, `<song key>.json` (keys as local/beats: `custom_<id>`, `official_<name>`), written on the PC by
`node tools/impacts.js <song id | official:N> [--bpm B --t0 S] --commit` from the song's audio. Numbers only (onset times,
strengths, per-bar values): no audio, so they are committed and every cloud session can use them (like
viewer/song_grids.js). Song seconds and song beats (b1 = the first beat at or after 0 s); for a level with an offset,
level beat = song beat - (song beat at the offset) + 1.

Fields (tools/impacts.js `compact()`, method in SYNC.md section 9): `notes` [[t, s 0..1, "low"|"mid"|"top"]], `bars`
[[t, beat, heavy, speed (notes per beat), intensity 0..1, grain]], `impacts` [[t, beat, strength, kind]], `breaks`,
`speedPlan` [[t, beat, "0.5x".."3x", why]]. Read with `require("../tools/impacts.js").loadNotes(key)`.
