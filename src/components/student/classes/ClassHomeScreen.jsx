import TopBar from '../../shared/TopBar'
import HomeworkCalendar from './HomeworkCalendar'

export default function ClassHomeScreen({ user, classInfo, calendarKey, onBack, onLogout, onLogoClick, onSelectDay }) {
  return (
    <div className="screen student-screen">
      <TopBar
        title={classInfo.name}
        subtitle={`Grade ${classInfo.grade} · ${classInfo.school} · @${classInfo.teacherUsername}`}
        username={user.username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />

      <div className="parent-code-card">
        <p className="parent-code-label">Currently studying</p>
        <p className="class-home-unit">
          📖 Unit {classInfo.currentUnitNumber}
          {classInfo.currentUnitTitle ? ` — ${classInfo.currentUnitTitle}` : ''}
        </p>
      </div>

      <h3 className="section-heading">Homework Calendar</h3>
      <HomeworkCalendar key={calendarKey} classId={classInfo.id} classCreatedAt={classInfo.createdAt} onSelectDay={onSelectDay} />
    </div>
  )
}
