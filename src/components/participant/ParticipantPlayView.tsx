import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  Lock,
  LogOut,
  Sparkles,
  HelpCircle,
  Radio,
  FileCheck2,
  AlertCircle
} from 'lucide-react';
import { useEventSync } from '../../hooks/useEventSync';
import { api } from '../../services/api';
import { clearParticipantSession } from '../../lib/session';
import { AnswerResult, Participant } from '../../types/quiz';
import { QUESTIONS_200 } from '../../data/questions200';

interface ParticipantPlayViewProps {
  eventId: string;
  participantId: string;
  sessionToken: string;
  displayName: string;
  onLeave: () => void;
}

export const ParticipantPlayView: React.FC<ParticipantPlayViewProps> = ({
  eventId,
  participantId,
  sessionToken,
  displayName,
  onLeave,
}) => {
  const {
    event,
    participants,
    currentQuestion,
    connectionStatus,
    remainingSeconds,
    remainingProgress,
    isTimeExpired,
  } = useEventSync(eventId, participantId, 'PARTICIPANT');

  const [selectedOption, setSelectedOption] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<AnswerResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastQuestionIndex, setLastQuestionIndex] = useState<number | null>(null);

  // Resolve active question data: handles direct question object, wrapped { question: ... }, or instantaneous 200-question pool fallback
  const qData = currentQuestion?.question_text
    ? currentQuestion
    : currentQuestion?.question || (
        event && event.current_question_index > 0
          ? QUESTIONS_200[(event.current_question_index - 1) % QUESTIONS_200.length]
          : null
      );
  const qId = qData?.id || currentQuestion?.id || currentQuestion?.question_id;

  // Anti-cheat disqualification state
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [disqualificationReason, setDisqualificationReason] = useState<string | null>(null);
  const hasTriggeredDisqualification = useRef(false);

  // Check if participant record from server indicates disqualification
  const me = participants.find((p) => p.id === participantId) || null;
  useEffect(() => {
    if (me?.status === 'DISQUALIFIED' && !isDisqualified) {
      setIsDisqualified(true);
      setDisqualificationReason(me.disqualification_reason || 'Examination rule violation: Tab switch detected');
      clearParticipantSession();
    }
  }, [me?.status, me?.disqualification_reason, isDisqualified]);

  // Handle Tab-Switch or Window Blur Disqualification
  const triggerDisqualification = async (reason: string) => {
    if (hasTriggeredDisqualification.current || isDisqualified) return;
    hasTriggeredDisqualification.current = true;

    setIsDisqualified(true);
    setDisqualificationReason(reason);

    // 1. Invalidate and clear local session immediately (Student is logged out)
    clearParticipantSession();

    // 2. Notify backend server to record disqualification permanently in database
    try {
      await api.disqualifyParticipant(eventId, participantId, sessionToken, reason);
    } catch (err) {
      console.error('Failed to notify backend of tab switch violation:', err);
    }
  };

  // Attach Visibility and Blur Listeners when test is LIVE
  useEffect(() => {
    if (!event || event.status !== 'LIVE' || isDisqualified) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden || document.visibilityState === 'hidden') {
        triggerDisqualification(
          'Tab switch detected during active examination. As per examination rules, switching tabs instantly fails the test.'
        );
      }
    };

    const handleWindowBlur = () => {
      // Blur indicates switching to another application or window
      triggerDisqualification(
        'Window departure or tab switch detected during active examination.'
      );
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [event?.status, eventId, participantId, sessionToken, isDisqualified]);

  // When question index changes, reset question state and check previous answer
  useEffect(() => {
    if (!event) return;

    if (event.current_question_index !== lastQuestionIndex) {
      setLastQuestionIndex(event.current_question_index);
      setSelectedOption(null);
      setSubmissionResult(null);
      setErrorMessage(null);

      // Check if already answered in database (e.g. on page refresh mid-question)
      if (qId) {
        api.fetchParticipantAnswer(eventId, participantId, qId)
          .then((ans) => {
            if (ans) {
              setSelectedOption(ans.selected_option as any);
              setSubmissionResult({
                success: true,
                is_correct: ans.is_correct,
                score_awarded: ans.score,
                base_score: ans.is_correct ? 1000 : 0,
                time_bonus: ans.is_correct ? Math.max(0, ans.score - 1000) : 0,
                total_score: me?.total_score || 0,
                correct_count: me?.correct_count || 0,
                response_time_ms: ans.response_time_ms || 0,
              });
            }
          })
          .catch((err) => console.error('Failed to restore answer', err));
      }
    }
  }, [event?.current_question_index, currentQuestion]);

  const handleSelectOption = async (option: 'A' | 'B' | 'C' | 'D') => {
    if (isDisqualified) return;
    if (selectedOption || submitting || isTimeExpired || !qId || event?.status !== 'LIVE') {
      return;
    }

    setSelectedOption(option);
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await api.submitAnswer(
        participantId,
        sessionToken,
        eventId,
        qId,
        option
      );
      setSubmissionResult(result);
    } catch (err: any) {
      console.error('Answer submission failed', err);
      setErrorMessage(err.message || 'Submission error. Please check connection.');
      if (err.message && err.message.toLowerCase().includes('disqualified')) {
        setIsDisqualified(true);
        setDisqualificationReason(err.message);
        clearParticipantSession();
      }
    } finally {
      setSubmitting(false);
    }
  };

  // =========================================================================
  // VIEW 1: TEST FAILED & DISQUALIFIED (Immediate on tab switch or screen exit)
  // =========================================================================
  if (isDisqualified) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg rounded-3xl border-2 border-rose-600 bg-slate-950 p-8 shadow-2xl text-center relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-rose-600 via-red-500 to-rose-700 animate-pulse" />

          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-rose-600/20 border-2 border-rose-500/50 text-rose-500 shadow-xl shadow-rose-600/30">
            <ShieldAlert className="h-12 w-12" />
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-950 border border-rose-700/80 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-rose-300">
            Examination Terminated
          </span>

          <h1 className="mt-4 text-3xl sm:text-4xl font-black text-rose-400 tracking-tight">
            TEST FAILED & DISQUALIFIED
          </h1>

          <div className="mt-4 rounded-2xl border border-rose-800/60 bg-rose-950/40 p-4 text-left text-xs sm:text-sm text-rose-200">
            <p className="font-bold text-rose-300 mb-1">Violation Reason:</p>
            <p className="font-mono text-xs text-rose-200 leading-relaxed">
              {disqualificationReason || 'Tab switch or window departure detected while the test was in progress.'}
            </p>
          </div>

          <div className="mt-6 space-y-2 text-xs text-slate-400 text-left bg-slate-900/80 rounded-2xl p-4 border border-slate-800">
            <p className="flex items-center gap-2 text-slate-300 font-semibold">
              <AlertCircle className="h-4 w-4 text-rose-400" />
              <span>Examination Policy Enforcement</span>
            </p>
            <p>• As per instructions, students are strictly prohibited from switching tabs or leaving the screen.</p>
            <p>• Your test attempt has been marked as failed and submitted to the evaluation records.</p>
            <p>• You have been logged out of this test session and cannot re-enter.</p>
          </div>

          <button
            type="button"
            onClick={onLeave}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-5 py-3.5 text-sm font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
          >
            <LogOut className="h-4 w-4" />
            <span>Exit Examination Portal</span>
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: WAITING ROOM (Privacy preserved: only student attends their question)
  // =========================================================================
  if (!event || event.status === 'WAITING') {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-8 text-center">
        <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl">
          {/* Animated Waiting Radar */}
          <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
            <span className="relative flex h-8 w-8">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-8 w-8 bg-indigo-500"></span>
            </span>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300">
            <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
            Connected to Examination Server
          </span>

          <h2 className="mt-3 text-2xl sm:text-3xl font-black text-white">
            Examination Waiting Room
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Welcome, <span className="font-bold text-white">{displayName}</span>. The organizer has not started the test yet.
          </p>

          {/* Student Isolated Info Box */}
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-left">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Your Examination Details
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Student Name:</span>
                <span className="font-bold text-white">{displayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Quiz Event:</span>
                <span className="font-medium text-slate-200">{event?.name || 'College Technical Championship'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="text-emerald-400 font-semibold">Ready to Attend</span>
              </div>
            </div>
          </div>

          {/* Strict Anti-Cheat Instructions */}
          <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 text-left text-xs text-amber-200/90 space-y-1.5">
            <p className="font-bold text-amber-300 flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-amber-400" />
              <span>Anti-Cheating Rules — Read Carefully:</span>
            </p>
            <p>1. Attend each question individually. Questions will advance in real-time.</p>
            <p>2. <strong>DO NOT SWITCH TABS</strong> or minimize this window once the test starts.</p>
            <p>3. If a tab switch is detected, <strong>your test will instantly fail and you will be logged out</strong>.</p>
          </div>

          <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
            <span>PIN: <strong className="font-mono text-indigo-400">{event?.game_pin}</strong></span>
            <button
              onClick={onLeave}
              className="text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Exit Room</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: PAUSED VIEW
  // =========================================================================
  if (event.status === 'PAUSED') {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-8 text-center">
        <div className="w-full max-w-md rounded-3xl border border-amber-500/30 bg-slate-900/95 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-black text-white">Test Paused by Host</h2>
          <p className="mt-2 text-sm text-slate-300">
            The administrator has temporarily paused the quiz. The live timer is frozen and will resume shortly.
          </p>
          <div className="mt-4 text-xs text-amber-300/80">
            Please remain on this tab. Do not switch tabs while paused.
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 4: COMPLETED VIEW (Student alone, no competitor details leaked)
  // =========================================================================
  if (event.status === 'COMPLETED') {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 shadow-xl shadow-emerald-500/20">
            <FileCheck2 className="h-10 w-10" />
          </div>

          <h2 className="text-3xl font-black tracking-tight text-white">Test Completed!</h2>
          <p className="mt-1 text-sm text-slate-400">
            Thank you, <span className="font-bold text-white">{displayName}</span>.
          </p>

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center space-y-3">
            <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">
              Submission Receipt
            </p>
            <p className="text-sm text-slate-300">
              Your answers have been securely recorded by the examination evaluation engine.
            </p>
            <div className="border-t border-slate-800 pt-3 text-xs text-slate-400">
              Official scores and rankings will be published by the event coordinator.
            </div>
          </div>

          <button
            onClick={onLeave}
            className="mt-6 w-full rounded-xl bg-slate-800 border border-slate-700 py-3.5 text-sm font-bold text-white hover:bg-slate-700 transition-colors"
          >
            Log Out & Exit Examination
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 5: LIVE QUESTION VIEW (Student attends the question alone)
  // =========================================================================
  const isQuestionAnswered = selectedOption !== null;

  const optionCards = [
    { key: 'A' as const, label: qData?.option_a || '', color: 'rose' },
    { key: 'B' as const, label: qData?.option_b || '', color: 'amber' },
    { key: 'C' as const, label: qData?.option_c || '', color: 'emerald' },
    { key: 'D' as const, label: qData?.option_d || '', color: 'sky' },
  ];

  const getOptionClasses = (key: 'A' | 'B' | 'C' | 'D') => {
    const isSelected = selectedOption === key;

    if (isSelected) {
      return 'border-indigo-400 bg-indigo-950 text-white ring-2 ring-indigo-400 scale-[1.01] shadow-lg shadow-indigo-500/25';
    }

    if (isQuestionAnswered || isTimeExpired) {
      return 'border-slate-800 bg-slate-900/40 text-slate-500 opacity-60 cursor-not-allowed';
    }

    return 'border-slate-800 bg-slate-900/90 hover:bg-slate-800/90 text-slate-100 hover:border-indigo-500/60 active:scale-[0.98] transition-all';
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl flex-col justify-between px-4 py-4 sm:py-6">
      {/* Top Bar: Progress, Question Counter & Anti-Cheat Status */}
      <div className="space-y-3">
        {/* Anti-cheat status banner */}
        <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="font-semibold">Anti-Cheat Active:</span>
            <span className="text-amber-200/90 hidden sm:inline">Do not switch tabs or test will fail.</span>
          </div>
          <span className="text-[11px] font-mono bg-amber-950 border border-amber-800 px-2 py-0.5 rounded text-amber-300 font-bold">
            PROCTORED
          </span>
        </div>

        {/* Question Counter & Timer */}
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-indigo-950 border border-indigo-800/80 px-2.5 py-1 font-mono text-indigo-300">
              Question {event.current_question_index} of {event.total_questions}
            </span>
            {qData?.topic && (
              <span className="rounded-md bg-slate-800 px-2.5 py-1 text-slate-300">
                {qData.topic}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Clock className={`h-4 w-4 ${remainingSeconds <= 5 ? 'text-rose-400 animate-spin' : 'text-indigo-400'}`} />
            <span
              className={`font-mono text-base font-black ${
                remainingSeconds <= 5 ? 'text-rose-400 animate-pulse' : 'text-white'
              }`}
            >
              {remainingSeconds}s
            </span>
          </div>
        </div>

        {/* Live Synchronized Progress Bar */}
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full transition-all duration-100 ease-linear ${
              remainingSeconds <= 5
                ? 'bg-rose-500 animate-pulse'
                : remainingSeconds <= 10
                ? 'bg-amber-400'
                : 'bg-indigo-500'
            }`}
            style={{ width: `${remainingProgress}%` }}
          />
        </div>
      </div>

      {/* Question Card (Student attends question alone) */}
      <div className="my-6 rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <h2 className="text-xl sm:text-2xl font-extrabold leading-snug text-white">
          {qData?.question_text || 'Loading Question...'}
        </h2>
      </div>

      {/* Answer Options Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-6">
        {optionCards.map((opt) => (
          <button
            key={opt.key}
            onClick={() => handleSelectOption(opt.key)}
            disabled={isQuestionAnswered || isTimeExpired || submitting}
            className={`flex items-center gap-4 rounded-2xl border p-4 sm:p-5 text-left font-medium shadow-md ${getOptionClasses(
              opt.key
            )}`}
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-mono text-base font-black ${
                selectedOption === opt.key
                  ? 'bg-white text-indigo-950 shadow-md'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {opt.key}
            </div>
            <span className="text-sm sm:text-base leading-relaxed">{opt.label}</span>
          </button>
        ))}
      </div>

      {/* Bottom Status Notification */}
      <div className="text-center">
        {isQuestionAnswered ? (
          <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-950/80 border border-emerald-500/40 px-4 py-2.5 text-xs sm:text-sm font-semibold text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            <span>Response recorded! Waiting for next question from host...</span>
          </div>
        ) : isTimeExpired ? (
          <div className="inline-flex items-center gap-2 rounded-xl bg-rose-950/80 border border-rose-500/40 px-4 py-2.5 text-xs sm:text-sm font-semibold text-rose-300">
            <Clock className="h-4 w-4" />
            <span>Time expired for this question. Awaiting next question...</span>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Tap an option to record your answer. Single submission per question.
          </p>
        )}
      </div>
    </div>
  );
};
