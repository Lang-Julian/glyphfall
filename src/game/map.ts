import type { Rng } from '../core/rng.js';

/**
 * Act map generation.
 *
 * The map is the strategic layer: it is where you decide whether this run can
 * afford an elite, or needs a rest, or is one shop away from working. So it is
 * generated as a DAG with real forks — never a corridor, never a full mesh.
 *
 * Guarantees, per act:
 *   • row 0 is always a soft combat            (a run never dies on turn one)
 *   • row 4 always holds treasure              (a reliable relic)
 *   • row ROWS-2 is always a rest site         (you always get to heal pre-boss)
 *   • row ROWS-1 is the boss, and every path leads to it
 *   • at least 3 distinct routes exist from row 0
 *   • elites and shops never appear before row 2
 */

export type NodeKind = 'combat' | 'elite' | 'event' | 'shop' | 'rest' | 'treasure' | 'boss';

export interface MapNode {
  id: string;
  row: number;
  col: number;
  kind: NodeKind;
  /** Ids of nodes on the next row reachable from here. */
  next: string[];
  visited: boolean;
  /** Resolved lazily when the node is entered, so rerolls stay deterministic. */
  payload?: string;
}

export interface ActMap {
  act: number;
  rows: number;
  cols: number;
  nodes: Record<string, MapNode>;
  /** Row-major grid of node ids; empty slots are null. */
  grid: (string | null)[][];
  /** Where the player currently stands; null before the first step. */
  current: string | null;
}

export const MAP_ROWS = 9;
export const MAP_COLS = 5;
const PATHS = 4;

const key = (row: number, col: number) => `r${row}c${col}`;

export function generateMap(rng: Rng, act: number): ActMap {
  const rows = MAP_ROWS;
  const cols = MAP_COLS;
  const grid: (string | null)[][] = Array.from({ length: rows }, () => Array<string | null>(cols).fill(null));
  const nodes: Record<string, MapNode> = {};

  const ensure = (row: number, col: number): MapNode => {
    const id = key(row, col);
    if (!nodes[id]) {
      nodes[id] = { id, row, col, kind: 'combat', next: [], visited: false };
      grid[row]![col] = id;
    }
    return nodes[id]!;
  };

  // Carve `PATHS` walks from the bottom row up. Overlapping walks merge, which
  // is what produces the pinch points that make route choice interesting.
  const starts = rng.shuffle([...Array(cols).keys()]).slice(0, PATHS);
  for (const start of starts) {
    let col = start;
    ensure(0, col);
    for (let row = 1; row < rows - 1; row++) {
      const drift = rng.weighted([[-1, 1], [0, 2], [1, 1]] as const);
      col = Math.max(0, Math.min(cols - 1, col + drift));
      ensure(row, col);
      const from = nodes[key(row - 1, findNearest(grid, row - 1, col))]!;
      if (!from.next.includes(key(row, col))) from.next.push(key(row, col));
    }
  }

  // The boss sits alone on the top row and every row-(rows-2) node feeds it.
  const bossCol = Math.floor(cols / 2);
  const boss = ensure(rows - 1, bossCol);
  boss.kind = 'boss';
  for (let c = 0; c < cols; c++) {
    const id = grid[rows - 2]?.[c];
    if (id && !nodes[id]!.next.includes(boss.id)) nodes[id]!.next.push(boss.id);
  }

  // Stitch any node that ended up with no outgoing edge (possible when a walk
  // drifted past a neighbour) to the closest node one row up.
  for (let row = 0; row < rows - 1; row++) {
    for (const id of (grid[row] ?? []).filter(Boolean) as string[]) {
      if (nodes[id]!.next.length > 0) continue;
      const nearest = findNearest(grid, row + 1, nodes[id]!.col);
      nodes[id]!.next.push(key(row + 1, nearest));
    }
  }

  assignKinds(rng, nodes, grid, rows);
  return { act, rows, cols, nodes, grid, current: null };
}

function findNearest(grid: (string | null)[][], row: number, col: number): number {
  const line = grid[row] ?? [];
  let best = -1;
  let bestDist = Infinity;
  for (let c = 0; c < line.length; c++) {
    if (!line[c]) continue;
    const dist = Math.abs(c - col);
    if (dist < bestDist) { bestDist = dist; best = c; }
  }
  return best >= 0 ? best : col;
}

function assignKinds(
  rng: Rng, nodes: Record<string, MapNode>, grid: (string | null)[][], rows: number,
): void {
  for (let row = 0; row < rows - 1; row++) {
    for (const id of (grid[row] ?? []).filter(Boolean) as string[]) {
      const node = nodes[id]!;
      if (row === 0) { node.kind = 'combat'; continue; }
      if (row === 4) { node.kind = 'treasure'; continue; }
      if (row === rows - 2) { node.kind = 'rest'; continue; }
      node.kind = rng.weighted([
        ['combat', 44],
        ['event', 20],
        ['elite', row >= 2 ? 15 : 0],
        ['shop', row >= 2 ? 9 : 0],
        ['rest', row >= 2 ? 12 : 0],
      ] as const);
    }
  }
}

/** Nodes the player may step to right now. */
export function availableNodes(map: ActMap): MapNode[] {
  if (map.current === null) {
    return (map.grid[0] ?? []).filter(Boolean).map((id) => map.nodes[id as string]!);
  }
  const cur = map.nodes[map.current];
  if (!cur) return [];
  return cur.next.map((id) => map.nodes[id]!).filter(Boolean);
}

/**
 * Map glyphs.
 *
 * Restricted to ranges every terminal renders single-width: ASCII, Latin-1,
 * General Punctuation, Math Operators and Geometric Shapes. U+2302 HOUSE and
 * Greek letters are East-Asian-*ambiguous* and go double-width under a CJK
 * locale, which would shear the entire map one column to the right.
 */
export const NODE_GLYPH: Record<NodeKind, string> = {
  combat: '†', elite: '‡', event: '?', shop: '$', rest: '∩', treasure: '◈', boss: 'Ø',
};

export const NODE_LABEL: Record<NodeKind, string> = {
  combat: 'Combat', elite: 'Elite', event: 'Unknown', shop: 'Shop',
  rest: 'Rest site', treasure: 'Treasure', boss: 'Boss',
};

/** One word each, so a legend still fits a 78-column window. */
export const NODE_SHORT: Record<NodeKind, string> = {
  combat: 'combat', elite: 'elite', event: 'event', shop: 'shop',
  rest: 'rest', treasure: 'relic', boss: 'boss',
};

export const NODE_ASCII: Record<NodeKind, string> = {
  combat: 'x', elite: 'E', event: '?', shop: '$', rest: 'R', treasure: 'T', boss: 'B',
};
