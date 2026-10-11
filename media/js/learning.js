document.addEventListener("DOMContentLoaded", () => {
  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };

  const renderLesson = (container, lesson) => {
    container.replaceChildren();
    const title = make("h4", "daily-learning-title", lesson.title || "Today's lesson");
    container.append(title);
    if (lesson.summary) {
      container.append(make("h5", "", "Lesson overview"), make("p", "daily-learning-summary", lesson.summary));
    }
    if (lesson.difficulty && lesson.difficulty !== "Standard") {
      const levelNote = lesson.difficultySource === "assessment" ? "adjusted from your recent assessment" : "based on your roadmap plan";
      container.append(make("p", "daily-learning-level", `Lesson level: ${lesson.difficulty} · ${levelNote}`));
    }
    const appendList = (heading, items, ordered = false) => {
      if (!Array.isArray(items) || !items.some((item) => typeof item === "string" && item.trim())) return;
      container.append(make("h5", "", heading));
      const list = make(ordered ? "ol" : "ul", "daily-learning-concepts");
      items.filter((item) => typeof item === "string" && item.trim()).forEach((item) => list.append(make("li", "", item)));
      container.append(list);
    };
    appendList("Before you begin", lesson.prerequisites);
    if (lesson.lesson) {
      container.append(make("h5", "", "Deep dive"), make("div", "daily-learning-lesson", lesson.lesson));
    }
    appendList("Key ideas explained", lesson.keyConcepts);
    appendList("Step-by-step walkthrough", lesson.walkthrough, true);
    if (lesson.example) {
      const example = make("p", "daily-learning-example");
      example.append(make("strong", "", "Worked example: "), document.createTextNode(lesson.example));
      container.append(example);
    }
    appendList("Common mistakes to avoid", lesson.commonMistakes);
    appendList("Practice tasks", lesson.practiceTasks, true);
    appendList("Recap", lesson.recap);

    if (lesson.quiz?.question && Array.isArray(lesson.quiz.options)) {
      const quiz = make("form", "daily-learning-quiz");
      quiz.append(make("h5", "", "Quick test"), make("p", "daily-quiz-question", lesson.quiz.question));
      lesson.quiz.options.forEach((option, index) => {
        const label = make("label", "daily-quiz-option");
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "daily-quiz-answer";
        radio.value = String(index);
        radio.required = true;
        label.append(radio, make("span", "", option));
        quiz.append(label);
      });
      const submit = make("button", "daily-quiz-submit", "Check answer");
      submit.type = "submit";
      const result = make("p", "daily-quiz-result");
      result.setAttribute("role", "status");
      result.setAttribute("aria-live", "polite");
      quiz.append(submit, result);
      quiz.addEventListener("submit", (event) => {
        event.preventDefault();
        const selected = quiz.querySelector('input[name="daily-quiz-answer"]:checked');
        if (!selected) return;
        const correct = Number(selected.value) === Number(lesson.quiz.correctIndex);
        result.textContent = correct
          ? `Correct! ${lesson.quiz.explanation || "Nice work."}`
          : `Not quite. Review the lesson and try again. ${lesson.quiz.explanation || ""}`;
        result.classList.toggle("is-correct", correct);
        result.classList.toggle("is-incorrect", !correct);
      });
      container.append(quiz);
    }
    container.hidden = false;
  };

  document.querySelectorAll("[data-daily-learn]").forEach((button) => {
    button.addEventListener("click", async () => {
      const container = button.parentElement.querySelector("[data-learning-content]");
      if (!container) return;
      if (!container.hidden && container.dataset.loaded === "true") {
        container.hidden = true;
        button.parentElement.classList.remove("is-learning-expanded");
        button.textContent = "Learn this topic";
        return;
      }
      button.disabled = true;
      button.textContent = "Loading lesson…";
      try {
        const { roadmapId, weekNumber, dayIndex } = button.dataset;
        const response = await fetch(`/student/roadmap/${roadmapId}/week/${weekNumber}/day/${dayIndex}/learn`, {
          method: "POST",
          headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
          credentials: "same-origin",
        });
        const responseText = await response.text();
        let result;
        try {
          result = JSON.parse(responseText);
        } catch {
          throw new Error(`The lesson service returned an invalid response (HTTP ${response.status}). Restart the app server and refresh the roadmap.`);
        }
        if (!response.ok || !result.success) throw new Error(result.error || "Could not load this lesson.");
        renderLesson(container, result.lesson);
        container.dataset.loaded = "true";
        button.parentElement.classList.add("is-learning-expanded");
        button.textContent = "Hide lesson";
      } catch (error) {
        container.dataset.loaded = "false";
        container.hidden = false;
        button.parentElement.classList.add("is-learning-expanded");
        container.replaceChildren(make("p", "daily-learning-error", error.message || "Could not load this lesson. Try again."));
        button.textContent = "Try lesson again";
      } finally {
        button.disabled = false;
      }
    });
  });
});
