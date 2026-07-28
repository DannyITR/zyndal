// Shared by SignupForm.jsx (email signup, once revealed) and
// OAuthOnboardingScreen.jsx (new Google signups) — same three account
// types, same copy, in exactly one place. Teacher is fully selectable here;
// it's only downstream (ParentDashboard, api/_lib/parentHandler.js) that
// currently treats it identically to parent — see App.jsx's comment.
const OPTIONS = {
  en: [
    { value: 'student', icon: '🎓', label: 'Student', description: "I'm here to learn and earn" },
    { value: 'parent', icon: '👨‍👩‍👧', label: 'Parent', description: 'I want to monitor and reward my child' },
    { value: 'teacher', icon: '🍎', label: 'Teacher', description: 'I want to assign work to my class' },
  ],
  fr: [
    { value: 'student', icon: '🎓', label: 'Élève', description: 'Je suis ici pour apprendre et gagner des récompenses' },
    { value: 'parent', icon: '👨‍👩‍👧', label: 'Parent', description: 'Je veux suivre les progrès et récompenser mon enfant' },
    { value: 'teacher', icon: '🍎', label: 'Enseignant', description: 'Je veux assigner du travail à ma classe' },
  ],
}

export default function AccountTypeSelector({ value, onChange, lang = 'en' }) {
  const options = OPTIONS[lang] || OPTIONS.en
  return (
    <div className="account-type-selector" role="radiogroup">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          className={`account-type-option ${value === opt.value ? 'account-type-option--selected' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          <span className="account-type-icon">{opt.icon}</span>
          <span className="account-type-text">
            <span className="account-type-label">{opt.label}</span>
            <span className="account-type-description">{opt.description}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
