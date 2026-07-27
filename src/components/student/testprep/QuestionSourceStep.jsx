import { useState } from 'react'
import { getSourceOptions, getSourcePreference } from '../../../lib/questionSource'
import TopBar from '../../shared/TopBar'

// Shared by Test Prep (after subject/topic/date) and Study Guide (after
// subject is known) — lets the student pick where their practice questions
// come from before anything is generated. See questionSource.js for the
// option list and the localStorage preference this pre-selects from.
export default function QuestionSourceStep({ user, subjectId, subjectName, uploadCount, generating = false, error, onContinue, onBack, onLogout, onLogoClick }) {
  const options = getSourceOptions(uploadCount, subjectName)
  const savedPreference = getSourcePreference(subjectId)
  const [selected, setSelected] = useState(() => {
    if (options.some((o) => o.id === savedPreference)) return savedPreference
    return options.length === 1 ? options[0].id : null
  })

  return (
    <div className="screen student-screen">
      <TopBar
        title="🎯 Choose Your Questions"
        subtitle="Where should your practice questions come from?"
        username={user.username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />

      <div className="source-option-grid">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`source-option-card ${selected === option.id ? 'source-option-card--selected' : ''}`}
            disabled={generating}
            onClick={() => setSelected(option.id)}
          >
            <span className="source-option-icon">{option.icon}</span>
            <div className="source-option-text">
              <p className="source-option-label">{option.label}</p>
              <p className="source-option-sublabel">{option.sublabel}</p>
            </div>
          </button>
        ))}
      </div>

      {uploadCount <= 0 && <p className="field-hint">Upload your class materials to unlock more options.</p>}

      {error && <p className="form-error">{error}</p>}

      <button type="button" className="btn btn-primary btn-block" disabled={!selected || generating} onClick={() => onContinue(selected)}>
        {generating ? 'Generating your questions… (this can take a minute)' : 'Continue'}
      </button>
    </div>
  )
}
