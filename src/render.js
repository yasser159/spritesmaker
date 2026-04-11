import sharp from 'sharp';

/**
 * Render an SVG string to a 128x128 PNG file.
 *
 * @param {string} svg - SVG markup string
 * @param {string} outPath - Output file path for the PNG
 */
export async function render(svg, outPath) {
  await sharp(Buffer.from(svg))
    .resize(128, 128)
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}
