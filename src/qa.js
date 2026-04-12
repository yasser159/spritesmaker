/**
 * QA scoring engine for generated sprites.
 * Scores each sprite 0-100 on 6 automated checks.
 * Tiers: 80+ auto-approve, 50-79 needs review, <50 auto-reject.
 */
import sharp from 'sharp';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QA_RESULTS_PATH = join(__dirname, '..', 'data', 'qa-results.json');

function loadResults() {
  try { return JSON.parse(readFileSync(QA_RESULTS_PATH, 'utf8')); } catch { return {}; }
}

function saveResults(data) {
  writeFileSync(QA_RESULTS_PATH, JSON.stringify(data, null, 2));
}

// ── Check 1: Coverage (0-20) ─────────────────────────────────────────────────
function checkCoverage(alpha, w, h) {
  const total = w * h;
  const filled = alpha.filter(a => a > 30).length;
  const pct = filled / total * 100;

  let score = 0;
  if (pct >= 15 && pct <= 50) score = 20;
  else if (pct >= 10 && pct <= 60) score = 10;

  return { score, maxScore: 20, pct: Math.round(pct * 10) / 10, filled, total };
}

// ── Check 2: Bounding box efficiency (0-15) ──────────────────────────────────
function checkBboxEfficiency(alpha, w, h) {
  let minX = w, maxX = -1, minY = h, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] > 30) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return { score: 0, maxScore: 15, wRatio: 0, hRatio: 0 };

  const bboxW = maxX - minX + 1;
  const bboxH = maxY - minY + 1;
  const wRatio = bboxW / w;
  const hRatio = bboxH / h;
  const minRatio = Math.min(wRatio, hRatio);

  let score = 0;
  if (minRatio > 0.6) score = 15;
  else if (minRatio > 0.4) score = 8;

  return { score, maxScore: 15, wRatio: Math.round(wRatio * 100) / 100, hRatio: Math.round(hRatio * 100) / 100 };
}

// ── Check 3: Symmetry (0-20) ────────────────────────────────────────────────
function checkSymmetry(alpha, w, h) {
  const midX = Math.floor(w / 2);
  let left = 0, right = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < midX; x++) {
      if (alpha[y * w + x] > 30) left++;
    }
    for (let x = midX; x < w; x++) {
      if (alpha[y * w + x] > 30) right++;
    }
  }

  const ratio = Math.min(left, right) / Math.max(left, right, 1);

  let score = 0;
  if (ratio > 0.85) score = 20;
  else if (ratio > 0.70) score = 10;

  return { score, maxScore: 20, ratio: Math.round(ratio * 100) / 100, left, right };
}

// ── Check 4: Holes (0-15) ───────────────────────────────────────────────────
function checkHoles(alpha, w, h) {
  const filled = alpha.filter(a => a > 30).length;
  if (filled === 0) return { score: 0, maxScore: 15, holePct: 0 };

  // Flood-fill from edges to mark background
  const bg = new Uint8Array(w * h);
  const queue = [];

  // Seed from all border pixels
  for (let x = 0; x < w; x++) {
    if (alpha[x] <= 30) queue.push(x); // top row
    if (alpha[(h - 1) * w + x] <= 30) queue.push((h - 1) * w + x); // bottom row
  }
  for (let y = 0; y < h; y++) {
    if (alpha[y * w] <= 30) queue.push(y * w); // left col
    if (alpha[y * w + w - 1] <= 30) queue.push(y * w + w - 1); // right col
  }

  // BFS flood fill
  for (const idx of queue) bg[idx] = 1;
  let qi = 0;
  while (qi < queue.length) {
    const idx = queue[qi++];
    const x = idx % w, y = Math.floor(idx / w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const ni = ny * w + nx;
      if (bg[ni] || alpha[ni] > 30) continue;
      bg[ni] = 1;
      queue.push(ni);
    }
  }

  // Holes = transparent pixels NOT reached by flood fill
  let holes = 0;
  for (let i = 0; i < w * h; i++) {
    if (alpha[i] <= 30 && !bg[i]) holes++;
  }

  const holePct = holes / Math.max(filled, 1) * 100;

  let score = 0;
  if (holePct < 5) score = 15;
  else if (holePct < 15) score = 8;

  return { score, maxScore: 15, holePct: Math.round(holePct * 10) / 10, holes };
}

// ── Check 5: Color variance (0-15) ──────────────────────────────────────────
function checkColorVariance(pixels, alpha, w, h) {
  // Quantize RGB to 4-bit per channel (16 levels) → count distinct bins
  const bins = new Set();

  for (let i = 0; i < w * h; i++) {
    if (alpha[i] <= 30) continue;
    const r = pixels[i * 4] >> 4;
    const g = pixels[i * 4 + 1] >> 4;
    const b = pixels[i * 4 + 2] >> 4;
    bins.add((r << 8) | (g << 4) | b);
  }

  const distinctColors = bins.size;

  let score = 0;
  if (distinctColors > 3) score = 15;
  else if (distinctColors > 1) score = 8;

  return { score, maxScore: 15, distinctColors };
}

// ── Check 6: Connected components (0-15) ─────────────────────────────────────
function checkConnectedComponents(alpha, w, h) {
  const visited = new Uint8Array(w * h);
  let components = 0;

  for (let i = 0; i < w * h; i++) {
    if (alpha[i] <= 30 || visited[i]) continue;

    // BFS flood fill this component
    components++;
    const queue = [i];
    visited[i] = 1;
    let qi = 0;
    let compSize = 0;

    while (qi < queue.length) {
      const idx = queue[qi++];
      compSize++;
      const x = idx % w, y = Math.floor(idx / w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const ni = ny * w + nx;
        if (visited[ni] || alpha[ni] <= 30) continue;
        visited[ni] = 1;
        queue.push(ni);
      }
    }
  }

  // Filter: only count components with >10 pixels (ignore dust)
  // Re-run counting only large components
  const visited2 = new Uint8Array(w * h);
  let largeComponents = 0;

  for (let i = 0; i < w * h; i++) {
    if (alpha[i] <= 30 || visited2[i]) continue;
    const queue2 = [i];
    visited2[i] = 1;
    let qi2 = 0;
    while (qi2 < queue2.length) {
      const idx = queue2[qi2++];
      const x = idx % w, y = Math.floor(idx / w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const ni = ny * w + nx;
        if (visited2[ni] || alpha[ni] <= 30) continue;
        visited2[ni] = 1;
        queue2.push(ni);
      }
    }
    if (queue2.length > 10) largeComponents++;
  }

  let score = 0;
  if (largeComponents >= 1 && largeComponents <= 3) score = 15;
  else if (largeComponents >= 1 && largeComponents <= 6) score = 8;

  return { score, maxScore: 15, total: components, large: largeComponents };
}

// ── Main scoring function ────────────────────────────────────────────────────

export async function scoreSprite(pngPath) {
  const { data, info } = await sharp(pngPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h } = info;
  const pixels = data;
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    alpha[i] = pixels[i * 4 + 3];
  }

  const checks = {
    coverage: checkCoverage(alpha, w, h),
    bboxEfficiency: checkBboxEfficiency(alpha, w, h),
    symmetry: checkSymmetry(alpha, w, h),
    holes: checkHoles(alpha, w, h),
    colorVariance: checkColorVariance(pixels, alpha, w, h),
    connectedComponents: checkConnectedComponents(alpha, w, h),
  };

  const score = Object.values(checks).reduce((sum, c) => sum + c.score, 0);
  const tier = score >= 80 ? 'approved' : score >= 50 ? 'review' : 'rejected';

  return {
    path: pngPath,
    icao: basename(pngPath, '.png').toUpperCase(),
    score,
    tier,
    checks,
  };
}

export async function scoreAll(dir) {
  const files = readdirSync(dir)
    .filter(f => f.endsWith('.png') && !f.includes('contact-sheet') && !f.includes('debug'))
    .map(f => join(dir, f));

  const results = [];
  for (const f of files) {
    try {
      const result = await scoreSprite(f);
      results.push(result);
    } catch (e) {
      results.push({ path: f, icao: basename(f, '.png').toUpperCase(), score: 0, tier: 'rejected', error: e.message });
    }
  }

  results.sort((a, b) => a.score - b.score);

  const summary = {
    total: results.length,
    approved: results.filter(r => r.tier === 'approved').length,
    review: results.filter(r => r.tier === 'review').length,
    rejected: results.filter(r => r.tier === 'rejected').length,
  };

  // Save results
  const qa = loadResults();
  for (const r of results) {
    qa[r.icao] = { score: r.score, tier: r.tier, checks: r.checks, scoredAt: new Date().toISOString() };
  }
  saveResults(qa);

  // Sort into folders
  for (const tier of ['approved', 'review', 'rejected']) {
    mkdirSync(join(dir, tier), { recursive: true });
  }
  for (const r of results) {
    if (r.error) continue;
    const dest = join(dir, r.tier, basename(r.path));
    try { renameSync(r.path, dest); } catch {}
  }

  return { results, summary };
}

export function approve(icao, outputDir) {
  const qa = loadResults();
  const upper = icao.toUpperCase();
  const reviewPath = join(outputDir, 'review', `${upper}.png`);
  const rejectedPath = join(outputDir, 'rejected', `${upper}.png`);
  const approvedPath = join(outputDir, 'approved', `${upper}.png`);

  mkdirSync(join(outputDir, 'approved'), { recursive: true });

  const src = existsSync(reviewPath) ? reviewPath : existsSync(rejectedPath) ? rejectedPath : null;
  if (!src) {
    console.error(`No sprite found for ${upper} in review/ or rejected/`);
    return false;
  }

  renameSync(src, approvedPath);
  if (qa[upper]) {
    qa[upper].tier = 'approved';
    qa[upper].approvedAt = new Date().toISOString();
  }
  saveResults(qa);
  console.log(`✓ ${upper} → approved/`);
  return true;
}

export function reject(icao, reason, outputDir) {
  const qa = loadResults();
  const upper = icao.toUpperCase();
  const reviewPath = join(outputDir, 'review', `${upper}.png`);
  const approvedPath = join(outputDir, 'approved', `${upper}.png`);
  const rejectedPath = join(outputDir, 'rejected', `${upper}.png`);

  mkdirSync(join(outputDir, 'rejected'), { recursive: true });

  const src = existsSync(reviewPath) ? reviewPath : existsSync(approvedPath) ? approvedPath : null;
  if (!src) {
    console.error(`No sprite found for ${upper} in review/ or approved/`);
    return false;
  }

  renameSync(src, rejectedPath);
  if (qa[upper]) {
    qa[upper].tier = 'rejected';
    qa[upper].reason = reason;
    qa[upper].rejectedAt = new Date().toISOString();
  }
  saveResults(qa);
  console.log(`✗ ${upper} → rejected/ (${reason})`);
  return true;
}
