function renderEmployabilityRadar(canvasId, metrics) {
  const ctx = document.getElementById(canvasId);
  if (!ctx || typeof Chart === "undefined") return;

  new Chart(ctx, {
    type: "radar",
    data: {
      labels: [
        "Technical Accuracy",
        "Verified Projects",
        "Roadmap Pace",
            "Daily Consistency",
        "Problem Solving"
      ],
      datasets: [
        {
          label: "Employability Index",
          data: [
            metrics.technical ?? 0,
            metrics.projects ?? 0,
            metrics.roadmapProgress ?? 0,
            metrics.softSkills ?? 0,
            metrics.problemSolving ?? 0
          ],
          backgroundColor: "rgba(121, 84, 200, 0.16)",
          borderColor: "#7954c8",
          pointBackgroundColor: "#7954c8",
          pointBorderColor: "#ffffff",
          pointHoverBackgroundColor: "#ffffff",
          pointHoverBorderColor: "#7954c8",
          borderWidth: 2.5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 0,
          max: 100,
          angleLines: { color: "#e8e0f1" },
          grid: { color: "#e8e0f1" },
          pointLabels: {
            font: { size: 11, weight: "600", family: "Plus Jakarta Sans" },
            color: "#514761"
          },
          ticks: {
            backdropColor: "transparent",
            stepSize: 20,
            color: "#94a3b8"
          }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function renderEmployabilityBars(canvasId, metrics) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === "undefined") return;
  new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["Assessments", "Projects", "Roadmap", "Consistency", "Problem solving"],
      datasets: [{
        label: "Score out of 100",
        data: [metrics.technical, metrics.projects, metrics.roadmapProgress, metrics.softSkills, metrics.problemSolving].map((value) => Math.max(0, Math.min(100, Number(value) || 0))),
        backgroundColor: ["#7954c8", "#9273d6", "#aa91e2", "#c1afea", "#6e50b5"],
        borderRadius: 8,
        maxBarThickness: 42
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      scales: {
        x: { min: 0, max: 100, grid: { color: "#eee9f6" }, ticks: { stepSize: 20, color: "#81778f" } },
        y: { grid: { display: false }, ticks: { color: "#514761", font: { family: "Plus Jakarta Sans", weight: "600" } } }
      },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => ` ${Math.round(context.raw)} / 100` } } }
    }
  });
}
