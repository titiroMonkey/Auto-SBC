const SBC_QUEUE_HISTORY_LIMIT = 300;

const getQueueHistoryStorageKey = (panelKey) => `sbc.queueHistory.${panelKey}`;

const getQueueItemKey = (item) => {
  if (!item) return null;

  const itemId = Number(item?.id);
  if (Number.isFinite(itemId) && itemId > 0) {
    return `item:${itemId}`;
  }

  const tradeId = Number(item?._auction?.tradeId ?? item?._auction?.id);
  if (Number.isFinite(tradeId) && tradeId > 0) {
    return `trade:${tradeId}`;
  }

  return null;
};

const getQueuePendingKeySet = (panelKey) => {
  if (!window.__sbcQueueRuntime) {
    window.__sbcQueueRuntime = {};
  }
  if (!window.__sbcQueueRuntime[panelKey]) {
    window.__sbcQueueRuntime[panelKey] = {
      pendingBatches: 0,
      closeTimeoutId: null,
      stopRequested: false,
      stopHandlers: new Set(),
    };
  }

  const runtime = window.__sbcQueueRuntime[panelKey];
  if (!(runtime.pendingItemKeys instanceof Set)) {
    runtime.pendingItemKeys = new Set();
  }

  return runtime.pendingItemKeys;
};

const reserveQueuedItems = (panelKey, items = []) => {
  const pendingItemKeys = getQueuePendingKeySet(panelKey);
  const seenInThisCall = new Set();
  const queuedItems = [];
  let skippedCount = 0;

  (Array.isArray(items) ? items : []).forEach((item) => {
    const itemKey = getQueueItemKey(item);

    if (!itemKey) {
      queuedItems.push(item);
      return;
    }

    if (pendingItemKeys.has(itemKey) || seenInThisCall.has(itemKey)) {
      skippedCount += 1;
      return;
    }

    pendingItemKeys.add(itemKey);
    seenInThisCall.add(itemKey);
    queuedItems.push(item);
  });

  return { queuedItems, skippedCount };
};

const releaseQueuedItems = (panelKey, items = []) => {
  const pendingItemKeys = getQueuePendingKeySet(panelKey);
  (Array.isArray(items) ? items : []).forEach((item) => {
    const itemKey = getQueueItemKey(item);
    if (itemKey) {
      pendingItemKeys.delete(itemKey);
    }
  });
};

const readQueueHistory = (panelKey) => {
  try {
    const raw = localStorage.getItem(getQueueHistoryStorageKey(panelKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueueHistory = (panelKey, entries = []) => {
  try {
    localStorage.setItem(
      getQueueHistoryStorageKey(panelKey),
      JSON.stringify(entries),
    );
  } catch {}
};

const trimQueueHistoryEntries = (entries = []) => {
  if (!Array.isArray(entries) || !entries.length) return [];

  let rowCount = 0;
  const trimmed = [];

  for (let idx = entries.length - 1; idx >= 0; idx -= 1) {
    const entry = entries[idx];
    if (entry?.type === "row") {
      if (rowCount >= SBC_QUEUE_HISTORY_LIMIT) continue;
      rowCount += 1;
    }
    trimmed.push(entry);
  }

  return trimmed.reverse();
};

const appendQueueHistoryEntry = (panelKey, entry) => {
  const id =
    entry?.id ||
    `${panelKey}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const history = readQueueHistory(panelKey);
  history.push({ ...entry, id });
  const trimmed = trimQueueHistoryEntries(history);
  writeQueueHistory(panelKey, trimmed);
  return id;
};

const updateQueueHistoryEntry = (panelKey, id, patch = {}) => {
  if (!id) return;
  const history = readQueueHistory(panelKey);
  const index = history.findIndex((entry) => entry?.id === id);
  if (index < 0) return;

  history[index] = {
    ...history[index],
    ...patch,
    id,
  };

  const trimmed = trimQueueHistoryEntries(history);
  writeQueueHistory(panelKey, trimmed);
};

const createHistoryRow = ({ columns = [], statusColor = "" } = {}) => {
  const row = document.createElement("div");
  row.style.display = "grid";
  row.style.gridTemplateColumns = "2fr 1fr 1fr 1fr";
  row.style.gap = "0.5rem";
  row.style.alignItems = "center";

  const spans = [0, 1, 2, 3].map(() => document.createElement("span"));
  spans.forEach((span, idx) => {
    span.textContent = columns[idx] ?? "—";
    row.appendChild(span);
  });

  if (statusColor) {
    spans[3].style.color = statusColor;
  }

  return {
    row,
    col1Span: spans[0],
    col2Span: spans[1],
    col3Span: spans[2],
    statusSpan: spans[3],
  };
};

const restoreQueueHistoryRows = (panelKey, rowsRoot) => {
  if (!rowsRoot) return;
  const history = readQueueHistory(panelKey);
  if (!history.length) return;

  history.forEach((entry) => {
    if (entry?.type === "divider") {
      appendQueueBatchDivider(rowsRoot, entry.label || "Batch");
      return;
    }

    if (entry?.type === "row") {
      const { row } = createHistoryRow({
        columns: entry.columns,
        statusColor: entry.statusColor,
      });
      rowsRoot.appendChild(row);
    }
  });
};

const createOrGetQueueStatusPanel = ({ panelKey, title, headers }) => {
  const rootId = "sbc-status-stack-root";
  let root = document.getElementById(rootId);

  if (!root) {
    root = document.createElement("div");
    root.id = rootId;
    root.style.position = "fixed";
    root.style.right = "2rem";
    root.style.bottom = "1.5rem";
    root.style.zIndex = "9999";
    root.style.display = "flex";
    root.style.flexDirection = "column-reverse";
    root.style.gap = "0.75rem";
    root.style.alignItems = "flex-end";
    root.style.pointerEvents = "none";
    document.body.appendChild(root);
  }

  if (!window.__sbcQueueStatusPanels) {
    window.__sbcQueueStatusPanels = new Map();
  }
  if (!window.__sbcQueueRuntime) {
    window.__sbcQueueRuntime = {};
  }
  if (!window.__sbcQueueRuntime[panelKey]) {
    window.__sbcQueueRuntime[panelKey] = {
      pendingBatches: 0,
      closeTimeoutId: null,
      stopRequested: false,
      stopHandlers: new Set(),
    };
  }

  const existing = window.__sbcQueueStatusPanels.get(panelKey);
  if (existing?.container?.isConnected) {
    return existing;
  }

  const container = document.createElement("div");
  container.className = "quick-buy-squad-status sbc-status-instance";
  container.style.padding = "0.75rem";
  container.style.background = "rgba(17, 24, 39, 0.9)";
  container.style.border = "1px solid rgba(255, 255, 255, 0.15)";
  container.style.borderRadius = "10px";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.gap = "0.35rem";
  container.style.maxHeight = "45vh";
  container.style.overflow = "hidden";
  container.style.minWidth = "320px";
  container.style.boxSizing = "border-box";
  container.style.boxShadow = "0 12px 24px rgba(0, 0, 0, 0.45)";
  container.style.position = "relative";
  container.style.pointerEvents = "auto";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "×";
  closeButton.setAttribute("aria-label", "Close status panel");
  closeButton.style.position = "absolute";
  closeButton.style.top = "0.35rem";
  closeButton.style.right = "0.5rem";
  closeButton.style.background = "transparent";
  closeButton.style.border = "none";
  closeButton.style.color = "#ffffff";
  closeButton.style.fontSize = "1.2rem";
  closeButton.style.cursor = "pointer";
  closeButton.style.lineHeight = "1";
  closeButton.style.padding = "0";

  const content = document.createElement("div");
  content.className = "quick-buy-squad-content";
  content.style.display = "flex";
  content.style.flexDirection = "column";
  content.style.gap = "0.35rem";
  content.style.overflowY = "auto";
  content.style.maxHeight = "420px";

  const footer = document.createElement("div");
  footer.className = "quick-buy-squad-footer";
  footer.style.marginTop = "0.5rem";
  footer.style.fontSize = "0.85rem";
  footer.style.opacity = "0.85";
  footer.style.minHeight = "1.2rem";
  footer.style.textAlign = "center";

  const titleBlock = document.createElement("div");
  titleBlock.textContent = title;
  titleBlock.style.fontWeight = "bold";
  titleBlock.style.marginBottom = "0.35rem";

  const headerRow = document.createElement("div");
  headerRow.style.display = "grid";
  headerRow.style.gridTemplateColumns = "2fr 1fr 1fr 1fr";
  headerRow.style.gap = "0.5rem";
  headerRow.style.fontWeight = "bold";
  headerRow.style.borderBottom = "1px solid rgba(255, 255, 255, 0.1)";
  headerRow.style.position = "sticky";
  headerRow.style.top = "0";
  headerRow.style.zIndex = "2";
  headerRow.style.background = "rgba(17, 24, 39, 0.96)";
  headerRow.style.padding = "0.2rem 0";
  headers.forEach((label) => {
    const span = document.createElement("span");
    span.textContent = label;
    headerRow.appendChild(span);
  });

  const rowsRoot = document.createElement("div");
  rowsRoot.className = "sbc-status-rows-root";
  rowsRoot.style.display = "flex";
  rowsRoot.style.flexDirection = "column";
  rowsRoot.style.gap = "0.35rem";

  const dispose = () => {
    try {
      window.__sbcQueueStatusPanels?.delete?.(panelKey);
      container.remove();
      if (root && !root.children.length) {
        root.remove();
      }
    } catch {}
  };

  closeButton.addEventListener("click", () => {
    requestQueueStop(panelKey);
  });
  content.append(titleBlock, headerRow, rowsRoot);
  container.append(closeButton, content, footer);
  root.appendChild(container);

  const panel = { container, content, footer, rowsRoot, dispose };
  window.__sbcQueueStatusPanels.set(panelKey, panel);
  restoreQueueHistoryRows(panelKey, rowsRoot);
  return panel;
};

const cancelQueueCloseCountdown = (panelKey) => {
  const runtime = window.__sbcQueueRuntime?.[panelKey];
  if (!runtime) return;
  if (runtime.closeTimeoutId) {
    clearTimeout(runtime.closeTimeoutId);
    runtime.closeTimeoutId = null;
  }
};

const isQueueStopRequested = (panelKey) =>
  window.__sbcQueueRuntime?.[panelKey]?.stopRequested === true;

const registerQueueStopHandler = (panelKey, handler) => {
  if (typeof handler !== "function") return () => {};

  const runtime = window.__sbcQueueRuntime?.[panelKey];
  if (!runtime) return () => {};

  runtime.stopHandlers ||= new Set();
  runtime.stopHandlers.add(handler);

  return () => {
    try {
      runtime.stopHandlers?.delete(handler);
    } catch {}
  };
};

const requestQueueStop = (panelKey) => {
  const runtime = window.__sbcQueueRuntime?.[panelKey];
  const panel = window.__sbcQueueStatusPanels?.get(panelKey);
  if (!runtime) return;

  runtime.stopRequested = true;
  cancelQueueCloseCountdown(panelKey);

  if (panel?.footer) {
    panel.footer.textContent = "Stopping...";
  }

  const handlers = Array.from(runtime.stopHandlers || []);
  handlers.forEach((handler) => {
    try {
      handler();
    } catch {}
  });

  panel?.dispose?.();
};

const queueSleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const runCancellableDelay = async (
  panelKey,
  delayMs,
  footer,
  label = "Waiting",
) => {
  const total = Math.max(0, Number(delayMs) || 0);
  if (!total) return !isQueueStopRequested(panelKey);

  let remaining = total;
  while (remaining > 0) {
    if (isQueueStopRequested(panelKey)) {
      if (footer) footer.textContent = "Stopped";
      return false;
    }

    if (footer) {
      footer.textContent = `${label} ${Math.ceil(remaining / 1000)}s`;
    }

    const chunk = Math.min(250, remaining);
    await queueSleep(chunk);
    remaining -= chunk;
  }

  if (footer) {
    footer.textContent = "";
  }
  return !isQueueStopRequested(panelKey);
};

const scheduleQueueCloseCountdown = (panelKey, panel, seconds = 3) => {
  const runtime = window.__sbcQueueRuntime?.[panelKey];
  if (!runtime || !panel?.footer) return;

  cancelQueueCloseCountdown(panelKey);

  const tick = () => {
    if (!window.__sbcQueueRuntime?.[panelKey]) return;
    if (window.__sbcQueueRuntime[panelKey].pendingBatches > 0) {
      panel.footer.textContent = "";
      return;
    }

    if (seconds <= 0) {
      panel.dispose?.();
      return;
    }

    panel.footer.textContent = `Closing in ${seconds}s`;
    seconds -= 1;
    runtime.closeTimeoutId = setTimeout(tick, 1000);
  };

  tick();
};

const appendQueueBatchDivider = (rowsRoot, label) => {
  if (!rowsRoot) return;

  const divider = document.createElement("div");
  divider.style.display = "flex";
  divider.style.alignItems = "center";
  divider.style.gap = "0.5rem";
  divider.style.margin = "0.35rem 0";

  const leftLine = document.createElement("span");
  leftLine.style.flex = "1";
  leftLine.style.height = "1px";
  leftLine.style.background = "rgba(255, 255, 255, 0.18)";

  const text = document.createElement("span");
  text.textContent = label;
  text.style.fontSize = "0.75rem";
  text.style.opacity = "0.8";
  text.style.whiteSpace = "nowrap";

  const rightLine = document.createElement("span");
  rightLine.style.flex = "1";
  rightLine.style.height = "1px";
  rightLine.style.background = "rgba(255, 255, 255, 0.18)";

  divider.append(leftLine, text, rightLine);
  rowsRoot.appendChild(divider);
};

const appendQueueBatchDividerWithHistory = (panelKey, rowsRoot, label) => {
  appendQueueBatchDivider(rowsRoot, label);
  appendQueueHistoryEntry(panelKey, {
    type: "divider",
    label,
  });
};

const clearSoldItemsBeforeListing = async () => {
  if (typeof clearSoldItems !== "function") {
    return;
  }

  try {
    await clearSoldItems();
  } catch (error) {
    console.warn("[quickListItems] clearSoldItems failed", error);
  }
};

const fetchTransferListItemsForListing = async () => {
  await clearSoldItemsBeforeListing();

  if (typeof getTransferItems === "function") {
    const items = await getTransferItems();
    return Array.isArray(items) ? items : [];
  }

  if (typeof fetchTransferList === "function") {
    const items = await fetchTransferList();
    return Array.isArray(items) ? items : [];
  }

  if (services?.Item?.requestTransferItems) {
    return await new Promise((resolve, reject) => {
      try {
        services.Item.requestTransferItems().observe(null, (obs, event) => {
          try {
            obs?.unobserve?.(null);
            const items = event?.response?.items;
            resolve(Array.isArray(items) ? items : []);
          } catch (err) {
            reject(err);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  return [];
};

const getTransferListCountForListing = async () => {
  const items = await fetchTransferListItemsForListing();
  return Array.isArray(items) ? items.length : 0;
};

const getTransferListIdentityKey = (item) => {
  if (!item) return null;

  const tradeId = Number(item?._auction?.tradeId ?? item?._auction?.id);
  if (Number.isFinite(tradeId) && tradeId > 0) {
    return `trade:${tradeId}`;
  }

  const itemId = Number(item?.id);
  if (Number.isFinite(itemId) && itemId > 0) {
    return `item:${itemId}`;
  }

  return null;
};

const isLikelyOnTransferList = (item) => {
  const tradeState = String(
    item?._auction?.tradeState || item?._auction?._tradeState || "",
  ).toLowerCase();

  if (
    tradeState === "active" ||
    tradeState === "expired" ||
    tradeState === "closed"
  ) {
    return true;
  }

  const tradeId = Number(item?._auction?.tradeId ?? item?._auction?.id);
  return Number.isFinite(tradeId) && tradeId > 0;
};

const setQuickListRowStopped = (row) => {
  if (!row?.statusSpan) return;
  const statusText = row.statusSpan.textContent;
  if (
    statusText === "Listed" ||
    statusText === "Failed" ||
    statusText === "No price" ||
    statusText === "Not tradable" ||
    statusText === "Price dropped (skipped)"
  ) {
    return;
  }

  row.statusSpan.textContent = "Stopped";
  row.statusSpan.style.color = "#f59e0b";
  updateQueueHistoryEntry("quick-list", row.historyId, {
    columns: [
      row.name,
      row.buyNowSpan?.textContent || "—",
      row.minSpan?.textContent || "—",
      "Stopped",
    ],
    statusColor: "#f59e0b",
  });
};

const setRefreshRowStopped = (row) => {
  if (!row?.statusSpan) return;
  const statusText = row.statusSpan.textContent;
  if (
    statusText === "Updated" ||
    statusText === "No price" ||
    statusText === "Error"
  ) {
    return;
  }

  row.statusSpan.textContent = "Stopped";
  row.statusSpan.style.color = "#f59e0b";
  updateQueueHistoryEntry("refresh-prices", row.historyId, {
    columns: [
      row.name,
      row.oldPriceSpan?.textContent || "—",
      row.newPriceSpan?.textContent || "—",
      "Stopped",
    ],
    statusColor: "#f59e0b",
  });
};

const quickListItems = async (
  items = [],
  {
    context = {},
    durationSeconds = 60 * 60,
    minDelayMs = 1000,
    maxDelayMs = 1000,
    suppressNotifications = false,
    min = -1,
    max = -1,
  } = {},
) => {
  const notify = (message, type) => {
    if (!suppressNotifications) showNotification(message, type);
  };

  if (!Array.isArray(items) || items.length === 0) {
    notify("No items to list", UINotificationType.NEGATIVE);
    return { success: false, reason: "noItems" };
  }

  const {
    queuedItems: uniqueQueuedItems,
    skippedCount: skippedAlreadyQueuedCount,
  } = reserveQueuedItems("quick-list", items);

  if (!uniqueQueuedItems.length) {
    notify(
      "Selected items are already queued for quick list",
      UINotificationType.NEUTRAL,
    );
    return {
      success: false,
      reason: "alreadyQueued",
      skipped: skippedAlreadyQueuedCount,
    };
  }

  if (skippedAlreadyQueuedCount > 0) {
    notify(
      `Skipped ${skippedAlreadyQueuedCount} already queued quick list item(s)`,
      UINotificationType.NEUTRAL,
    );
  }

  const {
    content: statusContent,
    footer: timerFooter,
    rowsRoot,
  } = createOrGetQueueStatusPanel({
    panelKey: "quick-list",
    title: "Quick List Items",
    headers: ["Item", "Buy Now", "Min", "Status"],
  });

  window.__sbcQueueRuntime["quick-list"].stopRequested = false;
  window.__sbcQueueRuntime["quick-list"].pendingBatches += 1;
  cancelQueueCloseCountdown("quick-list");

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const randomDelay = () => {
    const lo = clamp(Number(minDelayMs) || 1000, 0, 60000);
    const hi = clamp(Number(maxDelayMs) || 1000, lo, 60000);
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  };

  let transferItemsSnapshot = [];
  try {
    transferItemsSnapshot = await fetchTransferListItemsForListing();
  } catch {}

  const knownTransferIdentityKeys = new Set(
    (transferItemsSnapshot || [])
      .map((item) => getTransferListIdentityKey(item))
      .filter(Boolean),
  );

  const isItemAlreadyOnTransferList = (item) => {
    const identityKey = getTransferListIdentityKey(item);
    if (identityKey && knownTransferIdentityKeys.has(identityKey)) {
      return true;
    }
    return isLikelyOnTransferList(item);
  };

  const rows = uniqueQueuedItems.map((item) => {
    const name = formatPlayerName(item);
    const {
      row,
      col2Span: buyNowSpan,
      col3Span: minSpan,
      statusSpan,
    } = createHistoryRow({ columns: [name, "—", "—", "Queued"] });

    rowsRoot.appendChild(row);

    const historyId = appendQueueHistoryEntry("quick-list", {
      type: "row",
      columns: [name, "—", "—", "Queued"],
      statusColor: "",
    });

    return {
      item,
      buyNowSpan,
      minSpan,
      statusSpan,
      historyId,
      name,
      onTransferList: isItemAlreadyOnTransferList(item),
    };
  });

  const stopRows = () => {
    rows.forEach(setQuickListRowStopped);
    timerFooter.textContent = "Stopped";
  };

  const unregisterStopHandler = registerQueueStopHandler(
    "quick-list",
    stopRows,
  );

  statusContent.scrollTop = statusContent.scrollHeight;

  // Move all tradable items to the transfer list first so this doesn't block
  // other processes while individual listings are processed one by one.
  const tradableRowsToMove = rows.filter(
    (row) => row?.item?.tradable !== false && !row?.onTransferList,
  );
  if (tradableRowsToMove.length) {
    try {
      const transferListCount = await getTransferListCountForListing();
      const availableSlots = Math.max(0, 100 - transferListCount);

      if (availableSlots <= 0) {
        notify(
          `Transfer list full (${transferListCount}/100) - skipping move to transfer list`,
          UINotificationType.NEUTRAL,
        );
      } else {
        const tradableItemsToMove = tradableRowsToMove.slice(0, availableSlots);
        if (tradableItemsToMove.length > 0) {
          services.Item.move(
            tradableItemsToMove.map((row) => row.item),
            5,
          );
          tradableItemsToMove.forEach((row) => {
            row.onTransferList = true;
            const identityKey = getTransferListIdentityKey(row.item);
            if (identityKey) {
              knownTransferIdentityKeys.add(identityKey);
            }
          });
        }
      }
    } catch (err) {
      console.warn("[quickListItems] bulk move to transfer list failed", err);
    }
  }

  let successCount = 0;

  const runBatch = async () => {
    let transferListCount = 0;
    try {
      transferListCount = await getTransferListCountForListing();
    } catch (err) {
      console.warn("[quickListItems] transfer list read failed", err);
      notify(
        "Failed to read transfer list - skipping listing",
        UINotificationType.NEGATIVE,
      );
      rows.forEach((row) => {
        if (row?.statusSpan?.textContent !== "Queued") return;
        row.statusSpan.textContent = "Transfer list read failed";
        row.statusSpan.style.color = "#f40727";
        updateQueueHistoryEntry("quick-list", row.historyId, {
          columns: [
            row.name,
            row.buyNowSpan?.textContent || "—",
            row.minSpan?.textContent || "—",
            "Transfer list read failed",
          ],
          statusColor: "#f40727",
        });
      });
      return {
        success: false,
        reason: "transferListReadFailed",
        listed: successCount,
        total: rows.length,
      };
    }

    if (transferListCount >= 100) {
      const queueNeedingSlots = rows.filter(
        (row) =>
          row?.statusSpan?.textContent === "Queued" && !row?.onTransferList,
      );
      if (queueNeedingSlots.length > 0) {
        notify(
          `Transfer list full (${transferListCount}/100) - only relisting existing transfer items`,
          UINotificationType.NEUTRAL,
        );
      }
    }

    if (isQueueStopRequested("quick-list")) {
      stopRows();
      return {
        success: false,
        reason: "stopped",
        listed: successCount,
        total: rows.length,
      };
    }

    appendQueueBatchDividerWithHistory(
      "quick-list",
      rowsRoot,
      `Quick List Batch • ${new Date().toLocaleTimeString()}`,
    );

    let currentTransferCount = transferListCount;

    for (let idx = 0; idx < rows.length; idx += 1) {
      const row = rows[idx];
      const {
        item,
        buyNowSpan,
        minSpan,
        statusSpan,
        historyId,
        name,
        onTransferList,
      } = row;

      if (!onTransferList && currentTransferCount >= 100) {
        statusSpan.textContent = "Transfer list full";
        statusSpan.style.color = "#f40727";
        updateQueueHistoryEntry("quick-list", historyId, {
          columns: [
            name,
            buyNowSpan?.textContent || "—",
            minSpan?.textContent || "—",
            "Transfer list full",
          ],
          statusColor: "#f40727",
        });
        continue;
      }

      if (isQueueStopRequested("quick-list")) {
        for (let stopIdx = idx; stopIdx < rows.length; stopIdx += 1) {
          setQuickListRowStopped(rows[stopIdx]);
        }
        timerFooter.textContent = "Stopped";
        return {
          success: false,
          reason: "stopped",
          listed: successCount,
          total: rows.length,
        };
      }

      statusSpan.textContent = "Listing...";
      statusSpan.style.color = "";
      updateQueueHistoryEntry("quick-list", historyId, {
        columns: [
          name,
          buyNowSpan.textContent || "—",
          minSpan.textContent || "—",
          "Listing...",
        ],
        statusColor: "",
      });

      const res = await quickListItem(item, {
        context,
        durationSeconds,
        suppressNotifications: true,
        min,
        max,
      });

      if (res?.success) {
        successCount += 1;
        if (!row.onTransferList) {
          row.onTransferList = true;
          currentTransferCount += 1;
        }
        buyNowSpan.textContent = Number(res.buyNow)?.toLocaleString?.() ?? "—";
        minSpan.textContent = Number(res.minPrice)?.toLocaleString?.() ?? "—";
        statusSpan.textContent = "Listed";
        statusSpan.style.color = "#07f468";
        updateQueueHistoryEntry("quick-list", historyId, {
          columns: [
            name,
            buyNowSpan.textContent || "—",
            minSpan.textContent || "—",
            "Listed",
          ],
          statusColor: "#07f468",
        });
      } else {
        const failedStatus =
          res?.reason === "notTradable"
            ? "Not tradable"
            : res?.reason === "priceDecreased"
              ? "Price dropped (skipped)"
              : res?.reason === "noPrice"
                ? "No price"
                : "Failed";
        statusSpan.textContent = failedStatus;
        statusSpan.style.color = "#f40727";
        updateQueueHistoryEntry("quick-list", historyId, {
          columns: [
            name,
            buyNowSpan.textContent || "—",
            minSpan.textContent || "—",
            failedStatus,
          ],
          statusColor: "#f40727",
        });
      }

      try {
        getControllerInstance()?.applyDataChange?.();
      } catch {}

      if (idx < rows.length - 1) {
        const delay = randomDelay();
        const shouldContinue = await runCancellableDelay(
          "quick-list",
          delay,
          timerFooter,
          "Next listing in",
        );
        if (!shouldContinue) {
          for (let stopIdx = idx + 1; stopIdx < rows.length; stopIdx += 1) {
            setQuickListRowStopped(rows[stopIdx]);
          }
          return {
            success: false,
            reason: "stopped",
            listed: successCount,
            total: rows.length,
          };
        }
      } else {
        timerFooter.textContent = "";
      }
    }

    if (!isQueueStopRequested("quick-list")) {
      notify(
        `Quick list complete: ${successCount}/${rows.length} listed`,
        successCount === rows.length
          ? UINotificationType.POSITIVE
          : UINotificationType.NEGATIVE,
      );
    }

    return { success: true, listed: successCount, total: rows.length };
  };

  if (!window.__sbcQueueRunners) {
    window.__sbcQueueRunners = {};
  }
  if (!window.__sbcQueueRunners.quickList) {
    window.__sbcQueueRunners.quickList = Promise.resolve();
  }

  const chained = window.__sbcQueueRunners.quickList.then(runBatch, runBatch);
  window.__sbcQueueRunners.quickList = chained.catch(() => {});

  try {
    return await chained;
  } catch (error) {
    console.error("quickListItems error", error);
    notify("Quick list encountered an error", UINotificationType.NEGATIVE);
    return { success: false, reason: "error", error };
  } finally {
    releaseQueuedItems("quick-list", uniqueQueuedItems);
    unregisterStopHandler();
    window.__sbcQueueRuntime["quick-list"].pendingBatches = Math.max(
      0,
      window.__sbcQueueRuntime["quick-list"].pendingBatches - 1,
    );
    if (window.__sbcQueueRuntime["quick-list"].pendingBatches === 0) {
      const panel = window.__sbcQueueStatusPanels?.get("quick-list");
      if (panel?.footer) {
        panel.footer.textContent = isQueueStopRequested("quick-list")
          ? "Stopped"
          : "";
      }
      window.__sbcQueueRuntime["quick-list"].stopRequested = false;
      scheduleQueueCloseCountdown("quick-list", panel, 3);
    }
  }
};

const parseValidPrice = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getKnownItemPrice = (item) => {
  if (!item) return null;

  const directPrice = parseValidPrice(item?.getPrice?.());
  if (directPrice !== null) return directPrice;

  try {
    if (typeof getPrice === "function") {
      const cached = parseValidPrice(getPrice(item));
      if (cached !== null) return cached;
    }
  } catch {}

  try {
    if (typeof getPriceItems === "function") {
      const priceRecord = getPriceItems()?.[item?.definitionId];
      const mapPrice = parseValidPrice(priceRecord?.price);
      if (mapPrice !== null) return mapPrice;
    }
  } catch {}

  return null;
};

const formatPriceCell = (value, fallback = "—") => {
  const parsed = parseValidPrice(value);
  return parsed === null ? fallback : parsed.toLocaleString();
};

const formatRefreshItemName = (item) => {
  if (!item) return "Unknown item";

  try {
    if (typeof formatPlayerName === "function") {
      const formatted = formatPlayerName(item);
      if (formatted && formatted !== "undefined") {
        return formatted;
      }
    }
  } catch {}

  return (
    item?._staticData?.name ||
    item?._staticData?.lastName ||
    item?.name ||
    item?.assetId ||
    item?.definitionId ||
    "Unknown item"
  );
};

const refreshLivePrice = async (item, { showUi = true, onCandidate } = {}) => {
  if (!item) {
    if (showUi) {
      showNotification("No item to refresh", UINotificationType.NEGATIVE);
    }
    return { success: false, reason: "noItem", oldPrice: null, newPrice: null };
  }

  if (showUi) {
    return refreshItemsLivePrices([item]);
  }

  const canFetchLive = typeof fetchLivePlayerPrice === "function";
  const canFetchBatch = typeof fetchPlayerPrices === "function";

  if (!canFetchLive && !canFetchBatch) {
    return {
      success: false,
      reason: "noFunction",
      oldPrice: getKnownItemPrice(item),
      newPrice: null,
    };
  }

  const oldPrice = getKnownItemPrice(item);
  let listing = null;

  if (canFetchLive) {
    listing = await fetchLivePlayerPrice(item, {
      suppressNotification: true,
      onCandidate,
    });
  }

  if (!listing && canFetchBatch) {
    await fetchPlayerPrices([item]);
  }

  const listingPrice = parseValidPrice(listing?._auction?.buyNowPrice);
  const newPrice = listingPrice ?? getKnownItemPrice(item);

  return {
    success: newPrice !== null,
    reason: newPrice === null ? "noPrice" : null,
    oldPrice,
    newPrice,
  };
};

const refreshItemsLivePrices = async (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    showNotification("No items to refresh", UINotificationType.NEGATIVE);
    return { success: false, reason: "noItems" };
  }

  const {
    queuedItems: uniqueQueuedItems,
    skippedCount: skippedAlreadyQueuedCount,
  } = reserveQueuedItems("refresh-prices", items);

  if (!uniqueQueuedItems.length) {
    showNotification(
      "Selected items are already queued for price refresh",
      UINotificationType.NEUTRAL,
    );
    return {
      success: false,
      reason: "alreadyQueued",
      skipped: skippedAlreadyQueuedCount,
    };
  }

  if (skippedAlreadyQueuedCount > 0) {
    showNotification(
      `Skipped ${skippedAlreadyQueuedCount} already queued refresh item(s)`,
      UINotificationType.NEUTRAL,
    );
  }

  const {
    content: statusContent,
    footer: timerFooter,
    rowsRoot,
  } = createOrGetQueueStatusPanel({
    panelKey: "refresh-prices",
    title: "Refresh Item Prices",
    headers: ["Item", "Old Price", "New Price", "Status"],
  });

  window.__sbcQueueRuntime["refresh-prices"].stopRequested = false;
  window.__sbcQueueRuntime["refresh-prices"].pendingBatches += 1;
  cancelQueueCloseCountdown("refresh-prices");

  const rows = uniqueQueuedItems.map((item) => {
    const name = formatRefreshItemName(item);
    const initialOldPrice = getKnownItemPrice(item);
    const initialOldPriceText = formatPriceCell(initialOldPrice);

    const {
      row,
      col2Span: oldPriceSpan,
      col3Span: newPriceSpan,
      statusSpan,
    } = createHistoryRow({
      columns: [name, initialOldPriceText, "—", "Queued"],
    });

    rowsRoot.appendChild(row);

    const historyId = appendQueueHistoryEntry("refresh-prices", {
      type: "row",
      columns: [name, initialOldPriceText, "—", "Queued"],
      statusColor: "",
    });

    return {
      item,
      oldPriceSpan,
      newPriceSpan,
      statusSpan,
      historyId,
      name,
      initialOldPrice,
    };
  });

  const stopRows = () => {
    rows.forEach(setRefreshRowStopped);
    timerFooter.textContent = "Stopped";
  };

  const unregisterStopHandler = registerQueueStopHandler(
    "refresh-prices",
    stopRows,
  );

  statusContent.scrollTop = statusContent.scrollHeight;

  let refreshedCount = 0;
  let failedCount = 0;

  const configuredRefreshBatchSize = Number(
    getSettings(0, 0, "futggPriceBatchSize"),
  );
  const refreshBatchSize =
    Number.isFinite(configuredRefreshBatchSize) && configuredRefreshBatchSize > 0
      ? Math.min(50, Math.max(1, Math.floor(configuredRefreshBatchSize)))
      : 30;

  const runBatch = async () => {
    if (isQueueStopRequested("refresh-prices")) {
      stopRows();
      return {
        success: false,
        reason: "stopped",
        refreshed: refreshedCount,
        failed: failedCount,
        total: rows.length,
      };
    }

    appendQueueBatchDividerWithHistory(
      "refresh-prices",
      rowsRoot,
      `Refresh Batch • ${new Date().toLocaleTimeString()}`,
    );

    for (let idx = 0; idx < rows.length; idx += refreshBatchSize) {
      const batchRows = rows.slice(idx, idx + refreshBatchSize);

      if (isQueueStopRequested("refresh-prices")) {
        for (let stopIdx = idx; stopIdx < rows.length; stopIdx += 1) {
          setRefreshRowStopped(rows[stopIdx]);
        }
        timerFooter.textContent = "Stopped";
        return {
          success: false,
          reason: "stopped",
          refreshed: refreshedCount,
          failed: failedCount,
          total: rows.length,
        };
      }

      batchRows.forEach(
        ({ oldPriceSpan, newPriceSpan, statusSpan, historyId, name }, batchIdx) => {
          statusSpan.textContent = "Searching...";
          statusSpan.style.color = "";
          newPriceSpan.textContent = "Searching...";
          updateQueueHistoryEntry("refresh-prices", historyId, {
            columns: [
              name,
              oldPriceSpan.textContent || "—",
              "Searching...",
              `Searching... (${idx + batchIdx + 1}/${rows.length})`,
            ],
            statusColor: "",
          });
        },
      );

      timerFooter.textContent = `Refreshing ${Math.min(
        idx + batchRows.length,
        rows.length,
      )}/${rows.length}`;

      try {
        // Always hit the live transfer market search per item (falls back to
        // the fut.gg batch index only when no live listing is found) so
        // "Refresh Price" never just re-serves a stale cached value.
        await Promise.all(
          batchRows.map(({ item }) =>
            refreshLivePrice(item, { showUi: false }).catch((err) => {
              console.warn("[sbc] refreshLivePrice failed", item?.id, err);
              return null;
            }),
          ),
        );

        batchRows.forEach(
          ({
            item,
            oldPriceSpan,
            newPriceSpan,
            statusSpan,
            historyId,
            name,
            initialOldPrice,
          }) => {
            const oldPrice = parseValidPrice(initialOldPrice);
            const newPrice = getKnownItemPrice(item);

            oldPriceSpan.textContent = formatPriceCell(oldPrice);

            if (newPrice !== null) {
              newPriceSpan.textContent = formatPriceCell(newPrice);
              if (oldPrice !== null && newPrice !== oldPrice) {
                const diff = newPrice - oldPrice;
                const priceDiff = document.createElement("span");
                priceDiff.textContent =
                  diff > 0
                    ? `(+${diff.toLocaleString()})`
                    : `(${diff.toLocaleString()})`;
                priceDiff.style.fontSize = "0.85em";
                priceDiff.style.opacity = "0.8";
                newPriceSpan.appendChild(document.createElement("br"));
                newPriceSpan.appendChild(priceDiff);
              }

              statusSpan.textContent = "Updated";
              statusSpan.style.color = "#07f468";
              updateQueueHistoryEntry("refresh-prices", historyId, {
                columns: [
                  name,
                  oldPriceSpan.textContent || "—",
                  newPriceSpan.textContent || "—",
                  "Updated",
                ],
                statusColor: "#07f468",
              });
              refreshedCount += 1;
            } else {
              newPriceSpan.textContent = "—";
              statusSpan.textContent = "No price";
              statusSpan.style.color = "#f40727";
              updateQueueHistoryEntry("refresh-prices", historyId, {
                columns: [name, oldPriceSpan.textContent || "—", "—", "No price"],
                statusColor: "#f40727",
              });
              failedCount += 1;
            }
          },
        );
      } catch (err) {
        console.warn("[sbc] Error refreshing price batch", err);
        batchRows.forEach(({ oldPriceSpan, newPriceSpan, statusSpan, historyId, name, item }) => {
          newPriceSpan.textContent = "—";
          statusSpan.textContent = "Error";
          statusSpan.style.color = "#f40727";
          updateQueueHistoryEntry("refresh-prices", historyId, {
            columns: [name, oldPriceSpan.textContent || "—", "—", "Error"],
            statusColor: "#f40727",
          });
          console.warn("[sbc] Error updating price for item", item?.id, err);
          failedCount += 1;
        });
      }

      statusContent.scrollTop = statusContent.scrollHeight;

      try {
        getControllerInstance()?.applyDataChange?.();
      } catch {}

      if (idx + refreshBatchSize < rows.length) {
        const shouldContinue = await runCancellableDelay(
          "refresh-prices",
          60,
          timerFooter,
          "Next refresh in",
        );
        if (!shouldContinue) {
          for (
            let stopIdx = idx + refreshBatchSize;
            stopIdx < rows.length;
            stopIdx += 1
          ) {
            setRefreshRowStopped(rows[stopIdx]);
          }
          return {
            success: false,
            reason: "stopped",
            refreshed: refreshedCount,
            failed: failedCount,
            total: rows.length,
          };
        }
      }
    }

    timerFooter.textContent = "";

    if (!isQueueStopRequested("refresh-prices")) {
      showNotification(
        `Refreshed prices: ${refreshedCount}/${rows.length} updated`,
        refreshedCount === rows.length
          ? UINotificationType.POSITIVE
          : UINotificationType.NEGATIVE,
      );
    }

    return {
      success: true,
      refreshed: refreshedCount,
      failed: failedCount,
      total: rows.length,
    };
  };

  if (!window.__sbcQueueRunners) {
    window.__sbcQueueRunners = {};
  }
  if (!window.__sbcQueueRunners.refreshPrices) {
    window.__sbcQueueRunners.refreshPrices = Promise.resolve();
  }

  const chained = window.__sbcQueueRunners.refreshPrices.then(
    runBatch,
    runBatch,
  );
  window.__sbcQueueRunners.refreshPrices = chained.catch(() => {});

  try {
    return await chained;
  } catch (error) {
    console.error("refreshItemsLivePrices error", error);
    showNotification(
      "Price refresh encountered an error",
      UINotificationType.NEGATIVE,
    );
    return { success: false, reason: "error", error };
  } finally {
    releaseQueuedItems("refresh-prices", uniqueQueuedItems);
    unregisterStopHandler();
    window.__sbcQueueRuntime["refresh-prices"].pendingBatches = Math.max(
      0,
      window.__sbcQueueRuntime["refresh-prices"].pendingBatches - 1,
    );
    if (window.__sbcQueueRuntime["refresh-prices"].pendingBatches === 0) {
      const panel = window.__sbcQueueStatusPanels?.get("refresh-prices");
      if (panel?.footer) {
        panel.footer.textContent = isQueueStopRequested("refresh-prices")
          ? "Stopped"
          : "";
      }
      window.__sbcQueueRuntime["refresh-prices"].stopRequested = false;
      scheduleQueueCloseCountdown("refresh-prices", panel, 3);
    }
  }
};

window.quickListItems = quickListItems;
window.refreshItemsLivePrices = refreshItemsLivePrices;
window.refreshLivePrice = refreshLivePrice;
