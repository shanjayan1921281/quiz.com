-- ==============================================================
-- LIVEQUIZ PRO — POSTGRESQL PRODUCTION DATABASE SCHEMA
-- Target: PostgreSQL on Railway / Docker / Local
-- Optimized for 200+ concurrent live participants
-- ==============================================================

-- Enable UUID extension if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ADMINS TABLE
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. EVENTS TABLE
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  quiz_name VARCHAR(255) NOT NULL DEFAULT 'College Technical Challenge',
  game_pin VARCHAR(10) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'WAITING', -- WAITING, LIVE, PAUSED, COMPLETED
  current_question_index INT NOT NULL DEFAULT 0,
  total_questions INT NOT NULL DEFAULT 200,
  question_time_limit INT NOT NULL DEFAULT 30,
  question_started_at TIMESTAMPTZ,
  question_deadline TIMESTAMPTZ,
  shuffle_questions BOOLEAN NOT NULL DEFAULT TRUE,
  shuffle_options BOOLEAN NOT NULL DEFAULT FALSE,
  reveal_answer_immediately BOOLEAN NOT NULL DEFAULT TRUE,
  allow_late_join BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. QUESTIONS TABLE
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option CHAR(1) NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
  topic VARCHAR(100) NOT NULL DEFAULT 'General',
  difficulty VARCHAR(20) NOT NULL DEFAULT 'Medium' CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  time_limit INT NOT NULL DEFAULT 30,
  explanation TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. EVENT_QUESTIONS TABLE
CREATE TABLE IF NOT EXISTS event_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  question_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_event_question_order UNIQUE (event_id, question_order),
  CONSTRAINT uq_event_question_id UNIQUE (event_id, question_id)
);

-- 5. PARTICIPANTS TABLE
CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  display_name VARCHAR(60) NOT NULL,
  session_token_hash VARCHAR(128) NOT NULL,
  total_score INT NOT NULL DEFAULT 0,
  correct_count INT NOT NULL DEFAULT 0,
  total_response_time_ms BIGINT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, DISCONNECTED, DISQUALIFIED
  disqualification_reason TEXT DEFAULT NULL,
  disqualified_at TIMESTAMPTZ DEFAULT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_event_participant_name UNIQUE (event_id, display_name)
);

-- 6. ANSWERS TABLE
CREATE TABLE IF NOT EXISTS answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_option CHAR(1) NOT NULL CHECK (selected_option IN ('A', 'B', 'C', 'D')),
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  score INT NOT NULL DEFAULT 0,
  response_time_ms INT NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- CRITICAL: Prevent duplicate answers at database level
  CONSTRAINT uq_participant_question_answer UNIQUE (event_id, participant_id, question_id)
);

-- 7. EVENT_LOGS TABLE
CREATE TABLE IF NOT EXISTS event_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================
-- DATABASE INDEXES (Crucial for 200+ concurrent participant queries)
-- ==============================================================
CREATE INDEX IF NOT EXISTS idx_events_game_pin ON events(game_pin);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

CREATE INDEX IF NOT EXISTS idx_event_questions_event_id ON event_questions(event_id);
CREATE INDEX IF NOT EXISTS idx_event_questions_order ON event_questions(event_id, question_order);

CREATE INDEX IF NOT EXISTS idx_participants_event_id ON participants(event_id);
CREATE INDEX IF NOT EXISTS idx_participants_event_score ON participants(event_id, total_score DESC, correct_count DESC, total_response_time_ms ASC);
CREATE INDEX IF NOT EXISTS idx_participants_token ON participants(session_token_hash);

CREATE INDEX IF NOT EXISTS idx_answers_event_id ON answers(event_id);
CREATE INDEX IF NOT EXISTS idx_answers_participant_id ON answers(participant_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_event_question ON answers(event_id, question_id);

ALTER TABLE participants ADD COLUMN IF NOT EXISTS disqualification_reason TEXT DEFAULT NULL;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS disqualified_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_event_logs_event_id ON event_logs(event_id);
