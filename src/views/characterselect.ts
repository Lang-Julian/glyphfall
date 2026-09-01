import { CHARACTERS, type CharacterDef } from '../content/characters.js';
import { cardDef } from '../content/cards.js';
import { relicDef } from '../content/relics.js';
import type { App, View } from '../ui/app.js';
import { drawBottomBar, drawTopBar } from '../ui/app.js';
import { box, truncate, wrap } from '../ui/draw.js';
import { BOLD, REVERSE, SUIT_GLYPH, sgr, type ColorName } from '../ui/theme.js';

/**
 * Character select.
 *
 * Shows everything that actually differs between the three — health, starting
 * relic, and the exact ten cards you begin with — because "pick a class" is a
 * decision, and a decision needs its inputs on screen rather than behind a
 * wiki.
 */

const SUIT_COLOR: Record<string, ColorName> = {
  ember: 'ember', frost: 'frost', void: 'void', iron: 'iron', prism: 'prism',
};

export function createCharacterSelect(onPick: (app: App, id: string) => void): View {
  let cursor = 0;

  return {
    id: 'character-select',
    render(app) {
      const { screen: s, theme: t } = app;
      const character = CHARACTERS[cursor]!;
      s.clear();
      drawTopBar(app);

      s.putCenter(0, s.width, 1, 'Who goes down?', sgr(t.fg('title'), BOLD));

      // The three portraits, side by side.
      const slotW = Math.floor(s.width / CHARACTERS.length);
      const artTop = 3;
      CHARACTERS.forEach((c, i) => {
        const x = i * slotW;
        const active = i === cursor;
        c.art.forEach((line, j) => {
          s.putCenter(x, slotW, artTop + j, line, active ? t.fg('title') : t.fg('faint'));
        });
        s.putCenter(x, slotW, artTop + 5, active ? ` ${c.name} ` : c.name,
          active ? sgr(t.fg('title'), REVERSE, BOLD) : t.fg('dim'));
        s.putCenter(x, slotW, artTop + 6, c.title, t.fg('faint'));
      });

      // The detail panel, sized to what this character actually has to say.
      const w = Math.min(78, s.width - 6);
      const x = Math.floor((s.width - w) / 2);
      const y = artTop + 8;
      const relic = relicDef(character.startingRelic);
      const relicText = wrap(relic.text, w - 6).slice(0, 2);
      // two borders + playstyle + gap + blurb + gap + relic name + relic text
      // + gap + "starting deck" + the deck line itself
      const h = Math.min(
        s.height - y - 3,
        9 + character.blurb.length + relicText.length,
      );
      box(s, t, x, y, w, h, { title: character.name, fill: true });

      let cy = y + 1;
      s.put(x + 2, cy, character.playstyle, sgr(t.fg('accent'), BOLD));
      s.putRight(x + w - 2, cy, `${character.maxHp} HP`, sgr(t.fg('hp'), BOLD));
      cy += 2;

      for (const line of character.blurb) {
        if (cy >= y + h - 1) break;
        s.put(x + 2, cy++, truncate(line, w - 4), t.fg('dim'));
      }
      cy++;

      if (cy < y + h - 1) {
        s.put(x + 2, cy++, `${t.icon(relic.glyph)} ${relic.name}`, sgr(t.fg('accent'), BOLD));
        for (const line of relicText) {
          if (cy >= y + h - 1) break;
          s.put(x + 4, cy++, line, t.fg('dim'));
        }
        cy++;
      }

      if (cy < y + h - 1) {
        s.put(x + 2, cy++, 'starting deck', sgr(t.fg('title'), BOLD));
        if (cy < y + h - 1) drawDeck(app, character, x + 2, cy, w - 4);
      }

      drawBottomBar(app, [['←→', 'choose'], ['↵', 'descend'], ['esc', 'back']]);
    },

    onKey(app, key) {
      switch (key.name) {
        case 'left': case 'h': cursor = (cursor - 1 + CHARACTERS.length) % CHARACTERS.length; break;
        case 'right': case 'l': cursor = (cursor + 1) % CHARACTERS.length; break;
        case 'enter': case 'space': onPick(app, CHARACTERS[cursor]!.id); break;
        case 'escape': case 'q': app.pop(); break;
        default: {
          const n = Number(key.name);
          if (Number.isInteger(n) && n >= 1 && n <= CHARACTERS.length) {
            cursor = n - 1;
            onPick(app, CHARACTERS[cursor]!.id);
          }
        }
      }
    },
  };
}

/** The ten starting cards, grouped and counted rather than listed one by one. */
function drawDeck(app: App, character: CharacterDef, x: number, y: number, width: number): void {
  const { screen: s, theme: t } = app;
  const counts = new Map<string, number>();
  for (const id of character.deck) counts.set(id, (counts.get(id) ?? 0) + 1);

  let cx = x;
  for (const [id, n] of counts) {
    const d = cardDef(id);
    const label = `${t.glyph(SUIT_GLYPH[d.suit])} ${n}x ${d.name}`;
    if (cx + label.length + 3 > x + width) break;
    cx = s.put(cx, y, label, t.fg(SUIT_COLOR[d.suit] ?? 'text'));
    cx = s.put(cx, y, '   ');
  }
}
