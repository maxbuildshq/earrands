import { useSearchParams } from 'react-router-dom'
import { Heading } from '../../components/ui/Heading'
import { useAdminFestivals } from '../../hooks/useAdminFestivals'
import { useSets, useStages } from '../../hooks/useFestivalData'
import { SetArtistCompare } from '../../components/admin/SetArtistCompare'
import { ParseSuggestions } from '../../components/admin/ParseSuggestions'

export default function AdminSets() {
  const [searchParams, setSearchParams] = useSearchParams()
  const festivalId = searchParams.get('festival') ?? ''

  const { data: festivals = [] } = useAdminFestivals()
  const { data: sets = [], isLoading } = useSets(festivalId || undefined)
  const { data: stages = [] } = useStages(festivalId || undefined)

  function setFestivalId(v: string) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (v) next.set('festival', v)
      else next.delete('festival')
      return next
    }, { replace: true })
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-3rem)]">
      <Heading variant="page">Sets</Heading>

      <div className="flex items-end gap-3 flex-wrap">
        <select
          value={festivalId}
          onChange={e => setFestivalId(e.target.value)}
          className="bg-surface border border-border text-text-primary font-mono text-sm px-3 py-2 uppercase tracking-wider"
        >
          <option value="">Select a festival</option>
          {festivals.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>

      {!festivalId ? (
        <p className="font-mono text-sm text-text-secondary">Select a festival to compare its sets against parsed artists.</p>
      ) : isLoading ? (
        <p className="font-mono text-sm text-text-secondary">Loading...</p>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col gap-4">
          <ParseSuggestions festivalId={festivalId} />
          <div className="flex-1 min-h-0">
            <SetArtistCompare sets={sets} stages={stages} fill />
          </div>
        </div>
      )}
    </div>
  )
}
