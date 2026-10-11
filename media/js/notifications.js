(() => {
  const widget = document.querySelector(".notification-widget");
  if (!widget) return;

  const button = widget.querySelector("#notificationBellBtn");
  const menu = widget.querySelector("#notificationDropdownMenu");
  const list = widget.querySelector("#notificationList");
  const badge = widget.querySelector("#unreadNotificationBadge");
  const summary = widget.querySelector("#notificationUnreadSummary");
  const status = widget.querySelector("#notificationActionStatus");
  const markAllButton = widget.querySelector("#markAllNotificationsRead");
  let loaded = false;

  const setUnreadCount = (count) => {
    const unread = Math.max(0, Number(count) || 0);
    badge.textContent = unread > 99 ? "99+" : String(unread);
    badge.hidden = unread === 0;
    summary.textContent = unread ? `${unread} unread notification${unread === 1 ? "" : "s"}` : "You’re all caught up";
  };

  const formatAge = (dateValue) => {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  };

  const renderNotifications = (notifications) => {
    list.replaceChildren();
    if (!notifications.length) {
      const empty = document.createElement("div");
      empty.className = "notification-empty";
      empty.innerHTML = '<span aria-hidden="true">✓</span><strong>You’re all caught up</strong><small>New updates will show up here.</small>';
      list.appendChild(empty);
      return;
    }
    notifications.forEach((notification) => {
      const item = document.createElement("article");
      item.className = `notification-preview-item${notification.isRead ? " is-read" : " is-unread"}`;
      const icon = document.createElement("span");
      icon.className = "notification-preview-icon";
      icon.textContent = ({ streak: "🔥", application: "💼", mentorship: "✦", roadmap: "↗", doubt: "💬" })[notification.category] || "•";
      const copy = document.createElement("div");
      copy.className = "notification-preview-copy";
      const title = document.createElement("strong");
      title.textContent = notification.title || "Notification";
      const message = document.createElement("p");
      message.textContent = notification.message || "";
      const age = document.createElement("small");
      age.textContent = formatAge(notification.createdAt);
      copy.append(title, message, age);
      item.append(icon, copy);

      const actionUrl = typeof notification.actionUrl === "string" && notification.actionUrl.startsWith("/") && !notification.actionUrl.startsWith("//")
        ? notification.actionUrl
        : "/student/dashboard";
      const openLink = document.createElement("a");
      openLink.className = "notification-open-link";
      openLink.href = actionUrl;
      openLink.textContent = "Open";
      item.appendChild(openLink);

      if (!notification.isRead) {
        const readButton = document.createElement("button");
        readButton.className = "notification-mark-read";
        readButton.type = "button";
        readButton.textContent = "Mark read";
        readButton.setAttribute("aria-label", `Mark ${notification.title || "notification"} as read`);
        readButton.addEventListener("click", async () => {
          readButton.disabled = true;
          try {
            const response = await fetch(`/student/notifications/${encodeURIComponent(notification._id)}/read`, {
              method: "PATCH", headers: { Accept: "application/json" }, credentials: "same-origin",
            });
            if (!response.ok) throw new Error("Could not update notification.");
            notification.isRead = true;
            item.classList.remove("is-unread");
            item.classList.add("is-read");
            readButton.remove();
            await loadNotifications();
          } catch (error) {
            status.textContent = error.message;
            readButton.disabled = false;
          }
        });
        item.appendChild(readButton);
      }
      list.appendChild(item);
    });
  };

  const loadNotifications = async () => {
    if (!loaded) list.innerHTML = '<div class="notification-loading">Loading notifications…</div>';
    try {
      const response = await fetch(widget.dataset.previewUrl, { headers: { Accept: "application/json" }, credentials: "same-origin" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Could not load notifications.");
      renderNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount);
      loaded = true;
      status.textContent = "";
    } catch (error) {
      list.innerHTML = "";
      const message = document.createElement("div");
      message.className = "notification-load-error";
      message.textContent = error.message;
      list.appendChild(message);
    }
  };

  document.addEventListener("notification:refresh", (event) => {
    const data = event.detail;
    renderNotifications(data.notifications || []);
    setUnreadCount(data.unreadCount);
    loaded = true;
  });

  button.addEventListener("click", async () => {
    const opening = menu.hidden;
    menu.hidden = !opening;
    button.setAttribute("aria-expanded", String(opening));
    if (opening) await loadNotifications();
  });

  markAllButton.addEventListener("click", async () => {
    markAllButton.disabled = true;
    status.textContent = "Updating…";
    try {
      const response = await fetch(widget.dataset.readAllUrl, {
        method: "PATCH", headers: { Accept: "application/json" }, credentials: "same-origin",
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Could not mark notifications as read.");
      setUnreadCount(0);
      await loadNotifications();
      status.textContent = "All caught up";
    } catch (error) {
      status.textContent = error.message;
    } finally {
      markAllButton.disabled = false;
    }
  });

  document.addEventListener("click", (event) => {
    if (!widget.contains(event.target)) {
      menu.hidden = true;
      button.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) {
      menu.hidden = true;
      button.setAttribute("aria-expanded", "false");
      button.focus();
    }
  });

  loadNotifications();
})();

if (typeof io !== "undefined") {
  const socket = io();

  socket.on("new:notification", (notification) => {
    const badge = document.getElementById("unreadNotificationBadge");
    if (badge) {
      const current = parseInt(badge.textContent, 10) || 0;
      badge.textContent = current + 1;
      badge.hidden = false;
    }
    const widget = document.querySelector(".notification-widget");
    if (widget && !widget.querySelector("#notificationDropdownMenu").hidden) {
      fetch(widget.dataset.previewUrl, { headers: { Accept: "application/json" }, credentials: "same-origin" })
        .then((response) => response.json())
        .then((data) => {
          if (!data.success) return;
          const event = new CustomEvent("notification:refresh", { detail: data });
          document.dispatchEvent(event);
        })
        .catch(() => {});
    }

    // Spawn animated toast alert
    const toast = document.createElement("div");
    toast.className = "alert-dismissible";
    toast.style.cssText = "position: fixed; bottom: 24px; right: 24px; z-index: 9999; background: #0f172a; border: 1px solid #1e3a5f; color: #ffffff; padding: 1rem 1.25rem; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.4); display: flex; align-items: center; gap: 0.75rem; font-size: 0.9rem;";
    const icon = document.createElement("span");
    icon.textContent = "🔔";
    const content = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = notification.title || "Notification";
    const message = document.createElement("div");
    message.style.cssText = "font-size: 0.8rem; color: #94a3b8;";
    message.textContent = notification.message || "";
    content.append(title, message);
    toast.append(icon, content);
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  });
}
