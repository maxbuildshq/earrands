import { formatDayLabel } from './dates'
import type { SetWithStage } from '../types/database'

export type ShareTemplate = {
  id: string
  label: string
  bg: string
  accent: string
  text: string
  sub: string
}

// Data-driven templates — same schedule, different colour treatment. Add a 4th by appending here.
export const TEMPLATES: ShareTemplate[] = [
  { id: 'acid', label: 'Acid', bg: '#0A0A0A', accent: '#CCFF00', text: '#FFFFFF', sub: '#777777' },
  { id: 'inverse', label: 'Inverse', bg: '#CCFF00', accent: '#0A0A0A', text: '#0A0A0A', sub: '#1A1A1A' },
  { id: 'mono', label: 'Mono', bg: '#0A0A0A', accent: '#FFFFFF', text: '#E5E5E5', sub: '#666666' },
]

export function buildShareFilename(festivalName: string): string {
  return `festival-pulse-${festivalName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
}

const W = 1080
const H = 1920

/** Renders the user's marked schedule into a 9:16 social-share image on the given canvas. */
export function drawSchedule(
  canvas: HTMLCanvasElement,
  opts: { festivalName: string; sets: SetWithStage[]; template: ShareTemplate },
) {
  const { festivalName, sets, template: t } = opts
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const pad = 80
  ctx.fillStyle = t.bg
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'alphabetic'

  let y = 150

  ctx.font = '700 34px "Space Mono", monospace'
  ctx.fillStyle = t.accent
  ctx.fillText('FESTIVAL PULSE', pad, y)
  y += 96

  ctx.font = '700 76px "Space Mono", monospace'
  ctx.fillStyle = t.text
  for (const line of wrap(ctx, festivalName.toUpperCase(), W - pad * 2)) {
    ctx.fillText(line, pad, y)
    y += 88
  }
  y += 8

  ctx.font = '700 40px "Space Mono", monospace'
  ctx.fillStyle = t.accent
  ctx.fillText('MY SCHEDULE', pad, y)
  y += 48

  ctx.fillStyle = t.sub
  ctx.fillRect(pad, y, W - pad * 2, 3)
  y += 64

  const hasTimes = sets.some(s => !!s.start_time)
  const timeCol = hasTimes ? 150 : 0
  const rowH = 60
  const footerY = H - 90
  const maxY = footerY - 70
  let lastDay = ''

  for (let i = 0; i < sets.length; i++) {
    const s = sets[i]
    if (y > maxY - rowH) {
      ctx.font = '400 30px "Space Mono", monospace'
      ctx.fillStyle = t.sub
      ctx.fillText(`+ ${sets.length - i} more`, pad, y + 8)
      break
    }
    if (s.day !== lastDay) {
      lastDay = s.day
      y += 12
      ctx.font = '700 28px "Space Mono", monospace'
      ctx.fillStyle = t.sub
      ctx.fillText(formatDayLabel(s.day), pad, y)
      y += 46
    }
    if (hasTimes) {
      ctx.font = '700 34px "Space Mono", monospace'
      ctx.fillStyle = t.accent
      ctx.fillText(s.start_time ? s.start_time.slice(0, 5) : '—', pad, y)
    }
    ctx.font = '700 34px "Space Mono", monospace'
    ctx.fillStyle = t.text
    ctx.fillText(truncate(ctx, s.artist_name, W - pad * 2 - timeCol), pad + timeCol, y)
    y += rowH
  }

  ctx.font = '400 28px "Space Mono", monospace'
  ctx.fillStyle = t.sub
  ctx.fillText('festivalpulse.app', pad, footerY)
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) {
    t = t.slice(0, -1)
  }
  return `${t}…`
}
