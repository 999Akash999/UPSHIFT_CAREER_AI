document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("roadmapChatPanel");
  const messages = document.getElementById("roadmapChatMessages");
  const answerForm = document.getElementById("roadmapChatAnswerForm");
  const inputHost = document.getElementById("roadmapChatInput");
  const continueButton = document.getElementById("roadmapChatContinue");
  const status = document.getElementById("roadmapChatStatus");
  const openButtons = document.querySelectorAll("#openRoadmapChat, [data-start-roadmap-chat]");
  const closeButton = document.getElementById("closeRoadmapChat");

  const appendMessage = (sender, text) => {
    const bubble = document.createElement("div");
    bubble.textContent = text;
    bubble.style.cssText = `max-width: min(88%, 680px); padding: .65rem .85rem; border-radius: 12px; line-height: 1.45; font-size: .85rem; white-space: pre-wrap; ${sender === "user" ? "justify-self:end;background:#7954c8;color:#fff;" : "justify-self:start;background:#f4f0fa;color:#463b58;"}`;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
  };

  const steps = [
    { key: "targetRole", question: "What role are you preparing for? You can change the role from your profile.", type: "text", placeholder: "e.g. Backend Developer" },
    { key: "experienceLevel", question: "How would you describe your current level in this area?", type: "select", options: [["beginner", "Beginner"], ["intermediate", "Intermediate"], ["advanced", "Advanced"]] },
    { key: "hoursPerDay", question: "How much focused study time can you give on each study day?", type: "select", options: [["0.5", "30 minutes"], ["1", "1 hour"], ["1.5", "1.5 hours"], ["2", "2 hours"], ["3", "3 hours"], ["4", "4 hours"], ["6", "6 hours"]] },
    { key: "daysPerWeek", question: "How many days each week do you want to study? The other days will be rest or catch-up days.", type: "select", options: [["3", "3 days"], ["4", "4 days"], ["5", "5 days"], ["6", "6 days"], ["7", "7 days"]] },
    { key: "focusAreas", question: "Any topics or skills you especially want to focus on? This is optional.", type: "textarea", placeholder: "e.g. React, SQL, system design; or leave blank" },
  ];

  let answers = {};
  let stepIndex = 0;

  const renderStep = () => {
    const step = steps[stepIndex];
    inputHost.replaceChildren();
    status.textContent = "";
    appendMessage("coach", step.question);

    const field = step.type === "select" ? document.createElement("select") : document.createElement(step.type === "textarea" ? "textarea" : "input");
    field.name = step.key;
    field.required = step.key !== "focusAreas";
    field.setAttribute("aria-label", step.question);
    field.style.cssText = "box-sizing:border-box;width:100%;min-height:42px;border:1px solid #ded5eb;border-radius:9px;padding:.65rem .75rem;background:#fff;color:#302749;font:inherit;";

    if (step.type === "select") {
      step.options.forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        field.appendChild(option);
      });
    } else {
      field.placeholder = step.placeholder;
      if (step.type === "text") {
        field.maxLength = 100;
        field.minLength = 2;
        field.value = step.key === "targetRole" ? (document.getElementById("openRoadmapChat")?.dataset.defaultRole || "") : "";
      } else {
        field.rows = 2;
        field.maxLength = 500;
      }
    }

    inputHost.appendChild(field);
    continueButton.textContent = stepIndex === steps.length - 1 ? "Create my intensive plan" : "Continue";
    field.focus();
  };

  const startChat = () => {
    panel.style.display = "block";
    panel.scrollIntoView({ behavior: "smooth", block: "center" });
    messages.replaceChildren();
    answers = {};
    stepIndex = 0;
    appendMessage("coach", "Hi! I’ll match the roadmap to your target role and weekly availability, then organize it into daily study tasks.");
    renderStep();
  };

  openButtons.forEach((button) => button.addEventListener("click", startChat));
  closeButton?.addEventListener("click", () => { panel.style.display = "none"; });

  answerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const step = steps[stepIndex];
    const field = inputHost.querySelector(`[name="${step.key}"]`);
    const value = field.value.trim();
    if (step.key === "targetRole" && value.length < 2) {
      status.textContent = "Please enter a target role so the plan can be personalized.";
      field.focus();
      return;
    }

    answers[step.key] = value;
    const chosenLabel = step.type === "select" ? field.selectedOptions[0].textContent : (value || "No extra focus");
    appendMessage("user", chosenLabel);

    if (stepIndex < steps.length - 1) {
      stepIndex += 1;
      renderStep();
      return;
    }

    inputHost.style.display = "none";
    continueButton.disabled = true;
    continueButton.textContent = "Building your roadmap…";
    status.style.color = "#68568a";
    status.textContent = `Building a daily curriculum for ${answers.targetRole}. This can take a little while…`;
    try {
      const response = await fetch("/student/roadmap/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(answers),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not create the roadmap. Please try again.");
      appendMessage("coach", "Your daily schedule and milestones are ready. Opening your new roadmap…");
      window.location.assign("/student/roadmap");
    } catch (error) {
      inputHost.style.display = "block";
      continueButton.disabled = false;
      continueButton.textContent = "Try again";
      status.style.color = "#a33b50";
      status.textContent = error instanceof TypeError && error.message === "Failed to fetch"
        ? "Cannot reach the app server. Restart it in your terminal with npm start, refresh this page, and try again."
        : error.message || "Could not create the roadmap. Please try again.";
    }
  });

  // Milestone updates use an external listener so they keep working with a
  // restrictive content security policy (without inline onchange handlers).
  document.querySelectorAll("[data-roadmap-milestone]").forEach((checkbox) => {
    checkbox.addEventListener("change", async () => {
      const { roadmapId, weekNumber, milestoneIndex } = checkbox.dataset;
      checkbox.disabled = true;
      try {
        const response = await fetch(`/student/roadmap/${roadmapId}/week/${weekNumber}/milestone/${milestoneIndex}`, {
          method: "PATCH",
          headers: { Accept: "application/json" },
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Could not update milestone.");
        const completion = document.getElementById("roadmapCompletionPercentage");
        if (completion && Number.isFinite(result.completionPercentage)) completion.textContent = result.completionPercentage;
      } catch (error) {
        checkbox.checked = !checkbox.checked;
        console.error("Milestone sync failure:", error);
      } finally {
        checkbox.disabled = false;
      }
    });
  });

  const taskSaveStatus = document.getElementById("roadmapTaskSaveStatus");
  document.querySelectorAll("[data-roadmap-day-task]").forEach((checkbox) => {
    checkbox.addEventListener("change", async () => {
      const { roadmapId, weekNumber, dayIndex } = checkbox.dataset;
      const taskRow = checkbox.closest(".roadmap-day-task");
      const taskText = taskRow?.querySelector("label > span");
      checkbox.disabled = true;
      if (taskSaveStatus) taskSaveStatus.textContent = "Saving your daily progress…";
      try {
        const response = await fetch(`/student/roadmap/${roadmapId}/week/${weekNumber}/day/${dayIndex}`, {
          method: "PATCH",
          headers: { Accept: "application/json" },
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Could not save this daily task.");
        const completion = document.getElementById("roadmapCompletionPercentage");
        if (completion && Number.isFinite(result.completionPercentage)) completion.textContent = result.completionPercentage;
        taskRow?.classList.toggle("is-complete", result.completed);
        if (taskText) taskText.style.textDecoration = result.completed ? "line-through" : "none";
        if (taskText) taskText.style.color = result.completed ? "#958ba3" : "";
        if (taskSaveStatus) taskSaveStatus.textContent = "Saved. Employability score updated.";
      } catch (error) {
        checkbox.checked = !checkbox.checked;
        if (taskSaveStatus) taskSaveStatus.textContent = error.message || "Could not save this daily task. Try again.";
      } finally {
        checkbox.disabled = false;
      }
    });
  });
});
