// Core classes a student has chosen to leave (class_leaves). Leaving a core
// card removes the membership row as before, but records it here so that:
//   - the card moves to the Electives section with a Join button, and
//     rejoining (api/student/rejoin-class.js) restores the membership —
//     including a teacher-claimed class, without its join code;
//   - nothing re-adds them behind their back (autoJoinCoreGroups and the
//     membership self-heal in forumAuth.js both skip a left group);
//   - Today's Question swaps that subject's day for another while they're
//     out of it (getDailySubjectIdFor in src/lib/questions.js).
// None of the student's uploads, answers, grades or progress are touched.
import { supabase } from './auth.js'
import { CORE_SUBJECT_IDS } from '../../src/lib/questions.js'
import { resolveClassSubject } from './classSubject.js'

export async function getClassLeaves(userId) {
  const { data, error } = await supabase.from('class_leaves').select('class_type, class_id, subject, left_on').eq('user_id', userId)
  if (error) throw error
  return data || []
}

export async function hasLeftClass(userId, classType, classId) {
  const { data, error } = await supabase
    .from('class_leaves')
    .select('id')
    .eq('user_id', userId)
    .eq('class_type', classType)
    .eq('class_id', classId)
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}

// The core subject a group or claimed class belongs to, or null if it
// isn't one (electives are left the ordinary way, with no record).
export async function coreSubjectOf(classType, classId) {
  if (classType === 'group') {
    const { data, error } = await supabase.from('school_subject_groups').select('subject').eq('id', classId).maybeSingle()
    if (error) throw error
    return data && CORE_SUBJECT_IDS.includes(data.subject) ? data.subject : null
  }
  const { data, error } = await supabase.from('classes').select('*').eq('id', classId).maybeSingle()
  if (error) throw error
  const subject = data ? resolveClassSubject(data) : null
  return subject && CORE_SUBJECT_IDS.includes(subject) ? subject : null
}

// [{ subject, leftOn }] for Today's Question: core subjects the student has
// left and isn't still taking through another card (e.g. they left their
// Math group but are in a teacher's Math class, or have Gr 10 Math added).
// leftOn is their earliest leave of that subject.
export async function getLeftSubjects(userId) {
  const leaves = await getClassLeaves(userId)
  if (leaves.length === 0) return []

  const [{ data: groupRows, error: groupError }, { data: classRows, error: classError }] = await Promise.all([
    supabase.from('school_subject_group_students').select('group_id').eq('student_id', userId),
    supabase.from('class_students').select('class_id').eq('student_id', userId),
  ])
  if (groupError) throw groupError
  if (classError) throw classError
  const groupIds = (groupRows || []).map((r) => r.group_id)
  const classIds = (classRows || []).map((r) => r.class_id)
  const [{ data: groups, error: groupsError }, { data: classes, error: classesError }] = await Promise.all([
    groupIds.length ? supabase.from('school_subject_groups').select('subject').in('id', groupIds) : { data: [] },
    classIds.length ? supabase.from('classes').select('*').in('id', classIds) : { data: [] },
  ])
  if (groupsError) throw groupsError
  if (classesError) throw classesError
  const stillTaking = new Set([...(groups || []).map((g) => g.subject), ...(classes || []).map(resolveClassSubject).filter(Boolean)])

  const bySubject = new Map()
  for (const leave of leaves) {
    if (stillTaking.has(leave.subject)) continue
    const current = bySubject.get(leave.subject)
    if (!current || leave.left_on < current) bySubject.set(leave.subject, leave.left_on)
  }
  return [...bySubject].map(([subject, leftOn]) => ({ subject, leftOn }))
}

// Called whenever the student is (re)added to a class by any route — the
// rejoin button, a group's Join, or a teacher's class code — so a leave
// never outlives the membership it recorded.
export async function clearClassLeave(userId, classType, classId) {
  const { error } = await supabase.from('class_leaves').delete().eq('user_id', userId).eq('class_type', classType).eq('class_id', classId)
  if (error) throw error
}
