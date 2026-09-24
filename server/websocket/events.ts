export type WsClientRole = 'HOST' | 'PARTICIPANT' | 'PROJECTOR' | 'VIEWER';

export interface WsMessageIn {
  type: 'SUBSCRIBE' | 'UNSUBSCRIBE' | 'PING';
  eventId?: string;
  participantId?: string;
  role?: WsClientRole;
  token?: string;
}

export interface WsMessageOut {
  type: 
    | 'SUBSCRIBED'
    | 'PONG'
    | 'QUESTION_STARTED'
    | 'EVENT_PAUSED'
    | 'EVENT_RESUMED'
    | 'ANSWER_RECEIVED'
    | 'PARTICIPANT_JOINED'
    | 'LEADERBOARD_UPDATED'
    | 'EVENT_COMPLETED'
    | 'TIMER_RESTARTED'
    | 'STUDENT_DISQUALIFIED'
    | 'ERROR';
  eventId?: string;
  payload?: any;
  timestamp: string;
}
