const refreshUnassignedPrices = async (items = [], refreshAll = false) => {
  if (!Array.isArray(items) || !items.length) return;

  const startedAt = Date.now();
  let processed = 0;
  let timedOut = 0;
  let failed = 0;

  const filtered = (items || []).filter((item) => {
    const price = getPrice(item);
    const isConceptLike = !!item?.concept || Number(item?.owners) === 0;
    const include = refreshAll || (!isConceptLike && price == null);
    return include;
  });

  const uniqueItemsWithoutPrice = Array.from(
    new Map(filtered.map((item) => [item.definitionId, item])).values(),
  );

  if (!uniqueItemsWithoutPrice.length) {
    return;
  }

  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const containerId = `unassigned-prices-progress-container-${uniqueSuffix}`;
  const progressBarId = `unassigned-prices-progress-bar-${uniqueSuffix}`;
  createProgressBar(progressBarId, containerId, "Refreshing Unassigned Prices");
  updateProgressBar(progressBarId, 0);

  const total = uniqueItemsWithoutPrice.length;

  const withTimeout = (promise, ms, label) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`Timeout: ${label}`)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() =>
      clearTimeout(timeoutId),
    );
  };

  const configuredBatchSize = Number(getSettings(0, 0, "futggPriceBatchSize"));
  const batchSize =
    Number.isFinite(configuredBatchSize) && configuredBatchSize > 0
      ? Math.min(50, Math.max(1, Math.floor(configuredBatchSize)))
      : 30;

  try {
    for (let idx = 0; idx < uniqueItemsWithoutPrice.length; idx += batchSize) {
      const batch = uniqueItemsWithoutPrice.slice(idx, idx + batchSize);
      try {
        if (typeof fetchPlayerPrices === "function") {
          // Batch refresh is significantly faster than sequential per-item lookup.
          await withTimeout(
            fetchPlayerPrices(batch, {
              waitForCompletion: true,
              suppressNotification: true,
            }),
            45000,
            `fetchPlayerPrices(batch ${idx / batchSize + 1})`,
          );
        } else {
          for (const item of batch) {
            const defId = item?.definitionId;
            await withTimeout(
              fetchLivePlayerPrice(item),
              25000,
              `fetchLivePlayerPrice(${defId})`,
            );
          }
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
      } catch (error) {
        const msg = String(error?.message || error);
        if (msg.includes("Timeout:")) {
          timedOut += batch.length;
        } else {
          failed += batch.length;
        }
      } finally {
        processed += batch.length;
        updateProgressBar(progressBarId, (processed / total) * 100);
      }
    }

    updateProgressBar(progressBarId, 100);
  } finally {
    removeProgressBar(containerId);
    const ms = Date.now() - startedAt;

  }
};
