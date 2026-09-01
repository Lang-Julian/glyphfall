import { Rng } from '../core/rng.js';
import { dailySeed } from '../core/seed.js';
import { combatWinBonuses, type CombatState } from '../game/combat.js';
import {
  ACTS, advanceAct, enterNode, newRun, rngFor, syncRng, type RunState,
} from '../game/run.js';
import { clearSave, loadProfile, recordRun, saveProfile, writeSave, type Profile } from '../meta/store.js';
import { Screen } from './screen.js';
import { Terminal, type Key } from './term.js';
import { BOLD, makeTheme, sgr, type ColorLevel, type Theme } from './theme.js';
import { keyHint, setAsciiMode, truncate } from './draw.js';

/**
 * The application shell.
 *
 * Owns the terminal, the frame loop, the view stack and the run/combat
 * lifecycle. Views are dumb: they draw into a Screen and handle keys. Every
 * transition between game states goes through a method on this class, which is
 * why the flow is readable in one place instead of scattered across screens.
 */

export interface View {
  id: string;
  render(app: App): void;
  onKey(app: App, key: Key): void;
  /** Overlays paint the view underneath first. */
  overlay?: boolean;
  /** Called when this view becomes the top of the stack again. */
  onFocus?(app: App): void;
}

export interface AppOptions {
  seed: string;
  depth: number;
  ascii: boolean;
  colorLevel: ColorLevel;
  animations: boolean;
  /** Start straight into a fresh run, skipping the title screen. */
  jumpIn: boolean;
  resume: boolean;
}

export const MIN_WIDTH = 78;
export const MIN_HEIGHT = 22;

export class App {
  readonly term: Terminal;
  readonly screen: Screen;
  theme: Theme;
  profile: Profile;
  opts: AppOptions;

  run: RunState | null = null;
  rng: Rng;
  combat: CombatState | null = null;
  /** Tier of the fight currently in progress; drives reward generation. */
  combatTier: 'normal' | 'elite' | 'boss' = 'normal';

  stack: View[] = [];
  /**
   * The node currently being resolved. Saved alongside the run so quitting in
   * the middle of a fight resumes *into that fight* — without it, a resumed run
   * would land back on the map with the node already marked visited, skipping
   * the encounter entirely.
   */
  pendingNode: string | null = null;
  frame = 0;
  dirty = true;
  animating = false;
  private toastText = '';
  private toastFrames = 0;
  private timer: NodeJS.Timeout | null = null;
  private resolveExit: (() => void) | null = null;

  constructor(opts: AppOptions) {
    this.opts = opts;
    this.term = new Terminal();
    const size = this.term.size();
    this.screen = new Screen(size.width, size.height);
    this.theme = makeTheme(opts.colorLevel, !opts.ascii);
    setAsciiMode(opts.ascii);
    if (opts.ascii) this.screen.setSanitizer((ch) => this.theme.icon(ch));
    this.profile = loadProfile();
    this.rng = new Rng(opts.seed);
  }

  /* ------------------------------------------------------------- lifecycle -- */

  async start(): Promise<void> {
    this.term.start();
    this.term.setTitle('glyphfall');
    this.term.on('key', (k: Key) => this.handleKey(k));
    // Input ended (pipe closed, terminal gone): save and stop, never hang.
    this.term.on('end', () => this.quit());
    this.term.on('resize', ({ width, height }: { width: number; height: number }) => {
      this.screen.resize(width, height);
      this.screen.invalidate();
      this.dirty = true;
    });

    this.timer = setInterval(() => this.tick(), 60);
    return new Promise<void>((resolve) => { this.resolveExit = resolve; });
  }

  exit(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.term.stop();
    this.resolveExit?.();
    this.resolveExit = null;
  }

  private tick(): void {
    this.frame++;
    if (this.toastFrames > 0 && --this.toastFrames === 0) this.dirty = true;
    if (this.combat) {
      const fx = this.combat.fx;
      if (fx.shake > 0 || fx.hitPlayer > 0 || fx.chainPulse > 0 || Object.keys(fx.hitEnemy).length > 0) {
        if (this.opts.animations) this.dirty = true;
        fx.shake = Math.max(0, fx.shake - 1);
        fx.hitPlayer = Math.max(0, fx.hitPlayer - 1);
        fx.chainPulse = Math.max(0, fx.chainPulse - 1);
        for (const k of Object.keys(fx.hitEnemy)) {
          const v = (fx.hitEnemy[k] ?? 0) - 1;
          if (v <= 0) delete fx.hitEnemy[k];
          else fx.hitEnemy[k] = v;
        }
      }
    }
    if (this.animating && this.opts.animations) this.dirty = true;
    if (this.dirty) this.render();
  }

  requestRender(): void {
    this.dirty = true;
  }

  /* ----------------------------------------------------------- view stack -- */

  push(view: View): void {
    this.stack.push(view);
    view.onFocus?.(this);
    this.dirty = true;
  }

  pop(): void {
    this.stack.pop();
    this.top()?.onFocus?.(this);
    this.screen.invalidate();
    this.dirty = true;
  }

  replace(view: View): void {
    this.stack.pop();
    this.push(view);
    this.screen.invalidate();
  }

  reset(view: View): void {
    this.stack = [];
    this.push(view);
    this.screen.invalidate();
  }

  top(): View | undefined {
    return this.stack[this.stack.length - 1];
  }

  /* ---------------------------------------------------------------- render -- */

  render(): void {
    this.dirty = false;
    const { width, height } = this.term.size();
    this.screen.resize(width, height);
    this.screen.clear();

    if (width < MIN_WIDTH || height < MIN_HEIGHT) {
      this.renderTooSmall(width, height);
    } else {
      // Render the deepest non-overlay view, then every overlay above it.
      let base = this.stack.length - 1;
      while (base > 0 && this.stack[base]?.overlay) base--;
      for (let i = base; i < this.stack.length; i++) this.stack[i]?.render(this);
      if (this.toastFrames > 0) this.renderToast();
    }

    this.term.write(this.screen.diff());
  }

  private renderTooSmall(width: number, height: number): void {
    const s = this.screen;
    const t = this.theme;
    const lines = [
      'glyphfall needs a little more room',
      '',
      `current  ${width} x ${height}`,
      `minimum  ${MIN_WIDTH} x ${MIN_HEIGHT}`,
      '',
      'resize the window, or press q to quit',
    ];
    const top = Math.max(0, Math.floor((height - lines.length) / 2));
    lines.forEach((line, i) => s.putCenter(0, width, top + i, truncate(line, width), t.fg(i === 0 ? 'title' : 'dim')));
  }

  private renderToast(): void {
    const s = this.screen;
    const t = this.theme;
    const text = ` ${this.toastText} `;
    const w = Math.min(s.width - 4, [...text].length);
    const x = Math.max(1, Math.floor((s.width - w) / 2));
    const y = s.height - 3;
    s.put(x, y, truncate(text, w), sgr(t.fg('invert'), t.bg('accent'), BOLD));
  }

  toast(text: string): void {
    this.toastText = text;
    this.toastFrames = 34;
    this.dirty = true;
  }

  /* ------------------------------------------------------------------ keys -- */

  private handleKey(key: Key): void {
    if (key.name === 'ctrl-c') { this.quit(); return; }
    if (key.name === 'ctrl-l') { this.screen.invalidate(); this.dirty = true; return; }
    const { width, height } = this.term.size();
    if (width < MIN_WIDTH || height < MIN_HEIGHT) {
      if (key.name === 'q') this.quit();
      return;
    }
    this.top()?.onKey(this, key);
    this.dirty = true;
  }

  quit(): void {
    if (this.run && this.run.outcome === 'running') this.autosave();
    this.exit();
  }

  /* ----------------------------------------------------------- persistence -- */

  autosave(resumeNode: string | null = this.pendingNode): void {
    if (!this.run) return;
    syncRng(this.run, this.rng);
    writeSave(this.run, resumeNode);
  }

  /** Called once a node is fully resolved and the player is back on the map. */
  clearPendingNode(): void {
    this.pendingNode = null;
  }

  saveProfileNow(): void {
    saveProfile(this.profile);
  }

  /* -------------------------------------------------------------- run flow -- */

  beginRun(seed: string, depth: number): void {
    const { run, rng } = newRun(seed, depth);
    this.run = run;
    this.rng = rng;
    this.combat = null;
    this.pendingNode = null;
    clearSave();
    this.autosave();
  }

  adoptRun(run: RunState, resumeNode: string | null = null): void {
    this.run = run;
    this.rng = rngFor(run);
    this.combat = null;
    this.pendingNode = resumeNode;
  }

  get isDaily(): boolean {
    return this.run?.seed === dailySeed();
  }

  /** Called by the boss reward flow once an act is finished. */
  finishAct(): boolean {
    if (!this.run) return false;
    const more = advanceAct(this.run, this.rng);
    this.autosave();
    return more;
  }

  /** Awards post-combat relic bonuses and rolls the reward screen inputs. */
  applyCombatWin(tier: 'normal' | 'elite' | 'boss'): void {
    const run = this.run;
    const combat = this.combat;
    if (!run || !combat) return;
    run.hp = combat.player.hp;
    run.stats.fightsWon++;
    if (tier === 'normal') run.actFights++;
    if (tier === 'elite') run.stats.elitesKilled++;
    if (tier === 'boss') run.stats.bossesKilled++;
    run.stats.bestChain = Math.max(run.stats.bestChain, combat.maxChainThisCombat);
    run.stats.turnsTaken += combat.turn;

    const bonus = combatWinBonuses(run.relics);
    if (bonus.heal > 0) run.hp = Math.min(run.maxHp, run.hp + bonus.heal);
    if (bonus.gold !== 0) run.gold = Math.max(0, run.gold + bonus.gold);
  }

  endRun(outcome: 'won' | 'lost'): void {
    if (!this.run) return;
    this.run.outcome = outcome;
    this.profile = recordRun(this.profile, this.run, outcome);
    this.saveProfileNow();
    clearSave();
  }

  /* ------------------------------------------------------------- utilities -- */

  actName(): string {
    const run = this.run;
    if (!run) return '';
    return ['The Upper Shelves', 'The Foundry Levels', 'The Fall'][run.act - 1] ?? `Act ${run.act}`;
  }

  actLabel(): string {
    return this.run ? `Act ${this.run.act}/${ACTS}` : '';
  }

  /* ------------------------------------------------------------------ node -- */

  /** Marks a node visited and saves, so a crash resumes on the same floor. */
  stepInto(nodeId: string): boolean {
    if (!this.run) return false;
    const node = enterNode(this.run, nodeId);
    if (!node) return false;
    this.pendingNode = nodeId;
    this.autosave(nodeId);
    return true;
  }
}

/* --------------------------------------------------------------- shared UI -- */

/** The persistent header: who you are, where you are, what you are carrying. */
export function drawTopBar(app: App): void {
  const { screen: s, theme: t } = app;
  const run = app.run;
  s.fill(0, 0, s.width, 1, ' ', t.bg('panel'));
  let x = s.put(1, 0, 'GLYPHFALL', sgr(t.fg('title'), t.bg('panel'), BOLD));
  if (!run) return;

  x = s.put(x + 2, 0, `${app.actLabel()} ${t.glyph('bullet')} ${app.actName()}`,
    sgr(t.fg('dim'), t.bg('panel')));

  const hpStyle = sgr(t.fg(run.hp / run.maxHp <= 0.3 ? 'hpLow' : 'hp'), t.bg('panel'), BOLD);
  const right: [string, string][] = [
    [`hp ${run.hp}/${run.maxHp}`, hpStyle],
    [`${t.glyph('coin')} ${run.gold}`, sgr(t.fg('gold'), t.bg('panel'), BOLD)],
    [`floor ${run.stats.floorsCleared}`, sgr(t.fg('dim'), t.bg('panel'))],
    [`depth ${run.depth}`, sgr(t.fg('dim'), t.bg('panel'))],
  ];
  let rx = s.width - 1;
  for (const [text, style] of right.reverse()) {
    rx -= [...text].length + 2;
    s.put(rx, 0, text, style);
  }
}

export function drawBottomBar(app: App, hints: readonly (readonly [string, string])[]): void {
  const { screen: s, theme: t } = app;
  s.fill(0, s.height - 1, s.width, 1, ' ', t.bg('panel'));
  keyHint(s, t, 1, s.height - 1, hints);
}
