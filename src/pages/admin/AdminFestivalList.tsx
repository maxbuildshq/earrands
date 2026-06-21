import { Link } from 'react-router-dom'
import { Heading } from '../../components/ui/Heading'
import { Button } from '../../components/ui/Button'
import { useAdminFestivals, useAdminFestivalStats, useToggleFestivalField } from '../../hooks/useAdminFestivals'
import { useSendNotification } from '../../hooks/useAdminNotifications'
import { useCreateJob } from '../../hooks/useAdminJobs'

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminFestivalList() {
  const { data: festivals = [], isLoading } = useAdminFestivals()
  const { data: stats = [] } = useAdminFestivalStats()
  const toggle = useToggleFestivalField()
  const notify = useSendNotification()
  const createJob = useCreateJob()

  const statsMap = new Map(stats.map(s => [s.id, s]))

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Heading variant="page">Festivals</Heading>
        <p className="font-mono text-sm text-text-secondary">Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Heading variant="page">Festivals</Heading>

      <div className="border border-border">
        {/* Header */}
        <div className="grid grid-cols-[1fr_100px_90px_90px_60px_60px_60px_160px] gap-2 px-4 py-2.5 border-b border-border font-mono text-xs uppercase tracking-widest text-text-secondary">
          <span>Name</span>
          <span>Dates</span>
          <span>Published</span>
          <span>Timetable</span>
          <span>Sets</span>
          <span>Artists</span>
          <span>Follows</span>
          <span>Actions</span>
        </div>

        {festivals.map(f => {
          const s = statsMap.get(f.id)
          return (
            <div
              key={f.id}
              className="grid grid-cols-[1fr_100px_90px_90px_60px_60px_60px_160px] gap-2 px-4 py-3.5 border-b border-border last:border-b-0 items-center hover:bg-surface-raised transition-colors"
            >
              <Link to={`/admin/festivals/${f.id}`} className="font-mono text-sm font-bold text-text-primary hover:text-accent transition-colors truncate">
                {f.name}
              </Link>

              <span className="font-mono text-sm text-text-secondary">
                {formatDate(f.start_date)}
              </span>

              <div>
                <Button
                  variant="choice"
                  active={f.published}
                  fullWidth={false}
                  className="!text-xs !px-3 !py-1"
                  onClick={() => toggle.mutate({ id: f.id, field: 'published', value: !f.published })}
                >
                  {f.published ? 'Live' : 'Draft'}
                </Button>
              </div>

              <div>
                <Button
                  variant="choice"
                  active={f.timetable_announced}
                  fullWidth={false}
                  className="!text-xs !px-3 !py-1"
                  onClick={() => toggle.mutate({ id: f.id, field: 'timetable_announced', value: !f.timetable_announced })}
                >
                  {f.timetable_announced ? 'Live' : 'Lineup'}
                </Button>
              </div>

              <span className="font-mono text-sm text-text-secondary">{s?.sets_count ?? '—'}</span>
              <span className="font-mono text-sm text-text-secondary">{s?.artists_count ?? '—'}</span>
              <span className="font-mono text-sm text-text-secondary">{s?.followers_count ?? '—'}</span>

              <div className="flex gap-1">
                <Button
                  variant="secondary"
                  fullWidth={false}
                  className="!text-xs !px-3 !py-1"
                  onClick={() => createJob.mutate({ type: 'parse_artists', festival_slug: f.slug })}
                  disabled={createJob.isPending}
                >
                  Parse
                </Button>
                <Button
                  variant="secondary"
                  fullWidth={false}
                  className="!text-xs !px-3 !py-1"
                  onClick={() => notify.mutate({ type: 'follow', festival_id: f.id, festival_slug: f.slug, dry_run: true })}
                  disabled={notify.isPending}
                >
                  Notify
                </Button>
              </div>
            </div>
          )
        })}

        {festivals.length === 0 && (
          <div className="px-4 py-8 text-center font-mono text-sm text-text-secondary">
            No festivals found.
          </div>
        )}
      </div>
    </div>
  )
}
