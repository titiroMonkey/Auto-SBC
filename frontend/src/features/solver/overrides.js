let ppView;
let ppController;
// Global variables to store SBC context for player picks
let currentPickSbcId = 0;
let currentPickChallengeId = 0;

const pickFlowSync = {
  token: 0,
  resolve: null,
  promise: null,
};

const beginPickFlow = () => {
  pickFlowSync.token += 1;
  pickFlowSync.promise = new Promise((resolve) => {
    pickFlowSync.resolve = resolve;
  });
  return pickFlowSync.token;
};

const completePickFlow = (result) => {
  if (typeof pickFlowSync.resolve === "function") {
    pickFlowSync.resolve(result);
  }
  pickFlowSync.resolve = null;
};

const waitForPickFlow = async (token, timeoutMs = 30000) => {
  if (!pickFlowSync.promise || pickFlowSync.token !== token) {
    return { success: true, reason: "no-active-pick-flow" };
  }

  return await Promise.race([
    pickFlowSync.promise,
    new Promise((resolve) => {
      setTimeout(
        () =>
          resolve({
            success: false,
            timedOut: true,
            reason: "pick-flow-timeout",
          }),
        timeoutMs,
      );
    }),
  ]);
};

window.__autoSbcBeginPickFlow = beginPickFlow;
window.__autoSbcCompletePickFlow = completePickFlow;
window.__autoSbcWaitForPickFlow = waitForPickFlow;

const getPlayerPickPrice = (item) => {
  const price = getPrice(item);
  return typeof price === "number" && Number.isFinite(price) ? price : null;
};

const sortPlayerPickItems = (items = []) => {
  return [...items].sort((left, right) => {
    const leftRating = left?.rating ?? 0;
    const rightRating = right?.rating ?? 0;

    // Always prefer the highest rated pick.
    const ratingDiff = rightRating - leftRating;
    if (ratingDiff !== 0) {
      return ratingDiff;
    }

    // Tie-breaker: price. Items without a known price rank last.
    const leftPrice = getPlayerPickPrice(left);
    const rightPrice = getPlayerPickPrice(right);

    if (leftPrice == null && rightPrice == null) {
      return 0;
    }
    if (leftPrice == null) {
      return 1;
    }
    if (rightPrice == null) {
      return -1;
    }

    return rightPrice - leftPrice;
  });
};

const getPackAnimationFilterRule = () => {
  if (typeof normalizePackAnimationFilterRule === "function") {
    return normalizePackAnimationFilterRule(
      getSettings(0, 0, "animateWalkoutItems"),
    );
  }
  return getSettings(0, 0, "animateWalkoutItems");
};

const itemMatchesPackAnimationFilter = (item) => {
  const rule = getPackAnimationFilterRule();
  if (!item || !Array.isArray(rule?.filters) || !rule.filters.length) {
    return false;
  }
  if (typeof matchesUnassignedRule === "function") {
    return matchesUnassignedRule(item, rule);
  }
  return false;
};

const UNASSIGNED_GRID_STYLE_ID = "autosbc-unassigned-grid-style";
const UNASSIGNED_GRID_BODY_CLASS = "autosbc-unassigned-grid";

const normalizeEntityTypeForLargeView = (entity) => {
  if (!entity || typeof entity !== "object") return entity;
  if (typeof entity.type !== "undefined") return entity;

  if (typeof entity.itemType !== "undefined") {
    entity.type = entity.itemType;
    return entity;
  }

  if (
    typeof entity.isPlayer === "function" &&
    entity.isPlayer() &&
    typeof globalThis.ItemType?.PLAYER !== "undefined"
  ) {
    entity.type = globalThis.ItemType.PLAYER;
  }

  return entity;
};

const buildLargeViewEntityCandidates = (item) => {
  const candidates = [];

  const pushCandidate = (candidate) => {
    if (!candidate || typeof candidate !== "object") return;
    candidates.push(normalizeEntityTypeForLargeView(candidate));
  };

  pushCandidate(item);
  pushCandidate(item?._item);

  if (typeof toSerializableConcept === "function") {
    const payload = toSerializableConcept(item) || toSerializableConcept(item?._item);
    if (payload && typeof createUtItemEntity === "function") {
      const hydrated = createUtItemEntity(payload);
      pushCandidate(hydrated);
    }
  }

  if (typeof createUtItemEntity === "function") {
    const defId = Number(
      item?.resourceId || item?.definitionId || item?.eaId || item?._staticData?.id || 0,
    );
    if (Number.isFinite(defId) && defId > 0) {
      const minimalPayload = {
        id: Number(item?.id || 0),
        resourceId: defId,
        assetId: Number(item?.assetId || defId),
        itemType:
          typeof item?.itemType !== "undefined"
            ? item.itemType
            : typeof globalThis.ItemType?.PLAYER !== "undefined"
              ? globalThis.ItemType.PLAYER
              : 1,
        rating: Number(item?.rating || item?._staticData?.rating || 0),
        rareflag: Number(item?.rareflag || item?._staticData?.rareflag || 0),
        owners: Number(item?.owners || 0),
      };
      const minimalEntity = createUtItemEntity(minimalPayload);
      pushCandidate(minimalEntity);
    }
  }

  return candidates;
};

const createUnassignedLargeItemRow = (item, tapCallback) => {
  const Factory = globalThis.UTItemViewFactory;
  if (!Factory || typeof Factory.createLargeItem !== "function") {
    return null;
  }

  let itemView = null;
  let itemRoot = null;
  let renderedEntity = null;
  const candidates = buildLargeViewEntityCandidates(item);
  for (const candidate of candidates) {
    try {
      const view = Factory.createLargeItem(candidate);
      view?.init?.();
      view.supportSecondaryViews = false;
      view?.render?.(candidate);
      const root = view?.getRootElement?.() || null;
      if (view && root) {
        itemView = view;
        itemRoot = root;
        renderedEntity = candidate;
        break;
      }
      try {
        view?.dealloc?.();
      } catch {}
    } catch {}
  }

  if (!itemView || !itemRoot) {
    let fallbackRoot = null;
    let selected = false;

    const ensureFallbackRoot = () => {
      if (fallbackRoot) return fallbackRoot;
      fallbackRoot = document.createElement("li");
      fallbackRoot.classList.add("ut-item-table-row");
      fallbackRoot.classList.add("autosbc-unassigned-grid-row");
      const label = document.createElement("div");
      label.style.fontSize = "12px";
      label.style.opacity = "0.9";
      label.style.padding = "8px";
      label.style.textAlign = "center";
      label.textContent = String(
        item?._staticData?.name || item?.name || item?.definitionId || "Item",
      );
      fallbackRoot.appendChild(label);
      if (tapCallback) {
        fallbackRoot.addEventListener("click", () => {
          try {
            tapCallback(item);
          } catch {}
        });
      }
      fallbackRoot.classList.toggle("selected", selected);
      return fallbackRoot;
    };

    return {
      data: item,
      getData() {
        return item;
      },
      setSelected(next) {
        selected = !!next;
        ensureFallbackRoot().classList.toggle("selected", selected);
      },
      render() {
        ensureFallbackRoot();
      },
      getRootElement() {
        return ensureFallbackRoot();
      },
      onTimedUpdate() {},
      dealloc() {
        fallbackRoot = null;
      },
    };
  }

  let root = null;
  let selected = false;

  const ensureBuilt = () => {
    if (root) return root;

    root = document.createElement("li");
    root.classList.add("ut-item-table-row");
    root.classList.add("autosbc-unassigned-grid-row");
    root.appendChild(itemRoot);

    if (tapCallback) {
      root.addEventListener("click", () => {
        try {
          tapCallback(renderedEntity || item);
        } catch {}
      });
    }

    if (selected) {
      root.classList.add("selected");
    }

    return root;
  };

  return {
    data: item,
    getData() {
      return item;
    },
    setSelected(next) {
      selected = !!next;
      const el = ensureBuilt();
      el.classList.toggle("selected", selected);
    },
    render() {
      ensureBuilt();
      try {
        itemView?.render?.(renderedEntity || item);
      } catch {}
    },
    getRootElement() {
      return ensureBuilt();
    },
    onTimedUpdate() {
      try {
        itemView?.onTimedUpdate?.();
      } catch {}
    },
    dealloc() {
      try {
        itemView?.dealloc?.();
      } catch {}
      itemView = null;
      root = null;
    },
  };
};

const ensureUnassignedGridStyle = () => {
  let style = document.getElementById(UNASSIGNED_GRID_STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = UNASSIGNED_GRID_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = `
    body.${UNASSIGNED_GRID_BODY_CLASS} .ut-unassigned-view .ut-sectioned-item-list-view .itemList {
      --autosbc-unassigned-card-width: 144px;
      --autosbc-unassigned-card-height: 200px;
      --autosbc-unassigned-target-columns: 10;
      --autosbc-unassigned-scale: min(
        1,
        calc(
          (100vw - 160px) /
            (var(--autosbc-unassigned-target-columns) * var(--autosbc-unassigned-card-width))
        )
      );
      --autosbc-unassigned-fit-width: calc(
        var(--autosbc-unassigned-card-width) * var(--autosbc-unassigned-scale)
      );
      --autosbc-unassigned-fit-height: calc(
        var(--autosbc-unassigned-card-height) * var(--autosbc-unassigned-scale)
      );
      display: grid;
      grid-template-columns: repeat(
        auto-fit,
        minmax(var(--autosbc-unassigned-fit-width), var(--autosbc-unassigned-fit-width))
      );
      grid-auto-rows: max-content;
      align-items: start;
      justify-content: center;
      align-content: start;
      gap: calc(6px * var(--autosbc-unassigned-scale));
      padding: 4px 8px;
      margin: 0;
      list-style: none;
    }
    body.${UNASSIGNED_GRID_BODY_CLASS} .ut-unassigned-view .ut-sectioned-item-list-view {
      margin: 0 !important;
      padding: 0 !important;
    }
    body.${UNASSIGNED_GRID_BODY_CLASS} .ut-unassigned-view .ut-sectioned-item-list-view .itemList > * {
      width: var(--autosbc-unassigned-fit-width);
      min-width: var(--autosbc-unassigned-fit-width);
      max-width: var(--autosbc-unassigned-fit-width);
      height: auto;
      min-height: 0;
      max-height: none;
      max-width: none;
      margin: 0;
    }
    body.${UNASSIGNED_GRID_BODY_CLASS} .ut-unassigned-view .ut-sectioned-item-list-view .itemList > *.autosbc-unassigned-grid-row {
      display: flex;
      align-items: flex-start;
      justify-content: center;
      min-height: 0;
      padding: 0;
      background: transparent;
      border: 0;
      box-shadow: none;
    }
    body.${UNASSIGNED_GRID_BODY_CLASS} .ut-unassigned-view .ut-sectioned-item-list-view .itemList > *.autosbc-unassigned-grid-row > * {
      width: var(--autosbc-unassigned-card-width);
      max-width: var(--autosbc-unassigned-card-width);
      max-height: var(--autosbc-unassigned-card-height);
      zoom: var(--autosbc-unassigned-scale);
      transform-origin: top center;
      margin: 0;
    }
    body.${UNASSIGNED_GRID_BODY_CLASS} .ut-unassigned-view .ut-split-view > .ut-content,
    body.${UNASSIGNED_GRID_BODY_CLASS} .ut-split-view > .ut-content:has(.ut-unassigned-view) {
      max-width: none;
    }
  `;
};

// The unassigned grid layout is driven entirely by injected CSS scoped to
// `.ut-unassigned-view`. Toggling the body class is all that is required and it
// survives EA re-rendering the list rows on every refresh.
const applyUnassignedGridLayoutIfEnabled = () => {
  ensureUnassignedGridStyle();
  const enabled = !!getUnassignedToggle("unassignedGrid4Col");
  document.body.classList.toggle(UNASSIGNED_GRID_BODY_CLASS, enabled);
};

const unassignedItemsOverride = () => {
  const unassignedViewProto = globalThis.UTUnassignedItemsView?.prototype;
  const sectionedListProto = globalThis.UTSectionedItemListView?.prototype;
  const unassignedControllerProto =
    globalThis.UTUnassignedItemsViewController?.prototype;

  if (
    unassignedViewProto &&
    sectionedListProto &&
    !sectionedListProto.__autoSbcUnassignedLargeGridPatched
  ) {
    unassignedViewProto.renderSection = function (items, sectionId, onTap) {
      let section = this.sections?.[sectionId];
      if (!section) {
        section = new UTSectionedItemListView();
        section.init?.();
        this.sections[sectionId] = section;
      } else {
        section.clearList?.();
      }

      section.__autoSbcUseLargeGridRows = !!getUnassignedToggle(
        "unassignedGrid4Col",
      );

      if ((items || []).length === 0) {
        try {
          DOMKit.remove(section.getRootElement?.());
        } catch {}
        return section;
      }

      section.addItems(items, onTap, ListItemPriority.PLAYER_STATS);
      section.render();

      const root = this.getRootElement?.();
      if (root) {
        DOMKit.empty(root);
        (this.sections || []).forEach((entry) => {
          const sectionRoot = entry?.getRootElement?.();
          if (sectionRoot) root.appendChild(sectionRoot);
        });
      }

      return section;
    };

    const baseGenerateListRow = sectionedListProto.generateListRow;
    sectionedListProto.generateListRow = function (item, tapCallback, priority) {
      if (
        this?.__autoSbcUseLargeGridRows &&
        getUnassignedToggle("unassignedGrid4Col")
      ) {
        return createUnassignedLargeItemRow(item, tapCallback);
      }

      return baseGenerateListRow.call(this, item, tapCallback, priority);
    };

    sectionedListProto.__autoSbcUnassignedLargeGridPatched = true;
  }

  if (
    unassignedControllerProto &&
    !unassignedControllerProto.__autoSbcSectionProcessButtonsPatched
  ) {
    const showNoItems = (label) => {
      showNotification(
        `No items to ${label.toLowerCase()}`,
        UINotificationType.NEUTRAL,
      );
    };

    const refreshUnassigned = (controller) => {
      try {
        controller?.getUnassignedItems?.(false);
      } catch {}
    };

    const patchSectionButton = (
      methodName,
      sectionId,
      getItems,
      label,
      destinationPile,
    ) => {
      const baseMethod = unassignedControllerProto[methodName];
      if (typeof baseMethod !== "function") {
        return;
      }

      unassignedControllerProto[methodName] = function (...args) {
        const result = baseMethod.apply(this, args);

        const section = this.getView?.()?.getSection?.(sectionId);
        if (!section) {
          return result;
        }

        section.setActionHeader(
          section._header?.getText?.() || "",
          label,
          async () => {
            const sourceItems = getItems(this) || [];
            const actionableItems = sourceItems.filter(Boolean);

            if (!actionableItems.length) {
              showNoItems(label);
              return;
            }

            try {
              services.Item.move(actionableItems, destinationPile);
              showNotification(
                `${label} (${actionableItems.length})`,
                UINotificationType.POSITIVE,
              );
              if (!window.__autoSbcSolveRunInBackground) {
                goToUnassignedView();
              }
            } catch (err) {
              console.warn(
                "[unassignedItemsOverride] section action failed",
                err,
              );
              showNotification(
                "Failed to process items",
                UINotificationType.NEGATIVE,
              );
            }

            refreshUnassigned(this);
          },
        );

        return result;
      };
    };

    patchSectionButton(
      "updateItemSectionOptions",
      UTUnassignedItemsViewModel.SECTION.ITEMS,
      (controller) =>
        controller?.viewmodel
          ?.getRegularItemsSection?.()
          ?.filter((item) => item?.isMovable?.()) || [],
      "Send all to club",
      7,
    );

    patchSectionButton(
      "updateDuplicateSectionOptions",
      UTUnassignedItemsViewModel.SECTION.DUPLICATES,
      (controller) => controller?.viewmodel?.getTradeableDuplicates?.() || [],
      "Send all to transfer list",
      5,
    );

    patchSectionButton(
      "updateUntradeableDuplicateSectionOptions",
      UTUnassignedItemsViewModel.SECTION.UNTRADABLEDUPLICATES,
      (controller) => controller?.viewmodel?.getUntradeableDuplicates?.() || [],
      "Send all to storage",
      10,
    );

    unassignedControllerProto.__autoSbcSectionProcessButtonsPatched = true;
  }

  const popupDisplay = PopupQueueViewController.prototype.displayPopup;
  PopupQueueViewController.prototype.displayPopup = function (e) {
    popupDisplay.call(this, e);

    if (this.queue[0] instanceof UTGameRewardsViewController) {
      const keepRewardsPopupForBackgroundAutoOpen =
        !!window.__autoSbcSolveRunInBackground &&
        !!getSettings(0, 0, "autoOpenPacks");

      if (keepRewardsPopupForBackgroundAutoOpen) {
        return;
      }

      this.closeActivePopup();
      if (!window.__autoSbcSolveRunInBackground) {
        goToUnassignedView();
      }
    }
  };
  UTSectionedItemListView.prototype.addItems = function (e, t, i) {
    e.sort(function (a, b) {
      return getSBCPrice(b) - getSBCPrice(a);
    });
    var o = this;
    return (
      void 0 === i && (i = ListItemPriority.DEFAULT),
      (this.listRows = e.map(function (e) {
        return o.generateListRow(e, t, i);
      })),
      this.listRows
    );
  };

  const unassignedItems = UTSectionedItemListView.prototype.render;
  UTSectionedItemListView.prototype.render = function (...args) {
    const rows = Array.isArray(this.listRows) ? this.listRows : [];
    const players = rows.map((row) => row?.data).filter(Boolean);

    if (players.length) {
      fetchPlayerPrices(players, {
        waitForCompletion: false,
        suppressNotification: true,
      });
    }

    const renderResult = unassignedItems.apply(this, args);
    applyUnassignedGridLayoutIfEnabled();
    return renderResult;
  };
  const ppItems = UTPlayerPicksView.prototype.setCarouselItems;
  UTPlayerPicksView.prototype.setCarouselItems = async function (...args) {
    // Wait for prices so sortPlayerPickItems ranks by real price, not a
    // rating-only fallback (prices are null until the fetch resolves).
    await fetchPlayerPrices(args[0], {
      waitForCompletion: true,
      suppressNotification: true,
    });

    // Only show player picks when they match the configured item filter.
    const hasFilteredPlayer = args[0].some((player) =>
      itemMatchesPackAnimationFilter(player),
    );

    // console.table(
    //   args[0]
    //     .sort(function (t, e) {
    //       const priceDiff = getPrice(e) - getPrice(t);
    //       if (priceDiff === 0) {
    //         return e.rating - t.rating;
    //       }
    //       return priceDiff;
    //     })
    //     .map((item) => {
    //       return {
    //         name: item._staticData.name,
    //         cardType:
    //           (item.isSpecial()
    //             ? ""
    //             : services.Localization.localize(
    //                 "search.cardLevels.cardLevel" + item.getTier(),
    //               ) + " ") +
    //           services.Localization.localize("item.raretype" + item.rareflag),
    //         rating: item.rating,
    //         futggPrice: getPrice(item),
    //         sbcPrice: getSBCPrice(item),
    //         fodderPrice: getPrice({ definitionId: item.rating + "_CBR" }),
    //         isFodder: isFodder(item),
    //       };
    //     }),
    // );
    // console.log("Has filtered player:", hasFilteredPlayer);
    if (hasFilteredPlayer) {
      console.log("tada");
      let packs = await getPacks();
      await showPack(packs.packs[0], {
        items: sortPlayerPickItems(args[0]),
      });
    }
    args[0] = sortPlayerPickItems(args[0]);

    ppItems.call(this, ...args);
    for (i = 0; i < this.eventDelegates[0].availablePicks; i++) {
      this._carouselItemsContainer._subviews[i].view.setSelected(1);
    }
  };

  const ppRender = UTPlayerPicksViewController.prototype.render;

  UTPlayerPicksViewController.prototype.render = async function (...args) {
    try {
      ppController = this;
      // Wait for prices before choosing selectedPicks — this is the array EA
      // actually confirms (confirmPlayerPickItemSelection), so it must be
      // sorted by loaded prices, not the rating-only fallback.
      await fetchPlayerPrices(this.picks, {
        waitForCompletion: true,
        suppressNotification: true,
      });
      this.selectedPicks = sortPlayerPickItems(this.picks).slice(
        0,
        this.availablePicks,
      );

      await ppRender.call(this, ...args);

      // Get sbcId and challengeId from global variables
      const sbcId = currentPickSbcId;
      const challengeId = currentPickChallengeId;
      const optionDefinitionIds = (this.picks || [])
        .map((pick) => Number(pick?.definitionId))
        .filter(
          (definitionId) => Number.isFinite(definitionId) && definitionId > 0,
        );
      const selectedDefinitionIds = (this.selectedPicks || [])
        .map((pick) => Number(pick?.definitionId))
        .filter(
          (definitionId) => Number.isFinite(definitionId) && definitionId > 0,
        );

      if (getSettings(sbcId, challengeId, "autoConfirmPicks")) {
        const {
          container: statusContainer,
          content: statusContent,
          footer: timerFooter,
        } = ensureStatusContainer();

        statusContainer.style.display = "flex";
        statusContent.innerHTML = "Auto Confirm Picks in:";
        timerFooter.textContent = "";

        const titleBlock = document.createElement("div");
        titleBlock.style.textAlign = "center";
        titleBlock.textContent = "Auto Confirm Picks";
        titleBlock.style.fontWeight = "bold";
        titleBlock.style.marginBottom = "0.35rem";

        statusContainer.dataset.cancelAutoConfirm = "false";
        const closeBtn = statusContainer.querySelector("button");
        if (closeBtn && !closeBtn.dataset.autoConfirmHooked) {
          closeBtn.dataset.autoConfirmHooked = "true";
          closeBtn.addEventListener("click", () => {
            statusContainer.dataset.cancelAutoConfirm = "true";
          });
        }

        let remaining = 3000;
        while (remaining > 0) {
          if (statusContainer.dataset.cancelAutoConfirm === "true") break;
          timerFooter.textContent = `${Math.ceil(remaining / 1000)}s`;
          timerFooter.style.textAlign = "center";
          await sleep(200);
          remaining -= 200;
        }

        const canceled = statusContainer.dataset.cancelAutoConfirm === "true";
        statusContainer.style.display = "none";
        statusContent.innerHTML = "";
        timerFooter.textContent = "";

        if (canceled) {
          completePickFlow({
            success: false,
            canceled: true,
            reason: "auto-confirm-canceled",
          });
          return;
        }

        ppController.view._triggerActions(UTPlayerPicksView.Event.CONTINUE);

        const confirmResult = await new Promise((resolve, reject) => {
          ppController.view
            ._triggerActions(UTPlayerPicksView.Event.CONFIRM_PICK)
            .observe((result) => {
              console.log("Pick confirmation result:", result);
              if (result && result.success !== false) {
                resolve(result);
              } else {
                reject(new Error("Pick confirmation failed"));
              }
            });
        });

        // Additional wait to ensure all async operations complete
        await sleep(1000);
        completePickFlow({
          success: true,
          autoConfirmed: true,
          confirmResult,
          optionDefinitionIds,
          selectedDefinitionIds,
        });
      } else {
        completePickFlow({
          success: true,
          autoConfirmed: false,
          reason: "render-finished",
          optionDefinitionIds,
          selectedDefinitionIds,
        });
      }
    } catch (error) {
      console.error("Player pick render/confirm flow failed:", error);
      completePickFlow({ success: false, error: String(error) });
    } finally {
      // Reset IDs only after auto-confirm process fully completes
      currentPickSbcId = 0;
      currentPickChallengeId = 0;
    }
  };
};
