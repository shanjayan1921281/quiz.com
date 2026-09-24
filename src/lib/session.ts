const SESSION_STORAGE_KEY = 'livequiz_participant_session';
const ADMIN_STORAGE_KEY = 'livequiz_admin_auth';

export interface ParticipantSession {
  participantId: string;
  eventId: string;
  displayName: string;
  sessionToken: string;
  gamePin: string;
}

export function generateSessionToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function saveParticipantSession(session: ParticipantSession): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (err) {
    console.error('Failed to save session to localStorage', err);
  }
}

export function getParticipantSession(): ParticipantSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearParticipantSession(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear participant session', err);
  }
}

// Host Admin Session
export function saveAdminSession(token: string): void {
  try {
    sessionStorage.setItem(ADMIN_STORAGE_KEY, token);
  } catch (err) {
    console.error('Failed to save admin session', err);
  }
}

export function getAdminSession(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearAdminSession(): void {
  try {
    sessionStorage.removeItem(ADMIN_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear admin session', err);
  }
}
