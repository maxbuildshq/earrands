import { useEffect, useRef, useState } from 'react'
import posthog from 'posthog-js'
import { BottomSheet } from '../common/BottomSheet'
import { TEMPLATES, drawSchedule, buildShareFilename } from '../../lib/shareImage'
import { useCreateSharedSchedule } from '../../hooks/useSharedSchedule'
import type { SetWithStage } from '../../types/database'

type Props = {
  festivalName: string
  festivalId: string
  festivalSlug: string
  sets: SetWithStage[]
  onClose: () => void
}

export function ShareScheduleSheet({ festivalName, festivalId, festivalSlug, sets, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [templateIdx, setTemplateIdx] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const createShare = useCreateSharedSchedule()

  // Redraw on template change (and once webfonts are ready, so monospace renders correctly).
  useEffect(() => {
    let cancelled = false
    const render = async () => {
      try { await document.fonts.ready } catch { /* fonts API unavailable — draw anyway */ }
      if (cancelled || !canvasRef.current) return
      drawSchedule(canvasRef.current, { festivalName, sets, template: TEMPLATES[templateIdx] })
    }
    render()
    return () => { cancelled = true }
  }, [festivalName, sets, templateIdx])

  const getBlob = (): Promise<Blob | null> =>
    new Promise(resolve => {
      if (!canvasRef.current) { resolve(null); return }
      canvasRef.current.toBlob(b => resolve(b), 'image/png')
    })

  const filename = buildShareFilename(festivalName)

  const handleShare = async () => {
    setBusy(true)
    setError('')
    try {
      const code = await createShare.mutateAsync({
        festivalId,
        setIds: sets.map(s => s.id),
      })
      const shareUrl = `https://earrands.app/app/festivals/${festivalSlug}/shared/${code}`

      const blob = await getBlob()
      if (!blob) throw new Error('render failed')
      const file = new File([blob], filename, { type: 'image/png' })
      posthog.capture('schedule_shared', {
        festival_name: festivalName,
        template: TEMPLATES[templateIdx].id,
        set_count: sets.length,
        share_code: code,
      })
      // File sharing via Web Share API only works reliably on mobile (iOS/Android).
      // On desktop macOS, canShare may return true but most apps only receive
      // text/URL — not the image file. So we restrict to touch devices.
      const isMobile = navigator.maxTouchPoints > 0
      if (isMobile && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `My ${festivalName} schedule`,
          text: `My ${festivalName} lineup 🎵\n${shareUrl}`,
        })
      } else {
        downloadBlob(blob, filename)
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError('Could not share — try Download instead.')
    } finally {
      setBusy(false)
    }
  }

  const handleDownload = async () => {
    const blob = await getBlob()
    if (!blob) return
    posthog.capture('schedule_downloaded', { festival_name: festivalName, template: TEMPLATES[templateIdx].id })
    downloadBlob(blob, filename)
  }

  return (
    <BottomSheet title="SHARE MY SCHEDULE" onClose={onClose}>
      <div className="px-4 pb-8 pt-1 space-y-4">
        <div className="flex gap-2">
          {TEMPLATES.map((t, i) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplateIdx(i)}
              className={`flex-1 py-2 px-2 font-mono text-xs uppercase tracking-wider border transition-colors ${
                i === templateIdx
                  ? 'bg-acid text-surface border-acid'
                  : 'bg-surface text-text-secondary border-border hover:border-text-secondary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            className="border border-border"
            style={{ maxHeight: '52vh', maxWidth: '100%', width: 'auto' }}
          />
        </div>

        {error && <div className="text-live text-sm font-mono">{error}</div>}

        <div className="flex flex-col gap-2">
          <button
            onClick={handleShare}
            disabled={busy}
            className="w-full bg-acid text-surface font-mono font-bold py-2.5 text-sm uppercase tracking-wider hover:bg-acid-dim transition-colors disabled:opacity-50"
          >
            {busy ? 'PREPARING…' : 'Share'}
          </button>
          <button
            onClick={handleDownload}
            className="w-full border border-border text-text-secondary font-mono py-2.5 text-sm uppercase tracking-wider hover:border-text-secondary hover:text-text-primary transition-colors"
          >
            Download image
          </button>
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
