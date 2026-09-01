import { applyEventOutcome, addCard, removeCard, type OutcomeReport } from '../game/run.js';
import type { EventDef } from '../content/events.js';
import type { App, View } from '../ui/app.js';
import { createCardList, createCardPicker, createMenu } from './common.js';

/**
 * Events.
 *
 * Two screens: the choice, then the receipt. Showing exactly what an option did
 * — in plain numbers — is what keeps a random event from feeling arbitrary.
 */
export function createEventView(event: EventDef, onLeave: (app: App) => void): View {
  return createMenu({
    id: `event:${event.id}`,
    title: event.title,
    body: [...event.body, ''],
    items: event.options.map((opt) => ({
      label: opt.label,
      detail: opt.detail,
      onSelect: (app: App) => {
        const run = app.run;
        if (!run) return;
        const report = applyEventOutcome(run, app.rng, opt.outcome);
        resolvePending(app, report, () => {
          app.replace(createReceipt(event, report, onLeave));
        });
      },
    })),
    hints: [['↑↓', 'consider'], ['↵', 'choose']],
  });
}

/** Walks the queue of things the UI must ask the player about. */
export function resolvePending(app: App, report: OutcomeReport, done: () => void): void {
  const next = report.pending.shift();
  if (!next) { done(); return; }

  if (next === 'remove-card') {
    const run = app.run;
    if (!run || run.deck.length <= 4) { report.lines.push('deck too small to thin'); resolvePending(app, report, done); return; }
    app.push(createCardList({
      id: 'event-remove',
      title: 'Remove a card',
      prompt: 'Gone for the rest of the run.',
      cards: run.deck,
      actionLabel: 'remove',
      onPick: (a, card) => {
        removeCard(run, card.uid);
        report.lines.push('removed a card');
        a.pop();
        resolvePending(a, report, done);
      },
      onCancel: (a) => { a.pop(); resolvePending(a, report, done); },
    }));
    return;
  }

  const choices = report.cardChoices ?? [];
  if (choices.length === 0) { resolvePending(app, report, done); return; }
  app.push(createCardPicker({
    id: 'event-card',
    title: 'Take a card',
    cards: choices,
    skipLabel: 'take nothing',
    onPick: (a, card) => {
      const run = a.run;
      if (run && card) { addCard(run, card); report.lines.push(`took ${card.defId}`); }
      a.pop();
      resolvePending(a, report, done);
    },
  }));
}

function createReceipt(event: EventDef, report: OutcomeReport, onLeave: (app: App) => void): View {
  return createMenu({
    id: 'event-receipt',
    title: event.title,
    body: report.lines.length > 0 ? report.lines.map((l) => `${l}`) : ['nothing happens'],
    items: [{ label: 'Move on', onSelect: (a) => onLeave(a) }],
    hints: [['↵', 'continue']],
  });
}
