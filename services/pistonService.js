const LANGUAGE_NAMES = {
  javascript: ["javascript", "nodejs"],
  python: ["python", "python3"],
  java: ["java"],
  c: ["c"],
  cpp: ["c++", "cpp"],
};

let cachedRuntimes = null;
let cachedRuntimesAt = 0;

const getConfig = () => {
  const rawUrl = String(process.env.PISTON_URL || "").trim();
  if (!rawUrl) throw new Error("The Piston runner is not configured yet.");
  const parsed = new URL(rawUrl);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error("PISTON_URL must be an HTTP or HTTPS URL without embedded credentials.");
  }
  const base = parsed.toString().replace(/\/$/, "");
  const apiUrl = /\/api\/v2$/i.test(base) ? base : `${base}/api/v2`;
  const rawHeaders = String(process.env.PISTON_AUTH_HEADERS || "").trim();
  let authHeaders = {};
  if (rawHeaders) {
    authHeaders = JSON.parse(rawHeaders);
    if (!authHeaders || typeof authHeaders !== "object" || Array.isArray(authHeaders) || Object.values(authHeaders).some((value) => typeof value !== "string")) {
      throw new Error("PISTON_AUTH_HEADERS must be a JSON object of string headers.");
    }
  }
  return { apiUrl, authHeaders };
};

const request = async (url, options = {}) => {
  const { authHeaders } = getConfig();
  const response = await fetch(url, {
    ...options,
    headers: { Accept: "application/json", ...authHeaders, ...(options.headers || {}) },
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `Piston returned ${response.status}.`);
  return payload;
};

const getRuntime = async (language) => {
  const { apiUrl } = getConfig();
  if (!cachedRuntimes || Date.now() - cachedRuntimesAt > 10 * 60 * 1000) {
    cachedRuntimes = await request(`${apiUrl}/runtimes`);
    cachedRuntimesAt = Date.now();
  }
  const acceptedNames = LANGUAGE_NAMES[language].map((name) => name.toLowerCase());
  const matches = Array.isArray(cachedRuntimes) ? cachedRuntimes.filter((runtime) => {
    const names = [runtime.language, ...(runtime.aliases || [])].map((name) => String(name).toLowerCase());
    return names.some((name) => acceptedNames.includes(name));
  }) : [];
  const preferred = language === "python"
    ? matches.find((runtime) => String(runtime.version).startsWith("3."))
    : null;
  const runtime = preferred || matches[0];
  if (!runtime) throw new Error(`The configured Piston runner does not provide ${language}.`);
  return runtime;
};

const execute = async ({ sourceCode, language, stdin }) => {
  const { apiUrl } = getConfig();
  const runtime = await getRuntime(language);
  const extension = { javascript: "js", python: "py", java: "java", c: "c", cpp: "cpp" }[language];
  const result = await request(`${apiUrl}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: runtime.language,
      version: runtime.version,
      files: [{ name: `main.${extension}`, content: sourceCode }],
      stdin,
      compile_timeout: 10000,
      run_timeout: 3000,
      compile_cpu_time: 10000,
      run_cpu_time: 3000,
      compile_memory_limit: 128000000,
      run_memory_limit: 128000000,
    }),
  });
  return result;
};

const normalizeOutput = (value) => String(value || "").trim().replace(/\s+/g, " ");

const checkAnswer = (checkerKey, input, actualOutput, expectedOutput) => {
  if (checkerKey === "pair-sum-indices") {
    const values = String(input).trim().split(/\s+/).map(Number);
    const n = values[0];
    const array = values.slice(1, n + 1);
    const goal = values[n + 1];
    const answer = String(actualOutput).trim().split(/\s+/).map(Number);
    return Number.isInteger(n) && answer.length === 2 && answer.every(Number.isInteger)
      && answer[0] >= 0 && answer[1] >= 0 && answer[0] < n && answer[1] < n
      && answer[0] !== answer[1] && array[answer[0]] + array[answer[1]] === goal;
  }
  if (checkerKey === "integer-result") {
    const actual = String(actualOutput).trim();
    const expected = String(expectedOutput).trim();
    return /^[-+]?\d+$/.test(actual) && actual === expected;
  }
  return normalizeOutput(actualOutput) === normalizeOutput(expectedOutput);
};

const runTestCases = async ({ sourceCode, language, testCases, checkerKey }) => {
  const results = [];
  for (let index = 0; index < testCases.length; index += 1) {
    const testCase = testCases[index];
  const result = await execute({ sourceCode, language, stdin: testCase.input });
  const compile = result.compile || {};
  const run = result.run || {};
  const compileFailed = Boolean(compile.code) || Boolean(compile.signal) || Boolean(compile.status);
  const runFailed = Boolean(run.code) || Boolean(run.signal) || Boolean(run.status);
  if (compileFailed || runFailed) {
    results.push({
      index: index + 1,
      passed: false,
      status: compileFailed ? "Compilation error" : run.status || "Execution failed",
      message: String(compile.stderr || compile.output || run.stderr || run.output || run.message || "").slice(0, 2000),
    });
    for (let pendingIndex = index + 1; pendingIndex < testCases.length; pendingIndex += 1) {
      results.push({ index: pendingIndex + 1, passed: false, status: "Not run", message: "Stopped after the first execution error." });
    }
    break;
  }
  const passed = checkAnswer(checkerKey, testCase.input, run.stdout, testCase.expectedOutput);
  results.push({
    index: index + 1,
    passed,
    status: passed ? "Passed" : "Wrong answer",
    actualOutput: String(run.stdout || "").slice(0, 1000),
  });
  }
  return results;
};

module.exports = { getConfig, runTestCases };
