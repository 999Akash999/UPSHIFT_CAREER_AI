document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("projectSubmissionModal");
  const openButtons = [...document.querySelectorAll("[data-project-modal-open]")];
  const editButtons = [...document.querySelectorAll("[data-project-edit]")];
  const deleteButtons = [...document.querySelectorAll("[data-project-delete]")];
  const closeButton = document.getElementById("closeProjectModal");
  const cancelButton = document.getElementById("cancelProjectModal");
  const form = document.getElementById("projectSubmissionForm");
  const status = document.getElementById("projectSubmissionStatus");
  const submitButton = form?.querySelector("button[type='submit']");
  const description = form?.elements.namedItem("description");
  const descriptionCount = document.getElementById("projectDescriptionCount");
  const imageInput = document.getElementById("projectImage");
  const imagePreview = document.getElementById("projectImagePreview");
  const modalTitle = document.getElementById("projectModalTitle");
  const modalDescription = document.getElementById("projectModalDescription");
  const saveProjectButton = document.getElementById("saveProjectButton");
  let previewUrl = null;
  let editingImageUrl = "";

  if (!modal || !openButtons.length || !form || !status || !submitButton) return;

  let lastOpener = null;
  const getFocusableElements = () => [...modal.querySelectorAll(
    "a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1'])"
  )].filter((element) => !element.hidden && element.getClientRects().length);

  const clearPreviewUrl = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  };

  const openModal = (event) => {
    lastOpener = event.currentTarget;
    const projectButton = event.currentTarget.closest("[data-project-edit]");
    clearPreviewUrl();
    form.reset();
    imageInput.value = "";
    editingImageUrl = "";
    form.dataset.projectId = "";
    if (projectButton) {
      const { projectId, title, description: projectDescription, techStack, githubUrl, liveDemoUrl, imageUrl } = projectButton.dataset;
      form.dataset.projectId = projectId;
      form.action = `/student/projects/${encodeURIComponent(projectId)}`;
      form.elements.namedItem("title").value = title || "";
      form.elements.namedItem("description").value = projectDescription || "";
      form.elements.namedItem("techStack").value = techStack || "";
      form.elements.namedItem("githubUrl").value = githubUrl || "";
      form.elements.namedItem("liveDemoUrl").value = liveDemoUrl || "";
      editingImageUrl = imageUrl || "";
      modalTitle.textContent = "Edit project";
      modalDescription.textContent = "Update your project details, links, technologies, or cover image.";
      saveProjectButton.innerHTML = "Save changes";
      if (editingImageUrl) { imagePreview.src = editingImageUrl; imagePreview.hidden = false; }
    } else {
      form.action = "/student/projects";
      modalTitle.textContent = "Add a project";
      modalDescription.textContent = "Share enough detail for someone to understand what you made and why it matters.";
      saveProjectButton.innerHTML = '<span aria-hidden="true">＋</span> Save project';
      imagePreview.hidden = true; imagePreview.removeAttribute("src");
    }
    updateDescriptionCount();
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
  editButtons.forEach((button) => button.addEventListener("click", openModal));
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

  imageInput?.addEventListener("change", () => {
    const file = imageInput.files?.[0];
    clearPreviewUrl();
    if (!file) {
      if (editingImageUrl) { imagePreview.src = editingImageUrl; imagePreview.hidden = false; }
      else { imagePreview.hidden = true; imagePreview.removeAttribute("src"); }
      return;
    }
    previewUrl = URL.createObjectURL(file);
    imagePreview.src = previewUrl;
    imagePreview.hidden = false;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const originalButtonText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.textContent = "Saving project…";
    status.textContent = "";

    try {
      const response = await fetch(form.action, {
        method: form.dataset.projectId ? "PUT" : "POST",
        headers: {
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: new FormData(form),
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

  deleteButtons.forEach((button) => button.addEventListener("click", async () => {
    const projectName = button.dataset.projectTitle || "this project";
    if (!window.confirm(`Delete “${projectName}” from your portfolio? This cannot be undone.`)) return;
    button.disabled = true;
    try {
      const response = await fetch(`/student/projects/${encodeURIComponent(button.dataset.projectId)}`, {
        method: "DELETE",
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || "Could not delete this project.");
      window.location.reload();
    } catch (error) {
      window.alert(error.message || "Could not delete this project. Please try again.");
      button.disabled = false;
    }
  }));
});
