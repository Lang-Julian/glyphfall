```
 █████  ██      ██   ██ ██████  ██   ██ ███████   ███   ██      ██
██      ██       ██ ██  ██   ██ ██   ██ ██       ██ ██  ██      ██
██  ███ ██        ███   ██████  ███████ █████   ███████ ██      ██
██   ██ ██         ██   ██      ██   ██ ██      ██   ██ ██      ██
 █████  ███████    ██   ██      ██   ██ ██      ██   ██ ███████ ███████
```

**A roguelike deckbuilder that lives in your terminal — about the order you do things in.**

[![ci](https://github.com/Lang-Julian/glyphfall/actions/workflows/ci.yml/badge.svg)](https://github.com/Lang-Julian/glyphfall/actions/workflows/ci.yml)
&nbsp;·&nbsp; MIT &nbsp;·&nbsp; zero runtime dependencies &nbsp;·&nbsp; Node ≥ 20

---

## Play

```sh
npx glyphfall
```

That is the whole install. No global package, no config, no account.

<details>
<summary>Other ways</summary>

```sh
npm install -g glyphfall && glyphfall   # keep it around
git clone https://github.com/Lang-Julian/glyphfall && cd glyphfall && ./play
```

`./play` installs, builds and launches in one step, and is safe to re-run.
</details>

---

## The one rule

Every card carries a **suit**: `◆ EMBER` `▲ FROST` `● VOID` `■ IRON` `◉ PRISM`.

> Play a card whose suit **matches the previous card you played this turn** and your
> **CHAIN** grows by one. Break the match and the chain collapses to zero.
> **Every point of chain adds +1 to each instance of damage or block a card produces.**

That single rule is the whole game. It means:

| | at chain 0 | at chain 4 |
|---|---|---|
| `Deal 7 damage` | 7 | **11** |
| `Deal 3 damage twice` | 6 | **14** |

So a 0-cost, 4-damage card is not filler — it is a *link*. A big single-hit finisher wants
to come last. A multi-hit card is worthless cold and terrifying hot. **The interesting
decision every turn is the order of your hand, not its contents** — and every card, relic
and enemy in the game is designed to pull on that one thread.

`◉ PRISM` cards match everything and never break a chain. `Resolve` and a few relics let
you start a turn with the chain already running.

**Block** works the way it does in every deckbuilder and trips up everyone the first
time: it soaks damage during the enemy's turn and then **clears at the start of your
next one**. It is meant to be spent. Gain exactly as much as the telegraphed attack
needs and put the rest of your energy into killing things — the screen shows the
incoming total and how much of it gets through, so you never have to guess.

---

## What it looks like

```
 GLYPHFALL  Act 1/3 · The Upper Shelves           ∞ ∞ ◆  hp 61/78  ¤ 264  floor 2
                                    Moth & Wisp

        Ledger Moth                 Cinder Hound                 Glass Wisp
          \  ^  /                      /\_/\                        ***
           \/|\/                      ( >.< )                      * o *
           /\|/\                       \___/                        ***
          /  v  \                      /] [\                         |
    █████████░░░░ 23/32         █████████████ 15/15         █████████████ 18/18
    attacks 5 · blocks 6             attacks 6                   attacks 5
                                                                  Thorns 3



────────────────────────────────────────────────────────────────────────────────────
 hp ███████████░░░ 61/78  ◇ ██░ 2   CHAIN █░░░░░░░░ +1  ◆               incoming 16
                                               turn 1  ·  8 to draw  ·  1 discarded
 ▲ Ward  1e  Gain 6 block.                                         breaks the chain
     ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
     │1          ▲│ │1         »◉│ │1          ■│ │1          ▲│ │1         »◆│
     │    Ward    │ │Prism Shard │ │   Temper   │ │ Hoarfrost  │ │   Flare+   │
    ▌│Gain 6      │▐│Deal 8      │ │Gain 1      │ │Gain 4      │ │Deal 14     │   2›
     │block.      │ │damage.…    │ │Strength an…│ │block, plus…│ │damage.     │
     └──── 1 ─────┘ └──── 2 ─────┘ └──── 3 ─────┘ └──── 4 ─────┘ └──── 5 ─────┘
 You play Strike.  chain 1
  ←→  card   ↑↓  target   ↵  play   e  end turn   d  inspect   p  draught
```

Everything you need to plan a turn is on one screen: incoming damage, the chain meter,
which cards continue the chain (`»`), and one dedicated row spelling out exactly what the
highlighted card will do **after** strength, weakness, vulnerability and the chain bonus.
Nothing is hidden except the enemy's move *after* the one it has already told you about.

When you end your turn, the enemies act **one at a time, with a beat between them** —
the acting enemy is highlighted, the damage you take is spelled out next to your health,
and the log says what happened. A whole round resolving in a single frame is how a
turn-based game ends up feeling like it is cheating.

---

## Controls

| | |
|---|---|
| `←` `→` or `h` `l` | pick a card |
| `↑` `↓` or `k` `j` | pick a target |
| `↵` / `space` | play it |
| `1`–`9` | play that card directly |
| `e` | end turn |
| `d` | inspect the highlighted card |
| `p` | drink a draught |
| `v` | look through your piles |
| `c` / `r` | your deck / your relics (on the map) |
| `?` | how the chain works |
| `q` | pause, save, quit |

Arrow keys and vim keys both work everywhere. `Ctrl-C` saves and exits cleanly.

---

## The run

Three acts. Each is a branching map you climb once, ending in a boss.

| | |
|---|---|
| `†` combat | a card reward and gold |
| `‡` elite | harder, always drops a relic |
| `◈` treasure | a free relic, no fight |
| `$` shop | buy cards, relics, draughts — **or pay to delete a card** |
| `∩` rest | heal 30%, or permanently upgrade one card |
| `?` unknown | a choice with a price attached |
| `Ø` boss | beat it to descend |

Every act guarantees an easy opening fight, a treasure, and a rest before the boss, so a
run is never decided by a map roll. Clearing an act grants max HP, a heal and a free
upgrade — the one thing that keeps pace with the enemies.

**A shorter deck is a stronger deck.** Deleting a card at a shop is often worth more than
buying one, and "take nothing" is a real option on every card reward.

---

## Seeds, dailies and difficulty

```sh
glyphfall --seed ember-lantern-412   # any text works; same seed, same run
glyphfall --daily                    # today's run, identical for everyone
glyphfall --depth 4                  # +28% enemy HP, -16 max HP
glyphfall --continue                 # resume the saved run
glyphfall --light                    # colours for a light terminal
```

Every random decision in a run — the map, shop stock, enemy moves, card offers — flows
through one seeded generator, so a seed replays a run exactly. That is also how the test
suite pins the game down.

Quitting mid-fight is safe: the run is saved at the start of the floor you are on, and
`--continue` puts you back **into that fight**, not past it.

---

## It runs where you run

| | |
|---|---|
| **Light or dark** | the game paints its own background rather than inheriting your terminal's, so text can never come out white-on-white. `--light` / `--dark`, or toggle it from the title screen and it is remembered |
| **Colour** | truecolor → 256 → 16 → none, detected automatically; honours `NO_COLOR` and `FORCE_COLOR` |
| **Unicode** | `--ascii` redraws everything with `+ - \|`; only single-width characters are ever used, so no glyph can shear the grid |
| **Size** | 78×22 minimum, laid out from a fixed budget so nothing ever overlaps or clips; resizes live |
| **Motion** | `--no-anim` for a completely still screen |
| **Your files** | one save and one profile in `~/.local/share/glyphfall` (`--where` prints the path); nothing leaves your machine |

```sh
glyphfall --stats    # your records
glyphfall --check    # validate the content tables
glyphfall --help
```

---

## What's in it

**53 cards** · **19 enemies** in **28 hand-authored encounters** · **25 relics** ·
**12 events** · **7 draughts** · **3 acts**, **3 bosses**, **6 elites** ·
**0 runtime dependencies**.

Every count above is asserted by the test suite, along with the shape of the content:
each suit has enough commons to build around, each act has a soft opener and a boss,
encounters get harder as the act goes on, and boss HP climbs act over act.

---

## How the balance was set

Guessing at difficulty is how roguelikes end up unwinnable. `src/game/autoplay.ts` is a
headless player that plans each turn with a beam search over card orderings — roughly the
standard of someone on their tenth run:

```sh
node scripts/balance.mjs 300
```

```
depth   win%   median floor   reached act 3   avg best chain
    0   16.7             25             73%              7.1
    1   15.8             22             53%              6.7
    2    7.5             18             46%              6.5
    3    7.5             18             42%              6.3
    4    3.3             18             25%              6.2
```

It runs in CI and fails the build if the game becomes unwinnable, trivial, or if act 1
starts killing people. It found real problems during development: three-enemy packs
appearing on floor two, and an act-2 difficulty cliff that no amount of playtesting
intuition had flagged.

---

## Building on it

The engine is exported separately from the interface, so the rules can be driven
headlessly — by tests, by a balance sweep, or by a different front end entirely.

```js
import { startCombat, playCard, previewCard, makeCard } from 'glyphfall';

const combat = startCombat({
  deck: ['strike', 'strike', 'cinder-jab'].map((id) => makeCard(id)),
  hp: 78, maxHp: 78, relics: ['first-link'],
  enemyIds: ['ashling'], tier: 'normal',
  encounterName: 'Ashling', seed: 'demo',
});

previewCard(combat, 0, 0); // { damage: 7, chainAfter: 1, breaks: false }
```

| | |
|---|---|
| `src/core` | seeded RNG, shared types |
| `src/content` | cards, enemies, relics, events, draughts — pure data |
| `src/game` | combat rules, map generation, run state, the autoplayer |
| `src/ui` | terminal control, double-buffered screen, theme, widgets |
| `src/views` | one file per screen, plus `flow.ts` — every transition in one place |

Combat is a reducer over serialisable state: effects are data, not closures. That is what
lets a run save mid-fight, lets the tests assert exact numbers, and lets the autoplayer
clone a fight and explore it.

```sh
npm test                      # 100+ tests, no network, no fixtures
npm run typecheck
node scripts/preview.mjs 100 30 combat   # render any screen as plain text
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add a card.

---

## Licence

MIT © Julian Lang
