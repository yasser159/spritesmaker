/**
 * Fighter jet template (F-16, F-18, Eurofighter)
 * Delta/highly swept wings, narrow pointed fuselage, 1-2 integrated engines, optional canards
 */
export default function fighter(specs) {
  const {
    wingspan = 10,
    length = 15,
    engines = 1,
    wingSweep = 45,
    wingType = 'delta',   // 'delta' or 'swept'
  } = specs;

  const maxDim = Math.max(wingspan, length);
  const scale = 110 / maxDim;
  const w = wingspan * scale;
  const l = length * scale;
  const cx = 64;
  const cy = 64;

  // Fuselage — narrow, pointed nose
  const fuseW = Math.max(6, Math.min(9, w * 0.06));
  const fuseH = l;
  const noseY = cy - fuseH / 2;
  const tailY = cy + fuseH / 2;

  // Wing geometry
  const wingSpan = w / 2;
  const sweepRad = (wingSweep * Math.PI) / 180;

  let wingSvg = '';

  if (wingType === 'delta') {
    // Delta wings — triangular, leading edge starts near nose, trailing at tail
    const wingLeadY = cy - fuseH * 0.15;
    const wingTrailY = cy + fuseH * 0.22;
    wingSvg = `
  <!-- Left delta wing -->
  <polygon points="
    ${cx - fuseW / 2},${wingLeadY}
    ${cx - wingSpan},${wingTrailY}
    ${cx - fuseW / 2},${wingTrailY}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>
  <!-- Right delta wing -->
  <polygon points="
    ${cx + fuseW / 2},${wingLeadY}
    ${cx + wingSpan},${wingTrailY}
    ${cx + fuseW / 2},${wingTrailY}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>`;
  } else {
    // Highly swept wings
    const wingChordRoot = fuseH * 0.2;
    const wingChordTip = wingChordRoot * 0.25;
    const sweepOffset = wingSpan * Math.tan(sweepRad);
    const wingY = cy - fuseH * 0.05;
    wingSvg = `
  <!-- Left swept wing -->
  <polygon points="
    ${cx - fuseW / 2},${wingY}
    ${cx - wingSpan},${wingY + sweepOffset}
    ${cx - wingSpan},${wingY + sweepOffset + wingChordTip}
    ${cx - fuseW / 2},${wingY + wingChordRoot}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>
  <!-- Right swept wing -->
  <polygon points="
    ${cx + fuseW / 2},${wingY}
    ${cx + wingSpan},${wingY + sweepOffset}
    ${cx + wingSpan},${wingY + sweepOffset + wingChordTip}
    ${cx + fuseW / 2},${wingY + wingChordRoot}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>`;
  }

  // Canards (optional — present on Eurofighter-style)
  const canardSpan = wingSpan * 0.32;
  const canardChord = fuseH * 0.06;
  const canardY = cy - fuseH * 0.28;
  const hasCanards = wingType === 'delta' && wingSweep >= 40;
  const canardSvg = hasCanards ? `
  <!-- Left canard -->
  <polygon points="
    ${cx - fuseW / 2},${canardY}
    ${cx - canardSpan},${canardY + canardChord * 0.3}
    ${cx - canardSpan},${canardY + canardChord}
    ${cx - fuseW / 2},${canardY + canardChord}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>
  <!-- Right canard -->
  <polygon points="
    ${cx + fuseW / 2},${canardY}
    ${cx + canardSpan},${canardY + canardChord * 0.3}
    ${cx + canardSpan},${canardY + canardChord}
    ${cx + fuseW / 2},${canardY + canardChord}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>` : '';

  // Exhaust nozzle(s) at rear — small circles
  const exhaustR = fuseW * 0.3;
  let exhaustSvg = '';
  if (engines === 1) {
    exhaustSvg = `
  <circle cx="${cx}" cy="${tailY + 1}" r="${exhaustR}"
    fill="#6B7280" stroke="#6B7280" stroke-width="1"/>`;
  } else {
    const sep = fuseW * 0.35;
    exhaustSvg = `
  <circle cx="${cx - sep}" cy="${tailY + 1}" r="${exhaustR}"
    fill="#6B7280" stroke="#6B7280" stroke-width="1"/>
  <circle cx="${cx + sep}" cy="${tailY + 1}" r="${exhaustR}"
    fill="#6B7280" stroke="#6B7280" stroke-width="1"/>`;
  }

  // Vertical stabilizer(s)
  const finH = fuseH * 0.12;
  const finBase = fuseH * 0.08;
  const finY = tailY - finH - finBase * 0.3;
  let finSvg = '';
  if (engines === 1) {
    // Single fin (F-16 style)
    finSvg = `
  <polygon points="
    ${cx},${finY}
    ${cx + 2},${finY + finH}
    ${cx + 2},${finY + finH + finBase}
    ${cx - 2},${finY + finH + finBase}
    ${cx - 2},${finY + finH}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>`;
  } else {
    // Twin fins canted outward (F-18 style)
    const finSpread = fuseW * 0.7;
    finSvg = `
  <polygon points="
    ${cx - finSpread},${finY}
    ${cx - finSpread + 1.5},${finY + finH}
    ${cx - fuseW * 0.15},${finY + finH + finBase}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>
  <polygon points="
    ${cx + finSpread},${finY}
    ${cx + finSpread - 1.5},${finY + finH}
    ${cx + fuseW * 0.15},${finY + finH + finBase}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>`;
  }

  // Small horizontal stabs
  const stabSpan = wingSpan * 0.22;
  const stabChord = fuseH * 0.05;
  const stabY = tailY - stabChord * 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <!-- Fuselage -->
  <path d="
    M ${cx} ${noseY}
    L ${cx + fuseW * 0.25} ${noseY + fuseH * 0.08}
    L ${cx + fuseW / 2} ${noseY + fuseH * 0.2}
    L ${cx + fuseW / 2} ${tailY}
    L ${cx - fuseW / 2} ${tailY}
    L ${cx - fuseW / 2} ${noseY + fuseH * 0.2}
    L ${cx - fuseW * 0.25} ${noseY + fuseH * 0.08}
    Z"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>

  ${wingSvg}
  ${canardSvg}

  <!-- Left horizontal stab -->
  <polygon points="
    ${cx - fuseW / 2},${stabY}
    ${cx - stabSpan},${stabY + stabChord * 0.3}
    ${cx - stabSpan},${stabY + stabChord}
    ${cx - fuseW / 2},${stabY + stabChord}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>

  <!-- Right horizontal stab -->
  <polygon points="
    ${cx + fuseW / 2},${stabY}
    ${cx + stabSpan},${stabY + stabChord * 0.3}
    ${cx + stabSpan},${stabY + stabChord}
    ${cx + fuseW / 2},${stabY + stabChord}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>

  ${finSvg}
  ${exhaustSvg}
</svg>`;
}
