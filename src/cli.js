import { mkdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { classify, classifyAll, getAllCodesForCategory } from './classify.js';
import { fetchSpecs } from './fetch-specs.js';
import { render } from './render.js';
import { validate } from './validate.js';
import { resolveModel } from './model-resolver.js';
import { render3d } from './render-3d.js';

const OUTPUT_DIR = resolve('./output');

function ensureOutputDir() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function printUsage() {
  console.log(`
spritesmaker — Parametric aircraft & vessel sprite generator

Usage:
  spritesmaker aircraft <ICAO>           Classify → fetch specs → render sprite
  spritesmaker aircraft <ICAO> --specs   Print specs only, don't render
  spritesmaker vessel <type>             Render vessel sprite
  spritesmaker batch --category <cat>    Render all ICAO types in category
  spritesmaker batch --missing --flight-tracker <path>
                                         Find types without sprites and generate them
  spritesmaker render <ICAO>             Download 3D model + Blender render (best quality)
  spritesmaker render-batch --top <N>    Render top N most common types via Blender
  spritesmaker list                      Show categories and sample types

Vessel types: cargo, tanker, cruise, fishing, tug, sailboat
Categories:   helicopter, light-piston, turboprop, bizjet, regional, narrowbody, widebody

Output: ./output/
`);
}

async function handleAircraft(args) {
  const icao = args[0]?.toUpperCase();
  if (!icao) {
    console.error('Error: ICAO code required. Example: spritesmaker aircraft B738');
    process.exit(1);
  }

  const specsOnly = args.includes('--specs');

  console.log(`[classify] ${icao}`);
  const classification = classify(icao);
  if (!classification) {
    console.error(`Error: Unknown ICAO code "${icao}". Not found in icao-types.json.`);
    process.exit(1);
  }

  console.log(`  category: ${classification.category}`);
  console.log(`  kind: ${classification.kind}, wake: ${classification.wake}`);
  console.log(`  engine: ${classification.engineType} x${classification.engineCount}`);

  console.log(`[fetch-specs] ${icao}`);
  const specs = await fetchSpecs(icao);
  console.log(`  name: ${specs.name}`);
  console.log(`  wingspan: ${specs.wingspan}m, length: ${specs.length}m`);
  console.log(`  engines: ${specs.engines} x ${specs.engineType}`);
  console.log(`  source: ${specs.source}`);

  if (specsOnly) {
    console.log('\n[specs]');
    console.log(JSON.stringify(specs, null, 2));
    return;
  }

  // Template rendering will be done by template modules (future)
  // For now, we output a placeholder message
  ensureOutputDir();
  const outPath = join(OUTPUT_DIR, `${icao}.png`);
  console.log(`[render] Template: ${classification.category}`);
  console.log(`  → Rendering requires a template for "${classification.category}"`);
  console.log(`  → Templates live in src/templates/<category>.js`);

  // Check if a template exists and render
  try {
    const templatePath = `./templates/${classification.category}.js`;
    const mod = await import(templatePath);
    const generate = mod.default || mod.generate;
    const svg = generate(specs);
    await render(svg, outPath);
    console.log(`  → Saved: ${outPath}`);

    const result = await validate(outPath);
    console.log(`[validate] nose-north: ${result.valid ? 'PASS' : 'FAIL'} (top=${result.topAlpha}, bot=${result.botAlpha})`);
  } catch (e) {
    if (e.code === 'ERR_MODULE_NOT_FOUND') {
      console.log(`  → No template found for "${classification.category}". Create src/templates/${classification.category}.js`);
    } else {
      console.error(`  → Render error: ${e.message}`);
    }
  }
}

async function handleVessel(args) {
  const type = args[0]?.toLowerCase();
  const validTypes = ['cargo', 'tanker', 'cruise', 'fishing', 'tug', 'sailboat'];

  if (!type || !validTypes.includes(type)) {
    console.error(`Error: Valid vessel types: ${validTypes.join(', ')}`);
    process.exit(1);
  }

  ensureOutputDir();
  const outPath = join(OUTPUT_DIR, `vessel-${type}.png`);

  try {
    const mod = await import('./templates/vessel.js');
    const generate = mod.default || mod.generate;
    const svg = generate({ vesselType: type, length: 100, beam: 15 });
    await render(svg, outPath);
    console.log(`[render] vessel-${type} → ${outPath}`);

    const result = await validate(outPath);
    console.log(`[validate] nose-north: ${result.valid ? 'PASS' : 'FAIL'}`);
  } catch (e) {
    if (e.code === 'ERR_MODULE_NOT_FOUND') {
      console.log(`No template for vessel type "${type}". Create src/templates/vessel-${type}.js`);
    } else {
      console.error(`Render error: ${e.message}`);
    }
  }
}

async function handleBatch(args) {
  const catIdx = args.indexOf('--category');
  const missingFlag = args.includes('--missing');
  const ftIdx = args.indexOf('--flight-tracker');

  if (catIdx !== -1) {
    const category = args[catIdx + 1];
    if (!category) {
      console.error('Error: --category requires a value');
      process.exit(1);
    }

    const codes = getAllCodesForCategory(category);
    if (codes.length === 0) {
      console.error(`Error: No ICAO codes found for category "${category}"`);
      process.exit(1);
    }

    console.log(`[batch] Category "${category}": ${codes.length} types`);
    ensureOutputDir();

    let rendered = 0;
    let skipped = 0;
    let failed = 0;

    for (const code of codes) {
      const outPath = join(OUTPUT_DIR, `${code}.png`);
      if (existsSync(outPath)) {
        skipped++;
        continue;
      }

      try {
        const specs = await fetchSpecs(code);
        const templatePath = `./templates/${category}.js`;
        const { generate } = await import(templatePath);
        const svg = generate(specs);
        await render(svg, outPath);
        rendered++;
        process.stdout.write(`\r  rendered: ${rendered}, skipped: ${skipped}, failed: ${failed}`);
      } catch {
        failed++;
      }
    }
    console.log(`\n[batch] Done. rendered=${rendered}, skipped=${skipped}, failed=${failed}`);

  } else if (missingFlag && ftIdx !== -1) {
    const ftPath = args[ftIdx + 1];
    if (!ftPath) {
      console.error('Error: --flight-tracker requires a path to the flight-tracker project');
      process.exit(1);
    }

    const spritesDir = resolve(ftPath);
    if (!existsSync(spritesDir)) {
      console.error(`Error: Path not found: ${spritesDir}`);
      process.exit(1);
    }

    const allCodes = classifyAll();
    const missing = [];

    for (const [code] of allCodes) {
      const pngPath = join(OUTPUT_DIR, `${code}.png`);
      if (!existsSync(pngPath)) {
        missing.push(code);
      }
    }

    console.log(`[batch] ${missing.length} types without sprites (of ${allCodes.size} total)`);
    if (missing.length > 20) {
      console.log(`  First 20: ${missing.slice(0, 20).join(', ')}`);
    }

    // Generate missing sprites
    ensureOutputDir();
    let rendered = 0;
    let failed = 0;

    for (const code of missing) {
      try {
        const classification = classify(code);
        if (!classification) continue;

        const specs = await fetchSpecs(code);
        const templatePath = `./templates/${classification.category}.js`;
        const { generate } = await import(templatePath);
        const svg = generate(specs);
        const outPath = join(OUTPUT_DIR, `${code}.png`);
        await render(svg, outPath);
        rendered++;
      } catch {
        failed++;
      }
    }
    console.log(`[batch] Done. rendered=${rendered}, failed=${failed}`);

  } else {
    console.error('Error: batch requires --category <cat> or --missing --flight-tracker <path>');
    process.exit(1);
  }
}

function handleList() {
  const allCodes = classifyAll();
  const categories = {};

  for (const [code, info] of allCodes) {
    const cat = info.category;
    if (!categories[cat]) categories[cat] = [];
    if (categories[cat].length < 5) categories[cat].push(code);
  }

  console.log('Categories and sample ICAO codes:\n');
  for (const [cat, samples] of Object.entries(categories).sort()) {
    const total = getAllCodesForCategory(cat).length;
    console.log(`  ${cat.padEnd(15)} (${String(total).padStart(4)} types)  ${samples.join(', ')}`);
  }
  console.log(`\nTotal: ${allCodes.size} ICAO types`);
}

// Top aircraft types by global traffic volume
const TOP_TYPES = [
  'B738', 'A320', 'A321', 'B737', 'A319', 'B739', 'B77W', 'A332', 'B788', 'B789',
  'A388', 'B744', 'B772', 'B773', 'A333', 'A359', 'A346', 'E190', 'E75L', 'CRJ9',
  'CRJ7', 'E170', 'E145', 'B752', 'B763', 'AT75', 'AT45', 'Q400', 'C172', 'C182',
  'C208', 'PA28', 'PC12', 'BE20', 'GLF5', 'C56X', 'C680', 'LJ45', 'EC35', 'B407',
  'A139', 'B06', 'R44', 'F16', 'F18S', 'C17', 'C130', 'B350', 'DHC6', 'SR22',
];

async function handleRender(args) {
  const icao = args[0]?.toUpperCase();
  if (!icao) {
    console.error('Error: ICAO code required. Example: spritesmaker render B738');
    process.exit(1);
  }

  console.log(`[render] ${icao}`);
  const classification = classify(icao);
  if (!classification) {
    console.error(`Error: Unknown ICAO code "${icao}".`);
    process.exit(1);
  }
  console.log(`  category: ${classification.category}`);

  const specs = await fetchSpecs(icao);
  console.log(`  name: ${specs.name}`);

  const model = await resolveModel(icao, specs);
  if (!model) {
    console.error(`  No 3D model found for ${icao}. Try 'aircraft' command for SVG fallback.`);
    process.exit(1);
  }

  ensureOutputDir();
  const outPath = join(OUTPUT_DIR, `${icao}.png`);
  const result = await render3d(model.modelPath, outPath);

  if (result.success) {
    console.log(`\n✓ ${icao} → ${outPath} (source: ${model.source})`);
  } else {
    console.error(`\n✗ ${icao} render failed: ${result.error}`);
    process.exit(1);
  }
}

async function handleRenderBatch(args) {
  const topIdx = args.indexOf('--top');
  const force = args.includes('--force');
  const count = topIdx !== -1 ? parseInt(args[topIdx + 1], 10) || 20 : 20;
  const types = TOP_TYPES.slice(0, count);

  console.log(`[render-batch] Rendering top ${types.length} aircraft types...`);
  ensureOutputDir();

  let rendered = 0, skipped = 0, failed = 0;

  for (const icao of types) {
    const outPath = join(OUTPUT_DIR, `${icao}.png`);
    if (!force && existsSync(outPath)) {
      skipped++;
      continue;
    }

    try {
      const classification = classify(icao);
      if (!classification) { failed++; continue; }

      const specs = await fetchSpecs(icao);
      const model = await resolveModel(icao, specs);
      if (!model) { failed++; continue; }

      const result = await render3d(model.modelPath, outPath);
      if (result.success) {
        rendered++;
        console.log(`  ✓ ${icao} (${rendered}/${types.length - skipped})`);
      } else {
        failed++;
        console.log(`  ✗ ${icao}: ${result.error}`);
      }
    } catch (e) {
      failed++;
      console.log(`  ✗ ${icao}: ${e.message}`);
    }
  }

  console.log(`\n[render-batch] Done: ${rendered} rendered, ${skipped} skipped, ${failed} failed`);
}

export async function run(args) {
  const command = args[0];

  switch (command) {
    case 'aircraft':
      await handleAircraft(args.slice(1));
      break;
    case 'vessel':
      await handleVessel(args.slice(1));
      break;
    case 'batch':
      await handleBatch(args.slice(1));
      break;
    case 'render':
      await handleRender(args.slice(1));
      break;
    case 'render-batch':
      await handleRenderBatch(args.slice(1));
      break;
    case 'list':
      handleList();
      break;
    case '--help':
    case '-h':
    case undefined:
      printUsage();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}
