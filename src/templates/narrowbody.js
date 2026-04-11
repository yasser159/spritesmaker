/**
 * Narrowbody aircraft template (A320, B737 family)
 * Narrow fuselage, swept wings, 2 underwing engines, conventional tail
 */
export default function narrowbody(specs) {
  const {
    wingspan = 35,
    length = 38,
    engines = 2,
    wingSweep = 25,
  } = specs;

  // Scale into 128×128 with padding (max ~110px)
  const maxDim = Math.max(wingspan, length);
  const scale = 110 / maxDim;
  const w = wingspan * scale;
  const l = length * scale;
  const cx = 64;
  const cy = 64;

  // Fuselage dimensions
  const fuseW = Math.max(10, Math.min(12, w * 0.08));
  const fuseH = l;
  const noseY = cy - fuseH / 2;
  const tailY = cy + fuseH / 2;

  // Wing geometry
  const wingSpan = w / 2;
  const wingChordRoot = fuseH * 0.18;
  const wingChordTip = wingChordRoot * 0.4;
  const sweepRad = (wingSweep * Math.PI) / 180;
  const sweepOffset = wingSpan * Math.tan(sweepRad);
  const wingY = cy - fuseH * 0.05; // wings slightly forward of center

  // Engine pod positions (roughly 1/3 out on wing)
  const engineDist = wingSpan * 0.4;
  const engineY = wingY + sweepOffset * 0.4;
  const engineW = fuseW * 0.55;
  const engineH = wingChordRoot * 0.55;

  // Horizontal stabilizer
  const stabSpan = wingSpan * 0.35;
  const stabChord = wingChordRoot * 0.45;
  const stabSweep = stabSpan * Math.tan(sweepRad * 1.1);
  const stabY = tailY - stabChord * 1.8;

  // Vertical fin
  const finH = fuseH * 0.12;
  const finW = wingChordRoot * 0.5;

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

  <!-- Left engine pod -->
  <ellipse cx="${cx - engineDist}" cy="${engineY}" rx="${engineW / 2}" ry="${engineH / 2}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>

  <!-- Right engine pod -->
  <ellipse cx="${cx + engineDist}" cy="${engineY}" rx="${engineW / 2}" ry="${engineH / 2}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>

  <!-- Left horizontal stabilizer -->
  <polygon points="
    ${cx - fuseW / 2},${stabY}
    ${cx - stabSpan},${stabY + stabSweep}
    ${cx - stabSpan},${stabY + stabSweep + stabChord * 0.4}
    ${cx - fuseW / 2},${stabY + stabChord}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>

  <!-- Right horizontal stabilizer -->
  <polygon points="
    ${cx + fuseW / 2},${stabY}
    ${cx + stabSpan},${stabY + stabSweep}
    ${cx + stabSpan},${stabY + stabSweep + stabChord * 0.4}
    ${cx + fuseW / 2},${stabY + stabChord}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>

  <!-- Vertical fin -->
  <polygon points="
    ${cx},${stabY - finH}
    ${cx + 1.5},${stabY}
    ${cx + 1.5},${stabY + finW * 0.6}
    ${cx - 1.5},${stabY + finW * 0.6}
    ${cx - 1.5},${stabY}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>
</svg>`;
}
