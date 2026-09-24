export type EventStatus = 'WAITING' | 'LIVE' | 'PAUSED' | 'COMPLETED';

export interface QuizEvent {
  id: string;
  name: string;
  game_pin: string;
  status: EventStatus;
  current_question_index: number;
  total_questions: number;
  question_time_limit: number;
  question_started_at: string | null;
  question_deadline: string | null;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  reveal_answer_immediately: boolean;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  topic: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  time_limit: number;
  explanation: string;
  created_at?: string;
}

export interface EventQuestion {
  id: string;
  event_id: string;
  question_id: string;
  question_order: number;
  question?: Question;
}

export interface Participant {
  id: string;
  event_id: string;
  display_name: string;
  session_token: string;
  total_score: number;
  correct_count: number;
  joined_at: string;
  last_seen_at: string;
  status: string;
  disqualification_reason?: string | null;
  disqualified_at?: string | null;
  rank?: number;
  average_response_time_ms?: number;
}

export interface AnswerSubmission {
  id: string;
  event_id: string;
  participant_id: string;
  question_id: string;
  selected_option: 'A' | 'B' | 'C' | 'D';
  is_correct: boolean;
  score: number;
  submitted_at: string;
  response_time_ms: number;
}

export interface AnswerResult {
  success: boolean;
  is_correct: boolean;
  score_awarded: number;
  base_score: number;
  time_bonus: number;
  total_score: number;
  correct_count: number;
  response_time_ms: number;
}

export interface JoinResult {
  status: 'JOINED' | 'RECONNECTED';
  participant: Participant;
  event: QuizEvent;
}
