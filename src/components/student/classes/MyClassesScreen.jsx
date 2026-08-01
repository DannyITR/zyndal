import TopBar from '../../shared/TopBar'

export default function MyClassesScreen({ user, classes, onBack, onLogout, onLogoClick, onOpenClass }) {
  return (
    <div className="screen student-screen">
      <TopBar title="🏫 My Classes" subtitle="Classes you've joined" username={user.username} onBack={onBack} onLogout={onLogout} onLogoClick={onLogoClick} />

      {!classes ? (
        <p className="loading-text">Loading…</p>
      ) : classes.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-emoji">🏫</p>
          <p>No classes yet.</p>
          <p className="field-hint">Join one from Settings using your teacher's class code.</p>
        </div>
      ) : (
        <div className="teacher-class-list">
          {classes.map((c) => (
            <button key={c.id} type="button" className="teacher-class-card" onClick={() => onOpenClass(c.id)}>
              <div className="teacher-class-card-header">
                <p className="teacher-class-name">{c.name}</p>
              </div>
              <p className="teacher-class-detail">
                Grade {c.grade} · {c.school} · Taught by @{c.teacherUsername}
              </p>
              <p className="teacher-class-detail">
                📖 Unit {c.currentUnitNumber}
                {c.currentUnitTitle ? ` — ${c.currentUnitTitle}` : ''}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
