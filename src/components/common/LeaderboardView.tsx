import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  Medal,
  Award,
  Download,
  Search,
  Users,
  RefreshCw,
  Clock,
  CheckCircle,
  Sparkles
} from 'lucide-react';
import { useEventSync } from '../../hooks/useEventSync';
import { Participant } from '../../types/quiz';

interface LeaderboardViewProps {
  eventId: string;
  onBackToProjector?: () => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  eventId,
  onBackToProjector,
}) => {
  const { event, participants, connectionStatus, refreshState } = useEventSync(eventId);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Fire celebratory confetti on mount if completed or podium is visible
    if (participants.length > 0) {
      confetti({
        particleCount: 60,
        spread: 80,
        origin: { y: 0.4 },
      });
    }
  }, [event?.status]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshState();
    setIsRefreshing(false);
  };

  const handleExportCsv = () => {
    if (!participants || participants.length === 0) return;

    const headers = ['Rank', 'Display Name', 'Total Score', 'Correct Answers', 'Total Questions', 'Accuracy %', 'Joined At'];
    const rows = participants.map((p, idx) => {
      const accuracy = event?.total_questions
        ? Math.round((p.correct_count / event.total_questions) * 100)
        : 0;
      return [
        idx + 1,
        `"${p.display_name.replace(/"/g, '""')}"`,
        p.total_score,
        p.correct_count,
        event?.total_questions || 0,
        `${accuracy}%`,
        `"${new Date(p.joined_at).toLocaleString()}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `college_quiz_final_standings_${event?.game_pin || 'results'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeParticipants = participants.filter((p) => p.status !== 'DISQUALIFIED');
  const top1 = activeParticipants[0] || null;
  const top2 = activeParticipants[1] || null;
  const top3 = activeParticipants[2] || null;

  const filtered = participants.filter((p) =>
    p.display_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Live Leaderboard & Standings
              </h1>
              <p className="text-xs text-slate-400">
                Event: <span className="font-semibold text-slate-200">{event?.name || 'College Tech Challenge'}</span> • PIN:{' '}
                <span className="font-mono font-bold text-indigo-400">{event?.game_pin}</span> •{' '}
                <span className="text-slate-300 font-bold">{participants.length}</span> Competitors
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={participants.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <Download className="h-4 w-4 text-indigo-400" />
            <span>Export Final CSV</span>
          </button>

          {onBackToProjector && (
            <button
              onClick={onBackToProjector}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all active:scale-95"
            >
              <span>Return to Stage</span>
            </button>
          )}
        </div>
      </div>

      {/* Olympic Podium (Top 3) */}
      {participants.length > 0 && (
        <div className="my-8">
          <h2 className="text-center text-xs font-bold tracking-widest text-slate-500 uppercase mb-6">
            Hall of Fame Podium
          </h2>

          <div className="grid grid-cols-3 items-end gap-2 sm:gap-6 max-w-2xl mx-auto pt-8">
            {/* 2nd Place (Silver) */}
            <div className="flex flex-col items-center">
              {top2 ? (
                <>
                  <div className="relative mb-2 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-slate-400 to-slate-200 text-slate-900 font-black shadow-lg shadow-slate-400/20 text-xl border-2 border-white">
                    2
                    <Medal className="absolute -top-2 -right-2 h-6 w-6 text-slate-300" />
                  </div>
                  <p className="text-center font-bold text-white text-xs sm:text-sm truncate max-w-[120px]">
                    {top2.display_name}
                  </p>
                  <p className="font-mono text-xs font-bold text-slate-300">
                    {top2.total_score} pts
                  </p>
                  <div className="w-full mt-3 h-24 sm:h-28 rounded-t-2xl bg-gradient-to-b from-slate-800 to-slate-900 border-t-2 border-slate-400/60 flex items-center justify-center font-bold text-slate-400 text-xs sm:text-sm">
                    🥈 2nd
                  </div>
                </>
              ) : (
                <div className="w-full h-24 rounded-t-2xl bg-slate-900/40 border border-dashed border-slate-800" />
              )}
            </div>

            {/* 1st Place (Gold) */}
            <div className="flex flex-col items-center">
              {top1 ? (
                <>
                  <div className="relative mb-2 flex h-18 w-18 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-yellow-400 to-amber-300 text-amber-950 font-black shadow-xl shadow-amber-400/30 text-3xl border-2 border-amber-200">
                    1
                    <Trophy className="absolute -top-3 -right-3 h-7 w-7 text-amber-400" />
                  </div>
                  <p className="text-center font-extrabold text-white text-sm sm:text-base truncate max-w-[140px]">
                    {top1.display_name}
                  </p>
                  <p className="font-mono text-sm font-black text-amber-400">
                    {top1.total_score} pts
                  </p>
                  <div className="w-full mt-3 h-32 sm:h-36 rounded-t-2xl bg-gradient-to-b from-amber-600/30 to-slate-900 border-t-2 border-amber-400 flex items-center justify-center font-black text-amber-400 text-sm sm:text-base">
                    🥇 CHAMPION
                  </div>
                </>
              ) : (
                <div className="w-full h-32 rounded-t-2xl bg-slate-900/40 border border-dashed border-slate-800" />
              )}
            </div>

            {/* 3rd Place (Bronze) */}
            <div className="flex flex-col items-center">
              {top3 ? (
                <>
                  <div className="relative mb-2 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-700 to-amber-600 text-white font-black shadow-lg shadow-amber-700/20 text-xl border-2 border-amber-500">
                    3
                    <Medal className="absolute -top-2 -right-2 h-6 w-6 text-amber-600" />
                  </div>
                  <p className="text-center font-bold text-white text-xs sm:text-sm truncate max-w-[120px]">
                    {top3.display_name}
                  </p>
                  <p className="font-mono text-xs font-bold text-amber-500">
                    {top3.total_score} pts
                  </p>
                  <div className="w-full mt-3 h-20 sm:h-24 rounded-t-2xl bg-gradient-to-b from-slate-800 to-slate-900 border-t-2 border-amber-700/60 flex items-center justify-center font-bold text-amber-600 text-xs sm:text-sm">
                    🥉 3rd
                  </div>
                </>
              ) : (
                <div className="w-full h-20 rounded-t-2xl bg-slate-900/40 border border-dashed border-slate-800" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="my-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search participant name..."
            className="w-full rounded-xl border border-slate-800 bg-slate-900 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Standings Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/60 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3.5">Rank</th>
                <th className="px-6 py-3.5">Participant</th>
                <th className="px-6 py-3.5">Score</th>
                <th className="px-6 py-3.5">Correct</th>
                <th className="px-6 py-3.5">Accuracy</th>
                <th className="px-6 py-3.5">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No participants found.
                  </td>
                </tr>
              ) : (
                filtered.map((p, idx) => {
                  const rank = idx + 1;
                  const accuracy = event?.total_questions
                    ? Math.round((p.correct_count / event.total_questions) * 100)
                    : 0;

                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors hover:bg-slate-800/40 ${
                        rank === 1
                          ? 'bg-amber-500/5'
                          : rank === 2
                          ? 'bg-slate-300/5'
                          : rank === 3
                          ? 'bg-amber-700/5'
                          : ''
                      }`}
                    >
                      <td className="px-6 py-4 font-mono font-bold text-white">
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black ${
                            rank === 1
                              ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30'
                              : rank === 2
                              ? 'bg-slate-300 text-slate-950'
                              : rank === 3
                              ? 'bg-amber-600 text-white'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {rank}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${p.status === 'DISQUALIFIED' ? 'text-rose-400 line-through' : 'text-white'}`}>
                            {p.display_name}
                          </span>
                          {p.status === 'DISQUALIFIED' && (
                            <span className="inline-flex items-center gap-1 rounded bg-rose-950 border border-rose-800 px-2 py-0.5 text-[11px] font-bold text-rose-300">
                              FAILED (Tab Switch)
                            </span>
                          )}
                        </div>
                        {p.status === 'DISQUALIFIED' && p.disqualification_reason && (
                          <p className="text-[11px] text-rose-400/80 font-mono mt-0.5">
                            {p.disqualification_reason}
                          </p>
                        )}
                      </td>

                      <td className="px-6 py-4 font-mono font-black text-indigo-400">
                        {p.total_score}
                      </td>

                      <td className="px-6 py-4 font-mono text-emerald-400 font-bold">
                        {p.correct_count}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-800">
                            <div
                              className="h-full bg-emerald-500"
                              style={{ width: `${accuracy}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-slate-400">{accuracy}%</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-xs font-mono text-slate-500">
                        {new Date(p.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
