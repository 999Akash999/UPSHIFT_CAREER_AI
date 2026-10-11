async function toggleMilestone(roadmapId, weekNumber, milestoneIndex, checkbox) {
  try {
    const res = await fetch(`/student/roadmap/${roadmapId}/week/${weekNumber}/milestone/${milestoneIndex}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    });

    const data = await res.json();
    if (!data.success) {
      checkbox.checked = !checkbox.checked;
    }
  } catch (err) {
    console.error("Milestone sync failure:", err);
    checkbox.checked = !checkbox.checked;
  }
}