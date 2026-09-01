# Contributing

Thanks for looking. This is a small, deliberately dependency-free codebase; the
fastest way in is to add a card.

## Setup

```sh
npm ci
npm run build
./play          # or: node dist/cli.js
npm test
```

Node 20 or newer. There is nothing else to install.

## Adding a card

Cards are data. Open `src/content/cards.ts` and add an entry:

```ts
def({
  id: 'kindle', name: 'Kindle', suit: 'ember', type: 'skill', rarity: 'common',
  cost: 1, target: 'enemy', text: 'Apply {burn} Burn.',
  vars: { burn: 5 }, upgrade: { burn: 8 },
  effects: [{ kind: 'status', who: 'target', status: 'burn', amount: 'burn' }],
}),
```

* `text` is templated from `vars`, so the printed numbers can never drift from the
  numbers the engine uses. `npm test` fails if a placeholder has no matching var.
* `upgrade` lists the *upgraded* values, not the deltas.
* `effects` are plain data resolved by `src/game/combat.ts`. If you need a new
  kind, add it to the `Effect` union in `src/core/types.ts` and handle it in
  `resolveEffect` — and in `previewCard`, or the card will lie to the player
  about what it does.
* Powers reuse the relic hook system: give the card a `power: [...]` array.

Then run:

```sh
node dist/cli.js --check      # validates every id and template
npm test
node scripts/balance.mjs 200  # did it break the difficulty curve?
```

## The rule that everything hangs on

Suits exist for the chain, and the chain is the game. Before adding anything,
ask what it does to the *ordering* decision. A card that is equally good in any
position is usually a card this game does not need.

## Balance

Difficulty is measured, not guessed. `src/game/autoplay.ts` plays runs headlessly
with a beam search over card orderings and reports win rates per depth:

```sh
node scripts/balance.mjs 300 5
```

At depth 0 the autoplayer should land somewhere around 15–20%. Much higher and
the game is a formality; much lower and it is punishing for a human, who plays
the meta-game far better than the bot does. CI fails the build outside that
envelope.

## Screens

Every screen is a `View` — a `render` and an `onKey`. They draw into a
double-buffered `Screen` and never touch stdout directly. To see one without a
terminal:

```sh
node scripts/preview.mjs 100 30 combat
node scripts/preview.mjs 80 24 map
```

Check any layout change at **80×24** as well as wide, and with `--ascii`.

Two hard rules for anything drawn:

1. **Single-width characters only.** Latin-1, Arrows, Math Operators, Box
   Drawing, Block Elements, Geometric Shapes. Pictographs like `⛓` or `⚙`
   render double-width in some terminals and shear the whole grid.
2. **Every glyph needs an ASCII twin** in `src/ui/theme.ts` for `--ascii`.

## Style

* TypeScript, `strict`, no `any`, no runtime dependencies.
* Comments explain *why*, not *what*. If a number was chosen for a reason, the
  reason belongs next to it.
* Keep the engine free of rendering and the views free of rules.
