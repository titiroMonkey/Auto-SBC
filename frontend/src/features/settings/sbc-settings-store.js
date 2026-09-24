// SBC Settings - Data Layer
// Handles reading/writing solver settings via backend HTTP API (with localStorage fallback).
// Settings are keyed by SBC name and challenge name (not IDs, which expire/change over time).

let SOLVER_SETTINGS_KEY = "sbcSolverSettings";
let cachedSolverSettings;
let _settingsReady = false;
const SETTINGS_API_URL = "http://127.0.0.1:8000/api/settings";

const getDefaultPackAnimationFilterRule = () => ({
  filters: ["rating"],
  ratingRange: [86, 99],
  priceRange: [200, 15000000],
  includeLeagues: [],
  excludeLeagues: [],
  includeTeams: [],
  excludeTeams: [],
  includeNations: [],
  excludeNations: [],
  includeRarity: [],
  excludeRarity: [],
});

const normalizePackAnimationFilterRule = (value) => {
  const defaults = getDefaultPackAnimationFilterRule();

  if (value && typeof value === "object" && !Array.isArray(value)) {
    return {
      ...defaults,
      ...value,
      filters: Array.isArray(value.filters) ? value.filters : defaults.filters,
      ratingRange:
        Array.isArray(value.ratingRange) && value.ratingRange.length === 2
          ? value.ratingRange
          : defaults.ratingRange,
      priceRange:
        Array.isArray(value.priceRange) && value.priceRange.length === 2
          ? value.priceRange
          : defaults.priceRange,
      includeLeagues: Array.isArray(value.includeLeagues)
        ? value.includeLeagues
        : defaults.includeLeagues,
      excludeLeagues: Array.isArray(value.excludeLeagues)
        ? value.excludeLeagues
        : defaults.excludeLeagues,
      includeTeams: Array.isArray(value.includeTeams)
        ? value.includeTeams
        : defaults.includeTeams,
      excludeTeams: Array.isArray(value.excludeTeams)
        ? value.excludeTeams
        : defaults.excludeTeams,
      includeNations: Array.isArray(value.includeNations)
        ? value.includeNations
        : defaults.includeNations,
      excludeNations: Array.isArray(value.excludeNations)
        ? value.excludeNations
        : defaults.excludeNations,
      includeRarity: Array.isArray(value.includeRarity)
        ? value.includeRarity
        : defaults.includeRarity,
      excludeRarity: Array.isArray(value.excludeRarity)
        ? value.excludeRarity
        : defaults.excludeRarity,
    };
  }

  return defaults;
};

// Name-based caching for current SBC/challenge context
let _currentSbcName = null;
let _currentChallengeName = null;

// --- Backend API helpers ---------------------------------------------------

const _readSettingsFromBackend = async () => {
  try {
    const response = await fetch(SETTINGS_API_URL);
    if (!response.ok) {
      console.warn("[SBC] Backend returned non-OK status:", response.status);
      return null;
    }
    return await response.json();
  } catch (err) {
    console.error("[SBC] Failed to read settings from backend:", err);
    return null;
  }
};

const _writeSettingsToBackend = async (settings) => {
  try {
    const response = await fetch(SETTINGS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (!response.ok) {
      console.error("[SBC] Backend returned non-OK status on write:", response.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[SBC] Failed to write settings to backend:", err);
    return false;
  }
};

// Bootstrap: load from backend, migrate from localStorage if needed
(async () => {
  try {
    let data = await _readSettingsFromBackend();
    if (!data || Object.keys(data).length === 0) {
      // No settings on backend – migrate from localStorage if available
      const raw = localStorage.getItem(SOLVER_SETTINGS_KEY);
      if (raw) {
        try {
          data = JSON.parse(raw);
          await _writeSettingsToBackend(data);
          console.log("[SBC] Migrated solver settings from localStorage to backend");
        } catch (parseErr) {
          console.error("[SBC] Failed to parse localStorage settings:", parseErr);
          data = null;
        }
      }
    }
    if (data) {
      cachedSolverSettings = data;
      // Also keep localStorage in sync as a fallback
      localStorage.setItem(SOLVER_SETTINGS_KEY, JSON.stringify(data));
    }
  } catch (err) {
    console.error("[SBC] Settings bootstrap error:", err);
  } finally {
    // Run migrations after load
    initDefaultSettings();
    _settingsReady = true;
  }
})();

// --- Public API (synchronous cache + async backend persist) ------------------

let setSolverSettings = function (key, Settings) {
  let SolverSettings = getSolverSettings();
  SolverSettings[key] = Settings;
  cachedSolverSettings = SolverSettings;
  // Also keep localStorage in sync
  localStorage.setItem(SOLVER_SETTINGS_KEY, JSON.stringify(cachedSolverSettings));
  // Persist to backend asynchronously (fire and forget with error logging)
  _writeSettingsToBackend(cachedSolverSettings).catch((err) => {
    console.error("[SBC] Failed to persist settings to backend:", err);
  });
};

let getSolverSettings = function () {
  if (cachedSolverSettings) {
    return cachedSolverSettings;
  }
  cachedSolverSettings = {};
  // Fallback: read from localStorage if cache is empty
  let SolverSettings = localStorage.getItem(SOLVER_SETTINGS_KEY);
  if (SolverSettings) {
    try {
      cachedSolverSettings = JSON.parse(SolverSettings);
    } catch {
      cachedSolverSettings = {};
    }
  }
  return cachedSolverSettings;
};

// Set current context for name-based lookups
const setCurrentSbcContext = (sbcName, challengeName) => {
  _currentSbcName = sbcName;
  _currentChallengeName = challengeName;
};

// Normalize to name-based keys, with fallback to global
const _normalizeKey = (sbc, challenge) => {
  // Global settings (0, 0) - use "global" prefix
  if (sbc === 0 || sbc === "0" || sbc === null || sbc === undefined) {
    return { sbcKey: "global", challengeKey: "global" };
  }
  
  // Use provided name if it's a string (not numeric)
  // If numeric, use current context name or don't save (to avoid ID pollution)
  let sbcKey = sbc;
  let challengeKey = challenge;
  
  // If sbcKey looks numeric, try to use current context
  if (typeof sbcKey === "number" || (typeof sbcKey === "string" && /^\d+$/.test(sbcKey))) {
    sbcKey = _currentSbcName || null;
  }
  
  // If challengeKey looks numeric, try to use current context
  if (typeof challengeKey === "number" || (typeof challengeKey === "string" && /^\d+$/.test(challengeKey))) {
    challengeKey = _currentChallengeName || "global";
  }
  
  // If no sbcKey, fallback to global (but log warning)
  if (!sbcKey) {
    console.warn("[SBC] saveSettings called with numeric ID but no SBC name context set. Using global.");
    sbcKey = "global";
  }
  
  return { sbcKey, challengeKey };
};

const saveSettings = (sbc, challenge, id, value) => {
  let settings = getSolverSettings();
  settings["sbcSettings"] ??= {};
  let sbcSettings = settings["sbcSettings"];
  
  const { sbcKey, challengeKey } = _normalizeKey(sbc, challenge);
  const numericSbcValue =
    typeof sbc === "number"
      ? sbc
      : typeof sbc === "string" && sbc.trim() !== ""
        ? Number(sbc)
        : NaN;
  const isNumericSbcInput =
    typeof sbc === "number" ||
    (typeof sbc === "string" && /^\d+$/.test(sbc.trim()));
  const isExplicitGlobalInput =
    sbc === "global" ||
    challenge === "global" ||
    sbc == null ||
    (Number.isFinite(numericSbcValue) && numericSbcValue === 0);
  
  // Don't save if we had to default to global due to missing context
  // (this prevents polluting settings with orphaned numeric ID entries)
  if (sbcKey === "global" && isNumericSbcInput && !isExplicitGlobalInput) {
    console.warn(`[SBC] Skipping save to numeric ID ${sbc}/${challenge} - waiting for SBC name context`);
    return;
  }
  
  sbcSettings[sbcKey] ??= {};
  sbcSettings[sbcKey][challengeKey] ??= {};
  sbcSettings[sbcKey][challengeKey][id] = value;
  setSolverSettings("sbcSettings", sbcSettings);
};

const getSettings = (sbc, challenge, id) => {
  let settings = getSolverSettings();
  const { sbcKey, challengeKey } = _normalizeKey(sbc, challenge);
  
  // Try: exact match (by name/global) -> SBC-level settings -> global
  // Skip any numeric ID-based keys (sbc_\d+ or challenge_\d+)
  let returnValue =
    settings["sbcSettings"]?.[sbcKey]?.[challengeKey]?.[id] ??
    settings["sbcSettings"]?.[sbcKey]?.["global"]?.[id] ??
    settings["sbcSettings"]?.["global"]?.["global"]?.[id] ??
    defaultSBCSolverSettings[id];

  return returnValue;
};

const defaultSBCSolverSettings = {
  apiUrl: "http://127.0.0.1:8000",
  excludeTeams: [],
  excludeRarity: [],
  excludeNations: [],
  excludeLeagues: [],
  excludePlayers: [],
  excludeSbc: false,
  excludeTradable: false,
  excludeSpecial: false,
  excludeObjective: false,
  excludeEvolutions: true,
  excludeExtinct: false,
  excludeFromSquadIds: [],
  onlyStorage: false,
  useConcepts: false,
  collectConcepts: false,
  animateWalkoutItems: getDefaultPackAnimationFilterRule(),
  playSounds: true,
  showAutoBuyButton: true,
  autoBuyCurrency: "COINS",
  autoSubmit: 0,
  maxSolveTime: 60,
  priceCacheMinutes: 1440,
  ratingRange: [0, 99],
  repeatCount: 0,
  showPrices: true,
  showRecentPackedSpecials: true,
  showSbcSubmitTracker: true,
  showSbcTab: true,
  showQuickSolutionButtonOnSbcScreen: true,
  showQuickBuyButtonOnSbcScreen: true,
  useDupes: true,
  runInBackground: false,
  autoOpenPacks: false,
  autoOpenSub100CoinPacks: false,
  autoGrindOpenAllPacks: true,
  autoGrindSubmitMode: 4,
  autoApplyQuickSolutionOnOpen: false,
  lockMinOnePlayerRequirements: true,
  saveTotw: false,
  sbcType: "Favourites",
  showLogOverlay: false,
  duplicateDiscount: 50,
  untradeableDiscount: 80,
  conceptPremium: 10,
  evoPremium: 2,
  ratingUI: false,
  replaceStoragePlayers: false,
  loginSbcOrder: [],
  conceptResetHour: 7,
  maxPlayerPrice: 0,
};

const migrateMaxRatingSettings = () => {
  const settings = getSolverSettings();
  const sbcSettings = settings?.sbcSettings;

  if (!sbcSettings) {
    return;
  }

  let needsSave = false;
  const newSettings = {};

  // Migrate from old ID-based keys to name-based keys
  Object.entries(sbcSettings).forEach(([sbcKey, challenges]) => {
    if (!challenges || typeof challenges !== "object") {
      // Copy non-object entries as-is (like "global", "sbcSettings" parent)
      newSettings[sbcKey] = challenges;
      return;
    }

    // Check if this looks like an old ID key (numeric prefix like sbc_1035)
    const isOldIdFormat = /^sbc_\d+$|^challenge_\d+$/.test(sbcKey);
    
    if (isOldIdFormat) {
      console.log(`[SBC] Removing orphaned ID-based settings key: ${sbcKey}`);
      needsSave = true;
      // Skip this key entirely - don't copy it to newSettings
      return;
    }

    // Keep non-numeric keys
    if (!newSettings[sbcKey]) {
      newSettings[sbcKey] = {};
    }

    Object.entries(challenges).forEach(([challengeKey, config]) => {
      if (!config || typeof config !== "object") {
        return;
      }

      // Handle maxRating migration (legacy field)
      if ("maxRating" in config) {
        const maxRating = Number(config.maxRating);
        if (Number.isFinite(maxRating)) {
          const currentRange = Array.isArray(config.ratingRange)
            ? [...config.ratingRange]
            : [0, 99];

          currentRange[1] = maxRating;
          config.ratingRange = currentRange;
          needsSave = true;
        }

        delete config.maxRating;
        needsSave = true;
      }

      // Only keep challenge keys that aren't numeric
      if (!/^challenge_\d+$/.test(challengeKey)) {
        if (!newSettings[sbcKey][challengeKey]) {
          newSettings[sbcKey][challengeKey] = {};
        }
        Object.assign(newSettings[sbcKey][challengeKey], config);
      } else {
        needsSave = true; // Mark as changed if we're dropping numeric challenge keys
      }
    });
  });

  if (needsSave) {
    console.log("[SBC] Cleaned up orphaned ID-based settings keys");
    cachedSolverSettings.sbcSettings = newSettings;
    setSolverSettings("sbcSettings", newSettings);
  }
};

const migrateLoginSbcOrderFromSbcOnLogin = () => {
  const settings = getSolverSettings();
  const sbcSettings = settings?.sbcSettings;

  if (!sbcSettings || typeof sbcSettings !== "object") {
    return;
  }

  const globalSettings = sbcSettings?.global?.global || {};
  const existingOrder = Array.isArray(globalSettings.loginSbcOrder)
    ? globalSettings.loginSbcOrder.map((entry) => String(entry).trim()).filter(Boolean)
    : [];

  const existingOrderSet = new Set(existingOrder.map((entry) => entry.toLowerCase()));
  const loginEnabledSbcNames = [];

  Object.entries(sbcSettings).forEach(([sbcName, challengeMap]) => {
    if (sbcName === "global" || !challengeMap || typeof challengeMap !== "object") {
      return;
    }

    const hasLoginEnabled = Object.values(challengeMap).some(
      (config) => config && typeof config === "object" && config.sbcOnLogin === true,
    );

    if (hasLoginEnabled) {
      loginEnabledSbcNames.push(sbcName);
    }
  });

  const missingNames = loginEnabledSbcNames.filter(
    (name) => !existingOrderSet.has(String(name).toLowerCase()),
  );

  if (missingNames.length === 0) {
    return;
  }

  const nextOrder = [...existingOrder, ...missingNames];
  sbcSettings.global ??= {};
  sbcSettings.global.global ??= {};
  sbcSettings.global.global.loginSbcOrder = nextOrder;
  cachedSolverSettings.sbcSettings = sbcSettings;
  setSolverSettings("sbcSettings", sbcSettings);
  console.log("[SBC] Added missing login SBCs to loginSbcOrder", missingNames);
};

let initDefaultSettings = () => {
  migrateMaxRatingSettings();
  migrateLoginSbcOrderFromSbcOnLogin();
};
