// SBC Settings - Unassigned Rules
// Data model, matchers, and UI panel for the unassigned item rules engine.
// Rules are persisted to backend file storage.

const UNASSIGNED_GROUPS = [
  {
    id: "sendToClub",
    label: "Send to club",
    action: "move",
    destination: 7,
  },
  {
    id: "sendToTransferList",
    label: "Send to transfer list",
    action: "move",
    destination: 5,
  },
  {
    id: "quickSell",
    label: "Quick sell",
    action: "discard",
  },
  {
    id: "listOnTransferMarket",
    label: "List on transfer market",
    action: "quickList",
  },
  {
    id: "sendToStorage",
    label: "Send to storage",
    action: "move",
    destination: 10,
  },
];

const UNASSIGNED_RULES_KEY = "unassigned_rules";
const _UNASSIGNED_STORAGE_KEY = "autosbc_unassigned_rules";
const _UNASSIGNED_TOGGLES_KEY = "autosbc_unassigned_toggles";
const UNASSIGNED_RULES_API_URL = "http://127.0.0.1:8000/api/unassigned-rules";

const _readUnassignedStore = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const _writeUnassignedStore = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error("[Unassigned] Failed to write", key, err);
  }
};

// Migrate from old sbcSettings object on first access
let _unassignedMigrated = false;
const _migrateUnassignedOnce = () => {
  if (_unassignedMigrated) return;
  _unassignedMigrated = true;
  // Rules migration
  if (!localStorage.getItem(_UNASSIGNED_STORAGE_KEY)) {
    try {
      const old = getSettings(0, 0, UNASSIGNED_RULES_KEY);
      if (Array.isArray(old) && old.length) {
        _writeUnassignedStore(_UNASSIGNED_STORAGE_KEY, old);
        console.log("[Unassigned] Migrated rules from sbcSettings");
      }
    } catch {}
  }
  // Toggles migration
  if (!localStorage.getItem(_UNASSIGNED_TOGGLES_KEY)) {
    try {
      const grid = getSettings(0, 0, "unassignedGrid4Col");
      if (grid !== undefined && grid !== null) {
        _writeUnassignedStore(_UNASSIGNED_TOGGLES_KEY, { unassignedGrid4Col: grid });
        console.log("[Unassigned] Migrated toggles from sbcSettings");
      }
    } catch {}
  }
};

const getUnassignedToggle = (key, defaultValue = false) => {
  _migrateUnassignedOnce();
  const toggles = _readUnassignedStore(_UNASSIGNED_TOGGLES_KEY, {});
  return toggles[key] ?? defaultValue;
};

const setUnassignedToggle = (key, value) => {
  _migrateUnassignedOnce();
  const toggles = _readUnassignedStore(_UNASSIGNED_TOGGLES_KEY, {});
  toggles[key] = value;
  _writeUnassignedStore(_UNASSIGNED_TOGGLES_KEY, toggles);
};

const DEFAULT_UNASSIGNED_RULES = [
  // Rule 1: Send non-duplicate untradable items to club
  {
    action: "sendToClub",
    color: "#1abc9c",
    filters: ["isDuplicate:false", "isTradable:false"],
    ratingRange: [0, 99],
    priceRange: [200, 15000000],
    includeLeagues: [],
    excludeLeagues: [],
    includeTeams: [],
    excludeTeams: [],
    includeNations: [],
    excludeNations: [],
    includeRarity: [],
    excludeRarity: [],
  },
  // Rule 2: Send high-priced tradable items to transfer list
  {
    action: "sendToTransferList",
    color: "#2ecc71",
    filters: ["isTradable:true", "price"],
    ratingRange: [0, 99],
    priceRange: [5000, 15000000],
    includeLeagues: [],
    excludeLeagues: [],
    includeTeams: [],
    excludeTeams: [],
    includeNations: [],
    excludeNations: [],
    includeRarity: [],
    excludeRarity: [],
  },
  // Rule 2: List non-fodder tradable duplicates on market
  {
    action: "listOnTransferMarket",
    color: "#3498db",
    filters: ["isTradable:true", "isDuplicate:true", "isFodder:false"],
    ratingRange: [0, 99],
    priceRange: [200, 15000000],
    includeLeagues: [],
    excludeLeagues: [],
    includeTeams: [],
    excludeTeams: [],
    includeNations: [],
    excludeNations: [],
    includeRarity: [],
    excludeRarity: [],
  },
  // Rule 3: Send untradable duplicate players to storage
  {
    action: "sendToStorage",
    color: "#9b59b6",
    filters: ["isTradable:false", "isDuplicate:true", "isPlayer:true"],
    ratingRange: [0, 99],
    priceRange: [200, 15000000],
    includeLeagues: [],
    excludeLeagues: [],
    includeTeams: [],
    excludeTeams: [],
    includeNations: [],
    excludeNations: [],
    includeRarity: [],
    excludeRarity: [],
  },
  // Rule 4: Quick sell non-player fodder duplicates
  {
    action: "quickSell",
    color: "#e74c3c",
    filters: ["isDuplicate:true", "isPlayer:false", "isFodder:true"],
    ratingRange: [0, 99],
    priceRange: [200, 15000000],
    includeLeagues: [],
    excludeLeagues: [],
    includeTeams: [],
    excludeTeams: [],
    includeNations: [],
    excludeNations: [],
    includeRarity: [],
    excludeRarity: [],
  },
  // Rule 5: Quick sell non-player untradable duplicates
  {
    action: "quickSell",
    color: "#d35400",
    filters: ["isDuplicate:true", "isPlayer:false", "isTradable:false"],
    ratingRange: [0, 99],
    priceRange: [200, 15000000],
    includeLeagues: [],
    excludeLeagues: [],
    includeTeams: [],
    excludeTeams: [],
    includeNations: [],
    excludeNations: [],
    includeRarity: [],
    excludeRarity: [],
  },
  // Rule 6: Keep all non-duplicate items in club
  {
    action: "sendToClub",
    color: "#ecf0f1",
    filters: ["isDuplicate:false"],
    ratingRange: [0, 99],
    priceRange: [200, 15000000],
    includeLeagues: [],
    excludeLeagues: [],
    includeTeams: [],
    excludeTeams: [],
    includeNations: [],
    excludeNations: [],
    includeRarity: [],
    excludeRarity: [],
  },
  // Rule 5: Quick sell remaining duplicates
  {
    action: "quickSell",
    color: "#c0392b",
    filters: ["isDuplicate:true"],
    ratingRange: [0, 99],
    priceRange: [200, 15000000],
    includeLeagues: [],
    excludeLeagues: [],
    includeTeams: [],
    excludeTeams: [],
    includeNations: [],
    excludeNations: [],
    includeRarity: [],
    excludeRarity: [],
  },
];

const normalizeUnassignedRule = (rule = {}) => ({
  id: rule.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  action: rule.action ?? "sendToClub",
  color: rule.color || "#1e2536",
  filters: Array.isArray(rule.filters) ? rule.filters : [],
  ratingRange:
    Array.isArray(rule.ratingRange) && rule.ratingRange.length === 2
      ? rule.ratingRange
      : [0, 99],
  priceRange:
    Array.isArray(rule.priceRange) && rule.priceRange.length === 2
      ? rule.priceRange
      : [200, 15000000],
  includeLeagues: Array.isArray(rule.includeLeagues) ? rule.includeLeagues : [],
  excludeLeagues: Array.isArray(rule.excludeLeagues) ? rule.excludeLeagues : [],
  includeTeams: Array.isArray(rule.includeTeams) ? rule.includeTeams : [],
  excludeTeams: Array.isArray(rule.excludeTeams) ? rule.excludeTeams : [],
  includeNations: Array.isArray(rule.includeNations) ? rule.includeNations : [],
  excludeNations: Array.isArray(rule.excludeNations) ? rule.excludeNations : [],
  includeRarity: Array.isArray(rule.includeRarity) ? rule.includeRarity : [],
  excludeRarity: Array.isArray(rule.excludeRarity) ? rule.excludeRarity : [],
});

let _cachedUnassignedRules = null;

// Backend API helpers
const _readUnassignedRulesFromBackend = async () => {
  try {
    const response = await fetch(UNASSIGNED_RULES_API_URL);
    if (!response.ok) {
      console.warn("[Unassigned] Backend returned non-OK status:", response.status);
      return null;
    }
    const data = await response.json();
    return data && Array.isArray(data.rules) ? data.rules : null;
  } catch (err) {
    console.error("[Unassigned] Failed to read rules from backend:", err);
    return null;
  }
};

const _writeUnassignedRulesToBackend = async (rules) => {
  try {
    const response = await fetch(UNASSIGNED_RULES_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules }),
    });
    if (!response.ok) {
      console.error("[Unassigned] Backend returned non-OK status on write:", response.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Unassigned] Failed to write rules to backend:", err);
    return false;
  }
};

// Bootstrap: load from backend on startup, migrate from localStorage if needed
(async () => {
  try {
    let rules = await _readUnassignedRulesFromBackend();
    if (!rules || rules.length === 0) {
      // No rules on backend – migrate from localStorage if available
      const raw = localStorage.getItem(_UNASSIGNED_STORAGE_KEY);
      if (raw) {
        try {
          rules = JSON.parse(raw);
          await _writeUnassignedRulesToBackend(rules);
          console.log("[Unassigned] Migrated rules from localStorage to backend");
        } catch (parseErr) {
          console.error("[Unassigned] Failed to parse localStorage rules:", parseErr);
          rules = null;
        }
      }
    }
    if (rules && Array.isArray(rules)) {
      _cachedUnassignedRules = rules;
      // Also keep localStorage in sync as fallback
      localStorage.setItem(_UNASSIGNED_STORAGE_KEY, JSON.stringify(rules));
    }
  } catch (err) {
    console.error("[Unassigned] Bootstrap error:", err);
  }
})();

const getDefaultUnassignedRules = () =>
  DEFAULT_UNASSIGNED_RULES.map((rule) => normalizeUnassignedRule({ ...rule }));

const getUnassignedRules = () => {
  _migrateUnassignedOnce();
  
  // Return cached rules if available
  if (_cachedUnassignedRules && Array.isArray(_cachedUnassignedRules)) {
    return _cachedUnassignedRules.map(normalizeUnassignedRule);
  }
  
  // Fallback to localStorage
  if (!localStorage.getItem(_UNASSIGNED_STORAGE_KEY)) {
    const defaults = getDefaultUnassignedRules();
    _writeUnassignedStore(_UNASSIGNED_STORAGE_KEY, defaults);
    _cachedUnassignedRules = defaults;
    return defaults;
  }
  const rules = _readUnassignedStore(_UNASSIGNED_STORAGE_KEY, []);
  if (!Array.isArray(rules) || rules.length === 0) {
    const defaults = getDefaultUnassignedRules();
    _writeUnassignedStore(_UNASSIGNED_STORAGE_KEY, defaults);
    _cachedUnassignedRules = defaults;
    return defaults;
  }
  _cachedUnassignedRules = rules;
  return rules.map(normalizeUnassignedRule);
};

const setUnassignedRules = (rules) => {
  _cachedUnassignedRules = rules;
  // Sync to localStorage
  _writeUnassignedStore(_UNASSIGNED_STORAGE_KEY, rules);
  // Persist to backend asynchronously
  _writeUnassignedRulesToBackend(rules).catch((err) => {
    console.error("[Unassigned] Failed to persist rules to backend:", err);
  });
};

const isUnassignedGroupingEnabled = () =>
  getUnassignedRules().some((rule) => rule.enabled !== false);

const getItemLeagueId = (item) =>
  Number(
    item?.leagueId ??
      item?._staticData?.leagueId ??
      item?.league?.id ??
      item?.league,
  ) || 0;
const getItemNationId = (item) =>
  Number(
    item?.nationId ??
      item?._staticData?.nationId ??
      item?.nation?.id ??
      item?.nation,
  ) || 0;
const getItemTeamId = (item) =>
  Number(
    item?.teamId ??
      item?.clubId ??
      item?._staticData?.teamId ??
      item?._staticData?.clubId ??
      item?.team?.id ??
      item?.club?.id,
  ) || 0;
const getItemRarityId = (item) =>
  Number(item?.rareflag ?? item?._staticData?.rareflag ?? item?.rarityId) || 0;

const getRarityLabelById = (rarityId) => {
  if (!rarityId) return "Unknown";
  if (!window.__rarityLabelMap) {
    try {
      const entries =
        factories?.DataProvider?.getItemRarityDP?.({
          itemSubTypes: [ItemSubType.PLAYER],
          itemTypes: [ItemType.PLAYER],
          quality: SearchLevel.ANY,
          tradableOnly: false,
        }) || [];
      window.__rarityLabelMap = new Map(
        entries.map((e) => [Number(e.id), e.label]).filter((e) => e[0]),
      );
    } catch {
      window.__rarityLabelMap = new Map();
    }
  }
  return window.__rarityLabelMap.get(Number(rarityId)) || String(rarityId);
};

const getItemRarityLabel = (item) => {
  if (!item) return "Unknown";
  try {
    return (
      (item.isSpecial()
        ? ""
        : services.Localization.localize(
            "search.cardLevels.cardLevel" + item.getTier(),
          ) + " ") +
      services.Localization.localize("item.raretype" + item.rareflag)
    ).trim();
  } catch {
    return getRarityLabelById(getItemRarityId(item));
  }
};

const matchesTriState = (expected, actual) => {
  if (expected === "any") return true;
  if (expected === "yes") return !!actual;
  if (expected === "no") return !actual;
  return true;
};

const matchesUnassignedRule = (item, rule, options = {}) => {
  const { assumeMinPriceWhenMissing = false } = options || {};
  if (!item) return false;
  if (item?.isFreeCoins?.() || item?.isFreePack?.()) return false;

  if (rule.filters.includes("animationFilter")) {
    if (
      typeof itemMatchesPackAnimationFilter !== "function" ||
      !itemMatchesPackAnimationFilter(item)
    ) {
      return false;
    }
  }

  // Check filters array
  if (rule.filters && rule.filters.length > 0) {
    const itemProps = {
      isDuplicate: Number(item?.duplicateId ?? 0) > 0 || item?.isDuplicate?.(),
      isTradable:
        item?.tradable === true ||
        (typeof item.isTradeable === "function" && item.isTradeable()),
      isMovable: typeof item.isMovable === "function" && item.isMovable(),
      isPlayer:
        (typeof item.isPlayer === "function" && item.isPlayer()) ||
        item?.isPlayer === true,
      isSpecial:
        (typeof item.isSpecial === "function" && item.isSpecial()) ||
        item?.isSpecial === true,
      isFodder: typeof isFodder === "function" && isFodder(item),
      isFirstOwner: item?.owners === 1,
      isTotsTotw: Array.isArray(item?.groups) && item.groups.includes(44),
    };

    for (const filter of rule.filters) {
      if (!filter.includes(":")) continue;
      const [key, valueStr] = filter.split(":");
      if (!key || typeof valueStr === "undefined") continue;
      const expectedValue = valueStr === "true";
      const actualValue = itemProps[key];

      if (actualValue !== expectedValue) {
        return false;
      }
    }
  }

  const isPlayer =
    (typeof item.isPlayer === "function" && item.isPlayer()) ||
    item?.isPlayer === true;

  // Check rating range if rating filter is enabled
  if (rule.filters.includes("rating")) {
    const rating = Number(item?.rating ?? item?._staticData?.rating ?? 0);
    if (!isPlayer) return false;
    const [minRating, maxRating] = rule.ratingRange;
    if (rating < minRating || rating > maxRating) return false;
  }

  // Check price range if price filter is enabled
  if (rule.filters.includes("price")) {
    const [minPrice, maxPrice] = rule.priceRange;
    let price = Number(getPrice(item));
    const hasPrice = Number.isFinite(price) && price > 0;

    if (!hasPrice) {
      if (!assumeMinPriceWhenMissing) {
        return false;
      }
      price = Number(minPrice) || 0;
    }

    if (price < minPrice || price > maxPrice) return false;
  }

  const leagueId = getItemLeagueId(item);
  const nationId = getItemNationId(item);
  const teamId = getItemTeamId(item);
  const rarityId = getItemRarityId(item);

  // Check league filters if enabled
  if (rule.filters.includes("leagues")) {
    if (
      rule.includeLeagues.length > 0 &&
      !rule.includeLeagues.includes(leagueId)
    )
      return false;
    if (
      rule.excludeLeagues.length > 0 &&
      rule.excludeLeagues.includes(leagueId)
    )
      return false;
  }

  // Check nation filters if enabled
  if (rule.filters.includes("nations")) {
    if (
      rule.includeNations.length > 0 &&
      !rule.includeNations.includes(nationId)
    )
      return false;
    if (
      rule.excludeNations.length > 0 &&
      rule.excludeNations.includes(nationId)
    )
      return false;
  }

  // Check team filters if enabled
  if (rule.filters.includes("teams")) {
    if (rule.includeTeams.length > 0 && !rule.includeTeams.includes(teamId))
      return false;
    if (rule.excludeTeams.length > 0 && rule.excludeTeams.includes(teamId))
      return false;
  }

  // Check rarity filters if enabled
  if (rule.filters.includes("rarity")) {
    if (rule.includeRarity.length > 0 && !rule.includeRarity.includes(rarityId))
      return false;
    if (rule.excludeRarity.length > 0 && rule.excludeRarity.includes(rarityId))
      return false;
  }

  return true;
};

const matchesUnassignedGroup = (item, groupId) => {
  const rules = getUnassignedRules();
  if (!rules.length) return false;
  return rules.some((rule) => matchesUnassignedRule(item, rule));
};

const createUnassignedRulesPanel = (parent) => {
  const actionOptions = UNASSIGNED_GROUPS.map(
    (group) => new UTDataProviderEntryDTO(group.id, group.id, group.label),
  );

  // Build filter options for the choices control
  const filterOptions = [
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
    { value: "animationFilter", label: "Matches Animation Filter" },
    { value: "rating", label: "Filter by Rating" },
    { value: "price", label: "Filter by Price" },
    { value: "leagues", label: "Filter by Leagues" },
    { value: "nations", label: "Filter by Nations" },
    { value: "teams", label: "Filter by Teams" },
    { value: "rarity", label: "Filter by Rarity" },
  ];

  const buildOptions = (items) =>
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

  const leagueOptions = buildOptions(
    factories.DataProvider.getLeagueDP().filter((f) => f.id > 0),
  );
  const nationOptions = buildOptions(
    factories.DataProvider.getNationDP().filter((f) => f.id > 0),
  );
  const teamOptions = buildOptions(
    factories.DataProvider.getTeamDP().filter(
      (f) => f.id > 0 && !f.label.includes("*"),
    ),
  );
  const rarityOptions = buildOptions(
    factories.DataProvider.getItemRarityDP({
      itemSubTypes: [ItemSubType.PLAYER],
      itemTypes: [ItemType.PLAYER],
      quality: SearchLevel.ANY,
      tradableOnly: false,
    }).filter((f) => f.id > 0 && !f.label.includes("*")),
  );

  const container = document.createElement("div");
  container.classList.add("sbc-settings-section");
  parent.appendChild(container);

  const renderRules = () => {
    container.innerHTML = "";

    let allRules = getUnassignedRules();

    if (!allRules.length) {
      allRules = [normalizeUnassignedRule({})];
      setUnassignedRules(allRules);
    }

    allRules.forEach((rule, idx) => {
      const panel = document.createElement("div");
      panel.classList.add(".sbc-rule-field");
      panel.style.border = "1px solid #6b82a8";
      panel.style.backgroundColor = "#1e2536";
      panel.style.padding = "8px 15px";
      panel.style.marginBottom = "10px";
      panel.style.borderRadius = "5px";
      panel.style.width = "95%";
      panel.style.margin = "0 auto 10px auto";
      panel.style.boxSizing = "border-box";

      // Create a container for controls that will display in 2 columns
      const controlsContainer = document.createElement("div");
      controlsContainer.style.display = "flex";
      controlsContainer.style.flexWrap = "wrap";
      controlsContainer.style.gap = "4px 8px";

      // Make panel draggable
      panel.setAttribute("draggable", "true");
      panel.dataset.ruleIndex = idx;
      panel.dataset.ruleId = rule.id;

      const titleRow = document.createElement("div");
      titleRow.classList.add("panelActionRow");
      titleRow.style.marginBottom = "8px";
      titleRow.style.display = "flex";
      titleRow.style.alignItems = "center";
      titleRow.style.gap = "15px";

      // Drag handle
      const dragHandle = document.createElement("div");
      dragHandle.innerHTML = "&#8942;&#8942;";
      dragHandle.style.cursor = "grab";
      dragHandle.style.fontSize = "20px";
      dragHandle.style.color = "#556c95";
      dragHandle.style.userSelect = "none";
      dragHandle.style.padding = "0";
      dragHandle.style.flexShrink = "0";
      dragHandle.style.display = "flex";
      dragHandle.style.alignItems = "center";
      dragHandle.style.width = "20px";
      dragHandle.title = "Drag to reorder";
      titleRow.appendChild(dragHandle);

      const titleLabel = document.createElement("div");
      titleLabel.classList.add("buttonInfoLabel");
      const titleSpan = document.createElement("span");
      titleSpan.classList.add("spinnerLabel");
      titleSpan.textContent = `Rule ${idx + 1}`;
      titleSpan.style.color = "#ffffff";
      titleSpan.style.fontWeight = "bold";
      titleSpan.style.fontSize = "16px";
      titleSpan.style.whiteSpace = "nowrap";
      titleLabel.appendChild(titleSpan);
      titleLabel.style.flexShrink = "0";
      titleLabel.style.display = "flex";
      titleLabel.style.alignItems = "center";
      titleLabel.style.width = "80px";
      titleRow.appendChild(titleLabel);

      const updateRule = (updates) => {
        const next = getUnassignedRules().map((r) =>
          r.id === rule.id ? { ...r, ...updates } : r,
        );
        setUnassignedRules(next);
      };

      // Action dropdown in title row
      const actionWrapper = document.createElement("div");

      actionWrapper.style.minWidth = "320px";
      actionWrapper.style.alignItems = "center";
      createDropDown(
        actionWrapper,
        "Action",
        `unassigned_${rule.id}_action`,
        actionOptions,
        rule.action || "sendToClub",
        (dropdown) => updateRule({ action: dropdown.getValue() }),
        "What action to perform on items matching this rule",
        true,
      );
      titleRow.appendChild(actionWrapper);

      // Item Filters in title row
      const filtersWrapper = document.createElement("div");

      filtersWrapper.style.minWidth = "320px";
      filtersWrapper.style.maxWidth = "320px";
      filtersWrapper.style.alignItems = "center";
      createChoiceLocal(
        filtersWrapper,
        "Item Filters",
        `unassigned_${rule.id}_filters`,
        filterOptions,
        rule.filters || [],
        (values) => {
          updateRule({ filters: values });
          // Re-render to show/hide conditional controls
          renderRules();
        },
        "Select filters to apply. If you don't select any value for a filter type (e.g., neither isDuplicate:true nor isDuplicate:false), that filter is ignored (any).",
      );
      titleRow.appendChild(filtersWrapper);

      const copyBtn = createButton(
        `unassigned_copy_${rule.groupId}_${rule.id}`,
        "Copy",
        () => {
          const cloned = { ...rule };
          delete cloned.id;
          const newRule = normalizeUnassignedRule(cloned);

          const nextOrder = [...allRules];
          const currentIndex = nextOrder.findIndex((r) => r.id === rule.id);
          const insertIndex =
            currentIndex >= 0 ? currentIndex + 1 : nextOrder.length;
          nextOrder.splice(insertIndex, 0, newRule);

          setUnassignedRules(nextOrder);

          renderRules();
        },
      );
      copyBtn.classList.add("sbc-settings-inline-btn");
      copyBtn.style.flexShrink = "0";
      copyBtn.style.padding = "3px 8px";
      copyBtn.style.fontSize = "12px";
      copyBtn.title = "Copy rule";
      titleRow.appendChild(copyBtn);

      const colorWrapper = document.createElement("div");
      colorWrapper.style.display = "flex";
      colorWrapper.style.alignItems = "center";
      colorWrapper.style.gap = "6px";
      colorWrapper.style.flexShrink = "0";

      const colorLabel = document.createElement("span");
      colorLabel.textContent = "Color";
      colorLabel.style.fontSize = "12px";
      colorLabel.style.opacity = "0.8";
      colorWrapper.appendChild(colorLabel);

      const colorInput = document.createElement("input");
      colorInput.type = "color";
      colorInput.value = rule.color || "#ffffff";
      colorInput.style.width = "28px";
      colorInput.style.height = "20px";
      colorInput.style.border = "none";
      colorInput.style.background = "transparent";
      colorInput.style.cursor = "pointer";
      colorInput.addEventListener("input", () => {
        const color = colorInput.value;
        updateRule({ color });
        titleSpan.style.color = color;
      });
      colorWrapper.appendChild(colorInput);
      titleRow.appendChild(colorWrapper);

      // Red X button without circle
      const removeBtn = document.createElement("button");
      removeBtn.innerHTML = "×";
      removeBtn.style.background = "none";
      removeBtn.style.border = "none";
      removeBtn.style.color = "#ff4444";
      removeBtn.style.fontSize = "28px";
      removeBtn.style.cursor = "pointer";
      removeBtn.style.padding = "0";
      removeBtn.style.width = "30px";
      removeBtn.style.height = "30px";
      removeBtn.style.display = "flex";
      removeBtn.style.alignItems = "center";
      removeBtn.style.justifyContent = "center";
      removeBtn.style.flexShrink = "0";
      removeBtn.style.fontWeight = "bold";
      removeBtn.style.lineHeight = "1";
      removeBtn.title = "Remove rule";
      removeBtn.addEventListener("mouseenter", () => {
        removeBtn.style.color = "#ff0000";
      });
      removeBtn.addEventListener("mouseleave", () => {
        removeBtn.style.color = "#ff4444";
      });
      removeBtn.addEventListener("click", () => {
        const next = getUnassignedRules().filter((r) => r.id !== rule.id);
        setUnassignedRules(next);
        renderRules();
      });
      titleRow.appendChild(removeBtn);
      panel.appendChild(titleRow);

      // Helper function to add controls with proper width styling
      const addControl = (createFn, isFullWidth = false) => {
        const wrapper = document.createElement("div");
        wrapper.style.flex = isFullWidth ? "1 1 100%" : "1 1 calc(50% - 5px)";
        wrapper.style.minWidth = isFullWidth ? "100%" : "calc(50% - 5px)";
        createFn(wrapper);
        controlsContainer.appendChild(wrapper);
      };

      // Conditionally show rating range control - full width
      if (rule.filters.includes("rating")) {
        addControl(
          (wrapper) =>
            createDoubleRangeControl(
              wrapper,
              "Rating Range",
              `unassigned_${rule.id}_ratingRange`,
              0,
              99,
              rule.ratingRange,
              (rangeControl) =>
                updateRule({
                  ratingRange: [
                    rangeControl.getMinValue(),
                    rangeControl.getMaxValue(),
                  ],
                }),
              "Filter players by rating range",
            ),
          true,
        );
      }

      // Conditionally show price range control - full width
      if (rule.filters.includes("price")) {
        addControl(
          (wrapper) =>
            createDoubleRangeControl(
              wrapper,
              "Price Range",
              `unassigned_${rule.id}_priceRange`,
              200,
              15000000,
              rule.priceRange,
              (rangeControl) =>
                updateRule({
                  priceRange: [
                    rangeControl.getMinValue(),
                    rangeControl.getMaxValue(),
                  ],
                }),
              "Filter items by price range",
              200,
              ["Min Price", "Max Price"],
            ),
          true,
        );
      }

      // Conditionally show league filters - 2 columns
      if (rule.filters.includes("leagues")) {
        addControl((wrapper) =>
          createChoiceLocal(
            wrapper,
            "Include leagues",
            `unassigned_${rule.id}_includeLeagues`,
            leagueOptions,
            rule.includeLeagues.map(String),
            (values) => updateRule({ includeLeagues: values.map(Number) }),
            "Only items from these leagues will match (leave empty for any)",
          ),
        );

        addControl((wrapper) =>
          createChoiceLocal(
            wrapper,
            "Exclude leagues",
            `unassigned_${rule.id}_excludeLeagues`,
            leagueOptions,
            rule.excludeLeagues.map(String),
            (values) => updateRule({ excludeLeagues: values.map(Number) }),
            "Items from these leagues will be excluded",
          ),
        );
      }

      // Conditionally show team filters - 2 columns
      if (rule.filters.includes("teams")) {
        addControl((wrapper) =>
          createChoiceLocal(
            wrapper,
            "Include teams",
            `unassigned_${rule.id}_includeTeams`,
            teamOptions,
            rule.includeTeams.map(String),
            (values) => updateRule({ includeTeams: values.map(Number) }),
            "Only items from these teams will match (leave empty for any)",
          ),
        );

        addControl((wrapper) =>
          createChoiceLocal(
            wrapper,
            "Exclude teams",
            `unassigned_${rule.id}_excludeTeams`,
            teamOptions,
            rule.excludeTeams.map(String),
            (values) => updateRule({ excludeTeams: values.map(Number) }),
            "Items from these teams will be excluded",
          ),
        );
      }

      // Conditionally show nation filters - 2 columns
      if (rule.filters.includes("nations")) {
        addControl((wrapper) =>
          createChoiceLocal(
            wrapper,
            "Include nations",
            `unassigned_${rule.id}_includeNations`,
            nationOptions,
            rule.includeNations.map(String),
            (values) => updateRule({ includeNations: values.map(Number) }),
            "Only items from these nations will match (leave empty for any)",
          ),
        );

        addControl((wrapper) =>
          createChoiceLocal(
            wrapper,
            "Exclude nations",
            `unassigned_${rule.id}_excludeNations`,
            nationOptions,
            rule.excludeNations.map(String),
            (values) => updateRule({ excludeNations: values.map(Number) }),
            "Items from these nations will be excluded",
          ),
        );
      }

      // Conditionally show rarity filters - 2 columns
      if (rule.filters.includes("rarity")) {
        addControl((wrapper) =>
          createChoiceLocal(
            wrapper,
            "Include rarity",
            `unassigned_${rule.id}_includeRarity`,
            rarityOptions,
            rule.includeRarity.map(String),
            (values) => updateRule({ includeRarity: values.map(Number) }),
            "Only items with these rarities will match (leave empty for any)",
          ),
        );

        addControl((wrapper) =>
          createChoiceLocal(
            wrapper,
            "Exclude rarity",
            `unassigned_${rule.id}_excludeRarity`,
            rarityOptions,
            rule.excludeRarity.map(String),
            (values) => updateRule({ excludeRarity: values.map(Number) }),
            "Items with these rarities will be excluded",
          ),
        );
      }

      panel.appendChild(controlsContainer);
      container.appendChild(panel);

      // Add drag event listeners
      panel.addEventListener("dragstart", (e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/html", panel.innerHTML);
        panel.style.opacity = "0.4";
      });

      panel.addEventListener("dragend", (e) => {
        panel.style.opacity = "1";
      });

      panel.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";

        const draggingPanel = document.querySelector(
          '[draggable="true"][style*="opacity: 0.4"]',
        );
        if (draggingPanel && draggingPanel !== panel) {
          const allPanels = Array.from(container.children);
          const dragIndex = allPanels.indexOf(draggingPanel);
          const targetIndex = allPanels.indexOf(panel);

          if (dragIndex < targetIndex) {
            panel.parentNode.insertBefore(draggingPanel, panel.nextSibling);
          } else {
            panel.parentNode.insertBefore(draggingPanel, panel);
          }
        }
      });

      panel.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Get the new order of all panels
        const panels = Array.from(container.children);
        const newOrder = [];

        panels.forEach((p) => {
          const ruleId = p.dataset.ruleId;
          const foundRule = allRules.find((r) => r.id === ruleId);
          if (foundRule) {
            newOrder.push(foundRule);
          }
        });

        setUnassignedRules(newOrder);

        // Re-render to update rule numbers
        renderRules();
      });
    });
  };

  const btnRow = document.createElement("div");
  btnRow.style.display = "flex";
  btnRow.style.gap = "10px";
  btnRow.style.marginBottom = "20px";

  const addRuleBtn = createButton("unassigned_add_rule", "Add New Rule", () => {
    const next = getUnassignedRules();
    next.push(normalizeUnassignedRule({}));
    setUnassignedRules(next);
    renderRules();
  });
  btnRow.appendChild(addRuleBtn);

  const defaultBtn = createButton(
    "unassigned_set_defaults",
    "Set to Default",
    () => {
      const defaults = getDefaultUnassignedRules();
      setUnassignedRules(defaults);
      renderRules();
    },
  );
  btnRow.appendChild(defaultBtn);

  parent.appendChild(btnRow);

  renderRules();
};
