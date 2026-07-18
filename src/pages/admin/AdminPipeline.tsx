import { Link, useSearchParams } from 'react-router-dom'
import { Heading } from '../../components/ui/Heading'
import { Badge } from '../../components/ui/Badge'
import {
  useAdminFestivals, usePipelineCounters, useToggleFestivalField,
} from '../../hooks/useAdminFestivals'
import { useCreateJob } from '../../hooks/useAdminJobs'

type StepStatus = 'done' | 'partial' | 'todo' | 'manual'

function StatusBadge({ status }: { status: StepStatus }) {
  if (status === 'done') return <Badge variant="accent">done</Badge>
  if (status === 'partial') return <Badge variant="accent-outline">in progress</Badge>
  if (status === 'manual') return <Badge variant="outline">human gate</Badge>
  return <Badge variant="outline">todo</Badge>
}

function Step({ title, status, counter, children }: {
  title: string
  status: StepStatus
  counter?: string
  children?: React.ReactNode
}) {
  return (
    <div className="border border-border p-4 flex items-start gap-4">
      <div className="w-28 shrink-0"><StatusBadge status={status} /></div>
      <div className="space-y-1 min-w-0">
        <p className="font-mono text-sm text-text-primary uppercase tracking-wider">
          {title}
          {counter && <span className="text-accent ml-3 normal-case">{counter}</span>}
        </p>
        {children}
      </div>
    </div>
  )
}

const hintClass = 'font-mono text-xs text-text-secondary'
const linkClass = 'font-mono text-xs text-accent uppercase tracking-wider hover:underline'

/**
 * Festival Pipeline (Phase 3, orchestrator pilot) — glue over existing data
 * and jobs, no state of its own. Live counters per step; local-only steps
 * (ingest, parse) show the CLI command instead of a button.
 */
export default function AdminPipeline() {
  const [searchParams, setSearchParams] = useSearchParams()
  const festivalId = searchParams.get('festival') ?? ''

  const { data: festivals = [] } = useAdminFestivals()
  const festival = festivals.find(f => f.id === festivalId)
  const { data: c } = usePipelineCounters(festivalId || undefined)
  const toggleField = useToggleFestivalField()
  const createJob = useCreateJob()

  function setFestivalId(v: string) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (v) next.set('festival', v)
      else next.delete('festival')
      return next
    }, { replace: true })
  }

  const ratio = (n: number, total: number): StepStatus =>
    total === 0 ? 'todo' : n === total ? 'done' : n === 0 ? 'todo' : 'partial'

  return (
    <div className="space-y-4">
      <Heading variant="page">Pipeline</Heading>

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

      {!festival ? (
        <p className="font-mono text-sm text-text-secondary">Select a festival to see its pipeline.</p>
      ) : !c ? (
        <p className="font-mono text-sm text-text-secondary">Loading counters...</p>
      ) : (
        <div className="space-y-2">
          <Step
            title="Extract"
            status={c.sets > 0 ? 'done' : 'todo'}
            counter={`${c.sets} sets`}
          >
            <p className={hintClass}>
              {festival.timetable_announced ? 'Timetable announced.' : 'Lineup-only (timetable_announced = false).'}
              {' '}Runs locally: <code>npm run ingest -- --url=&lt;festival-url&gt;</code>
            </p>
          </Step>

          <Step
            title="Parse"
            status={c.suggestions_pending > 0 ? 'partial' : ratio(c.sets_with_artists, c.sets)}
            counter={`${c.sets_with_artists}/${c.sets} sets linked`}
          >
            {c.suggestions_pending > 0 && (
              <p className={hintClass}>{c.suggestions_pending} parse suggestion(s) pending review.</p>
            )}
            <p className={hintClass}>
              Runs locally: <code>npm run parse-artists -- --festival={festival.slug} --arbiter</code>
            </p>
            <Link className={linkClass} to={`/admin/sets?festival=${festival.id}`}>Review sets & suggestions →</Link>
          </Step>

          <Step
            title="Enrich"
            status={ratio(c.artists_enriched, c.artists)}
            counter={`${c.artists_enriched}/${c.artists} artists`}
          >
            <div className="flex gap-4 items-center">
              <button
                className={linkClass}
                onClick={() => createJob.mutate({ festival_slug: festival.slug })}
                disabled={createJob.isPending}
              >
                {createJob.isSuccess ? 'Job queued ✓' : 'Queue enrichment job'}
              </button>
              <Link className={linkClass} to="/admin/jobs">Jobs →</Link>
            </div>
          </Step>

          <Step
            title="Review"
            status={ratio(c.artists_reviewed, c.artists)}
            counter={`${c.artists_reviewed}/${c.artists} reviewed`}
          >
            <Link className={linkClass} to="/admin/review">Enrichment review →</Link>
          </Step>

          <Step title="QA" status="manual">
            <p className={hintClass}>Direct slug access works while unpublished.</p>
            <Link className={linkClass} to={`/festivals/${festival.slug}/schedule`} target="_blank">
              Open schedule →
            </Link>
          </Step>

          <Step title="Publish" status={festival.published ? 'done' : 'todo'}>
            <button
              className={linkClass}
              onClick={() => toggleField.mutate({ id: festival.id, field: 'published', value: !festival.published })}
              disabled={toggleField.isPending}
            >
              {festival.published ? 'Published — unpublish' : 'Publish festival'}
            </button>
          </Step>

          <Step
            title="Notify"
            status={c.followers === 0 ? 'todo' : ratio(c.followers_notified, c.followers)}
            counter={`${c.followers_notified}/${c.followers} followers notified`}
          >
            <Link className={linkClass} to="/admin/notifications">Notifications →</Link>
          </Step>
        </div>
      )}
    </div>
  )
}
