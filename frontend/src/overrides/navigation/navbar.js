const navigationBarOverride = () => {
  const applyPatch = (proto, patchFlag) => {
    if (!proto || proto[patchFlag]) {
      return;
    }

    const baseGenerate = proto._generate;
    if (typeof baseGenerate === "function") {
      proto._generate = function (...args) {
        const result = baseGenerate.apply(this, args);
        setTimeout(() => {
          try {
            refreshSbcSubmitTrackerInHeader(this);
          } catch (err) {
            console.warn("[navigationBarOverride] tracker refresh failed", err);
          }
        }, 0);
        return result;
      };
    }

    const baseSetCurrency = proto.setCurrency;
    if (typeof baseSetCurrency === "function") {
      proto.setCurrency = function (...args) {
        const result = baseSetCurrency.apply(this, args);
        refreshSbcSubmitTrackerInHeader(this);
        return result;
      };
    }

    const baseSetCurrencies = proto.setCurrencies;
    if (typeof baseSetCurrencies === "function") {
      proto.setCurrencies = function (...args) {
        const result = baseSetCurrencies.apply(this, args);
        refreshSbcSubmitTrackerInHeader(this);
        return result;
      };
    }

    proto[patchFlag] = true;
  };

  applyPatch(
    globalThis.UTNavigationBarView?.prototype,
    "__autoSbcNavbarTrackerPatched",
  );
  applyPatch(
    globalThis.UTCurrencyNavigationBarView?.prototype,
    "__autoSbcCurrencyNavbarTrackerPatched",
  );

  subscribeSbcSubmitTrackerUpdates();

  refreshSbcSubmitTrackerInHeader();
};
