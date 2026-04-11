import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { classify } from './classify.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CACHE_PATH = join(__dirname, '..', 'data', 'specs-cache.json');
const WIKI_MAP_PATH = join(__dirname, '..', 'data', 'icao-to-wiki.json');
const ICAO_TYPES_PATH = join(__dirname, '..', 'data', 'icao-types.json');

// ─── Cache ──────────────────────────────────────────────────────

function loadCache() {
  if (existsSync(CACHE_PATH)) {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
  }
  return {};
}

function saveCache(cache) {
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

function loadWikiMap() {
  if (existsSync(WIKI_MAP_PATH)) {
    return JSON.parse(readFileSync(WIKI_MAP_PATH, 'utf8'));
  }
  return {};
}

// ─── Wikipedia API ──────────────────────────────────────────────

async function searchWikipedia(query) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query + ' aircraft')}&format=json&origin=*`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.query?.search?.length > 0) {
      return data.query.search[0].title;
    }
  } catch (e) {
    console.warn(`  [wiki-search] Failed: ${e.message}`);
  }
  return null;
}

async function fetchWikitext(title) {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&origin=*`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.parse?.wikitext?.['*'] || null;
  } catch (e) {
    console.warn(`  [wiki-fetch] Failed: ${e.message}`);
  }
  return null;
}

// ─── Infobox Parser ─────────────────────────────────────────────

function parseInfobox(wikitext, icaoCode) {
  const specs = {};

  // Extract wingspan (span main, wingspan)
  const wingspanPatterns = [
    /\|\s*span\s*main\s*=\s*.*?(\d+\.?\d*)\s*m/i,
    /\|\s*wingspan\s*=\s*.*?(\d+\.?\d*)\s*m/i,
    /\|\s*span\s*=\s*.*?(\d+\.?\d*)\s*m/i,
    /wingspan[^|]*?(\d+\.?\d*)\s*(?:m|metres|meters)/i,
  ];
  for (const pat of wingspanPatterns) {
    const m = wikitext.match(pat);
    if (m) {
      specs.wingspan = parseFloat(m[1]);
      break;
    }
  }

  // Also try feet → meters conversion
  if (!specs.wingspan) {
    const ftPat = /\|\s*span\s*main\s*=\s*.*?(\d+\.?\d*)\s*ft/i;
    const m = wikitext.match(ftPat);
    if (m) {
      specs.wingspan = Math.round(parseFloat(m[1]) * 0.3048 * 10) / 10;
    }
  }

  // Extract length
  const lengthPatterns = [
    /\|\s*length\s*main\s*=\s*.*?(\d+\.?\d*)\s*m/i,
    /\|\s*length\s*=\s*.*?(\d+\.?\d*)\s*m/i,
    /length[^|]*?(\d+\.?\d*)\s*(?:m|metres|meters)/i,
  ];
  for (const pat of lengthPatterns) {
    const m = wikitext.match(pat);
    if (m) {
      specs.length = parseFloat(m[1]);
      break;
    }
  }

  if (!specs.length) {
    const ftPat = /\|\s*length\s*main\s*=\s*.*?(\d+\.?\d*)\s*ft/i;
    const m = wikitext.match(ftPat);
    if (m) {
      specs.length = Math.round(parseFloat(m[1]) * 0.3048 * 10) / 10;
    }
  }

  // Extract engine count
  const engineCountPat = /\|\s*number\s*of\s*eng\s*=\s*(\d+)/i;
  const ecm = wikitext.match(engineCountPat);
  if (ecm) specs.engines = parseInt(ecm[1], 10);

  // Extract aircraft name from title or first line
  const namePat = /'''([^']+)'''/;
  const nm = wikitext.match(namePat);
  if (nm) specs.name = nm[1];

  // Wing sweep angle
  const sweepPat = /sweep\s*(?:angle)?\s*[=:]\s*(\d+\.?\d*)/i;
  const sw = wikitext.match(sweepPat);
  if (sw) specs.wingSweep = parseFloat(sw[1]);

  return specs;
}

// ─── ICAO Estimate Fallback ─────────────────────────────────────

function estimateFromICAO(icaoCode) {
  const classification = classify(icaoCode);
  if (!classification) return {};

  const { wake, engineType, engineCount } = classification;

  const estimates = {
    L: { wingspan: 12, length: 10 },
    M: { wingspan: 30, length: 37 },
    H: { wingspan: 57, length: 62 },
  };

  const est = estimates[wake] || estimates.M;

  return {
    wingspan: est.wingspan,
    length: est.length,
    engines: engineCount || 2,
    engineType: engineType,
    source: 'icao-estimate',
  };
}

// ─── Engine Placement / Wing Type Heuristics ────────────────────

function inferDetails(specs, classification) {
  const cat = classification?.category || 'narrowbody';

  // Engine placement
  if (!specs.enginePlacement) {
    if (cat === 'widebody' || cat === 'narrowbody') {
      specs.enginePlacement = 'underwing';
    } else if (cat === 'bizjet') {
      specs.enginePlacement = 'rear-fuselage';
    } else if (cat === 'turboprop') {
      specs.enginePlacement = 'wing';
    } else if (cat === 'light-piston') {
      specs.enginePlacement = 'nose';
    } else if (cat === 'helicopter') {
      specs.enginePlacement = 'top';
    } else {
      specs.enginePlacement = 'underwing';
    }
  }

  // Wing type
  if (!specs.wingType) {
    if (cat === 'widebody' || cat === 'narrowbody' || cat === 'bizjet') {
      specs.wingType = 'swept';
    } else if (cat === 'regional') {
      specs.wingType = 'swept';
    } else {
      specs.wingType = 'straight';
    }
  }

  // Wing sweep
  if (!specs.wingSweep) {
    if (specs.wingType === 'swept') {
      specs.wingSweep = cat === 'widebody' ? 32 : 25;
    } else {
      specs.wingSweep = 0;
    }
  }

  // Wing position
  if (!specs.wingPosition) {
    if (cat === 'turboprop' || cat === 'regional') {
      specs.wingPosition = 'high';
    } else if (cat === 'helicopter') {
      specs.wingPosition = 'top';
    } else {
      specs.wingPosition = 'low';
    }
  }

  // Tail type
  if (!specs.tailType) {
    if (cat === 'helicopter') {
      specs.tailType = 'rotor';
    } else {
      specs.tailType = 'conventional';
    }
  }

  return specs;
}

// ─── Main Export ─────────────────────────────────────────────────

/**
 * Fetch specs for an ICAO code.
 * Pipeline: cache → wiki mapping → wiki search → wiki parse → ICAO estimate fallback.
 *
 * @param {string} icaoCode - ICAO type designator (e.g., "B738")
 * @returns {Promise<object>} specs object
 */
export async function fetchSpecs(icaoCode) {
  const code = icaoCode.toUpperCase();
  const cache = loadCache();

  // 1. Check cache
  if (cache[code]) {
    return cache[code];
  }

  const classification = classify(code);
  const wikiMap = loadWikiMap();
  let wikiTitle = wikiMap[code] || null;
  let specs = {};
  let source = 'icao-estimate';

  // 2. Look up or search Wikipedia
  if (!wikiTitle) {
    wikiTitle = await searchWikipedia(code);
  }

  // 3. Fetch and parse Wikipedia article
  if (wikiTitle) {
    const wikitext = await fetchWikitext(wikiTitle);
    if (wikitext) {
      const parsed = parseInfobox(wikitext, code);
      if (parsed.wingspan || parsed.length) {
        specs = { ...specs, ...parsed };
        source = 'wikipedia';
      }
    }
  }

  // 4. Fill gaps with ICAO estimates
  const estimates = estimateFromICAO(code);
  if (!specs.wingspan) specs.wingspan = estimates.wingspan;
  if (!specs.length) specs.length = estimates.length;
  if (!specs.engines) specs.engines = estimates.engines || (classification?.engineCount || 2);
  if (!specs.engineType) specs.engineType = estimates.engineType || classification?.engineType || 'jet';
  if (!specs.name) specs.name = wikiTitle || code;

  // 5. Build full specs object
  const fullSpecs = {
    icao: code,
    name: specs.name,
    wingspan: specs.wingspan,
    length: specs.length,
    engines: specs.engines,
    engineType: specs.engineType,
    enginePlacement: specs.enginePlacement || null,
    wingType: specs.wingType || null,
    wingSweep: specs.wingSweep || null,
    wingPosition: specs.wingPosition || null,
    tailType: specs.tailType || null,
    category: classification?.category || 'narrowbody',
    source,
  };

  // 6. Infer missing details from category heuristics
  inferDetails(fullSpecs, classification);

  // 7. Save to cache
  cache[code] = fullSpecs;
  saveCache(cache);

  return fullSpecs;
}

/**
 * Fetch specs from cache only (offline mode).
 * Returns null if not cached.
 */
export function fetchSpecsFromCache(icaoCode) {
  const cache = loadCache();
  return cache[icaoCode.toUpperCase()] || null;
}
