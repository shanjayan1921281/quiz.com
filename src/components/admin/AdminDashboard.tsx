import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Plus,
  Tv,
  Users,
  Clock,
  Layers,
  Sparkles,
  Trophy,
  Copy,
  Check,
  Radio,
  RefreshCw,
  ExternalLink,
  Shield,
  HelpCircle,
  AlertCircle,
  ArrowRight,
  SkipForward
} from 'lucide-react';
import { api } from '../../services/api';
import { QUESTIONS_200 } from '../../data/questions200';
import { QuizEvent, Participant } from '../../types/quiz';

interface AdminDashboardProps {
  onLaunchProjector: (eventId: string) => void;
  onNavigateToQuestions: () => void;
  onNavigateToLeaderboard: (eventId: string) => void;
  activeEventId: string;
  setActiveEventId: (id: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onLaunchProjector,
  onNavigateToQuestions,
  onNavigateToLeaderboard,
  activeEventId,
  setActiveEventId,
}) => {
  const [event, setEvent] = useState<QuizEvent | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [questionCount, setQuestionCount] = useState<number>(200);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [dashboardMessage, setDashboardMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Event creation form modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [eventName, setEventName] = useState('College Technical Championship 2026');
  const [timeLimit, setTimeLimit] = useState(30);
  const [totalQuestions, setTotalQuestions] = useState(200);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [autoLaunchProjector, setAutoLaunchProjector] = useState(true);
  const [autoStartQuestion1, setAutoStartQuestion1] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [evData, qList] = await Promise.all([
        api.fetchEvent(activeEventId),
        api.fetchQuestions(),
      ]);

      if (evData) {
        setEvent(evData.event);
        const parts = await api.fetchParticipants(evData.event.id);
        setParticipants(parts);
      }
      setQuestionCount(qList.length || 200);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [activeEventId]);

  const handleCopyPin = () => {
    if (!event) return;
    navigator.clipboard.writeText(event.game_pin).then(() => {
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    });
  };

  const handleStartCompetition = async () => {
    const targetEventId = event?.id || activeEventId;
    if (!targetEventId || actionLoading) return;
    setActionLoading(true);
    setDashboardMessage(null);
    try {
      const res = await api.advanceQuestion(targetEventId, 1, event?.question_time_limit || 30);
      if (res && res.event) {
        setEvent(res.event);
      }
      setDashboardMessage({ text: 'Competition started! Question 1 is now live.', type: 'success' });
      await loadData();
    } catch (err: any) {
      console.error('Failed to start competition', err);
      setDashboardMessage({ text: err.message || 'Failed to start competition.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleNextQuestion = async () => {
    const targetEventId = event?.id || activeEventId;
    if (!targetEventId || !event || actionLoading) return;
    const nextIdx = (event.current_question_index || 0) + 1;
    setActionLoading(true);
    setDashboardMessage(null);
    try {
      const res = await api.advanceQuestion(targetEventId, nextIdx, event.question_time_limit || 30);
      if (res && res.event) {
        setEvent(res.event);
      }
      setDashboardMessage({ text: `Advanced to Question ${nextIdx}`, type: 'success' });
      await loadData();
    } catch (err: any) {
      console.error('Failed to advance question', err);
      setDashboardMessage({ text: err.message || 'Failed to advance question.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleTogglePause = async () => {
    const targetEventId = event?.id || activeEventId;
    if (!targetEventId || !event || actionLoading) return;
    setActionLoading(true);
    setDashboardMessage(null);
    try {
      const newStatus = event.status === 'LIVE' ? 'PAUSED' : 'LIVE';
      const updated = await api.setEventStatus(targetEventId, newStatus);
      if (updated) {
        setEvent(updated);
      }
      setDashboardMessage({ text: `Quiz status changed to ${newStatus}`, type: 'success' });
      await loadData();
    } catch (err: any) {
      console.error('Failed to toggle status', err);
      setDashboardMessage({ text: err.message || 'Failed to update status.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateNewEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setCreateError(null);
    try {
      const newEv = await api.createEvent(
        eventName.trim() || 'College Technical Championship 2026',
        timeLimit,
        totalQuestions,
        shuffleQuestions
      );
      setEvent(newEv);
      setActiveEventId(newEv.id);
      setShowCreateModal(false);

      if (autoStartQuestion1) {
        await api.advanceQuestion(newEv.id, 1, timeLimit);
      }

      if (autoLaunchProjector) {
        onLaunchProjector(newEv.id);
      } else {
        setDashboardMessage({
          text: `Event "${newEv.name}" created successfully with PIN ${newEv.game_pin}`,
          type: 'success',
        });
        await loadData();
      }
    } catch (err: any) {
      console.error('Failed to create new event', err);
      setCreateError(err.message || 'Failed to create new event. Please check inputs and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Dashboard Notification Banner */}
      {dashboardMessage && (
        <div
          className={`mb-6 flex items-center justify-between rounded-2xl border p-4 text-sm ${
            dashboardMessage.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {dashboardMessage.type === 'success' ? (
              <Check className="h-5 w-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
            )}
            <span>{dashboardMessage.text}</span>
          </div>
          <button
            onClick={() => setDashboardMessage(null)}
            className="text-xs underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-950 border border-indigo-800/80 px-2.5 py-0.5 text-xs font-semibold text-indigo-300">
              <Shield className="h-3.5 w-3.5" />
              Host Control Center
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Live Quiz Management
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Control the live auditorium competition, monitor 200+ participants, and synchronize questions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setCreateError(null);
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <Plus className="h-4 w-4 text-indigo-400" />
            <span>Create New Quiz Event</span>
          </button>

          {/* Quick Start/Control action right in header */}
          {event?.status === 'WAITING' && (
            <button
              onClick={handleStartCompetition}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition-all active:scale-95 disabled:opacity-50"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>{actionLoading ? 'Starting...' : 'Start Test (Q1)'}</span>
            </button>
          )}

          {event?.status === 'LIVE' && (
            <button
              onClick={handleNextQuestion}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition-all active:scale-95 disabled:opacity-50"
            >
              <SkipForward className="h-4 w-4" />
              <span>{actionLoading ? 'Loading...' : 'Next Question'}</span>
            </button>
          )}

          <button
            onClick={() => onLaunchProjector(event?.id || activeEventId)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all active:scale-95"
          >
            <Tv className="h-4 w-4" />
            <span>Open Projector Screen</span>
          </button>
        </div>
      </div>

      {/* Main KPI Stat Grid */}
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Game PIN Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>ACTIVE GAME PIN</span>
            <button
              onClick={handleCopyPin}
              title="Copy PIN"
              className="text-slate-400 hover:text-white"
            >
              {copiedPin ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-2 font-mono text-3xl font-black tracking-widest text-indigo-400">
            {event?.game_pin || '483921'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Display this PIN on the main auditorium screen
          </p>
        </div>

        {/* Participants Joined */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>CONNECTED STUDENTS</span>
            <Users className="h-4 w-4 text-indigo-400" />
          </div>
          <p className="mt-2 font-mono text-3xl font-black text-white">
            {participants.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Waiting room & active competitor count
          </p>
        </div>

        {/* Event Status */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>EVENT STATUS</span>
            <Radio className="h-4 w-4 text-indigo-400" />
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <span
              className={`h-3 w-3 rounded-full ${
                event?.status === 'LIVE'
                  ? 'bg-emerald-400 animate-pulse'
                  : event?.status === 'PAUSED'
                  ? 'bg-amber-400'
                  : 'bg-indigo-400'
              }`}
            />
            {event?.status || 'WAITING'}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono">
            Question {event?.current_question_index || 0} of {event?.total_questions || 200}
          </p>
        </div>

        {/* Question Bank Pool */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>QUESTION BANK</span>
            <Layers className="h-4 w-4 text-indigo-400" />
          </div>
          <p className="mt-2 font-mono text-3xl font-black text-white">
            {questionCount}
          </p>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-slate-500">Total technical questions</span>
            <button
              onClick={onNavigateToQuestions}
              className="font-semibold text-indigo-400 hover:text-indigo-300"
            >
              Manage &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Quick Launch Control Banner */}
      <div className="mt-8 rounded-3xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-900 p-6 sm:p-8 backdrop-blur-xl">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-300 border border-indigo-500/30">
                ACTIVE EVENT: {event?.name || 'College Technical Championship 2026'}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  event?.status === 'LIVE'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : event?.status === 'PAUSED'
                    ? 'bg-amber-950 text-amber-400 border border-amber-800'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {event?.status || 'WAITING'}
              </span>
            </div>
            <h2 className="mt-3 text-2xl font-extrabold text-white">
              {event?.status === 'WAITING'
                ? 'Ready to launch and present to the auditorium?'
                : event?.status === 'LIVE'
                ? `Competition is LIVE — Question ${event?.current_question_index || 0} of ${event?.total_questions || 200}`
                : 'Competition Paused'}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-slate-300">
              Students join with PIN <span className="font-mono font-bold text-indigo-300">{event?.game_pin || '483921'}</span>. Use controls below to advance live questions or broadcast on the stage screen.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {event?.status === 'WAITING' && (
              <button
                onClick={handleStartCompetition}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-emerald-600/30 hover:bg-emerald-500 transition-all active:scale-95 disabled:opacity-50"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>{actionLoading ? 'Starting...' : 'Start Test Now'}</span>
              </button>
            )}

            {event?.status === 'LIVE' && (
              <>
                <button
                  onClick={handleNextQuestion}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-xl shadow-emerald-600/30 hover:bg-emerald-500 transition-all active:scale-95 disabled:opacity-50"
                >
                  <SkipForward className="h-4 w-4" />
                  <span>{actionLoading ? 'Advancing...' : 'Next Question'}</span>
                </button>
                <button
                  onClick={handleTogglePause}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-600/20 hover:bg-amber-500 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Pause className="h-4 w-4" />
                  <span>Pause</span>
                </button>
              </>
            )}

            {event?.status === 'PAUSED' && (
              <button
                onClick={handleTogglePause}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-xl shadow-emerald-600/30 hover:bg-emerald-500 transition-all active:scale-95 disabled:opacity-50"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Resume Quiz</span>
              </button>
            )}

            <button
              onClick={() => onNavigateToLeaderboard(event?.id || activeEventId)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <Trophy className="h-4 w-4 text-amber-400" />
              <span>Leaderboard</span>
            </button>

            <button
              onClick={() => onLaunchProjector(event?.id || activeEventId)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-xl shadow-indigo-600/30 hover:bg-indigo-500 transition-all active:scale-95"
            >
              <Tv className="h-4 w-4" />
              <span>Launch Projector</span>
            </button>
          </div>
        </div>
      </div>

      {/* Participants Live List */}
      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white">Connected Participants</h3>
            <p className="text-xs text-slate-400">
              Live updates when students join from mobile devices
            </p>
          </div>
          <span className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-mono font-bold text-slate-300">
            {participants.length} Active
          </span>
        </div>

        {participants.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Users className="mx-auto mb-2 h-8 w-8 text-slate-600" />
            <p className="text-sm">No participants in the waiting room yet.</p>
            <p className="mt-1 text-xs text-slate-600">
              Students can join by visiting the app and entering PIN {event?.game_pin || '483921'}.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 max-h-64 overflow-y-auto custom-scrollbar p-1">
            {participants.map((p, idx) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-200"
              >
                <div className="truncate pr-2">
                  <span className="font-mono text-slate-500 mr-1.5">#{idx + 1}</span>
                  <span className="font-semibold text-white truncate">{p.display_name}</span>
                </div>
                <span className="font-mono font-bold text-indigo-400 shrink-0">
                  {p.total_score}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Create New Quiz Event</h2>
              <span className="text-xs bg-indigo-950 border border-indigo-800/80 text-indigo-300 px-2 py-0.5 rounded-full font-mono">
                200 Pool
              </span>
            </div>

            {createError && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateNewEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Event Title
                </label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  required
                  placeholder="e.g. Annual Technical Championship"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Question Time Limit (sec)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={120}
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(parseInt(e.target.value) || 30)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Number of Questions
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={questionCount || 200}
                    value={totalQuestions}
                    onChange={(e) => setTotalQuestions(parseInt(e.target.value) || 200)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-1 border-t border-slate-800/80">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="shuffle"
                    checked={shuffleQuestions}
                    onChange={(e) => setShuffleQuestions(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="shuffle" className="text-xs text-slate-300 cursor-pointer">
                    Shuffle question order for this event
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autoLaunch"
                    checked={autoLaunchProjector}
                    onChange={(e) => setAutoLaunchProjector(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="autoLaunch" className="text-xs text-indigo-300 cursor-pointer font-medium">
                    Launch Projector Screen immediately upon creation
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autoStart"
                    checked={autoStartQuestion1}
                    onChange={(e) => setAutoStartQuestion1(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="autoStart" className="text-xs text-slate-400 cursor-pointer">
                    Start Question 1 immediately (skip waiting room)
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Creating Event...</span>
                    </>
                  ) : (
                    <>
                      <span>Create & Launch</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
