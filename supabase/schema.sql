-- Zyndal Supabase schema.
-- Run this once in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/rvflvijyyppbtgcnnsyr/sql/new

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password text not null,
  account_type text not null check (account_type in ('student', 'parent')),
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
  is_premium boolean not null default false
);

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
  created_at timestamptz not null default now()
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
