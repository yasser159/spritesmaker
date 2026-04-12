/**
 * Generate a contact sheet PNG showing all sprites in a grid.
 * Color-coded borders: green (approved), yellow (review), red (rejected).
 * Sorted by QA score ascending (worst first for fast human triage).
 */
import sharp from 'sharp';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QA_RESULTS_PATH = join(__dirname, '..', 'data', 'qa-results.json');

const CELL_SIZE = 128;
const BORDER = 3;
const LABEL_HEIGHT = 18;
const CELL_TOTAL = CELL_SIZE + BORDER * 2;
const ROW_HEIGHT = CELL_TOTAL + LABEL_HEIGHT;
const COLS = 10;
const BG_COLOR = { r: 30, g: 30, b: 30 };

const TIER_COLORS = {
  approved: { r: 34, g: 197, b: 94 },   // green
  review:   { r: 234, g: 179, b: 8 },    // yellow
  rejected: { r: 239, g: 68, b: 68 },    // red
  unknown:  { r: 100, g: 100, b: 100 },  // gray
};

function loadQaResults() {
  try { return JSON.parse(readFileSync(QA_RESULTS_PATH, 'utf8')); } catch { return {}; }
}

/**
 * Create an SVG label for a sprite cell.
 */
function labelSvg(icao, score, tier, cellWidth) {
  const color = tier === 'approved' ? '#22c55e' : tier === 'review' ? '#eab308' : '#ef4444';
  return Buffer.from(`<svg width="${cellWidth}" height="${LABEL_HEIGHT}">
    <text x="${cellWidth / 2}" y="13" font-family="monospace" font-size="10" fill="${color}" text-anchor="middle">${icao} ${score}</text>
  </svg>`);
}

/**
 * Create a colored border frame as a raw buffer.
 */
async function borderFrame(color, size) {
  const totalSize = size + BORDER * 2;
  return sharp({
    create: {
      width: totalSize,
      height: totalSize,
      channels: 4,
      background: { ...color, alpha: 255 },
    },
  }).png().toBuffer();
}

/**
 * Generate a contact sheet from sprites in the given directories.
 */
export async function generateContactSheet(outputDir) {
  const qa = loadQaResults();

  // Collect sprites from all tier folders + root
  const sprites = [];
  for (const subdir of ['approved', 'review', 'rejected', '']) {
    const dir = subdir ? join(outputDir, subdir) : outputDir;
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.png') || f.includes('contact-sheet') || f.includes('debug')) continue;
      const icao = basename(f, '.png').toUpperCase();
      const qaEntry = qa[icao] || {};
      sprites.push({
        path: join(dir, f),
        icao,
        score: qaEntry.score ?? -1,
        tier: qaEntry.tier || (subdir || 'unknown'),
      });
    }
  }

  if (sprites.length === 0) {
    console.log('No sprites found to create contact sheet.');
    return null;
  }

  // Sort by score ascending (worst first)
  sprites.sort((a, b) => a.score - b.score);

  const rows = Math.ceil(sprites.length / COLS);
  const sheetWidth = COLS * (CELL_TOTAL + 2) + 2;
  const sheetHeight = rows * ROW_HEIGHT + 2;

  // Create background
  const composites = [];

  for (let i = 0; i < sprites.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = col * (CELL_TOTAL + 2) + 2;
    const y = row * ROW_HEIGHT + 2;

    const sprite = sprites[i];
    const tierColor = TIER_COLORS[sprite.tier] || TIER_COLORS.unknown;

    // Border background
    const borderBuf = await borderFrame(tierColor, CELL_SIZE);
    composites.push({ input: borderBuf, left: x, top: y });

    // Sprite image (resize to CELL_SIZE if needed)
    try {
      const spriteBuf = await sharp(sprite.path)
        .resize(CELL_SIZE, CELL_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      composites.push({ input: spriteBuf, left: x + BORDER, top: y + BORDER });
    } catch {
      // Skip broken sprites
    }

    // Label
    const label = labelSvg(sprite.icao, sprite.score, sprite.tier, CELL_TOTAL);
    composites.push({ input: label, left: x, top: y + CELL_TOTAL });
  }

  const outPath = join(outputDir, 'contact-sheet.png');

  await sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 4,
      background: { ...BG_COLOR, alpha: 255 },
    },
  })
    .composite(composites)
    .png()
    .toFile(outPath);

  console.log(`[contact-sheet] ${sprites.length} sprites → ${outPath} (${sheetWidth}×${sheetHeight})`);
  return outPath;
}
