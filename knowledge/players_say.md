# What players say in level comments

Source: the top 60 comments (by likes) of each of the 91 rated levels in `levels/low_tier_stats.md`,
from the GDBrowser API (`node tools/community.js comments`, then `themes`), read 2026-11-22.
They are stored only in `local/community/comments/` (not committed). Here are counts and paraphrases,
not the comments themselves. These are players' opinions, not facts.

## How often each theme comes up (share of top comments, by tier)

Keyword matching, English and some Spanish. It is rough, and most top comments are jokes, greetings
and "like if..." posts.

| theme | Easy | Normal | Hard | Harder |
|---|---|---|---|---|
| sync | 0.0% | 0.0% | 0.0% | 0.0% |
| gameplay | 0.7% | 0.9% | 0.4% | 2.0% |
| design | 3.7% | 4.1% | 2.4% | 3.6% |
| music | 3.9% | 1.5% | 2.6% | 2.2% |
| too hard / should be higher | 1.1% | 0.5% | 0.3% | 1.9% |
| too easy / should be lower | 0.1% | 0.4% | 0.3% | 0.9% |
| fake | 0.1% | 0.1% | 0.1% | 0.0% |
| memory | 0.0% | 0.1% | 0.1% | 0.0% |
| nostalgia | 0.3% | 0.1% | 0.3% | 0.4% |
| a % spot | 5.1% | 2.7% | 3.2% | 5.2% |
| unfair / bad | 0.3% | 0.0% | 0.6% | 0.6% |
| flow / fun | 1.0% | 1.1% | 1.0% | 1.1% |

**What that means**: top comments rarely discuss gameplay (under 2%). Players talk about a death spot
("died at 89%") about as often as about anything else, and about design and music more than gameplay.
So likes and top comments measure popularity, not gameplay quality.

## What players complain about (paraphrased, with the level)

- **Beautiful but no real gameplay** (2.2 Legendaries Subwoofer Lullaby and Starbladesaster):
  visuals over engaging gameplay, "camera abuse", too many shaders. The most repeated criticism of
  heavily decorated levels.
- **Rated too low after a late spike** (Kappaclysm, Harder): an easy start, then very hard after
  ~60%; many say it should be Insane or a demon. Magmatic Sanctuary gets the same "should be Insane".
- **Annoying parts** (named as such, often in "like if" form):
  - random speed changes (Magmatic Sanctuary);
  - a long mini wave;
  - a UFO switching gravity three times in a row;
  - a short dual-ship part and the second ship/UFO part (Kappaclysm);
  - the ship being hard on mobile;
  - flappy-style UFO for a whole level (flappy hexagon: "fun but annoying");
  - Mind Control called a memory level and annoying.
- **Readability**: in Spacestation, saws were taken for yellow orbs.
- **Easy levels with little to do**: Spacestation is praised as "a 2-star with actual gameplay",
  meaning many low-star levels have almost none. Players do want real gameplay at Easy.

## For GDLM

- Gameplay first, decoration second: the strongest complaint about top-rated levels is gameplay
  neglected for visuals.
- Keep the difficulty even across the level. A late spike makes the rating feel wrong.
- Avoid: random-feeling speed changes, rapid gravity flips, long mini wave, short dual parts, and
  hazards that look like orbs or pads.
- An Easy level should still have real gameplay (a press every second or two, not autoplay with deco).
