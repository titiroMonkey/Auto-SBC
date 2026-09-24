const SBC_SUBMIT_TRACKER_STORAGE_KEY = "sbcSubmitSuccessHistory";
const SBC_SUBMIT_TRACKER_EVENT = "autosbc:sbc-submit-tracker-updated";
const SBC_SUBMIT_TRACKER_WINDOW_60_MIN = 60 * 60 * 1000;
const SBC_SUBMIT_TRACKER_WINDOW_24_HOURS = 24 * 60 * 60 * 1000;
const SBC_SUBMIT_TRACKER_NODE_CLASS = "view-navbar-currency-sbc-submitted";
const SBC_SUBMIT_TRACKER_24H_CLASS = "view-navbar-currency-sbc-submitted-24h";
const SBC_SUBMIT_TRACKER_60M_CLASS = "view-navbar-currency-sbc-submitted-60m";
const SBC_SUBMIT_TRACKER_TOOLTIP_CLASS = "sbc-submit-tracker-tooltip";

// --- IndexedDB-backed storage for submit history -------------------------
const _SUBMIT_TRACKER_DB_NAME = "futSBCSubmitTrackerDB";
const _SUBMIT_TRACKER_DB_VERSION = 1;
const _SUBMIT_TRACKER_STORE_NAME = "history";
const _SUBMIT_TRACKER_RECORD_ID = "timestamps";
let _submitTrackerCache = [];

const _openSubmitTrackerDB = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(_SUBMIT_TRACKER_DB_NAME, _SUBMIT_TRACKER_DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(_SUBMIT_TRACKER_STORE_NAME)) {
        db.createObjectStore(_SUBMIT_TRACKER_STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });

const _writeSubmitTrackerToIDB = async (timestamps) => {
  try {
    const db = await _openSubmitTrackerDB();
    const tx = db.transaction([_SUBMIT_TRACKER_STORE_NAME], "readwrite");
    tx.objectStore(_SUBMIT_TRACKER_STORE_NAME).put({
      id: _SUBMIT_TRACKER_RECORD_ID,
      data: timestamps,
    });
  } catch (err) {
    console.error("[submitTracker] Failed to write to IndexedDB:", err);
  }
};

// Bootstrap: load from IDB, migrate from localStorage if needed
(async () => {
  try {
    const db = await _openSubmitTrackerDB();
    const record = await new Promise((resolve) => {
      const tx = db.transaction([_SUBMIT_TRACKER_STORE_NAME], "readonly");
      const store = tx.objectStore(_SUBMIT_TRACKER_STORE_NAME);
      const req = store.get(_SUBMIT_TRACKER_RECORD_ID);
      req.onsuccess = (e) => resolve(e.target.result?.data ?? null);
      tx.onerror = () => resolve(null);
    });

    if (Array.isArray(record) && record.length) {
      _submitTrackerCache = record;
    } else {
      // Migrate from localStorage
      try {
        const raw = localStorage.getItem(SBC_SUBMIT_TRACKER_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            _submitTrackerCache = parsed.filter(
              (entry) => Number.isFinite(entry) && entry > 0,
            );
            await _writeSubmitTrackerToIDB(_submitTrackerCache);
            localStorage.removeItem(SBC_SUBMIT_TRACKER_STORAGE_KEY);
            console.log("[submitTracker] Migrated history from localStorage to IndexedDB");
          }
        }
      } catch {}
    }
  } catch (err) {
    console.error("[submitTracker] IDB bootstrap error:", err);
  }
})();

// Returns ms until the oldest 60m or 24h history entry expires (count decreases).
const computeNextSbcCountChangeMs = () => {
  const now = Date.now();
  const history = readSbcSubmitSuccessHistory();
  if (!history.length) return null;

  const delays = [];

  const cutoff60m = now - SBC_SUBMIT_TRACKER_WINDOW_60_MIN;
  const in60m = history.filter((ts) => ts >= cutoff60m);
  if (in60m.length) {
    delays.push(Math.min(...in60m) + SBC_SUBMIT_TRACKER_WINDOW_60_MIN - now);
  }

  const cutoff24h = now - SBC_SUBMIT_TRACKER_WINDOW_24_HOURS;
  const in24h = history.filter((ts) => ts >= cutoff24h);
  if (in24h.length) {
    delays.push(Math.min(...in24h) + SBC_SUBMIT_TRACKER_WINDOW_24_HOURS - now);
  }

  const positive = delays.filter((d) => d > 0);
  return positive.length ? Math.min(...positive) : null;
};

// Returns ms until the tooltip countdown text will next change its displayed value.
const computeNextSbcCountdownDisplayChangeMs = () => {
  const time60mRemaining = getTimeUntilWindowExpiry(true);
  const time24hRemaining = getTimeUntilWindowExpiry(false);

  const delays = [];
  [time60mRemaining, time24hRemaining].forEach((remaining) => {
    if (remaining === null || remaining <= 0) return;
    if (remaining >= 3600000) {
      // shows "Xh Ym" — changes every minute
      const msUntilNextMinute = remaining % 60000;
      delays.push(msUntilNextMinute || 60000);
    } else {
      // shows "Xm Ys" or "Ys" — changes every second
      const msUntilNextSecond = remaining % 1000;
      delays.push(msUntilNextSecond || 1000);
    }
  });

  return delays.length ? Math.min(...delays) : null;
};

// Schedules the next tracker refresh at the right granularity.
// isHovered=true  → wake when countdown display text changes (up to every second)
// isHovered=false → wake only when a count number will decrease
const scheduleSbcSubmitTrackerRefresh = (isHovered = false) => {
  if (window.__sbcSubmitTrackerRealtimeTimer) {
    clearTimeout(window.__sbcSubmitTrackerRealtimeTimer);
    window.__sbcSubmitTrackerRealtimeTimer = null;
  }

  const countChangeDelay = computeNextSbcCountChangeMs();
  let delayMs;

  if (isHovered) {
    const countdownDelay = computeNextSbcCountdownDisplayChangeMs();
    if (countdownDelay !== null && countChangeDelay !== null) {
      delayMs = Math.min(countdownDelay, countChangeDelay);
    } else {
      delayMs = countdownDelay ?? countChangeDelay;
    }
  } else {
    delayMs = countChangeDelay;
  }

  if (delayMs === null || delayMs <= 0) return;

  window.__sbcSubmitTrackerRealtimeTimer = setTimeout(() => {
    window.__sbcSubmitTrackerRealtimeTimer = null;
    try {
      const nodes = Array.from(
        document.querySelectorAll(`.${SBC_SUBMIT_TRACKER_NODE_CLASS}`),
      );
      const currentlyHovered = nodes.some((n) => n.matches(":hover"));
      refreshSbcSubmitTrackerInHeader();
      scheduleSbcSubmitTrackerRefresh(currentlyHovered);
    } catch (err) {
      console.warn("[submitTracker] scheduled refresh failed", err);
    }
  }, Math.max(50, delayMs));
};

const readSbcSubmitSuccessHistory = () => {
  return _submitTrackerCache.filter(
    (entry) =>
      Number.isFinite(entry) && entry > 0 && entry < Date.now() + 10000,
  );
};

const writeSbcSubmitSuccessHistory = (timestamps) => {
  _submitTrackerCache = Array.isArray(timestamps) ? timestamps : [];
  _writeSubmitTrackerToIDB(_submitTrackerCache);
};

const pruneSbcSubmitSuccessHistory = (now = Date.now()) => {
  const cutoff24h = now - SBC_SUBMIT_TRACKER_WINDOW_24_HOURS;
  const fresh = readSbcSubmitSuccessHistory().filter((ts) => ts >= cutoff24h);
  writeSbcSubmitSuccessHistory(fresh);
  return fresh;
};

const getSbcSubmitTrackerCounts = () => {
  const now = Date.now();
  const history = pruneSbcSubmitSuccessHistory(now);
  const cutoff60m = now - SBC_SUBMIT_TRACKER_WINDOW_60_MIN;

  return {
    last60m: history.filter((ts) => ts >= cutoff60m).length,
    last24h: history.length,
  };
};

const shouldShowSbcSubmitTracker = () => {
  return !!getSettings(0, 0, "showSbcSubmitTracker");
};

const getNavigationContainers = (navigationBarView) => {
  if (navigationBarView) {
    const fromInstance =
      navigationBarView.__root || navigationBarView.getRootElement?.();
    return fromInstance ? [fromInstance] : [];
  }

  return Array.from(document.querySelectorAll(".ut-navigation-bar-view"));
};

const applySbcTrackerBorderStyle = (node, navigationContainer) => {
  if (!node) {
    return;
  }

  const clubInfoNode = navigationContainer?.querySelector(
    ".view-navbar-clubinfo",
  );
  const clubInfoStyles = clubInfoNode
    ? window.getComputedStyle(clubInfoNode)
    : null;

  const borderWidth =
    (clubInfoStyles?.borderLeftWidth && clubInfoStyles.borderLeftWidth !== "0px"
      ? clubInfoStyles.borderLeftWidth
      : clubInfoStyles?.borderRightWidth) || "1px";
  const borderStyle =
    (clubInfoStyles?.borderLeftStyle &&
    clubInfoStyles.borderLeftStyle !== "none"
      ? clubInfoStyles.borderLeftStyle
      : clubInfoStyles?.borderRightStyle) || "solid";
  const borderColor =
    (clubInfoStyles?.borderLeftColor &&
    clubInfoStyles.borderLeftColor !== "rgba(0, 0, 0, 0)"
      ? clubInfoStyles.borderLeftColor
      : clubInfoStyles?.borderRightColor) || "rgba(255, 255, 255, 0.2)";

  node.style.borderTop = "none";
  node.style.borderBottom = "none";
  node.style.borderLeft = "none";
  node.style.borderRightWidth = borderWidth;
  node.style.borderRightStyle = borderStyle;
  node.style.borderRightColor = borderColor;
  node.style.padding = "0px 8px";
};

const ensureSbcSubmitTrackerNode = (navigationContainer) => {
  if (!navigationContainer) {
    return null;
  }

  let node = navigationContainer.querySelector(
    `.${SBC_SUBMIT_TRACKER_NODE_CLASS}`,
  );
  if (node) {
    node.classList.remove(
      "view-navbar-currency-coins",
      "view-navbar-currency-points",
    );
    applySbcTrackerBorderStyle(node, navigationContainer);
    return node;
  }

  node = document.createElement("div");
  node.classList.add(SBC_SUBMIT_TRACKER_NODE_CLASS);

  const count60mNode = document.createElement("div");
  count60mNode.classList.add(SBC_SUBMIT_TRACKER_60M_CLASS);

  const count24hNode = document.createElement("div");
  count24hNode.classList.add(SBC_SUBMIT_TRACKER_24H_CLASS);

  const tooltipNode = document.createElement("div");
  tooltipNode.classList.add(SBC_SUBMIT_TRACKER_TOOLTIP_CLASS);

  node.appendChild(count60mNode);
  node.appendChild(count24hNode);
  node.appendChild(tooltipNode);
  applySbcTrackerBorderStyle(node, navigationContainer);

  node.addEventListener("mouseenter", () => {
    updateSbcSubmitTrackerTooltip(node);
    scheduleSbcSubmitTrackerRefresh(true);
  });
  node.addEventListener("mouseleave", () => {
    scheduleSbcSubmitTrackerRefresh(false);
  });

  const currenciesNode = navigationContainer.querySelector(
    ".view-navbar-currency",
  );
  if (currenciesNode && currenciesNode.parentElement === navigationContainer) {
    currenciesNode.style.marginLeft = "8px";
    navigationContainer.insertBefore(node, currenciesNode);
  } else {
    navigationContainer.insertBefore(
      node,
      navigationContainer.firstChild || null,
    );
  }

  return node;
};

const removeSbcSubmitTrackerNodes = (navigationBarView) => {
  const navigationContainers = getNavigationContainers(navigationBarView);
  navigationContainers.forEach((container) => {
    const node = container.querySelector(`.${SBC_SUBMIT_TRACKER_NODE_CLASS}`);
    if (node) {
      node.remove();
    }
  });
};

const formatTimeRemaining = (milliseconds) => {
  if (milliseconds <= 0) {
    return "Now";
  }

  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
};

const getTimeUntilWindowExpiry = (window60m) => {
  const now = Date.now();
  const history = readSbcSubmitSuccessHistory();

  if (history.length === 0) {
    return null;
  }

  const cutoff = window60m
    ? now - SBC_SUBMIT_TRACKER_WINDOW_60_MIN
    : now - SBC_SUBMIT_TRACKER_WINDOW_24_HOURS;
  const relevantEntries = history.filter((ts) => ts >= cutoff);

  if (relevantEntries.length === 0) {
    return null;
  }

  const oldestRelevant = Math.min(...relevantEntries);
  const expiryTime =
    oldestRelevant +
    (window60m
      ? SBC_SUBMIT_TRACKER_WINDOW_60_MIN
      : SBC_SUBMIT_TRACKER_WINDOW_24_HOURS);
  const timeUntilExpiry = expiryTime - now;

  return timeUntilExpiry;
};

const updateSbcSubmitTrackerTooltip = (node) => {
  const tooltipNode = node?.querySelector(`.${SBC_SUBMIT_TRACKER_TOOLTIP_CLASS}`);
  if (!tooltipNode) return;

  const time60mRemaining = getTimeUntilWindowExpiry(true);
  const time24hRemaining = getTimeUntilWindowExpiry(false);

  const lines = ["<b>SBC Submitted Counts</b>"];
  if (time60mRemaining !== null) {
    lines.push(`60m: decreases in ${formatTimeRemaining(time60mRemaining)}`);
  }
  if (time24hRemaining !== null) {
    lines.push(`24h: decreases in ${formatTimeRemaining(time24hRemaining)}`);
  }
  tooltipNode.innerHTML = lines.join("<br>");
};

const updateSbcSubmitTrackerNode = (node) => {
  if (!node) {
    return;
  }

  const counts = getSbcSubmitTrackerCounts();
  const count24hNode = node.querySelector(`.${SBC_SUBMIT_TRACKER_24H_CLASS}`);
  const count60mNode = node.querySelector(`.${SBC_SUBMIT_TRACKER_60M_CLASS}`);

  if (count24hNode) {
    count24hNode.textContent = `24h: ${counts.last24h}`;
    count24hNode.removeAttribute("title");
  }

  if (count60mNode) {
    count60mNode.textContent = `60m: ${counts.last60m}`;
    count60mNode.removeAttribute("title");
  }

  // Only update tooltip content when it is actually visible (hovered)
  if (node.matches(":hover")) {
    updateSbcSubmitTrackerTooltip(node);
  }

  node.removeAttribute("title");
};

const refreshSbcSubmitTrackerInHeader = (navigationBarView) => {
  if (!shouldShowSbcSubmitTracker()) {
    if (window.__sbcSubmitTrackerRealtimeTimer) {
      clearTimeout(window.__sbcSubmitTrackerRealtimeTimer);
      window.__sbcSubmitTrackerRealtimeTimer = null;
    }
    removeSbcSubmitTrackerNodes(navigationBarView);
    return;
  }

  const navigationContainers = getNavigationContainers(navigationBarView);
  navigationContainers.forEach((container) => {
    const node = ensureSbcSubmitTrackerNode(container);
    updateSbcSubmitTrackerNode(node);
  });

  // If called externally (e.g. on submit/settings change), ensure scheduling is running.
  if (!window.__sbcSubmitTrackerRealtimeTimer) {
    const nodes = Array.from(
      document.querySelectorAll(`.${SBC_SUBMIT_TRACKER_NODE_CLASS}`),
    );
    const currentlyHovered = nodes.some((n) => n.matches(":hover"));
    scheduleSbcSubmitTrackerRefresh(currentlyHovered);
  }
};

const recordSbcSubmitSuccess = () => {
  const history = pruneSbcSubmitSuccessHistory();
  history.push(Date.now());
  writeSbcSubmitSuccessHistory(history);

  refreshSbcSubmitTrackerInHeader();
  window.dispatchEvent(new CustomEvent(SBC_SUBMIT_TRACKER_EVENT));
};

const subscribeSbcSubmitTrackerUpdates = () => {
  if (window.__sbcSubmitTrackerEventsBound) {
    return;
  }
  window.__sbcSubmitTrackerEventsBound = true;

  window.addEventListener(SBC_SUBMIT_TRACKER_EVENT, () => {
    refreshSbcSubmitTrackerInHeader();
  });
};
