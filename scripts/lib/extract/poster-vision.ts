import { mkdirSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import sharp from 'sharp'
import type { ScrapedSet } from '../../scrapers/types.js'
import { callClaude, extractJsonBlock } from './claude-cli.js'
import { yToTime, formatHour, clusterRows, type AxisCalibration, type Gray } from './pixel-grid.js'

export type PosterDayResult = {
  day: string | null
  stages: string[]
  sets: ScrapedSet[]
  failedStrips: string[]
}

/**
 * Calibrated per-column vision extraction for poster/image timetables.
 *
 * An earlier approach did per-column contrast/border pixel analysis to
 * locate cell edges directly — brittle across posters with different
 * palettes and decorative art (retired). This version instead:
 *
 * 1. Calibration pre-pass — ONE vision call returns the grid's geometry only:
 *    top/bottom hour-line pixel Y (→ a linear pixel→time map), the hour-axis
 *    x-span, and every stage column's x-span. Names/times are NOT asked here.
 * 2. Slice — cut one [hour-axis | single column] strip per stage at native
 *    resolution and FULL height, so a strip's Y coordinates equal the original
 *    image's Y and the calibration map applies unchanged. Column cuts fall in
 *    the empty gaps BETWEEN columns (midpoint of adjacent x-spans), so no
 *    artist text is ever clipped, and the axis is duplicated into every strip.
 * 3. Per-strip read — one vision call per strip reads that single column's set
 *    blocks (artist + top/bottom pixel Y). Reading one narrow strip with the
 *    axis right beside it removes the cross-column crosstalk that made the
 *    whole-poster pass round boundaries to the wrong hour line.
 * 4. Times computed deterministically from the reported Ys (quarter-hour
 *    snapped via yToTime) — the model never does minute arithmetic.
 */

export type VisionCalibration = {
  day: string | null
  first_hour: number
  last_hour: number // > 24 when the grid crosses midnight
  grid_top_y: number // pixel Y of the first-hour line
  grid_bottom_y: number // pixel Y of the last-hour line
  axis: { left: number; right: number } // LEFT hour-axis x-span, fractions of image width (composited into every strip)
  grid: { left: number; right: number } // column area x-span: left edge of first column → right edge of last column
  columns: string[] // stage column names, left to right (gives N and labels; the grid is divided into equal columns)
}

export type VisionBlock = { artist_name: string; is_live: boolean; top_y: number; bottom_y: number }

/**
 * Claude's image input is downscaled to a long-edge cap before the model sees
 * it, and the model reports pixel coordinates in THAT downscaled space. To keep
 * calibration Ys and block Ys in one consistent space, we pre-resize the poster
 * to this cap ourselves and run every vision call + all slicing on the resized
 * working image — so reported coordinates are already 1:1 with what we measure.
 */
export const MAX_DIM = 2000

/** Resize the poster to MAX_DIM long edge (no-op if already smaller). Returns the
 * working image path and its exact dimensions — the single coordinate space all
 * vision coordinates live in. */
export async function prepareWorkImage(imagePath: string, outDir: string): Promise<{ path: string; width: number; height: number }> {
  const meta = await sharp(imagePath).metadata()
  if (!meta.width || !meta.height) throw new Error(`cannot read dimensions of ${imagePath}`)
  const scale = Math.min(1, MAX_DIM / Math.max(meta.width, meta.height))
  const width = Math.round(meta.width * scale)
  const height = Math.round(meta.height * scale)
  const path = join(outDir, `${basename(imagePath).replace(/\.[a-z]+$/i, '')}.work.png`)
  await sharp(imagePath).resize(width, height).png().toFile(path)
  return { path, width, height }
}

export function buildCalibrationPrompt(imagePath: string, width: number, height: number): string {
  return [
    `Read the festival timetable poster image at: ${imagePath}`,
    `The image is ${width}x${height} pixels.`,
    'It is a timetable grid: stage names as column headers, a vertical hour axis on the left, artist names in blocks.',
    'Report ONLY the grid geometry as a JSON object — no markdown fences, no commentary. Do NOT read artist names or set times here:',
    `{
  "day": string | null,      // calendar date of this poster as YYYY-MM-DD if a date/weekday is visible, else null
  "first_hour": number,      // topmost hour number on the axis (24h clock)
  "last_hour": number,       // bottommost hour number; if the grid crosses midnight keep counting up (22:00→06:00 is first_hour 22, last_hour 30)
  "grid_top_y": number,      // pixel Y (0 = image top) of the horizontal grid line at the FIRST hour
  "grid_bottom_y": number,   // pixel Y of the horizontal grid line at the LAST hour
  "axis": { "left": number, "right": number },  // x-span of the LEFT hour-number axis, as fractions of image width
  "grid": { "left": number, "right": number },  // x-span of the COLUMN AREA: left edge of the leftmost stage column → right edge of the rightmost stage column, as fractions of image width (exclude the hour axes)
  "columns": [string]        // stage column header names, verbatim, strictly LEFT TO RIGHT
}`,
    'Rules:',
    '- Be precise on grid_top_y and grid_bottom_y — every time is interpolated linearly between them.',
    '- The columns are equal width and evenly spaced; the grid area is split into columns.length equal columns. So grid.left / grid.right (the OUTER edges, next to the hour axes) matter most — get those two edges right. Interior boundaries are computed, not read.',
    '- List EVERY stage column header left to right, none skipped or duplicated.',
  ].join('\n')
}

export function readVisionCalibration(imagePath: string, width: number, height: number): VisionCalibration | null {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = callClaude(buildCalibrationPrompt(resolve(imagePath), width, height), { tools: 'Read', timeout: 300_000 })
      const c = JSON.parse(extractJsonBlock(raw))
      if (typeof c.first_hour !== 'number' || typeof c.last_hour !== 'number' || c.last_hour <= c.first_hour) continue
      if (typeof c.grid_top_y !== 'number' || typeof c.grid_bottom_y !== 'number') continue
      if (c.grid_bottom_y <= c.grid_top_y || c.grid_bottom_y > height || c.grid_top_y < 0) continue
      if (!c.axis || typeof c.axis.left !== 'number' || typeof c.axis.right !== 'number') continue
      if (!c.grid || typeof c.grid.left !== 'number' || typeof c.grid.right !== 'number' || c.grid.right <= c.grid.left) continue
      if (!Array.isArray(c.columns) || c.columns.length === 0) continue
      if (!c.columns.every((name: any) => typeof name === 'string')) continue
      return c
    } catch (err: any) {
      console.warn(`  ! calibration read failed (${err.stderr?.toString().trim() || err.message || err})${attempt === 0 ? ' — retrying' : ''}`)
    }
  }
  return null
}

export type ColumnStrip = { name: string; path: string; width: number; height: number; axisWidth: number }

/** Margin added to each equal-division column, as a fraction of one column's width. */
export const COLUMN_MARGIN = 0.05

/**
 * Column boundary x-pixels for equal division of the grid area into N columns.
 * Returns N pairs [left, right], each expanded by COLUMN_MARGIN of a column
 * width for safety, clamped to [axisRight, width]. The cuts land on the grid
 * lines in the empty gaps between centered text, so no artist text is clipped —
 * far more robust than reading N imprecise interior boundaries from vision,
 * which lands each strip at its own wrong offset. Assumes uniform column width
 * (true for designed poster grids like Dekmantel).
 */
export function columnBounds(cal: VisionCalibration, width: number, axisRight: number): { left: number; right: number }[] {
  const n = cal.columns.length
  const span = (cal.grid.right - cal.grid.left) / n
  const margin = span * COLUMN_MARGIN
  return cal.columns.map((_, i) => {
    const leftFrac = cal.grid.left + i * span - margin
    const rightFrac = cal.grid.left + (i + 1) * span + margin
    const left = Math.min(width - 10, Math.max(axisRight, Math.round(leftFrac * width)))
    const right = Math.max(left + 10, Math.min(width, Math.round(rightFrac * width)))
    return { left, right }
  })
}

/**
 * Cut one [hour-axis | single column] strip per stage, native resolution, full
 * height (Y stays identical to the original, so calibration applies unchanged).
 * The hour axis is composited into every strip so each read has its own time
 * reference. Columns come from equal division (see columnBounds).
 */
export async function sliceColumns(
  imagePath: string,
  cal: VisionCalibration,
  width: number,
  height: number,
  outDir: string,
): Promise<ColumnStrip[]> {
  mkdirSync(outDir, { recursive: true })

  const axisLeft = Math.max(0, Math.floor(cal.axis.left * width) - 4)
  const axisRight = Math.min(width, Math.ceil(cal.axis.right * width) + 4)
  const axisW = Math.max(10, axisRight - axisLeft)
  const axisBuf = await sharp(imagePath).extract({ left: axisLeft, top: 0, width: axisW, height }).toBuffer()

  const bounds = columnBounds(cal, width, axisRight)
  const strips: ColumnStrip[] = []
  for (let i = 0; i < cal.columns.length; i++) {
    const { left, right } = bounds[i]
    const colW = right - left
    const colBuf = await sharp(imagePath).extract({ left, top: 0, width: colW, height }).toBuffer()

    const slug = cal.columns[i].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const path = join(outDir, `${basename(imagePath).replace(/\.[a-z]+$/i, '')}-${slug || i}.png`)
    await sharp({ create: { width: axisW + colW, height, channels: 4, background: '#ffffff' } })
      .composite([
        { input: axisBuf, left: 0, top: 0 },
        { input: colBuf, left: axisW, top: 0 },
      ])
      .png()
      .toFile(path)
    strips.push({ name: cal.columns[i], path, width: axisW + colW, height, axisWidth: axisW })
  }
  return strips
}

// ── Pixel boundary detection + calibration + assignment ───────────────────────
// Vision reads names/order reliably but its Y estimates are hour-biased (it
// snaps sub-hour boundaries to the nearest labelled hour line). So times come
// from PIXELS: the block boundary lines are full-width horizontal strokes that
// detect to ~1 minute. Vision supplies names; a DP assigns them to the detected
// slots, leaving empty gaps (lead-ins) unfilled.

/** Longest continuous run of "ink" (darker than background by margin) in a row,
 * as a fraction of the scanned width. A boundary line is one near-full-width run
 * (~1.0); text is many short runs (<0.15); decorative art is a few wide runs. */
function longestInkRunFrac(g: Gray, y: number, x0: number, x1: number, darkT: number): number {
  let run = 0, max = 0
  const row = y * g.width
  for (let x = x0; x < x1; x++) {
    if (g.data[row + x] < darkT) { run++; if (run > max) max = run } else run = 0
  }
  return max / (x1 - x0)
}

/**
 * Detect full-width horizontal boundary lines in a column region [x0, x1).
 * Threshold is contrast-relative (background median − margin) so it works on any
 * palette; a line must span ≥ minRunFrac of the width as one continuous run,
 * which rejects text strokes and decorative art. Returns clustered line Y's.
 */
export function detectBoundaries(g: Gray, x0: number, x1: number, minRunFrac = 0.9): number[] {
  const samp: number[] = []
  for (let y = 0; y < g.height; y += 3) for (let x = x0; x < x1; x += 3) samp.push(g.data[y * g.width + x])
  samp.sort((a, b) => a - b)
  const bg = samp[samp.length >> 1] ?? 255
  const darkT = Math.max(40, bg - 60)
  const rows: number[] = []
  for (let y = 0; y < g.height; y++) if (longestInkRunFrac(g, y, x0, x1, darkT) >= minRunFrac) rows.push(y)
  return clusterRows(rows, 6)
}

/** Calibrate from the frame lines: topmost detected line = firstHour, bottommost
 * = lastHour. Pixel-accurate, unlike vision's noisy two-point estimate. */
export function calibrateFromBoundaries(topY: number, bottomY: number, firstHour: number, lastHour: number): AxisCalibration {
  return { firstHour, y0: topY, pxPerHour: (bottomY - topY) / (lastHour - firstHour) }
}

export type Interval = { start: number; end: number }

/** Overlap length between two intervals (0 if disjoint). */
export function overlap(a: Interval, b: Interval): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start))
}

/**
 * Monotonic DP assignment of N ordered vision blocks to a subset of M ordered
 * slots (gaps between detected boundaries), MAXIMISING total overlap between
 * each block's extent and its slot. Overlap uses the whole block, not just its
 * start, so an off-by-~1h vision estimate next to an empty-interval slot no
 * longer steals the name into the wrong box — the block still overlaps its true
 * slot most. Extra slots stay unassigned (empty lead-ins/gaps). Returns the slot
 * index per block, or null if N > M (a boundary was missed — caller falls back).
 */
export function alignByOverlap(blocks: Interval[], slots: Interval[]): number[] | null {
  const N = blocks.length, M = slots.length
  if (N > M) return null
  const f = Array.from({ length: N + 1 }, () => new Array(M + 1).fill(-Infinity))
  const back = Array.from({ length: N + 1 }, () => new Array(M + 1).fill(0)) // 1 = assign, 0 = skip slot
  for (let j = 0; j <= M; j++) f[0][j] = 0
  for (let i = 1; i <= N; i++) {
    for (let j = 1; j <= M; j++) {
      if (f[i][j - 1] > f[i][j]) { f[i][j] = f[i][j - 1]; back[i][j] = 0 }
      const c = f[i - 1][j - 1] + overlap(blocks[i - 1], slots[j - 1])
      if (c > f[i][j]) { f[i][j] = c; back[i][j] = 1 }
    }
  }
  const assign = new Array(N).fill(-1)
  let i = N, j = M
  while (i > 0 && j > 0) {
    if (back[i][j] === 1) { assign[i - 1] = j - 1; i--; j-- } else j--
  }
  return assign
}

/**
 * Turn detected boundary Y's into clean slot-boundary TIMES: map each to a
 * quarter-hour time via the calibration, drop any outside the grid's hour range
 * (header underlines / footer decoration sit just above/below the frame), and
 * dedupe. Returns sorted unique times — consecutive pairs are the slots.
 */
export function boundaryTimes(boundaries: number[], cal: AxisCalibration, firstHour: number, lastHour: number): number[] {
  const times = boundaries
    .map(y => yToTime(y, cal))
    .filter(t => t >= firstHour - 0.25 && t <= lastHour + 0.25)
    .map(t => Math.max(firstHour, Math.min(lastHour, t)))
  return [...new Set(times)].sort((a, b) => a - b)
}

async function loadGray(path: string): Promise<Gray> {
  const { data, info } = await sharp(path).grayscale().raw().toBuffer({ resolveWithObject: true })
  return { data: new Uint8Array(data), width: info.width, height: info.height }
}

export function buildStripBlocksPrompt(stripPath: string, stageName: string, cal: VisionCalibration): string {
  const hours = cal.last_hour - cal.first_hour
  const pxPerHour = (cal.grid_bottom_y - cal.grid_top_y) / hours
  return [
    `Read the image at: ${stripPath}`,
    `It is a vertical slice of a festival timetable: the hour axis on the left, then ONE stage column ("${stageName}").`,
    'CALIBRATION (pixel Y positions are the SAME in this slice as the full poster — use them to place every boundary):',
    `- The ${cal.first_hour % 24}:00 line is at pixel Y=${cal.grid_top_y}; the ${cal.last_hour % 24}:00 line is at Y=${cal.grid_bottom_y}. One hour = ${pxPerHour.toFixed(1)} px.`,
    'List this column\'s SET BLOCKS top to bottom. Output ONLY a JSON object — no markdown fences, no commentary:',
    `{
  "blocks": [{
    "artist_name": string, // verbatim, including "presents ..." parts; do not split B2B/collab names; drop trailing live/hybrid/dj-set tags from the name text
    "is_live": boolean,    // true only if the block has a "live" tag ("hybrid"/"dj set" are not live)
    "top_y": number,       // pixel Y of the TOP boundary line of this set's block (its start time)
    "bottom_y": number     // pixel Y of the BOTTOM boundary line of this set's block (its end time)
  }]
}`,
    'Rules:',
    '- A set block is a bounded region CONTAINING ARTIST-NAME TEXT. Regions with only decorative artwork or flat empty background are gaps where nothing is scheduled — skip them, they are not sets.',
    '- top_y/bottom_y are the block\'s drawn horizontal boundary lines, NOT the vertical position of the name text (names are often centered inside tall blocks). Read the boundary lines.',
    '- Match each boundary Y to the calibration: boundaries fall on hour, half-hour, or quarter-hour lines. For each block compute what time its top_y/bottom_y imply and sanity-check it looks right against the axis numbers.',
    '- Blocks must not overlap and must be top to bottom.',
    '- Ignore any partial neighboring column that may be visible at the far right edge — read only the main column beside the axis.',
    '- List EVERY set block, including hard-to-read ones.',
  ].join('\n')
}

export function readStripBlocks(stripPath: string, stageName: string, cal: VisionCalibration): VisionBlock[] | null {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = callClaude(buildStripBlocksPrompt(resolve(stripPath), stageName, cal), { tools: 'Read', timeout: 300_000 })
      const g = JSON.parse(extractJsonBlock(raw))
      if (!Array.isArray(g.blocks)) continue
      if (!g.blocks.every((b: any) => typeof b.artist_name === 'string' && typeof b.top_y === 'number' && typeof b.bottom_y === 'number')) continue
      return g.blocks
    } catch (err: any) {
      console.warn(`  ! ${stageName} blocks read failed (${err.stderr?.toString().trim() || err.message || err})${attempt === 0 ? ' — retrying' : ''}`)
    }
  }
  return null
}

/** Extract all sets from one day's poster image. `day` overrides what the poster says. */
export async function extractPosterDayVision(
  imagePath: string,
  opts: { day?: string; workDir?: string } = {},
): Promise<PosterDayResult | null> {
  const workDir = opts.workDir ?? join(resolve(imagePath), '..', 'poster-vision')
  mkdirSync(workDir, { recursive: true })
  console.log(`  poster: ${resolve(imagePath)}`)

  // Downscale to the vision input cap ourselves so all reported pixel
  // coordinates share one known space (see MAX_DIM). Calibration + slicing +
  // block reads all run on this working image.
  const work = await prepareWorkImage(imagePath, workDir)
  const { path: workPath, width, height } = work
  console.log(`  working image: ${basename(workPath)} (${width}x${height})`)

  const cal = readVisionCalibration(workPath, width, height)
  if (!cal) {
    console.warn(`  ! calibration failed after retries — see ${resolve(workPath)} to inspect manually`)
    return null
  }
  console.log(`  vision geometry: ${cal.first_hour}:00 → ${cal.last_hour}:00, ${cal.columns.length} columns`)

  const strips = await sliceColumns(workPath, cal, width, height, workDir)
  console.log(`  slices: ${strips.map(s => basename(s.path)).join(', ')}`)

  // Pixel-detect boundary lines per strip (times), and read names via vision.
  const perStrip = await Promise.all(strips.map(async strip => {
    const gray = await loadGray(strip.path)
    // Scan the central band of the column: boundary lines span the full width, but
    // near the axis (left) decorative art breaks the run and near the right edge a
    // neighbor sliver / second axis intrudes — the centre is clean on every column.
    const colW = strip.width - strip.axisWidth
    const x0 = Math.round(strip.axisWidth + colW * 0.2)
    const x1 = Math.round(strip.axisWidth + colW * 0.8)
    const boundaries = detectBoundaries(gray, x0, x1)
    return { strip, boundaries }
  }))

  // Global calibration from the grid frame: the 11:00 top line and 23:00 bottom
  // line are shared by every column, so the median topmost / bottommost detected
  // line is robust to any single strip missing its frame.
  const tops = perStrip.map(p => p.boundaries[0]).filter(v => v != null).sort((a, b) => a - b)
  const bots = perStrip.map(p => p.boundaries[p.boundaries.length - 1]).filter(v => v != null).sort((a, b) => a - b)
  if (tops.length === 0 || bots.length === 0) {
    console.warn(`  ! no boundary lines detected on any strip — see ${resolve(workPath)}`)
    return null
  }
  const median = (a: number[]) => a[a.length >> 1]
  const axisCal = calibrateFromBoundaries(median(tops), median(bots), cal.first_hour, cal.last_hour)
  console.log(`  pixel calibration: ${cal.first_hour}:00 @ y=${median(tops)} → ${cal.last_hour}:00 @ y=${median(bots)} (${axisCal.pxPerHour.toFixed(1)} px/h)`)

  const day = opts.day ?? cal.day
  const sets: ScrapedSet[] = []
  const failedStrips: string[] = []
  const debug: Record<string, unknown> = { visionGeometry: cal, pixelCalibration: axisCal, columns: {} }

  for (const { strip, boundaries } of perStrip) {
    const vision = readStripBlocks(strip.path, strip.name, cal)
    if (!vision || vision.length === 0) { failedStrips.push(strip.name); continue }

    // Slots = gaps between consecutive boundary lines, snapped to the 15-min grid
    // and clamped to the hour range (drops header/footer decoration lines).
    const times = boundaryTimes(boundaries, axisCal, cal.first_hour, cal.last_hour)
    const slots = times.slice(0, -1).map((st, i) => ({ start: st, end: times[i + 1] }))
    // Vision block extents in raw (unsnapped) time — matched to slots by maximum
    // overlap, robust to the model's hour-biased estimates next to empty gaps.
    const rawTime = (y: number) => axisCal.firstHour + (y - axisCal.y0) / axisCal.pxPerHour
    const blocks = vision.map(b => ({ start: rawTime(b.top_y), end: rawTime(b.bottom_y) }))
    const assign = slots.length ? alignByOverlap(blocks, slots) : null

    if (assign) {
      vision.forEach((b, k) => {
        const s = slots[assign[k]]
        sets.push({
          artist_name: b.artist_name, stage: strip.name, day: day ?? '',
          start_time: formatHour(s.start),
          end_time: formatHour(s.end),
          performance_type: b.is_live ? 'live' : null,
        })
      })
    } else {
      // Fallback: pixels missed lines (fewer slots than names) — use vision's own
      // (hour-biased) Y estimates so nothing is dropped; flagged for review.
      console.warn(`  ! ${strip.name}: ${slots.length} pixel slots for ${vision.length} names — using vision times (less precise)`)
      failedStrips.push(strip.name)
      vision.forEach(b => sets.push({
        artist_name: b.artist_name, stage: strip.name, day: day ?? '',
        start_time: formatHour(yToTime(b.top_y, axisCal)),
        end_time: formatHour(yToTime(b.bottom_y, axisCal)),
        performance_type: b.is_live ? 'live' : null,
      }))
    }
    ;(debug.columns as Record<string, unknown>)[strip.name] = {
      boundaries,
      slotTimes: slots.map(s => `${formatHour(s.start)}-${formatHour(s.end)}`),
      visionBlocks: blocks.map((b, k) => `${formatHour(b.start)}-${formatHour(b.end)} ${vision[k].artist_name}`),
      sets: sets.filter(s => s.stage === strip.name).map(s => `${s.start_time}-${s.end_time} ${s.artist_name}`),
    }
  }

  const debugPath = join(workDir, `${basename(imagePath).replace(/\.[a-z]+$/i, '')}.vision.json`)
  writeFileSync(debugPath, JSON.stringify(debug, null, 2))
  console.log(`  debug JSON: ${debugPath}`)
  return { day, stages: strips.map(s => s.name), sets, failedStrips }
}
