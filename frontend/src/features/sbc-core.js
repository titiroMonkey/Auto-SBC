let apiUrl = "http://127.0.0.1:8000";
let sbcLogin = Array.isArray(window.sbcLogin) ? window.sbcLogin : [];
window.sbcLogin = sbcLogin;

let LOCKED_ITEMS_KEY = "excludePlayers";
let cachedLockedItems;
let isItemLocked = function (item) {
  let lockedItems = getLockedItems();
  return lockedItems.includes(item.definitionId);
};
let lockItem = function (item) {
  let lockedItems = getLockedItems();
  lockedItems.push(item.definitionId);
  saveLockedItems();
};
let unlockItem = function (item) {
  let lockedItems = getLockedItems();

  if (lockedItems.includes(item.definitionId)) {
    const index = lockedItems.indexOf(item.definitionId);
    if (index > -1) {
      lockedItems.splice(index, 1);
    }
  }
  saveLockedItems();
};
let getLockedItems = function () {
  return getSettings(0, 0, "excludePlayers");
};
let lockedItemsCleanup = function (clubPlayerIds) {
  let lockedItems = getLockedItems();
  for (let _i = 0, _a = Array.from(lockedItems); _i < _a.length; _i++) {
    let lockedItem = _a[_i];
    if (!clubPlayerIds[lockedItem]) {
      const index = lockedItems.indexOf(lockedItem);
      if (index > -1) {
        lockedItems.splice(index, 1);
      }
    }
  }
  saveLockedItems();
};
let saveLockedItems = function () {
  saveSettings("global", "global", LOCKED_ITEMS_KEY, getLockedItems());
};

let FIXED_ITEMS_KEY = "fixeditems";
let cachedFixedItems;
let isItemFixed = function (item) {
  let fixedItems = getFixedItems();
  return fixedItems.includes(item.id);
};
let fixItem = function (item) {
  let fixedItems = getFixedItems();
  fixedItems.push(item.id);
  saveFixedItems();
};
let unfixItem = function (item) {
  let fixedItems = getFixedItems();

  if (fixedItems.includes(item.id)) {
    const index = fixedItems.indexOf(item.id);
    if (index > -1) {
      fixedItems.splice(index, 1);
    }
  }
  saveFixedItems();
};
let getFixedItems = function () {
  if (cachedFixedItems) {
    return cachedFixedItems;
  }
  cachedFixedItems = [];
  let fixedItems = localStorage.getItem(FIXED_ITEMS_KEY);
  if (fixedItems) {
    cachedFixedItems = JSON.parse(fixedItems);
  }
  return cachedFixedItems;
};
let fixedItemsCleanup = function (clubPlayerIds) {
  let fixedItems = getFixedItems();
  for (let _i = 0, _a = Array.from(fixedItems); _i < _a.length; _i++) {
    let fixedItem = _a[_i];
    if (!clubPlayerIds[fixedItem]) {
      const index = fixedItems.indexOf(fixedItem);
      if (index > -1) {
        fixedItems.splice(index, 1);
      }
    }
  }
  saveFixedItems();
};
let saveFixedItems = function () {
  localStorage.setItem(FIXED_ITEMS_KEY, JSON.stringify(cachedFixedItems));
};

const idToPlayerItem = {};

// Add SBC and challenge information to the loader

const showNotification = function (
  message,
  type = UINotificationType.POSITIVE,
) {
  services.Notification.queue([message, type]);
};
const getCurrentViewController = () => {
  return getAppMain()
    .getRootViewController()
    .getPresentedViewController()
    .getCurrentViewController();
};
const getControllerInstance = () => {
  return getCurrentViewController().getCurrentController()
    .childViewControllers[0];
};

let sbcSets = async function () {
  return new Promise((resolve, reject) => {
    services.SBC.requestSets().observe(this, function (obs, res) {
      if (!res.success) {
        obs.unobserve(this);
        reject(res.status);
      } else {
        resolve(res.data);
      }
    });
  }).catch((e) => {
    console.log(e);
  });
};

let getChallenges = async function (set) {
  return new Promise((resolve, reject) => {
    services.SBC.requestChallengesForSet(set).observe(
      this,
      async function (obs, res) {
        if (!res.success) {
          obs.unobserve(this);
          reject(res.status);
        } else {
          resolve(res.data);
        }
      },
    );
  }).catch((e) => {
    console.log(e);
  });
};

// User-created squads (Squad Management hub) — NOT SBC challenge squads.
// Each squad exposes getId()/getName()/getPlayers(), where each player slot's
// _item.id is 0 for empty slots and the real item id otherwise.
let getUserSquads = async function () {
  return new Promise((resolve, reject) => {
    services.Squad.requestSquadList().observe(this, function (obs, res) {
      obs.unobserve(this);
      if (!res.success) {
        reject(res.status);
      } else {
        resolve(res.data?.squads || []);
      }
    });
  }).catch((e) => {
    console.log(e);
    return [];
  });
};

let loadChallenge = async function (currentChallenge, count = 0) {
  if (currentChallenge.status == "COMPLETED") {
    return;
  }
  if (currentChallenge.status == "IN_PROGRESS" && currentChallenge.squad) {
    return;
  }
  console.log("Loading Challenge", currentChallenge, count);
  return new Promise((resolve, reject) => {
    services.SBC.loadChallenge(currentChallenge).observe(
      this,
      async function (obs, res) {
        if (!res.success) {
          obs.unobserve(this);
          await wait(1000);
          console.log("Loading Challenge again", currentChallenge.id, count);
          await loadChallenge(currentChallenge, count + 1);
          reject(res.status);
        } else {
          resolve(res.data);
        }
      },
    );
  });
};

let fetchSBCData = async (sbcId, challengeId = 0) => {
  //Get SBC Data if given a setId

  let sbcData = await sbcSets();
  if (sbcData === undefined) {
    console.log("SBC DATA is not available");
    createSBCTab();
    return null;
  }

  let sbcSet = sbcData.sets.filter((e) => e.id == sbcId);

  if (sbcSet.length == 0) {
    createSBCTab();
    return null;
  }

  let challenges = await getChallenges(sbcSet[0]);
  let awards = [];

  let uncompletedChallenges = challenges?.challenges.filter(
    (f) => f.status != "COMPLETED",
  );
  if (uncompletedChallenges.length == 0) {
    showNotification("SBC not available", UINotificationType.NEGATIVE);
    createSBCTab();
    return null;
  }
  if (uncompletedChallenges.length == 1) {
    awards = sbcSet[0].awards
      .filter((f) => f.isPack || f.isItem)
      .map((m) => m.value);
  }

  if (challengeId == 0) {
    //Get last/hardest SBC if no challenge given

    challengeId = uncompletedChallenges[uncompletedChallenges.length - 1].id;
  }
  console.log("SBCData");
  await loadChallenge(
    challenges.challenges.filter((i) => i.id == challengeId)[0],
  );

  let newSbcSquad = new UTSBCSquadOverviewViewController();
  ((newSbcSquad._set = sbcSet[0]),
    (newSbcSquad._challenge = challenges.challenges.filter(
      (i) => i.id == challengeId,
    )[0]));
  newSbcSquad.initWithSquad(
    challenges.challenges.filter((i) => i.id == challengeId)[0].squad,
  );
  let { _challenge } = newSbcSquad;

  let totwIdx = -1;
  const challengeRequirements = _challenge.eligibilityRequirements.map(
    (eligibility, idx) => {
      let keys = Object.keys(eligibility.kvPairs._collection);
      if (
        SBCEligibilityKey[keys[0]] == "PLAYER_RARITY_GROUP" &&
        eligibility.kvPairs._collection[keys[0]][0] == 23
      ) {
        totwIdx = idx;
      }
      return {
        scope: SBCEligibilityScope[eligibility.scope],
        count: eligibility.count,
        requirementKey: SBCEligibilityKey[keys[0]],
        eligibilityValues: eligibility.kvPairs._collection[keys[0]],
      };
    },
  );
  if (getSettings(0, 0, "lockMinOnePlayerRequirements")) {
    challengeRequirements.forEach((requirement) => {
      if (
        requirement?.scope === "GREATER" &&
        requirement?.requirementKey === "PLAYER_RARITY_GROUP"
      ) {
        requirement.scope = "EXACT";
      }
    });
  }
  if (getSettings(0, 0, "saveTotw")) {
    if (totwIdx >= 0) {
      challengeRequirements[totwIdx].scope = "EXACT";
    } else {
      challengeRequirements.push({
        scope: "EXACT",
        count: 0,
        requirementKey: "PLAYER_RARITY_GROUP",
        eligibilityValues: [23],
      });
    }
  }

  const sbcName = sbcSet[0].name;
  const challengeName = _challenge.name;
  
  // Set context for name-based settings lookups
  if (typeof setCurrentSbcContext === "function") {
    setCurrentSbcContext(sbcName, challengeName);
  }

  // Add SBC and challenge names to the loader display
  return {
    constraints: challengeRequirements,
    formation: _challenge.squad._formation.generalPositions.map((m, i) =>
      _challenge.squad.simpleBrickIndices.includes(i) ? -1 : m,
    ),
    challengeId: _challenge.id,
    setId: _challenge.setId,
    brickIndices: _challenge.squad.simpleBrickIndices,
    finalSBC: uncompletedChallenges.length == 1,
    currentSolution: _challenge.squad._players
      .map((m) => m._item._metaData?.id)
      .slice(0, 11),
    subs: _challenge.squad._players
      .map((m) => m._item.definitionId)
      .slice(11, 99)
      .filter((f) => f > 0),
    awards: _challenge.awards
      .filter((f) => f.type == "pack")
      .map((m) => m.value)
      .concat(awards),
    setAward: sbcSet[0].awards,
    sbcName: sbcName,
    challengeName: challengeName,
  };
};

const ratingCountUI = async () => {
  // Ensure the close (×) button disables the feature via settings and fully removes the UI
  // (no localStorage hiding flags; only the settings toggle controls visibility).
  if (!window.__ratingCountUICloseHookInstalled) {
    window.__ratingCountUICloseHookInstalled = true;

    document.addEventListener(
      "click",
      (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;

        // Match the "×" close button inside the rating UI
        const container = target.closest?.("#rating-count-ui");
        if (!container) return;

        const isCloseButton =
          target.tagName === "BUTTON" && target.textContent?.trim() === "×";
        if (!isCloseButton) return;

        // Block the old handler (which wrote to localStorage) and enforce settings-based disable
        e.preventDefault();
        e.stopImmediatePropagation();

        try {
          saveSettings(0, 0, "ratingUI", false);
        } catch (err) {
          console.warn("Failed to persist ratingUI=false", err);
        }

        // Disconnect resize observer if present
        try {
          if (container._resizeObserver) {
            container._resizeObserver.disconnect();
            delete container._resizeObserver;
          }
          delete container.dataset.resizeObserved;
        } catch {}

        container.remove();
      },
      true, // capture so we can stop the old handler
    );
  }

  // If disabled in settings, ensure the element is removed and exit
  if (!getSettings(0, 0, "ratingUI")) {
    const existing = document.getElementById("rating-count-ui");
    if (existing) {
      try {
        if (existing._resizeObserver) {
          existing._resizeObserver.disconnect();
          delete existing._resizeObserver;
        }
        delete existing.dataset.resizeObserved;
      } catch {}
      existing.remove();
    }
    return;
  }

  const clubPlayersAll = await fetchPlayers();
  const storagePlayers = await getStoragePlayers();
  const clubPlayers = clubPlayersAll.filter((item) => item.loans < 0);

  const computeMaxRating = (arr) =>
    arr.reduce((max, player) => {
      const rating = Number(player?.rating);
      return Number.isFinite(rating) ? Math.max(max, rating) : max;
    }, 0);

  const overallMaxRating = Math.max(
    computeMaxRating(clubPlayers),
    computeMaxRating(storagePlayers),
  );

  const countByRating = (arr, maxRating) => {
    const bins = { "<65": 0, "<75": 0, "<83": 0 };
    const upper = Number.isFinite(maxRating) ? Math.floor(maxRating) : 0;

    if (upper >= 83) {
      for (let r = 83; r <= upper; r += 1) {
        bins[r] = 0;
      }
    }

    let total = 0;
    arr.forEach((p) => {
      const rating = Number(p?.rating);
      if (!Number.isFinite(rating)) {
        return;
      }
      if (rating < 65) bins["<65"] += 1;
      else if (rating < 75) bins["<75"] += 1;
      else if (rating < 83) bins["<83"] += 1;
      else if (upper >= 83 && rating <= upper) bins[rating] += 1;
      total += 1;
    });

    bins.total = total;
    return bins;
  };

  const getRequiredRarityGroupFromChallenge = () => {
    const challenge = getControllerInstance?.()?._challenge;
    const requirements = challenge?.eligibilityRequirements;
    if (!Array.isArray(requirements)) {
      return null;
    }

    for (const requirement of requirements) {
      const collection = requirement?.kvPairs?._collection;
      const keys = Object.keys(collection || {});
      if (!keys.length) {
        continue;
      }

      const rawKey = keys[0];
      if (SBCEligibilityKey?.[rawKey] !== "PLAYER_RARITY_GROUP") {
        continue;
      }

       const scope = SBCEligibilityScope?.[requirement?.scope];
       const count = Number(requirement?.count);
       if (scope !== "EXACT" || count !== 1) {
         continue;
       }

      const rawValues = collection[rawKey];
      const firstValue = Array.isArray(rawValues) ? Number(rawValues[0]) : NaN;
      if (Number.isFinite(firstValue) && firstValue > 0) {
        return firstValue;
      }
    }

    return null;
  };

  const clubCounts = countByRating(clubPlayers, overallMaxRating);
  const storageCounts = countByRating(storagePlayers, overallMaxRating);

  const allRatings = Array.from(
    new Set([...Object.keys(clubCounts), ...Object.keys(storageCounts)]),
  )
    .filter((key) => key !== "total")
    .sort((a, b) => {
      const parseKey = (x) => {
        if (typeof x === "string" && x.startsWith("<")) {
          return parseInt(x.substring(1), 10);
        }
        return Number(x);
      };
      return parseKey(b) - parseKey(a);
    });
  allRatings.push("total");

  if (!document.getElementById("rating-count-anim-style")) {
    const style = document.createElement("style");
    style.id = "rating-count-anim-style";
    style.textContent = `
      .delta-plus   { animation: plusAnim   3s forwards; }
      .delta-minus  { animation: minusAnim  3s forwards; }
      @keyframes plusAnim  { from { background: #4caf50; } to { background: transparent; } }
      @keyframes minusAnim { from { background: #f44336; } to { background: transparent; } }
    `;
    document.head.appendChild(style);
  }

  const ensureDragHandlers = (container, handle) => {
    if (container.dataset.dragInitialized === "true") {
      return;
    }
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;
    let currentLeft = 0;
    let currentTop = 0;

    const clampPosition = (left, top) => {
      const maxLeft = Math.max(0, window.innerWidth - container.offsetWidth);
      const maxTop = Math.max(0, window.innerHeight - container.offsetHeight);
      return {
        left: Math.min(Math.max(0, left), maxLeft),
        top: Math.min(Math.max(0, top), maxTop),
      };
    };

    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      isDragging = true;
      const rect = container.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      container.style.right = "auto";
      container.style.bottom = "auto";
      container.style.cursor = "grabbing";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      e.preventDefault();
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const { left, top } = clampPosition(
        e.clientX - offsetX,
        e.clientY - offsetY,
      );
      currentLeft = left;
      currentTop = top;
      container.style.left = `${left}px`;
      container.style.top = `${top}px`;
    };

    const onMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      container.style.cursor = "default";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      localStorage.setItem(
        "ratingCountUIPosition",
        JSON.stringify({ left: currentLeft, top: currentTop }),
      );
    };

    handle.addEventListener("mousedown", onMouseDown);
    container.dataset.dragInitialized = "true";
  };

  const applySavedPosition = (container) => {
    const saved = localStorage.getItem("ratingCountUIPosition");
    if (!saved) return;
    try {
      const pos = JSON.parse(saved);
      if (
        typeof pos.left === "number" &&
        typeof pos.top === "number" &&
        Number.isFinite(pos.left) &&
        Number.isFinite(pos.top)
      ) {
        container.style.left = `${Math.max(0, pos.left)}px`;
        container.style.top = `${Math.max(0, pos.top)}px`;
        container.style.right = "auto";
        container.style.bottom = "auto";
      }
    } catch (err) {
      console.warn("Failed to apply saved rating count position", err);
    }
  };

  const applySavedSize = (container) => {
    const savedWidth = localStorage.getItem("ratingCountUIWidth");
    if (!savedWidth) {
      return;
    }
    const width = parseInt(savedWidth, 10);
    if (!Number.isFinite(width) || width <= 0) {
      return;
    }
    const maxAllowed = Math.floor(window.innerWidth * 0.8);
    const constrained = Math.min(Math.max(width, 320), maxAllowed);
    container.style.width = `${constrained}px`;
  };

  const saveCurrentSize = (container) => {
    if (!container) return;
    const width = Math.round(container.getBoundingClientRect().width);
    if (!Number.isFinite(width) || width <= 0) return;
    localStorage.setItem("ratingCountUIWidth", width.toString());
  };

  const ensureResizeObserver = (container) => {
    if (
      container.dataset.resizeObserved === "true" ||
      typeof ResizeObserver !== "function"
    ) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const width = entry?.contentRect?.width;
        if (Number.isFinite(width)) {
          localStorage.setItem(
            "ratingCountUIWidth",
            Math.round(width).toString(),
          );
        }
      });
    });
    observer.observe(container);
    container.dataset.resizeObserved = "true";
    container._resizeObserver = observer;
  };

  // Fallback + explicit persistence on interaction end (helps when ResizeObserver
  // isn't available or doesn't fire for CSS resize in some environments)
  const ensureResizePersistenceHandlers = (container) => {
    if (container.dataset.resizePersistenceHandlers === "true") {
      return;
    }

    let rafId = null;
    const flush = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => saveCurrentSize(container));
    };

    container.addEventListener("mouseup", flush);
    container.addEventListener("pointerup", flush);
    container.addEventListener("touchend", flush, { passive: true });
    window.addEventListener("mouseup", flush);
    window.addEventListener("pointerup", flush);
    window.addEventListener("touchend", flush, { passive: true });

    container.dataset.resizePersistenceHandlers = "true";
  };

  let container = document.getElementById("rating-count-ui");
  if (!container) {
    container = document.createElement("div");
    container.id = "rating-count-ui";
    container.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 6.5rem;
      min-width: 320px;
      max-width: 80vw;
      background: rgba(0,0,0,0.8);
      color: #fff;
      font-size: 12px;
      padding: 8px;
      z-index: 9999;
      white-space: nowrap;
      border-radius: 4px;
      box-shadow: 0 0 10px rgba(0,0,0,0.4);
      resize: horizontal;
      overflow: hidden;
    `;
    container.style.overflowX = "auto";

    const headerBar = document.createElement("div");
    headerBar.className = "rating-count-header";
    headerBar.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
      font-weight: bold;
      cursor: move;
      user-select: none;
    `;

    const title = document.createElement("span");
    title.textContent = "Rating Breakdown";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "×";
    closeBtn.style.cssText = `
      background: transparent;
      color: #fff;
      border: none;
      font-size: 16px;
      cursor: pointer;
      width: 24px;
      height: 24px;
      line-height: 24px;
      padding: 0;
    `;
    closeBtn.addEventListener("click", () => {
      localStorage.setItem("ratingCountUIHidden", "true");
      if (container._resizeObserver) {
        container._resizeObserver.disconnect();
        delete container._resizeObserver;
        delete container.dataset.resizeObserved;
      }
      container.remove();
    });

    headerBar.appendChild(title);
    headerBar.appendChild(closeBtn);

    const table = document.createElement("table");
    table.style.cssText =
      "width:100%;border-collapse:collapse;text-align:center";
    const headerHTML = ["Type", ...allRatings]
      .map((x) => `<th>${x}</th>`)
      .join("");
    const clubRowHTML = ["Club", ...allRatings.map((r) => clubCounts[r] ?? 0)]
      .map((x) => `<td>${x}</td>`)
      .join("");
    const storageRowHTML = [
      "Storage",
      ...allRatings.map((r) => storageCounts[r] ?? 0),
    ]
      .map((x) => `<td>${x}</td>`)
      .join("");

    table.innerHTML = `
      <thead><tr>${headerHTML}</tr></thead>
      <tbody>
        <tr>${clubRowHTML}</tr>
        <tr>${storageRowHTML}</tr>
      </tbody>
    `;

    container.appendChild(headerBar);
    container.appendChild(table);

    // Append to document.body so the UI persists across page/controller
    // switches. Attaching it to a specific view (e.g. the navigation
    // container) causes it to be removed whenever EA tears that view down.
    document.body.appendChild(container);

    applySavedSize(container);
    ensureResizeObserver(container);
    ensureResizePersistenceHandlers(container);
    requestAnimationFrame(() => applySavedPosition(container));
    ensureDragHandlers(container, headerBar);
    localStorage.setItem("ratingCountUIHidden", "false");
    return;
  }

  container.style.resize = "horizontal";
  container.style.overflow = "hidden";
  container.style.overflowX = "auto";
  applySavedSize(container);
  ensureResizeObserver(container);
  ensureResizePersistenceHandlers(container);

  const table = container.querySelector("table");
  if (!table || !table.tBodies.length) {
    if (container._resizeObserver) {
      container._resizeObserver.disconnect();
      delete container._resizeObserver;
      delete container.dataset.resizeObserved;
    }
    container.remove();
    localStorage.removeItem("ratingCountUIHidden");
    await ratingCountUI();
    return;
  }

  const headerRowValues = Array.from(table.querySelectorAll("thead th")).map(
    (el) => el.textContent,
  );
  const desiredHeader = ["Type", ...allRatings];
  const headersDiffer =
    headerRowValues.length !== desiredHeader.length ||
    headerRowValues.some((value, idx) => value !== desiredHeader[idx]);

  if (headersDiffer) {
    const clubRowHTML = ["Club", ...allRatings.map((r) => clubCounts[r] ?? 0)]
      .map((x) => `<td>${x}</td>`)
      .join("");
    const storageRowHTML = [
      "Storage",
      ...allRatings.map((r) => storageCounts[r] ?? 0),
    ]
      .map((x) => `<td>${x}</td>`)
      .join("");
    table.innerHTML = `
      <thead><tr>${desiredHeader.map((x) => `<th>${x}</th>`).join("")}</tr></thead>
      <tbody>
        <tr>${clubRowHTML}</tr>
        <tr>${storageRowHTML}</tr>
      </tbody>
    `;
    return;
  }

  const bodyRows = table.tBodies[0].rows;
  if (bodyRows.length < 2) {
    // Row count changed, force full rebuild
    if (container._resizeObserver) {
      container._resizeObserver.disconnect();
      delete container._resizeObserver;
      delete container.dataset.resizeObserved;
    }
    container.remove();
    localStorage.removeItem("ratingCountUIHidden");
    await ratingCountUI();
    return;
  }
  const clubRow = bodyRows[0];
  const storageRow = bodyRows[1];

  allRatings.forEach((r) => {
    const colIndex = headerRowValues.indexOf(r.toString());
    if (colIndex === -1) return;
    const clubCell = clubRow.cells[colIndex];
    const storageCell = storageRow.cells[colIndex];
    if (!clubCell || !storageCell) return;

    const oldClub = parseInt(clubCell.textContent, 10) || 0;
    const newClub = clubCounts[r] ?? 0;
    if (newClub !== oldClub) {
      clubCell.textContent = newClub;
      clubCell.classList.add(newClub > oldClub ? "delta-plus" : "delta-minus");
      setTimeout(
        () => clubCell.classList.remove("delta-plus", "delta-minus"),
        3000,
      );
    }

    const oldStorage = parseInt(storageCell.textContent, 10) || 0;
    const newStorage = storageCounts[r] ?? 0;
    if (newStorage !== oldStorage) {
      storageCell.textContent = newStorage;
      storageCell.classList.add(
        newStorage > oldStorage ? "delta-plus" : "delta-minus",
      );
      setTimeout(
        () => storageCell.classList.remove("delta-plus", "delta-minus"),
        3000,
      );
    }
  });

  const headerHandle =
    container.querySelector(".rating-count-header") || container;
  ensureDragHandlers(container, headerHandle);
};

// Expose the ratings UI updater to the console (const bindings aren't global
// object properties, so assign explicitly for reliable console access).
try {
  globalThis.ratingCountUI = ratingCountUI;
} catch {}
