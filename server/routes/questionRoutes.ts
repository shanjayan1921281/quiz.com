import { Router } from 'express';
import { QuestionService } from '../services/questionService';
import { generateCsvData } from '../../src/data/questions200';

const router = Router();

// 1. Get Questions with Filter and Search
router.get('/questions', async (req, res, next) => {
  try {
    const { topic, difficulty, search } = req.query;
    const questions = await QuestionService.getQuestions(
      topic as string,
      difficulty as string,
      search as string
    );

    res.json({
      success: true,
      data: { questions, total: questions.length },
    });
  } catch (err) {
    next(err);
  }
});

// 2. Add Single Question
router.post('/questions', async (req, res, next) => {
  try {
    const question = await QuestionService.addQuestion(req.body);
    res.status(201).json({
      success: true,
      data: { question },
    });
  } catch (err) {
    next(err);
  }
});

// 3. Seed 200 Questions
router.post('/questions/seed', async (req, res, next) => {
  try {
    const count = await QuestionService.seedQuestions();
    res.json({
      success: true,
      message: `Successfully seeded ${count} questions`,
      data: { count },
    });
  } catch (err) {
    next(err);
  }
});

// 4. Import Questions CSV
router.post('/questions/import-csv', async (req, res, next) => {
  try {
    const { csvContent } = req.body;
    if (!csvContent) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'csvContent is required in request body' },
      });
    }

    const result = QuestionService.parseAndImportCsv(csvContent);
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// 5. Export Questions as CSV
router.get('/questions/export-csv', async (req, res, next) => {
  try {
    const questions = await QuestionService.getQuestions();
    const csv = generateCsvData(questions as any);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="livequiz_questions_export.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

export default router;
