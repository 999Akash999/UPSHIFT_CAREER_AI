document.addEventListener("DOMContentLoaded", () => {
  const currentPath = window.location.pathname.replace(/\/$/, "") || "/";
  document.querySelectorAll(".sidebar-link, .public-nav-links a").forEach((link) => {
    const linkPath = new URL(link.href, window.location.origin).pathname.replace(/\/$/, "") || "/";
    const isCurrentPage = linkPath === currentPath;
    const isCurrentSection = link.matches(".sidebar-link") && currentPath.startsWith(`${linkPath}/`);
    if (isCurrentPage || isCurrentSection) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  });

  document.querySelectorAll(".dashboard-main table, .public-main table").forEach((table) => {
    if (table.parentElement?.classList.contains("ui-table-scroll")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "ui-table-scroll";
    wrapper.tabIndex = 0;
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-label", "Scrollable table");
    table.parentNode.insertBefore(wrapper, table);
    wrapper.append(table);
  });

  // Auto-dismiss alert notifications
  const alerts = document.querySelectorAll(".flash-alert-success");
  alerts.forEach((alert) => {
    setTimeout(() => {
      alert.style.transition = "opacity 0.3s ease";
      alert.style.opacity = "0";
      setTimeout(() => alert.remove(), 300);
    }, 4500);
  });

  // Global drawer trigger shortcuts (Esc to close)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const drawer = document.getElementById("aiCopilotDrawer");
      const backdrop = document.getElementById("aiDrawerBackdrop");
      if (drawer && drawer.style.right === "0px") {
        drawer.style.right = "-420px";
        if (backdrop) backdrop.style.display = "none";
      }
      toggleSidebarNav(false);
      document.getElementById("publicNav")?.classList.remove("is-open");
    }
  });
});

function toggleSidebarNav(forceState) {
  const sidebar = document.getElementById("appSidebar");
  const scrim = document.getElementById("sidebarScrim");
  const toggle = document.querySelector(".nav-toggle");
  if (!sidebar) return;
  const shouldOpen = typeof forceState === "boolean" ? forceState : !sidebar.classList.contains("is-open");
  sidebar.classList.toggle("is-open", shouldOpen);
  scrim?.classList.toggle("is-visible", shouldOpen);
  toggle?.setAttribute("aria-expanded", String(shouldOpen));
  document.body.classList.toggle("nav-is-open", shouldOpen);
}

function togglePublicNav() {
  const nav = document.getElementById("publicNav");
  const toggle = document.querySelector(".public-nav-toggle");
  if (!nav) return;
  const isOpen = nav.classList.toggle("is-open");
  toggle?.setAttribute("aria-expanded", String(isOpen));
}

function previewProfilePhoto(input) {
  const file = input.files?.[0];
  const current = document.getElementById("profilePhotoCurrent");
  const preview = document.getElementById("profilePhotoPreview");
  if (!file || !preview) return;

  if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
  preview.dataset.objectUrl = URL.createObjectURL(file);
  preview.src = preview.dataset.objectUrl;
  current?.classList.add("is-hidden");
  preview.classList.remove("is-hidden");
}
