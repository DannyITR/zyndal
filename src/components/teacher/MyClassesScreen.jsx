import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getTeacherClasses } from '../../lib/storage'
import { getErrorMessage } from '../../lib/errors'
import TopBar from '../shared/TopBar'
import CreateClassModal from './CreateClassModal'

export default function MyClassesScreen({ user, onBack, onLogout, onLogoClick, onOpenClass }) {
  const { t } = useTranslation()
  const [classes, setClasses] = useState(null)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  function load() {
    setError('')
    getTeacherClasses()
      .then((data) => setClasses(data.classes))
      .catch((err) => setError(getErrorMessage(err, t, 'teacher.loadClassesFailed')))
  }

  // t is a stable function for the app's lifetime (see src/lib/i18n.js) —
  // not a real dependency, and this effect should only run once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [])

  return (
    <div className="screen">
      <TopBar
        title={t('teacher.myClasses')}
        subtitle={t('teacher.manageClasses')}
        username={user.username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />

      <button type="button" className="btn btn-primary btn-block" onClick={() => setShowCreate(true)}>
        {t('teacher.createClass')}
      </button>

      {error && <p className="form-error">{error}</p>}

      {!classes ? (
        <p className="loading-text">{t('common.loading')}</p>
      ) : classes.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-emoji">🏫</p>
          <p>{t('teacher.noClassesYet')}</p>
          <p className="field-hint">{t('teacher.noClassesHint')}</p>
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
                {t('common.gradeLabel', { grade: c.grade })} · {c.school}
              </p>
              <p className="teacher-class-detail">
                {t('teacher.classCardDetail', { students: c.studentCount, assignments: c.activeAssignmentCount })}
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
