let processUnassigned = async (options = {}) => {
  const { force = false, suppressNavigation = false } = options || {};
  window.__autoSbcProcessUnassignedState ??= {
    runningPromise: null,
    lastRunAt: 0,
    lastResult: null,
    cooldownMs: 1500,
  };
  const state = window.__autoSbcProcessUnassignedState;

  if (state.runningPromise) {
    return state.runningPromise;
  }

  if (!force && Date.now() - Number(state.lastRunAt || 0) < state.cooldownMs) {
    return state.lastResult;
  }

  const runPromise = (async () => {
    ratingCountUI();
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const log = () => {};
    const processedLog = [];
    const livePriceFetchedDefinitionIds = new Set();
    const runTimestamp = new Date().toLocaleString();
    const getItemRarityIdSafe = (item) =>
      Number(item?.rareflag ?? item?._staticData?.rareflag ?? item?.rarityId) ||
      null;
    const getItemNameSafe = (item) =>
      item?._staticData?.name ||
      item?._staticData?.lastName ||
      item?.name ||
      item?.definitionId ||
      "Unknown";
    const addProcessedLog = (items, action, ruleNumber, ruleColor = null) => {
      (items || []).forEach((item) => {
        processedLog.push({
          item,
          action,
          ruleNumber,
          timestamp: runTimestamp,
          ruleColor,
        });
      });
    };
    const hasValidPrice = (item) => {
      const price = Number(getPrice(item));
      return Number.isFinite(price) && price > 0;
    };
    const getSortablePrice = (item) => {
      const price = Number(getPrice(item));
      return Number.isFinite(price) ? price : 0;
    };
    const sortItemsByPriceDesc = (items = []) =>
      [...items].sort(
        (a, b) => getSortablePrice(b) - getSortablePrice(a),
      );
    const sortEntriesByPriceDesc = (entries = []) =>
      [...entries].sort(
        (a, b) =>
          getSortablePrice(b?.item) - getSortablePrice(a?.item),
      );
    const ensureLivePrices = async (entries, options = {}) => {
      const { awaitCompletion = true } = options || {};
      const toFetch = (entries || [])
        .map((e) => e?.item)
        .filter(Boolean)
        .filter((item) => Number(item?.definitionId) > 0)
        .filter((item) => !livePriceFetchedDefinitionIds.has(item.definitionId))
        .filter((item) => !hasValidPrice(item));

      if (!toFetch.length) return null;

      log("livePrice:fetch", { count: toFetch.length });
      const refreshPromise = Promise.all(
        toFetch.map(async (item) => {
          try {
            await fetchLivePlayerPrice(item);
            if (Number(item?.definitionId) > 0) {
              livePriceFetchedDefinitionIds.add(item.definitionId);
            }
          } catch (err) {
            void err;
          }
        }),
      );

      if (awaitCompletion) {
        await refreshPromise;
      }

      return refreshPromise;
    };

    const clearSoldItemsBeforeTransferActions = async () => {
      if (typeof clearSoldItems !== "function") {
        return;
      }

      try {
        await clearSoldItems();
      } catch (error) {
        void error;
      }
    };

    const getTransferListCount = async () => {
      await clearSoldItemsBeforeTransferActions();

      try {
        if (typeof getTransferItems === "function") {
          const items = await getTransferItems();
          return Array.isArray(items) ? items.length : 0;
        }
      } catch {}

      try {
        if (typeof fetchTransferList === "function") {
          const items = await fetchTransferList();
          return Array.isArray(items) ? items.length : 0;
        }
      } catch {}

      try {
        if (services?.Item?.requestTransferItems) {
          const items = await new Promise((resolve, reject) => {
            try {
              services.Item.requestTransferItems().observe(
                null,
                (obs, event) => {
                  try {
                    obs?.unobserve?.(null);
                    resolve(
                      Array.isArray(event?.response?.items)
                        ? event.response.items
                        : [],
                    );
                  } catch (err) {
                    reject(err);
                  }
                },
              );
            } catch (err) {
              reject(err);
            }
          });
          return Array.isArray(items) ? items.length : 0;
        }
      } catch {}

      return 0;
    };

    let unsoldTransferRulesProcessed = false;
    const fetchTransferItemsForUnsoldProcessing = async () => {
      try {
        if (typeof getTransferItems === "function") {
          const items = await getTransferItems();
          if (Array.isArray(items)) return items;
        }
      } catch {}

      try {
        if (typeof fetchTransferList === "function") {
          const items = await fetchTransferList();
          if (Array.isArray(items)) return items;
        }
      } catch {}

      try {
        if (services?.Item?.requestTransferItems) {
          const items = await new Promise((resolve, reject) => {
            try {
              services.Item.requestTransferItems().observe(
                null,
                (obs, event) => {
                  try {
                    obs?.unobserve?.(null);
                    resolve(
                      Array.isArray(event?.response?.items)
                        ? event.response.items
                        : [],
                    );
                  } catch (err) {
                    reject(err);
                  }
                },
              );
            } catch (err) {
              reject(err);
            }
          });
          return Array.isArray(items) ? items : [];
        }
      } catch {}

      return [];
    };

    const processUnsoldTransferItemsByRules = async () => {
      if (unsoldTransferRulesProcessed) {
        return;
      }
      unsoldTransferRulesProcessed = true;

      try {
        if (
          typeof getUnassignedRules !== "function" ||
          typeof groupUnassignedItemsByRules !== "function"
        ) {
          return;
        }

        const rules = (getUnassignedRules() || []).filter(
          (rule) => rule?.enabled !== false,
        );
        if (!rules.length) {
          return;
        }

        const transferItems = await fetchTransferItemsForUnsoldProcessing();
        if (!transferItems.length) {
          return;
        }

        const unsoldItems = transferItems.filter((item) => {
          const state = String(
            item?._auction?._tradeState || item?._auction?.tradeState || "",
          ).toLowerCase();
          return state === "expired";
        });

        if (!unsoldItems.length) {
          return;
        }

        const grouping = groupUnassignedItemsByRules(unsoldItems, rules, {
          includeFreeItems: false,
          includeDoNothing: false,
          matcherOptions: { assumeMinPriceWhenMissing: true },
        });

        const isTradable = (item) =>
          item?.tradable === true ||
          (typeof item?.isTradeable === "function" && item.isTradeable());

        const toClub = (grouping.buckets.get("sendToClub") || [])
          .map((entry) => entry?.item)
          .filter((item) => item?.isMovable?.());
        const sortedToClub = sortItemsByPriceDesc(toClub);
        const toTransferList = (
          grouping.buckets.get("sendToTransferList") || []
        )
          .map((entry) => entry?.item)
          .filter((item) => isTradable(item));
        const sortedToTransferList = sortItemsByPriceDesc(toTransferList);
        const toStorageUnsold = (grouping.buckets.get("sendToStorage") || [])
          .map((entry) => entry?.item)
          .filter((item) => item?.isStorable?.());
        let sortedToStorage = sortItemsByPriceDesc(toStorageUnsold);

        if (getSettings(0, 0, "replaceStoragePlayers") && sortedToStorage.length) {
          const unsoldStorageSnapshot = await getStoragePlayers();
          const combined = [
            ...(unsoldStorageSnapshot || []).map((item) => ({ item, source: "storage" })),
            ...sortedToStorage.map((item) => ({ item, source: "new" })),
          ].sort((a, b) => {
            const priceDiff = getSortablePrice(b.item) - getSortablePrice(a.item);
            if (priceDiff !== 0) return priceDiff;
            return (b.item?.rating ?? 0) - (a.item?.rating ?? 0);
          });
          const keep = combined.slice(0, 100);
          const discard = combined.slice(100);
          const discardFromStorage = discard.filter((e) => e.source === "storage").map((e) => e.item);
          const discardNew = discard.filter((e) => e.source === "new").map((e) => e.item);
          sortedToStorage = keep.filter((e) => e.source === "new").map((e) => e.item);
          if (discardFromStorage.length) {
            services.Item.discard(discardFromStorage);
          }
          if (discardNew.length) {
            services.Item.discard(discardNew);
          }
          if (discardFromStorage.length && sortedToStorage.length) {
            await new Promise((r) => setTimeout(r, 2000));
          }
        }

        const toQuickSell = (grouping.buckets.get("quickSell") || [])
          .map((entry) => entry?.item)
          .filter(Boolean);
        const sortedToQuickSell = sortItemsByPriceDesc(toQuickSell);
        const toList = (grouping.buckets.get("listOnTransferMarket") || [])
          .map((entry) => entry?.item)
          .filter((item) => isTradable(item));
        const sortedToList = sortItemsByPriceDesc(toList);

        if (sortedToClub.length) {
          services.Item.move(sortedToClub, 7);
        }
        if (sortedToTransferList.length) {
          services.Item.move(sortedToTransferList, 5);
        }
        if (sortedToStorage.length) {
          services.Item.move(sortedToStorage, 10);
        }
        if (sortedToQuickSell.length) {
          services.Item.discard(sortedToQuickSell);
        }
        if (sortedToList.length) {
          await quickListItems(sortedToList, {
            suppressNotifications: true,
            minDelayMs: 1000,
            maxDelayMs: 1000,
          });
        }

        log("transferUnsold:processedByRules", {
          unsold: unsoldItems.length,
          sendToClub: toClub.length,
          sendToTransferList: toTransferList.length,
          sendToStorage: sortedToStorage.length,
          quickSell: toQuickSell.length,
          listOnTransferMarket: toList.length,
        });
      } catch (error) {
        void error;
      }
    };

    try {
      log("start");

      let storage = await getStoragePlayers();
      let ulist = await fetchUnassigned();
      let players = await fetchPlayers();

      log("fetched", {
        storageCount: storage?.length ?? 0,
        unassignedCount: ulist?.length ?? 0,
        clubCount: players?.length ?? 0,
      });

      if (!ulist || ulist.length === 0) {
        log("skip", { reason: "no-unassigned" });
        return;
      }

      const freeItems = (ulist || []).filter(
        (item) => item?.isFreeCoins?.() || item?.isFreePack?.(),
      );
      log("freeItems", { count: freeItems.length });
      freeItems.forEach((item) => services.Item.redeem(item));

      const tradableNonFodder = (ulist || [])
        .filter((item) => !item?.isFreeCoins?.() && !item?.isFreePack?.())
        .filter(
          (item) =>
            item?.tradable === true ||
            (typeof item?.isTradeable === "function" && item.isTradeable()),
        )
        .filter((item) => !isFodder(item));

      if (tradableNonFodder.length) {
        log("preRulePriceRefresh", { count: tradableNonFodder.length });
        void ensureLivePrices(
          tradableNonFodder.map((item) => ({ item })),
          {
            awaitCompletion: false,
          },
        );
      }

      if (isUnassignedGroupingEnabled()) {
        log("grouping", { enabled: true });

        const processedIds = new Set();
        const summarizeItems = (items) =>
          (items || []).map((item) => ({
            id: item?.id ?? null,
            name:
              item?._staticData?.name ||
              item?._staticData?.lastName ||
              item?.name ||
              item?.definitionId ||
              "Unknown",
            rating: item?.rating ?? item?._staticData?.rating ?? null,
            tradable:
              item?.tradable === true ||
              (typeof item?.isTradeable === "function" && item.isTradeable()) ||
              false,
            isDuplicate:
              Number(item?.duplicateId ?? 0) > 0 || item?.isDuplicate?.(),
          }));

        const rules = getUnassignedRules();
        const actionBuckets = {
          sendToClub: [],
          sendToTransferList: [],
          sendToStorage: [],
          quickSell: [],
          listOnTransferMarket: [],
        };
        const nonFreeItems = (ulist || []).filter(
          (item) => !item?.isFreeCoins?.() && !item?.isFreePack?.(),
        );
        const processedByRule = new Map();
        const pendingPriceRecheckEntries = [];
        const deferredQuickSellEntries = [];
        const isTradable = (item) =>
          item?.tradable === true ||
          (typeof item?.isTradeable === "function" && item.isTradeable());
        const isTransferAction = (action) =>
          action === "sendToTransferList" || action === "listOnTransferMarket";

        const transferListCount = await getTransferListCount();
        let remainingTransferSlots = Math.max(0, 100 - transferListCount);

        const groupingBuckets = new Map([
          ["sendToClub", []],
          ["sendToTransferList", []],
          ["sendToStorage", []],
          ["quickSell", []],
          ["listOnTransferMarket", []],
        ]);

        nonFreeItems.forEach((item) => {
          if (!item) return;

          for (let i = 0; i < (rules || []).length; i += 1) {
            const rule = rules[i];
            if (rule?.enabled === false) continue;
            if (
              !matchesUnassignedRule(item, rule, {
                assumeMinPriceWhenMissing: true,
              })
            ) {
              continue;
            }

            const action = rule.action || "sendToClub";
            if (isTransferAction(action)) {
              if (!isTradable(item)) {
                continue;
              }
              if (remainingTransferSlots <= 0) {
                continue;
              }
              remainingTransferSlots -= 1;
            }

            groupingBuckets.get(action)?.push({
              item,
              rule,
              ruleIndex: i,
            });
            break;
          }
        });

        const grouping = { buckets: groupingBuckets };

        const addProcessedEntries = (action, entries) => {
          if (!entries.length) return;
          actionBuckets[action].push(...entries);
          entries.forEach((entry) => {
            if (entry?.item?.id != null) {
              processedIds.add(entry.item.id);
            }
            if (entry?.ruleIndex != null && entry.ruleIndex >= 0) {
              if (!processedByRule.has(entry.ruleIndex)) {
                processedByRule.set(entry.ruleIndex, []);
              }
              processedByRule.get(entry.ruleIndex).push(entry);
            }
          });
        };

        const trackPendingPriceEntries = (entries) => {
          (entries || []).forEach((entry) => {
            const item = entry?.item;
            if (!item || hasValidPrice(item)) {
              return;
            }
            pendingPriceRecheckEntries.push(entry);
          });
        };

        const toClub = (grouping.buckets.get("sendToClub") || []).filter(
          (entry) => entry?.item?.isMovable?.(),
        );
        trackPendingPriceEntries(toClub);
        addProcessedEntries("sendToClub", sortEntriesByPriceDesc(toClub));

        const toTransferList = (
          grouping.buckets.get("sendToTransferList") || []
        ).filter((entry) => isTradable(entry?.item));
        trackPendingPriceEntries(toTransferList);
        addProcessedEntries(
          "sendToTransferList",
          sortEntriesByPriceDesc(toTransferList),
        );

        const toStorageAll = sortEntriesByPriceDesc(
          (
          grouping.buckets.get("sendToStorage") || []
          ).filter((entry) => entry?.item?.isStorable?.()),
        );
        const replaceStorageEnabled = getSettings(0, 0, "replaceStoragePlayers");
        let toStorage;

        if (replaceStorageEnabled && toStorageAll.length) {
          const combined = [
            ...(storage || []).map((item) => ({ item, source: "storage" })),
            ...toStorageAll.map((entry) => ({ item: entry.item, source: "new", entry })),
          ].sort((a, b) => {
            const priceDiff = getSortablePrice(b.item) - getSortablePrice(a.item);
            if (priceDiff !== 0) return priceDiff;
            return (b.item?.rating ?? 0) - (a.item?.rating ?? 0);
          });
          const keep = combined.slice(0, 100);
          const discard = combined.slice(100);
          const discardFromStorage = discard.filter((e) => e.source === "storage").map((e) => e.item);
          const discardNew = discard.filter((e) => e.source === "new").map((e) => e.item);
          toStorage = keep.filter((e) => e.source === "new").map((e) => e.entry);

          if (discardFromStorage.length) {
            log("replaceStorage:discardOld", { count: discardFromStorage.length });
            services.Item.discard(discardFromStorage);
            storage = storage.filter((item) => !discardFromStorage.includes(item));
          }
          if (discardNew.length) {
            log("replaceStorage:discardNew", { count: discardNew.length });
            services.Item.discard(discardNew);
            addProcessedLog(discardNew, "quickSell", null, null);
          }
          if (discardFromStorage.length && toStorage.length) {
            await new Promise((r) => setTimeout(r, 2000));
          }
        } else {
          const capacity = Math.max(0, 100 - (storage?.length ?? 0));
          toStorage = toStorageAll.slice(0, capacity);
        }

        if (toStorage.length) {
          storage = [
            ...(storage || []),
            ...toStorage.map((entry) => entry.item),
          ];
        }
        trackPendingPriceEntries(toStorage);
        addProcessedEntries("sendToStorage", toStorage);

        const toQuickSellAll = grouping.buckets.get("quickSell") || [];
        const toQuickSell = toQuickSellAll.filter((entry) =>
          hasValidPrice(entry?.item),
        );
        const quickSellMissingPrice = toQuickSellAll.filter(
          (entry) => !hasValidPrice(entry?.item),
        );
        if (quickSellMissingPrice.length) {
          deferredQuickSellEntries.push(...quickSellMissingPrice);
          pendingPriceRecheckEntries.push(...quickSellMissingPrice);
          quickSellMissingPrice.forEach((entry) => {
            if (entry?.item?.id != null) {
              processedIds.add(entry.item.id);
            }
          });
        }
        addProcessedEntries("quickSell", sortEntriesByPriceDesc(toQuickSell));

        const toList = (
          grouping.buckets.get("listOnTransferMarket") || []
        ).filter((entry) => isTradable(entry?.item));
        trackPendingPriceEntries(toList);
        addProcessedEntries(
          "listOnTransferMarket",
          sortEntriesByPriceDesc(toList),
        );

        rules.forEach((rule, index) => {
          const action = rule.action || "sendToClub";
          log("rule:start", {
            ruleId: rule.id,
            ruleNumber: index + 1,
            action,
            filters: rule.filters || [],
            ratingRange: rule.ratingRange,
            priceRange: rule.priceRange,
            includeLeagues: rule.includeLeagues,
            excludeLeagues: rule.excludeLeagues,
            includeNations: rule.includeNations,
            excludeNations: rule.excludeNations,
            includeTeams: rule.includeTeams,
            excludeTeams: rule.excludeTeams,
            includeRarity: rule.includeRarity,
            excludeRarity: rule.excludeRarity,
          });

          const entries = processedByRule.get(index) || [];
          if (!entries.length) {
            log("rule:match:none", { ruleId: rule.id, action });
            return;
          }

          const processed = entries.map((entry) => entry.item).filter(Boolean);
          addProcessedLog(processed, action, index + 1, rule.color || null);

          log("rule:processed", {
            ruleId: rule.id,
            ruleNumber: index + 1,
            action,
            count: processed.length,
            items: summarizeItems(processed),
          });
        });

        if (deferredQuickSellEntries.length) {
          const deferredQuickSellItems = deferredQuickSellEntries
            .map((entry) => entry?.item)
            .filter(Boolean);
          addProcessedLog(deferredQuickSellItems, "doNothing", null, null);
          log("rule:processed", {
            ruleId: null,
            ruleNumber: null,
            action: "doNothing",
            reason: "quickSell-waiting-for-price",
            count: deferredQuickSellItems.length,
            items: summarizeItems(deferredQuickSellItems),
          });
        }

        const reprocessPendingPriceEntries = async () => {
          if (!pendingPriceRecheckEntries.length) {
            return;
          }

          try {
            log("pendingPrice:refresh:start", {
              count: pendingPriceRecheckEntries.length,
            });
            await ensureLivePrices(pendingPriceRecheckEntries, {
              awaitCompletion: true,
            });

            const refreshedUnassigned = await fetchUnassigned();
            const refreshedById = new Map(
              (refreshedUnassigned || [])
                .filter((item) => item?.id != null)
                .map((item) => [item.id, item]),
            );

            const actionBuckets = {
              sendToClub: [],
              sendToTransferList: [],
              sendToStorage: [],
              quickSell: [],
              listOnTransferMarket: [],
            };
            const isTransferAction = (action) =>
              action === "sendToTransferList" ||
              action === "listOnTransferMarket";
            const transferListCount = await getTransferListCount();
            let remainingTransferSlots = Math.max(0, 100 - transferListCount);

            const addEntryToBucket = (action, item, rule) => {
              if (!item || !actionBuckets[action]) {
                return;
              }
              actionBuckets[action].push({ item, rule });
            };

            pendingPriceRecheckEntries.forEach((entry) => {
              const itemId = entry?.item?.id;
              if (itemId == null) {
                return;
              }

              const item = refreshedById.get(itemId);
              if (!item) {
                return;
              }

              let matchedRule = null;
              let matchedAction = null;

              for (let i = 0; i < (rules || []).length; i += 1) {
                const rule = rules[i];
                if (rule?.enabled === false) continue;
                if (!matchesUnassignedRule(item, rule)) continue;

                const action = rule.action || "sendToClub";
                if (isTransferAction(action)) {
                  if (!isTradable(item)) {
                    continue;
                  }
                  if (remainingTransferSlots <= 0) {
                    continue;
                  }
                  remainingTransferSlots -= 1;
                }

                matchedRule = rule;
                matchedAction = action;
                break;
              }

              if (!matchedRule) {
                return;
              }

              const action = matchedAction || "sendToClub";
              if (action === "sendToTransferList") {
                if (isTradable(item))
                  addEntryToBucket(action, item, matchedRule);
                return;
              }

              if (action === "sendToStorage") {
                if (item?.isStorable?.())
                  addEntryToBucket(action, item, matchedRule);
                return;
              }

              if (action === "sendToClub") {
                if (item?.isMovable?.())
                  addEntryToBucket(action, item, matchedRule);
                return;
              }

              if (action === "listOnTransferMarket") {
                if (isTradable(item))
                  addEntryToBucket(action, item, matchedRule);
                return;
              }

              if (action === "quickSell") {
                addEntryToBucket(action, item, matchedRule);
              }
            });

            const storageSnapshot = await getStoragePlayers();
            const replaceEnabled = getSettings(0, 0, "replaceStoragePlayers");

            if (replaceEnabled && actionBuckets.sendToStorage.length) {
              const combined = [
                ...(storageSnapshot || []).map((item) => ({ item, source: "storage" })),
                ...actionBuckets.sendToStorage.map((entry) => ({ item: entry.item, source: "new", entry })),
              ].sort((a, b) => {
                const priceDiff = getSortablePrice(b.item) - getSortablePrice(a.item);
                if (priceDiff !== 0) return priceDiff;
                return (b.item?.rating ?? 0) - (a.item?.rating ?? 0);
              });
              const keep = combined.slice(0, 100);
              const discard = combined.slice(100);
              const discardFromStorage = discard.filter((e) => e.source === "storage").map((e) => e.item);
              const discardNew = discard.filter((e) => e.source === "new").map((e) => e.item);
              actionBuckets.sendToStorage = keep.filter((e) => e.source === "new").map((e) => e.entry);
              if (discardFromStorage.length) {
                services.Item.discard(discardFromStorage);
              }
              if (discardNew.length) {
                services.Item.discard(discardNew);
              }
              if (discardFromStorage.length && actionBuckets.sendToStorage.length) {
                await new Promise((r) => setTimeout(r, 2000));
              }
            } else {
              const capacity = Math.max(0, 100 - (storageSnapshot?.length ?? 0));
              if (actionBuckets.sendToStorage.length > capacity) {
                actionBuckets.sendToStorage = actionBuckets.sendToStorage.slice(
                  0,
                  capacity,
                );
              }
            }

            const applyBucket = async (action, entries) => {
              const items = sortItemsByPriceDesc(
                (entries || [])
                .map((entry) => entry?.item)
                .filter(Boolean),
              );
              if (!items.length) {
                return 0;
              }

              if (action === "sendToClub") {
                services.Item.move(items, 7);
              } else if (action === "sendToTransferList") {
                await clearSoldItemsBeforeTransferActions();
                services.Item.move(items, 5);
              } else if (action === "sendToStorage") {
                services.Item.move(items, 10);
              } else if (action === "quickSell") {
                services.Item.discard(items);
              } else if (action === "listOnTransferMarket") {
                await clearSoldItemsBeforeTransferActions();
                await processUnsoldTransferItemsByRules();
                void quickListItems(items, {
                  suppressNotifications: true,
                  minDelayMs: 1000,
                  maxDelayMs: 1000,
                });
              }

              const actionTimestamp = new Date().toLocaleString();
              const historyRows = items.map((item) => ({
                item,
                action,
                ruleNumber: null,
                timestamp: actionTimestamp,
                ruleColor: null,
              }));
              appendUnassignedHistoryRows(historyRows, actionTimestamp);
              return items.length;
            };

            const movedToClub = await applyBucket(
              "sendToClub",
              actionBuckets.sendToClub,
            );
            const movedToTransferList = await applyBucket(
              "sendToTransferList",
              actionBuckets.sendToTransferList,
            );
            const movedToStorage = await applyBucket(
              "sendToStorage",
              actionBuckets.sendToStorage,
            );
            const quickSold = await applyBucket(
              "quickSell",
              actionBuckets.quickSell,
            );
            const listedOnMarket = await applyBucket(
              "listOnTransferMarket",
              actionBuckets.listOnTransferMarket,
            );

            log("pendingPrice:reprocessed", {
              sendToClub: movedToClub,
              sendToTransferList: movedToTransferList,
              sendToStorage: movedToStorage,
              quickSell: quickSold,
              listOnTransferMarket: listedOnMarket,
            });
          } catch (error) {
            void error;
          }
        };

        const executeBucket = async (action, entries) => {
          const items = sortItemsByPriceDesc(
            entries.map((entry) => entry.item).filter(Boolean),
          );
          if (!items.length) return;

          if (action === "sendToClub") {
            services.Item.move(items, 7);
          } else if (action === "sendToTransferList") {
            await clearSoldItemsBeforeTransferActions();
            services.Item.move(items, 5);
          } else if (action === "sendToStorage") {
            services.Item.move(items, 10);
          } else if (action === "quickSell") {
            services.Item.discard(items);
          } else if (action === "listOnTransferMarket") {
            await clearSoldItemsBeforeTransferActions();
            await processUnsoldTransferItemsByRules();
            const eligible = entries
              .filter((entry) =>
                matchesUnassignedRule(entry.item, entry.rule, {
                  assumeMinPriceWhenMissing: true,
                }),
              )
              .map((entry) => entry.item);
            const sortedEligible = sortItemsByPriceDesc(eligible);
            if (!sortedEligible.length) return;
            void quickListItems(sortedEligible, {
              suppressNotifications: true,
              minDelayMs: 1000,
              maxDelayMs: 1000,
            });
          }
        };

        const executeBucketWithRatingUi = async (action, entries) => {
          await executeBucket(action, entries);
          try {
            if (typeof ratingCountUI === "function") {
              await ratingCountUI();
            }
          } catch {}
        };

        await executeBucketWithRatingUi("sendToClub", actionBuckets.sendToClub);
        await executeBucketWithRatingUi(
          "sendToTransferList",
          actionBuckets.sendToTransferList,
        );
        await executeBucketWithRatingUi(
          "sendToStorage",
          actionBuckets.sendToStorage,
        );
        await executeBucketWithRatingUi("quickSell", actionBuckets.quickSell);
        await executeBucketWithRatingUi(
          "listOnTransferMarket",
          actionBuckets.listOnTransferMarket,
        );

        if (pendingPriceRecheckEntries.length) {
          void reprocessPendingPriceEntries();
        }

        if (
          actionBuckets.sendToTransferList.length ||
          actionBuckets.quickSell.length ||
          actionBuckets.listOnTransferMarket.length
        ) {
          if (!suppressNavigation) {
            goToUnassignedView();
          }
        }

        ulist = await fetchUnassigned();
        const unmatched = (ulist || [])
          .filter((item) => !item?.isFreeCoins?.() && !item?.isFreePack?.())
          .filter((item) => !processedIds.has(item?.id));

        if (unmatched.length) {
          addProcessedLog(unmatched, "doNothing", null, null);
          log("rule:processed", {
            ruleId: null,
            ruleNumber: null,
            action: "doNothing",
            count: unmatched.length,
            items: summarizeItems(unmatched),
          });
        }

        void ensureLivePrices(processedLog, { awaitCompletion: false });
        console.table(
          processedLog.map(({ item, action, ruleNumber, timestamp }) => ({
            timestamp,
            ruleNumber,
            name: getItemNameSafe(item),
            rating: item?.rating ?? item?._staticData?.rating ?? null,
            price: Number(getPrice(item)) || null,
            rarity: getItemRarityLabel(item),
            isFodder: typeof isFodder === "function" ? isFodder(item) : false,
            isDuplicate:
              Number(item?.duplicateId ?? 0) > 0 || item?.isDuplicate?.(),
            action,
          })),
        );

        appendUnassignedHistoryRows(processedLog, runTimestamp);

        log("done", { mode: "grouping", processed: processedLog.length });
        return { mode: "grouping", processed: processedLog.length };
      }

      // Build a quick-list queue from unassigned
      let quickListQueue = (ulist || [])
        .filter(
          (item) =>
            item && item.tradable && getPrice(item) && item.owners === 1,
        )
        .filter((item) => !item.isFreeCoins?.() && !item.isFreePack?.())
        .filter((item) => {
          if (item.isPlayer?.()) {
            return (
              Number(item.rating) < 85 &&
              !isFodder(item) &&
              !item?.isSpecial?.()
            );
          }
          return !isFodder(item);
        });
      quickListQueue = sortItemsByPriceDesc(quickListQueue);

      log("quickListQueue", {
        count: quickListQueue.length,
        sample: quickListQueue.slice(0, 5).map((it) => ({
          id: it?.id,
          definitionId: it?.definitionId,
          rating: it?.rating,
          price: getPrice(it),
        })),
      });

      if (quickListQueue.length) {
        if (!quickListQueue.length) {
          log("quickListQueue", {
            count: 0,
            reason: "no-matching-after-price",
          });
        } else {
          await clearSoldItemsBeforeTransferActions();
          await processUnsoldTransferItemsByRules();
          void quickListItems(quickListQueue, {
            suppressNotifications: true,
            minDelayMs: 1000,
            maxDelayMs: 1000,
          });
        }

        if (!suppressNavigation) {
          goToUnassignedView();
        }

        // refresh local snapshots after listing + navigation
        storage = await getStoragePlayers();
        ulist = await fetchUnassigned();
        players = await fetchPlayers();

        log("afterQuickList", {
          storageCount: storage?.length ?? 0,
          unassignedCount: ulist?.length ?? 0,
          clubCount: players?.length ?? 0,
        });
      }

      // move to team any storage players not already in club
      const storageToTeam = (storage || []).filter((item) =>
        item?.isMovable?.(),
      );
      const sortedStorageToTeam = sortItemsByPriceDesc(storageToTeam);
      log("storageToTeam", { count: storageToTeam.length });
      if (sortedStorageToTeam.length > 0) {
        services.Item.move(sortedStorageToTeam, 7);
      }

      // filter unassigned by those tradeable definitionIds and ensure uniqueness by definitionId
      const switchTradeable = (ulist || []).filter(
        (l) => l?.isTradeableDuplicate?.() && !l?.tradable,
      );
      const sortedSwitchTradeable = sortItemsByPriceDesc(switchTradeable);
      log("switchTradeable", { count: switchTradeable.length });
      if (sortedSwitchTradeable.length > 0) {
        services.Item.move(sortedSwitchTradeable, 7);
        if (!suppressNavigation) {
          goToUnassignedView();
        }

        storage = await getStoragePlayers();
        ulist = await fetchUnassigned();
        players = await fetchPlayers();

        log("afterSwitchTradeable", {
          storageCount: storage?.length ?? 0,
          unassignedCount: ulist?.length ?? 0,
          clubCount: players?.length ?? 0,
        });
      }

      void ensureLivePrices(processedLog, { awaitCompletion: false });
      console.table(
        processedLog.map(({ item, action, ruleNumber, timestamp }) => ({
          timestamp,
          ruleNumber,
          name: getItemNameSafe(item),
          rating: item?.rating ?? item?._staticData?.rating ?? null,
          price: Number(getPrice(item)) || null,
          rarity: getItemRarityLabel(item),
          isFodder: typeof isFodder === "function" ? isFodder(item) : false,
          isDuplicate:
            Number(item?.duplicateId ?? 0) > 0 || item?.isDuplicate?.(),
          action,
        })),
      );

      appendUnassignedHistoryRows(processedLog, runTimestamp);

      const toTeam = (ulist || []).filter((item) => item?.isMovable?.());
      const sortedToTeam = sortItemsByPriceDesc(toTeam);
      log("toTeam", { count: toTeam.length });
      if (sortedToTeam.length > 0) {
        services.Item.move(sortedToTeam, 7);
      }

      // discard non-player fodder
      const nonPlayerDupes = (ulist || []).filter(
        (l) => !l?.isPlayer?.() && getPrice(l) && getPrice(l) < 551,
      );
      log("nonPlayerDupes", { count: nonPlayerDupes.length });
      if (nonPlayerDupes.length > 0) {
        services.Item.discard(nonPlayerDupes);
        if (!suppressNavigation) {
          goToUnassignedView();
        }

        storage = await getStoragePlayers();
        ulist = await fetchUnassigned();
        players = await fetchPlayers();

        log("afterDiscardNonPlayerDupes", {
          storageCount: storage?.length ?? 0,
          unassignedCount: ulist?.length ?? 0,
          clubCount: players?.length ?? 0,
        });
      }

      // sendDuplicatesToStorage
      const storableDupes = (ulist || [])
        .filter(
          (item) =>
            item?.isStorable?.() &&
            !item?.isMovable?.() &&
            !item?.isTradeable?.(),
        );
      let toStorage;

      if (getSettings(0, 0, "replaceStoragePlayers") && storableDupes.length) {
        const combined = [
          ...(storage || []).map((item) => ({ item, source: "storage" })),
          ...storableDupes.map((item) => ({ item, source: "new" })),
        ].sort((a, b) => {
          const priceDiff = getSortablePrice(b.item) - getSortablePrice(a.item);
          if (priceDiff !== 0) return priceDiff;
          return (b.item?.rating ?? 0) - (a.item?.rating ?? 0);
        });
        const keep = combined.slice(0, 100);
        const discard = combined.slice(100);
        const discardFromStorage = discard.filter((e) => e.source === "storage").map((e) => e.item);
        const discardNew = discard.filter((e) => e.source === "new").map((e) => e.item);
        toStorage = keep.filter((e) => e.source === "new").map((e) => e.item);
        if (discardFromStorage.length) {
          log("replaceStorage:discardOld", { count: discardFromStorage.length });
          services.Item.discard(discardFromStorage);
        }
        if (discardNew.length) {
          log("replaceStorage:discardNew", { count: discardNew.length });
          services.Item.discard(discardNew);
        }
        if (discardFromStorage.length && toStorage.length) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      } else {
        toStorage = sortItemsByPriceDesc(storableDupes)
          .slice(0, Math.max(0, 100 - (storage?.length ?? 0)));
      }

      log("toStorage", { count: toStorage.length });
      if (toStorage.length > 0) {
        services.Item.move(toStorage, 10);
      }

      // discard tradable fodder
      const tradableFodder = (ulist || []).filter(
        (l) =>
          !l?.isMovable?.() &&
          l?.owners === 1 &&
          l?.isPlayer?.() &&
          (getPrice(l) ?? 0) < 800 &&
          l?.tradable &&
          isFodder(l),
      );

      log("tradableFodder", { count: tradableFodder.length });
      if (tradableFodder.length > 0) {
        services.Item.discard(tradableFodder);
        if (!suppressNavigation) {
          goToUnassignedView();
        }
        ulist = await fetchUnassigned();
        log("afterDiscardTradableFodder", {
          unassignedCount: ulist?.length ?? 0,
        });
      }

      // send to transfer
      const transferList = (ulist || []).filter(
        (l) => l?.owners === 1 && (getPrice(l) ?? 0) >= 800 && l?.tradable,
      );
      const sortedTransferList = sortItemsByPriceDesc(transferList);

      log("transferList", { count: transferList.length });
      if (sortedTransferList.length > 0) {
        if (!suppressNavigation) {
          goToUnassignedView();
        }
        await clearSoldItemsBeforeTransferActions();
        services.Item.move(sortedTransferList, 5);
      }
      ratingCountUI();
      log("done");
      return { mode: "default", processed: processedLog.length };
    } catch (error) {
      void runId;
      return { mode: "error", error: String(error) };
    }
  })();

  state.runningPromise = runPromise;
  try {
    const result = await runPromise;
    state.lastResult = result;
    state.lastRunAt = Date.now();
    return result;
  } finally {
    state.runningPromise = null;
  }
};
