import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getSchools, getTeacherSchoolSubjectGroups } from '../../lib/storage'
import { getSubject } from '../../lib/questions'
import TopBar from '../shared/TopBar'
import ClaimClassModal from './ClaimClassModal'

const GRADES = [7, 8, 9, 10, 11]

// Lets a teacher browse the seeded (school, subject, grade) groups and
// submit a claim on an unclaimed one — the teacher-side analog of the
// student's ClassCardsGrid, reusing the same .subject-grid/.subject-card
// look for a consistent feel across both roles.
export default function ClaimClassScreen({ user, onBack, onLogout, onLogoClick }) {
  const { t } = useTranslation()
  const [schools, setSchools] = useState([])
  const [schoolId, setSchoolId] = useState('')
  const [grade, setGrade] = useState('')
  const [groups, setGroups] = useState(null) // null = not loaded / loading
  const [claimGroup, setClaimGroup] = useState(null) // the group tapped to open the claim modal

  useEffect(() => {
    getSchools()
      .then((data) => setSchools(data.schools))
      .catch(() => {})
  }, [])

  function loadGroups() {
    if (!schoolId || !grade) return
    setGroups(null)
    getTeacherSchoolSubjectGroups({ schoolId, grade })
      .then((data) => setGroups(data.groups))
      .catch(() => setGroups([]))
  }

  useEffect(() => {
    loadGroups()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, grade])

  const selectedSchool = schools.find((s) => s.id === schoolId)

  return (
    <div className="screen teacher-screen">
      <TopBar title={t('teacher.claimClassScreenTitle')} username={user.username} onBack={onBack} onLogout={onLogout} onLogoClick={onLogoClick} />

      <div className="field">
        <label htmlFor="claim-school">{t('auth.signup.school')}</label>
        <select id="claim-school" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
          <option value="">{t('auth.signup.selectSchool')}</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="claim-grade">{t('settings.grade')}</label>
        <select id="claim-grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">{t('settings.selectGrade')}</option>
          {GRADES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      {schoolId && grade && groups === null && <p className="loading-text">{t('common.loading')}</p>}

      {schoolId && grade && groups && groups.length > 0 && (
        <div className="subject-grid">
          {groups.map((group) => {
            const subject = getSubject(group.subject)
            const status = group.myClaimStatus
            return (
              <div key={group.id} className="subject-card" style={{ '--subject-color': subject.color }}>
                <span className="subject-card-icon">{subject.icon}</span>
                <span className="subject-card-name">{t(`subjects.${subject.id}`)}</span>
                {status === 'pending' && <span className="subject-card-badge">{t('teacher.claimPending')}</span>}
                {status === 'approved' && <span className="subject-card-badge">{t('teacher.claimApproved')}</span>}
                {status === 'rejected' && (
                  <span className="subject-card-badge subject-card-badge--incorrect">{t('teacher.claimRejected')}</span>
                )}
                {(status === null || status === 'rejected') && (
                  <button type="button" className="btn btn-secondary btn-small" onClick={() => setClaimGroup(group)}>
                    {status === 'rejected' ? t('teacher.claimTryAgain') : t('teacher.claimThisClass')}
                  </button>
                )}
                {status === 'rejected' && group.rejectionReason && (
                  <p className="field-hint">{group.rejectionReason}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {claimGroup && (
        <ClaimClassModal
          user={user}
          group={claimGroup}
          schoolDomain={selectedSchool?.domain}
          onSubmitted={() => {
            setClaimGroup(null)
            loadGroups()
          }}
          onClose={() => setClaimGroup(null)}
        />
      )}
    </div>
  )
}
