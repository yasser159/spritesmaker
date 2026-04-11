import sharp from 'sharp';

/**
 * Validate that a rendered sprite has its nose pointing north (top).
 *
 * Reads the PNG, samples the center column, and compares
 * non-transparent pixel density in the top strip vs the bottom strip.
 * A valid nose-north sprite has more alpha coverage at the top-center.
 *
 * @param {string} pngPath - Path to the PNG file to validate
 * @returns {{ valid: boolean, topAlpha: number, botAlpha: number }}
 */
export async function validate(pngPath) {
  const { data, info } = await sharp(pngPath)
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;

  // Sample the center column strip (center 20% of width)
  const stripLeft = Math.floor(width * 0.4);
  const stripRight = Math.ceil(width * 0.6);
  const halfHeight = Math.floor(height / 2);

  let topAlpha = 0;
  let botAlpha = 0;
  let topPixels = 0;
  let botPixels = 0;

  for (let y = 0; y < height; y++) {
    for (let x = stripLeft; x < stripRight; x++) {
      const idx = (y * width + x) * channels;
      const alpha = data[idx + 3]; // Alpha channel (4th channel, RGBA)

      if (y < halfHeight) {
        topAlpha += alpha;
        topPixels++;
      } else {
        botAlpha += alpha;
        botPixels++;
      }
    }
  }

  // Normalize to average alpha per pixel
  const topAvg = topPixels > 0 ? Math.round(topAlpha / topPixels) : 0;
  const botAvg = botPixels > 0 ? Math.round(botAlpha / botPixels) : 0;

  return {
    valid: topAvg > botAvg,
    topAlpha: topAvg,
    botAlpha: botAvg,
  };
}
