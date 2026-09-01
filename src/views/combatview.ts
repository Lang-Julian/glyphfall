import { cardDef, cardName, describeCard } from '../content/cards.js';
import { draughtDef } from '../content/draughts.js';
import { enemyDef } from '../content/enemies.js';
import { relicDef } from '../content/relics.js';
import { STATUSES } from '../content/statuses.js';
import {
  MAX_CHAIN, canPlay, displayIntent, endTurn, incomingDamage, livingEnemies,
  playCard, previewCard, useDraughtEffects, wouldChain,
  type CombatState, type EnemyState,
} from '../game/combat.js';
import type { App, View } from '../ui/app.js';
import { drawBottomBar, drawTopBar } from '../ui/app.js';
import {
  CARD_H_FULL, CARD_H_MID, CARD_H_SMALL, CARD_W, box, drawCard, drawChain, gauge,
  putStatuses, truncate, wrap,
} from '../ui/draw.js';
import { BOLD, REVERSE, SUIT_GLYPH, sgr, type ColorName } from '../ui/theme.js';
import { createMenu } from './common.js';
import type { Intent } from '../core/types.js';

/**
 * The combat screen.
 *
 * Everything needed to plan a turn is visible at once: incoming damage, the
 * chain meter, which cards continue the chain, and — on one dedicated row —
 * exactly what the highlighted card will do after every modifier. Nothing is
 * hidden except the enemy's move *after* the one it has already telegraphed.
 *
 * The layout is budgeted from the bottom up so it survives an 80x24 terminal
 * without any element ever overlapping another.
 */

interface Layout {
  enemyTop: number;
  enemyRows: number;
  ruleY: number;
  playerY: number;
  detailY: number;
  handY: number;
  handRows: number;
  logY: number;
  logRows: number;
}

/**
 * Budgets the screen from the bottom up.
 *
 * Key bar, log, hand, card detail and player bar each have a fixed height for a
 * given terminal size; whatever is left over goes to the enemy area, the only
 * region that looks better with slack in it. Nothing overlaps and nothing
 * clips, from 78x22 upward.
 */
function layout(width: number, height: number): Layout {
  const handRows = height >= 31 ? CARD_H_FULL : height >= 27 ? CARD_H_MID : CARD_H_SMALL;
  // One line of log by default. A scrolling wall of text is the loudest thing
  // on a combat screen and the least useful.
  const logRows = height >= 34 ? 3 : height >= 29 ? 2 : 1;
  const fixed = 2 /* top bar + encounter line */ + 1 /* rule */ + 2 /* player */ +
                1 /* card detail */ + handRows + 1 /* key bar */;
  const enemyTop = 2;
  const enemyRows = Math.max(6, height - fixed - logRows);
  const ruleY = enemyTop + enemyRows;
  const playerY = ruleY + 1;
  const detailY = playerY + 2;
  const handY = detailY + 1;
  const logY = handY + handRows;
  return { enemyTop, enemyRows, ruleY, playerY, detailY, handY, handRows, logY, logRows };
}

export interface CombatViewOptions {
  onWin(app: App): void;
  onLose(app: App): void;
}

export function createCombatView(o: CombatViewOptions): View {
  let cardIndex = 0;
  let target = 0;
  let resolved = false;

  const clampSelection = (c: CombatState) => {
    cardIndex = c.hand.length === 0 ? 0 : Math.max(0, Math.min(c.hand.length - 1, cardIndex));
    const alive = livingEnemies(c);
    if (alive.length > 0 && (c.enemies[target]?.hp ?? 0) <= 0) {
      target = c.enemies.indexOf(alive[0]!);
    }
  };

  const settle = (app: App, c: CombatState) => {
    if (resolved || !c.over) return;
    resolved = true;
    if (c.over === 'win') o.onWin(app);
    else o.onLose(app);
  };

  const play = (app: App, c: CombatState, idx: number, tgt: number) => {
    const check = canPlay(c, idx);
    if (!check.ok) { app.toast(check.reason ?? 'Cannot play that.'); return; }
    playCard(c, idx, tgt);
    if (cardIndex >= c.hand.length) cardIndex = Math.max(0, c.hand.length - 1);
    const run = app.run;
    if (run) {
      run.stats.cardsPlayed++;
      run.stats.bestChain = Math.max(run.stats.bestChain, c.maxChainThisCombat);
    }
    settle(app, c);
  };

  return {
    id: 'combat',

    render(app) {
      const c = app.combat;
      if (!c) return;
      clampSelection(c);
      const { screen: s, theme: t } = app;
      const L = layout(s.width, s.height);

      drawTopBar(app);
      drawEncounterLine(app, c);
      drawEnemies(app, c, L, target, cardIndex);
      s.put(0, L.ruleY, t.glyph('h').repeat(s.width), t.fg('borderDim'));
      drawPlayerBar(app, c, L.playerY);
      drawSelectedCard(app, c, L.detailY, cardIndex, target);
      drawHand(app, c, L.handY, L.handRows, cardIndex);
      drawLog(app, c, L.logY, L.logRows);

      // Drop the least important hints rather than letting the bar clip.
      const hints: (readonly [string, string])[] = [
        ['←→', 'card'], ['↑↓', 'target'], ['↵', 'play'], ['e', 'end turn'],
        ['d', 'inspect'], ['p', 'draught'], ['v', 'piles'], ['?', 'help'],
      ];
      drawBottomBar(app, s.width >= 94 ? hints : hints.slice(0, s.width >= 82 ? 6 : 4));
    },

    onKey(app, key) {
      const c = app.combat;
      if (!c) return;
      if (c.over) { settle(app, c); return; }
      clampSelection(c);
      const n = Number(key.name);

      switch (key.name) {
        case 'left': case 'h':
          if (c.hand.length > 0) cardIndex = (cardIndex - 1 + c.hand.length) % c.hand.length;
          break;
        case 'right': case 'l':
          if (c.hand.length > 0) cardIndex = (cardIndex + 1) % c.hand.length;
          break;
        case 'up': case 'k': target = cycleTarget(c, target, -1); break;
        case 'down': case 'j': case 'tab': target = cycleTarget(c, target, 1); break;
        case 'enter': case 'space': play(app, c, cardIndex, target); break;
        case 'e':
          endTurn(c);
          cardIndex = 0;
          settle(app, c);
          break;
        case 'd': openInspect(app, c, cardIndex, target); break;
        case 'p': openDraughts(app, c, target); break;
        case 'v': openPiles(app, c); break;
        case '?': app.push(createCombatHelp()); break;
        case 'q': case 'escape': openPause(app); break;
        default:
          if (Number.isInteger(n) && n >= 1 && n <= 9 && n <= c.hand.length) {
            cardIndex = n - 1;
            play(app, c, cardIndex, target);
          }
      }
    },
  };
}

/* ------------------------------------------------------------------ pieces -- */

function cycleTarget(c: CombatState, current: number, delta: number): number {
  const alive = livingEnemies(c);
  if (alive.length === 0) return current;
  const idx = alive.findIndex((e) => c.enemies.indexOf(e) === current);
  const next = alive[(Math.max(0, idx) + delta + alive.length) % alive.length]!;
  return c.enemies.indexOf(next);
}

/** One quiet line naming the fight. Relics live as sigils in the header. */
function drawEncounterLine(app: App, c: CombatState): void {
  const { screen: s, theme: t } = app;
  s.putCenter(0, s.width, 1, c.encounterName, sgr(t.fg('dim'), BOLD));
}

function drawEnemies(
  app: App, c: CombatState, L: Layout, target: number, cardIndex: number,
): void {
  const { screen: s, theme: t } = app;
  const slotW = Math.floor(s.width / Math.max(1, c.enemies.length));
  const preview = previewCard(c, cardIndex, target);
  // Nine rows of content; anything spare pads the top so the art sits centred.
  const pad = Math.max(0, Math.floor((L.enemyRows - 9) / 2));
  const row = (n: number) => L.enemyTop + pad + n;

  c.enemies.forEach((en, i) => {
    const x = i * slotW;
    const isTarget = i === target;
    const dead = en.hp <= 0;
    const d = enemyDef(en.defId);
    const flash = (c.fx.hitEnemy[en.id] ?? 0) > 0;

    const name = truncate(dead ? `${en.name} — down` : en.name, slotW - 4);
    const nameStyle = dead ? t.fg('faint')
      : flash ? sgr(t.fg('invert'), t.bg('bad'), BOLD)
      : isTarget ? sgr(t.fg('title'), REVERSE, BOLD)
      : t.fg('text');
    s.putCenter(x, slotW, row(0), isTarget && !dead ? ` ${name} ` : name, nameStyle);

    if (dead) return;

    d.art.forEach((line, j) => {
      s.putCenter(x, slotW, row(1 + j), line, flash ? t.fg('bad') : t.fg(tierColor(d.tier)));
    });

    const label = `${en.hp}/${en.maxHp}`;
    const barW = Math.max(6, Math.min(slotW - 10 - label.length, 16));
    const bx = x + Math.floor((slotW - (barW + 1 + label.length)) / 2);
    gauge(s, t, bx, row(5), barW, en.hp, en.maxHp, 'hp', label);
    if (en.block > 0) s.put(bx - 4, row(5), `${t.glyph('shield')}${en.block}`, sgr(t.fg('block'), BOLD));

    const intent = displayIntent(c, en);
    s.putCenter(x, slotW, row(6), truncate(intentText(intent), slotW - 2), intentStyle(app, intent));

    const statuses = Object.entries(en.statuses)
      .map(([id, n]) => {
        const def = STATUSES[id as keyof typeof STATUSES];
        return def ? `${def.glyph} ${n}` : '';
      })
      .filter(Boolean)
      .join('  ');
    s.putCenter(x, slotW, row(7), truncate(statuses, slotW - 2), t.fg('warn'));

    if (isTarget && preview?.damage !== undefined) {
      const hits = preview.hits && preview.hits > 1 ? ` x${preview.hits}` : '';
      const total = preview.damage * (preview.hits ?? 1);
      const willKill = total >= en.hp + en.block;
      s.putCenter(x, slotW, row(8),
        `${t.glyph('arrow')} ${preview.damage}${hits}${hits ? ` = ${total}` : ''}${willKill ? '  lethal' : ''}`,
        sgr(t.fg(willKill ? 'good' : 'ember'), BOLD));
    }
  });
}

function tierColor(tier: string): ColorName {
  return tier === 'boss' ? 'bad' : tier === 'elite' ? 'warn' : 'iron';
}

/** Intents read as short sentences: a number alone is ambiguous. */
function intentText(intent: Intent | null): string {
  if (!intent) return '';
  if (intent.kind === 'stun') return 'stunned';
  const parts: string[] = [];
  if (intent.damage !== undefined) {
    const hits = intent.hits && intent.hits > 1 ? ` x${intent.hits}` : '';
    parts.push(`attacks ${intent.damage}${hits}`);
  }
  if (intent.block !== undefined) parts.push(`blocks ${intent.block}`);
  if (parts.length === 0) {
    if (intent.kind === 'buff') parts.push('empowers itself');
    else if (intent.kind === 'debuff') parts.push('weakens you');
  }
  if (intent.note) parts.push(intent.note);
  return parts.join(' · ');
}

function intentStyle(app: App, intent: Intent | null): string {
  const t = app.theme;
  if (!intent) return t.fg('dim');
  switch (intent.kind) {
    case 'attack': case 'attack-block': return sgr(t.fg('bad'), BOLD);
    case 'block': return t.fg('block');
    case 'buff': return t.fg('warn');
    case 'debuff': return t.fg('void');
    default: return t.fg('dim');
  }
}

function drawPlayerBar(app: App, c: CombatState, y: number): void {
  const { screen: s, theme: t } = app;
  const p = c.player;
  const low = p.hp / p.maxHp <= 0.3;

  let x = s.put(1, y, 'hp ', t.fg(low ? 'hpLow' : 'hp'));
  x = gauge(s, t, x, y, 14, p.hp, p.maxHp, low ? 'hpLow' : 'hp', `${p.hp}/${p.maxHp}`) + 2;

  if (p.block > 0) x = s.put(x, y, `${t.glyph('shield')} ${p.block}  `, sgr(t.fg('block'), BOLD));

  x = s.put(x, y, `${t.glyph('bolt')} `, t.fg('energy'));
  for (let i = 0; i < Math.max(c.energyPerTurn, c.energy); i++) {
    const lit = i < c.energy;
    x = s.put(x, y, lit ? t.glyph('full') : t.glyph('shade-l'),
      lit ? sgr(t.fg('energy'), BOLD) : t.fg('shade'));
  }
  x = s.put(x, y, ` ${c.energy}   `, sgr(t.fg('energy'), BOLD));

  const chainEnd = drawChain(s, t, x, y, c.chain, MAX_CHAIN, c.lastSuit);
  if (c.fx.chainPulse > 0) s.tint(x, y, chainEnd - x, sgr(t.fg('invert'), t.bg('chain'), BOLD));

  putStatuses(s, t, 1, y + 1, Math.floor(s.width * 0.6), p);

  const incoming = incomingDamage(c);
  if (incoming > 0) {
    const through = Math.max(0, incoming - p.block);
    // "You are about to die" deserves the word, not a colour a player has to
    // learn to read.
    const label = through >= p.hp
      ? `LETHAL — ${through} incoming`
      : p.block > 0
        ? `incoming ${incoming}  ${t.glyph('arrow')} ${through} through`
        : `incoming ${incoming}`;
    s.putRight(s.width - 1, y, label,
      sgr(t.fg(through >= p.hp ? 'hpLow' : through > 0 ? 'bad' : 'good'), BOLD));
  } else {
    s.putRight(s.width - 1, y, 'nothing incoming', t.fg('good'));
  }
  const counters = [`turn ${c.turn}`, `${c.draw.length} to draw`, `${c.discard.length} discarded`];
  if (c.exhaust.length > 0) counters.push(`${c.exhaust.length} exhausted`);
  s.putRight(s.width - 1, y + 1, counters.join(`  ${t.glyph('bullet')}  `), t.fg('faint'));
}

/**
 * The single most useful row on the screen: the highlighted card's full text,
 * its suit, and what the chain will be after playing it. A 14-column card has
 * to clip its text; this row never does.
 */
function drawSelectedCard(
  app: App, c: CombatState, y: number, cardIndex: number, target: number,
): void {
  const { screen: s, theme: t } = app;
  const card = c.hand[cardIndex];
  if (!card) {
    s.putCenter(0, s.width, y, 'no cards in hand', t.fg('faint'));
    return;
  }
  const d = cardDef(card.defId);
  const preview = previewCard(c, cardIndex, target);

  let x = s.put(1, y, t.glyph(SUIT_GLYPH[d.suit]), t.fg(suitColorOf(d.suit)));
  x = s.put(x + 1, y, cardName(card), sgr(t.fg('title'), BOLD));
  x = s.put(x, y, `  ${d.unplayable ? 'unplayable' : `${d.cost}e`}  `, t.fg('energy'));

  const chainNote = preview
    ? preview.breaks
      ? `breaks the chain`
      : preview.chainAfter > c.chain ? `chain ${c.chain} ${t.glyph('arrow')} ${preview.chainAfter}` : ''
    : '';
  const reserve = chainNote ? chainNote.length + 3 : 1;
  s.put(x, y, truncate(describeCard(card), Math.max(0, s.width - x - reserve)), t.fg('text'));
  if (chainNote) {
    s.putRight(s.width - 1, y, chainNote,
      sgr(t.fg(preview!.breaks ? 'bad' : 'chain'), BOLD));
  }
}

function suitColorOf(suit: keyof typeof SUIT_GLYPH): ColorName {
  return ({ ember: 'ember', frost: 'frost', void: 'void', iron: 'iron', prism: 'prism' } as const)[suit];
}

function drawHand(app: App, c: CombatState, y: number, h: number, cardIndex: number): void {
  const { screen: s, theme: t } = app;
  if (c.hand.length === 0) {
    s.putCenter(0, s.width, y + Math.floor(h / 2), 'press  e  to end your turn', t.fg('faint'));
    return;
  }

  const step = CARD_W + 1;
  const fit = Math.max(1, Math.floor((s.width - 4) / step));
  const start = c.hand.length > fit
    ? Math.max(0, Math.min(c.hand.length - fit, cardIndex - Math.floor(fit / 2)))
    : 0;
  const shown = Math.min(fit, c.hand.length - start);
  const x0 = Math.max(2, Math.floor((s.width - (shown * step - 1)) / 2));

  for (let i = 0; i < shown; i++) {
    const idx = start + i;
    const card = c.hand[idx]!;
    drawCard(s, t, x0 + i * step, y, h, card, {
      selected: idx === cardIndex,
      playable: canPlay(c, idx).ok,
      hotkey: idx < 9 ? String(idx + 1) : undefined,
      chains: wouldChain(c, card),
    });
  }

  // How many cards sit off-screen in each direction.
  const mid = y + Math.floor(h / 2);
  if (start > 0) s.put(0, mid, `${t.icon('‹')}${start}`, sgr(t.fg('accent'), BOLD));
  const after = c.hand.length - start - shown;
  if (after > 0) s.putRight(s.width, mid, `${after}${t.icon('›')}`, sgr(t.fg('accent'), BOLD));
}

function drawLog(app: App, c: CombatState, y: number, h: number): void {
  const { screen: s, theme: t } = app;
  const entries = c.log.slice(-h);
  // Bottom-aligned so the newest line is always in the same place.
  const top = y + Math.max(0, h - entries.length);
  entries.forEach((entry, i) => {
    const style =
      entry.tone === 'good' ? t.fg('good') :
      entry.tone === 'bad' ? t.fg('bad') :
      entry.tone === 'player' ? t.fg('text') :
      entry.tone === 'enemy' ? t.fg('warn') : t.fg('faint');
    s.put(1, top + i, truncate(entry.text, s.width - 2), style);
  });
}

/* --------------------------------------------------------------- overlays -- */

function openInspect(app: App, c: CombatState, index: number, target: number): void {
  const card = c.hand[index];
  if (!card) return;
  const d = cardDef(card.defId);
  const preview = previewCard(c, index, target);
  const body = [
    ...wrap(describeCard(card), 60),
    '',
    `suit ${d.suit}    type ${d.type}    cost ${d.cost}    ${d.rarity}`,
    preview ? `chain after playing: ${preview.chainAfter}${preview.breaks ? '   (breaks the chain)' : ''}` : '',
    preview?.damage !== undefined
      ? `damage: ${preview.damage}${preview.hits && preview.hits > 1 ? ` x${preview.hits} = ${preview.damage * preview.hits}` : ''}`
      : '',
    preview?.block !== undefined ? `block: ${preview.block}` : '',
    d.exhaust ? 'Exhausts when played.' : '',
    d.flavour ? `"${d.flavour}"` : '',
  ].filter(Boolean);

  app.push(createMenu({
    id: 'inspect', title: cardName(card), body, overlay: true,
    items: [{ label: 'Close', onSelect: (a) => a.pop() }],
    onCancel: (a) => a.pop(),
  }));
}

function openDraughts(app: App, c: CombatState, target: number): void {
  const run = app.run;
  if (!run) return;
  if (run.draughts.length === 0) { app.toast('No draughts to drink.'); return; }

  app.push(createMenu({
    id: 'draughts', title: 'Draughts', overlay: true,
    items: run.draughts.map((id, i) => {
      const d = draughtDef(id);
      return {
        label: `${app.theme.icon(d.glyph)} ${d.name}`,
        detail: d.text,
        onSelect: (a: App) => {
          a.pop();
          const state = a.combat;
          if (!state) return;
          run.draughts.splice(i, 1);
          useDraughtEffects(state, d.effects, target);
          a.toast(`${d.name} drained.`);
        },
      };
    }),
    onCancel: (a) => a.pop(),
  }));
}

function openPiles(app: App, c: CombatState): void {
  const names = (cards: readonly { defId: string; upgrades: number }[]) =>
    cards.length === 0 ? 'empty' : cards.map((x) => cardName(x as never)).sort().join(', ');

  app.push(createMenu({
    id: 'piles', title: 'Piles', overlay: true,
    body: [
      `Draw (${c.draw.length}) — shuffled, order hidden until drawn`,
      ...wrap(names(c.draw), 62).slice(0, 3),
      '',
      `Discard (${c.discard.length})`,
      ...wrap(names(c.discard), 62).slice(0, 3),
      '',
      `Exhausted (${c.exhaust.length}) — gone for this fight`,
      ...wrap(names(c.exhaust), 62).slice(0, 2),
    ],
    items: [{ label: 'Close', onSelect: (a) => a.pop() }],
    onCancel: (a) => a.pop(),
  }));
}

function openPause(app: App): void {
  app.push(createMenu({
    id: 'pause', title: 'Paused', overlay: true,
    subtitle: 'Your run is saved at the start of this floor.',
    items: [
      { label: 'Resume', onSelect: (a) => a.pop() },
      { label: 'How the chain works', onSelect: (a) => { a.pop(); a.push(createCombatHelp()); } },
      { label: 'Save and quit', detail: 'This floor resumes next time you launch.', onSelect: (a) => a.quit() },
    ],
    onCancel: (a) => a.pop(),
  }));
}

export function createCombatHelp(): View {
  return createMenu({
    id: 'help', title: 'The Chain', overlay: true,
    body: [
      'Every card carries a suit:',
      '   ◆ EMBER    ▲ FROST    ● VOID    ■ IRON    ◉ PRISM',
      '',
      'Play a card whose suit matches the previous card you played this',
      'turn and your CHAIN grows by one. Break the match and it collapses.',
      '',
      'Every point of chain adds +1 to EACH instance of damage or block a',
      'card produces. At chain 4, "deal 3 damage twice" is 14 damage;',
      '"deal 7 damage" is 11. Multi-hit cards want long chains.',
      '',
      'A » in a card corner means playing it keeps the chain alive.',
      'PRISM cards match everything and never break a chain.',
      'The chain resets each turn unless Resolve or a relic seeds it.',
      '',
      '←→ pick card    ↑↓ pick target    ↵ play    e end turn',
      '1-9 play directly    d inspect    p draught    v piles',
    ],
    items: [{ label: 'Close', onSelect: (a) => a.pop() }],
    onCancel: (a) => a.pop(),
  });
}

export { box };
