import { QuestionItem } from '../data/questions200';

export interface ParseResult {
  validQuestions: QuestionItem[];
  errors: string[];
}

export function parseQuestionsCsv(csvText: string): ParseResult {
  const errors: string[] = [];
  const validQuestions: QuestionItem[] = [];

  if (!csvText || !csvText.trim()) {
    return { validQuestions: [], errors: ['CSV file is empty.'] };
  }

  // Regex parser that handles quoted commas and line breaks
  const rows = splitCsvLines(csvText.trim());
  if (rows.length < 2) {
    return { validQuestions: [], errors: ['CSV must contain a header row and at least one question row.'] };
  }

  // Normalize header
  const header = rows[0].map(h => h.trim().toLowerCase().replace(/[\s_-]+/g, '_'));
  
  const colIndex = {
    question: header.indexOf('question'),
    option_a: header.indexOf('option_a'),
    option_b: header.indexOf('option_b'),
    option_c: header.indexOf('option_c'),
    option_d: header.indexOf('option_d'),
    correct_option: header.indexOf('correct_option'),
    topic: header.indexOf('topic'),
    difficulty: header.indexOf('difficulty'),
    explanation: header.indexOf('explanation'),
  };

  // Fallback for header variations (e.g. "question_text" instead of "question")
  if (colIndex.question === -1) colIndex.question = header.indexOf('question_text');
  if (colIndex.correct_option === -1) colIndex.correct_option = header.indexOf('answer');

  // Verify essential columns
  const missingCols: string[] = [];
  if (colIndex.question === -1) missingCols.push('question');
  if (colIndex.option_a === -1) missingCols.push('option_a');
  if (colIndex.option_b === -1) missingCols.push('option_b');
  if (colIndex.option_c === -1) missingCols.push('option_c');
  if (colIndex.option_d === -1) missingCols.push('option_d');
  if (colIndex.correct_option === -1) missingCols.push('correct_option');

  if (missingCols.length > 0) {
    return {
      validQuestions: [],
      errors: [`Missing required columns in CSV header: ${missingCols.join(', ')}. Expected: question,option_a,option_b,option_c,option_d,correct_option,topic,difficulty,explanation`]
    };
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    // Skip empty lines
    if (row.length === 1 && !row[0].trim()) continue;

    const qText = (row[colIndex.question] || '').trim();
    const optA = (row[colIndex.option_a] || '').trim();
    const optB = (row[colIndex.option_b] || '').trim();
    const optC = (row[colIndex.option_c] || '').trim();
    const optD = (row[colIndex.option_d] || '').trim();
    const correctRaw = (row[colIndex.correct_option] || '').trim().toUpperCase();
    const topicRaw = (colIndex.topic !== -1 ? row[colIndex.topic] : 'General') || 'General';
    const diffRaw = (colIndex.difficulty !== -1 ? row[colIndex.difficulty] : 'Medium') || 'Medium';
    const explanation = colIndex.explanation !== -1 ? (row[colIndex.explanation] || '').trim() : '';

    if (!qText) {
      errors.push(`Row ${rowNum}: Question text is empty.`);
      continue;
    }
    if (!optA || !optB || !optC || !optD) {
      errors.push(`Row ${rowNum}: All 4 options (A, B, C, D) must have text.`);
      continue;
    }
    if (!['A', 'B', 'C', 'D'].includes(correctRaw)) {
      errors.push(`Row ${rowNum}: Correct option must be A, B, C, or D (found "${correctRaw}").`);
      continue;
    }

    let difficulty: 'Easy' | 'Medium' | 'Hard' = 'Medium';
    const normDiff = diffRaw.trim().toLowerCase();
    if (normDiff.startsWith('e')) difficulty = 'Easy';
    else if (normDiff.startsWith('h')) difficulty = 'Hard';

    validQuestions.push({
      question_text: qText,
      option_a: optA,
      option_b: optB,
      option_c: optC,
      option_d: optD,
      correct_option: correctRaw as 'A' | 'B' | 'C' | 'D',
      topic: topicRaw.trim() as any,
      difficulty,
      time_limit: 30,
      explanation
    });
  }

  return { validQuestions, errors };
}

function splitCsvLines(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let curr = '';
  let insideQuote = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        curr += '"';
        i++; // skip escaped quote
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      row.push(curr);
      curr = '';
    } else if ((char === '\r' || char === '\n') && !insideQuote) {
      if (char === '\r' && nextChar === '\n') i++;
      row.push(curr);
      curr = '';
      if (row.some(cell => cell.trim().length > 0)) {
        result.push(row);
      }
      row = [];
    } else {
      curr += char;
    }
  }

  if (curr.length > 0 || row.length > 0) {
    row.push(curr);
    if (row.some(cell => cell.trim().length > 0)) {
      result.push(row);
    }
  }

  return result;
}
