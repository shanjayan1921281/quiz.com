import { Router } from 'express';
import { EventService } from '../services/eventService';
import { ParticipantService } from '../services/participantService';
import { joinLimiter, answerLimiter } from '../middleware/rateLimit';
import { executeQuery, inMemoryStore, getPool } from '../db/pool';

const router = Router();

// 1. Participant Join Endpoint
router.post('/events/join', joinLimiter, async (req, res, next) => {
  try {
    const { gamePin, displayName, sessionToken } = req.body;
    if (!gamePin || !displayName) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Game PIN and Display Name are required' },
      });
    }

    const result = await ParticipantService.joinEvent(gamePin, displayName, sessionToken);
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// 2. Fetch Event by PIN
router.get('/events/pin/:pin', async (req, res, next) => {
  try {
    const event = await EventService.getEventByPin(req.params.pin);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: 'EVENT_NOT_FOUND', message: `No active event found with PIN: ${req.params.pin}` },
      });
    }

    res.json({
      success: true,
      data: { event },
    });
  } catch (err) {
    next(err);
  }
});

// 3. Fetch Event Details and Active Question
router.get('/events/:id', async (req, res, next) => {
  try {
    const event = await EventService.getEventById(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: 'EVENT_NOT_FOUND', message: 'Event not found' },
      });
    }

    // Also fetch current question details if active
    let currentQuestion: any = null;
    if (event.current_question_index > 0) {
      const p = getPool();
      if (p) {
        const { rows } = await executeQuery(
          `SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
                  q.correct_option, q.topic, q.difficulty, q.time_limit, q.explanation, eq.question_order
           FROM event_questions eq
           JOIN questions q ON q.id = eq.question_id
           WHERE eq.event_id = $1 AND eq.question_order = $2
           LIMIT 1`,
          [event.id, event.current_question_index]
        );
        currentQuestion = rows[0] || null;
      } else {
        const eq = inMemoryStore.event_questions.find(
          (item) => item.event_id === event.id && item.question_order === event.current_question_index
        );
        const q = eq ? inMemoryStore.questions.find((item) => item.id === eq.question_id) : null;
        currentQuestion = q ? { ...q, question_order: event.current_question_index } : null;
      }
    }

    res.json({
      success: true,
      data: { event, currentQuestion },
    });
  } catch (err) {
    next(err);
  }
});

// 4. Create New Event
router.post('/events', async (req, res, next) => {
  try {
    const { name, timeLimit, totalQuestions, shuffle, pinOverride } = req.body;
    const event = await EventService.createEvent(
      name || 'College Tech Competition',
      timeLimit || 30,
      totalQuestions || 200,
      shuffle ?? true,
      pinOverride
    );

    res.status(201).json({
      success: true,
      data: { event },
    });
  } catch (err) {
    next(err);
  }
});

// 5. Host Update Event Status (WAITING, LIVE, PAUSED, COMPLETED)
router.post('/events/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Status is required' },
      });
    }

    const updated = await EventService.setStatus(req.params.id, status);
    res.json({
      success: true,
      data: { event: updated },
    });
  } catch (err) {
    next(err);
  }
});

// 6. Host Advance Question
router.post('/events/:id/advance', async (req, res, next) => {
  try {
    const { nextIndex, timeLimit } = req.body;
    const result = await EventService.advanceQuestion(
      req.params.id,
      parseInt(nextIndex, 10),
      timeLimit ? parseInt(timeLimit, 10) : 30
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// 7. Host Restart Timer
router.post('/events/:id/restart-timer', async (req, res, next) => {
  try {
    const { timeLimit } = req.body;
    const updated = await EventService.restartTimer(
      req.params.id,
      timeLimit ? parseInt(timeLimit, 10) : 30
    );

    res.json({
      success: true,
      data: { event: updated },
    });
  } catch (err) {
    next(err);
  }
});

// 8. Participant Submit Answer
router.post('/events/:id/answers', answerLimiter, async (req, res, next) => {
  try {
    const { participantId, sessionToken, questionId, selectedOption } = req.body;
    if (!participantId || !sessionToken || !questionId || !selectedOption) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Missing submission fields' },
      });
    }

    const result = await ParticipantService.submitAnswer(
      participantId,
      sessionToken,
      req.params.id,
      questionId,
      selectedOption
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// 8b. Student Disqualification (Triggered immediately on tab-switch / window-blur)
router.post('/events/:id/disqualify', async (req, res, next) => {
  try {
    const { participantId, sessionToken, reason } = req.body;
    if (!participantId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'participantId is required' },
      });
    }

    const result = await ParticipantService.disqualifyParticipant(
      req.params.id,
      participantId,
      sessionToken,
      reason || 'Tab switch detected during active examination',
      false
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// 9. Fetch Participants / Leaderboard
router.get('/events/:id/participants', async (req, res, next) => {
  try {
    const participants = await ParticipantService.getParticipants(req.params.id);
    res.json({
      success: true,
      data: { participants },
    });
  } catch (err) {
    next(err);
  }
});

// 10. Fetch Participant's Answer for a Question (Page refresh recovery)
router.get('/events/:id/answers/my', async (req, res, next) => {
  try {
    const { participantId, questionId } = req.query;
    if (!participantId || !questionId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'participantId and questionId are required' },
      });
    }

    const answer = await ParticipantService.getParticipantAnswer(
      req.params.id,
      participantId as string,
      questionId as string
    );

    res.json({
      success: true,
      data: { answer },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
