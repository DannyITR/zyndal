import { supabase } from './auth.js'

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
    return { member: Boolean(data), role: data ? 'student' : null }
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
    .select('id, class_type, class_id, author_id, title, body, created_at')
    .eq('id', threadId)
    .maybeSingle()
  if (error) throw error
  return data
}

// For a report on a reply, the reply itself carries no class info — it only
// knows its thread_id, so this joins one level further than
// resolveThreadClass. Returns the same shape either way (plus the
// resolved content itself, since api/admin & api/teacher's get-forum-reports
// need it for display and this is already fetching it).
export async function resolveReportTargetClass(targetType, targetId) {
  if (targetType === 'thread') {
    const thread = await resolveThreadClass(targetId)
    if (!thread) return null
    return { class_type: thread.class_type, class_id: thread.class_id, thread_id: thread.id, content: { title: thread.title } }
  }

  if (targetType === 'reply') {
    const { data: reply, error } = await supabase.from('forum_replies').select('id, thread_id, body, author_id').eq('id', targetId).maybeSingle()
    if (error) throw error
    if (!reply) return null
    const thread = await resolveThreadClass(reply.thread_id)
    if (!thread) return null
    return { class_type: thread.class_type, class_id: thread.class_id, thread_id: thread.id, content: { body: reply.body } }
  }

  return null
}
