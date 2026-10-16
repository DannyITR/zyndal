import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { generateStudyQuiz, emailStudyQuiz } from '../../../lib/storage'
import { buildStudyQuizHtml } from '../../../lib/studyQuizWorksheet'
import { getErrorMessage } from '../../../lib/errors'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Preview + email for the printable quiz of an upload package (Study Guide screen).
// The preview is the exact worksheet document api/email-study-quiz.js
// sends — both come from buildStudyQuizHtml over the same saved questions —
// rendered in a sandboxed iframe so its print styles can't leak into the
// app (or the app's dark theme into it).
// uploads: the selected upload package ([{ uploadId, topic }], one or more).
export default function StudyQuizModal({ uploads, accountEmail, onSent, onClose }) {
  const { t } = useTranslation()
  const [quiz, setQuiz] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [showOtherEmail, setShowOtherEmail] = useState(false)
  const [otherEmail, setOtherEmail] = useState('')
  const [sending, setSending] = useState(null) // null | 'me' | 'other'
  const [sendError, setSendError] = useState('')
  const uploadIds = uploads.map((u) => u.uploadId)
  const uploadKey = uploadIds.join(',')

  useEffect(() => {
    let cancelled = false
    generateStudyQuiz(uploadKey.split(','))
      .then((result) => {
        if (!cancelled) setQuiz(result)
      })
      .catch((err) => {
        console.error('[StudyQuiz] could not build quiz:', err)
        if (!cancelled) setLoadError(getErrorMessage(err, t))
      })
    return () => {
      cancelled = true
    }
  }, [uploadKey, t])

  async function send(sendTo) {
    if (sending) return
    setSendError('')
    const email = otherEmail.trim()
    if (sendTo === 'other' && !EMAIL_PATTERN.test(email)) {
      setSendError(t('studyQuiz.invalidEmail'))
      return
    }
    setSending(sendTo)
    try {
      const { sentTo } = await emailStudyQuiz(uploadIds, { sendTo, email: sendTo === 'other' ? email : undefined })
      onSent(sentTo)
    } catch (err) {
      console.error('[StudyQuiz] email failed:', err)
      setSendError(getErrorMessage(err, t))
      setSending(null)
    }
  }

  const html = quiz ? buildStudyQuizHtml({ title: quiz.title, subjectId: quiz.subject, questions: quiz.questions, lang: quiz.lang }) : ''

  return (
    <div className="modal-overlay" onClick={sending ? undefined : onClose}>
      <div className="modal-card study-quiz-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{t('studyQuiz.previewTitle')}</h2>
        <p className="modal-subtitle">{uploads.map((u) => u.topic).join(' + ')}</p>
        {quiz && <p className="study-quiz-count">{t('studyQuiz.questionCount', { count: quiz.questions.length })}</p>}

        {!quiz && !loadError && <p className="loading-text">{t('studyQuiz.generating')}</p>}
        {loadError && <p className="form-error">{loadError}</p>}

        {quiz && (
          <>
            <iframe className="study-quiz-preview" title={t('studyQuiz.previewTitle')} srcDoc={html} sandbox="" />

            <div className="study-quiz-send">
              <button type="button" className="btn btn-primary btn-block" disabled={Boolean(sending) || !accountEmail} onClick={() => send('me')}>
                {sending === 'me' ? t('studyQuiz.sending') : t('studyQuiz.emailMe')}
              </button>
              {accountEmail ? (
                <p className="field-hint">{t('studyQuiz.emailMeHint', { email: accountEmail })}</p>
              ) : (
                <p className="field-hint">{t('studyQuiz.noAccountEmail')}</p>
              )}

              {!showOtherEmail ? (
                <button type="button" className="btn btn-secondary btn-block" disabled={Boolean(sending)} onClick={() => setShowOtherEmail(true)}>
                  {t('studyQuiz.sendToOther')}
                </button>
              ) : (
                <form
                  className="field study-quiz-other"
                  onSubmit={(e) => {
                    e.preventDefault()
                    send('other')
                  }}
                >
                  <label htmlFor="study-quiz-email">{t('studyQuiz.sendToOther')}</label>
                  <input
                    id="study-quiz-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder={t('studyQuiz.emailPlaceholder')}
                    value={otherEmail}
                    disabled={Boolean(sending)}
                    onChange={(e) => {
                      setOtherEmail(e.target.value)
                      setSendError('')
                    }}
                    autoFocus
                  />
                  <button type="submit" className="btn btn-secondary btn-block" disabled={Boolean(sending) || !otherEmail.trim()}>
                    {sending === 'other' ? t('studyQuiz.sending') : t('studyQuiz.send')}
                  </button>
                </form>
              )}
            </div>
          </>
        )}

        {sendError && <p className="form-error">{sendError}</p>}

        <button type="button" className="btn btn-ghost btn-block" disabled={Boolean(sending)} onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </div>
  )
}
