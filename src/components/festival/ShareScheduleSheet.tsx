import { useEffect, useMemo, useRef, useState } from 'react'
import posthog from 'posthog-js'
import { BottomSheet } from '../common/BottomSheet'
import { Button } from '../ui/Button'
import { TEMPLATES, DISPLAY_FONT, drawSchedulePage, buildSharePages, buildShareFilename } from '../../lib/shareImage'
import { computeSetTiers } from '../../lib/shareLayout'
import type { SchedulePage, SplitMode } from '../../lib/shareLayout'
import { useCreateSharedSchedule } from '../../hooks/useSharedSchedule'
import type { SetWithStage } from '../../types/database'

type Props = {
  festivalName: string
  festivalId: string
  festivalSlug: string
  sets: SetWithStage[]
  onClose: () => void
}

type SplitOption = { mode: SplitMode; label: string; pages: SchedulePage[] }

export function ShareScheduleSheet({ festivalName, festivalId, festivalSlug, sets, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [templateIdx, setTemplateIdx] = useState(0)
  const [splitMode, setSplitMode] = useState<SplitMode | null>(null)
  const [pageIdx, setPageIdx] = useState(0)
  const [fontsReady, setFontsReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const createShare = useCreateSharedSchedule()

  // Wait for the display weight before measuring/drawing, so pagination and
  // text layout aren't computed against a fallback font.
  useEffect(() => {
    let cancelled = false
    Promise.allSettled([
      document.fonts.load(`${DISPLAY_FONT.weight} 118px "${DISPLAY_FONT.family}"`),
      document.fonts.load('600 30px "Chakra Petch"'),
      document.fonts.ready,
    ])
      .then(() => { if (!cancelled) setFontsReady(true) })
    return () => { cancelled = true }
  }, [])

  const tiers = useMemo(() => computeSetTiers(sets), [sets])

  // Per-day first (story-friendly), then size-aware grouping, then all-in-one
  // when it actually fits. Options with identical page counts are duplicates
  // (grouping only differs when it merges days), so keep the first.
  const splitOptions = useMemo<SplitOption[]>(() => {
    if (!fontsReady || sets.length === 0) return []
    const { perDay, grouped, single } = buildSharePages({ festivalName, sets, tiers })
    const options: SplitOption[] = [
      { mode: 'perDay' as const, label: `Per day (${perDay.length})`, pages: perDay },
      { mode: 'grouped' as const, label: grouped.length === 1 ? '1 image' : `Combined (${grouped.length})`, pages: grouped },
      ...(single ? [{ mode: 'single' as const, label: '1 image', pages: single }] : []),
    ]
    return options.filter((o, i) => o.pages.length > 0 && !options.slice(0, i).some(p => p.pages.length === o.pages.length))
  }, [fontsReady, sets, tiers, festivalName])

  const active = splitOptions.find(o => o.mode === splitMode) ?? splitOptions[0]
  const pages = active?.pages ?? []
  const safePageIdx = Math.min(pageIdx, Math.max(pages.length - 1, 0))
  const template = TEMPLATES[templateIdx]

  useEffect(() => {
    if (!canvasRef.current || !pages[safePageIdx]) return
    drawSchedulePage(canvasRef.current, {
      festivalName,
      page: pages[safePageIdx],
      pageIndex: safePageIdx,
      pageCount: pages.length,
      template,
      tiers,
    })
  }, [festivalName, pages, safePageIdx, template, tiers])

  const renderAllPages = async (): Promise<File[]> => {
    const files: File[] = []
    for (let i = 0; i < pages.length; i++) {
      const canvas = document.createElement('canvas')
      drawSchedulePage(canvas, { festivalName, page: pages[i], pageIndex: i, pageCount: pages.length, template, tiers })
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('render failed')
      files.push(new File([blob], buildShareFilename(festivalName, i + 1, pages.length), { type: 'image/png' }))
    }
    return files
  }

  const eventProps = () => ({
    festival_name: festivalName,
    template: template.id,
    set_count: sets.length,
    split_mode: active?.mode,
    page_count: pages.length,
  })

  const handleShare = async () => {
    setBusy(true)
    setError('')
    try {
      const code = await createShare.mutateAsync({
        festivalId,
        setIds: sets.map(s => s.id),
      })
      const shareUrl = `https://earrands.app/app/festivals/${festivalSlug}/shared/${code}`

      const files = await renderAllPages()
      posthog.capture('schedule_shared', { ...eventProps(), share_code: code })
      if (navigator.canShare?.({ files })) {
        await navigator.share({
          files,
          title: `My ${festivalName} schedule`,
          text: `My ${festivalName} lineup\n${shareUrl}`,
        })
      } else if (navigator.share) {
        // No file support (typical on desktop): the button still promises
        // link + images, so save the images before the link-only share sheet.
        for (const f of files) downloadBlob(f, f.name)
        await navigator.share({
          title: `My ${festivalName} schedule`,
          text: `My ${festivalName} lineup`,
          url: shareUrl,
        })
      } else {
        for (const f of files) downloadBlob(f, f.name)
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError('Could not share — try Download instead.')
    } finally {
      setBusy(false)
    }
  }

  const handleDownload = async () => {
    const files = await renderAllPages()
    posthog.capture('schedule_downloaded', eventProps())
    if (navigator.canShare?.({ files })) {
      try { await navigator.share({ files }) } catch { for (const f of files) downloadBlob(f, f.name) }
    } else {
      for (const f of files) downloadBlob(f, f.name)
    }
  }

  return (
    <BottomSheet title="SHARE MY SCHEDULE" onClose={onClose}>
      <div className="px-4 pb-8 pt-1 space-y-4">
        <div className="flex gap-2">
          {TEMPLATES.map((t, i) => (
            <Button
              key={t.id}
              type="button"
              variant="choice"
              active={i === templateIdx}
              fullWidth={false}
              onClick={() => setTemplateIdx(i)}
              className="flex-1 py-2 px-2"
            >
              {t.label}
            </Button>
          ))}
        </div>

        {splitOptions.length > 1 && (
          <div className="flex gap-2">
            {splitOptions.map(o => (
              <Button
                key={o.mode}
                type="button"
                variant="choice"
                active={o.mode === active?.mode}
                fullWidth={false}
                onClick={() => { setSplitMode(o.mode); setPageIdx(0) }}
                className="flex-1 py-2 px-2"
              >
                {o.label}
              </Button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-2">
          {pages.length > 1 && (
            <Button
              type="button"
              variant="icon"
              onClick={() => setPageIdx(Math.max(safePageIdx - 1, 0))}
              disabled={safePageIdx === 0}
              aria-label="Previous image"
            >
              ‹
            </Button>
          )}
          <canvas
            ref={canvasRef}
            className="border border-border"
            style={{ maxHeight: '48vh', maxWidth: '100%', width: 'auto' }}
          />
          {pages.length > 1 && (
            <Button
              type="button"
              variant="icon"
              onClick={() => setPageIdx(Math.min(safePageIdx + 1, pages.length - 1))}
              disabled={safePageIdx === pages.length - 1}
              aria-label="Next image"
            >
              ›
            </Button>
          )}
        </div>
        {pages.length > 1 && (
          <div className="text-center text-text-secondary font-mono text-xs">
            {safePageIdx + 1}/{pages.length}
          </div>
        )}

        {error && <div className="text-negative text-sm font-mono">{error}</div>}

        <div className="flex flex-col gap-2">
          <Button onClick={handleShare} variant="primary" disabled={busy || pages.length === 0}>
            {busy ? 'PREPARING…' : pages.length > 1 ? `Share link + ${pages.length} images` : 'Share link + image'}
          </Button>
          <Button onClick={handleDownload} variant="secondary" disabled={pages.length === 0}>
            {pages.length > 1 ? `Download ${pages.length} images` : 'Download image'}
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
