import { useEffect, useMemo, useRef, useState } from 'react'
import posthog from 'posthog-js'
import { BottomSheet } from '../common/BottomSheet'
import { Button } from '../ui/Button'
import { TEMPLATES, DISPLAY_FONT } from '../../lib/shareImage'
import { drawRecapCard, buildRecapFilename } from '../../lib/recapImage'
import { computeSetTiers } from '../../lib/shareLayout'
import { downloadBlob } from '../../lib/download'
import { formatDateRange } from '../../lib/dates'
import type { RecapStats } from '../../lib/recap'
import type { Festival } from '../../types/database'

type Props = {
  festival: Festival
  stats: RecapStats
  onClose: () => void
}

export function RecapSheet({ festival, stats, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [templateIdx, setTemplateIdx] = useState(0)
  const [fontsReady, setFontsReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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

  const tiers = useMemo(
    () => computeSetTiers([...stats.favorites, ...stats.unexpectedFinds]),
    [stats],
  )
  const template = TEMPLATES[templateIdx]
  const dateRange = formatDateRange(festival.start_date, festival.end_date)

  const eventProps = () => ({
    festival_name: festival.name,
    template: template.id,
    data_level: stats.level,
  })

  useEffect(() => {
    posthog.capture('recap_opened', {
      festival_name: festival.name,
      data_level: stats.level,
      favorites_count: stats.favorites.length,
      loved_count: stats.lovedSets.length,
      unexpected_count: stats.unexpectedFinds.length,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!canvasRef.current || !fontsReady) return
    drawRecapCard(canvasRef.current, { festivalName: festival.name, dateRange, stats, template, tiers })
  }, [festival.name, dateRange, stats, template, tiers, fontsReady])

  const renderFile = async (): Promise<File> => {
    const canvas = document.createElement('canvas')
    drawRecapCard(canvas, { festivalName: festival.name, dateRange, stats, template, tiers })
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('render failed')
    return new File([blob], buildRecapFilename(festival.name), { type: 'image/png' })
  }

  const handleShare = async () => {
    setBusy(true)
    setError('')
    try {
      const file = await renderFile()
      const files = [file]
      const method = navigator.canShare?.({ files })
        ? 'native_share_files'
        : typeof navigator.share === 'function' ? 'native_share_link' : 'download_fallback'
      posthog.capture('recap_shared', { ...eventProps(), method })
      if (navigator.canShare?.({ files })) {
        await navigator.share({
          files,
          title: `My ${festival.name} recap`,
          text: `My ${festival.name} recap\nhttps://earrands.app`,
        })
      } else if (navigator.share) {
        downloadBlob(file, file.name)
        await navigator.share({
          title: `My ${festival.name} recap`,
          text: `My ${festival.name} recap`,
          url: 'https://earrands.app',
        })
      } else {
        downloadBlob(file, file.name)
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError('Could not share — try Download instead.')
    } finally {
      setBusy(false)
    }
  }

  const handleDownload = async () => {
    const file = await renderFile()
    posthog.capture('recap_downloaded', eventProps())
    downloadBlob(file, file.name)
  }

  return (
    <BottomSheet title="MY FESTIVAL RECAP" onClose={onClose}>
      <div className="px-4 pb-4 pb-[env(safe-area-inset-bottom)] pt-1 space-y-3">
        <div className="flex border border-border w-max">
          {TEMPLATES.map((t, i) => (
            <Button
              key={t.id}
              type="button"
              variant="segment"
              active={i === templateIdx}
              fullWidth={false}
              onClick={() => setTemplateIdx(i)}
              className={`px-3.5 py-2.5${i > 0 ? ' border-l border-border' : ''}`}
            >
              {t.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center justify-center">
          <canvas
            ref={canvasRef}
            className="border border-border"
            style={{ maxHeight: '36vh', maxWidth: '100%', width: 'auto' }}
          />
        </div>

        {error && <div className="text-negative text-sm font-mono">{error}</div>}

        <div className="flex flex-col gap-2">
          <Button onClick={handleShare} variant="primary" disabled={busy || !fontsReady}>
            {busy ? 'PREPARING…' : 'Share'}
          </Button>
          <Button onClick={handleDownload} variant="secondary" disabled={!fontsReady}>
            Download image
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
