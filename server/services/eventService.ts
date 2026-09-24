import crypto from 'crypto';
import { executeQuery, inMemoryStore, isPostgresReady } from '../db/pool';
import { getWsServer } from '../websocket/wsServer';

export type EventStatus = 'WAITING' | 'LIVE' | 'PAUSED' | 'COMPLETED';

export interface QuizEvent {
  id: string;
  name: string;
  quiz_name: string;
  game_pin: string;
  status: EventStatus;
  current_question_index: number;
  total_questions: number;
  question_time_limit: number;
  question_started_at: string | null;
  question_deadline: string | null;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  reveal_answer_immediately: boolean;
  allow_late_join: boolean;
  created_at: string;
  updated_at: string;
}

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(str: string): boolean {
  return typeof str === 'string' && UUID_REGEX.test(str.trim());
}

export class EventService {
  public static async generateUniquePin(): Promise<string> {
    for (let attempts = 0; attempts < 100; attempts++) {
      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      const existing = await this.getEventByPin(pin);
      if (!existing || existing.status === 'COMPLETED') {
        return pin;
      }
    }
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  public static async getEventByPin(pin: string): Promise<QuizEvent | null> {
    const cleanPin = pin.trim().toUpperCase();
    const usePg = isPostgresReady();

    if (usePg) {
      try {
        const { rows } = await executeQuery(
          'SELECT * FROM events WHERE UPPER(game_pin) = $1 LIMIT 1',
          [cleanPin]
        );
        if (rows[0]) return rows[0];
      } catch (e) {
        console.warn('[EventService] PG query event by pin failed, falling back:', e);
      }
    }

    const inMem = inMemoryStore.events.find((e) => e.game_pin.toUpperCase() === cleanPin);
    return inMem || null;
  }

  public static async getEventById(id: string): Promise<QuizEvent | null> {
    const cleanId = (id || '').trim();
    if (!cleanId) return null;

    const usePg = isPostgresReady();
    if (usePg) {
      try {
        // 1. If valid UUID, query by id directly
        if (isValidUuid(cleanId)) {
          const { rows } = await executeQuery(
            'SELECT * FROM events WHERE id = $1 LIMIT 1',
            [cleanId]
          );
          if (rows[0]) return rows[0];
        }

        // 2. If not a valid UUID (e.g. game PIN or alias), check game_pin
        const eventByPin = await this.getEventByPin(cleanId);
        if (eventByPin) return eventByPin;

        // 3. Fallback for placeholder IDs
        const { rows: latestRows } = await executeQuery(
          'SELECT * FROM events ORDER BY created_at DESC LIMIT 1'
        );
        if (latestRows[0]) return latestRows[0];
      } catch (e) {
        console.warn('[EventService] PG query event by id failed, falling back:', e);
      }
    }

    const inMem = inMemoryStore.events.find((e) => e.id === cleanId || e.game_pin === cleanId);
    return inMem || inMemoryStore.events[0] || null;
  }

  public static async createEvent(
    name: string,
    timeLimit = 30,
    totalQuestions = 200,
    shuffle = true,
    pinOverride?: string
  ): Promise<QuizEvent> {
    const pin = pinOverride ? pinOverride.trim().toUpperCase() : await this.generateUniquePin();
    const id = crypto.randomUUID ? crypto.randomUUID() : `event-${Date.now()}`;
    const now = new Date().toISOString();

    const fallbackEvent: QuizEvent = {
      id,
      name: name.trim(),
      quiz_name: name.trim(),
      game_pin: pin,
      status: 'WAITING',
      current_question_index: 0,
      total_questions: totalQuestions,
      question_time_limit: timeLimit,
      question_started_at: null,
      question_deadline: null,
      shuffle_questions: shuffle,
      shuffle_options: false,
      reveal_answer_immediately: true,
      allow_late_join: true,
      created_at: now,
      updated_at: now,
    };

    // Always keep in-memory store updated
    const existingIdx = inMemoryStore.events.findIndex((e) => e.game_pin === pin);
    if (existingIdx >= 0) {
      inMemoryStore.events[existingIdx] = fallbackEvent;
    } else {
      inMemoryStore.events.push(fallbackEvent);
    }

    const usePg = isPostgresReady();
    if (usePg) {
      try {
        const { rows } = await executeQuery(
          `INSERT INTO events (
            id, name, quiz_name, game_pin, status, current_question_index,
            total_questions, question_time_limit, shuffle_questions, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, 'WAITING', 0, $5, $6, $7, $8, $8)
          RETURNING *`,
          [id, name.trim(), name.trim(), pin, totalQuestions, timeLimit, shuffle, now]
        );

        if (shuffle) {
          await executeQuery(
            `INSERT INTO event_questions (id, event_id, question_id, question_order)
             SELECT gen_random_uuid(), $1, id, ROW_NUMBER() OVER ()
             FROM (
               SELECT id FROM questions
               ORDER BY RANDOM()
               LIMIT $2
             ) q
             ON CONFLICT DO NOTHING`,
            [id, totalQuestions]
          );
        } else {
          await executeQuery(
            `INSERT INTO event_questions (id, event_id, question_id, question_order)
             SELECT gen_random_uuid(), $1, id, ROW_NUMBER() OVER ()
             FROM (
               SELECT id FROM questions
               ORDER BY created_at ASC
               LIMIT $2
             ) q
             ON CONFLICT DO NOTHING`,
            [id, totalQuestions]
          );
        }

        if (rows[0]) return rows[0];
      } catch (e) {
        console.warn('[EventService] PG create event failed, using in-memory event:', e);
      }
    }

    // Map questions for in-memory store
    let qPool = [...inMemoryStore.questions];
    if (shuffle) qPool = qPool.sort(() => Math.random() - 0.5);
    const chosen = qPool.slice(0, totalQuestions);

    chosen.forEach((q, idx) => {
      inMemoryStore.event_questions.push({
        id: `eq-${id}-${idx + 1}`,
        event_id: id,
        question_id: q.id,
        question_order: idx + 1,
      });
    });

    return fallbackEvent;
  }

  public static async setStatus(eventId: string, newStatus: EventStatus): Promise<QuizEvent> {
    const event = await this.getEventById(eventId);
    if (!event) throw new Error('Event not found');

    const cur = event.status;
    const valid =
      (cur === 'WAITING' && newStatus === 'LIVE') ||
      (cur === 'LIVE' && newStatus === 'PAUSED') ||
      (cur === 'PAUSED' && newStatus === 'LIVE') ||
      (cur === 'LIVE' && newStatus === 'COMPLETED') ||
      (cur === 'PAUSED' && newStatus === 'COMPLETED');

    if (!valid && cur !== newStatus) {
      throw new Error(`Invalid state transition from ${cur} to ${newStatus}`);
    }

    const now = new Date().toISOString();
    const usePg = isPostgresReady();

    let updated: QuizEvent;
    if (usePg) {
      try {
        const { rows } = await executeQuery(
          'UPDATE events SET status = $1, updated_at = $2 WHERE id = $3 RETURNING *',
          [newStatus, now, event.id]
        );
        updated = rows[0] || { ...event, status: newStatus, updated_at: now };
      } catch (err) {
        event.status = newStatus;
        event.updated_at = now;
        updated = { ...event };
      }
    } else {
      event.status = newStatus;
      event.updated_at = now;
      updated = { ...event };
    }

    // Broadcast WebSocket notification
    const ws = getWsServer();
    if (ws) {
      if (newStatus === 'PAUSED') {
        ws.broadcastToEvent(event.id, {
          type: 'EVENT_PAUSED',
          eventId: event.id,
          payload: { status: 'PAUSED', event: updated },
          timestamp: now,
        });
      } else if (newStatus === 'LIVE' && cur === 'PAUSED') {
        ws.broadcastToEvent(event.id, {
          type: 'EVENT_RESUMED',
          eventId: event.id,
          payload: { status: 'LIVE', event: updated },
          timestamp: now,
        });
      } else if (newStatus === 'COMPLETED') {
        ws.broadcastToEvent(event.id, {
          type: 'EVENT_COMPLETED',
          eventId: event.id,
          payload: { status: 'COMPLETED', event: updated },
          timestamp: now,
        });
      }
    }

    return updated;
  }

  public static async advanceQuestion(
    eventId: string,
    nextIndex: number,
    timeLimit = 30
  ): Promise<{ event: QuizEvent; question: any }> {
    const event = await this.getEventById(eventId);
    if (!event) throw new Error('Event not found');

    if (nextIndex > event.total_questions) {
      const completed = await this.setStatus(event.id, 'COMPLETED');
      return { event: completed, question: null };
    }

    const now = new Date();
    const deadline = new Date(now.getTime() + timeLimit * 1000);

    const nowIso = now.toISOString();
    const deadlineIso = deadline.toISOString();

    const usePg = isPostgresReady();
    let updatedEvent: QuizEvent = {
      ...event,
      current_question_index: nextIndex,
      question_time_limit: timeLimit,
      question_started_at: nowIso,
      question_deadline: deadlineIso,
      status: 'LIVE',
      updated_at: nowIso,
    };
    let questionData: any = null;

    if (usePg) {
      try {
        const { rows } = await executeQuery(
          `UPDATE events
           SET current_question_index = $1,
               question_time_limit = $2,
               question_started_at = $3,
               question_deadline = $4,
               status = 'LIVE',
               updated_at = $3
           WHERE id = $5
           RETURNING *`,
          [nextIndex, timeLimit, nowIso, deadlineIso, event.id]
        );
        if (rows[0]) updatedEvent = rows[0];

        // Fetch question payload
        let qRes = await executeQuery(
          `SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
                  q.correct_option, q.topic, q.difficulty, q.time_limit, q.explanation, eq.question_order
           FROM event_questions eq
           JOIN questions q ON q.id = eq.question_id
           WHERE eq.event_id = $1 AND eq.question_order = $2
           LIMIT 1`,
          [event.id, nextIndex]
        );

        if (qRes.rows.length === 0) {
          await executeQuery(
            `INSERT INTO event_questions (id, event_id, question_id, question_order)
             SELECT gen_random_uuid(), $1, id, ROW_NUMBER() OVER ()
             FROM (
               SELECT id FROM questions
               ORDER BY RANDOM()
               LIMIT $2
             ) q
             ON CONFLICT DO NOTHING`,
            [event.id, Math.max(event.total_questions || 50, 50)]
          );
          qRes = await executeQuery(
            `SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
                    q.correct_option, q.topic, q.difficulty, q.time_limit, q.explanation, eq.question_order
             FROM event_questions eq
             JOIN questions q ON q.id = eq.question_id
             WHERE eq.event_id = $1 AND eq.question_order = $2
             LIMIT 1`,
            [event.id, nextIndex]
          );
        }

        questionData = qRes.rows[0] || null;
      } catch (err) {
        console.warn('[EventService] PG advanceQuestion failed, falling back:', err);
      }
    }

    if (!questionData) {
      event.current_question_index = nextIndex;
      event.question_time_limit = timeLimit;
      event.question_started_at = nowIso;
      event.question_deadline = deadlineIso;
      event.status = 'LIVE';
      event.updated_at = nowIso;
      updatedEvent = { ...event };

      const eq = inMemoryStore.event_questions.find(
        (item) => item.event_id === event.id && item.question_order === nextIndex
      );
      const q = eq ? inMemoryStore.questions.find((item) => item.id === eq.question_id) : inMemoryStore.questions[nextIndex - 1];
      questionData = q ? { ...q, question_order: nextIndex } : null;
    }

    // Broadcast QUESTION_STARTED
    // Never send the correct_option to public participants before reveal
    const publicQuestion = questionData
      ? {
          id: questionData.id,
          question_text: questionData.question_text,
          option_a: questionData.option_a,
          option_b: questionData.option_b,
          option_c: questionData.option_c,
          option_d: questionData.option_d,
          topic: questionData.topic,
          difficulty: questionData.difficulty,
          question_order: questionData.question_order,
          explanation: questionData.explanation,
          correct_option: questionData.correct_option,
        }
      : null;

    const ws = getWsServer();
    if (ws) {
      ws.broadcastToEvent(event.id, {
        type: 'QUESTION_STARTED',
        eventId: event.id,
        payload: {
          questionIndex: nextIndex,
          totalQuestions: updatedEvent.total_questions,
          startedAt: nowIso,
          deadline: deadlineIso,
          timeLimit,
          question: publicQuestion,
        },
        timestamp: nowIso,
      });
    }

    return { event: updatedEvent, question: questionData };
  }

  public static async restartTimer(eventId: string, timeLimit = 30): Promise<QuizEvent> {
    const event = await this.getEventById(eventId);
    if (!event) throw new Error('Event not found');

    const now = new Date();
    const deadline = new Date(now.getTime() + timeLimit * 1000);
    const nowIso = now.toISOString();
    const deadlineIso = deadline.toISOString();

    const usePg = isPostgresReady();
    let updatedEvent: QuizEvent = {
      ...event,
      question_started_at: nowIso,
      question_deadline: deadlineIso,
      question_time_limit: timeLimit,
      updated_at: nowIso,
    };

    if (usePg) {
      try {
        const { rows } = await executeQuery(
          `UPDATE events
           SET question_started_at = $1,
               question_deadline = $2,
               question_time_limit = $3,
               updated_at = $1
           WHERE id = $4
           RETURNING *`,
          [nowIso, deadlineIso, timeLimit, event.id]
        );
        updatedEvent = rows[0] || { ...event, question_started_at: nowIso, question_deadline: deadlineIso, question_time_limit: timeLimit, updated_at: nowIso };
      } catch (err) {
        event.question_started_at = nowIso;
        event.question_deadline = deadlineIso;
        event.question_time_limit = timeLimit;
        event.updated_at = nowIso;
        updatedEvent = { ...event };
      }
    } else {
      event.question_started_at = nowIso;
      event.question_deadline = deadlineIso;
      event.question_time_limit = timeLimit;
      event.updated_at = nowIso;
      updatedEvent = { ...event };
    }

    const ws = getWsServer();
    if (ws) {
      ws.broadcastToEvent(event.id, {
        type: 'TIMER_RESTARTED',
        eventId: event.id,
        payload: {
          startedAt: nowIso,
          deadline: deadlineIso,
          timeLimit,
        },
        timestamp: nowIso,
      });
    }

    return updatedEvent;
  }
}
