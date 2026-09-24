let goToPacks = async () => {
  await processUnassigned();
  let ulist = await fetchUnassigned();

  if (ulist.length > 0) {
    goToUnassignedView();
    return;
  }
  repositories.Store.setDirty();
  let n = new UTStorePackViewController();
  n.init();
  getCurrentViewController()
    .rootController.getRootNavigationController()
    .popViewController();
  getCurrentViewController()
    .rootController.getRootNavigationController()
    .pushViewController(n);
};
let goToUnassignedView = async (itemsOverride = null) => {
  const logPrefix = "[goToUnassignedView]";
  const startedAt = Date.now();

  // Skip navigation if no items override provided and unassigned pile is empty
  if (!Array.isArray(itemsOverride)) {
    try {
      const unassigned = await fetchUnassigned();
      if (!unassigned || unassigned.length === 0) {
        console.log(`${logPrefix} skipped — no unassigned players`);
        return;
      }
    } catch (err) {
      console.warn(`${logPrefix} pre-check fetchUnassigned failed`, err);
    }
  }

  console.groupCollapsed(`${logPrefix} start`);
  console.log(`${logPrefix} itemsOverride`, {
    provided: Array.isArray(itemsOverride),
    count: Array.isArray(itemsOverride) ? itemsOverride.length : null,
  });

  return new Promise((resolve, reject) => {
    let sorted = [];

    try {
      console.log(`${logPrefix} clearing unassigned repos`);
      repositories.Item.unassigned.clear();
      repositories.Item.unassigned.reset();
    } catch (err) {
      console.warn(`${logPrefix} failed to clear/reset unassigned repos`, err);
    }

    const vc = getCurrentViewController();
    const r = vc?.rootController;

    console.log(`${logPrefix} current VC`, {
      hasVC: !!vc,
      hasRootController: !!r,
      isPhone: typeof isPhone === "function" ? isPhone() : "unknown",
    });

    const openView = async (items = []) => {
      console.groupCollapsed(`${logPrefix} openView`);
      console.log(`${logPrefix} openView items`, { count: items?.length || 0 });
      try {
        console.log(
          `${logPrefix} openView sample`,
          (items || []).slice(0, 5).map((it) => ({
            id: it?.id,
            definitionId: it?.definitionId,
            rating: it?.rating,
            tradable: it?.tradable,
            price: typeof getPrice === "function" ? getPrice(it) : undefined,
          })),
        );
      } catch {}

      const o = r?.getRootNavigationController?.();
      if (!o) {
        console.warn(`${logPrefix} openView: no root navigation controller`);
        console.groupEnd();
        return;
      }

      const phone = typeof isPhone === "function" ? isPhone() : false;
      const n = phone
        ? new UTUnassignedItemsViewController()
        : new UTUnassignedItemsSplitViewController();

      sorted = (items || [])
        .slice()
        .sort((t, e) => getSBCPrice(e) - getSBCPrice(t));

      console.log(`${logPrefix} sorted`, {
        count: sorted.length,
        top5: sorted.slice(0, 5).map((it) => ({
          definitionId: it?.definitionId,
          rating: it?.rating,
          sbcPrice: typeof getSBCPrice === "function" ? getSBCPrice(it) : null,
          futggPrice: typeof getPrice === "function" ? getPrice(it) : null,
        })),
      });

      try {
        n.initWithItems(sorted);
        console.log(`${logPrefix} view controller initialized`, {
          controllerType: n?.constructor?.name,
        });
      } catch (err) {
        console.warn(`${logPrefix} initWithItems failed`, err);
      }

      try {
        console.log(`${logPrefix} refreshUnassignedPrices start`, {
          count: sorted.length,
        });
      } catch (err) {
        console.warn(`${logPrefix} refreshUnassignedPrices failed`, err);
      }

      try {
        services.Item.clearTransferMarketCache();
        console.log(`${logPrefix} cleared transfer market cache`);
      } catch (err) {
        console.warn(`${logPrefix} clearTransferMarketCache failed`, err);
      }

      try {
        console.log(`${logPrefix} navigating: popToRoot -> pushViewController`);
        o.popToRootViewController();
        o.pushViewController(n);
      } catch (err) {
        console.warn(`${logPrefix} navigation failed`, err);
      }

      console.groupEnd();
    };

    try {
      console.log(`${logPrefix} loader: show`);
      hideLoader();
      showLoader();
    } catch (err) {
      console.warn(`${logPrefix} loader calls failed`, err);
    }

    // If a list is provided, use it instead of fetching unassigned items
    if (Array.isArray(itemsOverride)) {
      console.log(`${logPrefix} using overridden unassigned items`);
      Promise.resolve(openView(itemsOverride.slice(0, 49)))
        .then(async () => {
          console.log(`${logPrefix} override path done`, {
            ms: Date.now() - startedAt,
          });
          try {
            hideLoader();
          } catch {}
          console.groupEnd();
          resolve();
        })
        .catch((err) => {
          console.warn(`${logPrefix} override path error`, err);
          try {
            hideLoader();
          } catch {}
          console.groupEnd();
          reject(err);
        });
      return;
    }

    console.log(`${logPrefix} requesting unassigned items from service`);
    services.Item.requestUnassignedItems().observe(this, async function (e, t) {
      try {
        // keep original behavior, but log what we got
        console.log(`${logPrefix} requestUnassignedItems response`, {
          success: !!t?.success,
          status: t?.status,
          hasResponse: !!t?.response,
          itemsCount: t?.response?.items?.length ?? 0,
        });

        try {
          e?.unobserve?.(r);
        } catch (err) {
          console.warn(`${logPrefix} unobserve failed`, err);
        }

        const items = t?.response?.items || [];

        if (t.success && JSUtils.isObject(t.response)) {
          await openView(items);
        } else {
          console.warn(`${logPrefix} invalid response; opening empty view`);
          const o = r?.getRootNavigationController?.();
          if (o) {
            const n =
              typeof isPhone === "function" && isPhone()
                ? new UTUnassignedItemsViewController()
                : new UTUnassignedItemsSplitViewController();
            n.init();
            try {
              // sorted may still be [], but keep it safe
              await refreshUnassignedPrices(sorted);
            } catch (err) {
              console.warn(`${logPrefix} refreshUnassignedPrices failed`, err);
            }
            o.popToRootViewController();
            o.pushViewController(n);
          }
        }

        try {
          hideLoader();
        } catch {}

        // Keep original calls, but now "sorted" is always defined
        try {
          await refreshUnassignedPrices(sorted);
        } catch (err) {
          console.warn(`${logPrefix} refreshUnassignedPrices failed`, err);
        }

        console.log(`${logPrefix} done`, { ms: Date.now() - startedAt });
        console.groupEnd();
        resolve();
      } catch (err) {
        console.warn(`${logPrefix} failed`, err);
        try {
          hideLoader();
          ratingCountUI();
        } catch {}
        console.groupEnd();
        reject(err);
      }
    });
  });
};
let getPacks = async (getAll = false) => {
  return new Promise((resolve, reject) => {
    let packResponse;
    repositories.Store.setDirty();
    services.Store.getPacks("ALL", true, true).observe(
      this,
      function (obs, res) {
        if (!res.success) {
          obs.unobserve(this);
          reject(res.status);
        } else {
          packResponse = res.response;
          packResponse.packs = packResponse.packs.filter(
            (pack) =>
              !pack.isMyPack || packVisibilityStore.get(pack.id) || getAll,
          );
          resolve(packResponse);
        }
      },
    );
  });
};
