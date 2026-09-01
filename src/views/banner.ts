/**
 * The wordmark.
 *
 * A hand-set 5-row block font rather than a bundled figlet dependency: it is
 * 40 lines, it has no license to track, and it renders identically everywhere
 * because it only uses U+2588 FULL BLOCK.
 */

const LETTERS: Record<string, readonly string[]> = {
  G: [' █████ ', '██     ', '██  ███', '██   ██', ' █████ '],
  L: ['██     ', '██     ', '██     ', '██     ', '███████'],
  Y: ['██   ██', ' ██ ██ ', '  ███  ', '   ██  ', '   ██  '],
  P: ['██████ ', '██   ██', '██████ ', '██     ', '██     '],
  H: ['██   ██', '██   ██', '███████', '██   ██', '██   ██'],
  F: ['███████', '██     ', '█████  ', '██     ', '██     '],
  A: ['  ███  ', ' ██ ██ ', '███████', '██   ██', '██   ██'],
  ' ': ['   ', '   ', '   ', '   ', '   '],
};

const ASCII_LETTERS: Record<string, readonly string[]> = {
  G: [' ##### ', '##     ', '##  ###', '##   ##', ' ##### '],
  L: ['##     ', '##     ', '##     ', '##     ', '#######'],
  Y: ['##   ##', ' ## ## ', '  ###  ', '   ##  ', '   ##  '],
  P: ['###### ', '##   ##', '###### ', '##     ', '##     '],
  H: ['##   ##', '##   ##', '#######', '##   ##', '##   ##'],
  F: ['#######', '##     ', '#####  ', '##     ', '##     '],
  A: ['  ###  ', ' ## ## ', '#######', '##   ##', '##   ##'],
  ' ': ['   ', '   ', '   ', '   ', '   '],
};

/** Renders `word` as five strings. Returns null if it will not fit `maxWidth`. */
export function banner(word: string, maxWidth: number, unicode = true): string[] | null {
  const table = unicode ? LETTERS : ASCII_LETTERS;
  const glyphs = [...word.toUpperCase()].map((ch) => table[ch]);
  if (glyphs.some((g) => g === undefined)) return null;
  const width = glyphs.reduce((sum, g) => sum + (g![0]!.length + 1), -1);
  if (width > maxWidth) return null;
  return Array.from({ length: 5 }, (_, row) =>
    glyphs.map((g) => g![row]!).join(' '),
  );
}
