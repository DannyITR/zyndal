import { useEffect, useState } from 'react'
import { getStudentClasses, getMyHomework } from '../../../lib/storage'
import MyClassesScreen from './MyClassesScreen'
import ClassHomeScreen from './ClassHomeScreen'
import HomeworkDetailScreen from './HomeworkDetailScreen'
import HomeworkFlow from '../homework/HomeworkFlow'

export default function ClassesFlow({ user, onExit, onLogout, onLogoClick }) {
  const [view, setView] = useState('list') // list | class-home | day-detail | homework
  const [classes, setClasses] = useState(null)
  const [selectedClassId, setSelectedClassId] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [dayAssignments, setDayAssignments] = useState([])
  const [calendarKey, setCalendarKey] = useState(0)
  const [activeAssignment, setActiveAssignment] = useState(null)
  const [startError, setStartError] = useState('')

  useEffect(() => {
    getStudentClasses()
      .then((data) => setClasses(data.classes))
      .catch(() => setClasses([]))
  }, [])

  function handleOpenClass(classId) {
    setSelectedClassId(classId)
    setView('class-home')
  }

  function handleSelectDay(dateStr, assignmentsForDay) {
    setSelectedDate(dateStr)
    setDayAssignments(assignmentsForDay)
    setView('day-detail')
  }

  async function handleStart(assignmentId) {
    setStartError('')
    try {
      const { homework } = await getMyHomework()
      const found = homework.find((h) => h.id === assignmentId)
      if (!found || !found.questions) {
        setStartError('This homework is no longer available.')
        return
      }
      setActiveAssignment(found)
      setView('homework')
    } catch (err) {
      setStartError(err.message || "Couldn't load this homework. Please try again.")
    }
  }

  function handleHomeworkExit() {
    setActiveAssignment(null)
    setCalendarKey((k) => k + 1)
    setView('class-home')
  }

  if (view === 'homework' && activeAssignment) {
    return <HomeworkFlow user={user} assignment={activeAssignment} onExit={handleHomeworkExit} onLogout={onLogout} onLogoClick={onLogoClick} />
  }

  if (view === 'day-detail') {
    return (
      <HomeworkDetailScreen
        user={user}
        date={selectedDate}
        assignments={dayAssignments}
        onBack={() => setView('class-home')}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
        onStart={handleStart}
      />
    )
  }

  if (view === 'class-home' && selectedClassId) {
    const classInfo = (classes || []).find((c) => c.id === selectedClassId)
    if (!classInfo) {
      setView('list')
      return null
    }
    return (
      <>
        {startError && <p className="form-error">{startError}</p>}
        <ClassHomeScreen
          user={user}
          classInfo={classInfo}
          calendarKey={calendarKey}
          onBack={() => setView('list')}
          onLogout={onLogout}
          onLogoClick={onLogoClick}
          onSelectDay={handleSelectDay}
        />
      </>
    )
  }

  return <MyClassesScreen user={user} classes={classes} onBack={onExit} onLogout={onLogout} onLogoClick={onLogoClick} onOpenClass={handleOpenClass} />
}
