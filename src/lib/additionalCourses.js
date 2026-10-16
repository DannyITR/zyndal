// Courses a student can take from another grade on top of their own — e.g.
// a Grade 11 student repeating Grade 10 History & Geography after failing
// it, or placed in Grade 10 Math by a scheduling error. Stored per student
// in student_courses (see api/student/add-course.js); users.grade itself
// never changes.
//
// Shared by the client (the "+ Add a course from another grade" picker on
// ClassCardsGrid.jsx) and the server (add-course.js validates against the
// same list), so offering a new combo is one line here. Pure data and
// functions only — like src/lib/uploads.js, nothing browser-only, since
// serverless functions import this file.

// forGrade: the student's own grade the option is offered to.
// grade/subject: the course they can add.
export const ADDITIONAL_COURSE_OPTIONS = [
  { forGrade: 11, grade: 10, subject: 'history_geography' },
  { forGrade: 11, grade: 10, subject: 'math' },
]

export function getAdditionalCourseOptions(studentGrade) {
  return ADDITIONAL_COURSE_OPTIONS.filter((o) => o.forGrade === Number(studentGrade))
}

export function isOfferedCourse(studentGrade, subject, grade) {
  return getAdditionalCourseOptions(studentGrade).some((o) => o.subject === subject && o.grade === Number(grade))
}

// Rows tied to a specific course (uploads, practice_sessions, grades) carry
// course_grade: null for the student's own grade, the course's grade (e.g.
// 10) for an added course. courseGrade here follows the same convention.
export function matchesCourseGrade(row, courseGrade) {
  return (row.course_grade ?? row.courseGrade ?? null) === (courseGrade ?? null)
}

// Today's Question (decision A1): the subject rotation stays the same for
// every student; a student who also takes that subject at another grade
// alternates between their grades each time the subject comes round — e.g.
// Gr 11 Math one Math day, Gr 10 Math the next. Deterministic from the date,
// so showing, submitting, and late-answering a day all pick the same grade.
// courses: the student's added courses [{ subject, grade }].
const ROTATION_LENGTH = 5 // see DAILY_ROTATION_ORDER in src/lib/questions.js

export function dailyQuestionGrade({ mainGrade, courses, subject, dateStr }) {
  const extraGrades = [...new Set((courses || []).filter((c) => c.subject === subject && c.grade !== mainGrade).map((c) => c.grade))].sort((a, b) => b - a)
  if (extraGrades.length === 0) return mainGrade
  const grades = [mainGrade, ...extraGrades]
  const date = dateStr ? new Date(`${dateStr}T12:00:00Z`) : new Date()
  const occurrence = Math.floor(Math.floor(date.getTime() / 86400000) / ROTATION_LENGTH)
  return grades[occurrence % grades.length]
}
