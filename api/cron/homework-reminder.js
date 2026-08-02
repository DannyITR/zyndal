import { supabase } from '../_lib/auth.js'
import { insertNotification } from '../_lib/notifications.js'
import { notificationText } from '../_lib/notificationText.js'
import { sendPushToUser } from '../_lib/push.js'
import { todayStr, DEFAULT_TIMEZONE } from '../../src/lib/streak.js'

const REMINDER_HOUR = 9 // 9am local time, per zone — matches the spec's "due date at 9am"
const DEDUP_LOOKBACK_MS = 20 * 60 * 60 * 1000 // covers a retry within the same 9-10am hour

// Mirrors api/cron/streak-reminder.js's structure exactly (candidate
// selection by per-timezone current hour, dedup via the notifications
// table itself) — see that file's own comments for why each piece is
// shaped the way it is. GET + Authorization: Bearer $CRON_SECRET, same as
// that cron, matching Vercel's actual cron invocation method.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed. Use GET.' })
    return
  }

  const expected = process.env.CRON_SECRET
  const authHeader = req.headers.authorization || ''
  if (!expected || authHeader !== `Bearer ${expected}`) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, timezone, notification_preferences, language_preference')
      .eq('account_type', 'student')
      .is('deleted_at', null)
    if (usersError) throw usersError

    const hourByZone = new Map()
    function currentHourInZone(timeZone) {
      const zone = timeZone || DEFAULT_TIMEZONE
      if (hourByZone.has(zone)) return hourByZone.get(zone)
      let hour
      try {
        hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: zone, hour12: false, hour: 'numeric' }).format(new Date()))
      } catch {
        hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: DEFAULT_TIMEZONE, hour12: false, hour: 'numeric' }).format(new Date()))
      }
      hourByZone.set(zone, hour)
      return hour
    }

    const candidates = (users || []).filter((u) => currentHourInZone(u.timezone) === REMINDER_HOUR)
    if (candidates.length === 0) {
      res.status(200).json({ checked: users?.length || 0, reminded: 0 })
      return
    }
    const candidateIds = candidates.map((u) => u.id)
    const candidateById = Object.fromEntries(candidates.map((u) => [u.id, u]))

    const { data: enrollments, error: enrollError } = await supabase
      .from('class_students')
      .select('student_id, class_id')
      .in('student_id', candidateIds)
    if (enrollError) throw enrollError
    if (!enrollments || enrollments.length === 0) {
      res.status(200).json({ checked: users.length, candidates: candidates.length, reminded: 0 })
      return
    }
    const classIds = [...new Set(enrollments.map((e) => e.class_id))]

    // Loose window covering "today" for every IANA zone — narrowed to each
    // student's own local calendar day below.
    const yesterday = todayStr(new Date(Date.now() - 24 * 60 * 60 * 1000))
    const tomorrow = todayStr(new Date(Date.now() + 24 * 60 * 60 * 1000))
    const { data: assignments, error: assignmentsError } = await supabase
      .from('homework_assignments')
      .select('id, class_id, title, due_date')
      .in('class_id', classIds)
      .gte('due_date', yesterday)
      .lte('due_date', tomorrow)
    if (assignmentsError) throw assignmentsError
    if (!assignments || assignments.length === 0) {
      res.status(200).json({ checked: users.length, candidates: candidates.length, reminded: 0 })
      return
    }
    const assignmentIds = assignments.map((a) => a.id)

    // (student, assignment) pairs where the assignment's due_date is
    // exactly "today" in that student's own timezone.
    const duePairs = []
    for (const enrollment of enrollments) {
      const student = candidateById[enrollment.student_id]
      const zone = student.timezone || DEFAULT_TIMEZONE
      const today = todayStr(new Date(), zone)
      for (const assignment of assignments) {
        if (assignment.class_id === enrollment.class_id && assignment.due_date === today) {
          duePairs.push({ student, assignment })
        }
      }
    }
    if (duePairs.length === 0) {
      res.status(200).json({ checked: users.length, candidates: candidates.length, reminded: 0 })
      return
    }

    const { data: submissions, error: submissionsError } = await supabase
      .from('homework_submissions')
      .select('assignment_id, student_id')
      .in('assignment_id', assignmentIds)
      .in('student_id', candidateIds)
      .not('completed_at', 'is', null)
    if (submissionsError) throw submissionsError
    const completedKeys = new Set((submissions || []).map((s) => `${s.assignment_id}:${s.student_id}`))

    const dedupSince = new Date(Date.now() - DEDUP_LOOKBACK_MS).toISOString()
    const { data: alreadyReminded, error: remindedError } = await supabase
      .from('notifications')
      .select('user_id, data')
      .eq('type', 'homework_reminder')
      .in('user_id', candidateIds)
      .gte('created_at', dedupSince)
    if (remindedError) throw remindedError
    const remindedKeys = new Set((alreadyReminded || []).map((n) => `${n.data?.assignment_id}:${n.user_id}`))

    const toRemind = duePairs.filter(({ student, assignment }) => {
      const key = `${assignment.id}:${student.id}`
      return !completedKeys.has(key) && !remindedKeys.has(key)
    })

    for (const { student, assignment } of toRemind) {
      const { title, body } = notificationText('homework_reminder', student.language_preference, { title: assignment.title })
      await insertNotification({
        userId: student.id,
        type: 'homework_reminder',
        title,
        body,
        data: { assignment_id: assignment.id, class_id: assignment.class_id },
      })
      await sendPushToUser({ userId: student.id, type: 'homework_reminder', title, body, url: 'https://zyndal.ca' })
    }

    res.status(200).json({ checked: users.length, candidates: candidates.length, duePairs: duePairs.length, reminded: toRemind.length })
  } catch (err) {
    console.error('[cron] homework-reminder failed:', err)
    res.status(500).json({ error: 'Internal error' })
  }
}
