import React from 'react';
import {
  Radio,
  Shield,
  BookOpen,
  Trophy,
  Laptop,
  LogOut,
  UserCheck,
  Lock,
  Activity
} from 'lucide-react';
import { ConnectionStatus } from '../../hooks/useEventSync';

interface NavbarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  connectionStatus?: ConnectionStatus;
  gamePin?: string;
  isAdminAuthenticated: boolean;
  onLogoutAdmin: () => void;
  studentName?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRoute,
  onNavigate,
  connectionStatus = 'CONNECTED',
  gamePin,
  isAdminAuthenticated,
  onLogoutAdmin,
  studentName,
}) => {
  const isStudentPlayMode = currentRoute === 'play';

  // 1. STUDENT EXAMINATION HEADER (Strict distraction-free mode: no admin links)
  if (isStudentPlayMode) {
    return (
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 font-black text-white shadow-sm shadow-indigo-500/30">
              Q
            </div>
            <div>
              <span className="font-extrabold text-sm sm:text-base text-white">LiveQuiz<span className="text-indigo-400">Pro</span></span>
              <span className="ml-2 text-xs font-semibold text-slate-400 border-l border-slate-700 pl-2">
                Student Examination
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {studentName && (
              <div className="hidden sm:flex items-center gap-1.5 rounded-lg bg-slate-900 border border-slate-800 px-3 py-1 text-xs text-slate-300">
                <span className="text-slate-400">Student:</span>
                <span className="font-bold text-white">{studentName}</span>
              </div>
            )}

            {/* Connection Status */}
            <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-slate-300">
              <span
                className={`h-2 w-2 rounded-full ${
                  connectionStatus === 'CONNECTED'
                    ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                    : 'bg-amber-400 animate-ping'
                }`}
              />
              <span className="text-[11px] font-mono uppercase text-slate-400 hidden sm:inline">
                {connectionStatus}
              </span>
            </div>
          </div>
        </div>
      </header>
    );
  }

  // 2. REGULAR HEADER (For Student Login or Authenticated Admin)
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Wordmark */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate(isAdminAuthenticated ? 'admin' : 'join')}
            className="flex items-center gap-2 text-left text-lg font-bold tracking-tight text-white transition-opacity hover:opacity-90"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 font-black text-white shadow-sm shadow-indigo-500/30">
              Q
            </div>
            <span className="font-extrabold tracking-tight">LiveQuiz<span className="text-indigo-400">Pro</span></span>
          </button>

          {gamePin && (
            <div className="hidden items-center gap-1.5 rounded-md bg-slate-900 border border-slate-800 px-2.5 py-1 text-xs font-mono text-indigo-300 sm:flex">
              <span className="text-slate-400">PIN:</span>
              <span className="font-bold tracking-wider">{gamePin}</span>
            </div>
          )}
        </div>

        {/* Navigation links - ONLY shown if Admin is authenticated */}
        {isAdminAuthenticated ? (
          <nav className="hidden items-center gap-5 text-sm font-medium md:flex">
            <button
              onClick={() => onNavigate('admin')}
              className={`transition-colors whitespace-nowrap ${
                currentRoute === 'admin'
                  ? 'text-indigo-400 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Host Dashboard
            </button>

            <button
              onClick={() => onNavigate('projector')}
              className={`transition-colors whitespace-nowrap ${
                currentRoute === 'projector'
                  ? 'text-indigo-400 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Projector Screen
            </button>

            <button
              onClick={() => onNavigate('questions')}
              className={`transition-colors whitespace-nowrap ${
                currentRoute === 'questions'
                  ? 'text-indigo-400 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Question Bank
            </button>

            <button
              onClick={() => onNavigate('leaderboard')}
              className={`transition-colors whitespace-nowrap ${
                currentRoute === 'leaderboard' || currentRoute === 'results'
                  ? 'text-indigo-400 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Leaderboard
            </button>

            <button
              onClick={() => onNavigate('setup')}
              className={`transition-colors whitespace-nowrap ${
                currentRoute === 'setup'
                  ? 'text-indigo-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Backend & Health
            </button>
          </nav>
        ) : (
          /* When not in admin mode, show minimal portal tag */
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
            <span>Student Examination System Online</span>
          </div>
        )}

        {/* Actions & Role Switches */}
        <div className="flex items-center gap-3">
          {isAdminAuthenticated ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate('join')}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
              >
                <UserCheck className="h-3.5 w-3.5 text-indigo-400" />
                <span>Student View</span>
              </button>

              <button
                onClick={onLogoutAdmin}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-800/60 bg-rose-950/40 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-900/60 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5 text-rose-400" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => onNavigate('admin-login')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-slate-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-500 transition-all shadow-sm"
            >
              <Shield className="h-3.5 w-3.5 text-indigo-400" />
              <span>Admin Portal</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
