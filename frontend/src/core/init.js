let sbcSolverInitialized = false;
const INIT_PROGRESS_BAR_ID = "sbc-init-progress-bar";
const INIT_PROGRESS_CONTAINER_ID = "sbc-init-progress-container";
const INIT_PROGRESS_FALLBACK_LABEL_ID = `${INIT_PROGRESS_BAR_ID}-label`;
let pendingInitProgressState = null;

const ensureFallbackInitProgressBar = (titleText = "Initializing…") => {
  if (!document.body) {
    return null;
  }

  let container = document.getElementById(INIT_PROGRESS_CONTAINER_ID);
  if (!container) {
    container = document.createElement("div");
    container.id = INIT_PROGRESS_CONTAINER_ID;
    container.style.position = "fixed";
    container.style.bottom = "10px";
    container.style.right = "130px";
    container.style.width = "300px";
    container.style.backgroundColor = "rgba(0, 0, 0, 0.3)";
    container.style.borderRadius = "2px";
    container.style.zIndex = "9999";

    const label = document.createElement("div");
    label.id = INIT_PROGRESS_FALLBACK_LABEL_ID;
    label.textContent = titleText;
    label.style.position = "absolute";
    label.style.top = "-20px";
    label.style.left = "0";
    label.style.width = "100%";
    label.style.color = "#ffffff";
    label.style.textAlign = "center";
    label.style.fontSize = "12px";
    container.appendChild(label);

    const wrapper = document.createElement("div");
    wrapper.style.height = "15px";
    wrapper.style.width = "100%";
    wrapper.style.position = "relative";
    wrapper.style.overflow = "hidden";

    const bar = document.createElement("div");
    bar.id = INIT_PROGRESS_BAR_ID;
    bar.style.height = "100%";
    bar.style.width = "0%";
    bar.style.backgroundColor = "#07f468";
    bar.style.borderRadius = "2px";
    bar.style.transition = "width 0.3s ease-in-out";
    wrapper.appendChild(bar);
    container.appendChild(wrapper);

    document.body.appendChild(container);
  }

  const fallbackLabel = document.getElementById(
    INIT_PROGRESS_FALLBACK_LABEL_ID,
  );
  if (fallbackLabel) {
    fallbackLabel.textContent = titleText;
  }

  return container;
};

const ensureInitProgressBar = (titleText = "Initializing…") => {
  if (!document.body) {
    pendingInitProgressState = pendingInitProgressState || {
      titleText,
      currentStep: 0,
      totalSteps: 1,
    };
    return null;
  }

  let container = document.getElementById(INIT_PROGRESS_CONTAINER_ID);
  if (!container) {
    if (typeof createProgressBar === "function") {
      try {
        container = createProgressBar(
          INIT_PROGRESS_BAR_ID,
          INIT_PROGRESS_CONTAINER_ID,
          titleText,
        );
      } catch {
        container = ensureFallbackInitProgressBar(titleText);
      }
    } else {
      container = ensureFallbackInitProgressBar(titleText);
    }
  }

  const label = document.getElementById(`${INIT_PROGRESS_BAR_ID}-label`);
  if (label) {
    label.textContent = titleText;
  } else {
    const fallbackLabel = document.getElementById(
      INIT_PROGRESS_FALLBACK_LABEL_ID,
    );
    if (fallbackLabel) {
      fallbackLabel.textContent = titleText;
    }
  }

  if (pendingInitProgressState) {
    const { currentStep, totalSteps } = pendingInitProgressState;
    pendingInitProgressState = null;
    setInitProgress(titleText, currentStep, totalSteps);
  }

  return container;
};

const setInitProgress = (titleText, currentStep, totalSteps) => {
  if (!document.body) {
    pendingInitProgressState = { titleText, currentStep, totalSteps };
    return;
  }

  ensureInitProgressBar(titleText);
  const safeTotal = Math.max(1, Number(totalSteps) || 1);
  const safeCurrent = Math.min(
    Math.max(Number(currentStep) || 0, 0),
    safeTotal,
  );
  const percent = Math.round((safeCurrent / safeTotal) * 100);

  if (typeof updateProgressBar === "function") {
    try {
      updateProgressBar(INIT_PROGRESS_BAR_ID, percent);
    } catch {
      const bar = document.getElementById(INIT_PROGRESS_BAR_ID);
      if (bar) {
        bar.style.width = `${percent}%`;
      }
    }
  } else {
    const bar = document.getElementById(INIT_PROGRESS_BAR_ID);
    if (bar) {
      bar.style.width = `${percent}%`;
    }
  }
};

const ensureInitProgressVisibleForStep = (titleText) => {
  if (!document.body) {
    pendingInitProgressState = pendingInitProgressState || {
      titleText,
      currentStep: 0,
      totalSteps: 1,
    };
    return;
  }

  const hasContainer = !!document.getElementById(INIT_PROGRESS_CONTAINER_ID);
  const hasBar = !!document.getElementById(INIT_PROGRESS_BAR_ID);

  if (!hasContainer || !hasBar) {
    ensureInitProgressBar(titleText);
    const fallbackBar = document.getElementById(INIT_PROGRESS_BAR_ID);
    if (!fallbackBar) {
      ensureFallbackInitProgressBar(titleText);
    }
  }
};

const completeInitProgress = () => {
  setInitProgress("Initialization complete", 1, 1);
  if (typeof removeProgressBar === "function") {
    removeProgressBar(INIT_PROGRESS_CONTAINER_ID, 1200);
  }
};

const resetPatchFlags = () => {
  const getProto = (name) => {
    const controller = globalThis[name];
    return controller && controller.prototype ? controller.prototype : null;
  };

  const itemProto = getProto("UTPlayerItemView");
  if (itemProto) {
    delete itemProto.__sbcItemPatched;
  }

  const slotProto = getProto("UTSquadPitchView");
  if (slotProto) {
    delete slotProto.__autoSbcSlotPricePatched;
  }

  const unassignedProto = getProto("UTUnassignedItemsViewController");
  if (unassignedProto) {
    delete unassignedProto.__unassignedItemsPatched;
    delete unassignedProto.__sbcPreviewPatched;
  }

  const navBarProto = getProto("UTNavigationBarView");
  if (navBarProto) {
    delete navBarProto.__autoSbcNavbarTrackerPatched;
  }

  const currencyNavBarProto = getProto("UTCurrencyNavigationBarView");
  if (currencyNavBarProto) {
    delete currencyNavBarProto.__autoSbcCurrencyNavbarTrackerPatched;
  }

  const squadSummaryProto = getProto("UTSquadSummaryBannerView");
  if (squadSummaryProto) {
    delete squadSummaryProto.__autoSbcSquadPricePatched;
  }
};

const init = () => {
  if (sbcSolverInitialized) {
    return;
  }

  if (services.Localization) {
    sbcSolverInitialized = true;
    const initSteps = [
      ["Sync badge content", syncBadgeContent],
      ["Reset patch flags", resetPatchFlags],
      ["Apply anti-debug override", antiDebugOverride],
      ["Apply SBC view override", sbcViewOverride],
      ["Apply SBC button override", sbcButtonOverride],
      ["Apply SBC squad summary override", sbcSquadSummaryOverride],
      ["Apply player item override", playerItemOverride],
      ["Apply item price rendering (FC27)", itemPriceRenderOverride],
      ["Apply player slot override", playerSlotOverride],
      ["Apply pack override", packOverRide],
      ["Apply sidebar override", sideBarNavOverride],
      ["Apply navigation bar override", navigationBarOverride],
      ["Apply favorite tag override", sbcFavoriteTagOverride],
      ["Apply popup override", popupOverride],
      ["Apply submit challenge override", sbcSubmitChallengeOverride],
      ["Apply unassigned items override", unassignedItemsOverride],
      ["Apply unassigned preview override", unassignedPreviewOverride],
      ["Initialize default settings", initDefaultSettings],
      ["Apply FUT home override", futHomeOverride],
      [
        "Download card assets (background)",
        () => {
          // Fire and forget — runs in background after init completes
          setTimeout(() => downloadAllAssets(), 5000);
        },
      ],
      [
        "Prefetch Collection Book (background)",
        () => {
          // Fire and forget — fetch collections + any missing players so the
          // Collection Book is ready without lazy loading. Cached ones skip.
          if (typeof collectionBookPrefetchAll === "function") {
            setTimeout(() => collectionBookPrefetchAll(), 6000);
          }
        },
      ],
    ];

    const totalSteps = initSteps.length;

    for (let index = 0; index < totalSteps; index++) {
      const [stepTitle, stepFn] = initSteps[index];
      ensureInitProgressVisibleForStep(stepTitle);
      setInitProgress(stepTitle, index + 1, totalSteps);
      console.log(`[SBC Solver Init] ${index + 1}/${totalSteps}: ${stepTitle}`);
      try {
        stepFn();
      } catch (error) {
        // FC 27 migration: a single unmigrated override must not abort the whole
        // init. Log and continue so the remaining steps still apply.
        setInitProgress(`Skipped: ${stepTitle}`, index + 1, totalSteps);
        console.error(`[SBC Solver Init] Step failed, continuing: ${stepTitle}`, error);
      }
    }

    completeInitProgress();
  } else {
    setInitProgress("Waiting for services.Localization…", 0, 1);
    setTimeout(init, 4000);
    console.log(
      "SBC Solver: Waiting for all services to load before initializing.",
    );
  }
};

init();
