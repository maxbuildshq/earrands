import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { Layout } from './components/layout/Layout'
import { AuthGuard } from './components/AuthGuard'
import { FestivalListPage } from './pages/FestivalListPage'
import { SchedulePage } from './pages/SchedulePage'
import { MySchedulePage } from './pages/MySchedulePage'
import { SharedSchedulePage } from './pages/SharedSchedulePage'
import { LoginPage } from './pages/LoginPage'
import { SignUpPage } from './pages/SignUpPage'
import { OfflineNotice } from './components/common/OfflineNotice'

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
              <Route path="festivals/:slug/my-schedule" element={<AuthGuard><MySchedulePage /></AuthGuard>} />
              <Route path="festivals/:slug/shared/:code" element={<SharedSchedulePage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="signup" element={<SignUpPage />} />
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
