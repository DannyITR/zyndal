import { useState } from 'react'
import { getSubject } from '../../../lib/questions'
import PracticeSetupScreen from './PracticeSetupScreen'
import PracticeSessionScreen from './PracticeSessionScreen'
import PracticeResultsScreen from './PracticeResultsScreen'

export default function PracticeFlow({ user, lockedSubjectId, onExit, onLogout, onLogoClick }) {
  const [session, setSession] = useState(null) // { subjectId, topic, questions }
  const [result, setResult] = useState(null)

  if (!session) {
    return (
      <PracticeSetupScreen
        user={user}
        lockedSubjectId={lockedSubjectId}
        onStart={setSession}
        onBack={onExit}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />
    )
  }

  const subjectName = getSubject(session.subjectId)?.name || session.subjectId

  if (!result) {
    return (
      <PracticeSessionScreen
        user={user}
        subjectId={session.subjectId}
        subjectName={subjectName}
        topic={session.topic}
        questions={session.questions}
        onFinished={setResult}
        onBack={() => setSession(null)}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />
    )
  }

  return (
    <PracticeResultsScreen
      user={user}
      subjectName={subjectName}
      topic={session.topic}
      result={result}
      onDone={() => {
        setSession(null)
        setResult(null)
      }}
      onLogout={onLogout}
      onLogoClick={onLogoClick}
    />
  )
}
