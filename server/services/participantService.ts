import crypto from 'crypto';
import { executeQuery, inMemoryStore, getPool, withTransaction } from '../db/pool';
import { EventService } from './eventService';
import { calculateScore } from './scoringService';
import { getWsServer } from '../websocket/wsServer';

export interface Participant {
  id: string;
  event_id: string;
  display_name: string;
  session_token_hash: string;
  total_score: number;
  correct_count: number;
  total_response_time_ms: number;
  status: string;
  disqualification_reason?: string | null;
  disqualified_at?: string | null;
  joined_at: string;
  last_seen_at: string;
  rank?: number;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export class ParticipantService {
  public static async joinEvent(
    pin: string,
    displayName: string,
    providedToken?: string
  ): Promise<{ status: 'JOINED' | 'RECONNECTED'; participant: Participant; sessionToken: string; event: any }> {
    const cleanPin = pin.trim().toUpperCase();
    const cleanName = displayName.trim();

    if (!cleanName || cleanName.length < 2 || cleanName.length > 30) {
      throw new Error('Display name must be between 2 and 30 characters');
    }

    const event = await EventService.getEventByPin(cleanPin);
    if (!event) {
      throw new Error(`Invalid Game PIN. No event found for PIN: ${cleanPin}`);
    }

    if (event.status === 'COMPLETED') {
      throw new Error('This quiz competition has already concluded');
    }

    if (event.status !== 'WAITING' && !event.allow_late_join) {
      throw new Error('The competition has already started and late joining is not enabled');
    }

    const sessionToken = providedToken && providedToken.trim().length >= 10
      ? providedToken.trim()
      : crypto.randomBytes(24).toString('hex');
    const tokenHash = hashToken(sessionToken);

    const p = getPool();
    if (p) {
      // Check existing by display_name
      const { rows: existingRows } = await executeQuery(
        'SELECT * FROM participants WHERE event_id = $1 AND LOWER(display_name) = LOWER($2) LIMIT 1',
        [event.id, cleanName]
      );

      if (existingRows.length > 0) {
        const existing = existingRows[0] as Participant;
        if (existing.status === 'DISQUALIFIED') {
          throw new Error(
            `You have been disqualified from this examination (Reason: ${
              existing.disqualification_reason || 'Tab switch violation'
            }). You cannot re-enter the test.`
          );
        }
        // Verify token hash
        if (existing.session_token_hash === tokenHash) {
          // Reconnect
          await executeQuery(
            "UPDATE participants SET status = 'ACTIVE', last_seen_at = NOW() WHERE id = $1",
            [existing.id]
          );
          existing.status = 'ACTIVE';
          return { status: 'RECONNECTED', participant: existing, sessionToken, event };
        } else {
          throw new Error(`The display name "${cleanName}" is already taken in this quiz. Please choose another.`);
        }
      }

      // Create new participant
      const id = crypto.randomUUID ? crypto.randomUUID() : `part-${Date.now()}`;
      const { rows: inserted } = await executeQuery(
        `INSERT INTO participants (
          id, event_id, display_name, session_token_hash, total_score, correct_count,
          total_response_time_ms, status, joined_at, last_seen_at
        ) VALUES ($1, $2, $3, $4, 0, 0, 0, 'ACTIVE', NOW(), NOW())
        RETURNING *`,
        [id, event.id, cleanName, tokenHash]
      );

      const newPart = inserted[0] as Participant;

      // Broadcast new participant count
      const countRes = await executeQuery('SELECT COUNT(*) as count FROM participants WHERE event_id = $1', [event.id]);
      const totalCount = parseInt(countRes.rows[0]?.count || '1', 10);

      const ws = getWsServer();
      if (ws) {
        ws.broadcastToEvent(event.id, {
          type: 'PARTICIPANT_JOINED',
          eventId: event.id,
          payload: {
            participantId: newPart.id,
            displayName: newPart.display_name,
            totalParticipants: totalCount,
          },
          timestamp: new Date().toISOString(),
        });
      }

      return { status: 'JOINED', participant: newPart, sessionToken, event };
    }

    // In-memory fallback
    const existing = inMemoryStore.participants.find(
      (item) => item.event_id === event.id && item.display_name.toLowerCase() === cleanName.toLowerCase()
    );

    if (existing) {
      if (existing.status === 'DISQUALIFIED') {
        throw new Error(
          `You have been disqualified from this examination (Reason: ${
            existing.disqualification_reason || 'Tab switch violation'
          }). You cannot re-enter the test.`
        );
      }
      if (existing.session_token_hash === tokenHash) {
        existing.last_seen_at = new Date().toISOString();
        return { status: 'RECONNECTED', participant: { ...existing }, sessionToken, event };
      } else {
        throw new Error(`The display name "${cleanName}" is already taken in this quiz.`);
      }
    }

    const newPart: Participant = {
      id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      event_id: event.id,
      display_name: cleanName,
      session_token_hash: tokenHash,
      total_score: 0,
      correct_count: 0,
      total_response_time_ms: 0,
      status: 'ACTIVE',
      joined_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    };

    inMemoryStore.participants.push(newPart);

    const totalCount = inMemoryStore.participants.filter((item) => item.event_id === event.id).length;
    const ws = getWsServer();
    if (ws) {
      ws.broadcastToEvent(event.id, {
        type: 'PARTICIPANT_JOINED',
        eventId: event.id,
        payload: {
          participantId: newPart.id,
          displayName: newPart.display_name,
          totalParticipants: totalCount,
        },
        timestamp: new Date().toISOString(),
      });
    }

    return { status: 'JOINED', participant: { ...newPart }, sessionToken, event };
  }

  public static async submitAnswer(
    participantId: string,
    sessionToken: string,
    eventId: string,
    questionId: string,
    selectedOption: 'A' | 'B' | 'C' | 'D'
  ): Promise<any> {
    if (!['A', 'B', 'C', 'D'].includes(selectedOption)) {
      throw new Error('Invalid option selected. Must be A, B, C, or D.');
    }

    const event = await EventService.getEventById(eventId);
    if (!event || event.status !== 'LIVE') {
      throw new Error('This quiz is not currently accepting answers');
    }

    const tokenHash = hashToken(sessionToken);
    const p = getPool();

    if (p) {
      return withTransaction(async (client) => {
        // 1. Verify participant
        const partRes = await client.query(
          'SELECT * FROM participants WHERE id = $1 AND event_id = $2 AND session_token_hash = $3 FOR UPDATE',
          [participantId, eventId, tokenHash]
        );
        if (partRes.rows.length === 0) {
          throw new Error('Unauthorized or invalid participant session');
        }
        const participant = partRes.rows[0];

        if (participant.status === 'DISQUALIFIED') {
          throw new Error(
            `Submission rejected: You have been disqualified from this examination (Reason: ${
              participant.disqualification_reason || 'Tab switch violation'
            }).`
          );
        }

        // 2. Verify current question
        const eqRes = await client.query(
          'SELECT * FROM event_questions WHERE event_id = $1 AND question_order = $2 AND question_id = $3',
          [eventId, event.current_question_index, questionId]
        );
        if (eqRes.rows.length === 0) {
          throw new Error('This question is not the currently active question');
        }

        // 3. Check duplicate submission
        const existingAns = await client.query(
          'SELECT * FROM answers WHERE event_id = $1 AND participant_id = $2 AND question_id = $3',
          [eventId, participantId, questionId]
        );
        if (existingAns.rows.length > 0) {
          throw new Error('You have already submitted an answer for this question');
        }

        // 4. Fetch question correct option
        const qRes = await client.query('SELECT * FROM questions WHERE id = $1', [questionId]);
        if (qRes.rows.length === 0) {
          throw new Error('Question data not found');
        }
        const question = qRes.rows[0];

        // 5. Server-Authoritative Scoring
        const isMatch = selectedOption === question.correct_option;
        const now = new Date();
        const scoreResult = calculateScore({
          isCorrect: isMatch,
          questionStartedAt: event.question_started_at,
          questionDeadline: event.question_deadline,
          submittedAt: now,
        });

        if (scoreResult.isExpired) {
          throw new Error('Time has expired for this question');
        }

        // 6. Insert answer
        const ansId = crypto.randomUUID ? crypto.randomUUID() : `ans-${Date.now()}`;
        await client.query(
          `INSERT INTO answers (
            id, event_id, participant_id, question_id, selected_option,
            is_correct, score, response_time_ms, submitted_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            ansId,
            eventId,
            participantId,
            questionId,
            selectedOption,
            scoreResult.isCorrect,
            scoreResult.score,
            scoreResult.responseTimeMs,
            now.toISOString(),
          ]
        );

        // 7. Update participant total score & correct count
        const newScore = participant.total_score + scoreResult.score;
        const newCorrect = participant.correct_count + (scoreResult.isCorrect ? 1 : 0);
        const newTotalTime = (participant.total_response_time_ms || 0) + scoreResult.responseTimeMs;

        await client.query(
          `UPDATE participants
           SET total_score = $1, correct_count = $2, total_response_time_ms = $3, last_seen_at = NOW()
           WHERE id = $4`,
          [newScore, newCorrect, newTotalTime, participantId]
        );

        // 8. Count total answers for this question
        const countRes = await client.query(
          'SELECT COUNT(*) as count FROM answers WHERE event_id = $1 AND question_id = $2',
          [eventId, questionId]
        );
        const answeredCount = parseInt(countRes.rows[0]?.count || '1', 10);

        // Broadcast to WebSocket
        const ws = getWsServer();
        if (ws) {
          ws.broadcastToEvent(eventId, {
            type: 'ANSWER_RECEIVED',
            eventId,
            payload: {
              questionId,
              answeredCount,
            },
            timestamp: now.toISOString(),
          });
        }

        return {
          success: true,
          is_correct: scoreResult.isCorrect,
          score_awarded: scoreResult.score,
          base_score: scoreResult.baseScoreAwarded,
          time_bonus: scoreResult.timeBonusAwarded,
          total_score: newScore,
          correct_count: newCorrect,
          response_time_ms: scoreResult.responseTimeMs,
          correct_option: event.reveal_answer_immediately ? question.correct_option : undefined,
          explanation: event.reveal_answer_immediately ? question.explanation : undefined,
        };
      });
    }

    // In-memory fallback logic
    const part = inMemoryStore.participants.find(
      (item) => item.id === participantId && item.session_token_hash === tokenHash
    );
    if (!part) throw new Error('Unauthorized participant');

    if (part.status === 'DISQUALIFIED') {
      throw new Error(
        `Submission rejected: You have been disqualified from this examination (Reason: ${
          part.disqualification_reason || 'Tab switch violation'
        }).`
      );
    }

    const existing = inMemoryStore.answers.find(
      (item) => item.event_id === eventId && item.participant_id === participantId && item.question_id === questionId
    );
    if (existing) throw new Error('You have already submitted an answer for this question');

    const q = inMemoryStore.questions.find((item) => item.id === questionId);
    if (!q) throw new Error('Question not found');

    const now = new Date();
    const isMatch = selectedOption === q.correct_option;
    const scoreResult = calculateScore({
      isCorrect: isMatch,
      questionStartedAt: event.question_started_at,
      questionDeadline: event.question_deadline,
      submittedAt: now,
    });

    if (scoreResult.isExpired) {
      throw new Error('Time has expired for this question');
    }

    const answerRecord = {
      id: `ans-${Date.now()}`,
      event_id: eventId,
      participant_id: participantId,
      question_id: questionId,
      selected_option: selectedOption,
      is_correct: scoreResult.isCorrect,
      score: scoreResult.score,
      response_time_ms: scoreResult.responseTimeMs,
      submitted_at: now.toISOString(),
    };
    inMemoryStore.answers.push(answerRecord);

    part.total_score += scoreResult.score;
    if (scoreResult.isCorrect) part.correct_count += 1;
    part.total_response_time_ms += scoreResult.responseTimeMs;
    part.last_seen_at = now.toISOString();

    const answeredCount = inMemoryStore.answers.filter(
      (a) => a.event_id === eventId && a.question_id === questionId
    ).length;

    const ws = getWsServer();
    if (ws) {
      ws.broadcastToEvent(eventId, {
        type: 'ANSWER_RECEIVED',
        eventId,
        payload: {
          questionId,
          answeredCount,
        },
        timestamp: now.toISOString(),
      });
    }

    return {
      success: true,
      is_correct: scoreResult.isCorrect,
      score_awarded: scoreResult.score,
      base_score: scoreResult.baseScoreAwarded,
      time_bonus: scoreResult.timeBonusAwarded,
      total_score: part.total_score,
      correct_count: part.correct_count,
      response_time_ms: scoreResult.responseTimeMs,
      correct_option: event.reveal_answer_immediately ? q.correct_option : undefined,
      explanation: event.reveal_answer_immediately ? q.explanation : undefined,
    };
  }

  public static async getParticipants(eventId: string): Promise<Participant[]> {
    const event = await EventService.getEventById(eventId);
    if (!event) return [];
    const resolvedEventId = event.id;

    const p = getPool();
    if (p) {
      const { rows } = await executeQuery(
        `SELECT id, event_id, display_name, total_score, correct_count,
                total_response_time_ms, status, joined_at, last_seen_at
         FROM participants
         WHERE event_id = $1
         ORDER BY total_score DESC, correct_count DESC, total_response_time_ms ASC, joined_at ASC`,
        [resolvedEventId]
      );
      return rows.map((r, idx) => ({ ...r, rank: idx + 1 }));
    }

    const list = inMemoryStore.participants
      .filter((item) => item.event_id === resolvedEventId || item.event_id === eventId)
      .sort((a, b) => {
        if (b.total_score !== a.total_score) return b.total_score - a.total_score;
        if (b.correct_count !== a.correct_count) return b.correct_count - a.correct_count;
        if (a.total_response_time_ms !== b.total_response_time_ms)
          return a.total_response_time_ms - b.total_response_time_ms;
        return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
      });

    return list.map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  public static async getParticipantAnswer(
    eventId: string,
    participantId: string,
    questionId: string
  ): Promise<any> {
    const event = await EventService.getEventById(eventId);
    const resolvedEventId = event ? event.id : eventId;

    const p = getPool();
    if (p) {
      const { rows } = await executeQuery(
        'SELECT * FROM answers WHERE event_id = $1 AND participant_id = $2 AND question_id = $3 LIMIT 1',
        [resolvedEventId, participantId, questionId]
      );
      return rows[0] || null;
    }

    return (
      inMemoryStore.answers.find(
        (a) => (a.event_id === resolvedEventId || a.event_id === eventId) && a.participant_id === participantId && a.question_id === questionId
      ) || null
    );
  }

  public static async disqualifyParticipant(
    eventId: string,
    participantId: string,
    sessionToken?: string,
    reason = 'Tab switch or screen departure detected during examination',
    isAdmin = false
  ): Promise<{ success: boolean; participantId: string; displayName: string; reason: string }> {
    const event = await EventService.getEventById(eventId);
    if (!event) throw new Error('Event not found');
    const resolvedEventId = event.id;

    const tokenHash = sessionToken ? hashToken(sessionToken) : undefined;
    const p = getPool();
    let displayName = '';

    if (p) {
      const partQuery = isAdmin || !tokenHash
        ? 'SELECT * FROM participants WHERE id = $1 AND event_id = $2'
        : 'SELECT * FROM participants WHERE id = $1 AND event_id = $2 AND session_token_hash = $3';
      const params = isAdmin || !tokenHash ? [participantId, resolvedEventId] : [participantId, resolvedEventId, tokenHash];

      const { rows } = await executeQuery(partQuery, params);
      if (rows.length === 0) {
        throw new Error('Participant not found or unauthorized');
      }
      displayName = rows[0].display_name;

      await executeQuery(
        `UPDATE participants
         SET status = 'DISQUALIFIED',
             disqualification_reason = $1,
             disqualified_at = NOW(),
             last_seen_at = NOW()
         WHERE id = $2`,
        [reason, participantId]
      );

      // Log the violation in event_logs
      await executeQuery(
        `INSERT INTO event_logs (event_id, action, metadata)
         VALUES ($1, 'PARTICIPANT_DISQUALIFIED', $2)`,
        [resolvedEventId, JSON.stringify({ participantId, displayName, reason, timestamp: new Date().toISOString() })]
      );
    } else {
      const part = inMemoryStore.participants.find((item) => {
        if (item.id !== participantId || (item.event_id !== resolvedEventId && item.event_id !== eventId)) return false;
        if (isAdmin || !tokenHash) return true;
        return item.session_token_hash === tokenHash;
      });

      if (!part) {
        throw new Error('Participant not found or unauthorized');
      }
      displayName = part.display_name;
      part.status = 'DISQUALIFIED';
      part.disqualification_reason = reason;
      part.disqualified_at = new Date().toISOString();
      part.last_seen_at = new Date().toISOString();
    }

    // Broadcast WebSocket notification so host, projector, and students receive real-time notice
    const ws = getWsServer();
    if (ws) {
      ws.broadcastToEvent(resolvedEventId, {
        type: 'STUDENT_DISQUALIFIED',
        eventId: resolvedEventId,
        payload: {
          participantId,
          displayName,
          reason,
          disqualifiedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });
    }

    return {
      success: true,
      participantId,
      displayName,
      reason,
    };
  }
}
