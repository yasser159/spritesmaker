/**
 * Widebody aircraft template (A330, B777, A380)
 * Wider fuselage, large swept wings, 2-4 engine pods
 */
export default function widebody(specs) {
  const {
    wingspan = 60,
    length = 63,
    engines = 2,
    wingSweep = 30,
  } = specs;

  const maxDim = Math.max(wingspan, length);
  const scale = 110 / maxDim;
  const w = wingspan * scale;
  const l = length * scale;
  const cx = 64;
  const cy = 64;

  // Fuselage — wider than narrowbody
  const fuseW = Math.max(14, Math.min(18, w * 0.09));
  const fuseH = l;
  const noseY = cy - fuseH / 2;
  const tailY = cy + fuseH / 2;

  // Wing geometry
  const wingSpan = w / 2;
  const wingChordRoot = fuseH * 0.20;
  const wingChordTip = wingChordRoot * 0.32;
  const sweepRad = (wingSweep * Math.PI) / 180;
  const sweepOffset = wingSpan * Math.tan(sweepRad);
  const wingY = cy - fuseH * 0.06;

  // Engine positions
  const engineW = fuseW * 0.5;
  const engineH = wingChordRoot * 0.45;

  // For 2 engines: place at ~35% span; for 4: inner at ~28%, outer at ~55%
  const enginePositions = [];
  if (engines >= 4) {
    const inner = wingSpan * 0.28;
    const outer = wingSpan * 0.55;
    const innerY = wingY + sweepOffset * 0.28;
    const outerY = wingY + sweepOffset * 0.55;
    enginePositions.push(
      { x: cx - inner, y: innerY }, { x: cx + inner, y: innerY },
      { x: cx - outer, y: outerY }, { x: cx + outer, y: outerY }
    );
  } else {
    const dist = wingSpan * 0.38;
    const ey = wingY + sweepOffset * 0.38;
    enginePositions.push(
      { x: cx - dist, y: ey }, { x: cx + dist, y: ey }
    );
  }

  // Horizontal stabilizer — bigger than narrowbody
  const stabSpan = wingSpan * 0.38;
  const stabChord = wingChordRoot * 0.48;
  const stabSweep = stabSpan * Math.tan(sweepRad * 1.05);
  const stabY = tailY - stabChord * 2;

  // Vertical fin
  const finH = fuseH * 0.14;
  const finBase = wingChordRoot * 0.55;

  const engineSvg = enginePositions.map((ep, i) =>
    `<ellipse cx="${ep.x}" cy="${ep.y}" rx="${engineW / 2}" ry="${engineH / 2}"
      fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>`
  ).join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <!-- Fuselage -->
  <path d="
    M ${cx} ${noseY}
    Q ${cx + fuseW / 2} ${noseY} ${cx + fuseW / 2} ${noseY + fuseW * 0.8}
    L ${cx + fuseW / 2} ${tailY - 3}
    L ${cx} ${tailY}
    L ${cx - fuseW / 2} ${tailY - 3}
    L ${cx - fuseW / 2} ${noseY + fuseW * 0.8}
    Q ${cx - fuseW / 2} ${noseY} ${cx} ${noseY}
    Z"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>

  <!-- Left wing -->
  <polygon points="
    ${cx - fuseW / 2},${wingY}
    ${cx - wingSpan},${wingY + sweepOffset}
    ${cx - wingSpan},${wingY + sweepOffset + wingChordTip}
    ${cx - fuseW / 2},${wingY + wingChordRoot}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>

  <!-- Right wing -->
  <polygon points="
    ${cx + fuseW / 2},${wingY}
    ${cx + wingSpan},${wingY + sweepOffset}
    ${cx + wingSpan},${wingY + sweepOffset + wingChordTip}
    ${cx + fuseW / 2},${wingY + wingChordRoot}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>

  <!-- Engine pods -->
  ${engineSvg}

  <!-- Left horizontal stabilizer -->
  <polygon points="
    ${cx - fuseW / 2},${stabY}
    ${cx - stabSpan},${stabY + stabSweep}
    ${cx - stabSpan},${stabY + stabSweep + stabChord * 0.35}
    ${cx - fuseW / 2},${stabY + stabChord}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>

  <!-- Right horizontal stabilizer -->
  <polygon points="
    ${cx + fuseW / 2},${stabY}
    ${cx + stabSpan},${stabY + stabSweep}
    ${cx + stabSpan},${stabY + stabSweep + stabChord * 0.35}
    ${cx + fuseW / 2},${stabY + stabChord}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>

  <!-- Vertical fin -->
  <polygon points="
    ${cx},${stabY - finH}
    ${cx + 2},${stabY}
    ${cx + 2},${stabY + finBase * 0.5}
    ${cx - 2},${stabY + finBase * 0.5}
    ${cx - 2},${stabY}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>
</svg>`;
}
