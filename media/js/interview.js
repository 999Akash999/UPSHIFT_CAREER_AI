async function submitLiveInterviewAnswer(sessionId) {
  const input = document.getElementById("liveAnswerInput");
  const qElem = document.getElementById("currentQuestionDisplay");
  if (!input || !qElem) return;

  const question = qElem.textContent.trim();
  const answer = input.value.trim();
  if (!answer) return;

  const submitBtn = document.querySelector("button[onclick*='submitLiveInterviewAnswer']");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Evaluating STAR Rubric...";
  }

  try {
    const res = await fetch("/student/interview/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, question, answer })
    });

    const data = await res.json();
    if (data.success) {
      window.location.reload();
    } else {
      alert(data.message || "Could not evaluate response.");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Answer to AI →";
      }
    }
  } catch (err) {
    console.error("Interview submission failed:", err);
    alert("Connection error. Please try again.");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Answer to AI →";
    }
  }
}