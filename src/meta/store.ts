import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { SAVE_VERSION, type RunState } from '../game/run.js';
import { scoreRun } from '../game/score.js';

/**
 * Persistence.
 *
 * Two files, both JSON, both disposable:
 *   save.json    — the run in progress, so a run survives a closed lid
 *   profile.json — lifetime stats, records and settings
 *
 * Writes are atomic (temp file + rename) because the one thing worse than
 * losing a run is loading half of one.
 */

export interface Profile {
  version: number;
  runs: number;
  wins: number;
  bestDepth: number;
  bestChain: number;
  bestFloor: number;
  bestScore: number;
  totalFightsWon: number;
  fastestWinMs: number | null;
  /** Seeds already completed, so the daily can only be scored once. */
  dailiesDone: string[];
  settings: {
    ascii: boolean;
    noColor: boolean;
    animations: boolean;
    confirmEndTurn: boolean;
    /** 'auto' asks the terminal; the others are the player's explicit choice. */
    appearance: 'auto' | 'dark' | 'light';
  };
  /** Most recent finished runs, newest first, capped. */
  history: {
    seed: string; depth: number; act: number; floor: number;
    outcome: 'won' | 'lost'; bestChain: number; at: number;
    character: string; score: number;
  }[];
}

const EMPTY_PROFILE: Profile = {
  version: 1,
  runs: 0, wins: 0, bestDepth: 0, bestChain: 0, bestFloor: 0, bestScore: 0,
  totalFightsWon: 0, fastestWinMs: null, dailiesDone: [],
  settings: {
    ascii: false, noColor: false, animations: true, confirmEndTurn: false,
    appearance: 'auto',
  },
  history: [],
};

export function dataDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.GLYPHFALL_HOME) return env.GLYPHFALL_HOME;
  if (process.platform === 'win32') {
    return join(env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'glyphfall');
  }
  const xdg = env.XDG_DATA_HOME;
  if (xdg) return join(xdg, 'glyphfall');
  return join(homedir(), '.local', 'share', 'glyphfall');
}

function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(path: string, value: unknown): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = join(tmpdir(), `glyphfall-${process.pid}-${Date.now()}.json`);
    writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
    renameSync(tmp, path);
  } catch {
    // A read-only or full disk must never crash a run in progress.
  }
}

/* ------------------------------------------------------------------ profile -- */

export function loadProfile(dir = dataDir()): Profile {
  const p = readJson<Profile>(join(dir, 'profile.json'), EMPTY_PROFILE);
  return {
    ...EMPTY_PROFILE, ...p,
    settings: { ...EMPTY_PROFILE.settings, ...(p.settings ?? {}) },
    history: Array.isArray(p.history) ? p.history : [],
    dailiesDone: Array.isArray(p.dailiesDone) ? p.dailiesDone : [],
  };
}

export function saveProfile(profile: Profile, dir = dataDir()): void {
  writeJson(join(dir, 'profile.json'), profile);
}

export function recordRun(profile: Profile, run: RunState, outcome: 'won' | 'lost'): Profile {
  const elapsed = Date.now() - run.stats.startedAt;
  const score = scoreRun(run, outcome).total;
  const next: Profile = {
    ...profile,
    runs: profile.runs + 1,
    wins: profile.wins + (outcome === 'won' ? 1 : 0),
    bestDepth: outcome === 'won' ? Math.max(profile.bestDepth, run.depth) : profile.bestDepth,
    bestChain: Math.max(profile.bestChain, run.stats.bestChain),
    bestFloor: Math.max(profile.bestFloor, run.stats.floorsCleared),
    bestScore: Math.max(profile.bestScore, score),
    totalFightsWon: profile.totalFightsWon + run.stats.fightsWon,
    fastestWinMs: outcome === 'won'
      ? Math.min(profile.fastestWinMs ?? Number.POSITIVE_INFINITY, elapsed)
      : profile.fastestWinMs,
    history: [
      { seed: run.seed, depth: run.depth, act: run.act, floor: run.stats.floorsCleared,
        outcome, bestChain: run.stats.bestChain, at: Date.now(),
        character: run.character, score },
      ...profile.history,
    ].slice(0, 25),
  };
  if (run.seed.startsWith('daily-') && !next.dailiesDone.includes(run.seed)) {
    next.dailiesDone = [run.seed, ...next.dailiesDone].slice(0, 60);
  }
  return next;
}

/* --------------------------------------------------------------------- save -- */

export interface SaveFile {
  version: number;
  run: RunState;
  /** Node to re-enter on resume; null means "standing on the map". */
  resumeNode: string | null;
  savedAt: number;
}

export function savePath(dir = dataDir()): string {
  return join(dir, 'save.json');
}

export function loadSave(dir = dataDir()): SaveFile | null {
  const raw = readJson<SaveFile | null>(savePath(dir), null);
  if (!raw || typeof raw !== 'object' || !raw.run) return null;
  if (raw.run.version !== SAVE_VERSION) return null;
  return raw;
}

export function writeSave(run: RunState, resumeNode: string | null, dir = dataDir()): void {
  writeJson(savePath(dir), { version: 1, run, resumeNode, savedAt: Date.now() } satisfies SaveFile);
}

export function clearSave(dir = dataDir()): void {
  try { rmSync(savePath(dir)); } catch { /* nothing to clear */ }
}
