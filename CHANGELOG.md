# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-09-01

### Added
- **Three characters.** The Warden (86 HP, outlasts), The Archivist (78 HP, the
  chain engine) and The Kindler (72 HP, ember aggression), each with its own
  ten-card starting deck, starting relic and two signature rares. Character
  select is now the first choice of every run; `--character` skips it.
- **Three bosses per act instead of one**, drawn at random: The Quiet Twins and
  The First Reader join The Hollow Bell; The Rendering Press and The Choirmaster
  join The Grammar; The Unwritten and The Margin & The Gloss join GLYPH ZERO.
- **Run scoring** with a full breakdown on the results screen, a lifetime best in
  your records, and a one-line summary built to be pasted — `y` copies it.
- Six more events (18 total), two more act-3 encounters and two more elites.
- Enemies gain a point of Strength each round from turn five, so a fight cannot
  be won by blocking forever.
- Damage numbers land on the enemy that took them, and a won fight gets a beat
  before the reward screen.
- Ending a turn with unspent energy and a playable card asks once first.

### Changed
- Save format version 2 — earlier saves are discarded rather than migrated.
- First Link now also draws a card whenever your chain reaches 4.

## [0.1.0] — 2026-09-01

First release.

### Added
- **The chain.** Matching a card's suit to the previous card played this turn
  grows a chain; every point adds +1 to each instance of damage or block.
- A three-act run over branching, seeded maps with combat, elite, treasure,
  shop, rest, event and boss nodes.
- 53 cards across five suits, 19 enemies in 28 hand-authored encounters,
  25 relics, 12 events and 7 draughts.
- Seeded runs (`--seed`), a shared daily run (`--daily`), and a difficulty
  ladder (`--depth 0..20`).
- Mid-run saving that resumes *into* the fight you quit during, plus a lifetime
  records profile.
- A terminal renderer with double-buffered diffing, live resize, truecolor →
  256 → 16 → none degradation, and a full ASCII mode (`--ascii`).
- A headless autoplayer used to measure balance, and `scripts/balance.mjs`,
  which fails CI if the game becomes unwinnable or trivial.
- `scripts/preview.mjs`, which renders any screen as plain text at any size.
- The enemy phase resolves one enemy at a time with a beat between actions, the
  acting enemy highlighted and the damage taken shown next to your health.
  Resolving a whole round in one frame meant players could not see what hit
  them.
- Light and dark palettes (`--light` / `--dark`, or a toggle on the title screen
  that is remembered). The game paints its own background rather than
  inheriting the terminal's, so text can never end up white-on-white; contrast
  tests hold every character to a minimum ratio in both appearances.

[0.2.0]: https://github.com/Lang-Julian/glyphfall/releases/tag/v0.2.0
[0.1.0]: https://github.com/Lang-Julian/glyphfall/releases/tag/v0.1.0
