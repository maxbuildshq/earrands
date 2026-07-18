import { describe, it, expect } from 'vitest'
import {
  buildStripBlocksPrompt, columnBounds, detectBoundaries, calibrateFromBoundaries,
  alignByOverlap, overlap, boundaryTimes, type VisionCalibration, type Gray, type Interval,
} from './poster-vision.js'

const cal: VisionCalibration = {
  day: '2026-08-02', first_hour: 12, last_hour: 24, grid_top_y: 400, grid_bottom_y: 2800,
  axis: { left: 0, right: 0.05 }, grid: { left: 0.05, right: 0.95 }, columns: ['UFO I'],
}

/** White strip with dark full-width lines at given rows, plus optional short text runs. */
function makeStrip(width: number, height: number, lineRows: number[], textRows: number[] = []): Gray {
  const data = new Uint8Array(width * height).fill(230)
  for (const y of lineRows) for (let x = 0; x < width; x++) data[y * width + x] = 10 // full-width line
  for (const y of textRows) for (let x = 5; x < width; x += 12) { data[y * width + x] = 10; data[y * width + x + 1] = 10 } // short strokes
  return { data, width, height }
}

describe('detectBoundaries', () => {
  it('finds full-width lines and rejects text strokes', () => {
    const g = makeStrip(200, 1000, [100, 500, 900], [300, 305, 700])
    expect(detectBoundaries(g, 0, 200)).toEqual([100, 500, 900])
  })
  it('works on a dark-background palette (contrast-relative threshold)', () => {
    const g = { data: new Uint8Array(200 * 600).fill(60), width: 200, height: 600 }
    for (const y of [50, 550]) for (let x = 0; x < 200; x++) g.data[y * 200 + x] = 0 // darker-than-bg line
    expect(detectBoundaries(g, 0, 200)).toEqual([50, 550])
  })
})

describe('calibrateFromBoundaries', () => {
  it('maps frame lines to a linear hour scale', () => {
    const c = calibrateFromBoundaries(333, 1926, 11, 23)
    expect(c.y0).toBe(333)
    expect(c.firstHour).toBe(11)
    expect(c.pxPerHour).toBeCloseTo(132.75, 2)
  })
})

const iv = (start: number, end: number): Interval => ({ start, end })

describe('overlap', () => {
  it('measures the shared length and is zero when disjoint', () => {
    expect(overlap(iv(14, 16.5), iv(14, 16.5))).toBe(2.5)
    expect(overlap(iv(22.5, 23.5), iv(22.5, 23.5))).toBe(1)
    expect(overlap(iv(22.5, 23.5), iv(23.5, 28))).toBe(0)
  })
})

describe('alignByOverlap', () => {
  it('assigns each block to the slot it overlaps most, leaving empty gaps', () => {
    // The Nest: slots incl. the empty 11:00–14:00 lead-in; blocks are roughly right
    const slots = [iv(11, 14), iv(14, 16.5), iv(16.5, 17.5), iv(17.5, 18.5), iv(18.5, 20), iv(20, 21.5), iv(21.5, 23)]
    const blocks = [iv(14, 16), iv(16.4, 17.3), iv(17.4, 18.4), iv(18.4, 20), iv(20, 21.4), iv(21.4, 23)]
    expect(alignByOverlap(blocks, slots)).toEqual([1, 2, 3, 4, 5, 6])
  })
  it('does not let an hour-biased block next to an empty slot steal into it', () => {
    // Oude Zaal 07-30: New York's true slot is 22:30–23:30, with an empty 23:30–04:00
    // after it. Even a block shifted late still overlaps the real slot more.
    const slots = [iv(22, 22.5), iv(22.5, 23.5), iv(23.5, 28)]
    const newYork = iv(22.6, 23.6) // vision read, ~6min late
    expect(alignByOverlap([newYork], slots)).toEqual([1])
  })
  it('returns null when there are more blocks than slots (a line was missed)', () => {
    expect(alignByOverlap([iv(14, 16), iv(16, 18), iv(18, 20)], [iv(14, 18), iv(18, 22)])).toBeNull()
  })
})

describe('boundaryTimes', () => {
  const c = calibrateFromBoundaries(333, 1926, 11, 23) // 132.75 px/h
  it('snaps to the 15-min grid, drops header lines above the frame, and dedupes', () => {
    // Greenhouse case: a header underline (~10:45) + a doubled 11:00 above the grid
    const raw = [300, 333, 335, 731, 864, 1062, 1263, 1926] // 10:45, 11:00, 11:00, 14:00, 15:00, 16:30, 18:00, 23:00
    expect(boundaryTimes(raw, c, 11, 23)).toEqual([11, 14, 15, 16.5, 18, 23])
  })
  it('keeps a below-axis start like 12:30 within range', () => {
    expect(boundaryTimes([532, 731], c, 11, 23)).toEqual([12.5, 14])
  })
})

describe('columnBounds', () => {
  it('divides the grid area into N equal columns, cuts landing in the gaps', () => {
    const c: VisionCalibration = { ...cal, grid: { left: 0.05, right: 0.95 }, columns: ['A', 'B', 'C'] }
    const b = columnBounds(c, 1000, 60) // width 1000, axisRight 60; span = 0.30 → 300px, margin 5% = 15px
    expect(b).toHaveLength(3)
    // column 1: [0.05*1000 - 15, 0.35*1000 + 15] = [35→clamp 60, 365]
    expect(b[0]).toEqual({ left: 60, right: 365 }) // left 35 clamped to axisRight 60
    expect(b[1]).toEqual({ left: 335, right: 665 })
    expect(b[2]).toEqual({ left: 635, right: 965 }) // right 0.965*1000, under width
  })
  it('clamps the last column to image width', () => {
    const c: VisionCalibration = { ...cal, grid: { left: 0.1, right: 1.0 }, columns: ['A'] }
    expect(columnBounds(c, 1000, 40)[0].right).toBe(1000)
  })
})

describe('buildStripBlocksPrompt', () => {
  it('embeds the calibration anchors, stage name, and px/hour in the prompt', () => {
    const p = buildStripBlocksPrompt('/tmp/x.png', 'UFO I', cal)
    expect(p).toContain('Y=400')
    expect(p).toContain('Y=2800')
    expect(p).toContain('200.0 px')
    expect(p).toContain('"UFO I"')
  })
  it('renders cross-midnight last_hour mod 24', () => {
    const p = buildStripBlocksPrompt('/tmp/x.png', 'UFO I', { ...cal, first_hour: 22, last_hour: 30 })
    expect(p).toContain('the 6:00 line is at Y=2800') // 30 % 24
  })
})
