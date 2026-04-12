/**
 * Node wrapper for Blender headless rendering.
 * Invokes blender --background --python blender-render.py
 */
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BLENDER = process.env.BLENDER_PATH || '/opt/homebrew/bin/blender';
const SCRIPT = join(__dirname, 'blender-render.py');

/**
 * Render a 3D model to a top-down PNG sprite via Blender.
 * @param {string} modelPath - Path to GLB/GLTF model
 * @param {string} outputPath - Path for output PNG
 * @param {number} size - Sprite size in pixels (default 128)
 * @returns {{ success: boolean, output?: string, rotated?: boolean, error?: string }}
 */
export async function render3d(modelPath, outputPath, size = 128) {
  const cmd = [
    `"${BLENDER}"`,
    '--background',
    '--python', `"${SCRIPT}"`,
    '--',
    '--model', `"${modelPath}"`,
    '--output', `"${outputPath}"`,
    '--size', String(size),
  ].join(' ');

  console.log(`  [blender] Rendering ${modelPath}...`);

  try {
    const stdout = execSync(cmd, {
      encoding: 'utf8',
      timeout: 120_000,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024, // 10MB — Blender is chatty
    });

    // Parse JSON result from last lines of stdout
    const lines = stdout.trim().split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('{')) {
        try {
          const result = JSON.parse(line);
          if (result.success) {
            console.log(`  [blender] Done: ${outputPath}${result.rotated ? ' (rotated 180°)' : ''}`);
          }
          return result;
        } catch {}
      }
    }

    return { success: false, error: 'No JSON output from Blender script' };
  } catch (e) {
    const stderr = e.stderr?.toString() || '';
    const msg = stderr.split('\n').filter(l => l && !l.includes('Blender')).slice(-3).join(' ');
    return { success: false, error: msg || e.message };
  }
}
