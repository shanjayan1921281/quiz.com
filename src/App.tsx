import React, { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar';
import { JoinScreen } from './components/participant/JoinScreen';
import { ParticipantPlayView } from './components/participant/ParticipantPlayView';
import { AdminLogin } from './components/admin/AdminLogin';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { ProjectorView } from './components/admin/ProjectorView';
import { QuestionsManager } from './components/admin/QuestionsManager';
import { LeaderboardView } from './components/common/LeaderboardView';
import { BackendStatusModal } from './components/common/BackendStatusModal';
import {
  getParticipantSession,
  clearParticipantSession,
  ParticipantSession
} from './lib/session';
import { JoinResult } from './types/quiz';
import { useEventSync } from './hooks/useEventSync';
import { api } from './services/api';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<string>('join');
  const [activeEventId, setActiveEventId] = useState<string>('');
  const [participantSession, setParticipantSession] = useState<ParticipantSession | null>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);

  // Check admin session token in localStorage
  useEffect(() => {
    const adminToken = localStorage.getItem('livequiz_admin_token');
    if (adminToken) {
      setIsAdminAuthenticated(true);
    }
  }, []);

  // Check for existing participant session on launch
  useEffect(() => {
    const session = getParticipantSession();
    if (session) {
      setParticipantSession(session);
      setActiveEventId(session.eventId);
      setCurrentRoute('play');
    } else {
      // Resolve default competition event (PIN 483921)
      api.fetchEventByPin('483921')
        .then((ev) => {
          if (ev && ev.id) {
            setActiveEventId(ev.id);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Sync event info for global Navbar PIN / Status
  const { event, connectionStatus } = useEventSync(activeEventId || null);

  const handleJoined = (result: JoinResult) => {
    setActiveEventId(result.event.id);
    setParticipantSession({
      participantId: result.participant.id,
      eventId: result.event.id,
      displayName: result.participant.display_name,
      sessionToken: result.participant.session_token,
      gamePin: result.event.game_pin,
    });
    setCurrentRoute('play');
  };

  const handleLeaveParticipant = () => {
    clearParticipantSession();
    setParticipantSession(null);
    setCurrentRoute('join');
  };

  const handleLaunchProjector = (eventId: string) => {
    setActiveEventId(eventId);
    setCurrentRoute('projector');
  };

  const handleNavigateToLeaderboard = (eventId?: string) => {
    if (eventId) setActiveEventId(eventId);
    setCurrentRoute('leaderboard');
  };

  const handleAdminLoginSuccess = () => {
    setIsAdminAuthenticated(true);
    setCurrentRoute('admin');
  };

  const handleLogoutAdmin = () => {
    localStorage.removeItem('livequiz_admin_token');
    setIsAdminAuthenticated(false);
    setCurrentRoute('join');
  };

  const handleNavigate = (route: string) => {
    const adminRestrictedRoutes = ['admin', 'projector', 'questions', 'leaderboard', 'setup'];
    if (adminRestrictedRoutes.includes(route) && !isAdminAuthenticated) {
      setCurrentRoute('admin-login');
      return;
    }
    setCurrentRoute(route);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Bar Navigation (Dynamically separates Student Examination from Admin Controls) */}
      <Navbar
        currentRoute={currentRoute}
        onNavigate={handleNavigate}
        connectionStatus={connectionStatus}
        gamePin={event?.game_pin || '483921'}
        isAdminAuthenticated={isAdminAuthenticated}
        onLogoutAdmin={handleLogoutAdmin}
        studentName={participantSession?.displayName}
      />

      {/* Main Content Router */}
      <main className="w-full">
        {/* 1. STUDENT EXAMINATION LOGIN */}
        {currentRoute === 'join' && (
          <JoinScreen
            onJoined={handleJoined}
            onNavigateToAdmin={() => setCurrentRoute(isAdminAuthenticated ? 'admin' : 'admin-login')}
            initialPin={event?.game_pin || '483921'}
          />
        )}

        {/* 2. STUDENT EXAMINATION VIEW (Isolated, Tab-Switch Anti-Cheat Active) */}
        {currentRoute === 'play' && participantSession && (
          <ParticipantPlayView
            eventId={participantSession.eventId}
            participantId={participantSession.participantId}
            sessionToken={participantSession.sessionToken}
            displayName={participantSession.displayName}
            onLeave={handleLeaveParticipant}
          />
        )}

        {currentRoute === 'play' && !participantSession && (
          <JoinScreen
            onJoined={handleJoined}
            onNavigateToAdmin={() => setCurrentRoute(isAdminAuthenticated ? 'admin' : 'admin-login')}
            initialPin={event?.game_pin || '483921'}
          />
        )}

        {/* 3. DEDICATED ADMIN LOGIN */}
        {currentRoute === 'admin-login' && (
          <AdminLogin
            onLoginSuccess={handleAdminLoginSuccess}
            onBackToStudent={() => setCurrentRoute('join')}
          />
        )}

        {/* 4. ADMIN PORTAL (Requires Admin Authentication) */}
        {currentRoute === 'admin' && (
          isAdminAuthenticated ? (
            <AdminDashboard
              onLaunchProjector={handleLaunchProjector}
              onNavigateToQuestions={() => setCurrentRoute('questions')}
              onNavigateToLeaderboard={handleNavigateToLeaderboard}
              activeEventId={activeEventId}
              setActiveEventId={setActiveEventId}
            />
          ) : (
            <AdminLogin
              onLoginSuccess={handleAdminLoginSuccess}
              onBackToStudent={() => setCurrentRoute('join')}
            />
          )
        )}

        {currentRoute === 'projector' && (
          isAdminAuthenticated ? (
            <ProjectorView
              eventId={activeEventId}
              onNavigateToLeaderboard={() => handleNavigateToLeaderboard(activeEventId)}
            />
          ) : (
            <AdminLogin
              onLoginSuccess={handleAdminLoginSuccess}
              onBackToStudent={() => setCurrentRoute('join')}
            />
          )
        )}

        {currentRoute === 'questions' && (
          isAdminAuthenticated ? (
            <QuestionsManager />
          ) : (
            <AdminLogin
              onLoginSuccess={handleAdminLoginSuccess}
              onBackToStudent={() => setCurrentRoute('join')}
            />
          )
        )}

        {currentRoute === 'leaderboard' && (
          isAdminAuthenticated ? (
            <LeaderboardView
              eventId={activeEventId}
              onBackToProjector={() => setCurrentRoute('projector')}
            />
          ) : (
            <AdminLogin
              onLoginSuccess={handleAdminLoginSuccess}
              onBackToStudent={() => setCurrentRoute('join')}
            />
          )
        )}

        {currentRoute === 'setup' && (
          isAdminAuthenticated ? (
            <BackendStatusModal />
          ) : (
            <AdminLogin
              onLoginSuccess={handleAdminLoginSuccess}
              onBackToStudent={() => setCurrentRoute('join')}
            />
          )
        )}
      </main>
    </div>
  );
}
