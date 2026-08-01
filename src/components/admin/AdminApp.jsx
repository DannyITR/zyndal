import { useState } from 'react'
import { getAdminSession, adminLogout } from '../../lib/adminApi'
import AdminLogin from './AdminLogin'
import AdminDashboard from './AdminDashboard'
import './admin.css'

// Top-level component for the /admin route (see App.jsx's isAdminPage early
// return) — entirely separate from the student/parent app tree below it.
// Own auth (admin token, not a user session), own styling (admin.css, not
// App.css), and never rendered as part of the main app's navigation.
export default function AdminApp() {
  const [session, setSession] = useState(() => getAdminSession())

  function handleLogout() {
    adminLogout()
    setSession(null)
  }

  if (!session) {
    return <AdminLogin onLoggedIn={() => setSession(getAdminSession())} />
  }

  return <AdminDashboard onLogout={handleLogout} />
}
