import { dailySeed, normaliseSeed, randomSeed } from './core/seed.js';
import { validateContent } from './game/run.js';
import { dataDir, loadProfile, loadSave } from './meta/store.js';
import { App, type AppOptions } from './ui/app.js';
import { detectColorLevel, detectUnicode, type ColorLevel } from './ui/theme.js';
import { resumeRun, showTitle, startRun } from './views/flow.js';
import { version } from './version.js';

/**
 * Command line entry point.
 *
 * Flags exist for the three things a terminal game is actually asked to do:
 * start a specific run (`--seed`, `--daily`, `--depth`), fit a hostile
 * terminal (`--ascii`, `--no-color`, `--no-anim`), and be inspected without
 * playing (`--stats`, `--where`, `--check`).
 */

interface Args {
  seed?: string;
  daily: boolean;
  depth: number;
  ascii: boolean;
  noColor: boolean;
  noAnim: boolean;
  resume: boolean;
  help: boolean;
  showVersion: boolean;
  stats: boolean;
  where: boolean;
  check: boolean;
  jumpIn: boolean;
  errors: string[];
}

export function parseArgs(argv: readonly string[]): Args {
  const a: Args = {
    daily: false, depth: 0, ascii: false, noColor: false, noAnim: false,
    resume: false, help: false, showVersion: false, stats: false, where: false,
    check: false, jumpIn: false, errors: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const [flag, inlineValue] = arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, undefined];
    const value = () => inlineValue ?? argv[++i];

    switch (flag) {
      case '-h': case '--help': a.help = true; break;
      case '-v': case '--version': a.showVersion = true; break;
      case '-s': case '--seed': {
        const v = value();
        if (!v) a.errors.push('--seed needs a value');
        else { a.seed = normaliseSeed(v); a.jumpIn = true; }
        break;
      }
      case '--daily': a.daily = true; a.jumpIn = true; break;
      case '-d': case '--depth': {
        const v = Number(value());
        if (!Number.isInteger(v) || v < 0 || v > 20) a.errors.push('--depth must be 0-20');
        else a.depth = v;
        break;
      }
      case '--ascii': a.ascii = true; break;
      case '--no-color': case '--no-colour': a.noColor = true; break;
      case '--no-anim': case '--no-animation': a.noAnim = true; break;
      case '-c': case '--continue': a.resume = true; a.jumpIn = true; break;
      case '--stats': a.stats = true; break;
      case '--where': a.where = true; break;
      case '--check': a.check = true; break;
      default:
        if (flag.startsWith('-')) a.errors.push(`unknown flag: ${flag}`);
        else a.errors.push(`unexpected argument: ${flag}`);
    }
  }
  return a;
}

const HELP = `
  glyphfall — a roguelike deckbuilder for your terminal

  usage
    glyphfall                 play
    glyphfall --seed <text>   play a specific run
    glyphfall --daily         today's run, the same for everyone
    glyphfall --continue      resume the saved run

  options
    -s, --seed <text>   any text; the same seed always plays the same run
        --daily         today's shared seed
    -d, --depth <n>     difficulty, 0-20 (default 0)
    -c, --continue      resume the run in progress
        --ascii         no unicode; boxes drawn with + - |
        --no-color      no colour (also honours NO_COLOR)
        --no-anim       no flashes or pulses
        --stats         print your records and exit
        --where         print the save directory and exit
        --check         validate the content tables and exit
    -h, --help          this
    -v, --version       version

  the rule that matters
    Every card has a suit. Play a card whose suit matches the previous card
    you played this turn and your CHAIN grows. Break the match and it
    collapses. Every point of chain adds +1 to each instance of damage or
    block a card produces — so the order you play your hand in matters more
    than what is in it.
`;

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  const args = parseArgs(argv);

  if (args.errors.length > 0) {
    for (const e of args.errors) process.stderr.write(`glyphfall: ${e}\n`);
    process.stderr.write('try: glyphfall --help\n');
    return 2;
  }
  if (args.help) { process.stdout.write(`${HELP}\n`); return 0; }
  if (args.showVersion) { process.stdout.write(`glyphfall ${version()}\n`); return 0; }
  if (args.where) { process.stdout.write(`${dataDir()}\n`); return 0; }

  if (args.check) {
    const problems = validateContent();
    if (problems.length === 0) { process.stdout.write('content ok\n'); return 0; }
    for (const p of problems) process.stderr.write(`${p}\n`);
    return 1;
  }

  if (args.stats) {
    const p = loadProfile();
    const save = loadSave();
    process.stdout.write([
      `runs           ${p.runs}`,
      `wins           ${p.wins}`,
      `fights won     ${p.totalFightsWon}`,
      `longest chain  ${p.bestChain}`,
      `deepest floor  ${p.bestFloor}`,
      `saved run      ${save ? `${save.run.seed} (act ${save.run.act}, floor ${save.run.stats.floorsCleared})` : 'none'}`,
      `today's seed   ${dailySeed()}`,
      '',
    ].join('\n'));
    return 0;
  }

  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    process.stderr.write(
      'glyphfall needs an interactive terminal.\n' +
      'Run it directly in a shell rather than through a pipe or a CI job.\n',
    );
    return 1;
  }

  const profile = loadProfile();
  const colorLevel: ColorLevel =
    args.noColor || profile.settings.noColor ? 'none' : detectColorLevel();

  const opts: AppOptions = {
    seed: args.daily ? dailySeed() : args.seed ?? randomSeed(),
    depth: args.depth,
    ascii: args.ascii || profile.settings.ascii || !detectUnicode(),
    colorLevel,
    animations: !args.noAnim && profile.settings.animations,
    jumpIn: args.jumpIn,
    resume: args.resume,
  };

  // Fail before taking over the terminal, not after.
  if (args.resume && !loadSave()) {
    process.stderr.write('glyphfall: no saved run to continue\n');
    return 1;
  }

  const app = new App(opts);
  const started = app.start();

  if (args.resume) resumeRun(app);
  else if (args.jumpIn) startRun(app, opts.seed, opts.depth);
  else showTitle(app);

  await started;
  return 0;
}

const isDirectRun = process.argv[1] !== undefined &&
  (process.argv[1].endsWith('cli.js') || process.argv[1].endsWith('glyphfall'));

if (isDirectRun) {
  main().then(
    (code) => { process.exitCode = code; },
    (err: unknown) => {
      process.stderr.write(`glyphfall: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
      process.exitCode = 1;
    },
  );
}
