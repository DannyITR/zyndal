import { useEffect, useState } from 'react'
import { getAdminSession, adminLogout } from '../../lib/adminApi'
import AdminLogin from './AdminLogin'
import AdminDashboard from './AdminDashboard'
import AdminEditUserScreen from './AdminEditUserScreen'
import AdminTeacherClaimsScreen from './AdminTeacherClaimsScreen'
import './admin.css'

function parseEditUserId(pathname) {
  const match = pathname.match(/^\/admin\/users\/([^/]+)\/?$/)
  return match ? decodeURIComponent(match[1]) : null
}

// Top-level component for the /admin route (see App.jsx's isAdminPage early
// return) — entirely separate from the student/parent app tree below it.
// Own auth (admin token, not a user session), own styling (admin.css, not
// App.css), and never rendered as part of the main app's navigation.
//
// No router library — just window.history.pushState + a popstate listener,
// matching how App.jsx itself handles its own handful of special paths.
// AdminDashboard stays mounted (toggled with display:none, not
// conditionally rendered) whenever the Edit User page is showing, so its
// own search/filter/page state survives a visit to that page and back
// without needing to be lifted up here — see the "Preserve any search/
// filter state when returning" requirement this was built for.
export default function AdminApp() {
  const [session, setSession] = useState(() => getAdminSession())
  const [pathname, setPathname] = useState(() => window.location.pathname)
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0)

  useEffect(() => {
    function onPopState() {
      setPathname(window.location.pathname)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function navigate(path) {
    window.history.pushState({}, '', path)
    setPathname(path)
  }

  function handleLogout() {
    adminLogout()
    setSession(null)
  }

  if (!session) {
    return <AdminLogin onLoggedIn={() => setSession(getAdminSession())} />
  }

  const editUserId = parseEditUserId(pathname)
  const showTeacherClaims = pathname === '/admin/teacher-claims'

  return (
    <>
      <div style={editUserId || showTeacherClaims ? { display: 'none' } : undefined}>
        <AdminDashboard
          onLogout={handleLogout}
          onEditUser={(userId) => navigate(`/admin/users/${encodeURIComponent(userId)}`)}
          onOpenTeacherClaims={() => navigate('/admin/teacher-claims')}
          refreshKey={dashboardRefreshKey}
        />
      </div>
      {editUserId && (
        <AdminEditUserScreen
          userId={editUserId}
          onBack={() => {
            setDashboardRefreshKey((k) => k + 1)
            navigate('/admin')
          }}
          onLogout={handleLogout}
        />
      )}
      {showTeacherClaims && <AdminTeacherClaimsScreen onBack={() => navigate('/admin')} onLogout={handleLogout} />}
    </>
  )
}
