/**
 * Regional jet template (CRJ, E170, ERJ)
 * Shorter/narrower than narrowbody, T-tail option, rear-mounted or underwing engines
 */
export default function regional(specs) {
  const {
    wingspan = 26,
    length = 30,
    engines = 2,
    enginePlacement = 'rear',  // 'rear' or 'underwing'
    tailType = 'T',            // 'T' or 'conventional'
    wingSweep = 22,
  } = specs;

  const maxDim = Math.max(wingspan, length);
  const scale = 110 / maxDim;
  const w = wingspan * scale;
  const l = length * scale;
  const cx = 64;
  const cy = 64;

  // Fuselage — narrower/shorter than narrowbody
  const fuseW = Math.max(8, Math.min(10, w * 0.07));
  const fuseH = l;
  const noseY = cy - fuseH / 2;
  const tailY = cy + fuseH / 2;

  // Wing geometry
  const wingSpan = w / 2;
  const wingChordRoot = fuseH * 0.16;
  const wingChordTip = wingChordRoot * 0.42;
  const sweepRad = (wingSweep * Math.PI) / 180;
  const sweepOffset = wingSpan * Math.tan(sweepRad);
  const wingY = cy - fuseH * 0.05;

  // Engine pods
  const engineW = fuseW * 0.6;
  const engineH = wingChordRoot * 0.55;
  let enginesSvg = '';

  if (enginePlacement === 'rear') {
    // Rear-mounted: flanking fuselage near tail
    const ey = tailY - fuseH * 0.15;
    const edist = fuseW / 2 + engineW * 0.6;
    enginesSvg = `
  <ellipse cx="${cx - edist}" cy="${ey}" rx="${engineW / 2}" ry="${engineH / 2}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>
  <ellipse cx="${cx + edist}" cy="${ey}" rx="${engineW / 2}" ry="${engineH / 2}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>`;
  } else {
    // Underwing
    const edist = wingSpan * 0.4;
    const ey = wingY + sweepOffset * 0.4;
    enginesSvg = `
  <ellipse cx="${cx - edist}" cy="${ey}" rx="${engineW / 2}" ry="${engineH / 2}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>
  <ellipse cx="${cx + edist}" cy="${ey}" rx="${engineW / 2}" ry="${engineH / 2}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>`;
  }

  // Tail
  const stabSpan = wingSpan * 0.32;
  const stabChord = wingChordRoot * 0.42;
  const stabSweepOff = stabSpan * Math.tan(sweepRad * 1.1);
  const finH = fuseH * 0.13;
  const finW = wingChordRoot * 0.5;
  const finTopY = tailY - finH - stabChord;

  let tailSvg = '';
  if (tailType === 'T') {
    // T-tail: vertical fin, then horizontal stab on top of fin
    const finBaseY = tailY - stabChord * 0.8;
    tailSvg = `
  <!-- Vertical fin -->
  <polygon points="
    ${cx},${finTopY}
    ${cx + 2},${finBaseY}
    ${cx + 2},${finBaseY + finW * 0.4}
    ${cx - 2},${finBaseY + finW * 0.4}
    ${cx - 2},${finBaseY}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>
  <!-- T-tail horizontal stab (at top of fin) -->
  <polygon points="
    ${cx - stabSpan},${finTopY + stabSweepOff * 0.3}
    ${cx},${finTopY}
    ${cx + stabSpan},${finTopY + stabSweepOff * 0.3}
    ${cx + stabSpan},${finTopY + stabSweepOff * 0.3 + stabChord * 0.35}
    ${cx},${finTopY + stabChord * 0.6}
    ${cx - stabSpan},${finTopY + stabSweepOff * 0.3 + stabChord * 0.35}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>`;
  } else {
    // Conventional tail
    const stabY = tailY - stabChord * 1.8;
    tailSvg = `
  <!-- Vertical fin -->
  <polygon points="
    ${cx},${stabY - finH * 0.5}
    ${cx + 1.5},${stabY}
    ${cx + 1.5},${stabY + finW * 0.5}
    ${cx - 1.5},${stabY + finW * 0.5}
    ${cx - 1.5},${stabY}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>
  <!-- Left stabilizer -->
  <polygon points="
    ${cx - fuseW / 2},${stabY}
    ${cx - stabSpan},${stabY + stabSweepOff}
    ${cx - stabSpan},${stabY + stabSweepOff + stabChord * 0.35}
    ${cx - fuseW / 2},${stabY + stabChord}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>
  <!-- Right stabilizer -->
  <polygon points="
    ${cx + fuseW / 2},${stabY}
    ${cx + stabSpan},${stabY + stabSweepOff}
    ${cx + stabSpan},${stabY + stabSweepOff + stabChord * 0.35}
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

  ${enginesSvg}
  ${tailSvg}
</svg>`;
}
