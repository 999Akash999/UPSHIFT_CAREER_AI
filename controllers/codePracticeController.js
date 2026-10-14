const topics = [
  { id: "arrays", name: "Arrays — Basics, Hashing & Matrix", description: "PDF levels: basic and hard arrays, hashing, prefix sums, and matrix problems." },
  { id: "strings", name: "Strings — Basics & Hashing", description: "PDF levels: string basics, string hashing, matching, and string patterns." },
  { id: "two-pointers", name: "Two Pointers & Sorting", description: "PDF levels: two-pointer patterns with sorting and sequence problems." },
  { id: "sliding-window", name: "Sliding Window", description: "PDF levels: fixed and variable windows over arrays and strings." },
  { id: "stack-queue", name: "Stacks, Queues & Monotonic Stack", description: "PDF levels: stack basics, number patterns, monotonic stack, and expression evaluation." },
  { id: "binary-search", name: "Binary Search — Bounds & Answer Search", description: "PDF levels: basic search, bound search, and binary search on the answer." },
  { id: "linked-lists", name: "Linked Lists — Core Patterns", description: "PDF levels: fast and slow pointers, reversal, dummy node, and interview problems." },
  { id: "trees", name: "Trees — Traversal, BST, LCA & Construction", description: "PDF levels: DFS, validation, LCA, construction, and advanced BST problems." },
  { id: "heaps", name: "Heaps, Top K & Merge Sort", description: "PDF levels: top-K selection, heap patterns, and merge-sort problems." },
  { id: "graphs", name: "Graphs — BFS, DFS, Paths & MST", description: "PDF levels: BFS, topological sort, union-find, shortest paths, and MST." },
  { id: "backtracking", name: "Backtracking — Grid & Combination Sum", description: "PDF levels: foundation, combination-sum patterns, and grid backtracking." },
  { id: "dynamic-programming", name: "Dynamic Programming — Knapsack to Grid DP", description: "PDF levels: knapsack, subsequences, tabulation, grid DP, and stack DP." },
  { id: "greedy", name: "Greedy — Classic, Interval & Heap", description: "PDF levels: classic greedy, interval greedy, and heap plus greedy." },
  { id: "tries", name: "Tries — Basics & Advanced", description: "PDF levels: trie foundations, advanced trie, and interview problems." },
  { id: "intervals", name: "Intervals & Segment Tree", description: "PDF levels: interval patterns and segment-tree applications." },
  { id: "bit-manipulation", name: "Bit Manipulation, XOR & Bitmasking", description: "PDF levels: bit basics, XOR patterns, and bitmasking." },
];
const dsaStore = require("../services/dsaTursoService");
const { runTestCases, getConfig } = require("../services/pistonService");
const { recordDsaPractice } = require("../services/streakService");
const { getDateKeyIST } = require("../utils/timeHelpers");
const supportedLanguages = ["javascript", "python", "java", "c", "cpp"];

exports.getPage = async (req, res) => {
  const [questions, solvedProblems] = await Promise.all([
    dsaStore.listQuestions(),
    dsaStore.getSolvedProblems(req.user._id),
  ]);
  const todayKey = getDateKeyIST();
  const dailyAssignments = await dsaStore.getDailyAssignments(req.user._id, todayKey, questions);
  const topicCounts = new Map();
  questions.forEach((question) => topicCounts.set(question.topicId, (topicCounts.get(question.topicId) || 0) + 1));
  const publicQuestions = questions.map((question, index) => {
    const publicQuestion = {
      ...question,
      questionNumber: index + 1,
      sampleTestCases: question.sampleTestCases,
      isSolved: solvedProblems.has(question.id),
      savedSolution: solvedProblems.get(question.id) || null,
    };
    delete publicQuestion.leetcodeNumber;
    return publicQuestion;
  });
  const safeQuestionJson = JSON.stringify(publicQuestions).replace(/</g, "\\u003c");
  const publicDailyAssignments = dailyAssignments.map((assignment) => ({
    slot: assignment.slot,
    questionId: assignment.questionId,
    isCompleted: assignment.isCompleted,
    title: assignment.question.title,
    difficulty: assignment.question.difficulty,
  }));
  res.render("student/code-practice", {
    title: "DSA Practice",
    topics: topics.map((topic) => ({ ...topic, questionCount: topicCounts.get(topic.id) || 0 })),
    questions: publicQuestions,
    questionsJson: safeQuestionJson,
    dailyAssignments: publicDailyAssignments,
    dailyAssignmentsJson: JSON.stringify(publicDailyAssignments).replace(/</g, "\\u003c"),
    dailyCompletedCount: publicDailyAssignments.filter((assignment) => assignment.isCompleted).length,
    questionCount: questions.length,
    solvedQuestionCount: questions.filter((question) => solvedProblems.has(question.id)).length,
    targetQuestionCount: 1000,
    runnerConfigured: Boolean(String(process.env.PISTON_URL || "").trim()),
  });
};

exports.runCode = async (req, res) => {
  let runner;
  let failureSource = "turso";
  try {
    const { questionId, language, sourceCode, action } = req.body || {};
    const question = await dsaStore.getQuestion(questionId);
    if (!question) return res.status(404).json({ error: "Question not found." });
    if (!supportedLanguages.includes(language)) return res.status(400).json({ error: "Choose a supported language." });
    if (typeof sourceCode !== "string" || !sourceCode.trim() || sourceCode.length > 20000) {
      return res.status(400).json({ error: "Code must be between 1 and 20,000 characters." });
    }

    failureSource = "runner";
    runner = getConfig();
    if (!["run", "submit"].includes(action)) return res.status(400).json({ error: "Choose Run or Submit." });
    const testCases = action === "run" ? question.sampleTestCases : question.testCases;
    if (!testCases?.length) return res.status(422).json({ error: "No test cases are configured for this question yet." });
    failureSource = "runner";
    const results = await runTestCases({ sourceCode, language, testCases, checkerKey: question.checkerKey });
    const passedCount = results.filter((result) => result.passed).length;
    const accepted = action === "submit" && results.length > 0 && passedCount === results.length;
    failureSource = "turso";
    await dsaStore.saveSubmission({
      studentId: req.user._id,
      questionId,
      language,
      action,
      passedCount,
      totalCases: results.length,
      accepted,
      sourceCode,
    });
    let streak = null;
    if (accepted) {
      const dailyProgress = await dsaStore.completeDailyAssignment(req.user._id, questionId, getDateKeyIST());
      failureSource = "mongo";
      try {
        const student = await recordDsaPractice(req.student._id);
        streak = { current: student?.dsaStreak || 0, best: student?.dsaBestStreak || 0 };
      } catch (streakError) {
        console.error("Accepted solution saved in Turso, but MongoDB streak update failed:", streakError.message);
      }
      return res.json({ success: true, accepted, results, streak, dailyProgress });
    }
    res.json({ success: true, accepted, results, streak });
  } catch (error) {
    if (failureSource === "turso") {
      console.error("DSA practice Turso database failed:", error.message);
      return res.status(503).json({ error: "The DSA practice database is unavailable. Check TURSO_URL and TURSO_SECRET." });
    }
    if (!runner) return res.status(503).json({ error: "Code runner is not configured. Set PISTON_URL and try again." });
    console.error("Coding practice runner failed:", error.message);
    res.status(502).json({ error: "The code runner is unavailable right now. Please try again." });
  }
};
