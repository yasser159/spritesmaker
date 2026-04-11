/**
 * Business jet template (Citation, Gulfstream, Learjet)
 * Small swept wings, 2 rear-mounted engines, T-tail, narrow fuselage
 */
export default function bizjet(specs) {
  const {
    wingspan = 19,
    length = 20,
    engines = 2,
    wingSweep = 28,
  } = specs;

  const maxDim = Math.max(wingspan, length);
  const scale = 110 / maxDim;
  const w = wingspan * scale;
  const l = length * scale;
  const cx = 64;
  const cy = 64;

  // Fuselage — narrow, shorter than narrowbody
  const fuseW = Math.max(7, Math.min(9, w * 0.06));
  const fuseH = l;
  const noseY = cy - fuseH / 2;
  const tailY = cy + fuseH / 2;

  // Wing geometry — small, swept
  const wingSpan = w / 2;
  const wingChordRoot = fuseH * 0.16;
  const wingChordTip = wingChordRoot * 0.38;
  const sweepRad = (wingSweep * Math.PI) / 180;
  const sweepOffset = wingSpan * Math.tan(sweepRad);
  const wingY = cy - fuseH * 0.02;

  // Rear-mounted engines — flanking fuselage near tail
  const engineW = fuseW * 0.6;
  const engineH = wingChordRoot * 0.5;
  const engineY = tailY - fuseH * 0.16;
  const engineDist = fuseW / 2 + engineW * 0.65;

  // T-tail
  const finH = fuseH * 0.15;
  const finW = wingChordRoot * 0.5;
  const stabSpan = wingSpan * 0.32;
  const stabChord = wingChordRoot * 0.38;
  const stabSweep = stabSpan * 0.18;
  const finTopY = tailY - finH - stabChord * 0.4;
  const finBaseY = tailY - stabChord * 0.6;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <!-- Fuselage -->
  <path d="
    M ${cx} ${noseY}
    Q ${cx + fuseW / 2} ${noseY} ${cx + fuseW / 2} ${noseY + fuseW * 0.7}
    L ${cx + fuseW / 2} ${tailY - 2}
    L ${cx} ${tailY}
    L ${cx - fuseW / 2} ${tailY - 2}
    L ${cx - fuseW / 2} ${noseY + fuseW * 0.7}
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

  <!-- Left rear engine -->
  <ellipse cx="${cx - engineDist}" cy="${engineY}" rx="${engineW / 2}" ry="${engineH / 2}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>

  <!-- Right rear engine -->
  <ellipse cx="${cx + engineDist}" cy="${engineY}" rx="${engineW / 2}" ry="${engineH / 2}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>

  <!-- Vertical fin -->
  <polygon points="
    ${cx},${finTopY}
    ${cx + 1.8},${finBaseY}
    ${cx + 1.8},${finBaseY + finW * 0.35}
    ${cx - 1.8},${finBaseY + finW * 0.35}
    ${cx - 1.8},${finBaseY}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>

  <!-- T-tail horizontal stab -->
  <polygon points="
    ${cx - stabSpan},${finTopY + stabSweep}
    ${cx},${finTopY}
    ${cx + stabSpan},${finTopY + stabSweep}
    ${cx + stabSpan},${finTopY + stabSweep + stabChord * 0.4}
    ${cx},${finTopY + stabChord * 0.55}
    ${cx - stabSpan},${finTopY + stabSweep + stabChord * 0.4}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>
</svg>`;
}
