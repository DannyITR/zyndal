import { getSubject } from '../../../lib/questions'
import { formatShortDate } from '../../../lib/uploads'
import TopBar from '../../shared/TopBar'
import GradeBadge from './GradeBadge'

export default function UploadDetailScreen({ user, upload, onBack, onLogout, onLogoClick }) {
  const subject = getSubject(upload.subject)
  const pagesCount = upload.pages_count || 1

  return (
    <div className="screen student-screen">
      <TopBar
        title={`${subject?.icon || '📄'} ${subject?.name || upload.subject}`}
        subtitle={upload.topic}
        username={user.username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
        subscriptionStatus={user.subscription_status}
        daysRemainingInTrial={user.days_remaining_in_trial}
      />

      <div className="testprep-header-card">
        <div className="upload-detail-header-row">
          <p className="testprep-countdown">{upload.document_type === 'test' ? 'Test' : upload.document_type}</p>
          {upload.grade_received != null && <GradeBadge grade={upload.grade_received} />}
        </div>
        <p className="field-hint">
          Created {formatShortDate(upload.created_at)} · {pagesCount} page{pagesCount === 1 ? '' : 's'}
          {upload.updated_at && ` · Last updated ${formatShortDate(upload.updated_at)}`}
        </p>
        {upload.test_date && <p className="field-hint">Test date: {upload.test_date}</p>}
        {upload.summary && <p className="upload-detail-summary">{upload.summary}</p>}
        {upload.notes && <p className="field-hint">Your notes: {upload.notes}</p>}
      </div>

      {upload.key_concepts && upload.key_concepts.length > 0 && (
        <div className="testprep-header-card">
          <p className="testprep-day-focus">Key concepts</p>
          <ul className="upload-concepts-list">
            {upload.key_concepts.map((concept, i) => (
              <li key={i}>{concept}</li>
            ))}
          </ul>
        </div>
      )}

      {upload.questions && upload.questions.length > 0 && (
        <div className="testprep-day">
          <p className="testprep-day-title">📋 Questions from this document</p>
          {upload.questions.map((q, i) => (
            <div key={q.id ?? i} className="upload-question-readonly">
              <p className="testprep-question-prompt">
                {i + 1}. {q.question}
              </p>
              {q.options && q.options.length > 0 && (
                <ul className="upload-question-options">
                  {q.options.map((option, j) => (
                    <li key={j} className={option === q.correct_answer ? 'upload-question-options--correct' : ''}>
                      {option}
                    </li>
                  ))}
                </ul>
              )}
              <p className="upload-question-answer">Answer: {q.correct_answer}</p>
              {q.explanation && <p className="testprep-explanation-text">{q.explanation}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
