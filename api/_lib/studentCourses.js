// A student's added courses from another grade (student_courses — see
// src/lib/additionalCourses.js for what can be added and why).
import { supabase } from './auth.js'

// [{ subject, grade }] for this student, leaving out any row that matches
// their own grade (possible if their grade changed after adding it — that
// course is then just their normal one).
export async function getStudentCourses(userId, mainGrade) {
  const { data, error } = await supabase.from('student_courses').select('subject, grade').eq('user_id', userId)
  if (error) throw error
  return (data || []).filter((c) => Number(c.grade) !== Number(mainGrade))
}

// The school_subject_groups row an added course links to: the student's
// school, that subject, that grade. null if the school doesn't offer it.
export async function findCourseGroup(schoolId, subject, grade) {
  const { data, error } = await supabase
    .from('school_subject_groups')
    .select('id, school_id, subject, grade')
    .eq('school_id', schoolId)
    .eq('subject', subject)
    .eq('grade', grade)
    .maybeSingle()
  if (error) throw error
  return data
}

// Shared validate() step for every write tied to a course (uploads,
// practice sessions, grades): body.course_grade is optional — absent or
// null means the student's own grade — else a whole grade number, the
// added course it was made from. Normalizes it in place to a number or null.
export function validateCourseGrade(body) {
  if (body.course_grade === undefined || body.course_grade === null || body.course_grade === '') {
    body.course_grade = null
    return null
  }
  const grade = Number(body.course_grade)
  if (!Number.isInteger(grade) || grade < 1 || grade > 12) return { field: 'course_grade', message: 'course_grade must be a whole grade number.' }
  body.course_grade = grade
  return null
}
