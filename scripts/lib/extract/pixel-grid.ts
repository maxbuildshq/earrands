/**
 * Deterministic pixel-to-time mapping for poster timetables. Vision models
 * locate whole-hour gridlines fine but systematically round sub-hour
 * boundaries to the nearest hour — measuring cell borders in pixels and
 * interpolating against the hour axis is exact at any granularity (30/15
 * minute marks). Vision is used only to READ text and report block
 * boundaries; this module turns those pixel boundaries into times.
 */

export type Gray = { data: Uint8Array; width: number; height: number }

/** Cluster consecutive y values (gaps ≤ maxGap) into center positions. */
export function clusterRows(ys: number[], maxGap = 3): number[] {
  if (ys.length === 0) return []
  const centers: number[] = []
  let start = ys[0]
  let prev = ys[0]
  for (let i = 1; i <= ys.length; i++) {
    const y = ys[i]
    if (i === ys.length || y - prev > maxGap) {
      centers.push((start + prev) / 2)
      start = y
    }
    prev = y
  }
  return centers
}

export type AxisCalibration = {
  firstHour: number // hour value of the first tick (may exceed 23 handled by caller)
  y0: number // y of the first tick
  pxPerHour: number
}

/** Map a pixel y to a time (in fractional hours), snapped to the nearest quarter-hour. */
export function yToTime(y: number, cal: AxisCalibration): number {
  const t = cal.firstHour + (y - cal.y0) / cal.pxPerHour
  return Math.round(t * 4) / 4
}

/** Format fractional hours as HH:MM (mod 24 for cross-midnight grids). */
export function formatHour(t: number): string {
  const h = Math.floor(t) % 24
  const m = Math.round((t - Math.floor(t)) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
