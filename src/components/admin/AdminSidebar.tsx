import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/admin', label: 'Dash', end: true },
  { to: '/admin/festivals', label: 'Fests' },
  { to: '/admin/artists', label: 'Artists' },
  { to: '/admin/requests', label: 'Reqs' },
  { to: '/admin/notifications', label: 'Notify' },
  { to: '/admin/jobs', label: 'Jobs' },
] as const

const BASE = 'block px-3 py-2 font-mono text-sm uppercase tracking-wider transition-colors'
const ACTIVE = `${BASE} text-surface bg-accent font-bold`
const INACTIVE = `${BASE} text-text-secondary hover:text-accent`

export function AdminSidebar() {
  return (
    <nav className="w-24 shrink-0 border-r border-border min-h-screen pt-3">
      <div className="px-3 pb-2">
        <span className="font-mono font-bold text-accent text-xs uppercase tracking-widest">Admin</span>
      </div>
      <ul>
        {NAV_ITEMS.map(item => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={('end' in item) ? item.end : false}
              className={({ isActive }) => isActive ? ACTIVE : INACTIVE}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
