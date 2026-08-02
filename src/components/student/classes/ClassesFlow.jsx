import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getStudentClasses, getMyHomework } from '../../../lib/storage'
import { getErrorMessage } from '../../../lib/errors'
import MyClassesScreen from './MyClassesScreen'
import ClassHomeScreen from './ClassHomeScreen'
import HomeworkDetailScreen from './HomeworkDetailScreen'
import HomeworkFlow from '../homework/HomeworkFlow'

export default function ClassesFlow({ user, onExit, onLogout, onLogoClick }) {
  const { t } = useTranslation()
  const [view, setView] = useState('list') // list | class-home | day-detail | homework
  const [classes, setClasses] = useState(null)
  const [selectedClassId, setSelectedClassId] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [dayAssignments, setDayAssignments] = useState([])
  const [calendarKey, setCalendarKey] = useState(0)
  const [activeAssignment, setActiveAssignment] = useState(null)
  const [startError, setStartError] = useState('')

  function loadClasses() {
    getStudentClasses()
      .then((data) => setClasses(data.classes))
      .catch(() => setClasses([]))
  }

  useEffect(loadClasses, [])

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
        setStartError(t('errors.NOT_FOUND'))
        return
      }
      setActiveAssignment(found)
      setView('homework')
    } catch (err) {
      setStartError(getErrorMessage(err, t))
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

  return (
    <MyClassesScreen
      user={user}
      classes={classes}
      onBack={onExit}
      onLogout={onLogout}
      onLogoClick={onLogoClick}
      onOpenClass={handleOpenClass}
      onJoined={loadClasses}
    />
  )
}
