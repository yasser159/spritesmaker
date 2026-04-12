/**
 * Model resolver: find or download 3D models for ICAO codes.
 * Pipeline: local cache → curated Sketchfab IDs → Sketchfab search → category fallback
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, createWriteStream, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = join(__dirname, '..', 'models', 'aircraft');
const DEFAULTS_DIR = join(__dirname, '..', 'models', 'defaults');
const DATA_DIR = join(__dirname, '..', 'data');
const CURATED_PATH = join(DATA_DIR, 'sketchfab-models.json');
const SEARCH_CACHE_PATH = join(DATA_DIR, 'sketchfab-search-cache.json');

function getSketchfabToken() {
  // Check env first
  if (process.env.SKETCHFAB_TOKEN) return process.env.SKETCHFAB_TOKEN;
  // Fallback: read from flight-tracker .env
  const envPaths = [
    join(__dirname, '..', '..', '..', 'React', 'flight-tracker', 'server', '.env'),
    '/Users/yasser159/code/React/flight-tracker/server/.env',
  ];
  for (const p of envPaths) {
    try {
      const lines = readFileSync(p, 'utf8').split('\n');
      for (const line of lines) {
        if (line.startsWith('SKETCHFAB_TOKEN=')) return line.split('=')[1].trim();
      }
    } catch {}
  }
  return null;
}

function loadJson(path, fallback = {}) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}

function saveJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2));
}

/**
 * Download a file from a URL to a local path.
 */
async function downloadFile(url, destPath, headers = {}) {
  const resp = await fetch(url, { headers });
  if (!resp.ok) throw new Error(`Download failed: ${resp.status} ${resp.statusText}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  writeFileSync(destPath, buffer);
  return destPath;
}

/**
 * Download a Sketchfab model by UID, extract GLB/GLTF.
 */
async function downloadSketchfabModel(uid, icao, token) {
  console.log(`  [sketchfab] Downloading model ${uid}...`);

  // Get download URL
  const dlResp = await fetch(`https://api.sketchfab.com/v3/models/${uid}/download`, {
    headers: { Authorization: `Token ${token}` },
  });
  if (!dlResp.ok) throw new Error(`Sketchfab download API: ${dlResp.status}`);
  const dlData = await dlResp.json();
  const gltfUrl = dlData.gltf?.url;
  if (!gltfUrl) throw new Error('No glTF download URL in response');

  // Download zip
  mkdirSync(MODELS_DIR, { recursive: true });
  const zipPath = join(MODELS_DIR, `${icao}.zip`);
  const extractDir = join(MODELS_DIR, `${icao}_tmp`);

  await downloadFile(gltfUrl, zipPath);
  console.log(`  [sketchfab] Downloaded zip (${Math.round(readFileSync(zipPath).length / 1024)}KB)`);

  // Extract
  mkdirSync(extractDir, { recursive: true });
  execSync(`unzip -o -q "${zipPath}" -d "${extractDir}"`, { stdio: 'pipe' });

  // Find GLB or GLTF
  const findGlb = execSync(`find "${extractDir}" -name "*.glb" -o -name "scene.gltf" | head -1`, { encoding: 'utf8' }).trim();
  if (!findGlb) {
    rmSync(extractDir, { recursive: true, force: true });
    rmSync(zipPath, { force: true });
    throw new Error('No GLB or scene.gltf found in archive');
  }

  // Copy to final location
  const ext = findGlb.endsWith('.glb') ? '.glb' : '.gltf';
  const finalPath = join(MODELS_DIR, `${icao}${ext}`);

  if (ext === '.gltf') {
    // GLTF needs its directory (textures, bins)
    const gltfDir = join(MODELS_DIR, icao);
    if (existsSync(gltfDir)) rmSync(gltfDir, { recursive: true, force: true });
    execSync(`mv "${extractDir}" "${gltfDir}"`, { stdio: 'pipe' });
    rmSync(zipPath, { force: true });
    const scenePath = join(gltfDir, 'scene.gltf');
    if (existsSync(scenePath)) return scenePath;
    return findGlb; // fallback
  }

  execSync(`cp "${findGlb}" "${finalPath}"`, { stdio: 'pipe' });
  rmSync(extractDir, { recursive: true, force: true });
  rmSync(zipPath, { force: true });

  console.log(`  [sketchfab] Saved: ${finalPath}`);
  return finalPath;
}

/**
 * Search Sketchfab for a model matching the aircraft name.
 */
async function searchSketchfab(query, token) {
  // Check search cache
  const cache = loadJson(SEARCH_CACHE_PATH, {});
  if (cache[query]) {
    console.log(`  [sketchfab] Search cache hit: ${query}`);
    return cache[query];
  }

  const params = new URLSearchParams({
    type: 'models',
    q: query,
    downloadable: 'true',
    archives_flavours: 'gltf',
    sort_by: '-likeCount',
    count: '5',
  });

  const resp = await fetch(`https://api.sketchfab.com/v3/search?${params}`, {
    headers: { Authorization: `Token ${token}` },
  });
  if (!resp.ok) throw new Error(`Sketchfab search: ${resp.status}`);
  const data = await resp.json();

  const results = (data.results || [])
    .filter(r => r.isDownloadable)
    .map(r => ({ uid: r.uid, name: r.name, likes: r.likeCount }));

  // Cache results
  cache[query] = results;
  saveJson(SEARCH_CACHE_PATH, cache);

  return results;
}

/**
 * Resolve a 3D model for an ICAO code.
 * @returns {{ modelPath: string, source: string } | null}
 */
export async function resolveModel(icaoCode, specs = {}) {
  const icao = icaoCode.toUpperCase();

  // Step 1: Local cache
  for (const ext of ['.glb', '.gltf']) {
    const cached = join(MODELS_DIR, `${icao}${ext}`);
    if (existsSync(cached)) {
      console.log(`  [model] Cache hit: ${cached}`);
      return { modelPath: cached, source: 'cache' };
    }
  }
  // Also check for GLTF directory
  const gltfDir = join(MODELS_DIR, icao, 'scene.gltf');
  if (existsSync(gltfDir)) {
    console.log(`  [model] Cache hit: ${gltfDir}`);
    return { modelPath: gltfDir, source: 'cache' };
  }

  const token = getSketchfabToken();
  if (!token) {
    console.log('  [model] No SKETCHFAB_TOKEN — skipping download');
    return resolveDefault(specs.category);
  }

  // Step 2: Curated Sketchfab ID
  const curated = loadJson(CURATED_PATH, { models: {} });
  const entry = curated.models?.[icao];
  if (entry?.id) {
    try {
      const path = await downloadSketchfabModel(entry.id, icao, token);
      return { modelPath: path, source: 'sketchfab-curated' };
    } catch (e) {
      console.log(`  [model] Curated download failed: ${e.message}`);
    }
  }

  // Step 3: Sketchfab search — keep query short for better results
  const name = specs.name || icao;
  const query = name.replace(/family|series|next generation/gi, '').trim();
  try {
    const results = await searchSketchfab(query, token);
    if (results.length > 0) {
      const best = results[0];
      console.log(`  [sketchfab] Found: "${best.name}" (${best.likes} likes)`);
      const path = await downloadSketchfabModel(best.uid, icao, token);
      return { modelPath: path, source: 'sketchfab-search' };
    }
  } catch (e) {
    console.log(`  [model] Sketchfab search failed: ${e.message}`);
  }

  // Step 4: Category fallback
  return resolveDefault(specs.category);
}

function resolveDefault(category) {
  if (!category) return null;
  for (const ext of ['.glb', '.gltf']) {
    const defaultPath = join(DEFAULTS_DIR, `${category}${ext}`);
    if (existsSync(defaultPath)) {
      console.log(`  [model] Using category default: ${defaultPath}`);
      return { modelPath: defaultPath, source: 'default' };
    }
  }
  console.log(`  [model] No model found and no default for "${category}"`);
  return null;
}
