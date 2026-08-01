import { useEffect, useState } from 'react'
import { getAdminUserDetail, updateAdminUser } from '../../lib/adminApi'

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

export default function AdminUserDetailModal({ userId, onClose, onChanged }) {
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const [grade, setGrade] = useState('')
  const [accountType, setAccountType] = useState('')
  const [savingField, setSavingField] = useState('')
  const [saveError, setSaveError] = useState('')

  function load() {
    setLoading(true)
    setError('')
    getAdminUserDetail(userId)
      .then((data) => {
        setDetail(data)
        setGrade(data.user.grade ?? '')
        setAccountType(data.user.account_type)
      })
      .catch((err) => setError(err.message || 'Failed to load user.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [userId])

  async function saveField(field, value) {
    setSaveError('')
    setSavingField(field)
    try {
      await updateAdminUser({ user_id: userId, [field]: value })
      setDetail((prev) => ({ ...prev, user: { ...prev.user, [field]: value } }))
      onChanged?.()
    } catch (err) {
      setSaveError(err.message || 'Failed to save change.')
    } finally {
      setSavingField('')
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h2>{detail ? `@${detail.user.username}` : 'User Detail'}</h2>
          <button type="button" className="admin-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        {loading && <p>Loading…</p>}
        {error && <p className="admin-error">{error}</p>}

        {detail && (
          <div className="admin-modal-body">
            <section className="admin-detail-section">
              <h3>Profile</h3>
              <dl className="admin-detail-grid">
                <dt>Email</dt>
                <dd>{detail.user.email || '—'}</dd>
                <dt>Display Name</dt>
                <dd>{detail.user.display_name || '—'}</dd>
                <dt>School</dt>
                <dd>{detail.user.school || '—'}</dd>
                <dt>Email Verified</dt>
                <dd>{detail.user.email_verified ? 'Yes' : 'No'}</dd>
                <dt>Joined</dt>
                <dd>{formatDateTime(detail.user.created_at)}</dd>
                <dt>Status</dt>
                <dd>{detail.user.deleted_at ? `Deleted ${formatDateTime(detail.user.deleted_at)}` : 'Active'}</dd>
              </dl>

              {saveError && <p className="admin-error">{saveError}</p>}
              <div className="admin-edit-row">
                <label>
                  Account Type
                  <select value={accountType} onChange={(e) => setAccountType(e.target.value)}>
                    <option value="student">Student</option>
                    <option value="parent">Parent</option>
                    <option value="teacher">Teacher</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="admin-btn admin-btn-small"
                  disabled={savingField === 'account_type' || accountType === detail.user.account_type}
                  onClick={() => saveField('account_type', accountType)}
                >
                  Save
                </button>

                <label>
                  Grade
                  <select value={grade} onChange={(e) => setGrade(e.target.value)}>
                    <option value="">—</option>
                    {[7, 8, 9, 10, 11].map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="admin-btn admin-btn-small"
                  disabled={savingField === 'grade' || !grade || Number(grade) === detail.user.grade}
                  onClick={() => saveField('grade', Number(grade))}
                >
                  Save
                </button>

                <button
                  type="button"
                  className="admin-btn admin-btn-small"
                  disabled={savingField === 'is_premium'}
                  onClick={() => saveField('is_premium', !detail.user.is_premium)}
                >
                  {detail.user.is_premium ? 'Unset Premium' : 'Make Premium'}
                </button>
              </div>
            </section>

            <section className="admin-detail-section">
              <h3>Streak Stats</h3>
              <dl className="admin-detail-grid">
                <dt>Current Streak</dt>
                <dd>{detail.streak?.current_streak ?? 0}</dd>
                <dt>Longest Streak</dt>
                <dd>{detail.streak?.longest_streak ?? 0}</dd>
                <dt>Total XP</dt>
                <dd>{detail.streak?.total_xp ?? 0}</dd>
                <dt>Coin Balance</dt>
                <dd>{detail.streak?.coin_balance ?? 0}</dd>
              </dl>
            </section>

            <section className="admin-detail-section">
              <h3>Answer History ({detail.answers.length})</h3>
              <div className="admin-scroll-list">
                {detail.answers.length === 0 && <p className="admin-empty-hint">No answers yet.</p>}
                {detail.answers.slice(0, 50).map((a) => (
                  <div className="admin-list-row" key={a.id}>
                    <span>{a.subject}</span>
                    <span className={a.correct ? 'admin-text-good' : 'admin-text-bad'}>{a.correct ? 'Correct' : 'Wrong'}</span>
                    <span>{formatDateTime(a.answered_at)}</span>
                  </div>
                ))}
                {detail.answers.length > 50 && <p className="admin-empty-hint">+{detail.answers.length - 50} more</p>}
              </div>
            </section>

            <section className="admin-detail-section">
              <h3>Grades Logged ({detail.grades.length})</h3>
              <div className="admin-scroll-list">
                {detail.grades.length === 0 && <p className="admin-empty-hint">None.</p>}
                {detail.grades.map((g) => (
                  <div className="admin-list-row" key={g.id}>
                    <span>
                      {g.subject} — {g.test_name}
                    </span>
                    <span>{g.grade_percentage}%</span>
                    <span>{g.test_date}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="admin-detail-section">
              <h3>Uploads ({detail.uploads.length})</h3>
              <div className="admin-scroll-list">
                {detail.uploads.length === 0 && <p className="admin-empty-hint">None.</p>}
                {detail.uploads.map((u) => (
                  <div className="admin-list-row" key={u.id}>
                    <span>
                      {u.document_type} — {u.subject} / {u.topic}
                    </span>
                    <span>{u.grade_received != null ? `${u.grade_received}%` : ''}</span>
                    <span>{formatDateTime(u.created_at)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="admin-detail-section">
              <h3>Study Plans ({detail.studyPlans.length})</h3>
              <div className="admin-scroll-list">
                {detail.studyPlans.length === 0 && <p className="admin-empty-hint">None.</p>}
                {detail.studyPlans.map((p) => (
                  <div className="admin-list-row" key={p.id}>
                    <span>
                      {p.subject} / {p.topic}
                    </span>
                    <span>{p.status}</span>
                    <span>{p.test_date}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="admin-detail-section">
              <h3>Parent-Student Links</h3>
              <div className="admin-scroll-list">
                {detail.parentLinks.asParent.length === 0 && detail.parentLinks.asStudent.length === 0 && (
                  <p className="admin-empty-hint">None.</p>
                )}
                {detail.parentLinks.asParent.map((l) => (
                  <div className="admin-list-row" key={`p-${l.id}`}>
                    <span>Parent of @{l.studentUsername}</span>
                  </div>
                ))}
                {detail.parentLinks.asStudent.map((l) => (
                  <div className="admin-list-row" key={`s-${l.id}`}>
                    <span>Student of @{l.parentUsername}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="admin-detail-section">
              <h3>Friends ({detail.friends.length})</h3>
              <div className="admin-scroll-list">
                {detail.friends.length === 0 && <p className="admin-empty-hint">None.</p>}
                {detail.friends.map((f) => (
                  <div className="admin-list-row" key={f.friendId}>
                    <span>@{f.username}</span>
                    <span>{formatDateTime(f.since)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="admin-detail-section">
              <h3>Notification History ({detail.notifications.length})</h3>
              <div className="admin-scroll-list">
                {detail.notifications.length === 0 && <p className="admin-empty-hint">None.</p>}
                {detail.notifications.map((n) => (
                  <div className="admin-list-row" key={n.id}>
                    <span>{n.type}</span>
                    <span>{n.title}</span>
                    <span>{formatDateTime(n.created_at)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
