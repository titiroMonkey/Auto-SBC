const createPackList = async () => {
  let packs = await getPacks();
  let i = services.Localization;
  const visiblePackCount = packs.packs.filter(
    (f) => f.isMyPack || f?.prices?._collection?.COINS?.amount < 101,
  ).length;

  let packContent = `<span>Packs<br>${visiblePackCount}</span>`;
  let packCounts = packs.packs
    .filter((f) => f.isMyPack || f?.prices?._collection?.COINS?.amount < 101)
    .reduce((acc, pack) => {
      let key = `${pack.packName} ${
        pack.tradeable ? "(Tradable)" : "(Untradable)"
      }`;

      acc[key] = acc[key] || {};
      acc[key].count = (acc[key]?.count || 0) + 1;
      acc[key].packName =
        i.localize(pack.packName) +
        (pack?.prices?._collection?.COINS?.amount
          ? ` (${pack.prices._collection.COINS.amount} coins)`
          : "");
      acc[key].class = pack.tradable ? "tradable" : "untradable";
      acc[key].description = i.localize(pack.packDesc);
      acc[key].pack = pack;

      return acc;
    }, {});

  if (Object.keys(packCounts).length > 1) {
    packCounts["Open All Packs"] = {
      count: 0,
      packName: "Open All Packs",
      class: "OpenAll",
      description: "Open all available packs",
      pack: Object.values(packCounts)[0]?.pack || null,
    };
  }
  let packHoverButtons = Object.keys(packCounts).map((packName) => {
    let pack = packCounts[packName];

    let navLabelSpan = document.createElement("span");
    navLabelSpan.title = pack.description;
    navLabelSpan.classList.add(pack.class);
    navLabelSpan.style.direction = "ltr";
    let packCountLabel = document.createElement("div");
    packCountLabel.classList.add("ut-tab-bar-item-notif");
    packCountLabel.style.left = "5px";
    packCountLabel.innerHTML = pack.count;
    navLabelSpan.innerHTML = pack.packName;
    if (pack.count > 1) {
      navLabelSpan.prepend(packCountLabel);
    }

    let btn = createNavButton(
      "openPackItem",
      navLabelSpan.outerHTML,
      async () => {},
      async () => {
        let packToOpen = pack.pack;
        if (pack.pack.isMyPack) {
          await openPack(packToOpen, pack.count, packName === "Open All Packs");
        } else {
          packToOpen
            .purchase(GameCurrency.COINS)
            .observe(new UTStoreViewController(), async () => {
              await openPack(packToOpen);
            });
        }
      },
      { width: "20vw", marginTop: "0px" },
    );

    return btn;
  });

  let packDiv = document.createElement("div");
  packHoverButtons.forEach((button) => {
    packDiv.appendChild(button);
  });
  let packNavBtn = createNavButton(
    "navPacks",
    packContent,
    async () => {
      if (Object.keys(packCounts).length > 0) {
        return createHoverNav(
          "myPacks",
          "My Packs",
          "click to open",
          [packDiv],
          { width: "20vw" },
        );
      }
      return null;
    },
    async () => {
      packToOpen = Object.values(packCounts)[0]?.pack || null;
      if (!packToOpen) {
        await openPack(packToOpen, 0, true);
      }
    },
    { background: "none" },
  );

  return packNavBtn;
};

const sbcToolbarImageUrlCache = new Map();
const sbcToolbarImageInFlight = new Map();

const getCachedSbcToolbarImageSrc = async (src) => {
  if (!src || typeof src !== "string") {
    return src;
  }

  if (sbcToolbarImageUrlCache.has(src)) {
    return sbcToolbarImageUrlCache.get(src);
  }

  if (sbcToolbarImageInFlight.has(src)) {
    return await sbcToolbarImageInFlight.get(src);
  }

  const request = fetch(src, { credentials: "include" })
    .then((response) => {
      if (!response?.ok) {
        throw new Error(`Image fetch failed (${response?.status || "unknown"})`);
      }
      return response.blob();
    })
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob);
      sbcToolbarImageUrlCache.set(src, objectUrl);
      return objectUrl;
    })
    .catch((error) => {
      console.warn("[SBC Toolbar] image cache fetch failed", { src, error });
      sbcToolbarImageUrlCache.set(src, src);
      return src;
    })
    .finally(() => {
      sbcToolbarImageInFlight.delete(src);
    });

  sbcToolbarImageInFlight.set(src, request);
  return await request;
};

const createCategoryPicker = async () => {
  let sets = await sbcSets();
  if (sets === undefined) {
    console.log("createCategoryPicker: sets are undefined");
    return null;
  }
  const incompleteSetIds = (sets.sets || [])
    .filter((s) => !s.isComplete())
    .map((s) => s.id);
  const filteredCategories = (sets.categories || []).filter(
    (cat) =>
      Array.isArray(cat.setIds) &&
      cat.setIds.some((id) => incompleteSetIds.includes(id)),
  );
  let categories = filteredCategories.length
    ? filteredCategories.map((c) => c.name)
    : (sets.categories || []).map((c) => c.name);

  if (!categories.includes("Daily")) {
    let dailySbcs = sets.sets
      .filter((set) => set.name.toLowerCase().includes("daily"))
      .filter((s) => !s.isComplete());

    if (dailySbcs.length > 0) {
      sets.categories.push({
        name: "Daily",
        setIds: dailySbcs.map((sbc) => sbc.id),
      });
      categories.push("Daily");
    }
  }

  if (!categories.includes("Login")) {
    // Use same settings-driven logic as init/fut-home for login SBC selection.
    const loginSetIds = getOrderedLoginSbcSetIds(sets);
    let loginSbcs = sets.sets.filter((set) =>
      loginSetIds.includes(String(set.id)),
    );

    if (loginSbcs.length > 0) {
      sets.categories.push({
        name: "Login",
        setIds: loginSbcs.map((sbc) => sbc.id),
      });
      categories.push("Login");
    }
  }

  let categoryButtons = [];
  categories.forEach((category) => {
    let navLabelSpan = document.createElement("span");
    navLabelSpan.innerHTML = category;
    navLabelSpan.style.display = "inline-block";
    navLabelSpan.style.verticalAlign = "middle";
    navLabelSpan.style.width = "50px";
    let navBtn = createNavButton(
      category,
      navLabelSpan.outerHTML,
      () => {},
      async () => {
        saveSettings("global", "global", "sbcType", category);
        services.Notification.queue([
          "Updating SBC toolbar to " + category,
          UINotificationType.POSITIVE,
        ]);
        createSBCTab();
      },
      { width: "20vw", marginTop: "0px" },
    );
    categoryButtons.push(navBtn);
  });

  let categoryNavBtn = createNavButton(
    "navCategory",
    `SBC 1-click <br>${getSettings(0, 0, "sbcType")}`,
    async () => {
      return createHoverNav(
        "categoryPicker",
        "SBC Categories",
        "click to select",
        categoryButtons,
        { width: "20vw" },
      );
    },
    () => {},
    { background: "none" },
  );
  return categoryNavBtn;
};

const areStringArraysEqual = (left, right) => {
  if (!Array.isArray(left) || !Array.isArray(right)) {
    return false;
  }
  if (left.length !== right.length) {
    return false;
  }
  for (let i = 0; i < left.length; i += 1) {
    if (String(left[i]) !== String(right[i])) {
      return false;
    }
  }
  return true;
};

const getResolvedLoginSbcSetIdsFromSettings = (setsData) => {
  const findLoginFn =
    window?.autoSbcConsoleApi?.findSBCLogin ||
    (typeof findSBCLogin !== "undefined" ? findSBCLogin : undefined);

  const allSets = Array.isArray(setsData?.sets) ? setsData.sets : [];

  if (typeof findLoginFn !== "function" || !allSets.length) {
    return [];
  }

  const solverSettings = getSolverSettings();
  const sbcSettingsLogin = findLoginFn(solverSettings, "sbcOnLogin") || [];

  const setById = new Map(allSets.map((set) => [String(set.id), set]));
  const setByName = new Map(
    allSets.map((set) => [String(set.name || "").toLowerCase(), set]),
  );

  const loginSetIds = sbcSettingsLogin
    .map((entry) => entry?.parents?.[1])
    .map((rawRef) => {
      if (rawRef === undefined || rawRef === null || rawRef === "") {
        return null;
      }

      const refText = String(rawRef).trim();
      if (!refText) {
        return null;
      }

      if (setById.has(refText)) {
        return refText;
      }

      const byName = setByName.get(refText.toLowerCase());
      if (byName?.id !== undefined && byName?.id !== null) {
        return String(byName.id);
      }

      return null;
    })
    .filter((setId) => !!setId);

  return [...new Set(loginSetIds)];
};

const getOrderedLoginSbcSetIds = (setsData) => {
  const allSets = Array.isArray(setsData?.sets) ? setsData.sets : [];
  const setNameById = new Map(
    allSets.map((set) => [String(set?.id), String(set?.name || "").trim()]),
  );
  const setByName = new Map(
    allSets
      .map((set) => [String(set?.name || "").trim().toLowerCase(), set])
      .filter(([name]) => !!name),
  );
  const baseIds = getResolvedLoginSbcSetIdsFromSettings(setsData).filter((id) =>
    setNameById.has(String(id)),
  );
  const baseNames = baseIds
    .map((id) => setNameById.get(String(id)))
    .filter(Boolean);
  const savedOrder = getSettings(0, 0, "loginSbcOrder");
  const savedNames = Array.isArray(savedOrder)
    ? savedOrder
        .map((entry) => {
          const rawValue = String(entry || "").trim();
          if (!rawValue) {
            return null;
          }

          if (setNameById.has(rawValue)) {
            return setNameById.get(rawValue);
          }

          return setByName.get(rawValue.toLowerCase())?.name || null;
        })
        .filter(Boolean)
    : [];

  // If runtime settings are briefly unavailable, keep existing persisted order
  // instead of auto-healing to an empty array.
  if (!baseNames.length) {
    return savedNames
      .map((name) => setByName.get(String(name).toLowerCase())?.id)
      .filter((id) => id !== undefined && id !== null)
      .map((id) => String(id));
  }

  const seen = new Set();
  const ordered = [];

  savedNames.forEach((name) => {
    const nameKey = String(name).toLowerCase();
    if (baseNames.some((baseName) => String(baseName).toLowerCase() === nameKey) && !seen.has(nameKey)) {
      seen.add(nameKey);
      ordered.push(name);
    }
  });

  baseNames.forEach((name) => {
    const nameKey = String(name).toLowerCase();
    if (!seen.has(nameKey)) {
      seen.add(nameKey);
      ordered.push(name);
    }
  });

  if (!areStringArraysEqual(savedNames, ordered)) {
    saveSettings("global", "global", "loginSbcOrder", ordered);
  }

  return ordered
    .map((name) => setByName.get(String(name).toLowerCase())?.id)
    .filter((id) => id !== undefined && id !== null)
    .map((id) => String(id));
};

const persistLoginToolbarOrder = (container) => {
  if (!container) {
    return;
  }

  const orderedNames = Array.from(container.children)
    .map((child) => child?.dataset?.loginSetName)
    .filter((name) => !!name)
    .map((name) => String(name).trim());

  saveSettings("global", "global", "loginSbcOrder", orderedNames);
};

const enableLoginToolbarDragAndDrop = (container) => {
  if (!container || container.dataset.loginDnDEnabled === "true") {
    return;
  }

  const draggableItems = Array.from(container.children).filter(
    (child) => !!child?.dataset?.loginSetId,
  );

  if (draggableItems.length <= 1) {
    return;
  }

  container.dataset.loginDnDEnabled = "true";
  let draggedItem = null;

  draggableItems.forEach((item) => {
    item.draggable = true;
    item.style.cursor = "grab";

    item.addEventListener("dragstart", (event) => {
      draggedItem = item;
      item.style.opacity = "0.6";
      if (event?.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", item.dataset.loginSetId || "");
      }
    });

    item.addEventListener("dragend", () => {
      item.style.opacity = "";
    });
  });

  container.addEventListener("dragover", (event) => {
    if (!draggedItem) {
      return;
    }

    const targetItem = event.target?.closest(".ut-tab-bar-item");
    if (!targetItem || targetItem === draggedItem || targetItem.parentNode !== container) {
      return;
    }

    event.preventDefault();
    const rect = targetItem.getBoundingClientRect();
    const shouldInsertBefore = (event.clientY - rect.top) < rect.height / 2;

    if (shouldInsertBefore) {
      container.insertBefore(draggedItem, targetItem);
    } else {
      container.insertBefore(draggedItem, targetItem.nextSibling);
    }
  });

  container.addEventListener("drop", (event) => {
    if (!draggedItem) {
      return;
    }

    event.preventDefault();
    persistLoginToolbarOrder(container);
    draggedItem = null;
  });
};

const SBC_CHALLENGE_CACHE_TTL_MS = 60 * 1000;
const sbcChallengesCache = new Map();
const sbcChallengesInFlight = new Map();

const getCachedChallengesForSet = async (set) => {
  const setId = Number(set?.id);
  if (!Number.isFinite(setId) || setId <= 0) {
    return await getChallenges(set);
  }

  const now = Date.now();
  const cached = sbcChallengesCache.get(setId);
  if (
    cached &&
    now - Number(cached.timestamp || 0) < SBC_CHALLENGE_CACHE_TTL_MS &&
    cached.data
  ) {
    return cached.data;
  }

  const inFlight = sbcChallengesInFlight.get(setId);
  if (inFlight) {
    return await inFlight;
  }

  const requestPromise = Promise.resolve()
    .then(() => getChallenges(set))
    .then((result) => {
      if (result && Array.isArray(result.challenges)) {
        sbcChallengesCache.set(setId, {
          timestamp: Date.now(),
          data: result,
        });
      }
      return result;
    })
    .finally(() => {
      sbcChallengesInFlight.delete(setId);
    });

  sbcChallengesInFlight.set(setId, requestPromise);
  return await requestPromise;
};

const createSBCButtons = async () => {
  let sets = await sbcSets();
  if (sets === undefined) {
    console.log("createSBCButtons: sets are undefined");
    return null;
  }

  let sbcSetIds;
  const currentSbcType = getSettings(0, 0, "sbcType");
  const isLoginCategory = currentSbcType === "Login";

  if (currentSbcType === "Daily") {
    sbcSetIds = sets.sets
      .filter((set) => set.name.toLowerCase().includes("daily"))
      .map((set) => set.id);
  } else if (isLoginCategory) {
    sbcSetIds = getOrderedLoginSbcSetIds(sets);
  } else {
    sbcSetIds =
      sets.categories.filter((f) => f.name == currentSbcType)[0]?.setIds || [];
  }

  sbcSetIds = (sbcSetIds || []).map((id) => String(id));

  // For Login category include all SBCs (complete + incomplete); others exclude complete
  let allSbcSets = sets.sets.filter(
    (f) =>
      sbcSetIds.includes(String(f.id)) &&
      (isLoginCategory || !f.isComplete()),
  );

  if (isLoginCategory) {
    const orderedIndexBySetId = new Map(
      sbcSetIds.map((id, index) => [String(id), index]),
    );
    allSbcSets = allSbcSets.sort((a, b) => {
      const aIndex = orderedIndexBySetId.get(String(a.id));
      const bIndex = orderedIndexBySetId.get(String(b.id));
      return Number(aIndex) - Number(bIndex);
    });
  } else {
    allSbcSets = allSbcSets.reverse();
  }

  if (currentSbcType === "Favourites") {
    allSbcSets = allSbcSets.sort((a, b) => b.timesCompleted - a.timesCompleted);
  }

  let sbcTiles = [];
  allSbcSets.forEach((set) => {
    const isCompleted = set.isComplete();
    var t = new UTSBCSetTileView();
    (t.init(), (t.title = set.name), t.setData(set), t.render());
    let pb = t._progressBar;
    let sbcDiv = document.createElement("div");
    var img = document.createElement("img");
    const originalSrc = t?._setImage?.src;
    if (originalSrc) {
      img.setAttribute("src", originalSrc);
      Promise.resolve(getCachedSbcToolbarImageSrc(originalSrc)).then(
        (cachedSrc) => {
          if (cachedSrc && img) {
            img.setAttribute("src", cachedSrc);
          }
        },
      );
    }
    img.width = img.height = "64";
    if (isCompleted) {
      img.style.filter = "grayscale(100%)";
      img.style.opacity = "0.5";
    }
    sbcDiv.appendChild(img);
    if (!t.data.isSingleChallenge) {
      sbcDiv.appendChild(pb.getRootElement());
    }
    var label = document.createElement("span");
    label.innerHTML = set.name;
    if (isCompleted) {
      label.style.color = "#888";
    }
    sbcDiv.appendChild(label);

    const sbcTileButton = createNavButton(
        `navSBC${set.id}`,
        sbcDiv.outerHTML,
        async () => {
          let hoverSet = await createSBCHover(set, isLoginCategory);
          let hoverNav = createHoverNav(set.id, "", "click to start", [
            hoverSet,
          ]);
          return hoverNav;
        },
        () => {
          if (isCompleted) return;
          createSbc = true;
          createSBCTab();
          services.Notification.queue([
            set.name + " SBC Started",
            UINotificationType.POSITIVE,
          ]);
          solveSBC(
            set.id,
            0,
            true,
            null,
            true,
            true,
            isLoginCategory ? true : null,
          );
        },
        {
          background: "none",
          ...(isCompleted ? { opacity: "0.5", cursor: "default" } : {}),
        },
      );

    if (isLoginCategory) {
      sbcTileButton.dataset.loginSetId = String(set.id);
      sbcTileButton.dataset.loginSetName = String(set.name || "").trim();
    }

    sbcTiles.push(sbcTileButton);
  });
  return sbcTiles;
};

const createSBCHover = async (set, forceRunInBackground = false) => {
  const CHALLENGE_HOVER_OPEN_DELAY_MS = 260;
  const CHALLENGE_HOVER_CLOSE_DELAY_MS = 180;
  let layoutHubDiv = document.createElement("div");
  layoutHubDiv.style.padding = "0";
  layoutHubDiv.style.width = "50vw";
  layoutHubDiv.style.maxWidth = "500px";
  layoutHubDiv.style.direction = "ltr";
  layoutHubDiv.style.overflowY = "none";
  var s = new UTSBCSetTileView();
  (s.init(), (s.title = set.name), s.setData(set), s.render());
  const hoverImageSrc = s?._setImage?.src;
  if (hoverImageSrc && s?._setImage) {
    Promise.resolve(getCachedSbcToolbarImageSrc(hoverImageSrc)).then(
      (cachedSrc) => {
        if (cachedSrc && s?._setImage) {
          s._setImage.src = cachedSrc;
        }
      },
    );
  }
  layoutHubDiv.appendChild(s.getRootElement());
  layoutHubDiv.querySelectorAll("div").forEach((div) => {
    div.classList.remove("col-1-2-md");
  });
  let progressBlock = layoutHubDiv.querySelector(
    ".ut-sbc-set-tile-view--progress-block",
  );
  if (progressBlock) {
    progressBlock.insertBefore(
      s._progressBar.getRootElement(),
      progressBlock.firstChild,
    );
  }

  let c;
  try {
    c = await getCachedChallengesForSet(set);
  } catch (err) {
    console.warn("[SBC Hover] Failed to fetch challenges", err);
    c = null;
  }

  const safeChallenges = Array.isArray(c?.challenges) ? c.challenges : [];
  if (!safeChallenges.length) {
    const emptyState = document.createElement("div");
    emptyState.style.padding = "10px";
    emptyState.style.color = "#f59e0b";
    emptyState.textContent = "Challenges unavailable right now (rate limited).";
    layoutHubDiv.appendChild(emptyState);
    return layoutHubDiv;
  }

  let row = safeChallenges
    .sort(function (e, t) {
      return e.priority - t.priority;
    })
    .map(function (e) {
      loadChallenge(e);
      i = new UTSBCChallengeTableRowView();
      (i.init(), i.setTitle(e.name), i.render(e));
      let rowRoot = i.getRootElement();
      rowRoot.querySelectorAll("div").forEach((div) => {
        div.classList.remove("has-tap-callback");
        if (div.classList.contains("ut-progress-bar")) {
          div.remove();
        }

        rowRoot.querySelectorAll("img").forEach((img) => {
          img.style.width = "15%";
        });
      });
      let openTimeout = null;
      let hideTimeout = null;
      let challengeDiv = null;

      const removeChallengeNav = () => {
        if (challengeDiv && challengeDiv.parentNode) {
          challengeDiv.remove();
        }
        challengeDiv = null;
      };

      const showChallengeNav = async () => {
        if (challengeDiv && challengeDiv.parentNode) {
          return;
        }

        let existingChallengeNav = document.getElementById("challengeNav");
        if (existingChallengeNav) {
          existingChallengeNav.remove();
        }

        let s = new UTSBCChallengeRequirementsView();
        s.renderChallengeRequirements(e, true);
        challengeDiv = document.createElement("div");
        challengeDiv.id = "challengeNav";
        challengeDiv.style.position = "absolute";

        challengeDiv.style.top = "355px";
        challengeDiv.style.right = "calc(100% + 5px)";
        challengeDiv.style.padding = "5px";
        challengeDiv.style.width = "25vw";
        challengeDiv.style.borderRadius = "20px";
        challengeDiv.style.background = "#1e1f1f";
        challengeDiv.appendChild(s.getRootElement());

        let settingsContainer = document.createElement("div");
        settingsContainer.style.marginTop = "10px";
        settingsContainer.style.padding = "5px";
        settingsContainer.style.maxHeight = "300px";
        settingsContainer.style.overflowY = "auto";

        let settingsTitle = document.createElement("div");
        settingsTitle.style.fontWeight = "bold";
        settingsTitle.style.marginBottom = "5px";
        settingsTitle.style.cursor = "pointer";
        settingsTitle.style.userSelect = "none";
        settingsTitle.style.display = "flex";
        settingsTitle.style.justifyContent = "space-between";
        settingsTitle.style.alignItems = "center";

        let sbcParamsTile = document.createElement("div");
        sbcParamsTile.style.display = "none";
        sbcParamsTile.style.fontSize = "0.85em";

        let toggleArrow = document.createElement("span");
        toggleArrow.textContent = "▶";
        toggleArrow.style.transition = "transform 0.2s";
        settingsTitle.appendChild(
          document.createTextNode("Challenge Settings "),
        );
        settingsTitle.appendChild(toggleArrow);

        settingsTitle.addEventListener("click", () => {
          if (sbcParamsTile.style.display === "none") {
            sbcParamsTile.style.display = "block";
            toggleArrow.style.transform = "rotate(90deg)";
          } else {
            sbcParamsTile.style.display = "none";
            toggleArrow.style.transform = "rotate(0deg)";
          }
        });

        const sbcId = e.setId;
        const challengeId = e.id;
        const populateSbcParamsTileFn =
          window?.autoSbcConsoleApi?.populateSbcParamsTile ||
          (typeof populateSbcParamsTile !== "undefined"
            ? populateSbcParamsTile
            : undefined);

        if (typeof populateSbcParamsTileFn === "function") {
          await populateSbcParamsTileFn(sbcParamsTile, sbcId, challengeId);
        } else {
          console.warn("[SBC Hover] populateSbcParamsTile is unavailable");
        }

        settingsContainer.appendChild(settingsTitle);
        settingsContainer.appendChild(sbcParamsTile);
        challengeDiv.appendChild(settingsContainer);

        if (e.awards && e.awards.length > 0) {
          let rewardsContainer = document.createElement("div");
          rewardsContainer.style.marginTop = "10px";
          rewardsContainer.style.padding = "5px";

          let rewardsTitle = document.createElement("span");
          rewardsTitle.textContent = services.Localization.localize(
            "sbc.rewards.challenge",
          );
          rewardsTitle.style.display = "block";
          rewardsTitle.style.marginBottom = "5px";
          rewardsTitle.style.fontWeight = "bold";
          rewardsContainer.appendChild(rewardsTitle);

          let rewardList = new UTSBCGroupRewardListView();
          rewardList.init();
          rewardList.setRewards(e.awards);
          rewardsContainer.appendChild(rewardList.getRootElement());
          challengeDiv.appendChild(rewardsContainer);
        }

        let goToChallengeBtn = document.createElement("button");
        goToChallengeBtn.textContent = "Go to Challenge";
        goToChallengeBtn.style.width = "100%";
        goToChallengeBtn.style.marginTop = "10px";
        goToChallengeBtn.style.padding = "8px";
        goToChallengeBtn.style.backgroundColor = "#1e90ff";
        goToChallengeBtn.style.color = "white";
        goToChallengeBtn.style.border = "none";
        goToChallengeBtn.style.borderRadius = "5px";
        goToChallengeBtn.style.cursor = "pointer";
        goToChallengeBtn.addEventListener("click", async () => {
          let hoverNav = document.getElementById("hoverNav");
          if (hoverNav) {
            hoverNav.remove();
          }
          let challengeNav = document.getElementById("challengeNav");
          if (challengeNav) {
            challengeNav.remove();
          }

          try {
            const allSbcData = await sbcSets();
            const sbcSet = allSbcData.sets.filter(
              (set) => set.id == e.setId,
            )[0];

            if (!sbcSet) {
              console.warn("[SBC Hover] SBC set not found");
              showNotification(
                "SBC set not found",
                UINotificationType.NEGATIVE,
              );
              return;
            }

            await loadChallenge(e);

            const reloadSbcScreenFn =
              window?.autoSbcConsoleApi?.reloadSbcScreen ||
              (typeof reloadSbcScreen !== "undefined"
                ? reloadSbcScreen
                : undefined);

            if (typeof reloadSbcScreenFn === "function") {
              await reloadSbcScreenFn(sbcSet, e.id);
            } else {
              console.warn("[SBC Hover] reloadSbcScreen is unavailable");
              showNotification(
                "Navigation unavailable",
                UINotificationType.NEGATIVE,
              );
            }
          } catch (err) {
            console.warn("[SBC Hover] Failed to open challenge", err);
            showNotification(
              "Failed to open challenge",
              UINotificationType.NEGATIVE,
            );
          }
        });
        challengeDiv.appendChild(goToChallengeBtn);

        layoutHubDiv.appendChild(challengeDiv);

        challengeDiv.addEventListener("mouseenter", () => {
          if (hideTimeout) clearTimeout(hideTimeout);
        });

        challengeDiv.addEventListener("mouseleave", () => {
          removeChallengeNav();
        });
      };

      rowRoot.addEventListener("mouseenter", () => {
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }
        if (openTimeout) {
          clearTimeout(openTimeout);
        }
        openTimeout = setTimeout(() => {
          openTimeout = null;
          showChallengeNav();
        }, CHALLENGE_HOVER_OPEN_DELAY_MS);
      });

      rowRoot.addEventListener("mouseleave", () => {
        if (openTimeout) {
          clearTimeout(openTimeout);
          openTimeout = null;
        }
        hideTimeout = setTimeout(() => {
          removeChallengeNav();
        }, CHALLENGE_HOVER_CLOSE_DELAY_MS);
      });
      rowRoot.addEventListener("click", () => {
        let hoverNav = document.getElementById("hoverNav");

        if (hoverNav) {
          hoverNav.remove();
        }
        createSbc = true;
        createSBCTab();
        services.Notification.queue([
          set.name + " SBC Started",
          UINotificationType.POSITIVE,
        ]);

        solveSBC(
          e.setId,
          e.id,
          true,
          null,
          false,
          false,
          forceRunInBackground ? true : null,
        );
      });
      return rowRoot;
    });

  let rowDiv = document.createElement("div");
  rowDiv.id = "challengeRow";
  rowDiv.style.padding = "5px";
  rowDiv.style.borderRadius = "20px";
  rowDiv.style.background = "#1e1f1f";
  rowDiv.style.overflowY = "auto";
  row.forEach((r) => {
    rowDiv.appendChild(r);
  });
  layoutHubDiv.appendChild(rowDiv);

  return layoutHubDiv;
};

let createSBCTab = async () => {
  const existingScrollContainer = document.querySelector(
    "#sbcToolbar #sbcToolbarListScroll",
  );
  if (existingScrollContainer) {
    window.__sbcToolbarListScrollTop = Number(existingScrollContainer.scrollTop) || 0;
  }

  if (!getSettings(0, 0, "showSbcTab")) {
    document.querySelectorAll(".sbc-auto").forEach((el) => el.remove());
    return;
  }

  if (
    getSettings(0, 0, "autoOpenSub100CoinPacks") &&
    !window.__autoOpenSub100CoinPacksRunning
  ) {
    window.__autoOpenSub100CoinPacksRunning = true;
    try {
      const packsResponse = await getPacks();
      const cheapPacks = (packsResponse?.packs || []).filter((pack) => {
        const coinAmount = Number(pack?.prices?._collection?.COINS?.amount);
        return Number.isFinite(coinAmount) && coinAmount <= 100;
      });

      for (const cheapPack of cheapPacks) {
        await new Promise((resolve) => {
          cheapPack
            .purchase(GameCurrency.COINS)
            .observe(new UTStoreViewController(), async (_obs, event) => {
              try {
                if (event?.success) {
                  await openPack(cheapPack);
                }
              } catch (err) {
                console.warn("autoOpenSub100CoinPacks: openPack failed", err);
              }
              resolve();
            });
        });
      }
    } catch (err) {
      console.warn("autoOpenSub100CoinPacks failed", err);
    } finally {
      window.__autoOpenSub100CoinPacksRunning = false;
    }
  }

  if (!document.getElementById("auto-grind-spinner-style")) {
    const styleTag = document.createElement("style");
    styleTag.id = "auto-grind-spinner-style";
    styleTag.textContent = `
        .button-spinner {
          display: inline-block;
          width: 1em;
          height: 1em;
          border: 2px solid #fff;
          border-top-color: transparent;
          border-radius: 50%;
          margin-left: 5px;
          vertical-align: middle;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `;
    document.head.appendChild(styleTag);
  }

  services.SBC.repository.reset();
  const nav = document.createElement("nav");
  nav.id = "sbcToolbar";
  nav.classList.add("ut-tab-bar", "sbc-auto");
  const sbcData = await sbcSets();
  const favCategory = sbcData.categories.find((c) => c.isFavourite);
  const favSets = sbcData.sets.filter((s) =>
    favCategory?.setIds.includes(s.id),
  );
  const totalFavCompleted = favSets.reduce(
    (sum, s) => sum + (s.timesCompleted || 0),
    0,
  );
  const PACK_PURCHASE_COUNTS_KEY = "packPurchaseCountsById";
  const AUTO_BUY_PACK_ID_KEY = "autosbc_autoBuyPackId";
  const DEFAULT_AUTO_BUY_PACK_ID = 101; // Bronze Pack
  const autoBuyCurrency =
    getSettings(0, 0, "autoBuyCurrency") === "POINTS" ? "POINTS" : "COINS";
  const autoBuyGameCurrency =
    autoBuyCurrency === "POINTS" ? GameCurrency.POINTS : GameCurrency.COINS;

  const readPackPurchaseCount = (packId) => {
    try {
      const raw = localStorage.getItem(PACK_PURCHASE_COUNTS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const count =
        parsed && typeof parsed === "object"
          ? Number(parsed[String(packId)])
          : 0;
      return Number.isFinite(count) ? count : 0;
    } catch {
      return 0;
    }
  };

  const readAutoBuyPackId = () => {
    try {
      const raw = Number(localStorage.getItem(AUTO_BUY_PACK_ID_KEY));
      return Number.isFinite(raw) && raw > 0 ? raw : null;
    } catch {
      return null;
    }
  };

  const saveAutoBuyPackId = (packId) => {
    try {
      localStorage.setItem(AUTO_BUY_PACK_ID_KEY, String(packId));
    } catch {}
  };

  // Coin-purchasable store packs a user can pick from for the Auto Buy loop.
  // Only displayGroup bronze/silver/gold/special actually appear on the
  // storefront's Packs/Promo/Classic/Previewed tabs; "eventtoken" entries
  // (Nx NN+ Gold Players Pack, Kits/Player Picks) are reward-catalog items
  // not shown or purchasable in the store, and "vanityBundles" are cosmetic
  // Icon bundles — both confirmed absent from the live store UI. "Preview"
  // variants are duplicate bronze/silver/gold entries for the odds-preview
  // screen, not separately purchasable packs. All confirmed against the live
  // services.Store.getPacks(PurchasePackType.ALL, ...) response and the
  // actual store tab contents.
  const AUTO_BUY_DISPLAY_GROUPS = new Set(["bronze", "silver", "gold", "special"]);
  const getAutoBuyPackCatalog = async () => {
    let allPacks;
    try {
      allPacks = await getPacks(true);
    } catch {
      allPacks = null;
    }

    const seen = new Set();
    const catalog = [];
    for (const pack of allPacks?.packs || []) {
      const price = Number(
        pack?.prices?._collection?.[autoBuyCurrency]?.amount,
      );
      if (pack.isMyPack || !(price > 0)) continue;
      if (pack.packType !== "CARDPACK") continue;
      if (!AUTO_BUY_DISPLAY_GROUPS.has(pack.displayGroup)) continue;

      const name = services.Localization.localize(pack.packName);
      if (!name || /preview/i.test(name)) continue;

      const key = String(pack.id);
      if (seen.has(key)) continue;
      seen.add(key);

      catalog.push({
        id: pack.id,
        name,
        price,
      });
    }

    catalog.sort((a, b) => a.price - b.price);
    return catalog;
  };

  const autoBuyPackCatalog = await getAutoBuyPackCatalog();

  const resolveDefaultAutoBuyPackId = () => {
    const saved = readAutoBuyPackId();
    if (saved && autoBuyPackCatalog.some((p) => p.id === saved)) {
      return saved;
    }
    const bronze = autoBuyPackCatalog.find((p) =>
      /bronze/i.test(p.name || ""),
    );
    if (bronze) return bronze.id;
    return autoBuyPackCatalog[0]?.id ?? DEFAULT_AUTO_BUY_PACK_ID;
  };

  window.__autoBuyPackId = resolveDefaultAutoBuyPackId();
  window.__autoBuyRunning = false;
  window.__autoBuyCountTimer = null;

  const autoBuyPackName = (packId) =>
    autoBuyPackCatalog.find((p) => p.id === packId)?.name || "Bronze Packs";
  const autoBuyCurrencyClass =
    autoBuyCurrency === "POINTS" ? "currency-points" : "currency-coins";
  const autoBuyCurrencyLabel = autoBuyCurrency === "POINTS" ? "Points" : "Coins";

  const updateAutoBuyLabel = () => {
    const nameEl = document.getElementById("btnAutoBuy-packName");
    const countEl = document.getElementById("btnAutoBuy-count");
    if (nameEl) nameEl.textContent = autoBuyPackName(window.__autoBuyPackId);
    if (countEl)
      countEl.textContent = String(
        readPackPurchaseCount(window.__autoBuyPackId),
      );
  };

  const autoBuyPackButtons = autoBuyPackCatalog.map((entry) => {
    const label = `${entry.name} (${entry.price.toLocaleString()} ${autoBuyCurrencyLabel.toLowerCase()})`;
    return createNavButton(
      `autoBuyPackOption-${entry.id}`,
      `<span>${label}</span>`,
      null,
      () => {
        window.__autoBuyPackId = entry.id;
        saveAutoBuyPackId(entry.id);
        updateAutoBuyLabel();
      },
      { width: "20vw", marginTop: "0px", background: "none", color: "#fff" },
    );
  });

  const autoBuyBtn = createNavButton(
    "btnAutoBuy",
    `
        <div style="text-align:center;line-height:1.2">
          <span>Auto Buy</span>
          <span id="btnAutoBuy-currency" class="autosbc-auto-buy-currency-icon ${autoBuyCurrencyClass}" title="${autoBuyCurrencyLabel}" aria-label="${autoBuyCurrencyLabel}"></span>
          <span id="btnAutoBuy-packName" style="font-size:0.75em;display:block;opacity:0.85">
            ${autoBuyPackName(window.__autoBuyPackId)}
          </span>
          <span id="btnAutoBuy-count" style="font-size:0.8em;color:#07f468">
            ${readPackPurchaseCount(window.__autoBuyPackId)}
          </span>
          <span id="btnAutoBuy-spinner" class="button-spinner" style="display:none"></span>
        </div>
      `,
    autoBuyPackButtons.length
      ? async () =>
          createHoverNav(
            "autoBuyPacks",
            "Choose Pack to Auto Buy",
            "click to select",
            autoBuyPackButtons,
            { width: "20vw" },
          )
      : null,
    async () => {
      const spinner = document.getElementById("btnAutoBuy-spinner");

      if (window.__autoBuyRunning) {
        window.__autoBuyRunning = false;
        if (spinner) spinner.style.display = "none";
        if (window.__autoBuyCountTimer) {
          clearInterval(window.__autoBuyCountTimer);
          window.__autoBuyCountTimer = null;
        }
        updateAutoBuyLabel();
        return;
      }

      window.__autoBuyRunning = true;
      if (spinner) spinner.style.display = "inline-block";
      updateAutoBuyLabel();
      window.__autoBuyCountTimer = setInterval(updateAutoBuyLabel, 1000);

      const randDelay = () => 1200 + Math.floor(Math.random() * 1000);

      try {
        while (window.__autoBuyRunning) {
          const packId = window.__autoBuyPackId;

          try {
            await processUnassigned();
          } catch {}

          try {
            await clearSoldItems();
            relistItems();
          } catch {}

          let transferItems = [];
          try {
            transferItems = await getTransferItems();
          } catch {}

          if (Array.isArray(transferItems) && transferItems.length >= 100) {
            showNotification(
              `Stopping Auto Buy: transfer list is full (${transferItems.length}/100)`,
              UINotificationType.NEUTRAL,
            );
            break;
          }

          const balance = await getCurrencyBalance(autoBuyGameCurrency).catch(
            () => null,
          );
          if (typeof balance === "number" && balance <= 0) {
            showNotification(
              `Stopping Auto Buy: low ${autoBuyCurrency.toLowerCase()} balance`,
              UINotificationType.NEUTRAL,
            );
            break;
          }
          await processUnassigned();
          await purchasePackById(packId, autoBuyGameCurrency);
          updateAutoBuyLabel();

          try {
            await goToUnassignedView();
          } catch {}

          await sleep(randDelay());
        }
      } catch (err) {
        console.warn("Auto Buy loop error", err);
        showNotification(
          "Auto Buy encountered an error; stopping.",
          UINotificationType.NEGATIVE,
        );
      } finally {
        window.__autoBuyRunning = false;
        if (spinner) spinner.style.display = "none";
        if (window.__autoBuyCountTimer) {
          clearInterval(window.__autoBuyCountTimer);
          window.__autoBuyCountTimer = null;
        }
        updateAutoBuyLabel();
      }
    },
    { background: "none", color: "#fff" },
  );

  if (getSettings(0, 0, "showAutoBuyButton") !== false) {
    nav.appendChild(autoBuyBtn);
  }

  const autoGrindBtn = createNavButton(
    "btnAutoGrind",
    /* html */ `
        <div style="text-align:center;line-height:1.2">
          <span>Auto Grind</span>
          <span style="font-size:0.8em;color:#07f468">
            ✪ ${totalFavCompleted}
          </span>
          <span id="btnAutoGrind-spinner"
                class="button-spinner"
                style="display:none"></span>
        </div>
      `,
    null,
    async () => {
      const spinner = document.getElementById("btnAutoGrind-spinner");
      if (createSbcGrind) {
        createSbcGrind = false;
        spinner.style.display = "none";
        return;
      }
      createSbcGrind = true;
      spinner.style.display = "inline-block";
      try {
        await futAutoGrind();
      } finally {
        spinner.style.display = "none";
        autoGrindBtn.disabled = false;
        // Remove any persisted stop overlay button now that grind has ended
        document
          .querySelectorAll("#sbc-stop-overlay")
          .forEach((el) => el.remove());
      }
    },
    { background: "none", color: "#fff" },
  );

  nav.appendChild(autoGrindBtn);

  let packList = await createPackList();
  nav.appendChild(packList);

  let categoryPicker = await createCategoryPicker();
  nav.appendChild(categoryPicker);

  let sbcDiv = document.createElement("div");
  sbcDiv.id = "sbcToolbarListScroll";
  sbcDiv.style.overflowY = "auto";
  sbcDiv.style.height = "auto";
  let sbcTiles = await createSBCButtons();
  sbcTiles.forEach((tile) => sbcDiv.appendChild(tile));

  if (getSettings(0, 0, "sbcType") === "Login") {
    enableLoginToolbarDragAndDrop(sbcDiv);
  }

  const savedScrollTop = Number(window.__sbcToolbarListScrollTop || 0);
  if (savedScrollTop > 0) {
    sbcDiv.scrollTop = savedScrollTop;
  }

  nav.appendChild(sbcDiv);

  document.querySelectorAll(".sbc-auto").forEach((el) => el.remove());
  document.querySelectorAll(".ut-tab-bar-view").forEach((el) => {
    el.insertBefore(nav, el.firstChild);
  });

  if (savedScrollTop > 0) {
    requestAnimationFrame(() => {
      const currentScrollContainer = document.querySelector(
        "#sbcToolbar #sbcToolbarListScroll",
      );
      if (currentScrollContainer) {
        currentScrollContainer.scrollTop = savedScrollTop;
      }
    });
  }
};
