const searchConceptByDefId = async (defId, options = {}) => {
  const numericDefId = Number(defId);
  if (!Number.isFinite(numericDefId) || numericDefId <= 0) {
    throw new Error("searchConceptByDefId requires a valid numeric defId");
  }

  if (
    !services?.Item?.searchConceptItems ||
    typeof UTSearchCriteriaDTO === "undefined"
  ) {
    throw new Error("Concept search service is not available in this context");
  }

  const maxItems = Math.max(1, Number(options.maxItems) || 250);
  const pageSize = Math.min(Math.max(Number(options.count) || 50, 1), 200);
  const controller =
    options.controller || getControllerInstance?.() || globalThis;

  const dto = new UTSearchCriteriaDTO();
  dto.offset = 0;
  dto.count = pageSize;
  dto.defId = [numericDefId];
  if (typeof SearchType !== "undefined") {
    dto.type = SearchType.PLAYER;
  }

  const gathered = [];

  const step = () =>
    new Promise((resolve) => {
      services.Item.searchConceptItems(dto).observe(
        controller,
        function (sender, response) {
          try {
            sender?.unobserve?.(controller);
          } catch {}

          if (response?.status === 400) {
            resolve({ done: true, items: [] });
            return;
          }

          const items = Array.isArray(response?.response?.items)
            ? response.response.items
            : [];
          const end = !!response?.response?.endOfList;
          resolve({ done: end, items });
        },
      );
    });

  while (gathered.length < maxItems) {
    const { done, items } = await step();
    if (items.length) {
      gathered.push(...items);
    }
    if (done || !items.length) {
      break;
    }
    dto.offset += dto.count;
  }

  const sliced = gathered.slice(0, maxItems);
  console.log("[Auto-SBC] searchConceptByDefId", {
    defId: numericDefId,
    count: sliced.length,
  });
  return sliced;
};

try {
  globalThis.searchConceptByDefId = searchConceptByDefId;
} catch {}

const getClubRepoCollection = () =>
  services?.Item?.itemDao?.itemRepo?.club?.items?._collection || null;

const snapshotClubRepo = () => {
  const collection = getClubRepoCollection();
  if (!collection || typeof collection !== "object") {
    return {
      ts: Date.now(),
      count: 0,
      keys: [],
      map: new Map(),
    };
  }

  const keys = Object.keys(collection).filter((key) => key !== "undefined");
  const map = new Map(keys.map((key) => [String(key), collection[key]]));

  return {
    ts: Date.now(),
    count: keys.length,
    keys,
    map,
  };
};

const checkClubRepoUpdate = (previousSnapshot = null) => {
  const prev = previousSnapshot || globalThis.__autoSbcClubRepoSnapshot || null;
  const next = snapshotClubRepo();

  if (!prev) {
    globalThis.__autoSbcClubRepoSnapshot = next;
    return {
      changed: false,
      initial: true,
      count: next.count,
      added: [],
      removed: [],
      changedEntries: [],
      snapshot: next,
    };
  }

  const prevKeys = new Set((prev.keys || []).map(String));
  const nextKeys = new Set((next.keys || []).map(String));

  const added = [];
  const removed = [];
  const changedEntries = [];

  for (const key of nextKeys) {
    if (!prevKeys.has(key)) {
      added.push(key);
      continue;
    }

    const prevValue = prev.map?.get?.(key);
    const nextValue = next.map?.get?.(key);
    if (prevValue !== nextValue) {
      changedEntries.push(key);
    }
  }

  for (const key of prevKeys) {
    if (!nextKeys.has(key)) {
      removed.push(key);
    }
  }

  const changed =
    added.length > 0 || removed.length > 0 || changedEntries.length > 0;

  const diff = {
    changed,
    initial: false,
    count: next.count,
    previousCount: prev.count || 0,
    added,
    removed,
    changedEntries,
    snapshot: next,
  };

  globalThis.__autoSbcClubRepoSnapshot = next;
  return diff;
};

const startClubRepoWatcher = (intervalMs = 1000, options = {}) => {
  const pollMs = Math.max(100, Number(intervalMs) || 1000);
  const { logUnchanged = false } = options || {};

  stopClubRepoWatcher();

  globalThis.__autoSbcClubRepoSnapshot = snapshotClubRepo();
  const timerId = setInterval(() => {
    try {
      const diff = checkClubRepoUpdate();
      if (diff.initial) return;

      if (diff.changed || logUnchanged) {
        console.log("[Auto-SBC][clubRepoWatcher]", {
          changed: diff.changed,
          previousCount: diff.previousCount,
          count: diff.count,
          addedCount: diff.added.length,
          removedCount: diff.removed.length,
          changedEntriesCount: diff.changedEntries.length,
          added: diff.added,
          removed: diff.removed,
          changedEntries: diff.changedEntries,
        });
      }
    } catch (error) {
      console.warn("[Auto-SBC][clubRepoWatcher] poll failed", error);
    }
  }, pollMs);

  globalThis.__autoSbcClubRepoWatcherId = timerId;
  return timerId;
};

const stopClubRepoWatcher = () => {
  const watcherId = globalThis.__autoSbcClubRepoWatcherId;
  if (watcherId) {
    clearInterval(watcherId);
    globalThis.__autoSbcClubRepoWatcherId = null;
  }
};

try {
  globalThis.getClubRepoCollection = getClubRepoCollection;
  globalThis.snapshotClubRepo = snapshotClubRepo;
  globalThis.checkClubRepoUpdate = checkClubRepoUpdate;
  globalThis.startClubRepoWatcher = startClubRepoWatcher;
  globalThis.stopClubRepoWatcher = stopClubRepoWatcher;
} catch {}

const quickSellTradableFodderUnderRating = async (
  maxRating = 82,
  options = {},
) => {
  const ratingLimit = Number(maxRating);
  if (!Number.isFinite(ratingLimit) || ratingLimit < 0) {
    throw new Error("quickSellTradableFodderUnderRating requires a valid max rating");
  }

  if (!services?.Item?.discard) {
    throw new Error("Item discard service is not available in this context");
  }

  const opts = options || {};
  const dryRun = !!opts.dryRun;
  const ownersOnly = opts.ownersOnly !== false;
  const includeLocked = !!opts.includeLocked;

  let players = [];
  if (typeof fetchPlayers === "function") {
    players = await fetchPlayers({ showProgress: false });
  } else if (typeof fetchClub === "function") {
    players = await fetchClub({
      type: typeof SearchType !== "undefined" ? SearchType.PLAYER : undefined,
      showProgress: false,
    });
  } else {
    throw new Error("No club player fetch function is available");
  }

  const isTradable = (item) =>
    item?.tradable === true ||
    (typeof item?.isTradeable === "function" && item.isTradeable());

  const candidates = (players || []).filter((item) => {
    if (!item) return false;
    if (typeof item?.isPlayer === "function" && !item.isPlayer()) {
      return false;
    }

    const rating = Number(item?.rating ?? item?._staticData?.rating ?? 0);
    if (!Number.isFinite(rating) || rating > ratingLimit) return false;

    if (!isTradable(item)) return false;
    if (ownersOnly && Number(item?.owners ?? 1) !== 1) return false;

    if (!includeLocked) {
      if (typeof isItemLocked === "function" && isItemLocked(item)) return false;
      if (typeof isItemFixed === "function" && isItemFixed(item)) return false;
    }

    if (typeof isFodder === "function") {
      return !!isFodder(item);
    }

    return false;
  });

  const totalDiscardValue = candidates.reduce((sum, item) => {
    const value = Number(item?.discardValue);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);

  const summary = {
    maxRating: ratingLimit,
    totalPlayersScanned: Array.isArray(players) ? players.length : 0,
    candidateCount: candidates.length,
    totalDiscardValue,
    dryRun,
  };

  if (!candidates.length) {
    console.log("[Auto-SBC] quickSellTradableFodderUnderRating: no matches", summary);
    if (typeof showNotification === "function") {
      showNotification("No tradable fodder matched the rating limit", UINotificationType.NEUTRAL);
    }
    return summary;
  }

  let discardResult = null;
  if (!dryRun) {
    const discardPromise = services.Item.discard(candidates);
    console.log("[quickSell-observer] Discard called, waiting for result...", {
      candidateCount: candidates.length,
      hasPromise: !!discardPromise,
    });

    try {
      // Try to observe/await the discard result
      if (discardPromise && typeof discardPromise.then === "function") {
        discardResult = await discardPromise;
        console.log("[quickSell-observer] Discard completed successfully", {
          result: discardResult,
          candidateCount: candidates.length,
        });
      } else if (discardPromise && typeof discardPromise.subscribe === "function") {
        // Handle Observable case
        await new Promise((resolve, reject) => {
          const subscription = discardPromise.subscribe(
            (res) => {
              discardResult = res;
              console.log("[quickSell-observer] Discard observable completed", {
                result: res,
                candidateCount: candidates.length,
              });
              subscription.unsubscribe();
              resolve(res);
            },
            (err) => {
              console.error("[quickSell-observer] Discard observable error", err);
              subscription.unsubscribe();
              reject(err);
            },
          );
        });
      } else {
        console.log("[quickSell-observer] Discard returned non-Promise/Observable", {
          resultType: typeof discardResult,
        });
      }
    } catch (err) {
      console.error("[quickSell-observer] Error during discard execution", err);
    }
  }

  console.log("[Auto-SBC] quickSellTradableFodderUnderRating", {
    totalDiscardValue,
    ...summary,
    soldCount: dryRun ? 0 : candidates.length,
    discardObserved: !!discardResult,
    sample: candidates.slice(0, 10).map((item) => ({
      id: item?.id,
      rating: item?.rating,
      name: item?.itemData?.name || item?._staticData?.name || "Unknown",
      price: typeof getPrice === "function" ? getPrice(item) : null,
    })),
  });

  if (typeof showNotification === "function") {
    if (dryRun) {
      showNotification(
        `Dry run found ${candidates.length} tradable fodder players`,
        UINotificationType.NEUTRAL,
      );
    } else {
      showNotification(
        `Quick sold ${candidates.length} tradable fodder players for ${totalDiscardValue.toLocaleString()} coins`,
        UINotificationType.POSITIVE,
      );
    }
  }

  return {
    ...summary,
    soldCount: dryRun ? 0 : candidates.length,
    totalDiscardValue,
    itemIds: candidates.map((item) => item?.id).filter((id) => id != null),
  };
};

try {
  globalThis.quickSellTradableFodderUnderRating =
    quickSellTradableFodderUnderRating;
  globalThis.autoSbcConsoleApi = {
    ...(globalThis.autoSbcConsoleApi || {}),
    quickSellTradableFodderUnderRating,
  };
} catch {}

const exposeFrontendFunctionsToConsole = () => {
  const functionNames = [
    "getClubRepoCollection",
    "snapshotClubRepo",
    "checkClubRepoUpdate",
    "startClubRepoWatcher",
    "stopClubRepoWatcher",
    "getElement",
    "css",
    "addClass",
    "removeClass",
    "getElementString",
    "createElem",
    "getRootElement",
    "insertBefore",
    "insertAfter",
    "createButton",
    "ensureFallbackInitProgressBar",
    "ensureInitProgressBar",
    "setInitProgress",
    "ensureInitProgressVisibleForStep",
    "completeInitProgress",
    "resetPatchFlags",
    "getProto",
    "init",
    "createPseudoContentSync",
    "normalizeContent",
    "splitSelectors",
    "findContentForSelector",
    "matches",
    "walkRules",
    "syncBadgeContent",
    "GM_xmlhttpRequest",
    "GM_getResourceText",
    "wait",
    "unique",
    "isAnyOrPlayer",
    "fetchClubInner",
    "searchClub",
    "fetchClub",
    "forceFreshFetchPlayersFromClub",
    "dirtyClubCache",
    "refreshClubPlayers",
    "getConceptResetHour",
    "buildPlayerDetails",
    "buildPlayerDetailsList",
    "shouldIncludePlayerDetail",
    "createProgressBar",
    "removeProgressBar",
    "updateProgressBar",
    "updateTotal",
    "getAllConceptPlayers",
    "searchConceptPlayers",
    "searchConceptByDefId",
    "getAllStoragePlayers",
    "searchStoragePlayers",
    "addSbcInfo",
    "showLoader",
    "hideLoader",
    "getCurrentViewController",
    "getControllerInstance",
    "fetchSBCData",
    "futAutoGrind",
    "log",
    "safe",
    "ratingCountUI",
    "computeMaxRating",
    "countByRating",
    "parseKey",
    "ensureDragHandlers",
    "clampPosition",
    "onMouseDown",
    "onMouseMove",
    "onMouseUp",
    "applySavedPosition",
    "applySavedSize",
    "saveCurrentSize",
    "ensureResizeObserver",
    "ensureResizePersistenceHandlers",
    "flush",
    "isItemLocked",
    "lockItem",
    "unlockItem",
    "getLockedItems",
    "lockedItemsCleanup",
    "saveLockedItems",
    "isItemFixed",
    "fixItem",
    "unfixItem",
    "getFixedItems",
    "fixedItemsCleanup",
    "saveFixedItems",
    "showNotification",
    "goToPacks",
    "goToUnassignedView",
    "openView",
    "getPacks",
    "unassignedItemsOverride",
    "getSBCPrice",
    "buildSolutionSquadFromResults",
    "reloadSbcScreen",
    "keepSolveLoaderVisible",
    "applyInterimSolverSolutionFromLog",
    "solveSBC",
    "isConceptWithinBuyMax",
    "logState",
    "cancelActiveSolveRun",
    "isSolveRunActive",
    "throwIfSolveRunCancelled",
    "pad",
    "countDown",
    "fetchUnassigned",
    "fetchTransferList",
    "fetchDuplicateIds",
    "getUnassignedActionGroups",
    "getUnassignedActionLabels",
    "getUnassignedActionOrder",
    "groupUnassignedItemsByRules",
    "addEntry",
    "unassignedPreviewOverride",
    "processUnassigned",
    "getItemRarityIdSafe",
    "getItemNameSafe",
    "addProcessedLog",
    "ensureLivePrices",
    "summarizeItems",
    "isTradable",
    "addProcessedEntries",
    "executeBucket",
    "quickListItems",
    "notify",
    "clamp",
    "randomDelay",
    "refreshUnassignedPrices",
    "withTimeout",
    "sbcFavoriteTagOverride",
    "createNavButton",
    "createHoverNav",
    "createDiv",
    "packVisibilityStore",
    "createPackList",
    "createCategoryPicker",
    "createSBCButtons",
    "createSBCHover",
    "createSBCTab",
    "readPackPurchaseCount",
    "updateCount",
    "randDelay",
    "futHomeOverride",
    "processNextSbc",
    "getPersistedState",
    "setPersistedState",
    "ensureDefaults",
    "getStateFromCriteria",
    "applyStateToCriteria",
    "persistCriteriaState",
    "restoreCriteriaState",
    "isPlayerItem",
    "isConceptLike",
    "getItemPriceSafe",
    "applyTransformsToFullList",
    "dedupeById",
    "dedupePlayersByDefinitionPreferClub",
    "makeConceptFetchPromise",
    "step",
    "injectUI",
    "safeAdd",
    "syncUIFromCriteria",
    "setAndRender",
    "doAsyncRefine",
    "purchasePackByIdWithCoins",
    "readCounts",
    "incrementCount",
    "buyBronzePacksUntilLimit",
    "buyBronzePack",
    "getTransferItems",
    "getCoinsBalance",
    "packItemOverride",
    "packOverRide",
    "updateVisibilityClass",
    "initVisibility",
    "playerItemOverride",
    "getPriceDiv",
    "updateCBRMinPrice",
    "upsert",
    "listLowestPricePlayersByRating",
    "quickSellTradableFodderUnderRating",
    "nameOf",
    "convertAbbreviatedNumber",
    "fetchLowestPriceByRating",
    "fetchSingleCheapest",
    "fetchLivePlayerPrice",
    "registerCandidate",
    "persistLivePrice",
    "finishSuccess",
    "finishExtinct",
    "getIncrement",
    "alignDown",
    "alignUp",
    "ensurePlayerFilter",
    "getBaseCriteria",
    "buildCriteria",
    "stepDown",
    "stepUp",
    "doSearch",
    "extractBuy",
    "evaluate",
    "refineBetween",
    "ensureResults",
    "fetchPlayerPrices",
    "openPick",
    "openPack",
    "safeResolve",
    "safeReject",
    "showPack",
    "getFromIndexedDB",
    "saveToIndexedDB",
    "makeGetRequest",
    "makePostRequest",
    "downloadAllAssets",
    "isPriceOld",
    "getPrice",
    "PriceItem",
    "getPriceItems",
    "isFodder",
    "savePriceItems",
    "playerSlotOverride",
    "appendSlotPrice",
    "appendSquadTotal",
    "appendPriceToSlot",
    "getUserPlatform",
    "popupOverride",
    "sbcButtonOverride",
    "ensureStatusContainer",
    "ensureUnassignedHistoryContainer",
    "savePosition",
    "saveSize",
    "nextDirection",
    "getUnassignedHistoryState",
    "saveUnassignedHistoryEntries",
    "applyUnassignedSorts",
    "updateUnassignedHeaderIndicators",
    "appendUnassignedHistoryRows",
    "formatName",
    "formatPrice",
    "getAssetId",
    "isTradableItem",
    "tryQuickBuy",
    "quickListItem",
    "getOneTierBelow",
    "sbcSubmitChallengeOverride",
    "sbcViewOverride",
    "hasPlayersInCurrentSquad",
    "autoApplyQuickSolutionOnPageOpen",
    "toSlug",
    "toBaseDefinitionId",
    "searchConceptsByDefinitionIds",
    "pickPlayerByDefinitionId",
    "runQuickBuySquad",
    "sleep",
    "runCountdown",
    "formatPlayerName",
    "getCurrentConceptItems",
    "fetchNewPlayersFromFutgg",
    "createUtItemFromCache",
    "createutitemfromcache",
    "diffConceptEntity",
    "sideBarNavOverride",
    "generateSbcSolveTab",
    "setVisibility",
    "normalizeUnassignedRule",
    "getUnassignedRules",
    "setUnassignedRules",
    "isUnassignedGroupingEnabled",
    "getItemLeagueId",
    "getItemNationId",
    "getItemTeamId",
    "getItemRarityId",
    "getRarityLabelById",
    "getItemRarityLabel",
    "matchesTriState",
    "matchesUnassignedRule",
    "matchesUnassignedGroup",
    "createChoiceLocal",
    "createUnassignedRulesPanel",
    "buildOptions",
    "renderRules",
    "updateRule",
    "addControl",
    "createSBCCustomRulesPanel",
    "getShellUri",
    "saveSettings",
    "getSettings",
    "createStopOverlayButton",
    "createLogOverlayToggle",
    "updateLogOverlay",
    "pollSolverLogs",
    "getUnifiedUIContainer",
    "registerUnifiedUIPanel",
    "unregisterUnifiedUIPanel",
    "showUnifiedUIPanel",
    "hideUnifiedUIPanel",
    "updateUnifiedUIPanelOrder",
    "hasUnifiedUIPanels",
    "clearAllUnifiedUIPanels",
    "migrateMaxRatingSettings",
    "initDefaultSettings",
    "createPanel",
    "createTooltip",
    "createDoubleRangeControl",
    "createNumberSpinner",
    "createChoice",
    "createDropDown",
    "createToggle",
    "createSettingsTile",
    "destroyGeneratedElements",
    "_setActiveSettingsTab",
    "Counter",
    "findSBCLogin",
    "recursiveSearch",
    "setSolverSettings",
    "getSolverSettings",
    "sbcSettingsController",
    "sbcSettingsView",
    "pe",
    "s",
    "h",
    "n",
    "o",
    "t",
    "e",
    "i",
    "ne",
    "se",
    "oe",
    "re",
    "ce",
    "ae",
    "he",
    "le",
    "ue",
    "de",
    "ve",
    "_e",
    "ye",
    "we",
    "Ie",
    "xe",
    "Me",
    "Re",
    "$e",
    "qe",
    "We",
    "r",
  ];

  const resolved = {};
  for (const name of functionNames) {
    try {
      const maybeFromGlobal = globalThis[name];
      const reference =
        typeof maybeFromGlobal === "function"
          ? maybeFromGlobal
          : (0, eval)(name);
      if (typeof reference === "function") {
        resolved[name] = reference;
        globalThis[name] = reference;
      }
    } catch {}
  }

  globalThis.autoSbcConsoleApi = {
    ...(globalThis.autoSbcConsoleApi || {}),
    ...resolved,
  };

  globalThis.exposeFrontendFunctionsToConsole =
    exposeFrontendFunctionsToConsole;
  globalThis.listFrontendConsoleFunctions = () =>
    Object.keys(globalThis.autoSbcConsoleApi || {}).sort();

  console.log(
    `[Auto-SBC] Console API ready (${Object.keys(resolved).length}/${functionNames.length} functions exposed)`,
  );

  return resolved;
};

try {
  globalThis.exposeFrontendFunctionsToConsole =
    exposeFrontendFunctionsToConsole;
  setTimeout(() => {
    exposeFrontendFunctionsToConsole();
  }, 0);

  setTimeout(() => {
    try {
      exposeFrontendFunctionsToConsole();
    } catch {}
  }, 1500);
} catch {}
