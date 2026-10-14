const { createHash } = require("crypto");
const { createClient } = require("@libsql/client");

let client;
let initializationPromise;

const getClient = () => {
  if (client) return client;
  const url = String(process.env.TURSO_URL || "").trim();
  const authToken = String(process.env.TURSO_SECRET || process.env.TURSO_AUTH_TOKEN || "").trim();
  if (!url) throw new Error("TURSO_URL is required for DSA practice storage.");
  if (!authToken && !url.startsWith("file:")) throw new Error("TURSO_SECRET is required for the remote Turso database.");
  client = createClient({ url, ...(authToken ? { authToken } : {}) });
  return client;
};

const parseJson = (value, fallback) => {
  try { return JSON.parse(value); } catch (_) { return fallback; }
};

const questionToRecord = (row) => ({
  id: row.id,
  topicId: row.topic_id,
  title: row.title,
  difficulty: row.difficulty,
  prompt: row.prompt,
  constraints: parseJson(row.constraints_json, []),
  examples: parseJson(row.examples_json, []),
  starterCode: parseJson(row.starter_code_json, {}),
  checkerKey: row.checker_key || null,
  leetcodeNumber: row.leetcode_number ? Number(row.leetcode_number) : null,
  explanation: row.explanation || "",
  complexity: row.complexity || "",
});

const ensureSchema = async (db) => {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS dsa_questions (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL,
      title TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      prompt TEXT NOT NULL,
      constraints_json TEXT NOT NULL,
      examples_json TEXT NOT NULL,
      starter_code_json TEXT NOT NULL,
      checker_key TEXT,
      leetcode_number INTEGER,
      explanation TEXT NOT NULL DEFAULT '',
      complexity TEXT NOT NULL DEFAULT '',
      source_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS dsa_test_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id TEXT NOT NULL,
      ordinal INTEGER NOT NULL,
      input TEXT NOT NULL,
      expected_output TEXT NOT NULL,
      is_hidden INTEGER NOT NULL DEFAULT 1,
      UNIQUE(question_id, ordinal)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_dsa_test_cases_question ON dsa_test_cases(question_id, ordinal)`,
    `CREATE TABLE IF NOT EXISTS dsa_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      language TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('run', 'submit')),
      passed_count INTEGER NOT NULL,
      total_cases INTEGER NOT NULL,
      accepted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_dsa_submissions_student_question ON dsa_submissions(student_id, question_id, created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS dsa_solved_problems (
      student_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      language TEXT NOT NULL,
      solution_code TEXT NOT NULL,
      solved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(student_id, question_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_dsa_solved_student ON dsa_solved_problems(student_id, solved_at DESC)`,
    `CREATE TABLE IF NOT EXISTS dsa_daily_assignments (
      student_id TEXT NOT NULL,
      date_key TEXT NOT NULL,
      slot INTEGER NOT NULL,
      question_id TEXT NOT NULL,
      is_completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      PRIMARY KEY(student_id, date_key, slot),
      UNIQUE(student_id, date_key, question_id)
    )`,
  ], "write");
  const columns = await db.execute("PRAGMA table_info(dsa_questions)");
  if (!columns.rows.some((column) => column.name === "checker_key")) {
    await db.execute("ALTER TABLE dsa_questions ADD COLUMN checker_key TEXT");
  }
  if (!columns.rows.some((column) => column.name === "leetcode_number")) await db.execute("ALTER TABLE dsa_questions ADD COLUMN leetcode_number INTEGER");
  if (!columns.rows.some((column) => column.name === "explanation")) await db.execute("ALTER TABLE dsa_questions ADD COLUMN explanation TEXT NOT NULL DEFAULT ''");
  if (!columns.rows.some((column) => column.name === "complexity")) await db.execute("ALTER TABLE dsa_questions ADD COLUMN complexity TEXT NOT NULL DEFAULT ''");
};

const seedQuestionBank = async (db, questions = []) => {
  const existingResult = await db.execute("SELECT id, source_hash FROM dsa_questions");
  const existingHashes = new Map(existingResult.rows.map((row) => [row.id, row.source_hash]));
  let statements = [];
  let questionsInBatch = 0;

  const flush = async () => {
    if (!statements.length) return;
    await db.batch(statements, "write");
    statements = [];
    questionsInBatch = 0;
  };

  for (const question of questions) {
    const sourceHash = createHash("sha256").update(JSON.stringify(question)).digest("hex");
    if (existingHashes.get(question.id) === sourceHash) continue;

    const sampleCases = new Set((question.sampleTestCases || []).map((item) => `${item.input}\u0000${item.expectedOutput}`));
    statements.push({
      sql: `INSERT INTO dsa_questions (id, topic_id, title, difficulty, prompt, constraints_json, examples_json, starter_code_json, checker_key, leetcode_number, explanation, complexity, source_hash, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET topic_id=excluded.topic_id, title=excluded.title, difficulty=excluded.difficulty,
              prompt=excluded.prompt, constraints_json=excluded.constraints_json, examples_json=excluded.examples_json,
              starter_code_json=excluded.starter_code_json, checker_key=excluded.checker_key, leetcode_number=excluded.leetcode_number,
              explanation=excluded.explanation, complexity=excluded.complexity, source_hash=excluded.source_hash, updated_at=CURRENT_TIMESTAMP`,
      args: [question.id, question.topicId, question.title, question.difficulty, question.prompt,
        JSON.stringify(question.constraints || []), JSON.stringify(question.examples || []),
        JSON.stringify(question.starterCode || {}), question.checkerKey || null, question.leetcodeNumber || null,
        question.explanation || "", question.complexity || "", sourceHash],
    }, { sql: "DELETE FROM dsa_test_cases WHERE question_id = ?", args: [question.id] });

    (question.testCases || []).forEach((testCase, index) => {
      const isHidden = !sampleCases.has(`${testCase.input}\u0000${testCase.expectedOutput}`);
      statements.push({
        sql: "INSERT INTO dsa_test_cases (question_id, ordinal, input, expected_output, is_hidden) VALUES (?, ?, ?, ?, ?)",
        args: [question.id, index + 1, String(testCase.input), String(testCase.expectedOutput), isHidden ? 1 : 0],
      });
    });
    questionsInBatch += 1;
    if (questionsInBatch >= 10) await flush();
  }
  await flush();
};

const initialize = async (questions = []) => {
  if (initializationPromise) return initializationPromise;
  initializationPromise = (async () => {
    const db = getClient();
    await ensureSchema(db);
    await seedQuestionBank(db, questions);
    return true;
  })().catch((error) => {
    initializationPromise = null;
    throw error;
  });
  return initializationPromise;
};

const readyClient = async () => {
  await initialize(require("../data/codePracticeQuestionBank"));
  return getClient();
};

const listQuestions = async () => {
  const db = await readyClient();
  const [questionsResult, samplesResult, caseCountsResult] = await Promise.all([
    db.execute("SELECT * FROM dsa_questions ORDER BY rowid"),
    db.execute("SELECT question_id, input, expected_output FROM dsa_test_cases WHERE is_hidden = 0 ORDER BY question_id, ordinal"),
    db.execute("SELECT question_id, COUNT(*) AS total FROM dsa_test_cases GROUP BY question_id"),
  ]);
  const caseCounts = new Map(caseCountsResult.rows.map((row) => [row.question_id, Number(row.total)]));
  const samplesByQuestion = new Map();
  samplesResult.rows.forEach((row) => {
    if (!samplesByQuestion.has(row.question_id)) samplesByQuestion.set(row.question_id, []);
    samplesByQuestion.get(row.question_id).push({ input: row.input, expectedOutput: row.expected_output });
  });
  return questionsResult.rows.map((row) => ({
    ...questionToRecord(row),
    sampleTestCases: samplesByQuestion.get(row.id) || [],
    testCaseCount: caseCounts.get(row.id) || 0,
  }));
};

const getQuestion = async (questionId) => {
  const db = await readyClient();
  const result = await db.execute({ sql: "SELECT * FROM dsa_questions WHERE id = ?", args: [questionId] });
  if (!result.rows.length) return null;
  const question = questionToRecord(result.rows[0]);
  const caseResult = await db.execute({
    sql: "SELECT input, expected_output, is_hidden FROM dsa_test_cases WHERE question_id = ? ORDER BY ordinal",
    args: [questionId],
  });
  question.testCases = caseResult.rows
    .map((row) => ({ input: row.input, expectedOutput: row.expected_output }));
  question.sampleTestCases = caseResult.rows.filter((row) => Number(row.is_hidden) === 0)
    .map((row) => ({ input: row.input, expectedOutput: row.expected_output }));
  return question;
};

const getSolvedProblems = async (studentId) => {
  const db = await readyClient();
  const result = await db.execute({
    sql: "SELECT question_id, language, solution_code, solved_at FROM dsa_solved_problems WHERE student_id = ?",
    args: [String(studentId)],
  });
  return new Map(result.rows.map((row) => [row.question_id, {
    language: row.language,
    sourceCode: row.solution_code,
    solvedAt: row.solved_at,
  }]));
};

const getDailyAssignments = async (studentId, dateKey, questions = []) => {
  const db = await readyClient();
  let result = await db.execute({
    sql: `SELECT slot, question_id, is_completed FROM dsa_daily_assignments
          WHERE student_id = ? AND date_key = ? ORDER BY slot`,
    args: [String(studentId), dateKey],
  });
  if (!result.rows.length && questions.length >= 3) {
    const stableSeed = `${studentId}:${dateKey}`;
    let hash = 0;
    for (const char of stableSeed) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
    const start = hash % questions.length;
    const selected = Array.from({ length: 3 }, (_, slot) => questions[(start + slot) % questions.length]);
    await db.batch(selected.map((question, index) => ({
      sql: `INSERT INTO dsa_daily_assignments (student_id, date_key, slot, question_id)
            VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`,
      args: [String(studentId), dateKey, index + 1, question.id],
    })), "write");
    result = await db.execute({
      sql: `SELECT slot, question_id, is_completed FROM dsa_daily_assignments
            WHERE student_id = ? AND date_key = ? ORDER BY slot`,
      args: [String(studentId), dateKey],
    });
  }
  const byId = new Map(questions.map((question) => [question.id, question]));
  return result.rows.map((row) => ({
    slot: Number(row.slot),
    questionId: row.question_id,
    isCompleted: Number(row.is_completed) === 1,
    question: byId.get(row.question_id) || null,
  })).filter((assignment) => assignment.question);
};

const completeDailyAssignment = async (studentId, questionId, dateKey) => {
  const db = await readyClient();
  await db.execute({
    sql: `UPDATE dsa_daily_assignments SET is_completed = 1, completed_at = CURRENT_TIMESTAMP
          WHERE student_id = ? AND question_id = ? AND date_key = ?`,
    args: [String(studentId), questionId, dateKey],
  });
  const result = await db.execute({
    sql: `SELECT COUNT(*) AS total, SUM(is_completed) AS completed FROM dsa_daily_assignments
          WHERE student_id = ? AND date_key = ?`,
    args: [String(studentId), dateKey],
  });
  return { total: Number(result.rows[0]?.total || 0), completed: Number(result.rows[0]?.completed || 0) };
};

const saveSubmission = async ({ studentId, questionId, language, action, passedCount, totalCases, accepted, sourceCode }) => {
  const db = await readyClient();
  const statements = [{
    sql: `INSERT INTO dsa_submissions (student_id, question_id, language, action, passed_count, total_cases, accepted)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [String(studentId), questionId, language, action, passedCount, totalCases, accepted ? 1 : 0],
  }];
  if (accepted) {
    statements.push({
      sql: `INSERT INTO dsa_solved_problems (student_id, question_id, language, solution_code, solved_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(student_id, question_id) DO UPDATE SET language=excluded.language,
              solution_code=excluded.solution_code, solved_at=CURRENT_TIMESTAMP`,
      args: [String(studentId), questionId, language, sourceCode],
    });
  }
  await db.batch(statements, "write");
};

const close = async () => {
  if (client) {
    await client.close();
    client = null;
    initializationPromise = null;
  }
};

module.exports = { initialize, listQuestions, getQuestion, getSolvedProblems, getDailyAssignments, completeDailyAssignment, saveSubmission, close };
