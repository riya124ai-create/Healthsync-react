import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import Home from './components/pages/home'
import Login from './components/login'
import Signup from './components/signup'
import ForgotPassword from './components/forgot-password'
import DashboardLayout from './components/dashboard/DashboardLayout'
import AuthGuard from './components/auth-guard'
import EMRDashboard from './components/dashboard/emr-dashboard'
import ICD11Sidebar from './components/dashboard/icd11'
import SettingsPage from './components/dashboard/settings'
import ReportsPage from './components/dashboard/ReportsPage'
import PatientsPage from './components/dashboard/PatientsPage'
import AuthProvider from '@/lib/auth'
import { SocketProvider } from '@/lib/socket'
import { wakeUpOnPageLoad } from '@/lib/keepAlive'
import './index.css'
import { useAuth } from '@/lib/auth'

// Wake up Render backend on initial page load
wakeUpOnPageLoad()

// Component to wake backend on route changes
function NavigationWatcher() {
  const location = useLocation()
  
  useEffect(() => {
    // Wake backend on every route change
    wakeUpOnPageLoad()
  }, [location.pathname])
  
  return null
}

// Helper component to provide socket with token
function AppWithSocket({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [token, setToken] = React.useState<string | null>(null)
  
  // Update token when user changes
  React.useEffect(() => {
    if (user) {
      const storedToken = localStorage.getItem('hs_token') || sessionStorage.getItem('hs_token')
      setToken(storedToken)
    } else {
      // User is null (logged out), clear token
      setToken(null)
    }
  }, [user])
  

  return <SocketProvider token={token} key={user?.id || 'anonymous'}>{children}</SocketProvider>
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppWithSocket>
          <NavigationWatcher />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            <Route path="/dashboard" element={<AuthGuard><DashboardLayout /></AuthGuard>}>
              <Route index element={<EMRDashboard />} />
              <Route path="icd11" element={<ICD11Sidebar />} />
              <Route path="patients" element={<PatientsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

          </Routes>
        </AppWithSocket>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
