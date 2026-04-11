/**
 * Turboprop template (ATR 72, Dash 8, King Air)
 * Straight/slightly swept wings, 2 prop discs, high wing option, T-tail
 */
export default function turboprop(specs) {
  const {
    wingspan = 27,
    length = 27,
    engines = 2,
    wingSweep = 5,
    wingPosition = 'high', // 'high' or 'low'
    tailType = 'T',
  } = specs;

  const maxDim = Math.max(wingspan, length);
  const scale = 110 / maxDim;
  const w = wingspan * scale;
  const l = length * scale;
  const cx = 64;
  const cy = 64;

  // Fuselage
  const fuseW = Math.max(9, Math.min(11, w * 0.07));
  const fuseH = l;
  const noseY = cy - fuseH / 2;
  const tailY = cy + fuseH / 2;

  // Wing geometry — nearly straight
  const wingSpan = w / 2;
  const wingChordRoot = fuseH * 0.15;
  const wingChordTip = wingChordRoot * 0.55;
  const sweepRad = (wingSweep * Math.PI) / 180;
  const sweepOffset = wingSpan * Math.tan(sweepRad);
  // High wing sits slightly forward
  const wingY = wingPosition === 'high'
    ? cy - fuseH * 0.12
    : cy - fuseH * 0.02;

  // Prop disc positions — on the wings
  const propDist = wingSpan * 0.38;
  const propY = wingY + sweepOffset * 0.38;
  const propR = wingChordRoot * 0.7;

  // T-tail
  const finH = fuseH * 0.14;
  const finW = wingChordRoot * 0.5;
  const stabSpan = wingSpan * 0.3;
  const stabChord = wingChordRoot * 0.4;
  const stabSweepOff = stabSpan * 0.15;
  const finTopY = tailY - finH - stabChord * 0.5;
  const finBaseY = tailY - stabChord * 0.6;

  let tailSvg = '';
  if (tailType === 'T') {
    tailSvg = `
  <!-- Vertical fin -->
  <polygon points="
    ${cx},${finTopY}
    ${cx + 2},${finBaseY}
    ${cx + 2},${finBaseY + finW * 0.35}
    ${cx - 2},${finBaseY + finW * 0.35}
    ${cx - 2},${finBaseY}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>
  <!-- T-tail horizontal stab -->
  <polygon points="
    ${cx - stabSpan},${finTopY + stabSweepOff}
    ${cx},${finTopY}
    ${cx + stabSpan},${finTopY + stabSweepOff}
    ${cx + stabSpan},${finTopY + stabSweepOff + stabChord * 0.4}
    ${cx},${finTopY + stabChord * 0.55}
    ${cx - stabSpan},${finTopY + stabSweepOff + stabChord * 0.4}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>`;
  } else {
    const stabY = tailY - stabChord * 1.6;
    tailSvg = `
  <!-- Vertical fin -->
  <polygon points="
    ${cx},${stabY - finH * 0.4}
    ${cx + 1.5},${stabY}
    ${cx + 1.5},${stabY + finW * 0.4}
    ${cx - 1.5},${stabY + finW * 0.4}
    ${cx - 1.5},${stabY}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>
  <!-- Left stabilizer -->
  <polygon points="
    ${cx - fuseW / 2},${stabY}
    ${cx - stabSpan},${stabY + stabSweepOff}
    ${cx - stabSpan},${stabY + stabSweepOff + stabChord * 0.4}
    ${cx - fuseW / 2},${stabY + stabChord}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>
  <!-- Right stabilizer -->
  <polygon points="
    ${cx + fuseW / 2},${stabY}
    ${cx + stabSpan},${stabY + stabSweepOff}
    ${cx + stabSpan},${stabY + stabSweepOff + stabChord * 0.4}
    ${cx + fuseW / 2},${stabY + stabChord}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <!-- Fuselage -->
  <path d="
    M ${cx} ${noseY}
    Q ${cx + fuseW / 2} ${noseY} ${cx + fuseW / 2} ${noseY + fuseW}
    L ${cx + fuseW / 2} ${tailY - 2}
    L ${cx} ${tailY}
    L ${cx - fuseW / 2} ${tailY - 2}
    L ${cx - fuseW / 2} ${noseY + fuseW}
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

  <!-- Left prop disc -->
  <circle cx="${cx - propDist}" cy="${propY}" r="${propR}"
    fill="none" stroke="#6B7280" stroke-width="1.5"/>

  <!-- Right prop disc -->
  <circle cx="${cx + propDist}" cy="${propY}" r="${propR}"
    fill="none" stroke="#6B7280" stroke-width="1.5"/>

  ${tailSvg}
</svg>`;
}
