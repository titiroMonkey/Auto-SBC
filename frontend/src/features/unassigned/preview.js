const getPreviewSectionActionLabel = (action) => {
  const labels = {
    freeItems: "Redeem all",
    sendToClub: "Send all to club",
    sendToTransferList: "Send all to transfer list",
    quickSell: "Quick sell all",
    listOnTransferMarket: "List all on market",
    sendToStorage: "Send all to storage",
    doNothing: "Skip all",
  };

  return labels[action] || "Process all";
};

const ensureSectionHeaderButtonVisible = (sectionView) => {
  try {
    sectionView?.showBulkActionButton?.();
  } catch {}

  try {
    sectionView?.toggleHeaderButton?.(true);
  } catch {}

  try {
    sectionView?.toggleHeaderButtonEnabled?.(true);
  } catch {}

  const headerRoot = sectionView?._header?.getRootElement?.();
  const actionButtonRoot =
    sectionView?._header?._actionButton?.getRootElement?.();

  if (headerRoot) {
    headerRoot.style.display = "";
    headerRoot.style.visibility = "";
  }

  if (actionButtonRoot) {
    actionButtonRoot.style.display = "";
    actionButtonRoot.style.visibility = "";
    actionButtonRoot.style.opacity = "";
    actionButtonRoot.disabled = false;
    actionButtonRoot.removeAttribute("disabled");
  }
};

const setPreviewSectionHeaderAction = (
  sectionView,
  title,
  actionLabel,
  callback,
) => {
  if (!sectionView) {
    return;
  }

  const hasSetActionHeader = typeof sectionView.setActionHeader === "function";
  const hasSetBulkHeader = typeof sectionView.setBulkHeader === "function";

  if (hasSetActionHeader) {
    sectionView.setActionHeader(title, actionLabel, callback);
  } else if (hasSetBulkHeader) {
    sectionView.setBulkHeader(title, actionLabel, callback);
  }

  ensureSectionHeaderButtonVisible(sectionView);
};

const previewHasValidPrice = (item) => {
  const price = Number(getPrice(item));
  return Number.isFinite(price) && price > 0;
};

const reprocessPreviewMissingPriceItems = async (controller, items, rules) => {
  if (!items.length || !Array.isArray(rules) || !rules.length) {
    return;
  }

  try {
    await Promise.all(
      items
        .filter((item) => Number(item?.definitionId) > 0)
        .map(async (item) => {
          try {
            await fetchLivePlayerPrice(item);
          } catch {}
        }),
    );

    const isTradable = (item) =>
      item?.tradable === true ||
      (typeof item?.isTradeable === "function" && item.isTradeable());

    const actionBuckets = {
      sendToClub: [],
      sendToTransferList: [],
      sendToStorage: [],
      quickSell: [],
      listOnTransferMarket: [],
    };

    items.forEach((item) => {
      const matchedRule = (rules || []).find(
        (rule) => rule?.enabled !== false && matchesUnassignedRule(item, rule),
      );

      if (!matchedRule) {
        return;
      }

      const action = matchedRule.action || "sendToClub";

      if (action === "sendToClub" && item?.isMovable?.()) {
        actionBuckets.sendToClub.push(item);
      } else if (action === "sendToTransferList" && isTradable(item)) {
        actionBuckets.sendToTransferList.push(item);
      } else if (action === "sendToStorage" && item?.isStorable?.()) {
        actionBuckets.sendToStorage.push(item);
      } else if (action === "quickSell") {
        actionBuckets.quickSell.push(item);
      } else if (action === "listOnTransferMarket" && isTradable(item)) {
        actionBuckets.listOnTransferMarket.push(item);
      }
    });

    if (actionBuckets.sendToClub.length) {
      services.Item.move(actionBuckets.sendToClub, 7);
    }
    if (actionBuckets.sendToTransferList.length) {
      services.Item.move(actionBuckets.sendToTransferList, 5);
    }
    if (actionBuckets.sendToStorage.length) {
      services.Item.move(actionBuckets.sendToStorage, 10);
    }
    if (actionBuckets.quickSell.length) {
      services.Item.discard(actionBuckets.quickSell);
    }
    if (actionBuckets.listOnTransferMarket.length) {
      if (typeof quickListItems === "function") {
        void quickListItems(actionBuckets.listOnTransferMarket, {
          suppressNotifications: true,
          minDelayMs: 1000,
          maxDelayMs: 1000,
        });
      }
    }

    const total =
      actionBuckets.sendToClub.length +
      actionBuckets.sendToTransferList.length +
      actionBuckets.sendToStorage.length +
      actionBuckets.quickSell.length +
      actionBuckets.listOnTransferMarket.length;

    if (total > 0) {
      try {
        controller?.getUnassignedItems?.(false);
      } catch {}
    }

    console.log("[previewReprocess] pending price items resolved", {
      sendToClub: actionBuckets.sendToClub.length,
      sendToTransferList: actionBuckets.sendToTransferList.length,
      sendToStorage: actionBuckets.sendToStorage.length,
      quickSell: actionBuckets.quickSell.length,
      listOnTransferMarket: actionBuckets.listOnTransferMarket.length,
    });
  } catch (err) {
    console.warn("[previewReprocess] failed", err);
  }
};

const processPreviewSectionAction = async (controller, section) => {
  const items = (section?.items || []).filter(Boolean);
  const action = section?.action;
  const sectionLabel = section?.label || "section";

  if (!items.length) {
    showNotification(`No items in ${sectionLabel}`, UINotificationType.NEUTRAL);
    return;
  }

  const isTradable = (item) =>
    item?.tradable === true ||
    (typeof item?.isTradeable === "function" && item.isTradeable());

  const rules =
    typeof getUnassignedRules === "function" ? getUnassignedRules() : [];

  let processedCount = 0;
  let missingPriceItems = [];

  if (action === "freeItems") {
    const redeemable = items.filter(
      (item) => item?.isFreeCoins?.() || item?.isFreePack?.(),
    );
    redeemable.forEach((item) => services.Item.redeem(item));
    processedCount = redeemable.length;
  } else if (action === "sendToClub") {
    const movable = items.filter((item) => item?.isMovable?.());
    services.Item.move(movable, 7);
    processedCount = movable.length;
    missingPriceItems = items.filter((item) => !previewHasValidPrice(item));
  } else if (action === "sendToTransferList") {
    const tradable = items.filter((item) => isTradable(item));
    services.Item.move(tradable, 5);
    processedCount = tradable.length;
    missingPriceItems = items.filter((item) => !previewHasValidPrice(item));
  } else if (action === "sendToStorage") {
    const storable = items.filter((item) => item?.isStorable?.());
    services.Item.move(storable, 10);
    processedCount = storable.length;
    missingPriceItems = items.filter((item) => !previewHasValidPrice(item));
  } else if (action === "quickSell") {
    const priced = items.filter((item) => previewHasValidPrice(item));
    const unpriced = items.filter((item) => !previewHasValidPrice(item));
    if (priced.length) {
      services.Item.discard(priced);
    }
    processedCount = priced.length;
    missingPriceItems = unpriced;
    if (unpriced.length) {
      showNotification(
        `${unpriced.length} item(s) held — waiting for price`,
        UINotificationType.NEUTRAL,
      );
    }
  } else if (action === "listOnTransferMarket") {
    const tradable = items.filter((item) => isTradable(item));
    if (!tradable.length) {
      showNotification("No tradable items to list", UINotificationType.NEUTRAL);
      return;
    }

    if (typeof quickListItems !== "function") {
      showNotification(
        "Quick list is unavailable",
        UINotificationType.NEGATIVE,
      );
      return;
    }

    void quickListItems(tradable, {
      maxCount: tradable.length,
      showNotifications: true,
    });
    processedCount = tradable.length;
    missingPriceItems = items.filter((item) => !previewHasValidPrice(item));
  } else {
    processedCount = 0;
  }

  if (processedCount > 0) {
    showNotification(
      `${sectionLabel}: ${processedCount} processed`,
      UINotificationType.POSITIVE,
    );
  } else if (!missingPriceItems.length) {
    showNotification(
      `No items processed for ${sectionLabel}`,
      UINotificationType.NEUTRAL,
    );
  }

  if (missingPriceItems.length) {
    void reprocessPreviewMissingPriceItems(
      controller,
      missingPriceItems,
      rules,
    );
  }

  try {
    controller?.getUnassignedItems?.(false);
  } catch {}
};

const unassignedPreviewOverride = () => {
  if (UTUnassignedItemsViewController.prototype.__sbcPreviewPatched) {
    return;
  }
  UTUnassignedItemsViewController.prototype.__sbcPreviewPatched = true;

  const originalRenderView =
    UTUnassignedItemsViewController.prototype.renderView;
  UTUnassignedItemsViewController.prototype.renderView = function () {
    const rules =
      typeof getUnassignedRules === "function" ? getUnassignedRules() : [];
    if (!rules.length || !isUnassignedGroupingEnabled?.()) {
      return originalRenderView.call(this);
    }

    if (!this.viewmodel || this.viewmodel.length === 0) {
      return originalRenderView.call(this);
    }

    const view = this.getView?.();
    if (!view || typeof view.renderSection !== "function") {
      return originalRenderView.call(this);
    }

    const regular = this.viewmodel?.getRegularItemsSection?.() || [];
    const duplicates = this.viewmodel?.getDuplicateSection?.() || [];
    const untradeables =
      this.viewmodel?.getUntradeableDuplicateSection?.() || [];
    const allItems = [...regular, ...duplicates, ...untradeables];
    const { sections } = groupUnassignedItemsByRules(allItems, rules, {
      includeFreeItems: true,
      includeDoNothing: true,
      matcherOptions: { assumeMinPriceWhenMissing: true },
    });
    if (!sections.length) {
      return originalRenderView.call(this);
    }

    view.clearSections();
    sections.forEach((section, index) => {
      const sectionView = view.renderSection(
        section.items,
        index,
        this.eListRowSelected.bind(this),
      );
      if (sectionView) {
        setPreviewSectionHeaderAction(
          sectionView,
          section.label,
          getPreviewSectionActionLabel(section.action),
          async () => {
            try {
              await processPreviewSectionAction(this, section);
            } catch (error) {
              console.error("Unassigned preview section action failed", error);
              showNotification(
                "Failed to process section",
                UINotificationType.NEGATIVE,
              );
            }
          },
        );
        sectionView.removeFooter?.();
      }
    });

    if (!isPhone()) {
      const current = this.viewmodel.current?.();
      const currentId = current?.id;
      if (JSUtils.isNumber(currentId)) {
        view.selectListRow(currentId);
      }
    }
  };
};
