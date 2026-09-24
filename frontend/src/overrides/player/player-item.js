const playerItemOverride = () => {
  // Adds a "Remove All Evolutions" button directly under EA's native
  // "Remove Last Evolution" button. EA only exposes single-upgrade removal in
  // the item panels; this strips every evolution upgrade in one academy call.
  // `ctx` is the panel view, `nativeRemoveBtn` is EA's remove-evolution control,
  // `key` is the field used to remember we've added the button.
  const addRemoveAllEvoButton = (ctx, e, nativeRemoveBtn, key, afterRender) => {
    if (ctx[key] || !nativeRemoveBtn) return;
    let canRemove = false;
    try { canRemove = !!(e.canRemoveEvolution && e.canRemoveEvolution()); } catch { canRemove = false; }
    if (!canRemove) return;
    const btn = new UTGroupButtonControl();
    btn.init();
    btn.setInteractionState(true);
    btn.setText("Remove All Evolutions");
    insertAfter(btn, nativeRemoveBtn.__root);
    btn.addTarget(
      ctx,
      () => {
        const academy =
          (window.services && window.services.Academy) ||
          (typeof services !== "undefined" ? services.Academy : null);
        if (!academy || typeof academy.removeEvoUpgrade !== "function") {
          showNotification("Evolution removal is not available", UINotificationType.NEGATIVE);
          return;
        }
        if (!confirm("Remove ALL evolutions from this player? This can't be undone.")) return;
        // removeEvoUpgrade(itemId, popPrevious=false, removeAll=true)
        const obs = academy.removeEvoUpgrade(e.id, false, true);
        if (!obs || typeof obs.observe !== "function") {
          showNotification("Evolution removal failed to start", UINotificationType.NEGATIVE);
          return;
        }
        btn.setInteractionState(false);
        obs.observe(ctx, (o, res) => {
          try { o.unobserve(ctx); } catch {}
          if (res && res.success) {
            showNotification("All evolutions removed", UINotificationType.POSITIVE);
            try { afterRender(); } catch {}
          } else {
            btn.setInteractionState(true);
            showNotification("Failed to remove evolutions", UINotificationType.NEGATIVE);
          }
        });
      },
      EventType.TAP,
    );
    ctx[key] = btn;
  };

  const UTDefaultSetItem = UTSlotActionPanelView.prototype.setItem;
  UTSlotActionPanelView.prototype.setItem = function (e, t) {
    const result = UTDefaultSetItem.call(this, e, t);

    // Offer a quick buy helper before exposing the manual refresh button.
    if (!this.quickBuyButton && e.isPlayer()) {
      const quickButton = new UTGroupButtonControl();
      quickButton.init();
      quickButton.setInteractionState(true);
      quickButton.setText("Quick Buy");
      insertAfter(quickButton, this._btnBio.__root);
      quickButton.addTarget(this, () => tryQuickBuy(this, e), EventType.TAP);
      this.quickBuyButton = quickButton;
    }

    // Quick List button (tradable only) under Quick Buy
    if (!this.quickListButton && e.tradable) {
      const quickListButton = new UTGroupButtonControl();
      quickListButton.init();
      quickListButton.setInteractionState(true);
      quickListButton.setText("Quick List");
      insertAfter(
        quickListButton,
        this.quickBuyButton ? this.quickBuyButton.__root : this._btnBio.__root,
      );
      quickListButton.addTarget(
        this,
        async () => {
          await quickListItem(e, { context: this, durationSeconds: 60 * 60 });
          try {
            getCurrentViewController()
              .getCurrentController()
              .rightController.currentController.renderView();
          } catch {}
        },
        EventType.TAP,
      );
      this.quickListButton = quickListButton;
    }

    // Add refresh price button
    if (!this.refreshPriceButton) {
      const refreshButton = new UTGroupButtonControl();
      refreshButton.init();
      refreshButton.setInteractionState(true);
      refreshButton.setText("Refresh Price");
      insertAfter(
        refreshButton,
        this.quickListButton
          ? this.quickListButton.__root
          : this.quickBuyButton
            ? this.quickBuyButton.__root
            : this._btnBio.__root,
      );
      refreshButton.addTarget(
        this,
        async () => {
          if (typeof refreshItemsLivePrices === "function") {
            await refreshItemsLivePrices([e]);
          } else {
            showNotification(
              "Refresh prices UI is not available",
              UINotificationType.NEGATIVE,
            );
            return;
          }
          getControllerInstance().applyDataChange();
          getCurrentViewController()
            .getCurrentController()
            .rightController.currentController.renderView();
        },
        EventType.TAP,
      );
      this.refreshPriceButton = refreshButton;
    }

    // Add playstyles modal button
    if (!this.playstyleButton && e.isPlayer()) {
      const playstyleButton = new UTGroupButtonControl();
      playstyleButton.init();
      playstyleButton.setInteractionState(true);
      playstyleButton.setText("Playstyles");
      insertAfter(
        playstyleButton,
        this.refreshPriceButton
          ? this.refreshPriceButton.__root
          : this.quickListButton
            ? this.quickListButton.__root
            : this.quickBuyButton
              ? this.quickBuyButton.__root
              : this._btnBio.__root,
      );
      playstyleButton.addTarget(
        this,
        () => {
          const position = e.getRarityId() === 0 ? 'ST' : e.position || 'ST';
          if (window.playstyleModal) {
            window.playstyleModal.open(position, e);
          } else {
            showNotification("Playstyles modal not available", UINotificationType.NEGATIVE);
          }
        },
        EventType.TAP,
      );
      this.playstyleButton = playstyleButton;
    }

    // Add "Remove All Evolutions" under EA's native "Remove Last Evolution".
    addRemoveAllEvoButton(this, e, this._btnRemoveEvolution, "removeAllEvoButton", () => {
      getControllerInstance().applyDataChange();
      getCurrentViewController()
        .getCurrentController()
        .rightController.currentController.renderView();
    });

    if (e.loans > -1 || !e.isPlayer() || !e.id || e.isTimeLimited()) {
      return result;
    }
    // console.log(e)
    if (!e?.duplicateId > 0 && !isItemFixed(e) && !this.lockUnlockButton) {
      if (!this.logEntityButton) {
        const logButton = new UTGroupButtonControl();
        logButton.init();
        logButton.setInteractionState(true);
        logButton.setText("Log UTItemEntity");
        insertAfter(logButton, this._btnBio.__root);
        logButton.addTarget(
          this,
          () => {
            globalThis.__autoSbcLastLoggedUtItemEntity = e;
            console.log("[Auto-SBC] Current UTItemEntity", e);
            showNotification("UTItemEntity logged to console", UINotificationType.POSITIVE);
          },
          EventType.TAP,
        );
        this.logEntityButton = logButton;
      }

      const label = isItemLocked(e) ? lockedLabel : unlockedLabel;
      const button = new UTGroupButtonControl();
      button.init();
      insertAfter(
        button,
        this.logEntityButton ? this.logEntityButton.__root : this._btnBio.__root,
      );

      button.setInteractionState(true);
      button.setText(label);

      button.addTarget(
        this,
        async () => {
          if (isItemLocked(e)) {
            unlockItem(e);
            button.setText(unlockedLabel);
            showNotification(`Item unlocked`, UINotificationType.POSITIVE);
          } else {
            lockItem(e);

            button.setText(lockedLabel);
            showNotification(`Item locked`, UINotificationType.POSITIVE);
          }
          getControllerInstance().applyDataChange();
          getCurrentViewController()
            .getCurrentController()
            .rightController.currentController.renderView();
        },
        EventType.TAP,
      );
      this.lockUnlockButton = button;
    }
    if (!isItemLocked(e) && !this.fixUnfixButton) {
      const fixLabel = isItemFixed(e) ? fixedLabel : unfixedLabel;
      const fixbutton = new UTGroupButtonControl();
      fixbutton.init();
      fixbutton.setInteractionState(true);
      fixbutton.setText(fixLabel);
      insertAfter(fixbutton, this._btnBio.__root);
      fixbutton.addTarget(
        this,
        async () => {
          if (isItemFixed(e)) {
            unfixItem(e);
            fixbutton.setText(unfixedLabel);
            showNotification(`Removed Must Use`, UINotificationType.POSITIVE);
          } else {
            fixItem(e);
            fixbutton.setText(fixedLabel);
            showNotification(`Must Use Set`, UINotificationType.POSITIVE);
          }
          getControllerInstance().applyDataChange();
          getCurrentViewController()
            .getCurrentController()
            .rightController.currentController.renderView();
        },
        EventType.TAP,
      );
      this.fixUnfixButton = fixbutton;
    }

    return result;
  };

  const UTDefaultAction = UTDefaultActionPanelView.prototype.render;
  UTDefaultActionPanelView.prototype.render = function (e, t, i, o, n, r, s) {
    e.isDuplicate = function () {
      return e.isValid() && e.isPlayer() && e.duplicateId > 0;
    };
    e.isDuplicateLoanPlayer = function () {
      return (
        e.isValid() && e.isPlayer() && e.duplicateId > 0 && e.isLimitedUse()
      );
    };
    const result = UTDefaultAction.call(this, e, t, i, o, n, r, s);
    if (!this.quickBuyButton && e.isPlayer()) {
      const quickButton = new UTGroupButtonControl();
      quickButton.init();
      quickButton.setInteractionState(true);
      quickButton.setText("Quick Buy");
      insertAfter(quickButton, this._bioButton.__root);
      quickButton.addTarget(this, () => tryQuickBuy(this, e), EventType.TAP);
      this.quickBuyButton = quickButton;
    }

    // Quick List button (tradable only) under Quick Buy
    if (!this.quickListButton && e.tradable) {
      const quickListButton = new UTGroupButtonControl();
      quickListButton.init();
      quickListButton.setInteractionState(true);
      quickListButton.setText("Quick List");
      insertAfter(
        quickListButton,
        this.quickBuyButton
          ? this.quickBuyButton.__root
          : this._bioButton.__root,
      );
      quickListButton.addTarget(
        this,
        async () => {
          await quickListItem(e, { context: this, durationSeconds: 60 * 60 });
          try {
            getCurrentViewController()
              .getCurrentController()
              .leftController.renderView();
            getCurrentViewController()
              .getCurrentController()
              .rightController.currentController.renderView();
          } catch {}
        },
        EventType.TAP,
      );
      this.quickListButton = quickListButton;
    }
    // Add refresh price button in default action panel
    if (!this.refreshPriceButton) {
      const refreshButton = new UTGroupButtonControl();
      refreshButton.init();
      refreshButton.setInteractionState(true);
      refreshButton.setText("Refresh Price");
      insertAfter(
        refreshButton,
        this.quickListButton
          ? this.quickListButton.__root
          : this.quickBuyButton
            ? this.quickBuyButton.__root
            : this._bioButton.__root,
      );
      refreshButton.addTarget(
        this,
        async () => {
          if (typeof refreshItemsLivePrices === "function") {
            await refreshItemsLivePrices([e]);
          } else {
            showNotification(
              "Refresh prices UI is not available",
              UINotificationType.NEGATIVE,
            );
            return;
          }
          try {
            getCurrentViewController()
              .getCurrentController()
              .leftController.renderView();
            getCurrentViewController()
              .getCurrentController()
              .rightController.currentController.renderView();
          } catch (error) {
            getCurrentViewController()
              .getCurrentController()
              .leftController.refreshList();
          }
        },
        EventType.TAP,
      );
      this.refreshPriceButton = refreshButton;
    } // Add refresh price button in default action panel
    if (!this.refreshPriceButton) {
      const refreshButton = new UTGroupButtonControl();
      refreshButton.init();
      refreshButton.setInteractionState(true);
      refreshButton.setText("Refresh Price");
      insertAfter(
        refreshButton,
        this.quickBuyButton
          ? this.quickBuyButton.__root
          : this._bioButton.__root,
      );
      refreshButton.addTarget(
        this,
        async () => {
          if (typeof refreshItemsLivePrices === "function") {
            await refreshItemsLivePrices([e]);
          } else {
            showNotification(
              "Refresh prices UI is not available",
              UINotificationType.NEGATIVE,
            );
            return;
          }
          try {
            getCurrentViewController()
              .getCurrentController()
              .leftController.renderView();
            getCurrentViewController()
              .getCurrentController()
              .rightController.currentController.renderView();
          } catch (error) {
            getCurrentViewController()
              .getCurrentController()
              .leftController.refreshList();
          }
        },
        EventType.TAP,
      );
      this.refreshPriceButton = refreshButton;
    }

    // Add playstyles modal button (default action panel)
    if (!this.playstyleButton && e.isPlayer()) {
      const playstyleButton = new UTGroupButtonControl();
      playstyleButton.init();
      playstyleButton.setInteractionState(true);
      playstyleButton.setText("Playstyles");
      insertAfter(
        playstyleButton,
        this.refreshPriceButton
          ? this.refreshPriceButton.__root
          : this.quickListButton
            ? this.quickListButton.__root
            : this.quickBuyButton
              ? this.quickBuyButton.__root
              : this._bioButton.__root,
      );
      playstyleButton.addTarget(
        this,
        () => {
          const position = e.getRarityId() === 0 ? 'ST' : e.position || 'ST';
          if (window.playstyleModal) {
            window.playstyleModal.open(position, e);
          } else {
            showNotification("Playstyles modal not available", UINotificationType.NEGATIVE);
          }
        },
        EventType.TAP,
      );
      this.playstyleButton = playstyleButton;
    }

    // Add "Remove All Evolutions" under EA's native "Remove Last Evolution".
    addRemoveAllEvoButton(this, e, this._removeEvolutionButton, "removeAllEvoButton", () => {
      try {
        getCurrentViewController()
          .getCurrentController()
          .leftController.renderView();
        getCurrentViewController()
          .getCurrentController()
          .rightController.currentController.renderView();
      } catch (error) {
        getCurrentViewController()
          .getCurrentController()
          .leftController.refreshList();
      }
    });

    if (e.loans > -1 || !e.isPlayer() || !e.id || e.isTimeLimited()) {
      return result;
    }

    if (!e?.duplicateId > 0 && !isItemFixed(e)) {
      const label = isItemLocked(e) ? lockedLabel : unlockedLabel;
      if (!this.lockUnlockButton) {
        if (!this.logEntityButton) {
          const logButton = new UTGroupButtonControl();
          logButton.init();
          logButton.setInteractionState(true);
          logButton.setText("Log UTItemEntity");
          insertAfter(logButton, this._bioButton.__root);
          logButton.addTarget(
            this,
            () => {
              globalThis.__autoSbcLastLoggedUtItemEntity = e;
              console.log("[Auto-SBC] Current UTItemEntity", e);
              showNotification("UTItemEntity logged to console", UINotificationType.POSITIVE);
            },
            EventType.TAP,
          );
          this.logEntityButton = logButton;
        }

        const button = new UTGroupButtonControl();
        button.init();
        button.setInteractionState(true);
        button.setText(label);
        insertAfter(
          button,
          this.logEntityButton ? this.logEntityButton.__root : this._bioButton.__root,
        );
        button.addTarget(
          this,
          async () => {
            if (isItemLocked(e)) {
              unlockItem(e);
              button.setText(unlockedLabel);
              showNotification(`Item unlocked`, UINotificationType.POSITIVE);
            } else {
              lockItem(e);
              button.setText(lockedLabel);
              showNotification(`Item locked`, UINotificationType.POSITIVE);
            }
            try {
              getCurrentViewController()
                .getCurrentController()
                .leftController.renderView();
              getCurrentViewController()
                .getCurrentController()
                .rightController.currentController.renderView();
            } catch (error) {
              getCurrentViewController()
                .getCurrentController()
                .leftController.refreshList();
            }
          },
          EventType.TAP,
        );
        this.lockUnlockButton = button;
      }
    }
    if (!isItemLocked(e)) {
      const fixlabel = isItemFixed(e) ? fixedLabel : unfixedLabel;
      if (!this.fixUnfixButton) {
        const button = new UTGroupButtonControl();
        button.init();
        button.setInteractionState(true);
        button.setText(fixlabel);
        insertAfter(button, this._bioButton.__root);
        button.addTarget(
          this,
          async () => {
            if (isItemFixed(e)) {
              unfixItem(e);
              button.setText(unfixedLabel);
              showNotification(`Removed Must Use`, UINotificationType.POSITIVE);
            } else {
              fixItem(e);
              button.setText(fixedLabel);
              showNotification(`Must Use Set`, UINotificationType.POSITIVE);
            }
            try {
              getCurrentViewController()
                .getCurrentController()
                .leftController.renderView();
              getCurrentViewController()
                .getCurrentController()
                .rightController.currentController.renderView();
            } catch (error) {
              getCurrentViewController()
                .getCurrentController()
                .leftController.refreshList();
            }
          },
          EventType.TAP,
        );
        this.fixUnfixButton = button;
      }
    }

    return result;
  };

  const UTPlayerItemView_renderItem = UTPlayerItemView.prototype.renderItem;
  const UTItemView_render = UTItemView.prototype.render;

  UTItemView.prototype.render = async function (...args) {
    const result = UTItemView_render.call(this, ...args);
    const item = args[0];
    if (this.__root && item) {
      const priceElement = await getPriceDiv(item);
      if (priceElement) {
        const existing = this.__root.querySelector(":scope > .item-price");
        if (existing) existing.remove();
        this.__root.prepend(priceElement);
      }
    }
    return result;
  };

  UTPlayerItemView.prototype.renderItem = async function (item, t) {
    const result = UTPlayerItemView_renderItem.call(this, item, t);
    const duplicateIds = await fetchDuplicateIds();
    let storage = await getStoragePlayers();
    if (
      duplicateIds.includes(item.id) ||
      storage.map((m) => m.id).includes(item.id)
    ) {
      this.__root.style.opacity = "0.4";
    }
    let priceElement = await getPriceDiv(item);
    // Add the price element to the player item
    if (this.__root && priceElement) {
      const existing = this.__root.querySelector(":scope > .item-price");
      if (existing) existing.remove();
      this.__root.prepend(priceElement);
    }

    if (isItemLocked(item)) {
      addClass(this, "locked");
    } else {
      removeClass(this, "locked");
    }
    if (isItemFixed(item)) {
      addClass(this, "fixed");
    } else {
      removeClass(this, "fixed");
    }
    return result;
  };
};
const getPriceDiv = async (item) => {
  if (item.getSearchType() == "any") {
    return;
  }
  if (getSettings(0, 0, "showPrices") && item.definitionId > 0) {
    let PriceItems = getPriceItems();
    if (!PriceItems[item.definitionId]) {
      return null;
    }
    let price = getPrice(item) * (isItemFixed(item) ? 0 : 1);
    if (
      !(item.definitionId in PriceItems) ||
      !("isSbc" in PriceItems[item.definitionId])
    ) {
    }

    let symbol = PriceItems[item.definitionId]?.isSbc
      ? "currency-sbc"
      : PriceItems[item.definitionId]?.isObjective
        ? "currency-objective"
        : item.tradable
          ? "currency-coins"
          : "currency-untradable";
    const priceElement = document.createElement("div");
    priceElement.className = `${symbol} item-price`;

    if (isFodder(item)) {
      priceElement.style.border = "1px solid red"; // Add red border for fodder players
      priceElement.style.color = "#ff0000"; // Change text color to red as well
    }
    if (PriceItems[item.definitionId]?.isExtinct && isPriceOld(item)) {
      refreshItemsLivePrices([item]);
    }
    priceElement.textContent = PriceItems[item.definitionId]?.isExtinct
      ? "EXTINCT"
      : PriceItems[item.definitionId]?.isObjective
        ? ""
        : price.toLocaleString();

    return priceElement;
  }
  return null;
};

// FC 27 renders club/squad cards via module-internal item-view classes (minified,
// e.g. ME2/mS3) that are not exposed as globals but expose renderItem +
// setItemInfoState + resetRender. We capture them through the shared EA base
// `init` and patch renderItem on each item-view prototype once to prepend the
// price element — the same effect as the old UTPlayerItemView override.
const itemPriceRenderOverride = () => {
  if (window.__sbcItemPriceHookInstalled) return;

  const findEaBaseProto = () => {
    for (const key of ["UTTabBarView", "UTSBCSetTileView", "UTStoreView"]) {
      const cls = window[key];
      if (!cls || !cls.prototype) continue;
      let proto = cls.prototype;
      let base = null;
      while (proto && proto !== Object.prototype) {
        const own = Object.getOwnPropertyNames(proto);
        if (
          own.includes("isSubClass") &&
          own.includes("conforms") &&
          own.includes("init") &&
          own.includes("dealloc")
        ) {
          base = proto;
        }
        proto = Object.getPrototypeOf(proto);
      }
      if (base) return base;
    }
    return null;
  };

  const isItemCardView = (view) =>
    typeof view.renderItem === "function" &&
    typeof view.setItemInfoState === "function" &&
    typeof view.resetRender === "function";

  const patchItemViewProto = (proto) => {
    if (!proto || proto.__sbcPriceRenderPatched) return;
    proto.__sbcPriceRenderPatched = true;
    const originalRenderItem = proto.renderItem;
    proto.renderItem = function (...args) {
      const result = originalRenderItem.apply(this, args);
      try {
        const item = args[0];
        const root = this.__root || (this.getRootElement && this.getRootElement());
        if (item && root && getSettings(0, 0, "showPrices")) {
          Promise.resolve(getPriceDiv(item))
            .then((priceElement) => {
              const el =
                this.__root || (this.getRootElement && this.getRootElement());
              if (priceElement && el) {
                const existing = el.querySelector(":scope > .item-price");
                if (existing) existing.remove();
                el.prepend(priceElement);
              }
            })
            .catch(() => {});
        }
      } catch (_) {}
      return result;
    };
  };

  const baseProto = findEaBaseProto();
  if (!baseProto) {
    // EA runtime not fully loaded yet; retry shortly.
    setTimeout(itemPriceRenderOverride, 3000);
    return;
  }

  window.__sbcItemPriceHookInstalled = true;
  const originalInit = baseProto.init;
  baseProto.init = function (...args) {
    const result = originalInit.apply(this, args);
    try {
      const proto = Object.getPrototypeOf(this);
      if (proto && !proto.__sbcPriceRenderPatched && isItemCardView(this)) {
        patchItemViewProto(proto);
      }
    } catch (_) {}
    return result;
  };
};
