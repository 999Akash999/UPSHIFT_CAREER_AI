document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("projectSubmissionModal");
  const openButtons = [...document.querySelectorAll("[data-project-modal-open]")];
  const closeButton = document.getElementById("closeProjectModal");
  const cancelButton = document.getElementById("cancelProjectModal");
  const form = document.getElementById("projectSubmissionForm");
  const status = document.getElementById("projectSubmissionStatus");
  const submitButton = form?.querySelector("button[type='submit']");
  const description = form?.elements.namedItem("description");
  const descriptionCount = document.getElementById("projectDescriptionCount");

  if (!modal || !openButtons.length || !form || !status || !submitButton) return;

  let lastOpener = null;
  const getFocusableElements = () => [...modal.querySelectorAll(
    "a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1'])"
  )].filter((element) => !element.hidden && element.getClientRects().length);

  const openModal = (event) => {
    lastOpener = event.currentTarget;
    modal.hidden = false;
    document.body.classList.add("project-modal-open");
    status.classList.remove("is-success");
    status.textContent = "";
    requestAnimationFrame(() => form.elements.namedItem("title")?.focus());
  };

  const closeModal = () => {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove("project-modal-open");
    lastOpener?.focus();
  };

  openButtons.forEach((button) => button.addEventListener("click", openModal));
  closeButton?.addEventListener("click", closeModal);
  cancelButton?.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (modal.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = getFocusableElements();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  const updateDescriptionCount = () => {
    if (description && descriptionCount) descriptionCount.textContent = `${description.value.length.toLocaleString()} / 3,000`;
  };
  description?.addEventListener("input", updateDescriptionCount);
  updateDescriptionCount();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const originalButtonText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.textContent = "Saving project…";
    status.textContent = "";

    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: new URLSearchParams(new FormData(form)),
      });

      if (response.redirected) {
        window.location.assign(response.url || window.location.href);
        return;
      }

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Could not save this project. Check the details and try again.");
      }
      status.classList.add("is-success");
      status.textContent = "Project saved. Refreshing your portfolio…";
      window.location.reload();
    } catch (error) {
      status.classList.remove("is-success");
      status.textContent = error.message || "Could not save this project. Please try again.";
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonText;
    }
  });
});
