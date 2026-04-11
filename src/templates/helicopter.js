/**
 * Helicopter / rotorcraft template
 * Main rotor disc, elliptical body, tail boom, tail rotor
 */
export default function helicopter(specs) {
  const {
    wingspan = 15,   // rotor diameter used as "wingspan" equivalent
    length = 18,     // nose-to-tail overall length
  } = specs;

  const maxDim = Math.max(wingspan, length);
  const scale = 110 / maxDim;
  const rotorDiam = wingspan * scale;
  const l = length * scale;
  const cx = 64;
  const cy = 64;

  // Main rotor disc
  const rotorR = rotorDiam / 2;

  // Body — elliptical, centered slightly forward
  const bodyW = rotorDiam * 0.28;
  const bodyH = l * 0.35;
  const bodyCy = cy - l * 0.05;

  // Tail boom — thin line extending down (aft)
  const boomStartY = bodyCy + bodyH / 2;
  const boomEndY = cy + l / 2;
  const boomW = bodyW * 0.18;

  // Tail rotor — small disc at end of boom
  const tailRotorR = rotorR * 0.16;
  const tailRotorX = cx + bodyW * 0.35;
  const tailRotorY = boomEndY;

  // Skids / landing gear (two small lines under body)
  const skidW = bodyW * 0.7;
  const skidY = bodyCy + bodyH / 2 - 1;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <!-- Main rotor disc -->
  <circle cx="${cx}" cy="${cy - l * 0.08}" r="${rotorR}"
    fill="none" stroke="#6B7280" stroke-width="1.5"/>

  <!-- Rotor hub (small filled circle) -->
  <circle cx="${cx}" cy="${cy - l * 0.08}" r="${rotorR * 0.06}"
    fill="#6B7280" stroke="none"/>

  <!-- Body (ellipse) -->
  <ellipse cx="${cx}" cy="${bodyCy}" rx="${bodyW / 2}" ry="${bodyH / 2}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>

  <!-- Cockpit windshield hint -->
  <ellipse cx="${cx}" cy="${bodyCy - bodyH * 0.28}" rx="${bodyW * 0.3}" ry="${bodyH * 0.12}"
    fill="#6B7280" stroke="none" opacity="0.3"/>

  <!-- Tail boom -->
  <rect x="${cx - boomW / 2}" y="${boomStartY}" width="${boomW}" height="${boomEndY - boomStartY}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>

  <!-- Tail fin (small vertical stabilizer at boom end) -->
  <polygon points="
    ${cx},${boomEndY - tailRotorR * 2.5}
    ${cx + boomW * 1.2},${boomEndY}
    ${cx - boomW * 0.6},${boomEndY}"
    fill="#9CA3AF" stroke="#6B7280" stroke-width="1.5"/>

  <!-- Tail rotor disc -->
  <circle cx="${tailRotorX}" cy="${tailRotorY}" r="${tailRotorR}"
    fill="none" stroke="#6B7280" stroke-width="1.5"/>

  <!-- Left skid -->
  <line x1="${cx - skidW / 2}" y1="${skidY}" x2="${cx - skidW / 2}" y2="${skidY + bodyH * 0.3}"
    stroke="#6B7280" stroke-width="1.5"/>
  <line x1="${cx - skidW / 2 - 1}" y1="${skidY + bodyH * 0.3}"
        x2="${cx - skidW / 2 + bodyW * 0.15}" y2="${skidY + bodyH * 0.3}"
    stroke="#6B7280" stroke-width="1.5"/>

  <!-- Right skid -->
  <line x1="${cx + skidW / 2}" y1="${skidY}" x2="${cx + skidW / 2}" y2="${skidY + bodyH * 0.3}"
    stroke="#6B7280" stroke-width="1.5"/>
  <line x1="${cx + skidW / 2 - bodyW * 0.15}" y1="${skidY + bodyH * 0.3}"
        x2="${cx + skidW / 2 + 1}" y2="${skidY + bodyH * 0.3}"
    stroke="#6B7280" stroke-width="1.5"/>
</svg>`;
}
