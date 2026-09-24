const sbcSubmitChallengeOverride = () => {
  const sbcSubmit = PopupQueueViewController.prototype.closeActivePopup;
  PopupQueueViewController.prototype.closeActivePopup = function () {
    sbcSubmit.call(this);
    createSBCTab();
    try {
      if (typeof ratingCountUI === "function") {
        void ratingCountUI();
      }
    } catch {}
  };
};
const sbcViewOverride = () => {
  UTSquadEntity.prototype._calculateRating = function () {
    var t = this.isSBC()
        ? this.getFieldPlayers()
        : this.getFieldAndSubPlayers(),
      e = services.Configuration.checkFeatureEnabled(
        UTServerSettingsRepository.KEY.SQUAD_RATING_FLOAT_CALCULATION_ENABLED,
      ),
      n = 0,
      r = UTSquadEntity.FIELD_PLAYERS;
    if (
      (t.forEach(function (t, e) {
        var i = t.item;
        i.isValid() &&
          ((n += i.rating), UTSquadEntity.FIELD_PLAYERS <= e && r++);
      }),
      e)
    ) {
      var o = n,
        a = o;

      (0 < r && (o /= r),
        (o = Math.min(o, 99)),
        t.forEach(function (t, e) {
          var i = t.item;
          if (i.isValid()) {
            if (i.rating <= o) return;
            a +=
              e < UTSquadEntity.FIELD_PLAYERS
                ? i.rating - o
                : 0.5 * (i.rating - o);
          }
        }),
        (n = Math.round(a, 2)));
    } else {
      var s = Math.min(Math.floor(n / r), 99);
      t.forEach(function (t, e) {
        var i = t.item;
        if (i.isValid()) {
          if (i.rating <= s) return;
          n +=
            e < UTSquadEntity.FIELD_PLAYERS
              ? i.rating - s
              : Math.floor(0.5 * (i.rating - s));
        }
      });
    }
    this._rating = new Intl.NumberFormat("en", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Math.min(Math.max(n / r, 0), 99));
  };

  const runQuickBuySquad = async (sbcSetId, challengeId, triggerButtonOrOptions) => {
    const hasOptionsObject =
      triggerButtonOrOptions &&
      typeof triggerButtonOrOptions === "object" &&
      ("squad" in triggerButtonOrOptions ||
        "squadPlayers" in triggerButtonOrOptions ||
        "triggerButton" in triggerButtonOrOptions);
    const options = hasOptionsObject ? triggerButtonOrOptions : {};
    const button = hasOptionsObject
      ? options.triggerButton || null
      : triggerButtonOrOptions || null;

    if (!sbcSetId || !challengeId) {
      throw new Error(
        "runQuickBuySquad requires both sbcSetId and challengeId",
      );
    }

    if (button && button.dataset.running === "true") {
      return { success: false, reason: "already-running" };
    }

    if (button) {
      button.dataset.running = "true";
      button.setAttribute("disabled", "disabled");
      button.classList.add("disabled");
    }

    const {
      container: statusContainer,
      content: statusContent,
      footer: timerFooter,
    } = ensureStatusContainer();
    statusContainer.style.display = "flex";
    statusContent.innerHTML = "";
    timerFooter.textContent = "";
    statusContainer.dataset.stopOnlyOnClose = "true";

    let stopRequested = false;
    const requestStop = () => {
      stopRequested = true;
      timerFooter.textContent = "Stopping...";
    };
    statusContainer.__onClose = requestStop;

    const titleBlock = document.createElement("div");
    titleBlock.textContent = "Quick Buy Squad";
    titleBlock.style.fontWeight = "bold";
    titleBlock.style.marginBottom = "0.35rem";
    statusContent.appendChild(titleBlock);

    const extractConceptItemsFromSquad = (squadInput) => {
      if (!squadInput) return [];
      const slots = Array.isArray(squadInput)
        ? squadInput
        : Array.isArray(squadInput?._players)
          ? squadInput._players
          : [];
      return slots
        .map((slot) =>
          slot && typeof slot === "object" && "_item" in slot ? slot._item : slot,
        )
        .filter((player) => player && player.concept);
    };

    let conceptItems = extractConceptItemsFromSquad(
      options.squadPlayers || options.squad,
    );
    let targetSet = null;
    let targetChallenge = null;

    try {
      if (!conceptItems.length) {
        const controller = getControllerInstance();
        if (
          controller?._challenge?.id === challengeId &&
          controller?._challenge?.setId === sbcSetId
        ) {
          targetSet = controller._set || null;
          targetChallenge = controller._challenge || null;
          conceptItems = getCurrentConceptItems();
        }
      }

      if (!conceptItems.length && (!targetSet || !targetChallenge)) {
        const allSets = await sbcSets();
        targetSet = allSets.sets.find((set) => set.id === sbcSetId);
        if (!targetSet) {
          throw new Error(`Unable to locate SBC set ${sbcSetId}`);
        }

        const challengeBundle = await getChallenges(targetSet);
        targetChallenge = challengeBundle.challenges.find(
          (challenge) => challenge.id === challengeId,
        );

        if (!targetChallenge) {
          throw new Error(
            `Unable to locate challenge ${challengeId} in set ${sbcSetId}`,
          );
        }

        await loadChallenge(targetChallenge);
      }

      if (!conceptItems.length) {
        const players =
          targetChallenge?.squad?._players?.map((slot) => slot?._item) || [];
        conceptItems = players.filter((player) => player && player.concept);
      }

      if (!conceptItems.length) {
        showNotification(
          "No concept players found in the current squad.",
          UINotificationType.NEGATIVE,
        );
        statusContainer.style.display = "none";
        statusContent.innerHTML = "";
        timerFooter.textContent = "";
        return { success: false, reason: "no-concepts" };
      }

      const maxPerPlayerSetting = Number(
        getSettings(sbcSetId, challengeId, "sbcBuyConceptsMaxPrice"),
      );
      const maxAboveSetting = Number(
        getSettings(sbcSetId, challengeId, "sbcBuyConceptsPriceAbove"),
      );

      let successCount = 0;

      const headerRow = document.createElement("div");
      headerRow.className = "quick-buy-squad-row quick-buy-squad-header";
      headerRow.style.display = "grid";
      headerRow.style.gridTemplateColumns = "2fr 1fr 1fr 1fr";
      headerRow.style.gap = "0.5rem";
      headerRow.style.fontWeight = "bold";
      headerRow.style.borderBottom = "1px solid rgba(255, 255, 255, 0.1)";

      const headerLabels = ["Player", "Expected", "Max Buy", "Status"];
      headerLabels.forEach((label) => {
        const span = document.createElement("span");
        span.textContent = label;
        headerRow.appendChild(span);
      });
      statusContent.appendChild(headerRow);

      const rowData = conceptItems.map((conceptItem) => {
        
        const name = formatPlayerName(conceptItem);
        const rawExpectedPrice = getPrice(conceptItem);
        const expectedPrice =
          typeof rawExpectedPrice === "number" &&
          Number.isFinite(rawExpectedPrice) &&
          rawExpectedPrice > 0
            ? rawExpectedPrice
            : NaN;
        const expectedLabel = Number.isFinite(expectedPrice)
          ? expectedPrice.toLocaleString()
          : "N/A";

        const maxPerPlayer =
          Number.isFinite(maxPerPlayerSetting) && maxPerPlayerSetting > 0
            ? maxPerPlayerSetting
            : Infinity;
        const maxAbove =
          Number.isFinite(maxAboveSetting) && maxAboveSetting >= 0
            ? maxAboveSetting
            : 0;
        const permittedCap =
          Number.isFinite(expectedPrice) && expectedPrice > 0
            ? Math.min(maxPerPlayer, expectedPrice + maxAbove)
            : maxPerPlayer;
        const maxBuyLabel = Number.isFinite(permittedCap)
          ? permittedCap.toLocaleString()
          : "∞";

        const row = document.createElement("div");
        row.className = "quick-buy-squad-row";
        row.style.display = "grid";
        row.style.gridTemplateColumns = "2fr 1fr 1fr 1fr";
        row.style.gap = "0.5rem";
        row.style.alignItems = "center";

        const nameSpan = document.createElement("span");
        nameSpan.textContent = name;

        const priceSpan = document.createElement("span");
        priceSpan.textContent = expectedLabel;

        const maxSpan = document.createElement("span");
        maxSpan.textContent = maxBuyLabel;

        const statusSpan = document.createElement("span");
        statusSpan.textContent = "Queued";

        row.append(nameSpan, priceSpan, maxSpan, statusSpan);
        statusContent.appendChild(row);

        return {
          conceptItem,
          name,
          expectedPrice,
          expectedLabel,
          permittedCap,
          statusSpan,
        };
      });

      statusContent.scrollTop = statusContent.scrollHeight;

      const markRowsStopped = (startIndex = 0) => {
        for (let idx = startIndex; idx < rowData.length; idx += 1) {
          const row = rowData[idx];
          if (!row?.statusSpan) continue;
          const currentStatus = row.statusSpan.textContent;
          if (currentStatus?.startsWith("Success") || currentStatus === "Failed") {
            continue;
          }
          row.statusSpan.textContent = "Stopped";
          row.statusSpan.style.color = "#f59e0b";
        }
      };

      const runStoppableCountdown = async (ms, labelPrefix) => {
        let remaining = Math.max(0, ms);
        while (remaining > 0) {
          if (stopRequested) {
            timerFooter.textContent = "Stopped";
            return false;
          }
          if (timerFooter) {
            timerFooter.textContent = `${labelPrefix} ${Math.ceil(remaining / 1000)}s`;
          }
          const step = Math.min(250, remaining);
          await sleep(step);
          remaining -= step;
        }
        timerFooter.textContent = "";
        return !stopRequested;
      };

      const QUICK_BUY_RETRY_LIMIT = 3;
      const getInterAttemptDelayMs = () => Math.floor(Math.random() * 2000);
      const isRetryableQuickBuyFailure = (result) => {
        if (!result || result?.success) return false;
        const reason = String(result?.reason || "");

        // Don't retry deterministic failures where a re-attempt won't help.
        if (
          reason === "noCachedPrice" ||
          reason === "priceAboveThreshold" ||
          reason === "priceAboveBaseline"
        ) {
          return false;
        }

        return true;
      };

      for (let i = 0; i < rowData.length; i++) {
        if (stopRequested) {
          markRowsStopped(i);
          timerFooter.textContent = "Stopped";
          break;
        }

        const { conceptItem, expectedLabel, statusSpan, permittedCap } =
          rowData[i];

        statusSpan.textContent = "Buying...";
        statusSpan.style.color = "";
        let result = null;
        const retryExcludedTradeIds = new Set();
        const retryExcludedItemIds = new Set();

        for (
          let attempt = 1;
          attempt <= QUICK_BUY_RETRY_LIMIT + 1;
          attempt += 1
        ) {
          if (stopRequested) {
            break;
          }

          if (attempt > 1) {
            statusSpan.textContent = `Retrying (${attempt - 1}/${QUICK_BUY_RETRY_LIMIT})...`;
          }

          result = await tryQuickBuy(
            { quickBuyButton: button ? { __root: button } : {} },
            conceptItem,
            {
              suppressNotifications: true,
              excludeTradeIds: Array.from(retryExcludedTradeIds),
              excludeItemIds: Array.from(retryExcludedItemIds),
            },
            sbcSetId,
            challengeId,
            permittedCap,
          );

          if (result?.success) {
            break;
          }

          const hasRetriesRemaining = attempt <= QUICK_BUY_RETRY_LIMIT;
          const shouldRetry =
            hasRetriesRemaining && isRetryableQuickBuyFailure(result);

          const failedTradeId = Number(result?.tradeId);
          if (Number.isFinite(failedTradeId) && failedTradeId > 0) {
            retryExcludedTradeIds.add(failedTradeId);
          }

          const failedItemId = Number(result?.itemId);
          if (Number.isFinite(failedItemId) && failedItemId > 0) {
            retryExcludedItemIds.add(failedItemId);
          }

          if (!shouldRetry) {
            break;
          }

          const retryDelay = getInterAttemptDelayMs();
          const shouldContinueRetry = await runStoppableCountdown(
            retryDelay,
            "Retry in",
          );
          if (!shouldContinueRetry) {
            stopRequested = true;
            break;
          }
        }

        if (stopRequested) {
          markRowsStopped(i);
          timerFooter.textContent = "Stopped";
          break;
        }

        if (result?.success) {
          successCount += 1;
          const label = result?.priceLabel || expectedLabel;
          statusSpan.textContent = label ? `Success @ ${label}` : "Success";
          statusSpan.style.color = "#07f468";
        } else {
          let reasonLabel = "Failed";
          if (result?.reason === "noCachedPrice") {
            reasonLabel = "Missing cached price";
          } else if (result?.reason === "noListing") {
            reasonLabel = "No active listing";
          } else if (result?.reason === "priceAboveBaseline") {
            const baselineLabel =
              result?.baselineLabel ||
              (Number.isFinite(result?.baseline)
                ? result.baseline.toLocaleString()
                : "unknown");
            const priceLabel = result?.priceLabel || expectedLabel;
            reasonLabel =
              priceLabel && baselineLabel
                ? `Skipped ${priceLabel} > ${baselineLabel}`
                : "Skipped (price too high)";
          } else if (result?.reason === "bidFailed") {
            reasonLabel = "Bid rejected";
          } else if (result?.reason === "priceAboveThreshold") {
            const limitValue = Number.isFinite(result?.limit)
              ? result.limit
              : Number.isFinite(permittedCap)
                ? permittedCap
                : null;
            const limitLabel =
              result?.limitLabel ||
              (limitValue !== null ? limitValue.toLocaleString() : "limit");
            reasonLabel = `Skipped @ ${result?.priceLabel}`;
          } else if (result?.reason === "error") {
            reasonLabel = "Error";
          }
          statusSpan.textContent = reasonLabel;
          statusSpan.style.color = "#f40727";
        }

        getControllerInstance()?.applyDataChange?.();

        if (i < rowData.length - 1) {
          const delay = getInterAttemptDelayMs();
          const shouldContinue = await runStoppableCountdown(
            delay,
            "Next buy in",
          );
          if (!shouldContinue) {
            markRowsStopped(i + 1);
            break;
          }
        } else {
          timerFooter.textContent = "";
        }
      }

      if (stopRequested) {
        showNotification("Quick buy squad stopped", UINotificationType.NEGATIVE);
        return {
          success: false,
          reason: "stopped",
          purchased: successCount,
          total: conceptItems.length,
        };
      }

      const total = conceptItems.length;
      const summaryMessage = `Quick buy squad complete: ${successCount}/${total} players purchased`;
      const summaryType =
        successCount === total
          ? UINotificationType.POSITIVE
          : UINotificationType.NEGATIVE;

      showNotification(summaryMessage, summaryType);

      statusContainer.style.display = "none";
      statusContent.innerHTML = "";
      timerFooter.textContent = "";
      return { success: true, purchased: successCount, total };
    } catch (error) {
      console.error("Quick buy squad error", error);
      showNotification(
        "Quick buy squad encountered an error",
        UINotificationType.NEGATIVE,
      );
      statusContainer.style.display = "none";
      statusContent.innerHTML = "";
      timerFooter.textContent = "";
      return { success: false, reason: "exception", error };
    } finally {
      statusContainer.dataset.stopOnlyOnClose = "false";
      statusContainer.__onClose = null;
      if (button) {
        delete button.dataset.running;
        button.removeAttribute("disabled");
        button.classList.remove("disabled");
      }
    }
  };

  window.autoSbcConsoleApi = {
    ...(window.autoSbcConsoleApi || {}),
    runQuickBuySquad,
    autoApplyQuickSolutionOnPageOpen,
    hasPlayersInCurrentSquad,
    sbcViewOverride,
  };

  const squadDetailPanelView = UTSBCSquadDetailPanelView.prototype.init;
  if (!UTSBCSquadDetailPanelView.prototype.__autoSbcButtonsPatched) {
    UTSBCSquadDetailPanelView.prototype.__autoSbcButtonsPatched = true;
    UTSBCSquadDetailPanelView.prototype.init = function (...args) {
    const response = squadDetailPanelView.call(this, ...args);

    const showQuickSolutionButton =
      getSettings(0, 0, "showQuickSolutionButtonOnSbcScreen") !== false;
    const showQuickBuyButton =
      getSettings(0, 0, "showQuickBuyButtonOnSbcScreen") !== false;

    let anchorButton = this._btnExchange.__root;
    // Re-init can run on the same panel DOM; remove any Auto-SBC buttons we
    // previously inserted so they don't stack into duplicates.
    const buttonContainer = anchorButton?.parentNode;
    if (buttonContainer) {
      ["idSolveSbc", "idFetchQuickSolution", "idQuickBuySquad"].forEach((bid) => {
        const existing = buttonContainer.querySelector(`#${bid}`);
        if (existing) existing.remove();
      });
    }
    const button = createButton("idSolveSbc", "Solve SBC", async function () {
      const { _challenge } = getControllerInstance();

      solveSBC(_challenge.setId, _challenge.id);
    });
    insertAfter(button, anchorButton);
    anchorButton = button;

    if (showQuickSolutionButton) {
      const QuickSolutionButton = createButton(
        "idFetchQuickSolution",
        "Quick Solution",
        async function () {
          await autoApplyQuickSolutionOnPageOpen({ force: true });
        },
      );
      insertAfter(QuickSolutionButton, anchorButton);
      anchorButton = QuickSolutionButton;
    }

    if (showQuickBuyButton) {
      insertAfter(quickBuySquadButton, anchorButton);
    }

    setTimeout(() => {
      autoApplyQuickSolutionOnPageOpen();
    }, 0);

    return response;
    };
  }
};
const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
const runCountdown = async (ms, target, labelPrefix = "Next buy in") => {
  let remaining = Math.max(0, ms);
  while (remaining > 0) {
    if (target) {
      const seconds = Math.ceil(remaining / 1000);
      target.textContent = `${labelPrefix} ${seconds}s`;
    }
    const step = Math.min(1000, remaining);
    await sleep(step);
    remaining -= step;
  }
  if (target) {
    target.textContent = "";
  }
};

const quickBuySquadButton = createButton(
  "idQuickBuySquad",
  "Quick Buy Squad",
  async () => {
    const controller = getControllerInstance();
    const currentChallenge = controller?._challenge;
    if (!currentChallenge) {
      showNotification(
        "Unable to determine current SBC challenge.",
        UINotificationType.NEGATIVE,
      );
      return;
    }

    const quickBuyRunner = window?.autoSbcConsoleApi?.runQuickBuySquad;
    if (typeof quickBuyRunner !== "function") {
      showNotification(
        "Quick Buy Squad is unavailable right now.",
        UINotificationType.NEGATIVE,
      );
      return;
    }

    await quickBuyRunner(
      currentChallenge.setId,
      currentChallenge.id,
      quickBuySquadButton,
    );
  },
);
const formatPlayerName = (item) =>
  item?._staticData?.name ||
  item?._staticData?.commonName ||
  item?._staticData?.lastName ||
  item?.name ||
  item?.definitionId ||
  "Unknown";
const getCurrentConceptItems = () => {
  const controller = getControllerInstance();
  const { _squad } = controller || {};
  const squadPlayers = Array.isArray(_squad?._players) ? _squad._players : [];
  return squadPlayers
    .map((slot) => slot?._item)
    .filter((item) => item && item.concept);
};

try {
  const exportCandidates = {
    sbcSubmitChallengeOverride:
      typeof sbcSubmitChallengeOverride !== "undefined"
        ? sbcSubmitChallengeOverride
        : undefined,
    sbcViewOverride:
      typeof sbcViewOverride !== "undefined" ? sbcViewOverride : undefined,
    runQuickBuySquad:
      typeof runQuickBuySquad !== "undefined" ? runQuickBuySquad : undefined,
    autoApplyQuickSolutionOnPageOpen:
      typeof autoApplyQuickSolutionOnPageOpen !== "undefined"
        ? autoApplyQuickSolutionOnPageOpen
        : undefined,
    hasPlayersInCurrentSquad:
      typeof hasPlayersInCurrentSquad !== "undefined"
        ? hasPlayersInCurrentSquad
        : undefined,
    sleep: typeof sleep !== "undefined" ? sleep : undefined,
    runCountdown:
      typeof runCountdown !== "undefined" ? runCountdown : undefined,
    formatPlayerName:
      typeof formatPlayerName !== "undefined" ? formatPlayerName : undefined,
    getCurrentConceptItems:
      typeof getCurrentConceptItems !== "undefined"
        ? getCurrentConceptItems
        : undefined,
  };

  for (const [name, fn] of Object.entries(exportCandidates)) {
    if (typeof fn !== "function") {
      continue;
    }
  }

  window.autoSbcConsoleApi = {
    ...(window.autoSbcConsoleApi || {}),
    ...Object.fromEntries(
      Object.entries(exportCandidates).filter(
        ([, fn]) => typeof fn === "function",
      ),
    ),
  };
} catch {}
