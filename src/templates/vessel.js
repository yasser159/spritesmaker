/**
 * Vessel template — multi-type ship silhouettes
 * Supports: cargo, tanker, cruise, fishing, tug, sailboat
 * Hull: pointed bow (top / toward y=0), flat stern (bottom)
 * Fill: #ffffff, stroke: #1f2937, stroke-width: 2
 */
export default function vessel(specs) {
  const {
    wingspan = 30,    // beam (width)
    length = 100,     // LOA
    vesselType = 'cargo',
  } = specs;

  const maxDim = Math.max(wingspan, length);
  const scale = 110 / maxDim;
  const beam = wingspan * scale;
  const loa = length * scale;
  const cx = 64;
  const cy = 64;

  const bowY = cy - loa / 2;
  const sternY = cy + loa / 2;
  const halfBeam = beam / 2;

  // Common hull path — pointed bow, flat stern
  const hullPath = `
    M ${cx} ${bowY}
    C ${cx + halfBeam * 0.4} ${bowY + loa * 0.08}
      ${cx + halfBeam} ${bowY + loa * 0.2}
      ${cx + halfBeam} ${bowY + loa * 0.35}
    L ${cx + halfBeam} ${sternY}
    L ${cx - halfBeam} ${sternY}
    L ${cx - halfBeam} ${bowY + loa * 0.35}
    C ${cx - halfBeam} ${bowY + loa * 0.2}
      ${cx - halfBeam * 0.4} ${bowY + loa * 0.08}
      ${cx} ${bowY}
    Z`;

  const fill = '#ffffff';
  const stroke = '#1f2937';
  const sw = 2;

  switch (vesselType) {
    case 'cargo':
      return cargoVessel(cx, cy, bowY, sternY, halfBeam, loa, hullPath, fill, stroke, sw);
    case 'tanker':
      return tankerVessel(cx, cy, bowY, sternY, halfBeam, loa, hullPath, fill, stroke, sw);
    case 'cruise':
      return cruiseVessel(cx, cy, bowY, sternY, halfBeam, loa, hullPath, fill, stroke, sw);
    case 'fishing':
      return fishingVessel(cx, cy, bowY, sternY, halfBeam, loa, hullPath, fill, stroke, sw);
    case 'tug':
      return tugVessel(cx, cy, bowY, sternY, halfBeam, loa, hullPath, fill, stroke, sw);
    case 'sailboat':
      return sailboatVessel(cx, cy, bowY, sternY, halfBeam, loa, hullPath, fill, stroke, sw);
    default:
      return cargoVessel(cx, cy, bowY, sternY, halfBeam, loa, hullPath, fill, stroke, sw);
  }
}

// --- Sub-templates ---

function cargoVessel(cx, cy, bowY, sternY, halfBeam, loa, hullPath, fill, stroke, sw) {
  // Long hull, rectangular hatch covers, bridge at stern
  const bridgeW = halfBeam * 0.7;
  const bridgeH = loa * 0.1;
  const bridgeY = sternY - loa * 0.18;

  const hatchW = halfBeam * 1.2;
  const hatchH = loa * 0.07;
  const hatchCount = 4;
  const hatchStartY = bowY + loa * 0.28;
  const hatchGap = loa * 0.1;

  const hatches = Array.from({ length: hatchCount }, (_, i) => {
    const hy = hatchStartY + i * hatchGap;
    return `<rect x="${cx - hatchW / 2}" y="${hy}" width="${hatchW}" height="${hatchH}"
      fill="none" stroke="${stroke}" stroke-width="1" rx="1"/>`;
  }).join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <!-- Hull -->
  <path d="${hullPath}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>

  <!-- Cargo hatches -->
  ${hatches}

  <!-- Bridge / superstructure -->
  <rect x="${cx - bridgeW / 2}" y="${bridgeY}" width="${bridgeW}" height="${bridgeH}"
    fill="${fill}" stroke="${stroke}" stroke-width="${sw}" rx="2"/>

  <!-- Bridge windows -->
  <line x1="${cx - bridgeW * 0.35}" y1="${bridgeY + bridgeH * 0.3}"
        x2="${cx + bridgeW * 0.35}" y2="${bridgeY + bridgeH * 0.3}"
    stroke="${stroke}" stroke-width="1"/>

  <!-- Mast -->
  <line x1="${cx}" y1="${bridgeY - loa * 0.04}" x2="${cx}" y2="${bridgeY}"
    stroke="${stroke}" stroke-width="1.5"/>
</svg>`;
}

function tankerVessel(cx, cy, bowY, sternY, halfBeam, loa, hullPath, fill, stroke, sw) {
  // Long hull, pipe manifold (center line), bridge at stern
  const bridgeW = halfBeam * 0.65;
  const bridgeH = loa * 0.1;
  const bridgeY = sternY - loa * 0.17;

  // Pipe manifold — center longitudinal line with cross pipes
  const pipeStartY = bowY + loa * 0.25;
  const pipeEndY = bridgeY - loa * 0.03;
  const crossCount = 5;
  const crossGap = (pipeEndY - pipeStartY) / (crossCount + 1);
  const crossW = halfBeam * 0.6;

  const crosses = Array.from({ length: crossCount }, (_, i) => {
    const py = pipeStartY + (i + 1) * crossGap;
    return `<line x1="${cx - crossW}" y1="${py}" x2="${cx + crossW}" y2="${py}"
      stroke="${stroke}" stroke-width="0.8"/>`;
  }).join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <!-- Hull -->
  <path d="${hullPath}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>

  <!-- Center pipe line -->
  <line x1="${cx}" y1="${pipeStartY}" x2="${cx}" y2="${pipeEndY}"
    stroke="${stroke}" stroke-width="1"/>

  <!-- Cross pipes -->
  ${crosses}

  <!-- Manifold circle -->
  <circle cx="${cx}" cy="${pipeStartY + (pipeEndY - pipeStartY) * 0.5}" r="${halfBeam * 0.12}"
    fill="none" stroke="${stroke}" stroke-width="1"/>

  <!-- Bridge -->
  <rect x="${cx - bridgeW / 2}" y="${bridgeY}" width="${bridgeW}" height="${bridgeH}"
    fill="${fill}" stroke="${stroke}" stroke-width="${sw}" rx="2"/>

  <!-- Funnel -->
  <rect x="${cx - bridgeW * 0.12}" y="${bridgeY - loa * 0.03}"
        width="${bridgeW * 0.24}" height="${loa * 0.03}"
    fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
</svg>`;
}

function cruiseVessel(cx, cy, bowY, sternY, halfBeam, loa, hullPath, fill, stroke, sw) {
  // Wide hull, multiple deck lines, bridge forward, funnel at center
  const bridgeW = halfBeam * 0.8;
  const bridgeH = loa * 0.08;
  const bridgeY = bowY + loa * 0.22;

  // Deck lines
  const deckStartY = bridgeY + bridgeH + loa * 0.02;
  const deckEndY = sternY - loa * 0.08;
  const deckCount = 6;
  const deckGap = (deckEndY - deckStartY) / deckCount;

  const decks = Array.from({ length: deckCount }, (_, i) => {
    const dy = deckStartY + i * deckGap;
    const deckW = halfBeam * (0.85 + (i < 2 ? i * 0.05 : 0.1 - (i - 2) * 0.02));
    return `<line x1="${cx - Math.min(deckW, halfBeam * 0.95)}" y1="${dy}"
                  x2="${cx + Math.min(deckW, halfBeam * 0.95)}" y2="${dy}"
      stroke="${stroke}" stroke-width="0.7"/>`;
  }).join('\n  ');

  // Funnel
  const funnelY = deckStartY + deckGap * 2;
  const funnelW = halfBeam * 0.3;
  const funnelH = loa * 0.05;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <!-- Hull -->
  <path d="${hullPath}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>

  <!-- Bridge (forward) -->
  <rect x="${cx - bridgeW / 2}" y="${bridgeY}" width="${bridgeW}" height="${bridgeH}"
    fill="${fill}" stroke="${stroke}" stroke-width="${sw}" rx="2"/>

  <!-- Deck lines -->
  ${decks}

  <!-- Funnel -->
  <rect x="${cx - funnelW / 2}" y="${funnelY - funnelH}" width="${funnelW}" height="${funnelH}"
    fill="${fill}" stroke="${stroke}" stroke-width="1.5" rx="1"/>

  <!-- Pool area (aft) -->
  <ellipse cx="${cx}" cy="${sternY - loa * 0.12}" rx="${halfBeam * 0.35}" ry="${loa * 0.025}"
    fill="none" stroke="${stroke}" stroke-width="0.8"/>
</svg>`;
}

function fishingVessel(cx, cy, bowY, sternY, halfBeam, loa, hullPath, fill, stroke, sw) {
  // Short hull, crane/boom, bridge aft
  const bridgeW = halfBeam * 0.65;
  const bridgeH = loa * 0.12;
  const bridgeY = sternY - loa * 0.25;

  // Crane boom — angled line from mast forward
  const mastX = cx;
  const mastY = bowY + loa * 0.35;
  const boomEndX = cx + halfBeam * 0.6;
  const boomEndY = bowY + loa * 0.2;

  // Nets / work area
  const workY = bowY + loa * 0.45;
  const workW = halfBeam * 1.0;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <!-- Hull -->
  <path d="${hullPath}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>

  <!-- Mast -->
  <line x1="${mastX}" y1="${mastY - loa * 0.12}" x2="${mastX}" y2="${mastY}"
    stroke="${stroke}" stroke-width="1.5"/>

  <!-- Crane boom -->
  <line x1="${mastX}" y1="${mastY - loa * 0.1}" x2="${boomEndX}" y2="${boomEndY}"
    stroke="${stroke}" stroke-width="1.2"/>

  <!-- Boom cable -->
  <line x1="${boomEndX}" y1="${boomEndY}" x2="${boomEndX}" y2="${boomEndY + loa * 0.08}"
    stroke="${stroke}" stroke-width="0.8" stroke-dasharray="2,2"/>

  <!-- Work deck -->
  <rect x="${cx - workW / 2}" y="${workY}" width="${workW}" height="${loa * 0.06}"
    fill="none" stroke="${stroke}" stroke-width="0.8"/>

  <!-- Bridge -->
  <rect x="${cx - bridgeW / 2}" y="${bridgeY}" width="${bridgeW}" height="${bridgeH}"
    fill="${fill}" stroke="${stroke}" stroke-width="${sw}" rx="2"/>
</svg>`;
}

function tugVessel(cx, cy, bowY, sternY, halfBeam, loa, hullPath, fill, stroke, sw) {
  // Short squat hull, large prominent bridge, tow bollard
  const bridgeW = halfBeam * 1.0;
  const bridgeH = loa * 0.18;
  const bridgeY = bowY + loa * 0.35;

  // Tow bollard at stern
  const bollardY = sternY - loa * 0.1;

  // Funnel — big for a tug
  const funnelW = halfBeam * 0.35;
  const funnelH = loa * 0.08;
  const funnelY = bridgeY - funnelH;

  // Tire fenders (small circles along hull)
  const fenderCount = 3;
  const fenderR = halfBeam * 0.08;
  const fenderStartY = bowY + loa * 0.35;
  const fenderGap = loa * 0.12;

  const leftFenders = Array.from({ length: fenderCount }, (_, i) => {
    const fy = fenderStartY + i * fenderGap;
    return `<circle cx="${cx - halfBeam - 1}" cy="${fy}" r="${fenderR}"
      fill="none" stroke="${stroke}" stroke-width="1"/>`;
  }).join('\n  ');

  const rightFenders = Array.from({ length: fenderCount }, (_, i) => {
    const fy = fenderStartY + i * fenderGap;
    return `<circle cx="${cx + halfBeam + 1}" cy="${fy}" r="${fenderR}"
      fill="none" stroke="${stroke}" stroke-width="1"/>`;
  }).join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <!-- Hull -->
  <path d="${hullPath}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>

  <!-- Bridge (large) -->
  <rect x="${cx - bridgeW / 2}" y="${bridgeY}" width="${bridgeW}" height="${bridgeH}"
    fill="${fill}" stroke="${stroke}" stroke-width="${sw}" rx="3"/>

  <!-- Bridge windows -->
  <line x1="${cx - bridgeW * 0.35}" y1="${bridgeY + bridgeH * 0.25}"
        x2="${cx + bridgeW * 0.35}" y2="${bridgeY + bridgeH * 0.25}"
    stroke="${stroke}" stroke-width="1"/>

  <!-- Funnel -->
  <rect x="${cx - funnelW / 2}" y="${funnelY}" width="${funnelW}" height="${funnelH}"
    fill="${fill}" stroke="${stroke}" stroke-width="1.5" rx="1"/>

  <!-- Tow bollard -->
  <circle cx="${cx}" cy="${bollardY}" r="${halfBeam * 0.12}"
    fill="none" stroke="${stroke}" stroke-width="1.5"/>

  <!-- Fenders -->
  ${leftFenders}
  ${rightFenders}
</svg>`;
}

function sailboatVessel(cx, cy, bowY, sternY, halfBeam, loa, hullPath, fill, stroke, sw) {
  // Narrow hull, mast line, main sail triangle, jib

  // Mast
  const mastY1 = bowY + loa * 0.2;
  const mastY2 = sternY - loa * 0.15;

  // Main sail — triangle from mast aft
  const sailTopY = mastY1 + loa * 0.02;
  const sailBottomY = mastY2 - loa * 0.02;
  const sailWidth = halfBeam * 0.85;

  // Jib — smaller triangle forward
  const jibTopY = mastY1;
  const jibBottomY = mastY1 + loa * 0.25;
  const jibWidth = halfBeam * 0.5;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <!-- Hull -->
  <path d="${hullPath}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>

  <!-- Mast -->
  <line x1="${cx}" y1="${mastY1}" x2="${cx}" y2="${mastY2}"
    stroke="${stroke}" stroke-width="1.5"/>

  <!-- Main sail (starboard side) -->
  <polygon points="
    ${cx},${sailTopY}
    ${cx + sailWidth},${(sailTopY + sailBottomY) * 0.5}
    ${cx},${sailBottomY}"
    fill="none" stroke="${stroke}" stroke-width="1"/>

  <!-- Jib (port side, forward) -->
  <polygon points="
    ${cx},${jibTopY}
    ${cx - jibWidth},${(jibTopY + jibBottomY) * 0.55}
    ${cx},${jibBottomY}"
    fill="none" stroke="${stroke}" stroke-width="1"/>

  <!-- Boom -->
  <line x1="${cx}" y1="${sailBottomY}" x2="${cx + sailWidth * 0.8}" y2="${sailBottomY}"
    stroke="${stroke}" stroke-width="1"/>

  <!-- Rudder hint -->
  <line x1="${cx}" y1="${sternY}" x2="${cx}" y2="${sternY + loa * 0.03}"
    stroke="${stroke}" stroke-width="1.5"/>
</svg>`;
}
