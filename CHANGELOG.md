# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

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
- Light and dark palettes (`--light` / `--dark`, or a toggle on the title screen
  that is remembered). The game paints its own background rather than
  inheriting the terminal's, so text can never end up white-on-white; contrast
  tests hold every character to a minimum ratio in both appearances.

[0.1.0]: https://github.com/Lang-Julian/glyphfall/releases/tag/v0.1.0
