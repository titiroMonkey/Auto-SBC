const sbcButtonOverride = () => {
  const UTSBCSetTileView_render = UTSBCSetTileView.prototype.render;
  UTSBCSetTileView.prototype.render = function render() {
    UTSBCSetTileView_render.call(this);
    if (this.data) {
      insertBefore(
        createElem("span", null, `COMPLETED: ${this.data.timesCompleted}. `),
        this.__rewardsHeader,
      );
    }
  };
};
const ensureStatusContainer = () => {
  const stackRootId = "sbc-status-stack-root";
  let stackRoot = document.getElementById(stackRootId);
  if (!stackRoot) {
    stackRoot = document.createElement("div");
    stackRoot.id = stackRootId;
    stackRoot.style.position = "fixed";
    stackRoot.style.right = "2rem";
    stackRoot.style.bottom = "1.5rem";
    stackRoot.style.zIndex = "9999";
    stackRoot.style.display = "flex";
    stackRoot.style.flexDirection = "column-reverse";
    stackRoot.style.gap = "0.75rem";
    stackRoot.style.alignItems = "flex-end";
    stackRoot.style.pointerEvents = "none";
    document.body.appendChild(stackRoot);
  }

  const statusContainerId = "quick-buy-squad-status";
  let container = document.getElementById(statusContainerId);
  if (!container) {
    container = document.createElement("div");
    container.id = statusContainerId;
    container.className = "quick-buy-squad-status";
    container.style.padding = "0.75rem";
    container.style.background = "rgba(17, 24, 39, 0.9)";
    container.style.border = "1px solid rgba(255, 255, 255, 0.15)";
    container.style.borderRadius = "10px";
    container.style.display = "none";
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
    closeButton.setAttribute("aria-label", "Close quick buy status");
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
    closeButton.addEventListener("click", () => {
      if (typeof container.__onClose === "function") {
        try {
          container.__onClose();
        } catch {}
      }
      container.style.display = "none";
      window.__unassignedHistoryPinned = false;
    });

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

    container.append(closeButton, content, footer);
    stackRoot.appendChild(container);
  } else if (
    !container.parentElement ||
    container.parentElement.id !== stackRootId
  ) {
    stackRoot.appendChild(container);
  }

  const content = container.querySelector(".quick-buy-squad-content");
  const footer = container.querySelector(".quick-buy-squad-footer");
  return { container, content, footer };
};

const tryQuickBuy = async (
  context = {},
  item,
  options = {},
  currentSbcId = 0,
  currentChallengeId = 0,
  overridePermittedCap = null,
) => {
  const QUICK_BUY_BID_TIMEOUT_MS = 15000;
  let sbcId = currentSbcId;
  let challengeId = currentChallengeId;

  if (!sbcId && !challengeId) {
    const { _challenge } = getControllerInstance() || {};
    sbcId = _challenge?.setId ?? 0;
    challengeId = _challenge?.id ?? 0;
  }

  const { suppressNotifications = false } = options;
  const excludedTradeIds = new Set(
    (options?.excludeTradeIds || [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0),
  );
  const excludedItemIds = new Set(
    (options?.excludeItemIds || [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0),
  );
  const notify = (message, type) => {
    if (!suppressNotifications) {
      showNotification(message, type);
    }
  };

  const buttonRoot = context?.quickBuyButton
    ? context.quickBuyButton.__root || context.quickBuyButton
    : null;

  try {
    const baselinePrice = Number(getPrice(item));
    const maxPerPlayerSetting = Number(
      getSettings(sbcId, challengeId, "sbcBuyConceptsMaxPrice"),
    );
    const maxAboveSetting = Number(
      getSettings(sbcId, challengeId, "sbcBuyConceptsPriceAbove"),
    );

    const maxPerPlayer =
      Number.isFinite(maxPerPlayerSetting) && maxPerPlayerSetting > 0
        ? maxPerPlayerSetting
        : 15000;
    const maxAbove =
      Number.isFinite(maxAboveSetting) && maxAboveSetting >= 0
        ? maxAboveSetting
        : 0;

    if (!Number.isFinite(baselinePrice) || baselinePrice <= 0) {
      notify("No cached price available", UINotificationType.NEGATIVE);
      return { success: false, reason: "noCachedPrice" };
    }

    const listing = await fetchLivePlayerPrice(item, {
      suppressNotification: true,
      excludeTradeIds: Array.from(excludedTradeIds),
      excludeItemIds: Array.from(excludedItemIds),
    });
    const listingPrice = Number(listing?._auction?.buyNowPrice);
    const listingTradeId = Number(
      listing?._auction?.tradeId ?? listing?._auction?.id ?? 0,
    );
    const listingItemId = Number(listing?.id ?? 0);
    if (!Number.isFinite(listingPrice) || listingPrice <= 0) {
      notify("No active listing found", UINotificationType.NEGATIVE);
      return { success: false, reason: "noListing" };
    }

    const lowestPrice = listingPrice;
    const priceLabel = lowestPrice.toLocaleString();
    if (buttonRoot?.setAttribute) {
      buttonRoot.setAttribute("title", `Quick Buy @${priceLabel}`);
    }

    const permittedCap =
      Number.isFinite(overridePermittedCap) && overridePermittedCap > 0
        ? Math.min(maxPerPlayer, overridePermittedCap)
        : Number.isFinite(baselinePrice) && baselinePrice > 0
          ? Math.min(maxPerPlayer, baselinePrice + maxAbove)
          : maxPerPlayer;

    if (
      Number.isFinite(permittedCap) &&
      lowestPrice > permittedCap
    ) {
      notify(
        `Quick buy skipped – ${priceLabel} exceeds limit (${permittedCap.toLocaleString()})`,
        UINotificationType.NEGATIVE,
      );
      return {
        success: false,
        reason: "priceAboveThreshold",
        price: lowestPrice,
        priceLabel,
        baseline: baselinePrice,
        baselineLabel: Number.isFinite(baselinePrice)
          ? baselinePrice.toLocaleString()
          : null,
        limit: permittedCap,
        limitLabel: Number.isFinite(permittedCap)
          ? permittedCap.toLocaleString()
          : null,
        tradeId: Number.isFinite(listingTradeId) && listingTradeId > 0
          ? listingTradeId
          : null,
        itemId:
          Number.isFinite(listingItemId) && listingItemId > 0
            ? listingItemId
            : null,
      };
    }

    const bidAttempt = services.Item.bid(listing, lowestPrice);
    if (bidAttempt && typeof bidAttempt.observe === "function") {
      return await new Promise((resolve) => {
        let settled = false;
        const finish = (payload) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          resolve(payload);
        };

        const timeoutId = setTimeout(() => {
          notify("Quick buy timed out", UINotificationType.NEGATIVE);
          finish({
            success: false,
            reason: "bidTimeout",
            price: lowestPrice,
            priceLabel,
            tradeId: Number.isFinite(listingTradeId) && listingTradeId > 0
              ? listingTradeId
              : null,
            itemId:
              Number.isFinite(listingItemId) && listingItemId > 0
                ? listingItemId
                : null,
          });
        }, QUICK_BUY_BID_TIMEOUT_MS);

        bidAttempt.observe(context, async (_obs, response) => {
          try {
            _obs?.unobserve?.(context);
          } catch {}

          const success = response?.success !== false;
          if (success) {
            Promise.resolve(
              processUnassigned({ suppressNavigation: true }),
            ).catch((err) => {
              console.error("processUnassigned error", err);
            });
          }
          notify(
            success ? `Quick buy success at ${priceLabel}` : "Quick buy failed",
            success ? UINotificationType.POSITIVE : UINotificationType.NEGATIVE,
          );
          finish({
            success,
            reason: success ? "success" : "bidFailed",
            price: lowestPrice,
            priceLabel,
            tradeId: Number.isFinite(listingTradeId) && listingTradeId > 0
              ? listingTradeId
              : null,
            itemId:
              Number.isFinite(listingItemId) && listingItemId > 0
                ? listingItemId
                : null,
          });
        });
      });
    }

    notify(`Quick buy attempted at ${priceLabel}`, UINotificationType.POSITIVE);
    return {
      success: true,
      reason: "attempted",
      price: lowestPrice,
      priceLabel,
      tradeId: Number.isFinite(listingTradeId) && listingTradeId > 0
        ? listingTradeId
        : null,
      itemId:
        Number.isFinite(listingItemId) && listingItemId > 0
          ? listingItemId
          : null,
    };
  } catch (error) {
    console.error("Quick buy error", error);
    notify("Quick buy encountered an error", UINotificationType.NEGATIVE);
    return { success: false, reason: "error", error };
  }
};

const quickListItem = async (item, options = {}) => {
  const {
    context = {},
    durationSeconds = 60 * 60,
    suppressNotifications = false,
    min = -1,
    max = -1,
  } = options;

  const notify = (message, type) => {
    if (!suppressNotifications) {
      showNotification(message, type);
    }
  };

  try {
    // Guard: don't list if transfer list is full
    try {
      await clearSoldItems();

      let transferItems = [];
      if (typeof getTransferItems === "function") {
        transferItems = await getTransferItems();
      } else if (typeof fetchTransferList === "function") {
        transferItems = await fetchTransferList();
      } else if (services?.Item?.requestTransferItems) {
        transferItems = await new Promise((resolve, reject) => {
          try {
            services.Item.requestTransferItems().observe(null, (obs, event) => {
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
            });
          } catch (err) {
            reject(err);
          }
        });
      }

      const transferCount = Array.isArray(transferItems)
        ? transferItems.length
        : 0;

      const itemTradeId = Number(item?._auction?.tradeId ?? item?._auction?.id);
      const itemId = Number(item?.id);
      const itemTradeState = String(
        item?._auction?.tradeState || item?._auction?._tradeState || "",
      ).toLowerCase();

      const isAlreadyOnTransferList =
        itemTradeState === "active" ||
        itemTradeState === "expired" ||
        itemTradeState === "closed" ||
        transferItems.some((transferItem) => {
          const transferTradeId = Number(
            transferItem?._auction?.tradeId ?? transferItem?._auction?.id,
          );
          const transferItemId = Number(transferItem?.id);
          return (
            (Number.isFinite(itemTradeId) &&
              itemTradeId > 0 &&
              Number.isFinite(transferTradeId) &&
              transferTradeId === itemTradeId) ||
            (Number.isFinite(itemId) &&
              itemId > 0 &&
              Number.isFinite(transferItemId) &&
              transferItemId === itemId)
          );
        });

      if (transferCount >= 100 && !isAlreadyOnTransferList) {
        notify(
          `Transfer list full (${transferCount}/100) - skipping listing`,
          UINotificationType.NEUTRAL,
        );
        return { success: false, reason: "transferListFull", transferCount };
      }
    } catch (err) {
      console.warn("Failed to read transfer list; skipping listing", err);
      notify(
        "Failed to read transfer list - skipping listing",
        UINotificationType.NEGATIVE,
      );
      return { success: false, reason: "transferListReadFailed", error: err };
    }
    if (!item) {
      notify("No item selected", UINotificationType.NEGATIVE);
      return { success: false, reason: "noItem" };
    }

    if (!item?.tradable) {
      notify("Item is not tradable", UINotificationType.NEGATIVE);
      return { success: false, reason: "notTradable" };
    }
    // If caller provides explicit min/buyNow, skip price refresh and list using those values.
    const hasExplicitPrices =
      Number.isFinite(min) && min > 0 && Number.isFinite(max) && max > 0;

    if (hasExplicitPrices) {
      const buyNow = Math.floor(max);
      let minPrice = Math.floor(min);

      // Ensure min is valid and below buyNow (EA listing rules).
      if (!Number.isFinite(minPrice) || minPrice <= 0) {
        minPrice = Math.max(150, buyNow - 50);
      }
      if (minPrice >= buyNow) {
        minPrice = Math.max(150, buyNow - 50);
      }

      if (!services?.Item?.list) {
        notify("Listing service unavailable", UINotificationType.NEGATIVE);
        return { success: false, reason: "noListService" };
      }

      const req = services.Item.list(item, minPrice, buyNow, durationSeconds);
      if (!req || typeof req.observe !== "function") {
        notify("Failed to start listing", UINotificationType.NEGATIVE);
        return { success: false, reason: "listNotObservable" };
      }

      const response = await new Promise((resolve) => {
        req.observe(context, (sender, res) => {
          try {
            sender?.unobserve?.(context);
          } catch {}
          resolve(res);
        });
      });

      const success = response?.success !== false;
      notify(
        success
          ? `Listed for ${buyNow.toLocaleString()} (${minPrice.toLocaleString()} min)`
          : "Quick list failed",
        success ? UINotificationType.POSITIVE : UINotificationType.NEGATIVE,
      );

      try {
        getControllerInstance()?.applyDataChange?.();
      } catch {}

      return {
        success,
        reason: success ? "listed" : "failed",
        buyNow,
        minPrice,
        durationSeconds,
        raw: response,
      };
    }
    // Refresh current price (prefer live listing) then list.
    const buyNowBeforeRefresh = Number(getPrice(item));
    let buyNow = buyNowBeforeRefresh;
    if (typeof fetchLivePlayerPrice === "function" && item?.isPlayer?.()) {
      const listing = await fetchLivePlayerPrice(item);
      const listingPrice = Number(listing?._auction?.buyNowPrice);
      if (Number.isFinite(listingPrice) && listingPrice > 0) {
        // Do not list if the refreshed price decreased.
        if (
          Number.isFinite(buyNowBeforeRefresh) &&
          buyNowBeforeRefresh > 0 &&
          listingPrice < buyNowBeforeRefresh
        ) {
          // Still update the cache so UI stays accurate.
          try {
            PriceItem({
              [item.definitionId]: {
                eaId: item.definitionId,
                price: listingPrice,
                rating: item.rating,
                type: "PLAYER",
              },
            });
          } catch {}

          notify(
            `Price dropped (${buyNowBeforeRefresh.toLocaleString()} → ${listingPrice.toLocaleString()}); not listing`,
            UINotificationType.NEGATIVE,
          );
          return {
            success: false,
            reason: "priceDecreased",
            before: buyNowBeforeRefresh,
            after: listingPrice,
          };
        }

        buyNow = listingPrice;
        try {
          PriceItem({
            [item.definitionId]: {
              eaId: item.definitionId,
              price: listingPrice,
              rating: item.rating,
              type: "PLAYER",
            },
          });
        } catch {}
      }
    }

    if (!Number.isFinite(buyNow) || buyNow <= 0) {
      notify("No current price available", UINotificationType.NEGATIVE);
      return { success: false, reason: "noPrice" };
    }

    const getOneTierBelow = (value) => {
      try {
        if (
          typeof UTCurrencyInputControl !== "undefined" &&
          typeof UTCurrencyInputControl.getIncrementBelowVal === "function"
        ) {
          return UTCurrencyInputControl.getIncrementBelowVal(value);
        }
      } catch {}
      return Math.max(150, value - 50);
    };

    let minPrice = Number(getOneTierBelow(buyNow));
    if (!Number.isFinite(minPrice) || minPrice <= 0 || minPrice >= buyNow) {
      minPrice = Math.max(150, buyNow - 50);
    }

    if (!services?.Item?.list) {
      notify("Listing service unavailable", UINotificationType.NEGATIVE);
      return { success: false, reason: "noListService" };
    }

    const req = services.Item.list(item, minPrice, buyNow, durationSeconds);
    if (!req || typeof req.observe !== "function") {
      notify("Failed to start listing", UINotificationType.NEGATIVE);
      return { success: false, reason: "listNotObservable" };
    }

    const response = await new Promise((resolve) => {
      req.observe(context, (sender, res) => {
        try {
          sender?.unobserve?.(context);
        } catch {}
        resolve(res);
      });
    });

    const success = response?.success !== false;
    notify(
      success
        ? `Listed for ${buyNow.toLocaleString()} (${minPrice.toLocaleString()} min)`
        : "Quick list failed",
      success ? UINotificationType.POSITIVE : UINotificationType.NEGATIVE,
    );

    try {
      getControllerInstance()?.applyDataChange?.();
    } catch {}

    return {
      success,
      reason: success ? "listed" : "failed",
      buyNow,
      minPrice,
      durationSeconds,
      raw: response,
    };
  } catch (error) {
    console.error("Quick list error", error);
    notify("Quick list encountered an error", UINotificationType.NEGATIVE);
    return { success: false, reason: "error", error };
  }
};

// expose as global so it can be called from anywhere
window.quickListItem = quickListItem;

const lockedLabel = "SBC Unlock";
const unlockedLabel = "SBC Lock";
const fixedLabel = "SBC Use actual prices";
const unfixedLabel = "SBC Set Price to Zero";
