const transferListOverride = () => {
  const patchActionHeaderForArray = () => {
    if (
      typeof UTSectionedItemListView === "undefined" ||
      !UTSectionedItemListView.prototype ||
      UTSectionedItemListView.prototype.__sbcMultiActionHeaderPatched
    ) {
      return;
    }

    const originalSetActionHeader =
      UTSectionedItemListView.prototype.setActionHeader;

    UTSectionedItemListView.prototype.__sbcMultiActionHeaderPatched = true;

    UTSectionedItemListView.prototype.setActionHeader = function (
      title,
      actionTextOrArray,
      callback,
    ) {
      const headerRoot = this._header?.getRootElement?.();
      if (headerRoot) {
        headerRoot
          .querySelectorAll(".sbc-extra-action-btn")
          .forEach((node) => node.remove());
      }

      if (!Array.isArray(actionTextOrArray)) {
        return originalSetActionHeader.call(
          this,
          title,
          actionTextOrArray,
          callback,
        );
      }

      const actions = actionTextOrArray.filter(
        (action) => action && typeof action.label === "string",
      );

      const primaryAction = actions[0];
      const primaryLabel = primaryAction?.label || "";
      const primaryCallback =
        typeof primaryAction?.onPress === "function"
          ? primaryAction.onPress
          : null;

      originalSetActionHeader.call(this, title, primaryLabel, primaryCallback);

      const primaryButtonRoot = this._header?._actionButton?.getRootElement?.();
      const buttonContainer = primaryButtonRoot?.parentElement || headerRoot;

      if (!buttonContainer) {
        return;
      }

      actions.slice(1).forEach((action, index) => {
        if (typeof action?.onPress !== "function") {
          return;
        }

        const extraButton = document.createElement("button");
        extraButton.type = "button";
        extraButton.classList.add(
          "btn-standard",
          "section-header-btn",
          "mini",
          "primary",
          "sbc-extra-action-btn",
        );
        extraButton.dataset.sbcActionIndex = String(index + 1);
        extraButton.textContent = action.label;
        extraButton.style.marginRight = "0.4rem";

        extraButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();

          try {
            action.onPress.call(this);
          } catch (err) {
            console.error("Transfer header extra action error", err);
          }
        });

        if (primaryButtonRoot) {
          buttonContainer.insertBefore(extraButton, primaryButtonRoot);
          return;
        }

        buttonContainer.appendChild(extraButton);
      });
    };
  };

  const processItemsByUnassignedRules = async (items, sectionLabel) => {
    const sourceItems = Array.isArray(items) ? items.filter(Boolean) : [];

    if (!sourceItems.length) {
      showNotification(
        `No ${sectionLabel} items to process`,
        UINotificationType.NEUTRAL,
      );
      return;
    }

    if (
      typeof getUnassignedRules !== "function" ||
      typeof groupUnassignedItemsByRules !== "function"
    ) {
      showNotification(
        "Unassigned rules engine is not available",
        UINotificationType.NEGATIVE,
      );
      return;
    }

    const allRules = getUnassignedRules() || [];
    const enabledRules = allRules.filter((rule) => rule?.enabled !== false);

    if (!enabledRules.length) {
      showNotification("No enabled rules found", UINotificationType.NEUTRAL);
      return;
    }

    const nonFreeItems = sourceItems.filter(
      (item) => !item?.isFreeCoins?.() && !item?.isFreePack?.(),
    );

    const grouping = groupUnassignedItemsByRules(nonFreeItems, enabledRules, {
      includeFreeItems: false,
      includeDoNothing: false,
    });

    const isTradable = (item) =>
      item?.tradable === true ||
      (typeof item?.isTradeable === "function" && item.isTradeable());

    const ensureLivePrices = async (entries) => {
      const toFetch = (entries || [])
        .map((entry) => entry?.item)
        .filter(Boolean)
        .filter(
          (item) =>
            !Number.isFinite(Number(getPrice(item))) || getPrice(item) <= 0,
        );

      if (!toFetch.length) return;

      if (typeof fetchLivePlayerPrice === "function") {
        for (const item of toFetch) {
          try {
            await fetchLivePlayerPrice(item);
          } catch (err) {
            console.warn("[transferList] livePrice failed", err);
          }
        }
        return;
      }

      if (typeof fetchPlayerPrices === "function") {
        await fetchPlayerPrices(toFetch);
      }
    };

    const actionBuckets = {
      sendToClub: (grouping.buckets.get("sendToClub") || []).filter((entry) =>
        entry?.item?.isMovable?.(),
      ),
      sendToTransferList: (
        grouping.buckets.get("sendToTransferList") || []
      ).filter((entry) => isTradable(entry?.item)),
      sendToStorage: [],
      quickSell: grouping.buckets.get("quickSell") || [],
      listOnTransferMarket: (
        grouping.buckets.get("listOnTransferMarket") || []
      ).filter((entry) => isTradable(entry?.item)),
    };

    const storagePlayers =
      typeof getStoragePlayers === "function" ? await getStoragePlayers() : [];
    const sendToStorageCandidates = (
      grouping.buckets.get("sendToStorage") || []
    ).filter((entry) => entry?.item?.isStorable?.());
    const storageCapacity = Math.max(0, 100 - (storagePlayers?.length ?? 0));
    actionBuckets.sendToStorage = sendToStorageCandidates.slice(
      0,
      storageCapacity,
    );

    const processedLog = [];
    const runTimestamp = new Date().toLocaleString();
    const addProcessedLog = (entries, action) => {
      entries.forEach((entry) => {
        if (!entry?.item) return;
        processedLog.push({
          item: entry.item,
          action,
          ruleNumber:
            typeof entry.ruleIndex === "number" && entry.ruleIndex >= 0
              ? entry.ruleIndex + 1
              : null,
          timestamp: runTimestamp,
          ruleColor: entry?.rule?.color || null,
        });
      });
    };

    const executeBucket = async (action, entries) => {
      const actionableEntries = entries || [];
      const bucketItems = actionableEntries
        .map((entry) => entry.item)
        .filter(Boolean);
      if (!bucketItems.length) return;

      if (action === "sendToClub") {
        services.Item.move(bucketItems, 7);
      } else if (action === "sendToTransferList") {
        services.Item.move(bucketItems, 5);
      } else if (action === "sendToStorage") {
        services.Item.move(bucketItems, 10);
      } else if (action === "quickSell") {
        services.Item.discard(bucketItems);
      } else if (action === "listOnTransferMarket") {
        await ensureLivePrices(actionableEntries);
        const eligible =
          typeof matchesUnassignedRule === "function"
            ? actionableEntries
                .filter((entry) =>
                  matchesUnassignedRule(entry.item, entry.rule),
                )
                .map((entry) => entry.item)
            : bucketItems;

        if (!eligible.length) return;

        await quickListItems(eligible, {
          suppressNotifications: true,
          minDelayMs: 2000,
          maxDelayMs: 3000,
        });
      }

      addProcessedLog(actionableEntries, action);
    };

    await executeBucket("sendToClub", actionBuckets.sendToClub);
    await executeBucket("sendToTransferList", actionBuckets.sendToTransferList);
    await executeBucket("sendToStorage", actionBuckets.sendToStorage);
    await executeBucket("quickSell", actionBuckets.quickSell);
    await executeBucket(
      "listOnTransferMarket",
      actionBuckets.listOnTransferMarket,
    );

    if (
      typeof appendUnassignedHistoryRows === "function" &&
      processedLog.length > 0
    ) {
      appendUnassignedHistoryRows(processedLog, runTimestamp);
    }

    if (!processedLog.length) {
      showNotification(
        `No ${sectionLabel} items matched enabled rules`,
        UINotificationType.NEUTRAL,
      );
      return;
    }

    showNotification(
      `Processed ${processedLog.length} ${sectionLabel} items by rules`,
      UINotificationType.POSITIVE,
    );
  };

  const patchController = (ControllerClass) => {
    if (
      !ControllerClass?.prototype ||
      ControllerClass.prototype.__sbcTransferListPatched
    ) {
      return;
    }

    const originalUpdateSectionHeaders =
      ControllerClass.prototype._updateSectionHeaders;

    if (!originalUpdateSectionHeaders) {
      return;
    }

    ControllerClass.prototype.__sbcTransferListPatched = true;

    ControllerClass.prototype._updateSectionHeaders =
      function _updateSectionHeaders() {
        originalUpdateSectionHeaders.call(this);

        try {
          const view = this.getView?.();
          if (!view || !this._viewmodel) {
            return;
          }

          const SECTION = UTTransferSectionListViewModel.SECTION;

          const isRefreshableItem = (item) => {
            const definitionId = Number(item?.definitionId);
            return Number.isFinite(definitionId) && definitionId > 0;
          };

          const dedupeByItemId = (items) => {
            const map = new Map();
            (items || []).forEach((item, index) => {
              const key =
                item?.id ||
                item?._auction?.tradeId ||
                item?._auction?.id ||
                `idx-${index}`;
              if (!key) return;
              if (!map.has(key)) {
                map.set(key, item);
              }
            });
            return Array.from(map.values());
          };

          const getRefreshCandidatesForSection = (sectionId) => {
            let sectionItems = [];

            if (
              sectionId === SECTION.UNSOLD &&
              typeof this._viewmodel.getUnsoldItems === "function"
            ) {
              sectionItems = this._viewmodel.getUnsoldItems() || [];
            } else {
              sectionItems = this._viewmodel.getSectionItems(sectionId) || [];
            }

            return dedupeByItemId(sectionItems).filter(isRefreshableItem);
          };

          const unsoldSection = view.getSection(SECTION.UNSOLD);
          const availableSection = view.getSection(SECTION.AVAILABLE);

          if (unsoldSection) {
            const relistEnabled =
              services.TransferMarket.isFeatureEnabledForUser() &&
              this._viewmodel.hasUnsoldItems();

            unsoldSection.setActionHeader(
              services.Localization.localize(
                "tradepile.dock.categories.expired.notsold",
              ),
              [
                {
                  label: services.Localization.localize(
                    "tradepile.button.relistall",
                  ),
                  onPress: relistEnabled ? this._relistAll.bind(this) : null,
                },
                {
                  label: "Quick List",
                  onPress: async () => {
                    const sectionItems =
                      this._viewmodel.getSectionItems(SECTION.UNSOLD) || [];
                    const tradableItems = sectionItems.filter(
                      (item) => item?.tradable === true,
                    );

                    if (!tradableItems.length) {
                      showNotification(
                        "No tradable unsold items",
                        UINotificationType.NEUTRAL,
                      );
                      return;
                    }

                    try {
                      await quickListItems(tradableItems, {
                        suppressNotifications: false,
                        minDelayMs: 2000,
                        maxDelayMs: 3000,
                      });
                      showNotification(
                        `Listed ${tradableItems.length} unsold items`,
                        UINotificationType.POSITIVE,
                      );
                    } catch (err) {
                      console.error("Quick list unsold error", err);
                      showNotification(
                        "Error listing unsold items",
                        UINotificationType.NEGATIVE,
                      );
                    }
                  },
                },
                {
                  label: "Process by Rules",
                  onPress: async () => {
                    const sectionItems =
                      this._viewmodel.getSectionItems(SECTION.UNSOLD) || [];
                    await processItemsByUnassignedRules(sectionItems, "unsold");
                  },
                },
                {
                  label: "Refresh Price",
                  onPress: async () => {
                    const playersToRefresh = getRefreshCandidatesForSection(
                      SECTION.UNSOLD,
                    );

                    if (!playersToRefresh.length) {
                      showNotification(
                        "No unsold items to refresh",
                        UINotificationType.NEUTRAL,
                      );
                      return;
                    }

                    try {
                      if (typeof refreshItemsLivePrices !== "function") {
                        showNotification(
                          "Refresh prices UI is not available",
                          UINotificationType.NEGATIVE,
                        );
                        return;
                      }
                      await refreshItemsLivePrices(playersToRefresh);
                    } catch (err) {
                      console.error("Refresh price unsold error", err);
                      showNotification(
                        "Error refreshing prices",
                        UINotificationType.NEGATIVE,
                      );
                    }
                  },
                },
              ],
            );

            unsoldSection.toggleHeaderButton(relistEnabled);
          }

          if (availableSection) {
            const transferPileFull = repositories.Item.isPileFull(
              ItemPile.TRANSFER,
            );

            availableSection.setActionHeader(
              services.Localization.localize(
                "tradepile.dock.categories.available",
              ),
              [
                {
                  label: services.Localization.localize(
                    "infopanel.label.addplayer",
                  ),
                  onPress: () => {
                    if (isPhone()) {
                      const navController = this.getNavigationController?.();
                      if (navController) {
                        const transferNavController =
                          new UTTransferListNavigationController().init();
                        transferNavController.setNavigationStyle(
                          UTNavigationBarView.Style.SECONDARY,
                        );
                        navController.pushViewController(
                          transferNavController,
                          true,
                        );
                      }
                      return;
                    }

                    this.onSearchClub?.notify?.();
                  },
                },
                {
                  label: "Quick List",
                  onPress: async () => {
                    const sectionItems =
                      this._viewmodel.getSectionItems(SECTION.AVAILABLE) || [];
                    const tradableItems = sectionItems.filter(
                      (item) => item?.tradable === true,
                    );

                    if (!tradableItems.length) {
                      showNotification(
                        "No tradable available items",
                        UINotificationType.NEUTRAL,
                      );
                      return;
                    }

                    try {
                      await quickListItems(tradableItems, {
                        suppressNotifications: false,
                        minDelayMs: 2000,
                        maxDelayMs: 3000,
                      });
                      showNotification(
                        `Listed ${tradableItems.length} available items`,
                        UINotificationType.POSITIVE,
                      );
                    } catch (err) {
                      console.error("Quick list available error", err);
                      showNotification(
                        "Error listing available items",
                        UINotificationType.NEGATIVE,
                      );
                    }
                  },
                },
                {
                  label: "Process by Rules",
                  onPress: async () => {
                    const sectionItems =
                      this._viewmodel.getSectionItems(SECTION.AVAILABLE) || [];
                    await processItemsByUnassignedRules(
                      sectionItems,
                      "available",
                    );
                  },
                },
                {
                  label: "Refresh Price",
                  onPress: async () => {
                    const playersToRefresh = getRefreshCandidatesForSection(
                      SECTION.AVAILABLE,
                    );

                    if (!playersToRefresh.length) {
                      showNotification(
                        "No available items to refresh",
                        UINotificationType.NEUTRAL,
                      );
                      return;
                    }

                    try {
                      if (typeof refreshItemsLivePrices !== "function") {
                        showNotification(
                          "Refresh prices UI is not available",
                          UINotificationType.NEGATIVE,
                        );
                        return;
                      }
                      await refreshItemsLivePrices(playersToRefresh);
                    } catch (err) {
                      console.error("Refresh price available error", err);
                      showNotification(
                        "Error refreshing prices",
                        UINotificationType.NEGATIVE,
                      );
                    }
                  },
                },
              ],
            );

            availableSection.toggleHeaderButtonEnabled(!transferPileFull);
          }
        } catch (err) {
          console.warn("Transfer list multi-action override error:", err);
        }
      };
  };

  patchActionHeaderForArray();

  if (typeof UTTransferListViewController !== "undefined") {
    patchController(UTTransferListViewController);
  }

  if (typeof UTTransferListSplitViewController !== "undefined") {
    patchController(UTTransferListSplitViewController);
  }
};

if (
  typeof UTTransferListViewController !== "undefined" ||
  typeof UTTransferListSplitViewController !== "undefined"
) {
  transferListOverride();
}
