import { useEffect, useState, useRef, useCallback } from 'react';
import { QuizEvent, Participant } from '../types/quiz';
import { api } from '../services/api';
import { socket, SocketStatus } from '../services/socket';

export type ConnectionStatus = SocketStatus;

export interface EventSyncState {
  event: QuizEvent | null;
  participants: Participant[];
  currentQuestion: any | null;
  connectionStatus: ConnectionStatus;
  remainingSeconds: number;
  remainingProgress: number; // 0 to 1
  isTimeExpired: boolean;
  refreshState: () => Promise<void>;
}

export function useEventSync(
  eventId: string | null,
  participantId?: string,
  role: string = 'VIEWER'
): EventSyncState {
  const [event, setEvent] = useState<QuizEvent | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<any | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(socket.getStatus());
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [remainingProgress, setRemainingProgress] = useState<number>(1);
  const [isTimeExpired, setIsTimeExpired] = useState<boolean>(false);

  const timerRef = useRef<number | null>(null);

  const refreshState = useCallback(async () => {
    if (!eventId) return;
    try {
      const [evData, parts] = await Promise.all([
        api.fetchEvent(eventId),
        api.fetchParticipants(eventId),
      ]);

      if (evData) {
        setEvent(evData.event);
        setCurrentQuestion(evData.currentQuestion);
      }
      setParticipants(parts);
    } catch (err) {
      console.warn('Failed to refresh event state', err);
    }
  }, [eventId]);

  // Initial load & WebSocket connection
  useEffect(() => {
    if (!eventId) {
      setEvent(null);
      setParticipants([]);
      setCurrentQuestion(null);
      return;
    }

    refreshState();

    // Connect WebSocket
    socket.connect(eventId, participantId, role);

    const unsubStatus = socket.onStatusChange(setConnectionStatus);

    const unsubQuestion = socket.on('QUESTION_STARTED', (payload) => {
      setEvent((prev) =>
        prev
          ? {
              ...prev,
              current_question_index: payload.questionIndex,
              question_started_at: payload.startedAt,
              question_deadline: payload.deadline,
              question_time_limit: payload.timeLimit,
              status: 'LIVE',
            }
          : null
      );
      setCurrentQuestion(payload.question);
    });

    const unsubPaused = socket.on('EVENT_PAUSED', (payload) => {
      setEvent((prev) => (prev ? { ...prev, status: 'PAUSED' } : null));
    });

    const unsubResumed = socket.on('EVENT_RESUMED', (payload) => {
      setEvent((prev) => (prev ? { ...prev, status: 'LIVE' } : null));
    });

    const unsubTimer = socket.on('TIMER_RESTARTED', (payload) => {
      setEvent((prev) =>
        prev
          ? {
              ...prev,
              question_started_at: payload.startedAt,
              question_deadline: payload.deadline,
              question_time_limit: payload.timeLimit,
            }
          : null
      );
    });

    const unsubJoined = socket.on('PARTICIPANT_JOINED', () => {
      api.fetchParticipants(eventId).then(setParticipants).catch(console.error);
    });

    const unsubCompleted = socket.on('EVENT_COMPLETED', () => {
      setEvent((prev) => (prev ? { ...prev, status: 'COMPLETED' } : null));
      api.fetchParticipants(eventId).then(setParticipants).catch(console.error);
    });

    const unsubDisqualified = socket.on('STUDENT_DISQUALIFIED', (payload) => {
      api.fetchParticipants(eventId).then(setParticipants).catch(console.error);
    });

    return () => {
      unsubStatus();
      unsubQuestion();
      unsubPaused();
      unsubResumed();
      unsubTimer();
      unsubJoined();
      unsubCompleted();
      unsubDisqualified();
    };
  }, [eventId, participantId, role, refreshState]);

  // Synchronized countdown timer based on server timestamps
  useEffect(() => {
    if (!event || event.status !== 'LIVE' || !event.question_deadline || !event.question_started_at) {
      setRemainingSeconds(0);
      setRemainingProgress(0);
      setIsTimeExpired(false);
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
      return;
    }

    const deadlineMs = new Date(event.question_deadline).getTime();
    const startedMs = new Date(event.question_started_at).getTime();
    const totalDurationMs = Math.max(1000, deadlineMs - startedMs);

    const updateTimer = () => {
      const now = Date.now();
      const diffMs = deadlineMs - now;

      if (diffMs <= 0) {
        setRemainingSeconds(0);
        setRemainingProgress(0);
        setIsTimeExpired(true);
      } else {
        const secs = Math.ceil(diffMs / 1000);
        const progress = Math.max(0, Math.min(1, diffMs / totalDurationMs));
        setRemainingSeconds(secs);
        setRemainingProgress(progress);
        setIsTimeExpired(false);
        timerRef.current = requestAnimationFrame(updateTimer);
      }
    };

    updateTimer();

    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, [event?.status, event?.question_deadline, event?.question_started_at, event?.current_question_index]);

  return {
    event,
    participants,
    currentQuestion,
    connectionStatus,
    remainingSeconds,
    remainingProgress,
    isTimeExpired,
    refreshState,
  };
}
