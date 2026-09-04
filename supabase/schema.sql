-- Zyndal Supabase schema.
-- Run this once in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/lquvzcecykluziwdmwff/sql/new
-- (migrated from the old US project, rvflvijyyppbtgcnnsyr, via
-- scripts/migrate-to-canada.js — that project is retired)

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password text not null,
  -- 'teacher' added alongside 'parent'/'student' — teacher accounts are
  -- routed into the same ParentDashboard as parent accounts for now (see
  -- api/_lib/parentHandler.js and App.jsx); class-specific teacher features
  -- are a future session. On an existing database this column's check
  -- constraint has to be dropped and recreated (ALTER TABLE doesn't touch
  -- an already-created table) — see the ALTER statements below.
  account_type text not null check (account_type in ('student', 'parent', 'teacher')),
  grade integer,
  parent_code text unique,
  created_at timestamptz not null default now(),
  display_name text,
  email text,
  school text,
  avatar text,
  wallet_balance_cents integer not null default 0,
  total_added_cents integer not null default 0,
  total_paid_out_cents integer not null default 0,
  coin_to_dollar_rate integer not null default 10,
  milestone_settings jsonb not null default '{"7":10,"14":20,"30":50}'::jsonb,
  is_premium boolean not null default false,
  language_preference text default 'English',
  -- Selectable in Settings (src/lib/theme.js) — 'default' is the app's
  -- original, only-ever theme; 'midnight' and 'daylight' are the two
  -- alternates. Cosmetic only, set for every account type.
  theme_preference text default 'default',
  -- Soft delete (Quebec Law 25 right-to-deletion flow — see
  -- api/auth/delete-account.js). Null = active account. Set to the deletion
  -- timestamp on self-delete; data is retained 90 days from this date to
  -- allow restoration (email hello@zyndal.ca), then permanently removed —
  -- manually for now, no automated purge job yet.
  deleted_at timestamptz,
  -- Social login (see api/auth/oauth-callback.js). True for accounts
  -- auto-created from a verified Google/Facebook identity (the provider
  -- already confirmed the email); false/default for ordinary
  -- username/password signups, which never verify email ownership today.
  email_verified boolean not null default false,
  -- IANA zone name (e.g. 'America/Toronto'), detected browser-side via
  -- Intl.DateTimeFormat().resolvedOptions().timeZone (see
  -- src/lib/timezone.js) and kept in sync by api/_lib/db.js's
  -- syncUserTimezone on every submit-answer/get-daily-progress/get-streak
  -- call. Used server-side to compute "today" in the student's own local
  -- time instead of UTC, so the daily question, streak, and subject-grid
  -- done/incorrect state all reset at the user's own midnight — not
  -- Vercel's. The 'America/Toronto' default matches Quebec (UTC-4/-5
  -- depending on DST) for any row created before this column existed.
  timezone text default 'America/Toronto'
);

-- Run on an existing database (create table if not exists above only
-- applies to a fresh install) — widens the account_type check constraint to
-- allow 'teacher' without dropping/recreating the whole table.
alter table users drop constraint if exists users_account_type_check;
alter table users add constraint users_account_type_check check (account_type in ('student', 'parent', 'teacher'));

-- Run on an existing database — same reason as above, this only applies to
-- a fresh install otherwise.
alter table users add column if not exists timezone text default 'America/Toronto';

create table if not exists streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_answered_date date,
  total_xp integer not null default 0,
  coin_balance integer not null default 0
);

create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subject text not null,
  question_text text not null,
  selected_answer text,
  correct boolean not null,
  answered_at timestamptz not null default now()
);
create index if not exists answers_user_id_idx on answers(user_id);

create table if not exists parent_student (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references users(id) on delete cascade,
  student_id uuid not null references users(id) on delete cascade,
  unique (parent_id, student_id),
  perfect_week_bonus decimal(10,2) not null default 10.00,
  grade_reward_a_plus_cents integer not null default 2500,
  grade_reward_a_cents integer not null default 1500,
  grade_reward_b_cents integer not null default 1000,
  grade_reward_c_cents integer not null default 500
);
create index if not exists parent_student_parent_id_idx on parent_student(parent_id);
create index if not exists parent_student_student_id_idx on parent_student(student_id);

create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references users(id) on delete cascade,
  student_id uuid not null references users(id) on delete cascade,
  coins integer not null,
  amount_cents integer not null,
  created_at timestamptz not null default now(),
  type text not null default 'manual'
);
create index if not exists payouts_parent_id_idx on payouts(parent_id);
create index if not exists payouts_student_id_idx on payouts(student_id);

-- One row per student per ISO week (Monday start) they hit 42/42 correct
-- first-attempt answers. The unique constraint makes detection idempotent;
-- "resolved" tracks whether the parent has confirmed/adjusted/paid it yet.
create table if not exists perfect_week_achievements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references users(id) on delete cascade,
  parent_id uuid not null references users(id) on delete cascade,
  week_start date not null,
  correct_count integer not null,
  suggested_bonus_cents integer not null,
  resolved boolean not null default false,
  resolved_amount_cents integer,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, week_start)
);
create index if not exists perfect_week_achievements_parent_id_idx on perfect_week_achievements(parent_id);

create table if not exists friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references users(id) on delete cascade,
  receiver_id uuid not null references users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);
create index if not exists friend_requests_sender_id_idx on friend_requests(sender_id);
create index if not exists friend_requests_receiver_id_idx on friend_requests(receiver_id);

-- Symmetric: accepting a request inserts a row in both directions so "my
-- friends" is always a simple `where user_id = me` lookup.
create table if not exists friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  friend_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, friend_id)
);
create index if not exists friends_user_id_idx on friends(user_id);
create index if not exists friends_friend_id_idx on friends(friend_id);

-- One row per streak share. share_date is set explicitly by the client
-- (todayStr(), UTC-based) rather than derived from shared_at at query time —
-- casting timestamptz to date depends on the session's timezone, which
-- can't be used in an index (must be IMMUTABLE), so a plain stored date
-- column is both correct and simpler. Its unique constraint enforces "one
-- share per sender-receiver pair per calendar day". The mutual "share
-- streak" between two friends is computed client-side from the full history
-- of rows between them (see computeShareStreak in streakShare.js),
-- Snapchat-style: it only counts consecutive days where BOTH directions shared.
create table if not exists streak_shares (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references users(id) on delete cascade,
  receiver_id uuid not null references users(id) on delete cascade,
  sender_streak integer not null,
  share_date date not null default current_date,
  shared_at timestamptz not null default now(),
  unique (sender_id, receiver_id, share_date)
);
create index if not exists streak_shares_sender_id_idx on streak_shares(sender_id);
create index if not exists streak_shares_receiver_id_idx on streak_shares(receiver_id);

-- A document (test, worksheet, textbook page, or notes) a student
-- photographed or uploaded, plus the AI-extracted summary. grade_received /
-- test_date are only populated for document_type = 'test'.
-- pages_count tracks how many pages/photos have been merged into this
-- upload across every capture session (an upload can start at 1 page and
-- grow via "Add Pages" in the library — see addPagesToUpload in
-- storage.js). updated_at moves forward each time pages are added, so the
-- library can show both "Created" and "Last updated" dates.
create table if not exists uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  document_type text not null check (document_type in ('test', 'worksheet', 'textbook', 'notes')),
  subject text not null,
  topic text not null,
  grade_received integer,
  test_date date,
  notes text,
  summary text,
  key_concepts text[],
  pages_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists uploads_user_id_idx on uploads(user_id);

-- Soft per-subject weekly usage cap on uploads (see WEEKLY_UPLOAD_PAGE_LIMIT
-- in src/lib/uploads.js, enforced by api/_lib/uploadLimits.js), independent
-- of the premium paywall. A dedicated ledger rather than summing
-- uploads.pages_count by created_at — a single upload row can grow across
-- multiple weeks via "Add Pages" (see save-questions.js) without its
-- created_at ever moving, so summing by created_at would let an old upload
-- dodge the cap indefinitely. week_start is the Monday (inclusive) of the
-- ISO week, matching mondayOfWeek in src/lib/streak.js.
create table if not exists upload_weekly_usage (
  user_id uuid not null references users(id) on delete cascade,
  subject text not null,
  week_start date not null,
  pages_used integer not null default 0,
  primary key (user_id, subject, week_start)
);

-- Questions the AI extracted from an upload. Used both to show "what was on
-- this document" in the uploads library, and as the primary source for test
-- prep plans on a matching subject/topic (see getUploadedQuestions).
create table if not exists upload_questions (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references uploads(id) on delete cascade,
  question text not null,
  correct_answer text,
  options text[],
  explanation text,
  difficulty text,
  created_at timestamptz not null default now()
);
create index if not exists upload_questions_upload_id_idx on upload_questions(upload_id);

-- A grade the student logged manually — independent of Test Prep and
-- uploads. Still feeds the same grade-bonus payout flow as an uploaded test.
create table if not exists grades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subject text not null,
  test_name text not null,
  grade_percentage integer not null,
  test_date date not null,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists grades_user_id_idx on grades(user_id);

-- One row per graded test (upload or manually-logged grade) that qualifies
-- for an automatic bonus suggestion (the grade maps to a non-zero band
-- under the parent's reward settings). Exactly one of upload_id/grade_id is
-- set, identifying which source triggered it; unique on each keeps this
-- idempotent per source. "resolved" tracks whether the parent has
-- confirmed/adjusted/paid it yet — same pattern as perfect_week_achievements.
create table if not exists grade_bonuses (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid unique references uploads(id) on delete cascade,
  grade_id uuid unique references grades(id) on delete cascade,
  student_id uuid not null references users(id) on delete cascade,
  parent_id uuid not null references users(id) on delete cascade,
  grade_received integer not null,
  suggested_bonus_cents integer not null,
  resolved boolean not null default false,
  resolved_amount_cents integer,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint grade_bonuses_source_check check (
    (upload_id is not null and grade_id is null) or (upload_id is null and grade_id is not null)
  )
);
create index if not exists grade_bonuses_parent_id_idx on grade_bonuses(parent_id);

create table if not exists study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subject text not null,
  topic text not null,
  test_date date not null,
  days_available integer not null,
  grade_level integer,
  plan_data jsonb not null,
  created_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  outcome text check (outcome in ('great', 'ok', 'not_great'))
);
create index if not exists study_plans_user_id_idx on study_plans(user_id);

-- One row per completed Practice session (5 questions, coins-only reward).
create table if not exists practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subject text not null,
  topic text not null,
  score_percentage integer not null,
  questions_correct integer not null,
  questions_total integer not null,
  coins_earned integer not null,
  completed_at timestamptz not null default now()
);
create index if not exists practice_sessions_user_id_idx on practice_sessions(user_id);

-- One row per subject+grade combination — a static reference curriculum
-- generated by Claude exactly once and reused by every student forever
-- (unlike study_plans/practice_sessions, this table has no user_id; it's a
-- shared global cache, not per-student data). The unique constraint is what
-- makes "generated exactly once ever" actually true even under a race
-- between two students opening the same subject+grade for the first time
-- at the same moment — see saveCurriculumOutline in storage.js.
create table if not exists curriculum_outlines (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  grade integer not null,
  outline_data jsonb not null,
  generated_at timestamptz not null default now(),
  unique (subject, grade)
);

-- Links a Zyndal account to a Google/Facebook identity for social login
-- (see api/auth/oauth-callback.js and api/auth/oauth-merge.js). Supabase
-- Auth itself only brokers the OAuth handshake and verifies the resulting
-- token server-side — it is never the source of truth for who a user is in
-- this app; this table plus the existing `users` row is. The
-- (provider, provider_user_id) unique constraint is what makes "does this
-- Google/Facebook account already have a Zyndal login" a safe, race-free
-- check. One user can link more than one provider (no uniqueness on
-- user_id), but a given provider identity can only ever point at one user.
create table if not exists oauth_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null check (provider in ('google', 'facebook')),
  provider_user_id text not null,
  provider_email text not null,
  provider_name text,
  created_at timestamptz not null default now(),
  unique (provider, provider_user_id)
);
create index if not exists oauth_identities_user_id_idx on oauth_identities(user_id);
create index if not exists oauth_identities_provider_user_id_idx on oauth_identities(provider, provider_user_id);

-- Custom-auth session tokens (Zyndal doesn't use Supabase Auth). Issued on
-- login/signup, sent as the X-Session-Token header on every Supabase
-- request (see supabaseClient.js), and deleted on logout. This is prep
-- work only for now — no RLS policy or server-side function validates the
-- token yet, so it doesn't gate access on its own until that lands.
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
create index if not exists sessions_token_idx on sessions(token);
create index if not exists sessions_user_id_idx on sessions(user_id);

-- Every table below has RLS enabled with no policies defined — default-deny
-- for the anon key; every /api/* function authenticates the caller itself
-- and uses the service-role key (api/_lib/auth.js), which bypasses RLS
-- regardless, so this only matters for blocking the anon key from reading
-- these tables directly. Re-confirmed empirically against the live database
-- on 2026-08-08: anon-key reads return 0 rows and anon-key inserts return
-- 42501 (RLS policy violation) on every one of these.
--
-- This block predates Session 5's RLS rollout and used to read "disable" —
-- left un-updated for over a week after RLS was actually turned back on
-- live (see 7833bab's commit message), which is exactly the kind of stale
-- drift this file is prone to for anything not re-checked against the live
-- database. Like the rest of this file, these statements are a reference
-- snapshot, not applied automatically — re-run manually only if a table's
-- live state ever needs to change.
alter table users enable row level security;
alter table streaks enable row level security;
alter table answers enable row level security;
alter table parent_student enable row level security;
alter table payouts enable row level security;
alter table perfect_week_achievements enable row level security;
alter table friend_requests enable row level security;
alter table friends enable row level security;
alter table streak_shares enable row level security;
alter table uploads enable row level security;
alter table upload_questions enable row level security;
alter table upload_weekly_usage enable row level security;
alter table grades enable row level security;
alter table grade_bonuses enable row level security;
alter table study_plans enable row level security;
alter table practice_sessions enable row level security;
alter table curriculum_outlines enable row level security;
alter table sessions enable row level security;
alter table oauth_identities enable row level security;

-- ---------- Schools + open student self-organization ----------
-- Added alongside the existing classes/class_students tables (themselves
-- not in this file — see the note at the top about drift). Phase 1 (schools,
-- school_subject_groups, school_subject_group_students, users.school_id),
-- Phase 2 (teacher_claims: submission, admin approval/rejection, claimed-
-- class creation), and Phase 3 (school_change_requests: proof-gated student
-- school changes, admin approval/rejection) are all wired up in the app.

create table if not exists schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  created_at timestamptz not null default now()
);

-- The unclaimed "school + subject + grade" entity — seeded, one row per
-- (school, subject, grade) combination.
create table if not exists school_subject_groups (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  subject text not null,
  grade integer not null,
  created_at timestamptz not null default now(),
  unique (school_id, subject, grade)
);
create index if not exists school_subject_groups_school_id_idx on school_subject_groups(school_id);

-- Student membership in an unclaimed group (parallels class_students).
create table if not exists school_subject_group_students (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references school_subject_groups(id) on delete cascade,
  student_id uuid not null references users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (group_id, student_id)
);
create index if not exists school_subject_group_students_student_id_idx on school_subject_group_students(student_id);

-- Structured school reference alongside the existing free-text users.school
-- (kept as-is, used when a student picks "Other/not listed").
alter table users add column if not exists school_id uuid references schools(id);

-- Additive columns so a teacher-claimed class can carry a subject/course
-- number and link back to the group it was claimed from. All nullable —
-- existing self-created classes are unaffected. (classes itself predates
-- this file and isn't defined above — see the drift note at the top.)
alter table classes add column if not exists school_id uuid references schools(id);
alter table classes add column if not exists subject text;
alter table classes add column if not exists course_number text;
alter table classes add column if not exists group_id uuid references school_subject_groups(id);

-- Phase 2: teacher requests to claim an unclaimed group.
create table if not exists teacher_claims (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references users(id) on delete cascade,
  group_id uuid not null references school_subject_groups(id) on delete cascade,
  course_number text not null,
  bio_link text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_class_id uuid references classes(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists teacher_claims_status_idx on teacher_claims(status);

-- Phase 2 additions: how the class should be named for students (e.g.
-- "Mr. Smith", combined with course_number as "Math 416 Mr. Smith" on
-- approval — the app has no first/last-name or honorific data to derive
-- this automatically) and an optional admin-supplied reason on rejection.
alter table teacher_claims add column if not exists display_name text;
alter table teacher_claims add column if not exists rejection_reason text;

-- Phase 3: student requests to change their school (proof-gated, admin-reviewed).
create table if not exists school_change_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references users(id) on delete cascade,
  requested_school_id uuid references schools(id),
  requested_school_name text,
  proof_image_base64 text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists school_change_requests_status_idx on school_change_requests(status);

-- Phase 3 addition: optional admin-supplied reason on rejection, matching
-- teacher_claims.rejection_reason.
alter table school_change_requests add column if not exists rejection_reason text;

alter table schools enable row level security;
alter table school_subject_groups enable row level security;
alter table school_subject_group_students enable row level security;
alter table teacher_claims enable row level security;
alter table school_change_requests enable row level security;

-- Seed: 11 LBPSB (Lester B. Pearson School Board, West Island Montreal) high
-- schools, one shared board domain (used for the Phase 2 teacher email-
-- domain check).
insert into schools (name, domain) values
  ('Beaconsfield High School', 'lbpsb.qc.ca'),
  ('Beurling Academy High School', 'lbpsb.qc.ca'),
  ('Horizon High School', 'lbpsb.qc.ca'),
  ('John Rennie High School', 'lbpsb.qc.ca'),
  ('Lakeside Academy High School', 'lbpsb.qc.ca'),
  ('LaSalle Community Comprehensive High School', 'lbpsb.qc.ca'),
  ('Macdonald High School', 'lbpsb.qc.ca'),
  ('Pierrefonds Community High School', 'lbpsb.qc.ca'),
  ('St. Thomas High School', 'lbpsb.qc.ca'),
  ('Westwood High School (Junior Campus)', 'lbpsb.qc.ca'),
  ('Westwood High School (Senior Campus)', 'lbpsb.qc.ca')
on conflict do nothing;

-- Seed: 6 subjects x grades 7-11 (sanitizeGrade in api/_lib/sanitize.js is
-- the app's only supported range) for every seeded school = 330 rows.
insert into school_subject_groups (school_id, subject, grade)
select s.id, subj.subject, g.grade
from schools s
cross join (values ('math'),('science'),('history'),('geography'),('english'),('french')) as subj(subject)
cross join (values (7),(8),(9),(10),(11)) as g(grade)
on conflict (school_id, subject, grade) do nothing;

-- ---------- Daily question resolution lock ----------
-- resolveDailyQuestion (api/_lib/dailyQuestion.js) is called independently
-- at display time and at submit time, and is meant to always agree on
-- "today's question" for a given student+subject — but a generated_questions
-- pool that goes from empty to populated (background generation finishing)
-- in between those two calls can flip which branch (hardcoded vs pool) gets
-- picked, scoring the student's answer against a different question than the
-- one they saw. This records the exact question the moment it's first
-- resolved for a (user, subject, day), so every later call that same day —
-- another display fetch or the submit call — reuses that same choice
-- instead of recomputing selection from scratch.
create table if not exists daily_question_locks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subject text not null,
  date text not null,
  question_text text not null,
  created_at timestamptz not null default now(),
  unique (user_id, subject, date)
);
create index if not exists daily_question_locks_user_date_idx on daily_question_locks(user_id, date);
alter table daily_question_locks enable row level security;

-- ---------- Forum ----------
-- Basic per-class forum: every unclaimed school_subject_groups row and
-- every teacher-claimed classes row gets its own separate forum. Those are
-- two genuinely different id spaces (see the schools/classes note above),
-- so forum_threads uses a class_type discriminator + class_id rather than a
-- single FK — mirrors forum_reports' own target_type/target_id polymorphic
-- column pair below. No FK on class_id itself since it points at two
-- different tables depending on class_type; every api/forum/*.js endpoint
-- re-derives and re-checks membership itself (api/_lib/forumAuth.js), same
-- as this file's existing RLS-enabled-with-no-policies pattern elsewhere.
create table if not exists forum_threads (
  id uuid primary key default gen_random_uuid(),
  class_type text not null check (class_type in ('group', 'class')),
  class_id uuid not null,
  author_id uuid not null references users(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  -- Author-only edit/soft-delete (api/forum/update-thread.js,
  -- delete-thread.js) — deleted_at set hides it from every normal read
  -- (get-threads.js/get-thread.js) but keeps the row for admin/teacher
  -- moderation review (resolveReportTargetClass in forumAuth.js exposes it
  -- regardless, tagged "deleted by author").
  edited_at timestamptz,
  deleted_at timestamptz
);
create index if not exists forum_threads_class_idx on forum_threads(class_type, class_id);

create table if not exists forum_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references forum_threads(id) on delete cascade,
  author_id uuid not null references users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index if not exists forum_replies_thread_idx on forum_replies(thread_id);

create table if not exists forum_reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('thread', 'reply')),
  target_id uuid not null,
  reporter_id uuid not null references users(id) on delete cascade,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'reviewed')),
  created_at timestamptz not null default now()
);
create index if not exists forum_reports_status_idx on forum_reports(status);

alter table forum_threads enable row level security;
alter table forum_replies enable row level security;
alter table forum_reports enable row level security;

-- ---------- Private messaging (students only) ----------
-- One row per friend pair, never per direction — check (user_a_id <
-- user_b_id) forces a canonical ordering so unique(user_a_id, user_b_id)
-- actually prevents a duplicate conversation regardless of who starts it;
-- every api/messages/*.js endpoint sorts the pair before querying or
-- inserting (see api/_lib/messaging.js's sortPairIds). Gated on the
-- existing friends table (itself already student-only in practice) plus an
-- explicit account_type check in every endpoint — teachers must never
-- reach this feature.
-- user_a_last_viewed_at/user_b_last_viewed_at are a lightweight polling-
-- friendly presence signal, not a general read-receipt (that's messages.
-- read_at) — api/messages/get-messages.js bumps the caller's own column to
-- now() on every fetch (the initial open AND every ~4s poll tick while the
-- thread stays open, see MessagesFlow.jsx), so it's a live heartbeat while
-- a participant is actively on this conversation's thread screen, and goes
-- stale within one poll interval of them leaving (or the app being
-- backgrounded, which already pauses polling — see
-- useVisibilityAwarePolling). api/messages/send-message.js checks the
-- recipient's own column before firing a push, so a message delivered
-- while they're already looking at it live doesn't also trigger a
-- redundant push notification.
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references users(id) on delete cascade,
  user_b_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  user_a_last_viewed_at timestamptz,
  user_b_last_viewed_at timestamptz,
  check (user_a_id < user_b_id),
  unique (user_a_id, user_b_id)
);
create index if not exists conversations_user_a_idx on conversations(user_a_id);
create index if not exists conversations_user_b_idx on conversations(user_b_id);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists messages_conversation_idx on messages(conversation_id, created_at);

-- Separate from forum_reports (rather than widening its target_type check)
-- since a message report doesn't fit that table's thread/reply/class-shaped
-- resolution logic — same id/target_type/target_id/reporter_id/reason/
-- status/created_at shape and pending/reviewed workflow, just its own
-- queue (api/admin/get-message-reports.js).
-- reporter_id is nullable for an AI-sourced row (source = 'ai') — every
-- message is screened automatically (api/_lib/messageSafety.js, fired via
-- waitUntil from api/messages/send-message.js so it never delays delivery)
-- for exactly three narrow categories, independent of the profanity filter
-- and of a human ever reporting anything. category is only ever set on
-- those AI-sourced rows.
create table if not exists message_reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null default 'message' check (target_type = 'message'),
  target_id uuid not null,
  reporter_id uuid references users(id) on delete cascade,
  source text not null default 'user' check (source in ('user', 'ai')),
  category text check (category in ('self_harm', 'sexual_content_minors', 'threats')),
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'reviewed')),
  created_at timestamptz not null default now()
);
create index if not exists message_reports_status_idx on message_reports(status);

alter table conversations enable row level security;
alter table messages enable row level security;
alter table message_reports enable row level security;

-- ---------- Migrations ----------
-- Run against a database that already has an `uploads` table from before
-- multi-page upload support existed (the `create table if not exists`
-- above won't add columns to an existing table):
--
-- alter table uploads add column if not exists pages_count integer not null default 1;
-- alter table uploads add column if not exists updated_at timestamptz not null default now();
--
-- Run against a database that already has a `users` table from before the
-- study guide / test prep language preference existed:
--
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS language_preference text default 'English';
--
-- Run against a database that already has a `users` table from before the
-- selectable theme system existed:
--
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_preference text default 'default';
--
-- Run against a database that already has forum_threads/forum_replies from
-- before author edit/soft-delete existed:
--
-- ALTER TABLE forum_threads ADD COLUMN IF NOT EXISTS edited_at timestamptz;
-- ALTER TABLE forum_threads ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
-- ALTER TABLE forum_replies ADD COLUMN IF NOT EXISTS edited_at timestamptz;
-- ALTER TABLE forum_replies ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
--
-- Run against a database that already has message_reports from before
-- AI safety screening existed:
--
-- ALTER TABLE message_reports ALTER COLUMN reporter_id DROP NOT NULL;
-- ALTER TABLE message_reports ADD COLUMN IF NOT EXISTS source text not null default 'user' check (source in ('user', 'ai'));
-- ALTER TABLE message_reports ADD COLUMN IF NOT EXISTS category text check (category in ('self_harm', 'sexual_content_minors', 'threats'));
--
-- Run against a database that already has conversations from before the
-- "currently viewing" presence signal existed:
--
-- ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_a_last_viewed_at timestamptz;
-- ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_b_last_viewed_at timestamptz;
