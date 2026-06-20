import { useEffect, useRef, useState, type CSSProperties } from 'react'

export type AtmosphereConfig = {
  intensity: number // 0..100 — overall fog opacity
  fogSpeed: number // % — 100 = base drift/boil rate
  boil: number // 0..100 — how fast the flipbook morphs
  light: number // 0..100 — searchlight strength
  lightSpeed: number // % — sweep rate
}

const DEFAULTS: AtmosphereConfig = { intensity: 10, fogSpeed: 120, boil: 60, light: 16, lightSpeed: 130 }

const STORAGE_KEY = 'atmos-config'

function noiseMask(freq: number, seed: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='460' height='460'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='4' seed='${seed}' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0.85 0 0 0 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

// Pre-baked once at module load — the "flipbook" frames.
const MASKS = [5, 17, 31, 44].map((seed, i) => noiseMask(0.018 + i * 0.004, seed))

function readStored(): Partial<AtmosphereConfig> {
  if (typeof window === 'undefined') return {}
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    return s ? (JSON.parse(s) as Partial<AtmosphereConfig>) : {}
  } catch {
    return {}
  }
}

function toStyle(c: AtmosphereConfig): CSSProperties {
  const fac = c.fogSpeed / 100
  const lfac = c.lightSpeed / 100
  return {
    '--atm-fog': (c.intensity / 100).toFixed(2),
    '--atm-light': (c.light / 100).toFixed(2),
    '--atm-boil': `${((11 - (c.boil / 100) * 9) / fac).toFixed(1)}s`,
    '--atm-drift': `${(26 / fac).toFixed(1)}s`,
    '--atm-ldur': `${(12 / lfac).toFixed(1)}s`,
  } as CSSProperties
}

/** Ambient fog backdrop. Renders behind page content (fixed, z-index -1).
 *  Pauses offscreen and disables under prefers-reduced-motion. Append `?atmos`
 *  to the URL to open a live tuning panel (values persist to localStorage). */
export function Atmosphere({ config }: { config?: Partial<AtmosphereConfig> }) {
  const [cfg, setCfg] = useState<AtmosphereConfig>(() => ({ ...DEFAULTS, ...config, ...readStored() }))
  const [paused, setPaused] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const devPanel = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('atmos')

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setPaused(!e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])

  function update(k: keyof AtmosphereConfig, v: number) {
    setCfg(prev => {
      const next = { ...prev, [k]: v }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  return (
    <>
      <div ref={ref} className={`atmosphere${paused ? ' paused' : ''}`} aria-hidden="true" style={toStyle(cfg)}>
        {MASKS.map((m, i) => (
          <div key={i} className={`fl fl${i}`} style={{ maskImage: m, WebkitMaskImage: m }} />
        ))}
        <div className="beam beam1" />
        <div className="beam beam2" />
      </div>
      {devPanel && <AtmospherePanel cfg={cfg} onChange={update} />}
    </>
  )
}

const FIELDS: { key: keyof AtmosphereConfig; label: string; min: number; max: number }[] = [
  { key: 'intensity', label: 'Intensity', min: 0, max: 100 },
  { key: 'fogSpeed', label: 'Fog speed', min: 25, max: 400 },
  { key: 'boil', label: 'Boil', min: 0, max: 100 },
  { key: 'light', label: 'Light', min: 0, max: 100 },
  { key: 'lightSpeed', label: 'Light speed', min: 25, max: 400 },
]

function AtmospherePanel({ cfg, onChange }: { cfg: AtmosphereConfig; onChange: (k: keyof AtmosphereConfig, v: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-[60] bg-surface-raised/95 border border-border p-3 w-56 backdrop-blur-sm">
      <div className="font-mono text-[10px] tracking-widest text-accent mb-2">ATMOSPHERE</div>
      {FIELDS.map(f => (
        <label key={f.key} className="block mb-2 last:mb-0">
          <span className="flex justify-between font-mono text-[10px] text-text-secondary uppercase">
            <span>{f.label}</span>
            <span>{cfg[f.key]}</span>
          </span>
          <input
            type="range"
            min={f.min}
            max={f.max}
            step={5}
            value={cfg[f.key]}
            onChange={e => onChange(f.key, Number(e.target.value))}
            className="w-full accent-accent"
          />
        </label>
      ))}
    </div>
  )
}
