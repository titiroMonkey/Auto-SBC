const getUnassignedHistoryEntries = () => {
  if (!window.__unassignedHistoryEntries) {
    try {
      const raw = localStorage.getItem("unassignedHistoryEntries");
      window.__unassignedHistoryEntries = raw ? JSON.parse(raw) : [];
    } catch {
      window.__unassignedHistoryEntries = [];
    }
  }
  return window.__unassignedHistoryEntries;
};

const saveUnassignedHistoryEntries = (entries) => {
  try {
    localStorage.setItem(
      "unassignedHistoryEntries",
      JSON.stringify(entries || []),
    );
  } catch {}
};

const clearUnassignedHistoryEntries = () => {
  window.__unassignedHistoryEntries = [];
  saveUnassignedHistoryEntries([]);
};

const appendUnassignedHistoryRows = (entries, timestamp) => {
  if (!Array.isArray(entries) || !entries.length) return;

  const localizeAndTrimName = (value) => {
    if (typeof value !== "string") return "";
    const raw = value.trim();
    if (!raw) return "";
    try {
      const localized = services?.Localization?.localize?.(raw);
      if (typeof localized === "string" && localized.trim()) {
        return localized.trim();
      }
    } catch {}
    return raw;
  };

  const formatName = (item) => {
    const staticData = item?._staticData;
    const isPlayerItem =
      (typeof item?.isPlayer === "function" && item.isPlayer()) ||
      item?.isPlayer === true;

    const staticName = localizeAndTrimName(
      staticData?.name || staticData?.knownAs || "",
    );

    if (isPlayerItem && typeof staticData?.getFullName === "function") {
      const fullName = localizeAndTrimName(staticData.getFullName());
      if (fullName) {
        return fullName;
      }
    }

    const fullNameFallback =
      typeof staticData?.getFullName === "function"
        ? localizeAndTrimName(staticData.getFullName())
        : "";

    return (
      staticName ||
      fullNameFallback ||
      localizeAndTrimName(staticData?.lastName || "") ||
      localizeAndTrimName(item?.name || "") ||
      item?.definitionId ||
      "Unknown"
    );
  };

  const formatType = (item) => {
    if (typeof item?.getSearchType === "function") {
      const searchType = item.getSearchType();
      return String(searchType || "—");
    }
    return "—";
  };

  const formatPrice = (item) => {
    const price = Number(getPrice(item));
    return Number.isFinite(price) && price > 0 ? price.toLocaleString() : "—";
  };

  const getAssetId = (item) =>
    item?._metaData?.id ?? item?.assetId ?? item?.definitionId ?? null;

  const isTradableItem = (item) =>
    item?.tradable === true ||
    (typeof item?.isTradeable === "function" && item.isTradeable());

  const historyEntries = getUnassignedHistoryEntries();
  const nowLabel = timestamp;
  const nowMs = Date.now();

  entries.forEach(({ item, action, ruleNumber, ruleColor }) => {
    const assetId = getAssetId(item);
    const rating = item?.rating ?? item?._staticData?.rating ?? null;
    const rarityLabel = getItemRarityLabel(item);
    const isDuplicate =
      Number(item?.duplicateId ?? 0) > 0 || item?.isDuplicate?.();
    const isFodderValue =
      typeof isFodder === "function" ? isFodder(item) : false;
    const isTradableValue = isTradableItem(item);
    const priceValue = Number(getPrice(item));

    const nextEntry = {
      timestamp: nowMs,
      timestampLabel: nowLabel,
      ruleNumber: ruleNumber ?? null,
      action: action || null,
      name: formatName(item),
      type: formatType(item),
      assetId,
      rating: rating ?? null,
      price: Number.isFinite(priceValue) ? priceValue : null,
      priceDisplay: formatPrice(item),
      rarityLabel,
      isTradable: Boolean(isTradableValue),
      isFodder: Boolean(isFodderValue),
      isDuplicate: Boolean(isDuplicate),
      ruleColor: ruleColor || null,
    };

    if (assetId != null) {
      const existingIndex = historyEntries.findIndex(
        (existing) => existing?.assetId != null && existing.assetId == assetId,
      );
      if (existingIndex >= 0) {
        historyEntries[existingIndex] = {
          ...historyEntries[existingIndex],
          ...nextEntry,
        };
        return;
      }
    }

    historyEntries.push(nextEntry);
  });

  if (historyEntries.length > 300) {
    historyEntries.splice(0, historyEntries.length - 300);
  }

  saveUnassignedHistoryEntries(historyEntries);
};

const getUnassignedHistoryState = () => {
  return {
    entries: getUnassignedHistoryEntries(),
  };
};

const RECENT_SPECIALS_MAX = 10;
const RECENT_SPECIALS_STRIP_ID = "autosbc-recent-specials-strip";
const RECENT_SPECIALS_TRACK_ID = "autosbc-recent-specials-track";
const RECENT_SPECIALS_TITLE_ID = "autosbc-recent-specials-title";
const RECENT_SPECIALS_TOGGLE_ID = "autosbc-recent-specials-toggle";
const RECENT_SPECIALS_UNASSIGNED_STORAGE_KEY =
  "autoSbcRecentPackedSpecialsUnassigned.v1";
const RECENT_SPECIALS_COLLAPSED_STORAGE_KEY =
  "autoSbcRecentPackedSpecialsCollapsed.v1";
const RECENT_SPECIALS_TIMEAGO_REFRESH_MS = 60 * 1000;
const RECENT_SPECIALS_SNAKE_STAGGER_MS = 36;
let recentSpecialsClubReadyPromise = null;
let recentClubSpecialsLoadPromise = null;
let recentSpecialsTimeAgoIntervalId = null;

const getRecentSpecialEntryKey = (item, fallbackSeed = "") => {
  const itemId = Number(item?.id);
  if (Number.isFinite(itemId) && itemId > 0) {
    return `item-${itemId}`;
  }

  const definitionId = Number(item?.definitionId);
  if (Number.isFinite(definitionId) && definitionId > 0) {
    return `def-${definitionId}-${fallbackSeed || "0"}`;
  }

  return `unknown-${fallbackSeed || Date.now()}`;
};

const isRecentPackedSpecialsEnabled = () => {
  if (typeof getSettings !== "function") {
    return true;
  }
  return getSettings(0, 0, "showRecentPackedSpecials") !== false;
};

const ensureRecentSpecialsStyles = () => {
  if (document.getElementById("autosbc-recent-specials-style")) return;
  const style = document.createElement("style");
  style.id = "autosbc-recent-specials-style";
  style.textContent = `
    #${RECENT_SPECIALS_STRIP_ID} {
      position: fixed;
      left: 8px;
      right: 8px;
      bottom: 8px;
      z-index: 9998;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    #${RECENT_SPECIALS_STRIP_ID}.is-hidden {
      display: none;
    }
    #${RECENT_SPECIALS_STRIP_ID}.is-collapsed #${RECENT_SPECIALS_TRACK_ID} {
      display: none;
      pointer-events: none;
    }
    #${RECENT_SPECIALS_STRIP_ID}.is-collapsed #${RECENT_SPECIALS_TOGGLE_ID} {
      opacity: 0.9;
    }
    #${RECENT_SPECIALS_TRACK_ID} {
      --autosbc-card-count: 10;
      --autosbc-recent-card-width: 154px;
      --autosbc-overlap: 74px;
      --autosbc-card-step: calc(var(--autosbc-recent-card-width) - var(--autosbc-overlap));
      --autosbc-natural-track-width: calc(var(--autosbc-recent-card-width) + ((var(--autosbc-card-count) - 1) * var(--autosbc-card-step)) + 16px);
      --autosbc-track-width: min(calc(100vw - 16px), var(--autosbc-natural-track-width));
      pointer-events: auto;
      display: flex;
      align-items: flex-end;
      gap: 0;
      width: var(--autosbc-track-width);
      max-width: var(--autosbc-track-width);
      overflow: hidden;
      padding: 8px;
      border-radius: 10px;
      background: rgba(8, 11, 18, 0.82);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(6px);
    }
    #${RECENT_SPECIALS_TITLE_ID} {
      pointer-events: auto;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.3px;
      color: rgba(255, 255, 255, 0.9);
      text-transform: uppercase;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
    }
    #${RECENT_SPECIALS_TITLE_ID} .autosbc-recent-specials-title-text {
      pointer-events: none;
    }
    #${RECENT_SPECIALS_TOGGLE_ID} {
      pointer-events: auto;
      border: 1px solid rgba(255, 255, 255, 0.22);
      background: rgba(14, 20, 34, 0.86);
      color: rgba(255, 255, 255, 0.94);
      font-size: 10px;
      font-weight: 700;
      line-height: 1;
      padding: 3px 7px;
      border-radius: 999px;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 0.35px;
    }
    #${RECENT_SPECIALS_TOGGLE_ID}:hover {
      background: rgba(21, 30, 50, 0.95);
    }
    .autosbc-recent-special-card {
      width: var(--autosbc-recent-card-width);
      min-width: var(--autosbc-recent-card-width);
      overflow: visible;
      transform: translateX(0) scale(1);
      opacity: 1;
      transition: transform 560ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 520ms ease;
      will-change: transform, opacity;
      transition-delay: 0ms;
    }
    .autosbc-recent-special-meta {
      margin-top: 2px;
      text-align: center;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.2px;
      color: rgba(255, 255, 255, 0.9);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .autosbc-recent-special-card + .autosbc-recent-special-card {
      margin-left: calc(-1 * var(--autosbc-overlap));
    }
    .autosbc-recent-special-card > * {
      opacity: 1 !important;
      filter: none !important;
      max-width: 100%;
    }
    .autosbc-recent-special-card img,
    .autosbc-recent-special-card canvas {
      max-width: 100% !important;
      height: auto !important;
    }
    .autosbc-recent-special-card .ut-item-player-state-indicator-view.loan {
      background: #38c172;
      color: #04150c;
    }
    .autosbc-recent-special-card .ut-item-player-state-indicator-view.loan.cb-counter-seen {
      background: #e3342f;
      color: #fff;
    }
    .autosbc-recent-special-card.is-enter {
      transform: translateY(46px) scale(0.96);
      opacity: 0;
    }
    .autosbc-recent-special-card.is-enter-active {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
    .autosbc-recent-special-card.is-exit {
      transform: translateY(46px) scale(0.96);
      opacity: 0;
    }
    .autosbc-recent-special-empty {
      color: rgba(255, 255, 255, 0.85);
      font-size: 12px;
      letter-spacing: 0.2px;
      white-space: nowrap;
    }
  `;
  document.head.appendChild(style);
};

const ensureRecentSpecialsStripRoot = () => {
  if (!document?.body) {
    return null;
  }

  ensureRecentSpecialsStyles();

  let root = document.getElementById(RECENT_SPECIALS_STRIP_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = RECENT_SPECIALS_STRIP_ID;

    const title = document.createElement("div");
    title.id = RECENT_SPECIALS_TITLE_ID;
    const titleText = document.createElement("span");
    titleText.className = "autosbc-recent-specials-title-text";
    titleText.textContent = "HISTORY";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.id = RECENT_SPECIALS_TOGGLE_ID;
    toggle.textContent = "Collapse";
    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nextCollapsed = !isRecentSpecialsCollapsed();
      setRecentSpecialsCollapsed(nextCollapsed);
      renderRecentSpecialsStrip({ animatedKeys: new Set() });
    });

    title.appendChild(titleText);
    title.appendChild(toggle);
    root.appendChild(title);

    const track = document.createElement("div");
    track.id = RECENT_SPECIALS_TRACK_ID;
    root.appendChild(track);
    document.body.appendChild(root);
  }

  let title = document.getElementById(RECENT_SPECIALS_TITLE_ID);
  if (!title) {
    title = document.createElement("div");
    title.id = RECENT_SPECIALS_TITLE_ID;
    const titleText = document.createElement("span");
    titleText.className = "autosbc-recent-specials-title-text";
    titleText.textContent = "HISTORY";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.id = RECENT_SPECIALS_TOGGLE_ID;
    toggle.textContent = "Collapse";
    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nextCollapsed = !isRecentSpecialsCollapsed();
      setRecentSpecialsCollapsed(nextCollapsed);
      renderRecentSpecialsStrip({ animatedKeys: new Set() });
    });

    title.appendChild(titleText);
    title.appendChild(toggle);
    root.insertBefore(title, root.firstChild || null);
  }

  const existingToggle = document.getElementById(RECENT_SPECIALS_TOGGLE_ID);
  if (!existingToggle && title) {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.id = RECENT_SPECIALS_TOGGLE_ID;
    toggle.textContent = "Collapse";
    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nextCollapsed = !isRecentSpecialsCollapsed();
      setRecentSpecialsCollapsed(nextCollapsed);
      renderRecentSpecialsStrip({ animatedKeys: new Set() });
    });
    title.appendChild(toggle);
  }

  let track = document.getElementById(RECENT_SPECIALS_TRACK_ID);
  if (!track) {
    track = document.createElement("div");
    track.id = RECENT_SPECIALS_TRACK_ID;
    root.appendChild(track);
  }

  return { root, track };
};

const loadRecentSpecialsCollapsed = () => {
  try {
    return localStorage.getItem(RECENT_SPECIALS_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const saveRecentSpecialsCollapsed = (collapsed) => {
  try {
    localStorage.setItem(
      RECENT_SPECIALS_COLLAPSED_STORAGE_KEY,
      collapsed ? "1" : "0",
    );
  } catch {}
};

const isRecentSpecialsCollapsed = () =>
  !!window.__autoSbcRecentSpecialsCollapsed;

const setRecentSpecialsCollapsed = (collapsed) => {
  window.__autoSbcRecentSpecialsCollapsed = !!collapsed;
  saveRecentSpecialsCollapsed(!!collapsed);
};

const isSpecialPlayerItem = (item) => {
  if (!item) return false;
  const isPlayer =
    (typeof item?.isPlayer === "function" && item.isPlayer()) ||
    item?.isPlayer === true;
  if (!isPlayer) return false;

  
    return !isFodder(item) && (item.isSpecial()) && getPrice(item)>=50000;
  

  // Fallback: treat non-gold-common (rareflag > 3) as non-fodder
  const rareFlag = Number(item?.rareflag ?? item?._staticData?.rareflag ?? 0);
  return Number.isFinite(rareFlag) && rareFlag > 3;
};

const getRecentSpecialDefinitionId = (entryOrItem) =>
  Number(
    entryOrItem?.definitionId ??
      entryOrItem?.item?.definitionId ??
      entryOrItem?._staticData?.id,
  ) || 0;

const toEpochMsFromUnknown = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n < 1e11) return Math.floor(n * 1000); // likely seconds
  if (n > 1e15) return Math.floor(n / 1000); // likely microseconds
  return Math.floor(n); // likely milliseconds
};

const getEaRecencyTimestampMs = (item, fallbackMs = 0) => {
  const candidates = [
    item?.timestamp,
    item?._metaData?.timestamp,
    item?._staticData?.timestamp,
    item?.lastModified,
    item?._metaData?.lastModified,
  ];

  for (const raw of candidates) {
    const epochMs = toEpochMsFromUnknown(raw);
    if (epochMs > 0) return epochMs;
  }

  const fb = Number(fallbackMs);
  return Number.isFinite(fb) && fb > 0 ? fb : Date.now();
};

const formatRecentSpecialTimeAgo = (timestampMs) => {
  const seenMs = Number(timestampMs);
  if (!Number.isFinite(seenMs) || seenMs <= 0) {
    return "just now";
  }

  const elapsedMs = Math.max(0, Date.now() - seenMs);
  const totalMinutes = Math.floor(elapsedMs / (60 * 1000));
  if (totalMinutes <= 0) return "just now";
  if (totalMinutes < 60) {
    return `${totalMinutes}m ago`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) {
    return `${totalHours}h ago`;
  }

  const totalDays = Math.floor(totalHours / 24);
  return `${totalDays}d ago`;
};

const upsertRecentSpecialTimeAgoLabel = (wrapper, createdAt, isLeftMost = false) => {
  if (!wrapper) return;

  const ts = Number(createdAt || Date.now());
  wrapper.dataset.createdAt = String(ts);

  let meta = wrapper.querySelector(".autosbc-recent-special-meta");
  if (!meta) {
    meta = document.createElement("div");
    meta.className = "autosbc-recent-special-meta";
    wrapper.appendChild(meta);
  }

  meta.textContent = isLeftMost
    ? `seen ${formatRecentSpecialTimeAgo(ts)}`
    : formatRecentSpecialTimeAgo(ts);
};

const refreshRecentSpecialTimeAgoLabels = () => {
  const cards = document.querySelectorAll(
    `#${RECENT_SPECIALS_TRACK_ID} .autosbc-recent-special-card`,
  );
  cards.forEach((card, index) => {
    const createdAt = Number(card?.dataset?.createdAt || 0);
    upsertRecentSpecialTimeAgoLabel(card, createdAt, index === 0);
  });
};

const ensureRecentSpecialTimeAgoTicker = () => {
  if (recentSpecialsTimeAgoIntervalId) return;
  recentSpecialsTimeAgoIntervalId = setInterval(() => {
    refreshRecentSpecialTimeAgoLabels();
  }, RECENT_SPECIALS_TIMEAGO_REFRESH_MS);
};

const getClubCountsByDefinitionId = () => {
  const counts = new Map();
  const entries = Array.isArray(window.__clubPlayersEntries)
    ? window.__clubPlayersEntries
    : [];
  entries.forEach((entry) => {
    const defId = Number(entry?.definitionId);
    if (!Number.isFinite(defId) || defId <= 0) return;
    counts.set(defId, (counts.get(defId) || 0) + 1);
  });
  return counts;
};

const getPackedCountsByDefinitionId = (entries = []) => {
  const counts = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const defId = getRecentSpecialDefinitionId(entry);
    if (!Number.isFinite(defId) || defId <= 0) return;
    counts.set(defId, (counts.get(defId) || 0) + 1);
  });
  return counts;
};

const getRecentSpecialBottomLeftIndicator = (view) =>
  view?._bottomLeftStatusIndicator || null;

const hideRecentSpecialBottomLeftFallbackChip = (_view) => {};

const applyRecentSpecialSeenLabelFromViewState = (view) => {
  if (!view) return;
  applyRecentSpecialSeenLabel(
    view,
    view.__autoSbcRecentSeenEntry,
    view.__autoSbcRecentPackedCountsByDefinitionId,
  );
};

const ensureRecentSpecialSeenLabelRenderHook = (view) => {
  if (!view || view.__autoSbcSeenLabelRenderHooked) return;
  if (typeof view.render !== "function") return;

  const originalRender = view.render;
  view.render = function (...args) {
    const result = originalRender.apply(this, args);
    requestAnimationFrame(() => {
      applyRecentSpecialSeenLabelFromViewState(this);
    });
    return result;
  };
  view.__autoSbcSeenLabelRenderHooked = true;
};

const syncRecentSpecialSeenLabelViewState = (
  view,
  entry,
  packedCountsByDefinitionId,
) => {
  if (!view) return;
  view.__autoSbcRecentSeenEntry = entry;
  view.__autoSbcRecentPackedCountsByDefinitionId = packedCountsByDefinitionId;
  ensureRecentSpecialSeenLabelRenderHook(view);
};

const applyRecentSpecialSeenLabel = (view, entry, packedCountsByDefinitionId) => {
  if (!view) return;

  const defId = getRecentSpecialDefinitionId(entry);
  const clubCounts = getClubCountsByDefinitionId();
  const packedCount = Number(packedCountsByDefinitionId?.get?.(defId) || 0);
  const inClub = Number(clubCounts.get(defId) || 0) > 0;

  const applyOnce = () => {
    const indicator = getRecentSpecialBottomLeftIndicator(view);
    if (!indicator) return false;

    try {
      indicator.reset?.();
      const el = indicator.getRootElement?.() || indicator.__root;
      if (el) {
        el.classList.remove("cb-counter-seen");
      }
      hideRecentSpecialBottomLeftFallbackChip(view);
      return true;
    } catch {
      return true;
    }
  };

  if (applyOnce()) return;

  let attempts = 0;
  const retryApply = () => {
    attempts += 1;
    if (applyOnce()) return;
    if (attempts >= 6) return;
    requestAnimationFrame(retryApply);
  };
  requestAnimationFrame(retryApply);
};

const saveRecentSpecialsUnassignedEntries = (entries = []) => {
  try {
    const slim = (Array.isArray(entries) ? entries : [])
      .slice(0, RECENT_SPECIALS_MAX)
      .map((entry) => ({
        key: String(entry?.key || ""),
        definitionId: Number(getRecentSpecialDefinitionId(entry)) || 0,
        assetId: Number(entry?.item?._metaData?.id ?? entry?.assetId ?? 0) || 0,
        createdAt: Number(entry?.createdAt || Date.now()),
      }))
      .filter((entry) => entry.key && entry.definitionId > 0);

    localStorage.setItem(
      RECENT_SPECIALS_UNASSIGNED_STORAGE_KEY,
      JSON.stringify(slim),
    );
  } catch {}
};

const loadRecentSpecialsUnassignedEntries = () => {
  try {
    const raw = localStorage.getItem(RECENT_SPECIALS_UNASSIGNED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => ({
        key: String(entry?.key || ""),
        definitionId: Number(entry?.definitionId || 0),
        assetId: Number(entry?.assetId || 0),
        createdAt: Number(entry?.createdAt || Date.now()),
      }))
      .filter((entry) => entry.key && entry.definitionId > 0)
      .slice(0, RECENT_SPECIALS_MAX);
  } catch {
    return [];
  }
};

const resolveRecentSpecialEntryItem = (entry) => {
  if (entry?.item) {
    return entry.item;
  }

  const defId = getRecentSpecialDefinitionId(entry);
  if (!Number.isFinite(defId) || defId <= 0) {
    return null;
  }

  try {
    if (typeof window.collectionBookGetItemEntity === "function") {
      const entity = window.collectionBookGetItemEntity(defId);
      if (entity) return entity;
    }
  } catch {}

  return null;
};

const buildRecentSpecialCardView = (item) => {
  const Factory = globalThis.UTItemViewFactory;
  if (!Factory || typeof Factory.createLargeItem !== "function") return null;

  try {
    const view = Factory.createLargeItem(item);
    view?.init?.();
    view?.render?.(item);
    const el = view?.getRootElement?.() || null;
    return el ? { el, view } : null;
  } catch {
    return null;
  }
};

const getClubPlayerSnapshotForRecentSpecials = () => {
  try {
    const collection = services?.Item?.itemDao?.itemRepo?.club?.items?._collection;
    if (!collection || typeof collection !== "object") return [];

    return Object.entries(collection)
      .filter(([key]) => key !== "undefined")
      .map(([, item]) => item)
      .filter(
        (item) =>
          !!item &&
          ((typeof item?.isPlayer === "function" && item.isPlayer()) ||
            item?.isPlayer === true),
      );
  } catch {
    return [];
  }
};

const hasClubPlayersLoadedForRecentSpecials = () =>
  getClubPlayerSnapshotForRecentSpecials().length > 0;

const waitForClubPlayersLoadedForRecentSpecials = () => {
  if (hasClubPlayersLoadedForRecentSpecials() || window.__sbcPlayersReady) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const onReady = () => {
      try {
        window.removeEventListener("autosbc:club-players-ready", onReady);
      } catch {}
      resolve(true);
    };

    try {
      window.addEventListener("autosbc:club-players-ready", onReady, {
        once: true,
      });
    } catch {
      resolve(false);
    }
  });
};

const ensureClubPlayersLoadedThenRefreshRecentSpecials = () => {
  if (recentSpecialsClubReadyPromise) {
    return recentSpecialsClubReadyPromise;
  }

  recentSpecialsClubReadyPromise = waitForClubPlayersLoadedForRecentSpecials()
    .then((loaded) => {
      if (loaded) {
        renderRecentSpecialsStrip({ animatedKeys: new Set() });
      }
    })
    .finally(() => {
      recentSpecialsClubReadyPromise = null;
    });

  return recentSpecialsClubReadyPromise;
};

const loadRecentClubSpecialsFromEa = async (desiredCount = RECENT_SPECIALS_MAX) => {
  const count = Math.max(120, Number(desiredCount || RECENT_SPECIALS_MAX) * 25);
  const sortByRecency =
    typeof SearchSortType !== "undefined" &&
    SearchSortType &&
    typeof SearchSortType.RECENCY !== "undefined"
      ? SearchSortType.RECENCY
      : "recency";
  const sortDescending =
    typeof SearchSortOrder !== "undefined" &&
    SearchSortOrder &&
    typeof SearchSortOrder.DESCENDING !== "undefined"
      ? SearchSortOrder.DESCENDING
      : "desc";
  const playerType =
    typeof SearchType !== "undefined" && SearchType
      ? SearchType.PLAYER
      : undefined;

  let rows = [];
  try {
    if (typeof fetchClub === "function") {
      rows =
        (await fetchClub({
          count,
          sortBy: sortByRecency,
          sortOrder: sortDescending,
          type: playerType,
          showProgress: false,
        })) || [];
    }
  } catch (error) {
    console.warn("[recentSpecials] EA recency search failed", error);
    rows = [];
  }

  const seen = new Set();
  const recents = [];
  for (let idx = 0; idx < rows.length; idx += 1) {
    const item = rows[idx];
    if (!isSpecialPlayerItem(item)) continue;

    const key = getRecentSpecialEntryKey(item, `club-${idx}`);
    if (seen.has(key)) continue;
    seen.add(key);

    recents.push({
      key,
      item,
      createdAt: getEaRecencyTimestampMs(item, 0),
    });
    if (recents.length >= RECENT_SPECIALS_MAX) break;
  }

  return recents;
};

const ensureRecentClubSpecialsLoadedFromEa = () => {
  if (recentClubSpecialsLoadPromise) {
    return recentClubSpecialsLoadPromise;
  }

  recentClubSpecialsLoadPromise = waitForClubPlayersLoadedForRecentSpecials()
    .then(async (ready) => {
      if (!ready) return;
      const recents = await loadRecentClubSpecialsFromEa(RECENT_SPECIALS_MAX);
      window.__autoSbcRecentClubSpecials = Array.isArray(recents) ? recents : [];
      renderRecentSpecialsStrip({ animatedKeys: new Set() });
    })
    .finally(() => {
      recentClubSpecialsLoadPromise = null;
    });

  return recentClubSpecialsLoadPromise;
};

const getClubFallbackRecentSpecials = (limit, excludedKeys = new Set()) => {
  const cached = Array.isArray(window.__autoSbcRecentClubSpecials)
    ? window.__autoSbcRecentClubSpecials
    : [];
  if (!cached.length) return [];

  const localSeen = new Set(excludedKeys);
  const picked = [];
  for (const entry of cached) {
    if (picked.length >= limit) break;
    const key = String(entry?.key || "");
    if (!key || localSeen.has(key)) continue;
    localSeen.add(key);
    picked.push(entry);
  }
  return picked;
};

const getDisplayRecentSpecialsState = () => {
  const unassignedSource = Array.isArray(
    window.__autoSbcRecentPackedSpecialsFromUnassigned,
  )
    ? window.__autoSbcRecentPackedSpecialsFromUnassigned
    : [];

  // Once we have any unassigned-driven cards, stick with those as source of
  // truth (these are persisted separately and are independent from club state).
  const source = unassignedSource.length
    ? unassignedSource
    : Array.isArray(window.__autoSbcRecentClubSpecials)
      ? window.__autoSbcRecentClubSpecials
      : [];

  const normalized = source
    .filter((entry) => !!resolveRecentSpecialEntryItem(entry))
    .map((entry, index) => ({
      key:
        String(entry?.key || "") ||
        getRecentSpecialEntryKey(entry?.item, entry?.createdAt || index),
      item: resolveRecentSpecialEntryItem(entry),
      createdAt: Number(entry?.createdAt || Date.now()),
    }))
    .slice(0, RECENT_SPECIALS_MAX);
  return normalized;
};

const renderRecentSpecialsStrip = (options = {}) => {
  const { animatedKeys = new Set() } = options || {};
  const enabled = isRecentPackedSpecialsEnabled();
  if (!enabled) {
    const existingRoot = document.getElementById(RECENT_SPECIALS_STRIP_ID);
    if (existingRoot) {
      existingRoot.classList.add("is-hidden");
    }
    return;
  }

  const state = getDisplayRecentSpecialsState();

  // Initial mode: load via EA recency only when no unassigned-derived cards
  // exist yet. After that, we stick with the unassigned list.
  const hasUnassignedSource =
    (window.__autoSbcRecentPackedSpecialsFromUnassigned || []).length > 0;
  if (!hasUnassignedSource && !hasClubPlayersLoadedForRecentSpecials()) {
    void ensureClubPlayersLoadedThenRefreshRecentSpecials();
  }
  if (!hasUnassignedSource && state.length < RECENT_SPECIALS_MAX) {
    void ensureRecentClubSpecialsLoadedFromEa();
  }

  const stripRoot = ensureRecentSpecialsStripRoot();
  if (!stripRoot) {
    return;
  }

  const { root, track } = stripRoot;
  root.classList.remove("is-hidden");
  root.classList.toggle("is-collapsed", isRecentSpecialsCollapsed());

  const toggle = document.getElementById(RECENT_SPECIALS_TOGGLE_ID);
  if (toggle) {
    toggle.textContent = isRecentSpecialsCollapsed() ? "Expand" : "Collapse";
  }

  if (isRecentSpecialsCollapsed()) {
    return;
  }

  ensureRecentSpecialTimeAgoTicker();

  const beforeRects = new Map(
    Array.from(track.querySelectorAll(".autosbc-recent-special-card")).map((el) => [
      String(el.dataset.key || ""),
      el.getBoundingClientRect(),
    ]),
  );

  const previousNodes = new Map(
    Array.from(track.querySelectorAll(".autosbc-recent-special-card")).map((el) => [
      String(el.dataset.key || ""),
      el,
    ]),
  );
  const nextKeys = new Set(state.map((entry) => String(entry.key)));

  previousNodes.forEach((node, key) => {
    if (nextKeys.has(key)) return;
    node.classList.remove("is-enter", "is-enter-active");
    const previousIndex = Array.from(previousNodes.keys()).indexOf(key);
    node.style.transitionDelay = `${Math.max(0, previousIndex) * RECENT_SPECIALS_SNAKE_STAGGER_MS}ms`;
    // Force layout so exit transition always starts from the current rendered state.
    void node.getBoundingClientRect();
    node.classList.add("is-exit");

    let removed = false;
    const removeNode = () => {
      if (removed) return;
      removed = true;
      try {
        node.removeEventListener("transitionend", onTransitionEnd);
      } catch {}
      if (node.parentElement === track) {
        node.remove();
      }
    };

    const onTransitionEnd = (event) => {
      if (event?.target !== node) return;
      removeNode();
    };

    node.addEventListener("transitionend", onTransitionEnd);
    setTimeout(
      removeNode,
      700 + Math.max(0, previousIndex) * RECENT_SPECIALS_SNAKE_STAGGER_MS,
    );
  });

  if (!state.length) {
    track.innerHTML = "";
    const empty = document.createElement("div");
    empty.className = "autosbc-recent-special-empty";
    empty.textContent = "No special cards packed yet";
    track.appendChild(empty);
    return;
  }

  const empty = track.querySelector(".autosbc-recent-special-empty");
  if (empty) empty.remove();

  const nextIndexByKey = new Map(
    state.map((entry, index) => [String(entry?.key || ""), index]),
  );
  const packedCountsByDefinitionId = getPackedCountsByDefinitionId(state);

  state.forEach((entry, index) => {
    const key = String(entry.key || "");
    if (!key) return;

    let wrapper = previousNodes.get(key);
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.className = "autosbc-recent-special-card is-enter";
      wrapper.dataset.key = key;
      wrapper.style.transitionDelay = `${index * RECENT_SPECIALS_SNAKE_STAGGER_MS}ms`;
      const cardBuilt = buildRecentSpecialCardView(entry.item);
      if (cardBuilt?.el) {
        wrapper.appendChild(cardBuilt.el);
        wrapper.__recentView = cardBuilt.view || null;
        syncRecentSpecialSeenLabelViewState(
          cardBuilt.view || null,
          entry,
          packedCountsByDefinitionId,
        );
        applyRecentSpecialSeenLabel(
          cardBuilt.view || null,
          entry,
          packedCountsByDefinitionId,
        );
      } else {
        wrapper.textContent = String(entry.item?._staticData?.name || entry.item?.definitionId || "Special");
      }
      upsertRecentSpecialTimeAgoLabel(wrapper, entry.createdAt, index === 0);
      track.appendChild(wrapper);

      if (animatedKeys.has(key)) {
        requestAnimationFrame(() => {
          wrapper.classList.add("is-enter-active");
          wrapper.classList.remove("is-enter");
        });
      } else {
        wrapper.classList.remove("is-enter");
      }
    } else {
      wrapper.style.transitionDelay = `${index * RECENT_SPECIALS_SNAKE_STAGGER_MS}ms`;
      syncRecentSpecialSeenLabelViewState(
        wrapper.__recentView || null,
        entry,
        packedCountsByDefinitionId,
      );
      applyRecentSpecialSeenLabel(
        wrapper.__recentView || null,
        entry,
        packedCountsByDefinitionId,
      );
      upsertRecentSpecialTimeAgoLabel(wrapper, entry.createdAt, index === 0);
      track.appendChild(wrapper);
    }
  });

  const afterNodes = Array.from(
    track.querySelectorAll(".autosbc-recent-special-card"),
  );
  afterNodes.forEach((node) => {
    const key = String(node.dataset.key || "");
    if (!key) return;

    const nextIndex = Number(nextIndexByKey.get(key) || 0);
    node.style.transitionDelay = `${nextIndex * RECENT_SPECIALS_SNAKE_STAGGER_MS}ms`;

    if (animatedKeys.has(key)) return;

    const beforeRect = beforeRects.get(key);
    if (!beforeRect) return;
    const afterRect = node.getBoundingClientRect();
    const dx = beforeRect.left - afterRect.left;

    if (Math.abs(dx) < 1) return;

    node.style.transition = "none";
    node.style.transform = `translateX(${dx}px)`;
    requestAnimationFrame(() => {
      node.style.transition = `transform 640ms cubic-bezier(0.22, 0.61, 0.36, 1) ${nextIndex * RECENT_SPECIALS_SNAKE_STAGGER_MS}ms, opacity 520ms ease ${nextIndex * RECENT_SPECIALS_SNAKE_STAGGER_MS}ms`;
      node.style.transform = "translateX(0)";
    });
  });

  refreshRecentSpecialTimeAgoLabels();
};

const recordRecentPackedSpecials = (items = []) => {
  const enabled = isRecentPackedSpecialsEnabled();
  if (!enabled) {
    return;
  }

  const specials = (Array.isArray(items) ? items : [])
    .filter(Boolean)
    .filter((item) => isSpecialPlayerItem(item));

  if (!specials.length) {
    return;
  }

  const previous = Array.isArray(window.__autoSbcRecentPackedSpecialsFromUnassigned)
    ? window.__autoSbcRecentPackedSpecialsFromUnassigned
    : [];
  const byKey = new Map(previous.map((entry) => [String(entry.key), entry]));
  const touchedByKey = new Map();
  const animatedKeys = new Set();

  for (const item of specials) {
    const rawId = Number(item?.id);
    const definitionId = Number(item?.definitionId);
    const timestamp = getEaRecencyTimestampMs(item, Date.now());
    const key =
      Number.isFinite(rawId) && rawId > 0
        ? `item-${rawId}`
        : getRecentSpecialEntryKey(
            item,
            `${definitionId || 0}-${timestamp}-${Math.random().toString(36).slice(2, 6)}`,
          );

    const existing = byKey.get(String(key));
    const nextEntry = { key, item, createdAt: timestamp };

    byKey.set(String(key), nextEntry);
    touchedByKey.set(String(key), nextEntry);

    if (!existing) {
      animatedKeys.add(String(key));
    }
  }

  if (!touchedByKey.size) {
    return;
  }

  const touched = Array.from(touchedByKey.values()).reverse();
  const remaining = previous.filter(
    (entry) => !touchedByKey.has(String(entry?.key || "")),
  );
  const merged = [...touched, ...remaining].slice(0, RECENT_SPECIALS_MAX);
  window.__autoSbcRecentPackedSpecialsFromUnassigned = merged;
  saveRecentSpecialsUnassignedEntries(merged);
  renderRecentSpecialsStrip({ animatedKeys });
};

const refreshRecentPackedSpecialStrip = () => {
  renderRecentSpecialsStrip({ animatedKeys: new Set() });
};

if (typeof window !== "undefined") {
  window.__autoSbcRecentSpecialsCollapsed = loadRecentSpecialsCollapsed();
  const persistedUnassigned = loadRecentSpecialsUnassignedEntries();
  window.__autoSbcRecentPackedSpecialsFromUnassigned =
    window.__autoSbcRecentPackedSpecialsFromUnassigned ||
    (persistedUnassigned.length
      ? persistedUnassigned
      : window.__autoSbcRecentPackedSpecials || []);
  window.__autoSbcRecentClubSpecials = window.__autoSbcRecentClubSpecials || [];
  window.__autoSbcRecentPackedSpecials = window.__autoSbcRecentPackedSpecialsFromUnassigned;
  window.recordRecentPackedSpecials = recordRecentPackedSpecials;
  window.refreshRecentPackedSpecialStrip = refreshRecentPackedSpecialStrip;

  // Always mount the strip immediately so UI is visible even before async
  // data fetches/events complete.
  setTimeout(() => {
    renderRecentSpecialsStrip({ animatedKeys: new Set() });
  }, 0);

  // Trigger initial render source load when needed.
  if ((window.__autoSbcRecentPackedSpecialsFromUnassigned || []).length === 0) {
    void ensureRecentClubSpecialsLoadedFromEa();
  }
}
