function getDailyTaskInputs() {
  return [...document.querySelectorAll("[data-daily-task-checkbox]")];
}

function updateDailyTaskPreview() {
  const inputs = getDailyTaskInputs();
  const completed = inputs.filter((input) => input.checked).length;
  const progressValue = inputs.length ? Math.round((completed / inputs.length) * 100) : 0;
  const count = document.getElementById("taskProgressCount");
  const percent = document.getElementById("taskProgressPercent");
  const fill = document.getElementById("taskProgressFill");
  const progress = document.querySelector(".task-progress-track[role='progressbar'], .daily-progress-track[role='progressbar']");
  if (count) count.textContent = `${completed} / ${inputs.length} complete`;
  if (percent) percent.textContent = `${progressValue}%`;
  if (fill) fill.style.width = `${progressValue}%`;
  progress?.setAttribute("aria-valuenow", progressValue);

  const saveButton = document.getElementById("dailyTaskSaveButton");
  const hasChanges = inputs.some((input) => String(input.checked) !== input.dataset.savedChecked);
  if (saveButton) {
    saveButton.disabled = !hasChanges;
    saveButton.textContent = hasChanges ? "Save progress" : "Progress saved";
  }
  return hasChanges;
}

function stageDailyTask(checkboxElem) {
  const row = checkboxElem.closest("[data-task-row]");
  row?.classList.toggle("done", checkboxElem.checked);
  const title = row?.querySelector(".dashboard-task-title");
  if (title) {
    title.style.textDecoration = checkboxElem.checked ? "line-through" : "none";
    title.style.color = checkboxElem.checked ? "#9187a2" : "#302749";
  }
  const hint = row?.querySelector(".daily-task-copy small");
  if (hint) hint.textContent = checkboxElem.checked ? "Ready to save — nice work!" : "This change is not saved yet.";
  const xp = row?.querySelector(".daily-task-xp");
  if (xp) xp.textContent = checkboxElem.checked ? "Ready" : "+10 XP";
  const status = document.getElementById("taskUpdateStatus");
  if (status) status.textContent = "You have unsaved task changes. Save today’s progress to update your streak.";
  updateDailyTaskPreview();
}

async function saveDailyTasks() {
  const inputs = getDailyTaskInputs();
  const saveButton = document.getElementById("dailyTaskSaveButton");
  const status = document.getElementById("taskUpdateStatus");
  if (!saveButton || !updateDailyTaskPreview()) return;

  saveButton.disabled = true;
  saveButton.textContent = "Saving…";
  if (status) status.textContent = "Saving your tasks and updating today’s streak…";
  try {
    const response = await fetch("/student/daily-tasks/save", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ completedTaskIds: inputs.filter((input) => input.checked).map((input) => input.dataset.taskId) }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || `Could not save progress (${response.status}).`);

    inputs.forEach((input) => { input.dataset.savedChecked = String(input.checked); });
    const count = document.getElementById("taskProgressCount");
    const percent = document.getElementById("taskProgressPercent");
    const fill = document.getElementById("taskProgressFill");
    const progress = document.querySelector(".task-progress-track[role='progressbar'], .daily-progress-track[role='progressbar']");
    if (count) count.textContent = `${data.completedTasks} / ${data.totalTasks} complete`;
    if (percent) percent.textContent = `${data.progress}%`;
    if (fill) fill.style.width = `${data.progress}%`;
    progress?.setAttribute("aria-valuenow", data.progress);

    const streakText = `${data.streak} day streak`;
    const topbarStreak = document.getElementById("currentStreakBadge");
    const activityStreak = document.getElementById("activityStreakValue");
    const completedMetric = document.getElementById("completedTaskMetric");
    const dailyStreakValue = document.getElementById("currentStreakValue");
    if (topbarStreak) topbarStreak.textContent = streakText;
    if (activityStreak) activityStreak.textContent = streakText;
    if (completedMetric) completedMetric.textContent = data.completedTasks;
    if (dailyStreakValue) dailyStreakValue.textContent = data.streak;
    const streakSummary = document.querySelector(".streak-summary");
    const streakStatus = document.getElementById("currentStreakStatus");
    if (data.activeToday) {
      streakSummary?.classList.add("streak-active-today");
      if (streakStatus) streakStatus.textContent = "Today’s streak is safe";
    }

    if (data.activityDate) {
      const activityCell = document.querySelector(`[data-activity-date="${data.activityDate}"]`);
      if (activityCell) {
        const countToday = data.activityCountToday || 0;
        activityCell.className = `heatmap-cell today level-${Math.min(4, countToday)}`;
        activityCell.title = `${countToday} task${countToday === 1 ? "" : "s"} · today`;
        activityCell.setAttribute("aria-label", `${countToday} task${countToday === 1 ? "" : "s"} completed · today`);
      }
    }

    const score = document.getElementById("employabilityScoreValue");
    if (score && data.employabilityScore !== null) score.textContent = data.employabilityScore;
    inputs.forEach((input) => {
      const row = input.closest("[data-task-row]");
      const hint = row?.querySelector(".daily-task-copy small");
      const xp = row?.querySelector(".daily-task-xp");
      if (hint) hint.textContent = input.checked ? "Completed — nice work!" : "One focused session is enough to make progress.";
      if (xp) xp.textContent = input.checked ? "Done" : "+10 XP";
    });
    if (status) status.textContent = data.activeToday
      ? `Saved! Your ${data.streak}-day streak is active and today’s dashboard box is filled.`
      : "Today’s progress saved.";
    updateDailyTaskPreview();
  } catch (error) {
    if (status) status.textContent = error.message || "Could not save progress. Please try again.";
    console.error("Daily task save failed:", error);
    updateDailyTaskPreview();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  updateDailyTaskPreview();

  document.querySelectorAll("[data-daily-task-checkbox]").forEach((input) => {
    input.addEventListener("change", () => stageDailyTask(input));
  });

  document.getElementById("dailyTaskSaveButton")?.addEventListener("click", (event) => {
    event.preventDefault();
    saveDailyTasks();
  });

  // The daily tasks page has a regular form for accessibility and fallback,
  // but save it with fetch so the streak and progress update in place.
  const form = document.getElementById("dailyTasksForm");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    saveDailyTasks();
  });
});
