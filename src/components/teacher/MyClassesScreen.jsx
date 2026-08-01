import { useEffect, useState } from 'react'
import { getTeacherClasses } from '../../lib/storage'
import TopBar from '../shared/TopBar'
import CreateClassModal from './CreateClassModal'

export default function MyClassesScreen({ user, onBack, onLogout, onLogoClick, onOpenClass }) {
  const [classes, setClasses] = useState(null)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  function load() {
    setError('')
    getTeacherClasses()
      .then((data) => setClasses(data.classes))
      .catch((err) => setError(err.message || "Couldn't load your classes."))
  }

  useEffect(load, [])

  return (
    <div className="screen">
      <TopBar
        title="🏫 My Classes"
        subtitle="Manage your classes"
        username={user.username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />

      <button type="button" className="btn btn-primary btn-block" onClick={() => setShowCreate(true)}>
        + Create Class
      </button>

      {error && <p className="form-error">{error}</p>}

      {!classes ? (
        <p className="loading-text">Loading…</p>
      ) : classes.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-emoji">🏫</p>
          <p>No classes yet.</p>
          <p className="field-hint">Create your first class above to get a code your students can join with.</p>
        </div>
      ) : (
        <div className="teacher-class-list">
          {classes.map((c) => (
            <button key={c.id} type="button" className="teacher-class-card" onClick={() => onOpenClass(c.id)}>
              <div className="teacher-class-card-header">
                <p className="teacher-class-name">{c.name}</p>
                <span className="teacher-class-code">{c.teacher_code}</span>
              </div>
              <p className="teacher-class-detail">
                Grade {c.grade} · {c.school}
              </p>
              <p className="teacher-class-detail">
                {c.studentCount} student{c.studentCount === 1 ? '' : 's'} · {c.activeAssignmentCount} active assignment
                {c.activeAssignmentCount === 1 ? '' : 's'}
              </p>
            </button>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateClassModal
          onCreated={() => {
            load()
          }}
          onClose={() => {
            setShowCreate(false)
            load()
          }}
        />
      )}
    </div>
  )
}
