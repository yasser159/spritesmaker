import { readFileSync, writeFileSync, copyFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const FLIGHT_TRACKER = resolve('/Users/yasser159/code/React/flight-tracker');
const SPRITES_DIR = join(FLIGHT_TRACKER, 'client/public/sprites');
const AIRCRAFT_SPRITES_JS = join(FLIGHT_TRACKER, 'client/src/data/aircraftSprites.js');
const SPRITE_ATLAS_JS = join(FLIGHT_TRACKER, 'client/src/data/spriteAtlas.js');
const SPRITE_REGISTRY = join(FLIGHT_TRACKER, 'server/data/sprite-registry.json');

export async function deploy(approvedDir) {
  if (!existsSync(approvedDir)) {
    console.error(`[deploy] Approved dir not found: ${approvedDir}`);
    process.exit(1);
  }

  // 1. Find all approved PNGs
  const pngs = readdirSync(approvedDir)
    .filter(f => f.endsWith('.png') && !f.includes('contact-sheet'));

  if (pngs.length === 0) {
    console.log('[deploy] No approved sprites to deploy');
    return;
  }

  // 2. Read current sprite names from aircraftSprites.js
  const existingNames = readSpriteNames();
  const newSprites = [];

  for (const png of pngs) {
    const icao = png.replace('.png', '').toUpperCase();
    // Copy PNG to flight-tracker sprites dir
    const src = join(approvedDir, png);
    const dest = join(SPRITES_DIR, `${icao}.png`);
    copyFileSync(src, dest);

    if (!existingNames.has(icao)) {
      newSprites.push(icao);
    }
    console.log(`  ✓ ${icao}.png → sprites/`);
  }

  if (newSprites.length > 0) {
    // 3. Update SPRITE_NAMES in aircraftSprites.js
    updateSpriteNames(newSprites);

    // 4. Update ALL_SPRITE_URLS in spriteAtlas.js
    updateSpriteAtlas(newSprites);
  }

  // 5. Update sprite-registry.json
  updateRegistry(pngs);

  // 6. Bump SPRITE_VERSION
  bumpSpriteVersion();

  console.log(`\n[deploy] Done: ${pngs.length} sprites deployed (${newSprites.length} new)`);
}

function readSpriteNames() {
  const content = readFileSync(AIRCRAFT_SPRITES_JS, 'utf-8');
  const match = content.match(/export const SPRITE_NAMES = new Set\(\[([\s\S]*?)\]\)/);
  if (!match) throw new Error('Could not find SPRITE_NAMES in aircraftSprites.js');

  const names = new Set();
  const entries = match[1].matchAll(/'([^']+)'/g);
  for (const m of entries) names.add(m[1]);
  return names;
}

function updateSpriteNames(newSprites) {
  let content = readFileSync(AIRCRAFT_SPRITES_JS, 'utf-8');
  const match = content.match(/export const SPRITE_NAMES = new Set\(\[([\s\S]*?)\]\)/);
  if (!match) throw new Error('Could not find SPRITE_NAMES');

  // Parse existing names, add new ones, sort, rebuild
  const names = new Set();
  for (const m of match[1].matchAll(/'([^']+)'/g)) names.add(m[1]);
  for (const n of newSprites) names.add(n);

  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  const newSet = `export const SPRITE_NAMES = new Set([\n${sorted.map(n => `  '${n}',`).join('\n')}\n])`;

  content = content.replace(/export const SPRITE_NAMES = new Set\(\[[\s\S]*?\]\)/, newSet);
  writeFileSync(AIRCRAFT_SPRITES_JS, content);
  console.log(`  [deploy] Updated SPRITE_NAMES: +${newSprites.length} (total ${sorted.length})`);
}

function updateSpriteAtlas(newSprites) {
  let content = readFileSync(SPRITE_ATLAS_JS, 'utf-8');

  // Find the aircraft section in ALL_SPRITE_URLS — insert before ground vehicles
  // Look for the comment "// Ground" or first ground sprite
  const insertBefore = "  '/sprites/ground.png'";
  if (!content.includes(insertBefore)) {
    // Fallback: insert before the closing bracket
    const closingMatch = content.match(/const ALL_SPRITE_URLS = \[([\s\S]*?)\];/);
    if (!closingMatch) {
      console.warn('  [deploy] WARNING: Could not update ALL_SPRITE_URLS automatically');
      return;
    }
  }

  const newLines = newSprites
    .sort((a, b) => a.localeCompare(b))
    .map(n => `  '/sprites/${n}.png',`)
    .join('\n');

  content = content.replace(insertBefore, `${newLines}\n${insertBefore}`);
  writeFileSync(SPRITE_ATLAS_JS, content);
  console.log(`  [deploy] Updated ALL_SPRITE_URLS: +${newSprites.length}`);
}

function updateRegistry(pngs) {
  let registry = {};
  if (existsSync(SPRITE_REGISTRY)) {
    registry = JSON.parse(readFileSync(SPRITE_REGISTRY, 'utf-8'));
  }

  const now = new Date().toISOString();
  for (const png of pngs) {
    const key = png.toUpperCase().endsWith('.PNG') ? png.replace(/\.PNG$/i, '.png') : png;
    const icao = key.replace('.png', '').toUpperCase();
    registry[`${icao}.png`] = {
      category: 'aircraft',
      noseDirection: 'north',
      approved: true,
      detectedNorth: true,
      topAlpha: 0,
      botAlpha: 0,
      needsRotation: false,
      approvedAt: now,
    };
  }

  // Sort keys alphabetically for clean diffs
  const sorted = Object.keys(registry).sort().reduce((acc, k) => {
    acc[k] = registry[k];
    return acc;
  }, {});

  writeFileSync(SPRITE_REGISTRY, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`  [deploy] Updated sprite-registry.json: ${pngs.length} entries`);
}

function bumpSpriteVersion() {
  let content = readFileSync(SPRITE_ATLAS_JS, 'utf-8');
  const today = new Date().toISOString().slice(0, 10);
  const newVersion = `${today}-spriteforge-deploy`;

  content = content.replace(
    /const SPRITE_VERSION = String\(import\.meta\.env\.VITE_SPRITE_VERSION \|\| '([^']*)'\)/,
    `const SPRITE_VERSION = String(import.meta.env.VITE_SPRITE_VERSION || '${newVersion}')`
  );

  writeFileSync(SPRITE_ATLAS_JS, content);
  console.log(`  [deploy] Bumped SPRITE_VERSION → ${newVersion}`);
}
