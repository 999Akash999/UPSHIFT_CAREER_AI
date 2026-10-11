document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("onboardingSkillsForm");
  const storedSkills = document.getElementById("skillsInputField");
  const input = document.getElementById("skillEntry");
  const addButton = document.getElementById("addSkillButton");
  const tags = document.getElementById("selectedSkillTags");
  const status = document.getElementById("skillEntryStatus");
  if (!form || !storedSkills || !input || !addButton || !tags) return;

  const skills = [];
  const addSkill = (value) => {
    const skill = String(value || "").trim().replace(/\s+/g, " ").slice(0, 50);
    if (!skill) return false;
    if (skills.some((existing) => existing.toLocaleLowerCase() === skill.toLocaleLowerCase())) {
      if (status) status.textContent = `${skill} is already in your list.`;
      return false;
    }
    if (skills.length >= 30) {
      if (status) status.textContent = "You can add up to 30 skills.";
      return false;
    }
    skills.push(skill);
    if (status) status.textContent = "";
    renderSkills();
    return true;
  };

  const renderSkills = () => {
    tags.replaceChildren();
    skills.forEach((skill, index) => {
      const chip = document.createElement("span");
      chip.style.cssText = "display:inline-flex;align-items:center;gap:.45rem;padding:.35rem .55rem .35rem .7rem;border:1px solid #36506f;border-radius:999px;background:#17243a;color:#e2e8f0;font-size:.8rem;";
      const label = document.createElement("span");
      label.textContent = skill;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove ${skill}`);
      remove.style.cssText = "border:0;background:transparent;color:#cbd5e1;font-size:1rem;line-height:1;cursor:pointer;padding:0;";
      remove.addEventListener("click", () => {
        skills.splice(index, 1);
        renderSkills();
      });
      chip.append(label, remove);
      tags.append(chip);
    });
    storedSkills.value = skills.join(", ");
  };

  storedSkills.value.split(/[\n,]/).forEach(addSkill);
  document.querySelectorAll("[data-skill-preset]").forEach((button) => {
    button.addEventListener("click", () => addSkill(button.dataset.skillPreset));
  });
  const addFromInput = () => {
    const entries = input.value.split(",").map((skill) => skill.trim()).filter(Boolean);
    entries.forEach(addSkill);
    if (entries.length) input.value = "";
    input.focus();
  };
  addButton.addEventListener("click", addFromInput);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addFromInput();
    }
  });
  form.addEventListener("submit", (event) => {
    if (!skills.length) {
      event.preventDefault();
      if (status) status.textContent = "Add at least one skill to continue.";
      input.focus();
      return;
    }
    storedSkills.value = skills.join(", ");
  });
});
