import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { Layout } from './components/layout/Layout'
import { FestivalListPage } from './pages/FestivalListPage'
import { SchedulePage } from './pages/SchedulePage'
import { SharedSchedulePage } from './pages/SharedSchedulePage'
import { LoginPage } from './pages/LoginPage'
import { SignUpPage } from './pages/SignUpPage'
import { OfflineNotice } from './components/common/OfflineNotice'
import { AdminGuard } from './components/admin/AdminGuard'

const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminFestivalList = lazy(() => import('./pages/admin/AdminFestivalList'))
const AdminFestivalDetail = lazy(() => import('./pages/admin/AdminFestivalDetail'))
const AdminArtistList = lazy(() => import('./pages/admin/AdminArtistList'))
const AdminSets = lazy(() => import('./pages/admin/AdminSets'))
const AdminArtistDetail = lazy(() => import('./pages/admin/AdminArtistDetail'))
const AdminRequests = lazy(() => import('./pages/admin/AdminRequests'))
const AdminNotifications = lazy(() => import('./pages/admin/AdminNotifications'))
const AdminJobs = lazy(() => import('./pages/admin/AdminJobs'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename="/app">
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<FestivalListPage />} />
              <Route path="festivals/:slug/schedule" element={<SchedulePage />} />
              <Route path="festivals/:slug/shared/:code" element={<SharedSchedulePage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="signup" element={<SignUpPage />} />
            </Route>
            <Route
              path="admin"
              element={
                <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-surface"><div className="text-text-secondary font-mono text-sm tracking-wider">LOADING...</div></div>}>
                  <AdminGuard><AdminLayout /></AdminGuard>
                </Suspense>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="festivals" element={<AdminFestivalList />} />
              <Route path="festivals/:id" element={<AdminFestivalDetail />} />
              <Route path="artists" element={<AdminArtistList />} />
              <Route path="artists/:id" element={<AdminArtistDetail />} />
              <Route path="sets" element={<AdminSets />} />
              <Route path="requests" element={<AdminRequests />} />
              <Route path="notifications" element={<AdminNotifications />} />
              <Route path="jobs" element={<AdminJobs />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <OfflineNotice />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
