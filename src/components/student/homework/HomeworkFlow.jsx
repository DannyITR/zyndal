import { useState } from 'react'
import HomeworkSessionScreen from './HomeworkSessionScreen'
import HomeworkResultsScreen from './HomeworkResultsScreen'

export default function HomeworkFlow({ user, assignment, onExit, onLogout, onLogoClick }) {
  const [result, setResult] = useState(null)

  if (!result) {
    return (
      <HomeworkSessionScreen
        user={user}
        assignment={assignment}
        onFinished={setResult}
        onBack={onExit}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />
    )
  }

  return (
    <HomeworkResultsScreen user={user} assignment={assignment} result={result} onDone={onExit} onLogout={onLogout} onLogoClick={onLogoClick} />
  )
}
