import React, { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Eye,
  EyeOff,
  Trophy,
  Users,
  Maximize2,
  Clock,
  CheckCircle,
  Flag,
  Radio,
  HelpCircle,
  Volume2,
  VolumeX,
  AlertCircle
} from 'lucide-react';
import { useEventSync } from '../../hooks/useEventSync';
import { api } from '../../services/api';
import { socket } from '../../services/socket';
import { QuizEvent, EventQuestion } from '../../types/quiz';
import { QUESTIONS_200 } from '../../data/questions200';

interface ProjectorViewProps {
  eventId: string;
  onNavigateToLeaderboard: () => void;
}

export const ProjectorView: React.FC<ProjectorViewProps> = ({
  eventId,
  onNavigateToLeaderboard,
}) => {
  const {
    event,
    participants,
    currentQuestion,
    connectionStatus,
    remainingSeconds,
    remainingProgress,
    isTimeExpired,
    refreshState,
  } = useEventSync(eventId, undefined, 'PROJECTOR');

  const [revealAnswer, setRevealAnswer] = useState(false);
  const [answeredCount, setAnsweredCount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Sync answered count via WebSocket
  useEffect(() => {
    setAnsweredCount(0);
    const unsub = socket.on('ANSWER_RECEIVED', (payload) => {
      if (payload && typeof payload.answeredCount === 'number') {
        setAnsweredCount(payload.answeredCount);
      }
    });
    return unsub;
  }, [eventId, currentQuestion]);

  // Reset reveal when question changes
  useEffect(() => {
    setRevealAnswer(false);
    setActionError(null);
  }, [event?.current_question_index]);

  const handleStartQuiz = async () => {
    if (!event || isProcessing) return;
    setIsProcessing(true);
    setActionError(null);
    try {
      await api.advanceQuestion(eventId, 1, event.question_time_limit || 30);
      await refreshState();
    } catch (err: any) {
      console.error('Failed to start quiz', err);
      setActionError(err.message || 'Failed to start quiz. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNextQuestion = async () => {
    if (!event || isProcessing) return;
    const nextIndex = (event.current_question_index || 0) + 1;
    if (nextIndex > event.total_questions) {
      setShowEndModal(true);
      return;
    }
    setIsProcessing(true);
    setActionError(null);
    try {
      await api.advanceQuestion(eventId, nextIndex, event.question_time_limit || 30);
      await refreshState();
    } catch (err: any) {
      console.error('Failed to advance question', err);
      setActionError(err.message || 'Failed to advance question.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePreviousQuestion = async () => {
    if (!event || isProcessing || event.current_question_index <= 1) return;
    setIsProcessing(true);
    setActionError(null);
    try {
      await api.advanceQuestion(eventId, event.current_question_index - 1, event.question_time_limit || 30);
      await refreshState();
    } catch (err: any) {
      console.error('Failed to go to previous question', err);
      setActionError(err.message || 'Failed to go to previous question.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTogglePause = async () => {
    if (!event || isProcessing) return;
    setIsProcessing(true);
    setActionError(null);
    try {
      const newStatus = event.status === 'LIVE' ? 'PAUSED' : 'LIVE';
      await api.setEventStatus(eventId, newStatus);
      await refreshState();
    } catch (err: any) {
      console.error('Failed to toggle pause', err);
      setActionError(err.message || 'Failed to toggle pause status.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestartTimer = async () => {
    if (!event || isProcessing) return;
    setIsProcessing(true);
    setActionError(null);
    try {
      await api.restartTimer(eventId, event.question_time_limit || 30);
      await refreshState();
    } catch (err: any) {
      console.error('Failed to restart timer', err);
      setActionError(err.message || 'Failed to restart timer.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEndQuiz = async () => {
    if (!event || isProcessing) return;
    setIsProcessing(true);
    try {
      await api.setEventStatus(eventId, 'COMPLETED');
      setShowEndModal(false);
      onNavigateToLeaderboard();
    } catch (err) {
      console.error('Failed to end quiz', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Keyboard shortcut listener (Space = Next, P = Pause, R = Restart timer)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space' || e.code === 'ArrowRight') {
        e.preventDefault();
        handleNextQuestion();
      } else if (e.code === 'KeyP') {
        e.preventDefault();
        handleTogglePause();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        setRevealAnswer(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [event?.current_question_index, event?.status, isProcessing]);

  const fallbackQ = (event && event.current_question_index > 0)
    ? QUESTIONS_200[(event.current_question_index - 1) % QUESTIONS_200.length]
    : null;

  const qData = currentQuestion?.question_text
    ? currentQuestion
    : currentQuestion?.question || fallbackQ;

  const correctOption = qData?.correct_option || fallbackQ?.correct_option;
  const explanationText = qData?.explanation || fallbackQ?.explanation;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col justify-between bg-slate-950 p-4 sm:p-6 lg:p-8">
      {/* 1. Projector Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-800 px-4 py-2">
            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">GAME PIN:</span>
            <span className="font-mono text-2xl font-black tracking-widest text-indigo-400">
              {event?.game_pin || '------'}
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-800 px-4 py-2">
            <Users className="h-5 w-5 text-indigo-400" />
            <span className="text-sm font-semibold text-slate-300">
              <span className="font-bold text-white text-base">{participants.length}</span> Joined
            </span>
          </div>

          {event?.status === 'LIVE' && (
            <div className="flex items-center gap-2 rounded-xl bg-indigo-950/60 border border-indigo-500/30 px-4 py-2">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              <span className="text-sm font-semibold text-slate-300">
                <span className="font-bold text-emerald-400 text-base">{answeredCount}</span> / {participants.length} answered
              </span>
            </div>
          )}
        </div>

        {/* Status Pill & Action Buttons */}
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
              event?.status === 'LIVE'
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                : event?.status === 'PAUSED'
                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                : event?.status === 'COMPLETED'
                ? 'bg-slate-800 text-slate-300'
                : 'bg-indigo-950 text-indigo-400 border border-indigo-800'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
            {event?.status || 'WAITING'}
          </span>

          <button
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
            className="rounded-lg bg-slate-900 border border-slate-800 p-2 text-slate-400 hover:text-white transition-colors"
          >
            <Maximize2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {actionError && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-xs text-rose-400 hover:text-rose-200 underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Main Stage */}
      {event?.status === 'WAITING' ? (
        <div className="my-auto flex flex-col items-center justify-center text-center py-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-950/50 px-5 py-2 text-sm font-semibold text-indigo-300">
            <Radio className="h-4 w-4 animate-pulse text-indigo-400" />
            AUDITORIUM PROJECTOR STAGE
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white max-w-3xl">
            {event.name}
          </h1>
          <p className="mt-4 text-xl text-slate-300 max-w-xl">
            Join on your smartphone by visiting this URL and entering Game PIN:
          </p>

          <div className="my-8 rounded-3xl border-2 border-indigo-500/50 bg-slate-900 p-8 shadow-2xl shadow-indigo-500/10">
            <p className="text-sm font-bold tracking-widest text-slate-400 uppercase">GAME PIN</p>
            <p className="mt-2 font-mono text-6xl sm:text-7xl font-black tracking-widest text-indigo-400">
              {event.game_pin}
            </p>
          </div>

          <div className="flex items-center gap-3 text-lg font-medium text-slate-400">
            <Users className="h-6 w-6 text-indigo-400" />
            <span>
              <span className="font-bold text-white">{participants.length}</span> students connected in waiting room
            </span>
          </div>

          <button
            onClick={handleStartQuiz}
            disabled={isProcessing}
            className="mt-8 inline-flex items-center gap-3 rounded-2xl bg-indigo-600 px-8 py-4 text-xl font-bold text-white shadow-xl shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 transition-all"
          >
            <Play className="h-6 w-6 fill-current" />
            Launch Competition
          </button>
        </div>
      ) : (
        <div className="my-auto flex flex-col justify-center py-6">
          {/* Question Index & Big Timer Display */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-slate-900 border border-slate-800 px-4 py-2 font-mono text-xl font-black text-indigo-300">
                QUESTION {event?.current_question_index} / {event?.total_questions}
              </span>
              {qData?.topic && (
                <span className="rounded-xl bg-slate-800 px-3.5 py-1.5 text-sm font-semibold text-slate-300">
                  {qData.topic}
                </span>
              )}
              {qData?.difficulty && (
                <span className="rounded-xl bg-slate-800 px-3.5 py-1.5 text-sm font-semibold text-slate-300">
                  {qData.difficulty}
                </span>
              )}
            </div>

            {/* Huge Circular / Badge Countdown Timer */}
            <div className="flex items-center gap-3">
              <div
                className={`flex items-center gap-3 rounded-2xl border-2 px-6 py-2.5 font-mono text-3xl font-black transition-colors ${
                  remainingSeconds <= 5
                    ? 'border-rose-500 bg-rose-950 text-rose-300 animate-pulse'
                    : remainingSeconds <= 10
                    ? 'border-amber-500 bg-amber-950 text-amber-300'
                    : 'border-indigo-500/50 bg-slate-900 text-white'
                }`}
              >
                <Clock className="h-7 w-7 text-indigo-400" />
                <span>{isTimeExpired ? '0s' : `${remainingSeconds}s`}</span>
              </div>
            </div>
          </div>

          {/* Massive Question Box */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-8 sm:p-12 shadow-2xl backdrop-blur-xl text-center">
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold leading-tight text-white">
              {qData?.question_text || 'Loading Question...'}
            </h2>
          </div>

          {/* 4 Huge Colored Option Panels */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-6">
            {[
              { key: 'A', text: qData?.option_a, color: 'rose', bg: 'bg-rose-950/40', border: 'border-rose-800', badgeBg: 'bg-rose-600' },
              { key: 'B', text: qData?.option_b, color: 'amber', bg: 'bg-amber-950/40', border: 'border-amber-800', badgeBg: 'bg-amber-600' },
              { key: 'C', text: qData?.option_c, color: 'emerald', bg: 'bg-emerald-950/40', border: 'border-emerald-800', badgeBg: 'bg-emerald-600' },
              { key: 'D', text: qData?.option_d, color: 'sky', bg: 'bg-sky-950/40', border: 'border-sky-800', badgeBg: 'bg-sky-600' },
            ].map((opt) => {
              const isCorrectAnswer = revealAnswer && opt.key === correctOption;
              return (
                <div
                  key={opt.key}
                  className={`flex min-h-[96px] items-center gap-5 rounded-2xl border-2 p-5 transition-all ${
                    isCorrectAnswer
                      ? 'border-emerald-400 bg-emerald-950/90 text-white ring-4 ring-emerald-400/30 scale-[1.02]'
                      : revealAnswer
                      ? 'border-slate-800 bg-slate-900/40 opacity-40 text-slate-400'
                      : `${opt.border} ${opt.bg} text-white`
                  }`}
                >
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl font-black text-white shadow-lg ${
                      isCorrectAnswer ? 'bg-emerald-500' : opt.badgeBg
                    }`}
                  >
                    {opt.key}
                  </div>
                  <div className="flex-1">
                    <p className="text-xl sm:text-2xl font-bold leading-snug">
                      {opt.text}
                    </p>
                  </div>
                  {isCorrectAnswer && (
                    <CheckCircle className="h-8 w-8 text-emerald-400 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Explanation Banner when answer revealed */}
          {revealAnswer && explanationText && (
            <div className="mt-6 rounded-2xl border border-indigo-500/30 bg-indigo-950/50 p-4 text-sm text-indigo-200">
              <span className="font-bold text-white">Explanation: </span>
              {explanationText}
            </div>
          )}
        </div>
      )}

      {/* 3. Host Floating Control Toolbar */}
      <div className="sticky bottom-0 z-30 mt-6 rounded-2xl border border-slate-800 bg-slate-900/95 p-3.5 shadow-2xl backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreviousQuestion}
              disabled={isProcessing || !event || event.current_question_index <= 1}
              className="rounded-xl bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            >
              Prev
            </button>

            <button
              onClick={handleTogglePause}
              disabled={isProcessing || !event || event.status === 'WAITING'}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
            >
              {event?.status === 'PAUSED' ? <Play className="h-4 w-4 text-emerald-400" /> : <Pause className="h-4 w-4 text-amber-400" />}
              <span>{event?.status === 'PAUSED' ? 'Resume Quiz' : 'Pause'}</span>
            </button>

            <button
              onClick={handleRestartTimer}
              disabled={isProcessing || !event || event.status !== 'LIVE'}
              title="Reset 30s timer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4 text-indigo-400" />
              <span>Reset Timer</span>
            </button>

            <button
              onClick={() => setRevealAnswer(prev => !prev)}
              disabled={!qData}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                revealAnswer
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              {revealAnswer ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span>{revealAnswer ? 'Hide Answer' : 'Reveal Answer (R)'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onNavigateToLeaderboard}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
            >
              <Trophy className="h-4 w-4 text-amber-400" />
              <span>Leaderboard</span>
            </button>

            <button
              onClick={() => setShowEndModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-950/60 border border-rose-800/80 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-900"
            >
              <Flag className="h-4 w-4 text-rose-400" />
              <span>End Quiz</span>
            </button>

            <button
              onClick={handleNextQuestion}
              disabled={isProcessing || !event}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 disabled:opacity-50"
            >
              <span>Next Question</span>
              <SkipForward className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal to End Quiz */}
      {showEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 text-center">
            <Flag className="mx-auto mb-3 h-12 w-12 text-rose-400" />
            <h3 className="text-xl font-bold text-white">End Quiz Competition?</h3>
            <p className="mt-2 text-sm text-slate-400">
              This will complete the competition, lock all questions, and reveal the final podium to all participants.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => setShowEndModal(false)}
                className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleEndQuiz}
                disabled={isProcessing}
                className="rounded-xl bg-rose-600 px-5 py-2 text-sm font-bold text-white hover:bg-rose-500"
              >
                Yes, End Competition
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
