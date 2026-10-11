(() => {
  const $ = (id) => document.getElementById(id);
  const setup = $("interviewSetup");
  const room = $("interviewRoom");
  const consent = $("monitoringConsent");
  const startButton = $("startInterviewButton");
  const submitButton = $("submitAnswerButton");
  const answerInput = $("mockAnswerText");
  const feedbackBox = $("mockFeedbackBox");
  const finalScoreBox = $("finalScoreBox");

  let sessionId = null;
  let questionNumber = 1;
  let cameraStream = null;
  let screenStream = null;
  let recognition = null;
  let speechBaseText = "";
  let isListening = false;
  let devicesReady = false;
  let isLeaving = false;
  let localWarningCount = 0;
  let lastFocusWarningAt = 0;

  consent.addEventListener("change", () => { startButton.disabled = !consent.checked; });

  const postJSON = async (url, body) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  };

  const updateDeviceStatus = (ready, message) => {
    devicesReady = ready;
    $("deviceRecovery").hidden = ready;
    $("cameraDevicePill").classList.toggle("is-warning", !ready || !isCameraLive());
    $("screenDevicePill").classList.toggle("is-warning", !ready || !isMonitorShareLive());
    answerInput.disabled = !ready;
    $("micButton").disabled = !ready;
    submitButton.disabled = !ready;
    if (message) $("deviceStatus").textContent = message;
  };

  const isCameraLive = () => Boolean(cameraStream?.getVideoTracks().some((track) => track.readyState === "live" && track.enabled));
  const getDisplaySurface = () => screenStream?.getVideoTracks()[0]?.getSettings?.().displaySurface || "unknown";
  const isMonitorShareLive = () => Boolean(screenStream?.getVideoTracks().some((track) => track.readyState === "live" && track.enabled) && getDisplaySurface() === "monitor");

  const showWarning = (message, warningCount = null) => {
    localWarningCount += warningCount === null ? 1 : 0;
    const total = warningCount === null ? localWarningCount : Math.max(localWarningCount, Number(warningCount) || 0);
    $("warningPanel").hidden = false;
    $("warningTitle").textContent = total >= 3 ? "Please keep the interview focused" : "Interview room warning";
    $("warningCountText").textContent = total
      ? `${total} monitoring warning${total === 1 ? "" : "s"} recorded. These are shown with your practice result.`
      : "Please keep the interview tab visible.";
    const item = document.createElement("li");
    item.textContent = message;
    $("warningList").prepend(item);
    while ($("warningList").children.length > 5) $("warningList").lastElementChild.remove();
  };

  const recordEvent = async (code, localMessage) => {
    if (!sessionId) {
      if (localMessage) showWarning(localMessage);
      return;
    }
    try {
      const integrityType = ({ tab_hidden: "PAGE_HIDDEN", window_blur: "WINDOW_BLUR" })[code];
      if (integrityType) {
        const result = await postJSON(`/student/interview/${sessionId}/integrity-events`, {
          eventId: window.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`,
          type: integrityType,
          details: { source: code === "tab_hidden" ? "visibilitychange" : "window_blur" },
        });
        if (result.action === "terminated") {
          showWarning(result.message, result.warningCount);
          updateDeviceStatus(false, result.message);
          releaseDevices();
          return;
        }
        showWarning(result.message || localMessage || "Interview monitoring event recorded.", result.warningCount);
        return;
      }
      const result = await postJSON("/student/interview/event", { sessionId, code });
      showWarning(result.event?.message || localMessage || "Interview monitoring event recorded.", result.warningCount);
    } catch (error) {
      showWarning(localMessage || error.message || "A monitoring event could not be saved.");
    }
  };

  const pauseInterview = (code, message) => {
    updateDeviceStatus(false, message);
    $("deviceRecoveryText").textContent = message;
    recordEvent(code, message);
  };

  const attachCamera = (stream) => {
    cameraStream = stream;
    $("cameraVideo").srcObject = stream;
    $("cameraPlaceholder").hidden = true;
    stream.getVideoTracks().forEach((track) => {
      track.addEventListener("ended", () => {
        if (!isLeaving && sessionId) pauseInterview("camera_interrupted", "Camera access stopped. Restore it before submitting another answer.");
      }, { once: true });
    });
  };

  const attachScreen = (stream) => {
    screenStream = stream;
    $("screenVideo").srcObject = stream;
    $("screenPlaceholder").hidden = true;
    stream.getVideoTracks().forEach((track) => {
      track.addEventListener("ended", () => {
        if (!isLeaving && sessionId) pauseInterview("screen_interrupted", "Full-screen sharing stopped. Share your entire monitor again to continue.");
      }, { once: true });
    });
  };

  const openDeviceStreams = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices?.getDisplayMedia) {
      throw new Error("Camera and screen sharing need a supported browser on HTTPS or localhost.");
    }

    // Request both devices directly from this button click so the screen picker
    // retains the browser's required user activation.
    const cameraRequest = isCameraLive()
      ? Promise.resolve(cameraStream)
      : navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
    const screenRequest = isMonitorShareLive()
      ? Promise.resolve(screenStream)
      : navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" },
        audio: false,
        preferCurrentTab: false,
        selfBrowserSurface: "exclude",
        surfaceSwitching: "exclude",
        monitorTypeSurfaces: "include",
      });
    const [cameraResult, screenResult] = await Promise.allSettled([cameraRequest, screenRequest]);

    if (cameraResult.status === "fulfilled" && cameraResult.value !== cameraStream) attachCamera(cameraResult.value);
    if (screenResult.status === "fulfilled" && screenResult.value !== screenStream) attachScreen(screenResult.value);

    if (cameraResult.status === "rejected") throw new Error(cameraResult.reason?.name === "NotAllowedError"
      ? "Camera permission is required. Allow camera access in your browser and try again."
      : "Could not access the camera. Check that it is connected and available.");
    if (screenResult.status === "rejected") throw new Error(screenResult.reason?.name === "NotAllowedError"
      ? "Screen sharing is required. Choose your entire monitor in the browser prompt."
      : "Could not start screen sharing. Try again and select the entire monitor.");

    if (getDisplaySurface() !== "monitor") {
      if (screenStream && screenStream !== cameraStream) screenStream.getTracks().forEach((track) => track.stop());
      screenStream = null;
      $("screenVideo").srcObject = null;
      $("screenPlaceholder").hidden = false;
      if (sessionId) await recordEvent("screen_not_monitor", "Select Entire Screen; sharing a window or browser tab is not enough.");
      throw new Error("Select “Entire Screen” in the sharing prompt. A single window or browser tab will not start this interview.");
    }
    if (!isCameraLive()) throw new Error("Camera access is not active. Reconnect your camera and try again.");

    $("cameraDevicePill").classList.remove("is-warning");
    $("screenDevicePill").classList.remove("is-warning");
    return { camera: true, screen: true, displaySurface: "monitor" };
  };

  const releaseDevices = () => {
    isLeaving = true;
    cameraStream?.getTracks().forEach((track) => track.stop());
    screenStream?.getTracks().forEach((track) => track.stop());
    cameraStream = null;
    screenStream = null;
    $("cameraVideo").srcObject = null;
    $("screenVideo").srcObject = null;
  };

  const setQuestion = (question, number) => {
    questionNumber = number;
    $("mockQuestion").textContent = question;
    $("questionProgress").innerHTML = `${number} <small>/ 10</small>`;
    $("questionProgressFill").style.width = `${Math.max(10, number * 10)}%`;
    speak(question);
  };

  const speak = (text) => {
    if (!("speechSynthesis" in window)) {
      $("interviewStatus").textContent = "Speech playback is unavailable. Read the question on screen.";
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  const createList = (items) => {
    const list = document.createElement("ul");
    (Array.isArray(items) ? items : []).forEach((value) => {
      const item = document.createElement("li");
      item.textContent = String(value);
      list.append(item);
    });
    if (!list.children.length) {
      const item = document.createElement("li");
      item.textContent = "No specific feedback for this answer.";
      list.append(item);
    }
    return list;
  };

  const renderFeedback = (feedback) => {
    feedbackBox.replaceChildren();
    const score = document.createElement("span");
    score.className = "mock-feedback-score";
    score.textContent = `Score ${Number(feedback.score) || 0}/100`;
    feedbackBox.append(score);
    [["What worked", feedback.strengths], ["Try improving", feedback.improvements]].forEach(([heading, items]) => {
      const title = document.createElement("h3");
      title.textContent = heading;
      feedbackBox.append(title, createList(items));
    });
    if (feedback.sampleAnswer) {
      const heading = document.createElement("h3");
      heading.textContent = "Example improvement";
      const example = document.createElement("p");
      example.textContent = feedback.sampleAnswer;
      feedbackBox.append(heading, example);
    }
    feedbackBox.hidden = false;
  };

  const startInterview = async () => {
    if (!consent.checked) return;
    startButton.disabled = true;
    startButton.textContent = "Checking camera and screen…";
    $("setupStatus").classList.remove("is-error");
    $("setupStatus").textContent = "Allow camera access, then choose “Entire Screen” in the screen-sharing prompt.";
    try {
      const deviceCheck = await openDeviceStreams();
      const data = await postJSON("/student/interview/start", {
        roleType: $("roleType").value.trim() || "Software Engineer",
        language: $("interviewLanguage").value,
        deviceCheck,
      });
      sessionId = data.sessionId;
      $("roomRoleTitle").textContent = $("roleType").value.trim() || "Software Engineer";
      setup.hidden = true;
      room.hidden = false;
      updateDeviceStatus(true, "Camera and entire monitor are active. Video is not uploaded or recorded.");
      $("interviewStatus").textContent = "The interviewer is asking. Listen, then give your answer.";
      setQuestion(data.question, data.questionNumber || 1);
    } catch (error) {
      $("setupStatus").classList.add("is-error");
      $("setupStatus").textContent = error.message || "Could not prepare the interview room.";
      startButton.disabled = !consent.checked;
      startButton.innerHTML = "↗ Enable devices and start";
    }
  };

  const restoreDevices = async () => {
    const button = $("restoreDevicesButton");
    button.disabled = true;
    button.textContent = "Checking devices…";
    try {
      const deviceCheck = await openDeviceStreams();
      await postJSON("/student/interview/devices", { sessionId, deviceCheck });
      updateDeviceStatus(true, "Camera and entire monitor are active. You can continue your answer.");
      $("interviewStatus").textContent = "Devices restored. Continue with the current question.";
    } catch (error) {
      updateDeviceStatus(false, error.message || "Restore camera and entire-screen sharing to continue.");
      $("deviceRecoveryText").textContent = error.message || "Restore camera and entire-screen sharing to continue.";
    } finally {
      button.disabled = false;
      button.textContent = "Restore devices";
    }
  };

  const startVoiceInput = () => {
    if (isListening) {
      try { recognition?.stop(); } catch (_) { /* already stopped */ }
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      $("deviceStatus").textContent = "Voice input is unavailable in this browser. Type your answer instead.";
      return;
    }
    speechBaseText = answerInput.value.trim();
    recognition = new SpeechRecognition();
    recognition.lang = $("interviewLanguage").value;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      const recognized = [];
      for (let index = 0; index < event.results.length; index += 1) recognized.push(event.results[index][0].transcript.trim());
      answerInput.value = [speechBaseText, recognized.join(" ")].filter(Boolean).join(" ").slice(0, 5000);
    };
    recognition.onerror = () => { $("deviceStatus").textContent = "Voice input stopped. Your typed answer is still available."; };
    recognition.onend = () => {
      isListening = false;
      $("micButton").textContent = "🎙 Answer with microphone";
    };
    try {
      recognition.start();
      isListening = true;
      $("micButton").textContent = "Stop microphone";
      $("deviceStatus").textContent = "Listening… select Stop microphone when you finish speaking.";
    } catch (error) {
      $("deviceStatus").textContent = error.message || "Could not start voice input.";
    }
  };

  const submitAnswer = async () => {
    if (!devicesReady || !isCameraLive() || !isMonitorShareLive()) {
      if (!isCameraLive()) pauseInterview("camera_interrupted", "Camera access is not active. Restore it before answering.");
      else pauseInterview("screen_interrupted", "Share your entire monitor again before answering.");
      return;
    }
    const answer = answerInput.value.trim();
    if (!answer) {
      $("interviewStatus").textContent = "Type or speak your answer before submitting it.";
      answerInput.focus();
      return;
    }
    if (isListening) try { recognition?.stop(); } catch (_) { /* already stopped */ }
    submitButton.disabled = true;
    submitButton.textContent = "Reviewing your answer…";
    $("interviewStatus").textContent = `AI is reviewing answer ${questionNumber} of 10…`;
    feedbackBox.hidden = true;
    feedbackBox.classList.remove("is-error");
    try {
      const data = await postJSON("/student/interview/answer", { sessionId, answer });
      renderFeedback(data.feedback || {});
      answerInput.value = "";
      if (data.completed) {
        $("questionProgress").innerHTML = "Complete <small>/ 10</small>";
        $("questionProgressFill").style.width = "100%";
        $("interviewStatus").textContent = data.saved === false ? "Score calculated, but interview history could not be saved." : "All 10 answers have been reviewed.";
        finalScoreBox.replaceChildren();
        const score = document.createElement("strong");
        score.textContent = `${Number(data.finalScore) || 0}/100`;
        const title = document.createElement("span");
        title.textContent = "Final interview score";
        const summary = document.createElement("p");
        summary.textContent = "Average score across all 10 answers.";
        finalScoreBox.append(score, title, summary);
        const monitoring = document.createElement("p");
        monitoring.className = "mock-monitoring-summary";
        const warnings = Math.max(Number(data.warningCount) || 0, localWarningCount);
        monitoring.textContent = warnings
          ? `${warnings} monitoring warning${warnings === 1 ? "" : "s"} were recorded during this practice session.`
          : "No focus or device interruptions were recorded.";
        finalScoreBox.append(monitoring);
        finalScoreBox.hidden = false;
        $("mockQuestion").textContent = "Interview complete — review your feedback and final score.";
        window.speechSynthesis?.cancel();
        submitButton.hidden = true;
        $("micButton").hidden = true;
        releaseDevices();
        updateDeviceStatus(false, "Interview complete. Camera and screen sharing have been stopped.");
        $("deviceRecovery").hidden = true;
      } else {
        setQuestion(data.nextQuestion, (data.questionNumber || questionNumber) + 1);
        $("interviewStatus").textContent = `Answer ${data.questionNumber} reviewed. Listen to question ${questionNumber}.`;
      }
    } catch (error) {
      feedbackBox.hidden = false;
      feedbackBox.classList.add("is-error");
      feedbackBox.textContent = error.message || "Could not review your answer. Please retry.";
      $("interviewStatus").textContent = "Your answer is still here. Restore devices if needed, then retry.";
    } finally {
      if (!submitButton.hidden) {
        submitButton.textContent = "Submit answer →";
        submitButton.disabled = !devicesReady;
      }
    }
  };

  startButton.addEventListener("click", startInterview);
  $("restoreDevicesButton").addEventListener("click", restoreDevices);
  $("submitAnswerButton").addEventListener("click", submitAnswer);
  $("repeatQuestionButton").addEventListener("click", () => speak($("mockQuestion").textContent));
  $("micButton").addEventListener("click", startVoiceInput);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden || !sessionId || isLeaving) return;
    const now = Date.now();
    if (now - lastFocusWarningAt < 2500) return;
    lastFocusWarningAt = now;
    recordEvent("tab_hidden", "You switched away from the interview tab. Return to continue.");
  });

  window.addEventListener("blur", () => {
    if (!sessionId || isLeaving || document.hidden) return;
    const now = Date.now();
    if (now - lastFocusWarningAt < 2500) return;
    lastFocusWarningAt = now;
    recordEvent("window_blur", "The interview window lost focus. Return to the interview before answering.");
  });

  answerInput.addEventListener("paste", () => {
    if (sessionId) recordEvent("answer_pasted", "Pasted text was detected in the answer field.");
  });

  window.addEventListener("pagehide", () => {
    isLeaving = true;
    window.speechSynthesis?.cancel();
    try { recognition?.stop(); } catch (_) { /* already stopped */ }
    cameraStream?.getTracks().forEach((track) => track.stop());
    screenStream?.getTracks().forEach((track) => track.stop());
  });
})();
