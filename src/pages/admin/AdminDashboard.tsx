import { Link } from 'react-router-dom'
import { Heading } from '../../components/ui/Heading'
import { Badge } from '../../components/ui/Badge'
import { useAdminFestivals, useAdminFestivalStats } from '../../hooks/useAdminFestivals'
import { useAdminArtists } from '../../hooks/useAdminArtists'
import { useAdminRequests } from '../../hooks/useAdminRequests'
import { useAdminJobs } from '../../hooks/useAdminJobs'

function StatCard({ label, value, to }: { label: string; value: string | number; to?: string }) {
  const inner = (
    <div className="border border-border p-4 hover:border-accent transition-colors">
      <span className="font-mono text-3xl font-bold text-accent">{value}</span>
      <p className="font-mono text-xs text-text-secondary uppercase tracking-wider mt-1">{label}</p>
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

export default function AdminDashboard() {
  const { data: festivals = [] } = useAdminFestivals()
  const { data: stats = [] } = useAdminFestivalStats()
  const { data: artistResult } = useAdminArtists({ limit: 1 })
  const { data: requests = [] } = useAdminRequests()
  const { data: jobs = [] } = useAdminJobs()

  const published = festivals.filter(f => f.published).length
  const drafts = festivals.filter(f => !f.published).length
  const totalSets = stats.reduce((sum, s) => sum + s.sets_count, 0)
  const totalFollowers = stats.reduce((sum, s) => sum + s.followers_count, 0)
  const pendingRequests = requests.filter(r => !r.notified_at).length
  const runningJobs = jobs.filter(j => j.status === 'running' || j.status === 'pending').length
  const failedJobs = jobs.filter(j => j.status === 'failed').length

  return (
    <div className="space-y-8">
      <Heading variant="page">Dashboard</Heading>

      {/* Overview stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Festivals" value={festivals.length} to="/admin/festivals" />
        <StatCard label="Published" value={published} to="/admin/festivals" />
        <StatCard label="Artists" value={artistResult?.count ?? '—'} to="/admin/artists" />
        <StatCard label="Total Sets" value={totalSets} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Followers" value={totalFollowers} />
        <StatCard label="Pending Requests" value={pendingRequests} to="/admin/requests" />
        <StatCard label="Active Jobs" value={runningJobs} to="/admin/jobs" />
        <StatCard label="Drafts" value={drafts} to="/admin/festivals" />
      </div>

      {/* Attention queue */}
      <section className="space-y-4">
        <Heading variant="section">Attention Queue</Heading>

        {pendingRequests > 0 && (
          <Link to="/admin/requests" className="flex items-center gap-3 border border-border p-3 hover:border-accent transition-colors">
            <Badge variant="accent-outline">{pendingRequests}</Badge>
            <span className="font-mono text-sm text-text-primary">pending festival requests</span>
          </Link>
        )}

        {failedJobs > 0 && (
          <Link to="/admin/jobs" className="flex items-center gap-3 border border-border p-3 hover:border-accent transition-colors">
            <Badge variant="accent-outline">{failedJobs}</Badge>
            <span className="font-mono text-sm text-text-primary">failed background jobs</span>
          </Link>
        )}

        {drafts > 0 && (
          <Link to="/admin/festivals" className="flex items-center gap-3 border border-border p-3 hover:border-accent transition-colors">
            <Badge variant="outline">{drafts}</Badge>
            <span className="font-mono text-sm text-text-primary">unpublished festivals</span>
          </Link>
        )}

        {pendingRequests === 0 && failedJobs === 0 && drafts === 0 && (
          <p className="font-mono text-sm text-text-secondary">Nothing needs attention.</p>
        )}
      </section>
    </div>
  )
}
