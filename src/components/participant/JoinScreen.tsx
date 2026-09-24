import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  User,
  Hash,
  KeyRound,
  ShieldAlert,
  Lock,
  ExternalLink
} from 'lucide-react';
import { api } from '../../services/api';
import {
  generateSessionToken,
  saveParticipantSession,
  getParticipantSession,
  clearParticipantSession,
  ParticipantSession
} from '../../lib/session';
import { JoinResult } from '../../types/quiz';

interface JoinScreenProps {
  onJoined: (result: JoinResult) => void;
  onNavigateToAdmin?: () => void;
  initialPin?: string;
}

export const JoinScreen: React.FC<JoinScreenProps> = ({
  onJoined,
  onNavigateToAdmin,
  initialPin = '',
}) => {
  const [pin, setPin] = useState(initialPin);
  const [name, setName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingSession, setExistingSession] = useState<ParticipantSession | null>(null);
  const [eventDetails, setEventDetails] = useState<{ name: string; status: string } | null>(null);

  useEffect(() => {
    const session = getParticipantSession();
    if (session) {
      setExistingSession(session);
      if (!pin) setPin(session.gamePin);
      if (!name) setName(session.displayName);
    }
  }, []);

  // Check event PIN validity when 6 characters
  useEffect(() => {
    const cleanPin = pin.trim().toUpperCase();
    if (cleanPin.length === 6) {
      api.fetchEventByPin(cleanPin)
        .then((ev) => {
          if (ev) {
            setEventDetails({ name: ev.name, status: ev.status });
            setError(null);
          } else {
            setEventDetails(null);
            setError('No active quiz found with this Game PIN. Please verify.');
          }
        })
        .catch(() => {
          setEventDetails(null);
        });
    } else {
      setEventDetails(null);
    }
  }, [pin]);

  const handleResumeSession = async () => {
    if (!existingSession) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.joinEvent(
        existingSession.gamePin,
        existingSession.displayName,
        existingSession.sessionToken
      );
      saveParticipantSession({
        participantId: result.participant.id,
        eventId: result.event.id,
        displayName: result.participant.display_name,
        sessionToken: existingSession.sessionToken,
        gamePin: existingSession.gamePin,
      });
      onJoined(result);
    } catch (err: any) {
      console.error('Failed to resume session', err);
      setError(err.message || 'Could not resume previous session. Please enter your details again.');
      clearParticipantSession();
      setExistingSession(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.trim().toUpperCase();
    const cleanName = name.trim();
    const cleanRoll = rollNo.trim();

    if (!cleanPin) {
      setError('Please enter the 6-digit Game PIN.');
      return;
    }
    if (cleanPin.length < 5) {
      setError('Game PIN must be 5 to 6 characters.');
      return;
    }
    if (!cleanName) {
      setError('Please enter your full name.');
      return;
    }
    if (cleanName.length < 2) {
      setError('Name must be at least 2 characters.');
      return;
    }

    // Combine Roll Number with Name if provided (e.g. "Alex Kumar (2026-CS-041)")
    const displayName = cleanRoll ? `${cleanName} [${cleanRoll}]` : cleanName;

    setLoading(true);
    setError(null);

    try {
      const token =
        existingSession && existingSession.displayName === displayName
          ? existingSession.sessionToken
          : generateSessionToken();

      const result = await api.joinEvent(cleanPin, displayName, token);

      saveParticipantSession({
        participantId: result.participant.id,
        eventId: result.event.id,
        displayName: result.participant.display_name,
        sessionToken: token,
        gamePin: cleanPin,
      });

      onJoined(result);
    } catch (err: any) {
      console.error('Join error', err);
      setError(err.message || 'Unable to enter examination room. Please check your PIN.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-lg">
        {/* Previous session notice */}
        {existingSession && (
          <div className="mb-6 rounded-2xl border border-indigo-500/30 bg-indigo-950/40 p-4 backdrop-blur-md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-indigo-400">Previous Student Session Detected</p>
                <p className="text-sm font-bold text-white">{existingSession.displayName}</p>
                <p className="text-xs text-slate-400">
                  Event PIN: <span className="font-mono text-indigo-300">{existingSession.gamePin}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={handleResumeSession}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                <span>Resume Test</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Student Portal Card */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-lg shadow-indigo-500/25 text-white">
              <User className="h-7 w-7" />
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 border border-slate-700 px-3 py-0.5 text-xs font-semibold text-slate-300">
              <Lock className="h-3 w-3 text-indigo-400" />
              Proctored Student Portal
            </span>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Student Examination Room
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              Enter the competition Game PIN and your student credentials to attend the quiz.
            </p>
          </div>

          {/* Strict Anti-Cheating & Tab-Switch Policy Warning Banner */}
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <p className="font-bold uppercase tracking-wider text-amber-300">
                  Strict Single-Tab Examination Policy
                </p>
                <p className="mt-1 text-amber-200/90 leading-relaxed">
                  Once the test starts, <strong>you cannot switch tabs, minimize the browser, or switch applications</strong>. Doing so will immediately <strong>FAIL your test and permanently log you out</strong>.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3.5 text-xs sm:text-sm text-rose-300">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {eventDetails && (
            <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3 text-xs text-emerald-300 flex items-center justify-between">
              <div>
                <span className="font-semibold block text-emerald-200">{eventDetails.name}</span>
                <span className="text-slate-400">Status: {eventDetails.status}</span>
              </div>
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="gamePin" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Game PIN
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                  <KeyRound className="h-4 w-4" />
                </div>
                <input
                  id="gamePin"
                  type="text"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                  placeholder="e.g. 483921"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-4 py-3.5 text-center font-mono text-2xl font-black tracking-widest text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  autoComplete="off"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="displayName" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    id="displayName"
                    type="text"
                    maxLength={30}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Kumar"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-3 py-3 text-sm font-medium text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    autoComplete="off"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="rollNo" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Roll / Student ID <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                    <Hash className="h-4 w-4" />
                  </div>
                  <input
                    id="rollNo"
                    type="text"
                    maxLength={15}
                    value={rollNo}
                    onChange={(e) => setRollNo(e.target.value)}
                    placeholder="e.g. 2026-CS-041"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-3 py-3 text-sm font-mono font-medium text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !pin.trim() || !name.trim()}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 text-sm sm:text-base font-bold text-white shadow-lg shadow-indigo-600/30 transition-all hover:from-indigo-500 hover:to-violet-500 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>Entering Examination Room...</span>
                </>
              ) : (
                <>
                  <span>Enter Examination Room</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          {/* Admin Portal Switch Link */}
          {onNavigateToAdmin && (
            <div className="mt-8 border-t border-slate-800/80 pt-4 flex items-center justify-between text-xs text-slate-400">
              <span>Event Organizer or Faculty?</span>
              <button
                type="button"
                onClick={onNavigateToAdmin}
                className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
              >
                <span>Host / Admin Login</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
