import { canUpgrade } from '../content/cards.js';
import { heal, restHealAmount, upgradableCards } from '../game/run.js';
import type { App, View } from '../ui/app.js';
import { createCardList, createMenu } from './common.js';

/**
 * Rest sites. Two real options, and the choice is genuinely close: HP now, or a
 * permanently better card for the rest of the run.
 */
export function createRestView(onLeave: (app: App) => void): View {
  return {
    id: 'rest',
    render(app) {
      // Rest is a pure menu, so it delegates rendering to one.
      restMenu(app, onLeave).render(app);
    },
    onKey(app, key) {
      restMenu(app, onLeave).onKey(app, key);
    },
  };
}

function restMenu(app: App, onLeave: (app: App) => void): View {
  const run = app.run;
  const healAmount = run ? restHealAmount(run) : 0;
  const canUp = run ? upgradableCards(run).length > 0 : false;

  return createMenu({
    id: 'restmenu',
    title: 'Rest site',
    subtitle: 'A cold hearth, a bedroll, and a whetstone. Pick one.',
    items: [
      {
        label: `Sleep  (heal ${healAmount} HP)`,
        detail: healAmount > 0
          ? `You are at ${run?.hp}/${run?.maxHp}.`
          : 'Something you carry has made rest useless.',
        disabled: healAmount === 0 || (run ? run.hp >= run.maxHp : true),
        onSelect: (a) => {
          const r = a.run;
          if (!r) return;
          const gained = heal(r, healAmount);
          a.toast(`Healed ${gained} HP.`);
          onLeave(a);
        },
      },
      {
        label: 'Forge  (upgrade one card, permanently)',
        detail: canUp ? 'Upgrades last for the whole run.' : 'Every card is already upgraded.',
        disabled: !canUp,
        onSelect: (a) => {
          const r = a.run;
          if (!r) return;
          a.push(createCardList({
            id: 'upgrade',
            title: 'Upgrade a card',
            prompt: 'Pick the card to sharpen.',
            cards: r.deck.filter(canUpgrade),
            actionLabel: 'upgrade',
            onPick: (b, card) => {
              card.upgrades++;
              b.pop();
              b.toast('Upgraded.');
              onLeave(b);
            },
            onCancel: (b) => b.pop(),
          }));
        },
      },
      {
        label: 'Move on',
        detail: 'Waste nothing, gain nothing.',
        onSelect: (a) => onLeave(a),
      },
    ],
    hints: [['↑↓', 'move'], ['↵', 'select']],
  });
}
