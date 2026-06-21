import { Outlet } from 'react-router-dom'
import { AdminSidebar } from '../../components/admin/AdminSidebar'

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-surface">
      <AdminSidebar />
      <main className="flex-1 p-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
