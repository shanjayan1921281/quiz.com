export interface ScoringInput {
  isCorrect: boolean;
  questionStartedAt: string | Date | null;
  questionDeadline: string | Date | null;
  submittedAt: string | Date;
  baseScore?: number;
  maxTimeBonus?: number;
  gracePeriodMs?: number;
}

export interface ScoringResult {
  isCorrect: boolean;
  score: number;
  baseScoreAwarded: number;
  timeBonusAwarded: number;
  responseTimeMs: number;
  isExpired: boolean;
}

export function calculateScore(input: ScoringInput): ScoringResult {
  const baseScore = input.baseScore ?? 1000;
  const maxTimeBonus = input.maxTimeBonus ?? 500;
  const gracePeriodMs = input.gracePeriodMs ?? 2000; // 2 seconds network jitter allowance

  const submittedMs = new Date(input.submittedAt).getTime();
  const startedMs = input.questionStartedAt ? new Date(input.questionStartedAt).getTime() : submittedMs;
  const deadlineMs = input.questionDeadline ? new Date(input.questionDeadline).getTime() : (startedMs + 30000);

  const responseTimeMs = Math.max(0, submittedMs - startedMs);

  // Check if expired past deadline + grace
  if (submittedMs > deadlineMs + gracePeriodMs) {
    return {
      isCorrect: false,
      score: 0,
      baseScoreAwarded: 0,
      timeBonusAwarded: 0,
      responseTimeMs,
      isExpired: true,
    };
  }

  if (!input.isCorrect) {
    return {
      isCorrect: false,
      score: 0,
      baseScoreAwarded: 0,
      timeBonusAwarded: 0,
      responseTimeMs,
      isExpired: false,
    };
  }

  const totalDurationMs = Math.max(1000, deadlineMs - startedMs);
  const remainingMs = deadlineMs - submittedMs;

  let timeBonus = 0;
  if (remainingMs > 0 && totalDurationMs > 0) {
    timeBonus = Math.floor(maxTimeBonus * (remainingMs / totalDurationMs));
    timeBonus = Math.max(0, Math.min(maxTimeBonus, timeBonus));
  }

  const totalScore = baseScore + timeBonus;

  return {
    isCorrect: true,
    score: totalScore,
    baseScoreAwarded: baseScore,
    timeBonusAwarded: timeBonus,
    responseTimeMs,
    isExpired: false,
  };
}
