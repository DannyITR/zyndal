import Logo from './Logo'

export default function TopBar({ title, subtitle, username, onLogout, onBack, onSettings, onLogoClick }) {
  return (
    <header className="topbar">
      <div className="topbar-brand-row">
        <Logo size="small" onClick={onLogoClick} />
      </div>
      <div className="topbar-main-row">
        <div className="topbar-title-row">
          {onBack && (
            <button type="button" className="topbar-back" onClick={onBack} aria-label="Back to subjects">
              ←
            </button>
          )}
          <div>
            {title && <p className="topbar-title">{title}</p>}
            {subtitle && <p className="topbar-subtitle">{subtitle}</p>}
          </div>
        </div>
        <div className="topbar-actions">
          {username && <p className="topbar-username">@{username}</p>}
          <div className="topbar-buttons">
            {onSettings && (
              <button type="button" className="btn btn-ghost btn-icon" onClick={onSettings} aria-label="Settings">
                ⚙️
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-small" onClick={onLogout}>
              Log Out
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
