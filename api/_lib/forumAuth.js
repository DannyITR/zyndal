import { supabase } from './auth.js'
import { CORE_SUBJECT_IDS } from '../../src/lib/questions.js'
import { hasLeftClass } from './classLeaves.js'

// Core-subject groups are always-on memberships (see coreGroups.js), but
// the row itself can still go missing — a student who tapped Leave on one
// before that was blocked (EthanITR's History & Geography group, which
// then 403'd his shared-notes upload), or a gap autoJoinCoreGroups never
// covered (it only runs on a school/grade change, not at signup). Rather
// than deny a student their own school+grade's core group, recreate the
// row on the spot. Also covers another grade's core group the student has
// added as a course (student_courses), which works the same way. Never
// applies to electives, which stay opt-in, or to another school's group.
async function restoreCoreGroupMembership(userId, groupId) {
  const { data: group, error: groupError } = await supabase
    .from('school_subject_groups')
    .select('school_id, grade, subject')
    .eq('id', groupId)
    .maybeSingle()
  if (groupError) throw groupError
  if (!group || !CORE_SUBJECT_IDS.includes(group.subject)) return false
  // Never re-add a group the student chose to leave (see classLeaves.js).
  if (await hasLeftClass(userId, 'group', groupId)) return false

  const { data: user, error: userError } = await supabase.from('users').select('account_type, school_id, grade').eq('id', userId).maybeSingle()
  if (userError) throw userError
  if (!user || user.account_type !== 'student' || user.school_id !== group.school_id) return false
  // Their own grade's group, or one they've added as a course from another
  // grade (student_courses — see api/student/add-course.js).
  if (Number(user.grade) !== Number(group.grade)) {
    const { data: course, error: courseError } = await supabase
      .from('student_courses')
      .select('id')
      .eq('user_id', userId)
      .eq('subject', group.subject)
      .eq('grade', group.grade)
      .maybeSingle()
    if (courseError) throw courseError
    if (!course) return false
  }

  const { error: joinError } = await supabase
    .from('school_subject_group_students')
    .upsert({ group_id: groupId, student_id: userId }, { onConflict: 'group_id,student_id', ignoreDuplicates: true })
  if (joinError) throw joinError
  return true
}

// Resolves whether userId belongs to the class a forum is scoped to — the
// single source of truth for both read and write access, since forum
// viewing is membership-gated same as posting (a private per-class space).
// A 'group' (school_subject_groups) only has student members (unclaimed —
// no teacher yet); a 'class' (classes) has enrolled students
// (class_students) plus the one teacher who owns it (classes.teacher_id).
export async function getForumMembership(userId, classType, classId) {
  if (classType === 'group') {
    const { data, error } = await supabase
      .from('school_subject_group_students')
      .select('id')
      .eq('group_id', classId)
      .eq('student_id', userId)
      .maybeSingle()
    if (error) throw error
    if (data) return { member: true, role: 'student' }
    if (await restoreCoreGroupMembership(userId, classId)) return { member: true, role: 'student' }
    return { member: false, role: null }
  }

  if (classType === 'class') {
    const { data: cls, error: classError } = await supabase.from('classes').select('teacher_id').eq('id', classId).maybeSingle()
    if (classError) throw classError
    if (!cls) return { member: false, role: null }
    if (cls.teacher_id === userId) return { member: true, role: 'teacher' }

    const { data, error } = await supabase
      .from('class_students')
      .select('id')
      .eq('class_id', classId)
      .eq('student_id', userId)
      .maybeSingle()
    if (error) throw error
    return { member: Boolean(data), role: data ? 'student' : null }
  }

  return { member: false, role: null }
}

// A reply/report endpoint is only ever handed a thread_id or a reply's
// target_id — this walks back up to the (class_type, class_id) the
// membership check above needs.
export async function resolveThreadClass(threadId) {
  const { data, error } = await supabase
    .from('forum_threads')
    .select('id, class_type, class_id, author_id, title, body, created_at, edited_at, deleted_at')
    .eq('id', threadId)
    .maybeSingle()
  if (error) throw error
  return data
}

// For a report on a reply, the reply itself carries no class info — it only
// knows its thread_id, so this joins one level further than
// resolveThreadClass. Returns the same shape either way (plus the
// resolved content itself, since api/admin & api/teacher's get-forum-reports
// need it for display and this is already fetching it). content.deletedAt
// is intentionally surfaced here (unlike the normal read path, which hides
// soft-deleted content entirely) — moderation needs to see it regardless,
// clearly marked "deleted by author" per the feature spec, since a report
// may be the only reason anyone reviews it again.
export async function resolveReportTargetClass(targetType, targetId) {
  if (targetType === 'thread') {
    const thread = await resolveThreadClass(targetId)
    if (!thread) return null
    return {
      class_type: thread.class_type,
      class_id: thread.class_id,
      thread_id: thread.id,
      content: { title: thread.title, deletedAt: thread.deleted_at },
    }
  }

  if (targetType === 'reply') {
    const { data: reply, error } = await supabase
      .from('forum_replies')
      .select('id, thread_id, body, author_id, deleted_at')
      .eq('id', targetId)
      .maybeSingle()
    if (error) throw error
    if (!reply) return null
    const thread = await resolveThreadClass(reply.thread_id)
    if (!thread) return null
    return {
      class_type: thread.class_type,
      class_id: thread.class_id,
      thread_id: thread.id,
      content: { body: reply.body, deletedAt: reply.deleted_at },
    }
  }

  return null
}
