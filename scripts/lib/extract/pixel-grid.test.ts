import { describe, it, expect } from 'vitest'
import { clusterRows, yToTime, formatHour, type AxisCalibration } from './pixel-grid.js'

describe('clusterRows', () => {
  it('groups consecutive rows into centers', () => {
    expect(clusterRows([10, 11, 12, 50, 51, 90])).toEqual([11, 50.5, 90])
  })
  it('handles empty input', () => {
    expect(clusterRows([])).toEqual([])
  })
})

describe('yToTime + formatHour', () => {
  const cal: AxisCalibration = { firstHour: 11, y0: 100, pxPerHour: 100 }
  it('maps border pixels to quarter-hour-snapped times', () => {
    expect(yToTime(100, cal)).toBe(11)
    expect(yToTime(150, cal)).toBe(11.5)
    expect(yToTime(178, cal)).toBe(11.75) // 17:45-style boundary
    expect(yToTime(430, cal)).toBe(14.25)
  })
  it('formats fractional hours incl. cross-midnight', () => {
    expect(formatHour(11.5)).toBe('11:30')
    expect(formatHour(17.75)).toBe('17:45')
    expect(formatHour(25.25)).toBe('01:15') // hour 25 = 1 AM next day
  })
})
