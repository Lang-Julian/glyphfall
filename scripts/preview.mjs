/**
 * Frame preview.
 *
 * Renders any screen to plain text without a terminal, so a layout can be
 * checked in a diff, in CI, or at a size your window is not.
 *
 *   node scripts/preview.mjs [width] [height] [screen] [--ascii]
 *   node scripts/preview.mjs 100 32 combat
 *   node scripts/preview.mjs 80 24 map --ascii
 */
import { PREVIEW_SCREENS, renderPreview } from '../dist/ui/preview.js';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ascii = process.argv.includes('--ascii');
const width = Number(args[0] ?? 96);
const height = Number(args[1] ?? 30);
const only = args[2];

if (only && !PREVIEW_SCREENS.includes(only)) {
  console.error(`unknown screen: ${only}\navailable: ${PREVIEW_SCREENS.join(', ')}`);
  process.exit(2);
}

for (const name of PREVIEW_SCREENS) {
  if (only && only !== name) continue;
  const rule = '='.repeat(width);
  console.log(`${rule}\n${name.toUpperCase()}  ${width}x${height}${ascii ? '  ascii' : ''}\n${rule}`);
  console.log(renderPreview(name, { width, height, ascii }));
  console.log();
}
