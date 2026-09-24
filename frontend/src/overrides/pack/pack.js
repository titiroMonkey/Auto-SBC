const packOverRide = async () => {
  UTStoreView.prototype.setPacks = function (e, t, i, o) {
    const uniquePackEntries = [];
    const packCountMap = new Map();

    e.forEach((pack) => {
      const packId = pack?.id;

      const key = packId ?? Symbol();
      const existing = packCountMap.get(key);

      if (existing) {
        existing.count += 1;
      } else {
        const entry = { pack, count: 1 };
        packCountMap.set(key, entry);
        uniquePackEntries.push(entry);
      }
    });
    var n = this;
    (this.clearPacks(),
      this.clearNimbleMTXItems(),
      this.setDescriptionString(""),
      this.toggleDescription(!1),
      uniquePackEntries.forEach(({ pack, count }) => {
        packCountLabels[pack.id] = count;
        let e = pack;
        e instanceof UTStoreXrayItemPackEntity
          ? n.generateXrayPack(e, o)
          : e instanceof UTStoreItemPackEntity
            ? n.generatePack(e, t, i, !e.isMyPack && o)
            : e instanceof UTStoreBundleEntity && n.generateBundle(e, t, i);
      }),
      this.layoutSubviews(),
      this.checkPackShineStates());
  };
  UTStorePackDetailsView.prototype.setupCountIcon = async function (pack) {
    let packs = await getPacks(true);
    let count = packs.packs.filter((f) => f.id == pack.id).length;

    console.log(count);
  };
  UTStorePackDetailsView.prototype.setupPVButton = function () {
    let articleId = this.articleId;

    const updateVisibilityClass = (visible) => {
      if (!this._btnPV) {
        return;
      }
      this._btnPV.removeClass("show-pack");
      this._btnPV.removeClass("hide-pack");
      this._btnPV.addClass(visible ? "show-pack" : "hide-pack");
    };

    const initVisibility = (articleId) => {
      const visible = articleId ? packVisibilityStore.get(articleId) : true;
      updateVisibilityClass(visible);
      return visible;
    };

    this._btnPV = new UTImageButtonControl();
    this._btnPV.init();

    const initialVisibility = initVisibility(articleId);

    this._btnPV.addTarget(
      this,
      () => {
        if (!articleId) return;
        const next = !packVisibilityStore.get(articleId);
        packVisibilityStore.set(articleId, next);
        updateVisibilityClass(next);
        console.log(articleId, "pack visibility set to", next);
        createSBCTab();
      },
      EventType.TAP,
    );

    updateVisibilityClass(initialVisibility);
    this.appendHeaderButton(this._btnPV);
  };

  UTStoreView.prototype.setupPack = function (e, t) {
    var i,
      o = this.setupArticleView(e);
    return o instanceof UTStorePackDetailsView
      ? ((i =
          e.guidAssetId && !JSUtils.isEmpty(e.guidAssetId)
            ? Number(e.guidAssetId)
            : Number(e.assetId)),
        DebugUtils.Assert(
          JSUtils.isNumber(i),
          "Foreground asset id is expecting a number but received" + typeof i,
        ),
        o.renderDefault(e.assetId),
        o.setItemCounts(e.itemQuantity, e.rareQuantity, e.contentType),
        o.setupCountIcon(e),
        e.isMyPack && o.setupPVButton(),
        t &&
          (o.setupOddsButton(),
          o.addTarget(
            this,
            this._ePackEventHandler,
            UTStorePackDetailsView.Event.CHECK_ODDS,
          )),
        o)
      : null;
  };

  const packOpen = UTStoreViewController.prototype.eOpenPack;
  UTStoreViewController.prototype.eOpenPack = async function (...args) {
    // Manual pack opens — no loader, no background mode
    await processUnassigned();
    createSBCTab();

    let shouldGoToUnassigned = false;

    let packs = await getPacks();
    let item = args[2].articleId;
    let packToOpen = packs.packs.filter((f) => f.id == item)[0];

    let i = services.Localization;

    services.Notification.queue([
      "Opening Pack:  " + i.localize(packToOpen.packName),
      UINotificationType.POSITIVE,
    ]);
    console.log(
      "Opening Pack:  " + i.localize(packToOpen.packName),
      packToOpen,
    );
    if (packs.packs.filter((f) => f.id == item).length > 0) {
      shouldGoToUnassigned = true;
      try {
        if (packToOpen.isMyPack) {
          await openPack(packToOpen);
        } else {
          let e = args[1];
          let m =
            e === "UTStorePackDetailsView.Event.BUY_POINTS" ||
            e === "UTStoreBundleDetailsView.Event.BUY_POINTS" ||
            e === "UTStoreRevealModalListView.Event.POINTS_PURCHASE"
              ? GameCurrency.POINTS
              : GameCurrency.COINS;

          await new Promise((resolve) => {
            packToOpen
              .purchase(m)
              .observe(new UTStoreViewController(), async (obs, event) => {
                console.log("coin pack", obs, event);
                if (event?.success) {
                  await openPack(packToOpen);
                }
                resolve();
              });
          });
        }
      } finally {
        await goToUnassignedView();
        await wait(10);
      }
    }
  };
};
