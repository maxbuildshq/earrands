import { formatDayLabel, formatDateRange, isAfterMidnight } from './dates'
import { columnTopExtra, DAY_HEADER_HEIGHT, MIDNIGHT_DIVIDER_HEIGHT, fitsCols, paginateSets, rowExtra } from './shareLayout'
import type { RowMeasure, SchedulePage, SetTier } from './shareLayout'
import type { SetWithStage } from '../types/database'

export type ShareTemplate = {
  id: string
  label: string
  bg: string
  ink: string
  accent: string
  rule: string
}

// Editorial poster layout shared by both templates — only the colours differ.
export const TEMPLATES: ShareTemplate[] = [
  { id: 'poster', label: 'Poster', bg: '#FFFFFF', ink: '#0A0A0A', accent: '#CCFF00', rule: '#DDDDDD' },
  { id: 'acid', label: 'Acid', bg: '#CCFF00', ink: '#0A0A0A', accent: '#0A0A0A', rule: 'rgba(10,10,10,0.25)' },
]

/**
 * Display font for the export posters — deliberately not the app UI font:
 * Anton is far more space-efficient at poster sizes (ADR 009 addendum). Meta
 * text (subtitle, day labels, times, footer) stays Chakra Petch for brand
 * presence.
 */
export type ShareFont = { family: string; weight: number }
export const DISPLAY_FONT: ShareFont = { family: 'Anton', weight: 400 }
const META = '"Chakra Petch", sans-serif'

export function buildShareFilename(festivalName: string, page?: number, total?: number): string {
  const slug = festivalName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const suffix = page && total && total > 1 ? `-${page}of${total}` : ''
  return `earrands-${slug}${suffix}.png`
}

const W = 1080
const H = 1920
const PAD = 64
const GUTTER = 44

const TOP_BAR_Y = 64
const TOP_BAR_H = 12
const FOOTER_RULE_Y = H - 100
const FOOTER_BASELINE = H - 56
const BODY_TOP_GAP = 24

// Title shrinks until the festival name fits two lines.
const TITLE_SIZES = [118, 104, 92, 80, 70, 62]

// Sizes spread wide on purpose — the tier hierarchy must read at a glance.
type TierStyle = { size: number; lh: number; pad: number; time: number }
const TIER_STYLES: Record<1 | 2, Record<SetTier, TierStyle>> = {
  1: {
    headliner: { size: 104, lh: 114, pad: 34, time: 26 },
    big: { size: 60, lh: 72, pad: 30, time: 26 },
    standard: { size: 38, lh: 50, pad: 26, time: 24 },
  },
  2: {
    headliner: { size: 62, lh: 72, pad: 26, time: 20 },
    big: { size: 42, lh: 52, pad: 22, time: 20 },
    standard: { size: 28, lh: 38, pad: 20, time: 18 },
  },
}

const fontStr = (font: ShareFont, size: number) =>
  `${font.weight} ${size}px "${font.family}", sans-serif`
const metaStr = (size: number, weight = 600) => `${weight} ${size}px ${META}`

// Pages with spare room scale their type up to fill the poster (largest first).
const BOOST_SCALES = [2, 1.8, 1.6, 1.45, 1.3, 1.15, 1]

const colWidth = (cols: 1 | 2) => (cols === 1 ? W - PAD * 2 : (W - PAD * 2 - GUTTER) / 2)

type TitleLayout = { size: number; lines: string[] }

function layoutTitle(ctx: CanvasRenderingContext2D, festivalName: string, font: ShareFont): TitleLayout {
  const name = festivalName.toUpperCase()
  for (const size of TITLE_SIZES) {
    ctx.font = fontStr(font, size)
    const lines = wrap(ctx, name, W - PAD * 2)
    if (lines.length <= 2) return { size, lines }
  }
  ctx.font = fontStr(font, TITLE_SIZES[TITLE_SIZES.length - 1])
  return { size: TITLE_SIZES[TITLE_SIZES.length - 1], lines: wrap(ctx, name, W - PAD * 2).slice(0, 2) }
}

/** Y where the schedule body starts, for a given title layout. */
function headerBottom(title: TitleLayout): number {
  const lh = title.size + 8
  const lastBaseline = TOP_BAR_Y + TOP_BAR_H + 36 + title.size + (title.lines.length - 1) * lh
  const ruleY = lastBaseline + 32
  const subBaseline = ruleY + 3 + 56
  return subBaseline + 20
}

type Metrics = {
  rowH: RowMeasure
  lines: (id: string, cols: 1 | 2) => string[]
  style: (id: string, cols: 1 | 2) => TierStyle
}

/** Wrapped name lines + row heights per set and column count — the single source the paginator and renderer share. */
function buildMetrics(
  ctx: CanvasRenderingContext2D,
  sets: SetWithStage[],
  tiers: Map<string, SetTier>,
  font: ShareFont,
  scale = 1,
): Metrics {
  const style = (id: string, cols: 1 | 2): TierStyle => {
    const base = TIER_STYLES[cols][tiers.get(id) ?? 'standard']
    return scale === 1
      ? base
      : { size: base.size * scale, lh: base.lh * scale, pad: base.pad * scale, time: base.time * scale }
  }
  const cache = new Map<string, string[]>()
  const linesFor = (id: string, cols: 1 | 2): string[] => {
    const key = `${id}:${cols}`
    let lines = cache.get(key)
    if (!lines) {
      const s = sets.find(x => x.id === id)!
      const st = style(id, cols)
      ctx.font = metaStr(st.time, 500)
      const timeW = s.start_time ? ctx.measureText(s.start_time.slice(0, 5)).width + 16 : 0
      ctx.font = fontStr(font, st.size)
      lines = wrap(ctx, s.artist_name.toUpperCase(), colWidth(cols) - timeW)
      cache.set(key, lines)
    }
    return lines
  }
  const rowH: RowMeasure = (id, cols) => {
    const st = style(id, cols)
    return linesFor(id, cols).length * st.lh + st.pad
  }
  return { rowH, lines: linesFor, style }
}

/**
 * Compute every split option (per day / combined / single image) for a
 * selection. Row heights account for name wrapping, so this must run after the
 * display font has loaded.
 */
export function buildSharePages(opts: {
  festivalName: string
  sets: SetWithStage[]
  tiers: Map<string, SetTier>
  font?: ShareFont
}): { perDay: SchedulePage[]; grouped: SchedulePage[]; single: SchedulePage[] | null } {
  const { festivalName, sets, tiers, font = DISPLAY_FONT } = opts
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return { perDay: [], grouped: [], single: null }
  const bodyHeight = FOOTER_RULE_Y - BODY_TOP_GAP - headerBottom(layoutTitle(ctx, festivalName, font))
  const { rowH } = buildMetrics(ctx, sets, tiers, font)
  return paginateSets(sets, rowH, bodyHeight)
}

/** Renders one page of the user's schedule as a 9:16 editorial poster. */
export function drawSchedulePage(
  canvas: HTMLCanvasElement,
  opts: {
    festivalName: string
    page: SchedulePage
    pageIndex: number
    pageCount: number
    template: ShareTemplate
    tiers: Map<string, SetTier>
    font?: ShareFont
  },
) {
  const { festivalName, page, template: t, tiers, font = DISPLAY_FONT } = opts
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = t.bg
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = t.ink

  // Header — top bar, festival title (max 2 lines), thin rule, "MY PLAN" subtitle
  ctx.fillRect(PAD, TOP_BAR_Y, W - PAD * 2, TOP_BAR_H)

  const title = layoutTitle(ctx, festivalName, font)
  ctx.font = fontStr(font, title.size)
  let y = TOP_BAR_Y + TOP_BAR_H + 36 + title.size
  for (const line of title.lines) {
    ctx.fillText(line, PAD, y)
    y += title.size + 8
  }
  y -= title.size + 8

  const ruleY = y + 32
  ctx.fillRect(PAD, ruleY, W - PAD * 2, 3)

  const days = page.days
  const dates = days.length ? formatDateRange(days[0], days[days.length - 1]) : ''
  ctx.font = metaStr(30)
  ctx.letterSpacing = '6px'
  ctx.fillText(`MY PLAN — ${dates}`, PAD, ruleY + 3 + 56)
  ctx.letterSpacing = '0px'

  // Schedule rows — sequential column fill, mirroring shareLayout's fitsCols()
  const bodyTop = headerBottom(title) + BODY_TOP_GAP
  const bodyHeight = FOOTER_RULE_Y - BODY_TOP_GAP - headerBottom(title)
  const multiDay = days.length > 1

  // Choose columns + type scale: the layout yielding the biggest type wins, so
  // a cramped one-column page upgrades to two boosted columns instead.
  const colChoices: (1 | 2)[] = page.cols === 1 ? [1, 2] : [2]
  let best: { cols: 1 | 2; scale: number; metrics: Metrics } | null = null
  for (const c of colChoices) {
    for (const scale of BOOST_SCALES) {
      const m = buildMetrics(ctx, page.sets, tiers, font, scale)
      if (!fitsCols(page.sets, multiDay, m.rowH, bodyHeight, c)) continue
      if (!best || TIER_STYLES[c].standard.size * scale > TIER_STYLES[best.cols].standard.size * best.scale) {
        best = { cols: c, scale, metrics: m }
      }
      break // largest fitting scale found for this column count
    }
  }
  const cols = best?.cols ?? page.cols
  const cw = colWidth(cols)
  const { rowH, lines, style: styleOf } = best?.metrics ?? buildMetrics(ctx, page.sets, tiers, font)
  let col = 0
  let h = 0
  let prev: SetWithStage | null = null
  for (const s of page.sets) {
    let extra = h === 0 ? columnTopExtra(prev, s, multiDay) : rowExtra(prev, s, multiDay)
    const rh = rowH(s.id, cols)
    if (h > 0 && h + (extra?.height ?? 0) + rh > bodyHeight) {
      col = Math.min(col + 1, cols - 1)
      h = 0
      extra = columnTopExtra(prev, s, multiDay)
    }
    const x = PAD + col * (cw + GUTTER)
    if (extra?.type === 'day') {
      const continued = prev !== null && prev.day === s.day
      const label =
        formatDayLabel(s.day) +
        (continued && s.start_time && isAfterMidnight(s.start_time) ? ' — AFTER MIDNIGHT' : '')
      ctx.font = metaStr(26)
      ctx.letterSpacing = '5px'
      ctx.fillStyle = t.ink
      ctx.fillText(label, x, bodyTop + h + DAY_HEADER_HEIGHT - 18)
      ctx.letterSpacing = '0px'
      h += DAY_HEADER_HEIGHT
    } else if (extra?.type === 'midnight') {
      ctx.font = metaStr(22)
      ctx.letterSpacing = '4px'
      ctx.fillStyle = t.ink
      ctx.globalAlpha = 0.55
      ctx.fillText('AFTER MIDNIGHT', x, bodyTop + h + MIDNIGHT_DIVIDER_HEIGHT - 14)
      ctx.globalAlpha = 1
      ctx.letterSpacing = '0px'
      h += MIDNIGHT_DIVIDER_HEIGHT
    }
    const style = styleOf(s.id, cols)
    const nameLines = lines(s.id, cols)
    const tier = tiers.get(s.id) ?? 'standard'

    ctx.font = fontStr(font, style.size)
    ctx.fillStyle = t.ink
    nameLines.forEach((line, i) => {
      ctx.fillText(line, x, bodyTop + h + (i + 1) * style.lh - 12)
    })

    if (s.start_time) {
      // Inline time right after the last name line — metrics reserve its width.
      ctx.font = fontStr(font, style.size)
      const lastW = ctx.measureText(nameLines[nameLines.length - 1]).width
      ctx.font = metaStr(style.time, 500)
      ctx.fillText(s.start_time.slice(0, 5), x + lastW + 16, bodyTop + h + nameLines.length * style.lh - 12)
    }

    const rowBottom = bodyTop + h + rh
    ctx.fillStyle = tier === 'headliner' ? t.ink : t.rule
    ctx.fillRect(x, rowBottom - (tier === 'headliner' ? 5 : 2), cw, tier === 'headliner' ? 5 : 2)
    h += rh
    prev = s
  }

  // Footer — rule + right-aligned "made with earrands.app"
  ctx.fillStyle = t.ink
  ctx.fillRect(PAD, FOOTER_RULE_Y, W - PAD * 2, 3)
  ctx.font = metaStr(22, 400)
  const footerText = 'made with https://earrands.app'
  ctx.fillText(footerText, W - PAD - ctx.measureText(footerText).width, FOOTER_BASELINE)
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
