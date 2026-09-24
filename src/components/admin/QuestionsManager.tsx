import React, { useState, useEffect } from 'react';
import {
  Upload,
  Download,
  Plus,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  FileText,
  Database,
  RefreshCw,
  Trash2,
  Sparkles
} from 'lucide-react';
import { QUESTIONS_200, QuestionItem, generateCsvData } from '../../data/questions200';
import { parseQuestionsCsv } from '../../lib/csvParser';
import { api } from '../../services/api';
import { Question } from '../../types/quiz';

const TOPICS: ('All' | QuestionItem['topic'])[] = [
  'All',
  'DSA',
  'OOPS',
  'DBMS',
  'C/C++',
  'Java',
  'Python',
  'Operating Systems',
  'Computer Networks',
  'AI/ML Basics',
];

export const QuestionsManager: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string[] | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New Question Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newQ, setNewQ] = useState<QuestionItem>({
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_option: 'A',
    topic: 'DSA',
    difficulty: 'Medium',
    time_limit: 30,
    explanation: '',
  });

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const list = await api.fetchQuestions();
      setQuestions(list);
    } catch (err) {
      console.error('Failed to load questions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  const handleSeed200 = async () => {
    setLoading(true);
    setSuccessMessage(null);
    setUploadError(null);
    try {
      const count = await api.seedQuestions();
      setSuccessMessage(`Successfully seeded ${count} official technical questions into the bank!`);
      await loadQuestions();
    } catch (err: any) {
      setUploadError([err.message || 'Failed to seed questions.']);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    const csv = generateCsvData(questions as any);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `livequiz_questions_bank_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      setLoading(true);
      try {
        const result = await api.importQuestionsCsv(content);
        setSuccessMessage(`Imported ${result.importedCount} questions successfully!`);
        if (result.failedRows && result.failedRows.length > 0) {
          setUploadError(result.failedRows.map((f: any) => `Row ${f.row}: ${f.reason}`));
        } else {
          setUploadError(null);
        }
        await loadQuestions();
      } catch (err: any) {
        setUploadError([err.message || 'Failed to import questions.']);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQ.question_text || !newQ.option_a || !newQ.option_b || !newQ.option_c || !newQ.option_d) {
      return;
    }

    setLoading(true);
    try {
      await api.addQuestion(newQ);
      setShowAddModal(false);
      setSuccessMessage('New question added to bank.');
      setNewQ({
        question_text: '',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_option: 'A',
        topic: 'DSA',
        difficulty: 'Medium',
        time_limit: 30,
        explanation: '',
      });
      await loadQuestions();
    } catch (err: any) {
      setUploadError([err.message || 'Failed to save question.']);
    } finally {
      setLoading(false);
    }
  };

  const filteredQuestions = questions.filter((q) => {
    const matchesSearch =
      q.question_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.explanation.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTopic = selectedTopic === 'All' || q.topic === selectedTopic;
    const matchesDiff = selectedDifficulty === 'All' || q.difficulty === selectedDifficulty;
    return matchesSearch && matchesTopic && matchesDiff;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header & Primary Actions */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Question Bank Manager
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {questions.length} total questions loaded across DSA, DBMS, OS, Networks, OOP, and AI/ML.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors">
            <Upload className="h-4 w-4 text-indigo-400" />
            <span>Import CSV</span>
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
          </label>

          <button
            onClick={handleExportCsv}
            disabled={questions.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <Download className="h-4 w-4 text-indigo-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleSeed200}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 transition-all active:scale-95 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            <span>Load 200 Questions</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/30 hover:bg-emerald-500 transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Add Question</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-sm text-emerald-300">
          <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {uploadError && (
        <div className="mt-6 rounded-xl border border-rose-500/30 bg-rose-950/40 p-4 text-sm text-rose-300">
          <div className="flex items-center gap-2 font-bold mb-1">
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
            <span>CSV Import Errors / Warnings:</span>
          </div>
          <ul className="list-disc pl-6 space-y-1 text-xs">
            {uploadError.slice(0, 5).map((err, i) => (
              <li key={i}>{err}</li>
            ))}
            {uploadError.length > 5 && <li>...and {uploadError.length - 5} more errors.</li>}
          </ul>
        </div>
      )}

      {/* Filters & Search */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search questions or keywords..."
            className="w-full rounded-xl border border-slate-800 bg-slate-900 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="All">All Difficulties</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
        </div>
      </div>

      {/* Questions List */}
      <div className="mt-6 space-y-3">
        {filteredQuestions.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-slate-600" />
            <p className="text-base font-medium text-slate-300">No questions found matching your filter.</p>
            <p className="mt-1 text-xs text-slate-500">
              Try adjusting your search or click "Load 200 Questions" to seed the dataset.
            </p>
          </div>
        ) : (
          filteredQuestions.slice(0, 50).map((q, idx) => (
            <div
              key={q.id || idx}
              className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur-sm hover:border-slate-700 transition-colors"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-indigo-950 border border-indigo-800/80 px-2 py-0.5 font-mono text-xs font-bold text-indigo-300">
                    #{idx + 1}
                  </span>
                  <span className="rounded-md bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
                    {q.topic}
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                      q.difficulty === 'Easy'
                        ? 'bg-emerald-950 text-emerald-400'
                        : q.difficulty === 'Medium'
                        ? 'bg-amber-950 text-amber-400'
                        : 'bg-rose-950 text-rose-400'
                    }`}
                  >
                    {q.difficulty}
                  </span>
                </div>
                <span className="text-xs font-mono text-slate-400">Time: {q.time_limit || 30}s</span>
              </div>

              <h3 className="text-base font-bold text-white mb-3">{q.question_text}</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {(['A', 'B', 'C', 'D'] as const).map((key) => {
                  const optText = (q as any)[`option_${key.toLowerCase()}`];
                  const isCorrect = q.correct_option === key;
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-2 rounded-xl p-2.5 border ${
                        isCorrect
                          ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-200 font-semibold'
                          : 'border-slate-800 bg-slate-950 text-slate-300'
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-black ${
                          isCorrect ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {key}
                      </span>
                      <span>{optText}</span>
                    </div>
                  );
                })}
              </div>

              {q.explanation && (
                <p className="mt-3 text-xs text-slate-400 border-t border-slate-800/80 pt-2 italic">
                  <span className="font-semibold text-slate-300">Note: </span>
                  {q.explanation}
                </p>
              )}
            </div>
          ))
        )}

        {filteredQuestions.length > 50 && (
          <div className="text-center py-4 text-xs text-slate-500">
            Showing top 50 of {filteredQuestions.length} questions. Use filters to narrow down.
          </div>
        )}
      </div>

      {/* Add Question Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl my-8">
            <h2 className="text-xl font-bold text-white mb-4">Add Single Question</h2>
            <form onSubmit={handleCreateQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Question Text</label>
                <textarea
                  rows={3}
                  value={newQ.question_text}
                  onChange={(e) => setNewQ({ ...newQ, question_text: e.target.value })}
                  required
                  placeholder="Enter the question here..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {(['A', 'B', 'C', 'D'] as const).map((key) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Option {key}</label>
                    <input
                      type="text"
                      value={(newQ as any)[`option_${key.toLowerCase()}`]}
                      onChange={(e) => setNewQ({ ...newQ, [`option_${key.toLowerCase()}`]: e.target.value })}
                      required
                      placeholder={`Option ${key}`}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Correct Option</label>
                  <select
                    value={newQ.correct_option}
                    onChange={(e) => setNewQ({ ...newQ, correct_option: e.target.value as any })}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Difficulty</label>
                  <select
                    value={newQ.difficulty}
                    onChange={(e) => setNewQ({ ...newQ, difficulty: e.target.value as any })}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Time Limit (sec)</label>
                  <input
                    type="number"
                    min={10}
                    max={120}
                    value={newQ.time_limit}
                    onChange={(e) => setNewQ({ ...newQ, time_limit: parseInt(e.target.value) || 30 })}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Topic</label>
                <select
                  value={newQ.topic}
                  onChange={(e) => setNewQ({ ...newQ, topic: e.target.value as any })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  {TOPICS.filter((t) => t !== 'All').map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Explanation (Optional)</label>
                <input
                  type="text"
                  value={newQ.explanation}
                  onChange={(e) => setNewQ({ ...newQ, explanation: e.target.value })}
                  placeholder="Why is this answer correct?"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-500"
                >
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
