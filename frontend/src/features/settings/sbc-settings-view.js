// SBC Settings - View & Controller
// EA UIKit view/controller for the SBC Solver Settings page, plus nav tab factories.

const generateSbcSolveTab = () => {
  const sbcSolveTab = new UTTabBarItemView();
  sbcSolveTab.init();
  sbcSolveTab.setTag(6);
  sbcSolveTab.setText("SBC Solver");
  sbcSolveTab.addClass("icon-sbcSettings");
  return sbcSolveTab;
};

const sbcSettingsController = function (t) {
  UTHomeHubViewController.call(this);
};

JSUtils.inherits(sbcSettingsController, UTHomeHubViewController);

sbcSettingsController.prototype._getViewInstanceFromData = function () {
  return new sbcSettingsView();
};

sbcSettingsController.prototype.viewDidAppear = function () {
  this.getNavigationController().setNavigationVisibility(true, true);
};

const sbcSettingsView = function (t) {
  UTHomeHubView.call(this);
};
JSUtils.inherits(sbcSettingsView, UTHomeHubView);
sbcSettingsController.prototype.viewWillDisappear = function () {
  this.getNavigationController().setNavigationVisibility(false, false);
};
sbcSettingsController.prototype.getNavigationTitle = function () {
  return "SBC Solver";
};
sbcSettingsView.prototype.destroyGeneratedElements =
  function destroyGeneratedElements() {
    (DOMKit.remove(this.__root),
      (this.__root = null),
      this._navigation && this._navigation.destroy(),
      (this._navigation = null),
      (this.__tabContainer = null),
      (this.__uiTab = null),
      (this.__sbcTab = null),
      (this.__dataTablesTab = null));
  };

sbcSettingsView.prototype._generate = function _generate() {
  if (
    document.contains(
      document.getElementsByClassName("ut-sbc-challenge-requirements-view")[0],
    )
  ) {
    document
      .getElementsByClassName("ut-sbc-challenge-requirements-view")[0]
      .remove();
  }

  var e = document.createElement("div");
  (e.classList.add("ut-market-search-filters-view"),
    e.classList.add("floating"));
  e.classList.add("sbc-settings-container");
  e.setAttribute("id", "SettingsPanel");

  var f = document.createElement("div");
  (f.classList.add("ut-pinned-list"), f.classList.add("sbc-settings"));
  e.appendChild(f);

  var g = document.createElement("div");

  (g.classList.add("sbc-settings-header"), g.classList.add("main-header"));
  var h1 = document.createElement("H1");
  h1.innerHTML = "SBC Solver Settings";
  g.appendChild(h1);
  f.appendChild(g);

  this._navigation = new EAFilterBarView();
  const navRoot = this._navigation.getRootElement();
  if (navRoot && navRoot.style) {
    navRoot.style.background = "none";
    navRoot.style.backgroundColor = "transparent";
    navRoot.style.backgroundImage = "none";
  }
  f.appendChild(navRoot);
  this._navigation.addTab(0, "UI");
  this._navigation.addTab(1, "SBC Settings");
  this._navigation.addTab(2, "Unassigned Rules");
  this._navigation.addTarget(this, this._onSettingsTabTapped, EventType.TAP);
  this._navigation.layoutSubviews && this._navigation.layoutSubviews();

  this.__tabContainer = document.createElement("div");
  this.__tabContainer.classList.add("sbc-settings-tabs");
  f.appendChild(this.__tabContainer);

  const uiTab = document.createElement("div");
  uiTab.classList.add("sbc-settings-tab-content");
  const sbcTab = document.createElement("div");
  sbcTab.classList.add("sbc-settings-tab-content");
  const dataTablesTab = document.createElement("div");
  dataTablesTab.classList.add("sbc-settings-tab-content");

  this.__tabContainer.appendChild(uiTab);
  this.__tabContainer.appendChild(sbcTab);
  this.__tabContainer.appendChild(dataTablesTab);

  this.__uiTab = uiTab;
  this.__sbcTab = sbcTab;
  this.__dataTablesTab = dataTablesTab;

  let sbcUITile = createSettingsTile(uiTab, "Customise UI", "ui");
  createToggle(
    sbcUITile,
    "Play Sounds",
    "playSounds",
    getSettings(0, 0, "playSounds"),
    (togglePS) => {
      saveSettings(0, 0, "playSounds", togglePS.getToggleState());
    },
  );
  createToggle(
    sbcUITile,
    "Show Auto Buy Button",
    "showAutoBuyButton",
    getSettings(0, 0, "showAutoBuyButton") !== false,
    (toggleAutoBuy) => {
      saveSettings(
        0,
        0,
        "showAutoBuyButton",
        toggleAutoBuy.getToggleState(),
      );
      window.__autoBuyRunning = false;
      Promise.resolve(createSBCTab()).catch(() => {});
    },
    "Shows or hides the Auto Buy button on the SBC toolbar",
  );
  createDropDown(
    sbcUITile,
    "Auto Buy Currency",
    "autoBuyCurrency",
    [
      new UTDataProviderEntryDTO("COINS", "COINS", "Coins"),
      new UTDataProviderEntryDTO("POINTS", "POINTS", "Points"),
    ],
    getSettings(0, 0, "autoBuyCurrency") || "COINS",
    (dropdown) => {
      saveSettings(0, 0, "autoBuyCurrency", dropdown.getValue());
      window.__autoBuyRunning = false;
      Promise.resolve(createSBCTab()).catch(() => {});
    },
    "Chooses whether Auto Buy purchases packs with coins or points",
    false,
    false,
  );

  const packAnimationFilterOptions = [
    { value: "isDuplicate:true", label: "Is Duplicate: Yes" },
    { value: "isDuplicate:false", label: "Is Duplicate: No" },
    { value: "isTradable:true", label: "Is Tradable: Yes" },
    { value: "isTradable:false", label: "Is Tradable: No" },
    { value: "isMovable:true", label: "Is Movable: Yes" },
    { value: "isMovable:false", label: "Is Movable: No" },
    { value: "isPlayer:true", label: "Is Player: Yes" },
    { value: "isPlayer:false", label: "Is Player: No" },
    { value: "isSpecial:true", label: "Is Special: Yes" },
    { value: "isSpecial:false", label: "Is Special: No" },
    { value: "isFodder:true", label: "Is Fodder: Yes" },
    { value: "isFodder:false", label: "Is Fodder: No" },
    { value: "isFirstOwner:true", label: "Is First Owner: Yes" },
    { value: "isFirstOwner:false", label: "Is First Owner: No" },
    { value: "isTotsTotw:true", label: "Is TOTS/TOTW: Yes" },
    { value: "isTotsTotw:false", label: "Is TOTS/TOTW: No" },
    { value: "rating", label: "Filter by Rating" },
    { value: "price", label: "Filter by Price" },
    { value: "leagues", label: "Filter by Leagues" },
    { value: "nations", label: "Filter by Nations" },
    { value: "teams", label: "Filter by Teams" },
    { value: "rarity", label: "Filter by Rarity" },
  ];

  const buildAnimationOptions = (items) =>
    items
      .map((m) => ({
        value: String(m.id),
        label: m.label,
        customProperties: {
          icon: m.iconClass
            ? `<img class='ut-item-image' src='${m.iconClass}' />`
            : "",
        },
      }))
      .filter((f) => f.value && f.value !== "0");

  const animationLeagueOptions = buildAnimationOptions(
    factories.DataProvider.getLeagueDP().filter((f) => f.id > 0),
  );
  const animationNationOptions = buildAnimationOptions(
    factories.DataProvider.getNationDP().filter((f) => f.id > 0),
  );
  const animationTeamOptions = buildAnimationOptions(
    factories.DataProvider.getTeamDP().filter(
      (f) => f.id > 0 && !f.label.includes("*"),
    ),
  );
  const animationRarityOptions = buildAnimationOptions(
    factories.DataProvider.getItemRarityDP({
      itemSubTypes: [ItemSubType.PLAYER],
      itemTypes: [ItemType.PLAYER],
      quality: SearchLevel.ANY,
      tradableOnly: false,
    }).filter((f) => f.id > 0 && !f.label.includes("*")),
  );

  const animationRuleContainer = document.createElement("div");
  animationRuleContainer.id = "animateWalkoutItems";
  sbcUITile.appendChild(animationRuleContainer);

  const saveAnimationRule = (rule) => {
    saveSettings(
      0,
      0,
      "animateWalkoutItems",
      normalizePackAnimationFilterRule(rule),
    );
  };

  const renderAnimationRuleControls = () => {
    const rule = normalizePackAnimationFilterRule(
      getSettings(0, 0, "animateWalkoutItems"),
    );
    animationRuleContainer.innerHTML = "";

    const panel = document.createElement("div");
    panel.style.border = "1px solid #6b82a8";
    panel.style.backgroundColor = "#1e2536";
    panel.style.padding = "8px 15px";
    panel.style.marginBottom = "10px";
    panel.style.borderRadius = "5px";
    panel.style.width = "95%";
    panel.style.margin = "0 auto 10px auto";
    panel.style.boxSizing = "border-box";

    const controlsContainer = document.createElement("div");
    controlsContainer.style.display = "flex";
    controlsContainer.style.flexWrap = "wrap";
    controlsContainer.style.gap = "4px 8px";

    const filtersWrapper = document.createElement("div");
    filtersWrapper.style.minWidth = "320px";
    filtersWrapper.style.maxWidth = "320px";
    createChoiceLocal(
      filtersWrapper,
      "Pack Animation Item Filter",
      "animateWalkoutItems_filters",
      packAnimationFilterOptions,
      rule.filters || [],
      (values) => {
        saveAnimationRule({ ...rule, filters: values });
        renderAnimationRuleControls();
      },
      "Use the same fixed item filters as unassigned rules to decide which items trigger walkout animation.",
    );
    panel.appendChild(filtersWrapper);

    const addControl = (createFn, isFullWidth = false) => {
      const wrapper = document.createElement("div");
      wrapper.style.flex = isFullWidth ? "1 1 100%" : "1 1 calc(50% - 5px)";
      wrapper.style.minWidth = isFullWidth ? "100%" : "calc(50% - 5px)";
      createFn(wrapper);
      controlsContainer.appendChild(wrapper);
    };

    if (rule.filters.includes("rating")) {
      addControl(
        (wrapper) =>
          createDoubleRangeControl(
            wrapper,
            "Rating Range",
            "animateWalkoutItems_ratingRange",
            0,
            99,
            rule.ratingRange,
            (rangeControl) =>
              saveAnimationRule({
                ...rule,
                ratingRange: [
                  rangeControl.getMinValue(),
                  rangeControl.getMaxValue(),
                ],
              }),
            "Filter animated items by rating range",
          ),
        true,
      );
    }

    if (rule.filters.includes("price")) {
      addControl(
        (wrapper) =>
          createDoubleRangeControl(
            wrapper,
            "Price Range",
            "animateWalkoutItems_priceRange",
            200,
            15000000,
            rule.priceRange,
            (rangeControl) =>
              saveAnimationRule({
                ...rule,
                priceRange: [
                  rangeControl.getMinValue(),
                  rangeControl.getMaxValue(),
                ],
              }),
            "Filter animated items by price range",
            200,
            ["Min Price", "Max Price"],
          ),
        true,
      );
    }

    if (rule.filters.includes("leagues")) {
      addControl((wrapper) =>
        createChoiceLocal(
          wrapper,
          "Include leagues",
          "animateWalkoutItems_includeLeagues",
          animationLeagueOptions,
          rule.includeLeagues.map(String),
          (values) =>
            saveAnimationRule({ ...rule, includeLeagues: values.map(Number) }),
          "Only items from these leagues will animate (leave empty for any)",
        ),
      );
      addControl((wrapper) =>
        createChoiceLocal(
          wrapper,
          "Exclude leagues",
          "animateWalkoutItems_excludeLeagues",
          animationLeagueOptions,
          rule.excludeLeagues.map(String),
          (values) =>
            saveAnimationRule({ ...rule, excludeLeagues: values.map(Number) }),
          "Items from these leagues will not animate",
        ),
      );
    }

    if (rule.filters.includes("teams")) {
      addControl((wrapper) =>
        createChoiceLocal(
          wrapper,
          "Include teams",
          "animateWalkoutItems_includeTeams",
          animationTeamOptions,
          rule.includeTeams.map(String),
          (values) =>
            saveAnimationRule({ ...rule, includeTeams: values.map(Number) }),
          "Only items from these teams will animate (leave empty for any)",
        ),
      );
      addControl((wrapper) =>
        createChoiceLocal(
          wrapper,
          "Exclude teams",
          "animateWalkoutItems_excludeTeams",
          animationTeamOptions,
          rule.excludeTeams.map(String),
          (values) =>
            saveAnimationRule({ ...rule, excludeTeams: values.map(Number) }),
          "Items from these teams will not animate",
        ),
      );
    }

    if (rule.filters.includes("nations")) {
      addControl((wrapper) =>
        createChoiceLocal(
          wrapper,
          "Include nations",
          "animateWalkoutItems_includeNations",
          animationNationOptions,
          rule.includeNations.map(String),
          (values) =>
            saveAnimationRule({ ...rule, includeNations: values.map(Number) }),
          "Only items from these nations will animate (leave empty for any)",
        ),
      );
      addControl((wrapper) =>
        createChoiceLocal(
          wrapper,
          "Exclude nations",
          "animateWalkoutItems_excludeNations",
          animationNationOptions,
          rule.excludeNations.map(String),
          (values) =>
            saveAnimationRule({ ...rule, excludeNations: values.map(Number) }),
          "Items from these nations will not animate",
        ),
      );
    }

    if (rule.filters.includes("rarity")) {
      addControl((wrapper) =>
        createChoiceLocal(
          wrapper,
          "Include rarity",
          "animateWalkoutItems_includeRarity",
          animationRarityOptions,
          rule.includeRarity.map(String),
          (values) =>
            saveAnimationRule({ ...rule, includeRarity: values.map(Number) }),
          "Only items with these rarities will animate (leave empty for any)",
        ),
      );
      addControl((wrapper) =>
        createChoiceLocal(
          wrapper,
          "Exclude rarity",
          "animateWalkoutItems_excludeRarity",
          animationRarityOptions,
          rule.excludeRarity.map(String),
          (values) =>
            saveAnimationRule({ ...rule, excludeRarity: values.map(Number) }),
          "Items with these rarities will not animate",
        ),
      );
    }

    panel.appendChild(controlsContainer);
    animationRuleContainer.appendChild(panel);
  };

  renderAnimationRuleControls();
  createToggle(
    sbcUITile,
    "Show Club and storage stats",
    "ratingUI",
    getSettings(0, 0, "ratingUI"),
    (toggleST) => {
      saveSettings(0, 0, "ratingUI", toggleST.getToggleState());
    },
  );
  createToggle(
    sbcUITile,
    "Show Prices",
    "showPrices",
    getSettings(0, 0, "showPrices"),
    (toggleSP) => {
      saveSettings(0, 0, "showPrices", toggleSP.getToggleState());
    },
  );
  createToggle(
    sbcUITile,
    "Show Latest 10 Packed Special Players",
    "showRecentPackedSpecials",
    getSettings(0, 0, "showRecentPackedSpecials") !== false,
    (toggleRecentPackedSpecials) => {
      saveSettings(
        0,
        0,
        "showRecentPackedSpecials",
        toggleRecentPackedSpecials.getToggleState(),
      );
      if (typeof window.refreshRecentPackedSpecialStrip === "function") {
        window.refreshRecentPackedSpecialStrip();
      }
    },
    "Shows a fixed strip at the bottom with your latest 10 packed non-fodder players",
  );
  createToggle(
    sbcUITile,
    "Unassigned Grid Items",
    "unassignedGrid4Col",
    getUnassignedToggle("unassignedGrid4Col"),
    (toggleUnassignedGrid) => {
      const enabled = toggleUnassignedGrid.getToggleState();
      setUnassignedToggle("unassignedGrid4Col", enabled);
      applyUnassignedGridLayoutIfEnabled();
    },
    "Displays each Unassigned section as a item grid",
  );
  createToggle(
    sbcUITile,
    "Show SBC Submit Tracker",
    "showSbcSubmitTracker",
    getSettings(0, 0, "showSbcSubmitTracker"),
    (toggleTracker) => {
      saveSettings(
        0,
        0,
        "showSbcSubmitTracker",
        toggleTracker.getToggleState(),
      );
      if (typeof refreshSbcSubmitTrackerInHeader === "function") {
        refreshSbcSubmitTrackerInHeader();
      }
    },
    "Shows successful SBC submit counts for the last 60 minutes and 24 hours next to your coin balance",
  );
  createNumberSpinner(
    sbcUITile,
    "Price Cache Minutes",
    "priceCacheMinutes",
    1,
    1440,
    getSettings(0, 0, "priceCacheMinutes"),
    (numberspinnerPCM) => {
      saveSettings(0, 0, "priceCacheMinutes", numberspinnerPCM.getValue());
    },
  );
  createToggle(
    sbcUITile,
    "Show SBCs Tab",
    "showSbcTab",
    getSettings(0, 0, "showSbcTab"),
    (toggleSBCT) => {
      saveSettings(0, 0, "showSbcTab", toggleSBCT.getToggleState());
      createSBCTab();
    },
  );
  createToggle(
    sbcUITile,
    "Auto Open Packs 100 Coins or Less",
    "autoOpenSub100CoinPacks",
    getSettings(0, 0, "autoOpenSub100CoinPacks"),
    (toggleAutoCheapPacks) => {
      saveSettings(
        0,
        0,
        "autoOpenSub100CoinPacks",
        toggleAutoCheapPacks.getToggleState(),
      );
    },
    "When enabled, running the SBC tab refresh will automatically buy/open store packs priced at 100 coins or less",
  );
  createDropDown(
    sbcUITile,
    "Auto Grind Submit Mode",
    "autoGrindSubmitMode",
    [
      { name: "Optimal", id: 4 },
      { name: "Always", id: 1 },
    ].map((e) => new UTDataProviderEntryDTO(e.id, e.id, e.name)),
    getSettings(0, 0, "autoGrindSubmitMode") ?? 4,
    (dropdown) => {
      saveSettings(0, 0, "autoGrindSubmitMode", parseInt(dropdown.getValue()));
    },
    "Controls when auto-grind submits solutions: Optimal (only best solutions) or Always (any valid solution)",
    false,
    false,
  );
  createToggle(
    sbcUITile,
    "Auto Grind Open All Packs",
    "autoGrindOpenAllPacks",
    getSettings(0, 0, "autoGrindOpenAllPacks") !== false,
    (toggleAutoGrindPacks) => {
      saveSettings(
        0,
        0,
        "autoGrindOpenAllPacks",
        toggleAutoGrindPacks.getToggleState(),
      );
    },
    "When enabled, auto-grind tries to open all owned packs after each completed SBC. If disabled, it skips pack draining and moves straight to the next SBC.",
  );
  createToggle(
    sbcUITile,
    "Replace Storage Players",
    "replaceStoragePlayers",
    getSettings(0, 0, "replaceStoragePlayers"),
    (toggleReplace) => {
      saveSettings(0, 0, "replaceStoragePlayers", toggleReplace.getToggleState());
    },
    "When storage is full, quick sells the lowest-priced storage items to make room for higher-priced incoming items. If new items are worth less than all stored items, the new items are quick sold instead.",
  );
  createToggle(
    sbcUITile,
    "Show Debug Log Overlay",
    "showLogOverlay",
    getSettings(0, 0, "showLogOverlay"),
    (toggleLog) => {
      saveSettings(0, 0, "showLogOverlay", toggleLog.getToggleState());
    },
  );
  createToggle(
    sbcUITile,
    "Show QuickSolution Button on SBC Screen",
    "showQuickSolutionButtonOnSbcScreen",
    getSettings(0, 0, "showQuickSolutionButtonOnSbcScreen"),
    (toggleQuickSolutionBtn) => {
      saveSettings(
        0,
        0,
        "showQuickSolutionButtonOnSbcScreen",
        toggleQuickSolutionBtn.getToggleState(),
      );
    },
    "Controls whether the Fetch Quick Solution button is displayed on the SBC challenge screen",
  );
  createToggle(
    sbcUITile,
    "Show Quick Buy Button on SBC Screen",
    "showQuickBuyButtonOnSbcScreen",
    getSettings(0, 0, "showQuickBuyButtonOnSbcScreen"),
    (toggleQuickBuyBtn) => {
      saveSettings(
        0,
        0,
        "showQuickBuyButtonOnSbcScreen",
        toggleQuickBuyBtn.getToggleState(),
      );
    },
    "Controls whether the Quick Buy Squad button is displayed on the SBC challenge screen",
  );

  let panel = createPanel();

  let clearPricesBtn = createButton("clearPrices", "Clear All Prices", () => {
    cachedPriceItems = null;
    // Clear prices from localStorage
    localStorage.removeItem(PRICE_ITEMS_KEY);

    // Clear prices from IndexedDB
    const dbName = "futSBCDatabase";
    const storeName = "priceItems";
    const request = indexedDB.open(dbName);

    request.onsuccess = function (event) {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(storeName)) {
        cachedPriceItems = {};
        showNotification(
          "All price data has been cleared",
          UINotificationType.POSITIVE,
        );
        return;
      }

      let transaction;
      let store;
      try {
        transaction = db.transaction([storeName], "readwrite");
        store = transaction.objectStore(storeName);
      } catch (error) {
        console.error("Error opening priceItems store:", error);
        return;
      }

      // Clear all data from the store
      store.clear().onsuccess = function () {
        cachedPriceItems = {};
        showNotification(
          "All price data has been cleared",
          UINotificationType.POSITIVE,
        );
        console.log("IndexedDB price data cleared successfully");
      };

      transaction.onerror = function (error) {
        console.error("Error clearing IndexedDB:", error);
      };
    };

    request.onerror = function (event) {
      console.error("Error opening IndexedDB:", event.target.error);
    };
  });
  panel.appendChild(clearPricesBtn);
  panel.id = "clearPricesPanel";
  sbcUITile.appendChild(panel);

  const organizeUiSettings = (container) => {
    const groups = [
      {
        title: "Automation",
        ids: [
          "showAutoBuyButton",
          "autoBuyCurrency",
          "showSbcTab",
          "autoOpenSub100CoinPacks",
          "autoGrindSubmitMode",
          "autoGrindOpenAllPacks",
        ],
      },
      {
        title: "Display and Interface",
        ids: [
          "playSounds",
          "ratingUI",
          "showPrices",
          "showRecentPackedSpecials",
          "unassignedGrid4Col",
          "showSbcSubmitTracker",
          "priceCacheMinutes",
          "replaceStoragePlayers",
          "showLogOverlay",
          "showQuickSolutionButtonOnSbcScreen",
          "showQuickBuyButtonOnSbcScreen",
        ],
      },
      {
        title: "Pack Animation",
        ids: ["animateWalkoutItems"],
        wide: true,
      },
      {
        title: "Maintenance",
        ids: ["clearPricesPanel"],
      },
    ];

    groups.forEach(({ title, ids, wide }) => {
      const nodes = ids
        .map((id) => document.getElementById(id))
        .filter((node) => node && node.parentElement === container);
      if (!nodes.length) return;

      const group = document.createElement("section");
      group.className = "autosbc-settings-group";
      const heading = document.createElement("h2");
      heading.className = "autosbc-settings-group-title";
      heading.textContent = title;
      group.appendChild(heading);

      const grid = document.createElement("div");
      grid.className = "autosbc-settings-group-grid";
      nodes.forEach((node) => {
        if (wide) node.classList.add("autosbc-settings-group-wide");
        grid.appendChild(node);
      });
      group.appendChild(grid);
      container.appendChild(group);
    });
  };

  organizeUiSettings(sbcUITile);

  let sbcRulesTile = createSettingsTile(sbcTab, "Customise SBC", "customRules");
  createSBCCustomRulesPanel(sbcRulesTile);

  const unassignedTooltip =
    "How Unassigned Rules Work:\n\n" +
    "• Rules are processed in order from top to bottom. Drag rules to reorder them.\n\n" +
    "• Each item can only be processed by one rule - the first rule that matches it.\n\n" +
    "• For each rule, choose an Action and configure Filters to select which items match.\n\n" +
    "• All selected filters must match for an item to be processed by that rule.\n\n" +
    "• Use this priority system to handle specific items first, then broader categories later.";

  const unassignedTile = createSettingsTile(
    dataTablesTab,
    "Unassigned",
    "unassigned",
    unassignedTooltip,
  );

  createUnassignedRulesPanel(unassignedTile);

  this._setActiveSettingsTab(0);

  ((this.__root = e), (this._generated = !0));
};

sbcSettingsView.prototype._onSettingsTabTapped = function _onSettingsTabTapped(
  sender,
  data,
) {
  let tabId =
    typeof data === "number"
      ? data
      : (data?.id ?? data?.tabId ?? data?.index ?? data?.value ?? data);

  if (!Number.isFinite(tabId)) {
    try {
      tabId = sender?.getActiveTab?.();
    } catch {}
  }

  if (Number.isFinite(tabId)) {
    this._setActiveSettingsTab(tabId);
  }
};

sbcSettingsView.prototype._setActiveSettingsTab =
  function _setActiveSettingsTab(tabId) {
    const setVisibility = (element, isActive) => {
      if (element) {
        element.style.display = isActive ? "" : "none";
      }
    };

    setVisibility(this.__uiTab, tabId === 0);
    setVisibility(this.__sbcTab, tabId === 1);
    setVisibility(this.__dataTablesTab, tabId === 2);
    this._navigation && this._navigation.setActiveTab(tabId);
  };
