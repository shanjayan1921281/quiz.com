import crypto from 'crypto';
import { executeQuery, inMemoryStore, getPool } from '../db/pool';
import { QUESTIONS_200, QuestionItem } from '../../src/data/questions200';

export interface QuestionRecord extends QuestionItem {
  id: string;
  created_at?: string;
}

export class QuestionService {
  public static async initSeedIfEmpty(): Promise<void> {
    const p = getPool();
    if (p) {
      const { rows } = await executeQuery('SELECT COUNT(*) as count FROM questions');
      const count = parseInt(rows[0]?.count || '0', 10);
      if (count === 0) {
        console.log('[QuestionService] PostgreSQL questions table empty, seeding 200 technical questions...');
        await this.seedQuestions(QUESTIONS_200);
      }
    } else {
      if (inMemoryStore.questions.length === 0) {
        console.log('[QuestionService] In-memory store empty, seeding 200 questions...');
        inMemoryStore.questions = QUESTIONS_200.map((q, idx) => ({
          ...q,
          id: `q-${idx + 1}`,
          created_at: new Date().toISOString(),
        }));
      }
    }
  }

  public static async getQuestions(topic?: string, difficulty?: string, search?: string): Promise<QuestionRecord[]> {
    const p = getPool();
    if (p) {
      let sql = 'SELECT * FROM questions WHERE 1=1';
      const params: any[] = [];
      let idx = 1;

      if (topic && topic !== 'All') {
        sql += ` AND topic = $${idx++}`;
        params.push(topic);
      }
      if (difficulty && difficulty !== 'All') {
        sql += ` AND difficulty = $${idx++}`;
        params.push(difficulty);
      }
      if (search && search.trim()) {
        sql += ` AND (question_text ILIKE $${idx} OR explanation ILIKE $${idx})`;
        params.push(`%${search.trim()}%`);
        idx++;
      }

      sql += ' ORDER BY created_at ASC';
      const { rows } = await executeQuery(sql, params);
      return rows;
    }

    let list = [...inMemoryStore.questions];
    if (topic && topic !== 'All') {
      list = list.filter((q) => q.topic === topic);
    }
    if (difficulty && difficulty !== 'All') {
      list = list.filter((q) => q.difficulty === difficulty);
    }
    if (search && search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(
        (q) => q.question_text.toLowerCase().includes(s) || q.explanation.toLowerCase().includes(s)
      );
    }
    return list;
  }

  public static async addQuestion(q: QuestionItem): Promise<QuestionRecord> {
    const id = crypto.randomUUID ? crypto.randomUUID() : `q-${Date.now()}`;
    const now = new Date().toISOString();

    const p = getPool();
    if (p) {
      const { rows } = await executeQuery(
        `INSERT INTO questions (
          id, question_text, option_a, option_b, option_c, option_d,
          correct_option, topic, difficulty, time_limit, explanation, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          id,
          q.question_text.trim(),
          q.option_a.trim(),
          q.option_b.trim(),
          q.option_c.trim(),
          q.option_d.trim(),
          q.correct_option.trim().toUpperCase(),
          q.topic,
          q.difficulty,
          q.time_limit || 30,
          q.explanation || '',
          now,
        ]
      );
      return rows[0];
    }

    const rec: QuestionRecord = {
      ...q,
      id,
      created_at: now,
    };
    inMemoryStore.questions.push(rec);
    return rec;
  }

  public static async seedQuestions(questions: QuestionItem[] = QUESTIONS_200): Promise<number> {
    const p = getPool();
    let count = 0;

    if (p) {
      for (const q of questions) {
        const id = crypto.randomUUID ? crypto.randomUUID() : `q-${Date.now()}-${Math.random()}`;
        await executeQuery(
          `INSERT INTO questions (
            id, question_text, option_a, option_b, option_c, option_d,
            correct_option, topic, difficulty, time_limit, explanation
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            id,
            q.question_text.trim(),
            q.option_a.trim(),
            q.option_b.trim(),
            q.option_c.trim(),
            q.option_d.trim(),
            q.correct_option.trim().toUpperCase(),
            q.topic,
            q.difficulty,
            q.time_limit || 30,
            q.explanation || '',
          ]
        );
        count++;
      }
      return count;
    }

    for (const q of questions) {
      inMemoryStore.questions.push({
        ...q,
        id: `q-${inMemoryStore.questions.length + 1}`,
        created_at: new Date().toISOString(),
      });
      count++;
    }
    return count;
  }

  public static parseAndImportCsv(csvText: string): { importedCount: number; failedRows: { row: number; reason: string }[] } {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const failedRows: { row: number; reason: string }[] = [];
    const validQuestions: QuestionItem[] = [];

    if (lines.length <= 1) {
      return { importedCount: 0, failedRows: [{ row: 1, reason: 'File contains no question data' }] };
    }

    // Header validation
    const header = lines[0].toLowerCase();
    if (!header.includes('question') || !header.includes('option_a')) {
      return {
        importedCount: 0,
        failedRows: [{ row: 1, reason: 'Invalid header format. Expected: question,option_a,option_b,option_c,option_d,correct_option,topic,difficulty,explanation' }],
      };
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // simple CSV splitter handling basic quotes
      const parts = splitCsvRow(line);

      if (parts.length < 6) {
        failedRows.push({ row: i + 1, reason: `Insufficient columns (${parts.length} found, minimum 6 required)` });
        continue;
      }

      const [qText, optA, optB, optC, optD, correctRaw, topic, diff, explanation] = parts;
      const correct = (correctRaw || '').trim().toUpperCase();

      if (!qText.trim()) {
        failedRows.push({ row: i + 1, reason: 'Empty question text' });
        continue;
      }
      if (!optA.trim() || !optB.trim() || !optC.trim() || !optD.trim()) {
        failedRows.push({ row: i + 1, reason: 'All 4 options must be non-empty' });
        continue;
      }
      if (!['A', 'B', 'C', 'D'].includes(correct)) {
        failedRows.push({ row: i + 1, reason: `Invalid correct_option: "${correctRaw}". Must be A, B, C, or D` });
        continue;
      }

      validQuestions.push({
        question_text: qText.trim(),
        option_a: optA.trim(),
        option_b: optB.trim(),
        option_c: optC.trim(),
        option_d: optD.trim(),
        correct_option: correct as any,
        topic: (topic?.trim() || 'General') as any,
        difficulty: (['Easy', 'Medium', 'Hard'].includes(diff?.trim()) ? diff.trim() : 'Medium') as any,
        time_limit: 30,
        explanation: explanation?.trim() || '',
      });
    }

    // Insert valid questions
    for (const q of validQuestions) {
      this.addQuestion(q);
    }

    return {
      importedCount: validQuestions.length,
      failedRows,
    };
  }
}

function splitCsvRow(row: string): string[] {
  const result: string[] = [];
  let curr = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        curr += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(curr);
      curr = '';
    } else {
      curr += char;
    }
  }
  result.push(curr);
  return result;
}
