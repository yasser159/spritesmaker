import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_PATH = join(__dirname, '..', 'data', 'icao-types.json');

let icaoTypes = null;

function loadTypes() {
  if (!icaoTypes) {
    icaoTypes = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
  }
  return icaoTypes;
}

/**
 * Parse the ICAO type encoding string "KWeC" into components.
 * K = Kind: H=Helicopter, L=Landplane, S=Seaplane, A=Amphibian, G=Gyrocopter, T=Tiltrotor
 * W = Wake: L=Light, M=Medium, H=Heavy
 * e = Engine type: P=Piston, T=Turboprop, J=Jet, E=Electric, R=Rocket
 * C = Engine count: 1-9
 */
function parseEncoding(encoding) {
  if (!encoding || encoding.length < 4) return null;

  const kind = encoding[0];        // H, L, S, A, G, T
  const wake = encoding[1];        // L, M, H
  const engineType = encoding[2];  // P, T, J, E, R, -
  const engineCount = encoding[3]; // 1-9, -

  return {
    kind,
    wake,
    engineType: engineType === '-' ? 'unknown' : engineType,
    engineCount: engineCount === '-' ? 0 : parseInt(engineCount, 10),
  };
}

/**
 * Map engine type code to human-readable name.
 */
function engineTypeName(code) {
  const map = {
    P: 'piston',
    T: 'turboprop',
    J: 'jet',
    E: 'electric',
    R: 'rocket',
  };
  return map[code] || 'unknown';
}

/**
 * Classify an ICAO code into a template category.
 *
 * Returns: { category, kind, wake, engineType, engineCount }
 * Returns null if the ICAO code is not found.
 */
export function classify(icaoCode) {
  const types = loadTypes();
  const encoding = types[icaoCode.toUpperCase()];
  if (!encoding) return null;

  const parsed = parseEncoding(encoding);
  if (!parsed) return null;

  const { kind, wake, engineType, engineCount } = parsed;
  let category;

  // Known regional jets (medium wake but regional-sized)
  const REGIONAL_PREFIXES = ['CRJ', 'CR1', 'CR2', 'CR7', 'CR9', 'E135', 'E145', 'E170', 'E175', 'E190', 'E195', 'E75', 'ERJ', 'SF3', 'F70', 'F100', 'BAE', 'D328', 'ARJ'];
  // Known bizjets (medium wake but business jet category)
  const BIZJET_PREFIXES = ['GLF', 'G280', 'GA5', 'GA6', 'GA7', 'CL30', 'CL35', 'CL60', 'BD70', 'LJ', 'H25', 'FA', 'F900', 'F2TH', 'ASTR', 'G150', 'GLEX', 'GL5T', 'GL7T', 'C500', 'C510', 'C525', 'C550', 'C560', 'C56X', 'C650', 'C680', 'C700', 'C750', 'BE4', 'PRM1', 'E50P', 'E55P', 'EA50'];
  // Known fighters
  const FIGHTER_PREFIXES = ['F16', 'F15', 'F18', 'F22', 'F35', 'F14', 'EF20', 'EUFI', 'RFAL', 'TOR', 'MIR', 'SU', 'MIG', 'JAS', 'T38', 'T45', 'A10', 'B1', 'B2', 'F117', 'SR71'];

  const uc = icaoCode.toUpperCase();
  const isRegional = REGIONAL_PREFIXES.some(p => uc.startsWith(p));
  const isBizjet = BIZJET_PREFIXES.some(p => uc.startsWith(p));
  const isFighter = FIGHTER_PREFIXES.some(p => uc.startsWith(p));

  // Classification logic
  if (isFighter) {
    category = 'fighter';
  } else if (kind === 'H' || kind === 'G' || kind === 'T') {
    category = 'helicopter';
  } else if (kind === 'S' || kind === 'A') {
    category = 'light-piston';
  } else if (isRegional) {
    category = 'regional';
  } else if (isBizjet || (wake === 'L' && engineType === 'J')) {
    category = 'bizjet';
  } else if (wake === 'H' && engineType === 'J') {
    category = 'widebody';
  } else if (wake === 'M' && engineType === 'J' && engineCount >= 3) {
    category = 'widebody';
  } else if (wake === 'M' && engineType === 'J') {
    category = 'narrowbody';
  } else if (engineType === 'T') {
    category = 'turboprop';
  } else if (engineType === 'P') {
    category = 'light-piston';
  } else {
    category = 'narrowbody';
  }

  return {
    category,
    kind,
    wake,
    engineType: engineTypeName(engineType),
    engineCount,
  };
}

/**
 * Classify all ICAO codes and return a Map of code → classification.
 */
export function classifyAll() {
  const types = loadTypes();
  const results = new Map();

  for (const code of Object.keys(types)) {
    const classification = classify(code);
    if (classification) {
      results.set(code, classification);
    }
  }

  return results;
}

/**
 * Get all ICAO codes that classify into a given category.
 */
export function getAllCodesForCategory(cat) {
  const types = loadTypes();
  const codes = [];

  for (const code of Object.keys(types)) {
    const classification = classify(code);
    if (classification && classification.category === cat) {
      codes.push(code);
    }
  }

  return codes;
}
