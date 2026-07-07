import { DISPLAY_FONT, wrap } from './shareImage'
import type { ShareFont, ShareTemplate } from './shareImage'
import { capByTier } from './recap'
import type { RecapStats } from './recap'
import type { SetTier } from './shareLayout'
import type { SetWithStage } from '../types/database'

const W = 1080
const H = 1920
const PAD = 64

const TOP_BAR_Y = 64
const TOP_BAR_H = 12
const FOOTER_RULE_Y = H - 100
const FOOTER_BASELINE = H - 56
const BODY_TOP_GAP = 24
const FOOTER_GAP = 40 // clearance between last content row and the footer rule

const TITLE_SIZES = [118, 104, 92, 80, 70, 62]
const META = '"Chakra Petch", sans-serif'

const fontStr = (font: ShareFont, size: number) =>
  `${font.weight} ${size}px "${font.family}", sans-serif`
const metaStr = (size: number, weight = 600) => `${weight} ${size}px ${META}`

type RowStyle = { size: number; lh: number; pad: number }
const FAV_STYLES: Record<SetTier, RowStyle> = {
  headliner: { size: 64, lh: 74, pad: 22 },
  big: { size: 44, lh: 54, pad: 18 },
  standard: { size: 30, lh: 40, pad: 16 },
}
// Deliberately smaller than the standard favorites tier — contrast between
// tiers comes from font size alone (mirrors the personal schedule poster).
const FIND_STYLE: RowStyle = { size: 40, lh: 50, pad: 16 }

const COL_GAP = 40
const COL_W = (W - PAD * 2 - COL_GAP) / 2

const SECTION_LABEL_H = 64
const STATS_NUM_SIZE = 92
const STATS_H = STATS_NUM_SIZE + 46 + 44
const FINDS_TAG_H = 56
const FINDS_CAPTION_H = 44
const BLOCK_GAP = 40

const FAV_CAP_RATINGS = 12
const FAV_CAP_PICKS = 14
const FAV_CAP_FLOOR = 4 // fit-loop will not trim favorites below this unless truly forced
const FIND_CAP_MAX = 4
const SHRINK_SCALES = [1, 0.9, 0.8]

export function buildRecapFilename(festivalName: string): string {
  const slug = festivalName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `earrands-${slug}-recap.png`
}

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

function headerBottom(title: TitleLayout): number {
  const lh = title.size + 8
  const lastBaseline = TOP_BAR_Y + TOP_BAR_H + 36 + title.size + (title.lines.length - 1) * lh
  const ruleY = lastBaseline + 32
  const subBaseline = ruleY + 3 + 56
  return subBaseline + 20
}

const scaled = (s: RowStyle, scale: number): RowStyle =>
  scale === 1 ? s : { size: s.size * scale, lh: s.lh * scale, pad: s.pad * scale }

export function drawRecapCard(
  canvas: HTMLCanvasElement,
  opts: {
    festivalName: string
    dateRange: string
    stats: RecapStats
    template: ShareTemplate
    tiers: Map<string, SetTier>
    font?: ShareFont
  },
) {
  const { festivalName, dateRange, stats, template: t, tiers, font = DISPLAY_FONT } = opts
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = t.bg
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = t.ink
  ctx.fillRect(PAD, TOP_BAR_Y, W - PAD * 2, TOP_BAR_H)

  ctx.fillStyle = t.ink
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

  ctx.font = metaStr(30)
  ctx.letterSpacing = '6px'
  ctx.fillText(`MY RECAP — ${dateRange}`, PAD, ruleY + 3 + 56)
  ctx.letterSpacing = '0px'

  const bodyTop = headerBottom(title) + BODY_TOP_GAP
  const bodyHeight = FOOTER_RULE_Y - FOOTER_GAP - bodyTop

  // Content selection — favorites exclude the finds shown in their own block.
  const finds = stats.level === 'ratings' ? stats.unexpectedFinds : []
  const findIds = new Set(finds.map(s => s.id))
  const favPool = finds.length ? stats.favorites.filter(s => !findIds.has(s.id)) : stats.favorites
  const favCapMax = Math.min(favPool.length, stats.level === 'ratings' ? FAV_CAP_RATINGS : FAV_CAP_PICKS)
  const favCapMin = Math.min(favCapMax, FAV_CAP_FLOOR)
  const findCapMax = Math.min(finds.length, FIND_CAP_MAX)
  const favLabel = stats.level === 'ratings' ? 'TOP SETS' : 'THE PLAN'

  const rowLinesCol = (s: SetWithStage, style: RowStyle, colWidth: number): string[] => {
    ctx.font = fontStr(font, style.size)
    return wrap(ctx, s.artist_name.toUpperCase(), colWidth)
  }
  const favStyle = (s: SetWithStage, scale: number) => scaled(FAV_STYLES[tiers.get(s.id) ?? 'standard'], scale)

  const itemHeight = (s: SetWithStage, style: RowStyle, colWidth: number): number =>
    rowLinesCol(s, style, colWidth).length * style.lh + style.pad

  /** Balance items across two columns by actual rendered height (wraps vary), not raw count. */
  const splitColumns = (items: SetWithStage[], scale: number): [SetWithStage[], SetWithStage[]] => {
    const heights = items.map(s => itemHeight(s, favStyle(s, scale), COL_W))
    const total = heights.reduce((a, b) => a + b, 0)
    const target = total / 2
    let acc = 0
    let splitIdx = items.length
    for (let i = 0; i < items.length; i++) {
      acc += heights[i]
      if (acc >= target) { splitIdx = i + 1; break }
    }
    return [items.slice(0, splitIdx), items.slice(splitIdx)]
  }

  const measure = (scale: number, favShown: SetWithStage[], findsShownTry: SetWithStage[]): number => {
    let h = STATS_H
    if (favShown.length) {
      h += SECTION_LABEL_H
      const [left, right] = splitColumns(favShown, scale)
      const colH = (col: SetWithStage[]) => col.reduce((sum, s) => sum + itemHeight(s, favStyle(s, scale), COL_W), 0)
      h += Math.max(colH(left), colH(right))
    }
    if (findsShownTry.length) {
      const st = scaled(FIND_STYLE, scale)
      h += BLOCK_GAP + FINDS_TAG_H + FINDS_CAPTION_H
      for (let i = 0; i < findsShownTry.length; i++) {
        const s = findsShownTry[i]
        ctx.font = fontStr(font, st.size)
        const lines = wrap(ctx, s.artist_name.toUpperCase(), COL_W)
        h += lines.length * st.lh
        if (i > 0) h += st.pad // separator gap
        if (i < findsShownTry.length - 1) h += st.pad // gap before next
      }
    }
    return h
  }

  // Fit: shrink type and trim favorites before dropping finds below a floor of 2
  // (when any exist) — only give up finds entirely if nothing else fits.
  type Fit = { fc: number; scale: number; nc: number }
  const tryFit = (ncFloor: number): Fit | null => {
    for (let fc = favCapMax; fc >= favCapMin; fc--) {
      for (const s of SHRINK_SCALES) {
        for (let nc = findCapMax; nc >= ncFloor; nc--) {
          const favShown = capByTier(favPool, tiers, fc)
          const findsShownTry = capByTier(finds, tiers, nc)
          if (measure(s, favShown, findsShownTry) <= bodyHeight) return { fc, scale: s, nc }
        }
      }
    }
    return null
  }

  const minFindsPreferred = finds.length ? Math.min(2, findCapMax) : 0
  const fit = tryFit(minFindsPreferred) ?? tryFit(0) ??
    { fc: favCapMin, scale: SHRINK_SCALES[SHRINK_SCALES.length - 1], nc: 0 }

  const scale = fit.scale
  const favorites = capByTier(favPool, tiers, fit.fc)
  const findsShown = capByTier(finds, tiers, fit.nc)

  // Stats strip
  const statItems = [
    { n: stats.setsCount, label: stats.setsCount === 1 ? 'SET' : 'SETS' },
    { n: stats.stagesCount, label: stats.stagesCount === 1 ? 'STAGE' : 'STAGES' },
    { n: stats.daysAttended, label: stats.daysAttended === 1 ? 'DAY' : 'DAYS' },
  ].filter(i => i.n > 0)
  const statColW = (W - PAD * 2) / Math.max(statItems.length, 1)
  statItems.forEach((item, i) => {
    const x = PAD + i * statColW
    ctx.fillStyle = t.ink
    ctx.font = fontStr(font, STATS_NUM_SIZE)
    ctx.fillText(String(item.n), x, bodyTop + STATS_NUM_SIZE)
    ctx.font = metaStr(26)
    ctx.letterSpacing = '5px'
    ctx.fillText(item.label, x, bodyTop + STATS_NUM_SIZE + 40)
    ctx.letterSpacing = '0px'
  })
  let h = STATS_H

  // Favorites — two-column tiered artist names
  if (favorites.length) {
    ctx.font = metaStr(26)
    ctx.letterSpacing = '5px'
    ctx.fillStyle = t.ink
    ctx.fillText(favLabel, PAD, bodyTop + h + SECTION_LABEL_H - 18)
    ctx.letterSpacing = '0px'
    h += SECTION_LABEL_H

    const columns = splitColumns(favorites, scale)
    const colXs = [PAD, PAD + COL_W + COL_GAP]
    let maxColH = 0

    for (let ci = 0; ci < 2; ci++) {
      const col = columns[ci]
      const x = colXs[ci]
      let ch = 0
      for (let ri = 0; ri < col.length; ri++) {
        const s = col[ri]
        const st = favStyle(s, scale)
        const lines = rowLinesCol(s, st, COL_W)
        ctx.font = fontStr(font, st.size)
        ctx.fillStyle = t.ink
        if (ri > 0) {
          const prevTier = tiers.get(col[ri - 1].id) ?? 'standard'
          const ruleH = prevTier === 'headliner' ? 4 : 2
          ctx.fillStyle = prevTier === 'headliner' ? t.ink : t.rule
          ctx.fillRect(x, bodyTop + h + ch, COL_W, ruleH)
          ctx.fillStyle = t.ink
          ch += st.pad
        }
        lines.forEach((line, i) => ctx.fillText(line, x, bodyTop + h + ch + (i + 1) * st.lh - 12))
        ch += lines.length * st.lh
        if (ri < col.length - 1) ch += st.pad
      }
      maxColH = Math.max(maxColH, ch)
    }
    h += maxColH
  }

  // Unexpected finds — visually distinct from top sets via smaller type only
  if (findsShown.length) {
    h += BLOCK_GAP
    const tag = 'UNEXPECTED FINDS'
    ctx.font = metaStr(26)
    ctx.letterSpacing = '5px'
    const tagW = ctx.measureText(tag).width + 40
    ctx.fillStyle = t.accent
    ctx.fillRect(PAD, bodyTop + h, tagW, FINDS_TAG_H)
    ctx.fillStyle = t.accent === t.ink ? t.bg : t.ink
    ctx.fillText(tag, PAD + 20, bodyTop + h + FINDS_TAG_H - 19)
    ctx.letterSpacing = '0px'
    h += FINDS_TAG_H

    ctx.font = metaStr(22, 500)
    ctx.fillStyle = t.ink
    ctx.fillText('NOT ON THE PLAN — LOVED IT ANYWAY', PAD, bodyTop + h + FINDS_CAPTION_H - 12)
    h += FINDS_CAPTION_H

    const st = scaled(FIND_STYLE, scale)
    for (let fi = 0; fi < findsShown.length; fi++) {
      const s = findsShown[fi]
      const lines = rowLinesCol(s, st, COL_W)
      ctx.font = fontStr(font, st.size)
      ctx.fillStyle = t.ink
      if (fi > 0) {
        ctx.fillRect(PAD, bodyTop + h, COL_W, 2)
        h += st.pad
      }
      lines.forEach((line, i) => ctx.fillText(line, PAD, bodyTop + h + (i + 1) * st.lh - 12))
      h += lines.length * st.lh
      if (fi < findsShown.length - 1) h += st.pad
    }
  }

  // Footer — rule + right-aligned "made with earrands.app"
  ctx.fillStyle = t.ink
  ctx.fillRect(PAD, FOOTER_RULE_Y, W - PAD * 2, 3)
  ctx.font = metaStr(22, 400)
  const footerText = 'made with https://earrands.app'
  ctx.fillText(footerText, W - PAD - ctx.measureText(footerText).width, FOOTER_BASELINE)
}
