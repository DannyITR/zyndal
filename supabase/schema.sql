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

-- oauth_identities is the one table created after Session 5's RLS rollout
-- (see api/_lib/auth.js) — every /api/* function already authenticates the
-- caller itself and uses the service-role key, which bypasses RLS
-- regardless, so this has no policies defined; enabling RLS here only
-- matters for blocking the anon key from reading it directly, matching
-- every other table's actual (if not accurately reflected below) state.
alter table oauth_identities enable row level security;

-- NOTE: the block below predates Session 5 and is stale — every table it
-- lists actually has RLS enabled in the live database today (see
-- api/_lib/auth.js's comment on the service-role client). Left as-is rather
-- than rewritten here since this file is a running log of statements to
-- run, not applied automatically; re-running "disable" on an
-- already-RLS-enabled table would be a real, destructive change and isn't
-- part of this feature.
-- No auth system yet, so RLS is off for all tables.
alter table users disable row level security;
alter table streaks disable row level security;
alter table answers disable row level security;
alter table parent_student disable row level security;
alter table payouts disable row level security;
alter table perfect_week_achievements disable row level security;
alter table friend_requests disable row level security;
alter table friends disable row level security;
alter table streak_shares disable row level security;
alter table uploads disable row level security;
alter table upload_questions disable row level security;
alter table grades disable row level security;
alter table grade_bonuses disable row level security;
alter table study_plans disable row level security;
alter table practice_sessions disable row level security;
alter table curriculum_outlines disable row level security;
alter table sessions disable row level security;

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
