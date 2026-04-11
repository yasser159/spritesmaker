/**
 * Light piston aircraft template (Cessna 172, Piper PA28)
 * Straight wings, single prop disc at nose, simple conventional tail, short fuselage
 */
export default function lightPiston(specs) {
  const {
    wingspan = 11,
    length = 8,
    wingPosition = 'high', // 'high' or 'low'
  } = specs;

  const maxDim = Math.max(wingspan, length);
  const scale = 110 / maxDim;
  const w = wingspan * scale;
  const l = length * scale;
  const cx = 64;
  const cy = 64;

  // Fuselage — short and narrow
  const fuseW = Math.max(7, Math.min(9, w * 0.06));
  const fuseH = l;
  const noseY = cy - fuseH / 2;
  const tailY = cy + fuseH / 2;

  // Straight wings — no sweep
  const wingSpan = w / 2;
  const wingChordRoot = fuseH * 0.18;
  const wingChordTip = wingChordRoot * 0.7;
  const wingY = wingPosition === 'high'
    ? cy - fuseH * 0.15
    : cy + fuseH * 0.02;

  // Nose prop disc
  const propR = wingSpan * 0.14;
  const propY = noseY - propR * 0.3;

  // Conventional tail
  const stabSpan = wingSpan * 0.3;
  const stabChord = wingChordRoot * 0.5;
  const stabY = tailY - stabChord * 1.5;
  const finH = fuseH * 0.12;
  const finW = stabChord * 0.6;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <!-- Nose prop disc -->
  <circle cx="${cx}" cy="${propY}" r="${propR}"
    fill="none" stroke="#6B7280" stroke-width="1.5"/>

  <!-- Fuselage -->
  <path d="
    M ${cx} ${noseY}
    Q ${cx + fuseW / 2} ${noseY} ${cx + fuseW / 2} ${noseY + fuseW * 0.6}
    L ${cx + fuseW / 2} ${tailY - 2}
    L ${cx} ${tailY}
    L ${cx - fuseW / 2} ${tailY - 2}
    L ${cx - fuseW / 2} ${noseY + fuseW * 0.6}
    Q ${cx - fuseW / 2} ${noseY} ${cx} ${noseY}
    Z"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>

  <!-- Left wing (straight) -->
  <polygon points="
    ${cx - fuseW / 2},${wingY}
    ${cx - wingSpan},${wingY}
    ${cx - wingSpan},${wingY + wingChordTip}
    ${cx - fuseW / 2},${wingY + wingChordRoot}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>

  <!-- Right wing (straight) -->
  <polygon points="
    ${cx + fuseW / 2},${wingY}
    ${cx + wingSpan},${wingY}
    ${cx + wingSpan},${wingY + wingChordTip}
    ${cx + fuseW / 2},${wingY + wingChordRoot}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>

  <!-- Vertical fin -->
  <polygon points="
    ${cx},${stabY - finH}
    ${cx + 1.5},${stabY}
    ${cx + 1.5},${stabY + finW}
    ${cx - 1.5},${stabY + finW}
    ${cx - 1.5},${stabY}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>

  <!-- Left horizontal stabilizer -->
  <polygon points="
    ${cx - fuseW / 2},${stabY}
    ${cx - stabSpan},${stabY}
    ${cx - stabSpan},${stabY + stabChord * 0.5}
    ${cx - fuseW / 2},${stabY + stabChord}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>

  <!-- Right horizontal stabilizer -->
  <polygon points="
    ${cx + fuseW / 2},${stabY}
    ${cx + stabSpan},${stabY}
    ${cx + stabSpan},${stabY + stabChord * 0.5}
    ${cx + fuseW / 2},${stabY + stabChord}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>
</svg>`;
}
