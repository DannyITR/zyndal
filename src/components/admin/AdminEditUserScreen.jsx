import { useEffect, useState } from 'react'
import {
  getAdminUserDetail,
  updateAdminUser,
  setAdminUserPassword,
  adjustAdminXpCoins,
  deleteAdminUser,
  getAdminUploadQuestions,
  deleteAdminUpload,
  deleteAdminGrade,
} from '../../lib/adminApi'
import { AVATARS } from '../../lib/avatars'
import { computeReadiness } from '../../lib/testprep'
import AdminAnswerCalendar from './AdminAnswerCalendar'
import AdminConfirmDeleteModal from './AdminConfirmDeleteModal'

// timeZone: 'UTC' matters specifically for plain date-only values (test_date,
// grade_percentage's test_date, stats.memberSince/lastActive's YYYY-MM-DD
// strings) — new Date('2026-07-28') parses as UTC midnight, and displaying
// that in the browser's own (often behind-UTC) local zone would silently
// roll it back a calendar day.
function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', { timeZone: 'UTC' })
}

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

function profileFromUser(user) {
  return {
    username: user.username,
    display_name: user.display_name || '',
    email: user.email || '',
    account_type: user.account_type,
    grade: user.grade || '',
    school: user.school || '',
    language_preference: user.language_preference || 'English',
    is_premium: user.is_premium,
    email_verified: user.email_verified,
    avatar: user.avatar || '',
  }
}

export default function AdminEditUserScreen({ userId, onBack, onLogout }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [toast, setToast] = useState(null) // { type: 'success' | 'error', text }

  const [profile, setProfile] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)

  const [xpValue, setXpValue] = useState('')
  const [coinsValue, setCoinsValue] = useState('')
  const [reason, setReason] = useState('')
  const [xpSaving, setXpSaving] = useState(false)

  const [expandedUploadId, setExpandedUploadId] = useState(null)
  const [uploadQuestionsById, setUploadQuestionsById] = useState({})
  const [uploadQuestionsLoadingId, setUploadQuestionsLoadingId] = useState(null)
  const [deletingUploadId, setDeletingUploadId] = useState(null)

  const [deletingGradeId, setDeletingGradeId] = useState(null)

  const [deleteTarget, setDeleteTarget] = useState(null) // { hardDelete: bool }
  const [dangerBusy, setDangerBusy] = useState(false)

  function showToast(type, text) {
    setToast({ type, text })
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  function load() {
    setLoading(true)
    setLoadError('')
    getAdminUserDetail(userId)
      .then((data) => {
        setDetail(data)
        setProfile(profileFromUser(data.user))
        setXpValue(String(data.stats.totalXp))
        setCoinsValue(String(data.stats.coinBalance))
      })
      .catch((err) => setLoadError(err.message || "Couldn't load this user."))
      .finally(() => setLoading(false))
  }

  useEffect(load, [userId])

  function setProfileField(field, value) {
    setProfile((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSaveProfile(e) {
    e.preventDefault()
    setProfileSaving(true)
    try {
      const payload = {
        user_id: userId,
        username: profile.username,
        display_name: profile.display_name,
        email: profile.email,
        account_type: profile.account_type,
        school: profile.school,
        language_preference: profile.language_preference,
        is_premium: profile.is_premium,
        email_verified: profile.email_verified,
        avatar: profile.avatar,
      }
      if (profile.account_type === 'student' && profile.grade) {
        payload.grade = Number(profile.grade)
      }
      const { user } = await updateAdminUser(payload)

      if (newPassword.trim()) {
        await setAdminUserPassword({ user_id: userId, new_password: newPassword.trim() })
      }

      setDetail((prev) => ({ ...prev, user: { ...prev.user, ...user } }))
      setProfile(profileFromUser(user))
      setNewPassword('')
      showToast('success', 'Profile saved.')
    } catch (err) {
      showToast('error', err.message || 'Failed to save profile.')
    } finally {
      setProfileSaving(false)
    }
  }

  async function handleSaveXpCoins(e) {
    e.preventDefault()
    setXpSaving(true)
    try {
      const { streak } = await adjustAdminXpCoins({
        user_id: userId,
        total_xp: xpValue,
        coin_balance: coinsValue,
        reason,
      })
      setDetail((prev) => ({ ...prev, stats: { ...prev.stats, totalXp: streak.totalXp, coinBalance: streak.coinBalance } }))
      setXpValue(String(streak.totalXp))
      setCoinsValue(String(streak.coinBalance))
      setReason('')
      showToast('success', 'XP and coins updated.')
    } catch (err) {
      showToast('error', err.message || 'Failed to adjust XP/coins.')
    } finally {
      setXpSaving(false)
    }
  }

  async function handleToggleUploadQuestions(uploadId) {
    if (expandedUploadId === uploadId) {
      setExpandedUploadId(null)
      return
    }
    setExpandedUploadId(uploadId)
    if (uploadQuestionsById[uploadId]) return
    setUploadQuestionsLoadingId(uploadId)
    try {
      const { questions } = await getAdminUploadQuestions(uploadId)
      setUploadQuestionsById((prev) => ({ ...prev, [uploadId]: questions }))
    } catch (err) {
      showToast('error', err.message || "Couldn't load this upload's questions.")
    } finally {
      setUploadQuestionsLoadingId(null)
    }
  }

  async function handleDeleteUpload(uploadId) {
    setDeletingUploadId(uploadId)
    try {
      await deleteAdminUpload({ upload_id: uploadId })
      setDetail((prev) => ({ ...prev, uploads: prev.uploads.filter((u) => u.id !== uploadId) }))
      showToast('success', 'Upload deleted.')
    } catch (err) {
      showToast('error', err.message || 'Failed to delete upload.')
    } finally {
      setDeletingUploadId(null)
    }
  }

  async function handleDeleteGrade(gradeId) {
    setDeletingGradeId(gradeId)
    try {
      await deleteAdminGrade({ grade_id: gradeId })
      setDetail((prev) => ({ ...prev, grades: prev.grades.filter((g) => g.id !== gradeId) }))
      showToast('success', 'Grade entry deleted.')
    } catch (err) {
      showToast('error', err.message || 'Failed to delete grade entry.')
    } finally {
      setDeletingGradeId(null)
    }
  }

  async function handleRestore() {
    setDangerBusy(true)
    try {
      await updateAdminUser({ user_id: userId, deleted_at: null })
      setDetail((prev) => ({ ...prev, user: { ...prev.user, deleted_at: null } }))
      showToast('success', 'Account restored.')
    } catch (err) {
      showToast('error', err.message || 'Failed to restore account.')
    } finally {
      setDangerBusy(false)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setDangerBusy(true)
    try {
      await deleteAdminUser({ user_id: userId, hard_delete: deleteTarget.hardDelete, confirm: 'DELETE' })
      const wasHard = deleteTarget.hardDelete
      setDeleteTarget(null)
      if (wasHard) {
        onBack()
        return
      }
      setDetail((prev) => ({ ...prev, user: { ...prev.user, deleted_at: new Date().toISOString() } }))
      showToast('success', 'Account soft deleted.')
    } catch (err) {
      showToast('error', err.message || 'Failed to delete account.')
      setDeleteTarget(null)
    } finally {
      setDangerBusy(false)
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <button type="button" className="admin-back-link" onClick={onBack}>
            ← Back to Users
          </button>
          <h1>{detail ? `Edit @${detail.user.username}` : 'Edit User'}</h1>
        </div>
        <button type="button" className="admin-btn admin-btn-secondary" onClick={onLogout}>
          Log Out
        </button>
      </header>

      {toast && <div className={`admin-toast admin-toast--${toast.type}`}>{toast.text}</div>}

      {loading && <p className="admin-panel">Loading…</p>}
      {loadError && <p className="admin-error admin-panel">{loadError}</p>}

      {detail && profile && (
        <>
          <section className="admin-panel">
            <h2>Profile</h2>
            <form className="admin-form-grid" onSubmit={handleSaveProfile}>
              <label className="admin-field">
                <span>Username</span>
                <input type="text" value={profile.username} onChange={(e) => setProfileField('username', e.target.value)} />
              </label>
              <label className="admin-field">
                <span>Display name</span>
                <input type="text" value={profile.display_name} onChange={(e) => setProfileField('display_name', e.target.value)} />
              </label>
              <label className="admin-field">
                <span>Email</span>
                <input type="email" value={profile.email} onChange={(e) => setProfileField('email', e.target.value)} />
              </label>
              <label className="admin-field">
                <span>Set new password</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave blank to keep current password"
                  autoComplete="new-password"
                />
              </label>
              <label className="admin-field">
                <span>Account type</span>
                <select value={profile.account_type} onChange={(e) => setProfileField('account_type', e.target.value)}>
                  <option value="student">Student</option>
                  <option value="parent">Parent</option>
                  <option value="teacher">Teacher</option>
                </select>
              </label>
              {profile.account_type === 'student' && (
                <label className="admin-field">
                  <span>Grade</span>
                  <select value={profile.grade} onChange={(e) => setProfileField('grade', e.target.value)}>
                    <option value="">—</option>
                    {[7, 8, 9, 10, 11].map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="admin-field">
                <span>School</span>
                <input type="text" value={profile.school} onChange={(e) => setProfileField('school', e.target.value)} />
              </label>
              <label className="admin-field">
                <span>Language preference</span>
                <select value={profile.language_preference} onChange={(e) => setProfileField('language_preference', e.target.value)}>
                  <option value="English">English</option>
                  <option value="French">French</option>
                </select>
              </label>
              <label className="admin-field">
                <span>Avatar</span>
                <select value={profile.avatar} onChange={(e) => setProfileField('avatar', e.target.value)}>
                  <option value="">— none —</option>
                  {AVATARS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-checkbox-field">
                <input type="checkbox" checked={profile.is_premium} onChange={(e) => setProfileField('is_premium', e.target.checked)} />
                <span>Premium status</span>
              </label>
              <label className="admin-checkbox-field">
                <input
                  type="checkbox"
                  checked={profile.email_verified}
                  onChange={(e) => setProfileField('email_verified', e.target.checked)}
                />
                <span>Email verified</span>
              </label>
              <div className="admin-form-actions">
                <button type="submit" className="admin-btn admin-btn-primary" disabled={profileSaving}>
                  {profileSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </section>

          <section className="admin-panel">
            <h2>Stats</h2>
            <dl className="admin-detail-grid">
              <dt>Current Streak</dt>
              <dd>{detail.stats.currentStreak}</dd>
              <dt>Longest Streak</dt>
              <dd>{detail.stats.longestStreak}</dd>
              <dt>Total XP</dt>
              <dd>{detail.stats.totalXp}</dd>
              <dt>Coin Balance</dt>
              <dd>{detail.stats.coinBalance}</dd>
              <dt>Questions Answered</dt>
              <dd>{detail.stats.totalAnswered}</dd>
              <dt>Correct Answers</dt>
              <dd>{detail.stats.totalCorrect}</dd>
              <dt>Accuracy</dt>
              <dd>{detail.stats.accuracyPercent}%</dd>
              <dt>Member Since</dt>
              <dd>{formatDate(detail.stats.memberSince)}</dd>
              <dt>Last Active</dt>
              <dd>{formatDate(detail.stats.lastActive)}</dd>
            </dl>
          </section>

          <section className="admin-panel">
            <h2>XP &amp; Coins</h2>
            <form className="admin-form-grid" onSubmit={handleSaveXpCoins}>
              <label className="admin-field">
                <span>Current XP</span>
                <input type="number" min="0" step="1" value={xpValue} onChange={(e) => setXpValue(e.target.value)} />
              </label>
              <label className="admin-field">
                <span>Current coin balance</span>
                <input type="number" min="0" step="1" value={coinsValue} onChange={(e) => setCoinsValue(e.target.value)} />
              </label>
              <label className="admin-field admin-field-wide">
                <span>Reason for adjustment</span>
                <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this being changed?" />
              </label>
              <div className="admin-form-actions">
                <button type="submit" className="admin-btn admin-btn-primary" disabled={xpSaving}>
                  {xpSaving ? 'Saving…' : 'Save Adjustments'}
                </button>
              </div>
            </form>
          </section>

          <section className="admin-panel">
            <h2>Answer History</h2>
            <AdminAnswerCalendar history={detail.answerHistory} />
          </section>

          <section className="admin-panel">
            <h2>Uploads ({detail.uploads.length})</h2>
            {detail.uploads.length === 0 ? (
              <p className="admin-empty-hint">None.</p>
            ) : (
              <div className="admin-record-list">
                {detail.uploads.map((u) => (
                  <div className="admin-record-row" key={u.id}>
                    <div className="admin-record-row-main">
                      <p className="admin-record-title">
                        {u.document_type} — {u.subject} / {u.topic}
                      </p>
                      <p className="admin-record-detail">
                        {formatDate(u.created_at)} · {u.pages_count} page{u.pages_count === 1 ? '' : 's'}
                        {u.grade_received != null ? ` · ${u.grade_received}%` : ''}
                      </p>
                    </div>
                    <div className="admin-record-row-actions">
                      <button type="button" className="admin-btn admin-btn-small" onClick={() => handleToggleUploadQuestions(u.id)}>
                        {expandedUploadId === u.id ? 'Hide Questions' : 'View Questions'}
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn-small admin-btn-danger"
                        disabled={deletingUploadId === u.id}
                        onClick={() => handleDeleteUpload(u.id)}
                      >
                        {deletingUploadId === u.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                    {expandedUploadId === u.id && (
                      <div className="admin-scroll-list admin-record-expanded">
                        {uploadQuestionsLoadingId === u.id ? (
                          <p className="admin-empty-hint">Loading…</p>
                        ) : (uploadQuestionsById[u.id] || []).length === 0 ? (
                          <p className="admin-empty-hint">No extracted questions.</p>
                        ) : (
                          uploadQuestionsById[u.id].map((q) => (
                            <div className="admin-list-row admin-list-row--wrap" key={q.id}>
                              <span>{q.question}</span>
                              <span className="admin-text-good">Answer: {q.correct_answer || '—'}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="admin-panel">
            <h2>Grades ({detail.grades.length})</h2>
            {detail.grades.length === 0 ? (
              <p className="admin-empty-hint">None.</p>
            ) : (
              <div className="admin-record-list">
                {detail.grades.map((g) => (
                  <div className="admin-record-row" key={g.id}>
                    <div className="admin-record-row-main">
                      <p className="admin-record-title">
                        {g.subject} — {g.test_name}
                      </p>
                      <p className="admin-record-detail">
                        {g.grade_percentage}% · {formatDate(g.test_date)}
                      </p>
                    </div>
                    <div className="admin-record-row-actions">
                      <button
                        type="button"
                        className="admin-btn admin-btn-small admin-btn-danger"
                        disabled={deletingGradeId === g.id}
                        onClick={() => handleDeleteGrade(g.id)}
                      >
                        {deletingGradeId === g.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="admin-panel">
            <h2>Study Plans ({detail.studyPlans.length})</h2>
            {detail.studyPlans.length === 0 ? (
              <p className="admin-empty-hint">None.</p>
            ) : (
              <div className="admin-record-list">
                {detail.studyPlans.map((p) => (
                  <div className="admin-record-row" key={p.id}>
                    <div className="admin-record-row-main">
                      <p className="admin-record-title">
                        {p.subject} / {p.topic}
                      </p>
                      <p className="admin-record-detail">
                        {p.status} · test date {formatDate(p.test_date)} · {computeReadiness(p.plan_data)}% ready
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="admin-panel admin-danger-zone">
            <h2>Danger Zone</h2>
            <p className="admin-danger-status">
              Status: {detail.user.deleted_at ? `Deleted ${formatDateTime(detail.user.deleted_at)}` : 'Active'}
            </p>
            <div className="admin-danger-actions">
              {detail.user.deleted_at ? (
                <button type="button" className="admin-btn admin-btn-secondary" disabled={dangerBusy} onClick={handleRestore}>
                  Restore Account
                </button>
              ) : (
                <button
                  type="button"
                  className="admin-btn admin-btn-danger"
                  disabled={dangerBusy}
                  onClick={() => setDeleteTarget({ hardDelete: false })}
                >
                  Soft Delete
                </button>
              )}
              <button
                type="button"
                className="admin-btn admin-btn-danger"
                disabled={dangerBusy}
                onClick={() => setDeleteTarget({ hardDelete: true })}
              >
                Hard Delete
              </button>
            </div>
          </section>
        </>
      )}

      {deleteTarget && (
        <AdminConfirmDeleteModal
          username={detail?.user.username}
          hardDelete={deleteTarget.hardDelete}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  )
}
