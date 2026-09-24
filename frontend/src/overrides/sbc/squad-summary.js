const AUTO_SBC_SQUAD_PRICE_ROW_CLASS = "autosbc-squad-price-row";
const AUTO_SBC_SQUAD_PRICE_VALUE_CLASS = "autosbc-squad-price-value";
const AUTO_SBC_SOLVE_STATUS_ICON_CLASS = "autosbc-solve-status-icon";
const autoSbcTrackedSquadSummaryBanners = new Set();

// Solve status: null | "solving" | "feasible" | "optimal"
window.__autoSbcSolveStatus = null;
window.__autoSbcSolveRunInBackground = false;

const setAutoSbcSolveStatus = (status, runInBackground = false) => {
  window.__autoSbcSolveStatus = status;
  window.__autoSbcSolveRunInBackground = !!status && !!runInBackground;
  if (typeof refreshSbcSquadPriceBanners === "function") {
    refreshSbcSquadPriceBanners();
  }
  if (typeof refreshBackgroundSolveStatusIcon === "function") {
    refreshBackgroundSolveStatusIcon();
  }
};

const createSquadPriceRowElements = () => {
  const row = document.createElement("div");
  row.classList.add(
    "chemistry",
    AUTO_SBC_SQUAD_PRICE_ROW_CLASS,
  );

  const label = document.createElement("span");
  label.classList.add("ut-squad-summary-label");
  label.textContent = "Price";

  const valueWrap = document.createElement("div");
  valueWrap.classList.add("ut-squad-summary-value-button");

  const value = document.createElement("span");
  value.classList.add(
    "ut-squad-summary-value",
    "currency-coins",
    AUTO_SBC_SQUAD_PRICE_VALUE_CLASS,
  );

  const statusIcon = document.createElement("div");
  statusIcon.classList.add(AUTO_SBC_SOLVE_STATUS_ICON_CLASS);

  valueWrap.appendChild(value);
  valueWrap.appendChild(statusIcon);
  row.appendChild(label);
  row.appendChild(valueWrap);
  return { row, value, statusIcon };
};

const ensureSquadPriceRowForSummaryBanner = (view) => {
  if (!view || view.__autoSbcSquadPriceRow) {
    return;
  }

  const statsRoot = view._squadStats?.getRootElement?.();
  if (!statsRoot) {
    return;
  }

  const { row, value, statusIcon } = createSquadPriceRowElements();

  const chemistryElem = statsRoot.querySelector(".chemistry");
  if (chemistryElem && chemistryElem.parentNode === statsRoot) {
    statsRoot.insertBefore(row, chemistryElem.nextSibling);
  } else {
    statsRoot.appendChild(row);
  }

  view.__autoSbcSquadPriceRow = row;
  view.__autoSbcSquadPriceValue = value;
  view.__autoSbcSolveStatusIcon = statusIcon;
};

const refreshSbcSquadPriceBanner = (view) => {
  if (!view) {
    return;
  }

  ensureSquadPriceRowForSummaryBanner(view);

  const showPrices = !!getSettings(0, 0, "showPrices");
  const total = Number(window.__autoSbcSquadPriceTotal || 0);
  const totalText = total.toLocaleString();

  if (view.__autoSbcSquadPriceRow) {
    view.__autoSbcSquadPriceRow.style.display = showPrices ? "" : "none";
  }

  if (view.__autoSbcSquadPriceValue) {
    view.__autoSbcSquadPriceValue.textContent = totalText;
  }

  if (view.__autoSbcSolveStatusIcon) {
    const status = window.__autoSbcSolveStatus;
    const icon = view.__autoSbcSolveStatusIcon;
    icon.classList.remove(
      "autosbc-status--solving",
      "autosbc-status--feasible",
      "autosbc-status--optimal",
    );
    if (status === "solving") {
      icon.classList.add("autosbc-status--solving");
    } else if (status === "feasible") {
      icon.classList.add("autosbc-status--feasible");
    } else if (status === "optimal") {
      icon.classList.add("autosbc-status--optimal");
    }
    icon.style.display = status ? "" : "none";
  }
};

const findActiveSquadSummaryBanner = () => {
  try {
    let topViewController = globalThis.getCurrentViewController?.();
    if (!topViewController) {
      return null;
    }

    const visited = new Set();
    const queue = [topViewController];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) {
        continue;
      }
      visited.add(current);

      // Check the controller's view for _summaryPanel (where EA stores it)
      const view = current.getView?.();
      if (view?._summaryPanel?.getRootElement) {
        return view._summaryPanel;
      }

      // Check child view controllers
      if (current._children && Array.isArray(current._children)) {
        for (const child of current._children) {
          if (child && !visited.has(child)) {
            queue.push(child);
          }
        }
      }

      // Check the left/right split children
      if (current.leftViewController && !visited.has(current.leftViewController)) {
        queue.push(current.leftViewController);
      }
      if (current.rightViewController && !visited.has(current.rightViewController)) {
        queue.push(current.rightViewController);
      }

      // Check rootController
      if (
        current.rootController &&
        !visited.has(current.rootController)
      ) {
        queue.push(current.rootController);
      }
    }
  } catch (error) {
    console.debug("[Auto-SBC] Error finding squad summary banner:", error);
  }

  return null;
};


const refreshSbcSquadPriceBanners = () => {
  autoSbcTrackedSquadSummaryBanners.forEach((view) => {
    if (!view?.getRootElement?.()) {
      autoSbcTrackedSquadSummaryBanners.delete(view);
      return;
    }

    refreshSbcSquadPriceBanner(view);
  });

  if (autoSbcTrackedSquadSummaryBanners.size === 0) {
    const activeView = findActiveSquadSummaryBanner();
    if (activeView) {
      autoSbcTrackedSquadSummaryBanners.add(activeView);
      refreshSbcSquadPriceBanner(activeView);
    }
  }
};

const sbcSquadSummaryOverride = () => {
  // Patch UTSquadSummaryBannerView (base class — used on non-SBC squad screens)
  const proto = globalThis.UTSquadSummaryBannerView?.prototype;
  if (!proto || proto.__autoSbcSquadPricePatched) {
    return;
  }

  const baseGenerate = proto._generate;
  if (typeof baseGenerate === "function") {
    proto._generate = function (...args) {
      const result = baseGenerate.apply(this, args);
      autoSbcTrackedSquadSummaryBanners.add(this);
      refreshSbcSquadPriceBanner(this);
      return result;
    };
  }

  const baseDestroyGeneratedElements = proto.destroyGeneratedElements;
  if (typeof baseDestroyGeneratedElements === "function") {
    proto.destroyGeneratedElements = function (...args) {
      this.__autoSbcSquadPriceRow = null;
      this.__autoSbcSquadPriceValue = null;
      this.__autoSbcSolveStatusIcon = null;
      autoSbcTrackedSquadSummaryBanners.delete(this);
      return baseDestroyGeneratedElements.apply(this, args);
    };
  }

  const baseRender = proto.render;
  if (typeof baseRender === "function") {
    proto.render = function (...args) {
      const result = baseRender.apply(this, args);
      autoSbcTrackedSquadSummaryBanners.add(this);
      refreshSbcSquadPriceBanner(this);
      return result;
    };
  }

  const baseUpdate = proto.update;
  if (typeof baseUpdate === "function") {
    proto.update = function (...args) {
      const result = baseUpdate.apply(this, args);
      autoSbcTrackedSquadSummaryBanners.add(this);
      refreshSbcSquadPriceBanner(this);
      return result;
    };
  }

  proto.__autoSbcSquadPricePatched = true;

  // Patch UTSBCSquadOverviewView.getSummaryPanel to track the SBC banner
  const sbcViewProto = globalThis.UTSBCSquadOverviewView?.prototype;
  if (sbcViewProto && !sbcViewProto.__autoSbcSummaryPanelPatched) {
    const baseGetSummaryPanel = sbcViewProto.getSummaryPanel;
    if (typeof baseGetSummaryPanel === "function") {
      sbcViewProto.getSummaryPanel = function (...args) {
        const panel = baseGetSummaryPanel.apply(this, args);
        if (panel && !autoSbcTrackedSquadSummaryBanners.has(panel)) {
          autoSbcTrackedSquadSummaryBanners.add(panel);
          refreshSbcSquadPriceBanner(panel);
        }
        return panel;
      };
    }
    sbcViewProto.__autoSbcSummaryPanelPatched = true;
  }

  setTimeout(() => {
    try {
      refreshSbcSquadPriceBanners();
    } catch {}
  }, 0);
};
