const waitForPlayerPickConsumed = async (
  definitionId,
  { timeoutMs = 120000, pollMs = 1000 } = {},
) => {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const unassigned = (await fetchUnassigned()) || [];
      const stillPending = unassigned.some(
        (item) =>
          item?.isPlayerPickItem?.() &&
          Number(item?.definitionId) === Number(definitionId),
      );

      if (!stillPending) {
        return { success: true };
      }
    } catch (error) {
      console.warn("waitForPlayerPickConsumed poll failed", error);
    }

    await sleep(pollMs);
  }

  return { success: false, timedOut: true };
};

const waitForPickedPlayersInUnassigned = async (
  candidateDefinitionIds,
  baselineCounts,
  { timeoutMs = 120000, pollMs = 1000 } = {},
) => {
  const uniqueIds = [
    ...new Set((candidateDefinitionIds || []).map(Number)),
  ].filter((definitionId) => Number.isFinite(definitionId) && definitionId > 0);

  if (!uniqueIds.length) {
    return { success: true, reason: "no-candidate-definition-ids" };
  }

  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const unassigned = (await fetchUnassigned()) || [];
      const currentCounts = {};
      for (const definitionId of uniqueIds) {
        currentCounts[definitionId] = 0;
      }

      for (const item of unassigned) {
        const definitionId = Number(item?.definitionId);
        if (currentCounts[definitionId] !== undefined) {
          currentCounts[definitionId] += 1;
        }
      }

      const newArrivalId = uniqueIds.find(
        (definitionId) =>
          (currentCounts[definitionId] || 0) >
          (baselineCounts?.[definitionId] || 0),
      );

      if (newArrivalId !== undefined) {
        return { success: true, definitionId: newArrivalId };
      }
    } catch (error) {
      console.warn("waitForPickedPlayersInUnassigned poll failed", error);
    }

    await sleep(pollMs);
  }

  return { success: false, timedOut: true };
};

const playerPickItemMatchesPackAnimationFilter = (item) => {
  if (typeof itemMatchesPackAnimationFilter === "function") {
    return itemMatchesPackAnimationFilter(item);
  }
  return false;
};

const openPick = async (id, sbcId = 0, challengeId = 0) => {
  try {
    let pickedPlayerArrivedInUnassigned = false;
    const pickFlowToken =
      typeof window.__autoSbcBeginPickFlow === "function"
        ? window.__autoSbcBeginPickFlow()
        : null;

    // Store sbcId and challengeId in global variables for use in render function
    currentPickSbcId = sbcId;
    currentPickChallengeId = challengeId;

    let pp = await fetchUnassigned();
    const baselineUnassignedCounts = {};

    let playerPicks = pp.filter(
      (m) => m.isPlayerPickItem() && m.definitionId === id,
    );
    services.Item.redeem(playerPicks[0]);
    let n = new UTItemDetailsViewController();
    services.Item.requestPendingPlayerPickItemSelection().observe(
      n,
      function (e, t) {
        (e.unobserve(n),
          t.success && JSUtils.isObject(t.response)
            ? n.showPlayerPicks(t.response.items, t.response.availablePicks, !0)
            : NetworkErrorManager.handleStatus(t.status));
      },
    );

    if (
      pickFlowToken !== null &&
      typeof window.__autoSbcWaitForPickFlow === "function"
    ) {
      const pickFlowResult = await window.__autoSbcWaitForPickFlow(
        pickFlowToken,
        45000,
      );
      if (pickFlowResult?.timedOut) {
        console.warn("Player pick flow timed out waiting for render/confirm");
      }

      const candidateDefinitionIds = (
        pickFlowResult?.selectedDefinitionIds?.length
          ? pickFlowResult.selectedDefinitionIds
          : pickFlowResult?.optionDefinitionIds || []
      )
        .map(Number)
        .filter(
          (definitionId) => Number.isFinite(definitionId) && definitionId > 0,
        );

      if (candidateDefinitionIds.length) {
        for (const definitionId of candidateDefinitionIds) {
          baselineUnassignedCounts[definitionId] = pp.filter(
            (item) => Number(item?.definitionId) === definitionId,
          ).length;
        }
      }

      const arrived = await waitForPickedPlayersInUnassigned(
        candidateDefinitionIds,
        baselineUnassignedCounts,
        {
          timeoutMs: 120000,
          pollMs: 1000,
        },
      );

      pickedPlayerArrivedInUnassigned = !!arrived?.success;

      if (arrived?.timedOut) {
        console.warn(
          "Timed out waiting for picked player to appear in unassigned",
          {
            definitionId: id,
            candidateDefinitionIds,
          },
        );
      }
    }

    // Ensure the pick item is fully consumed before continuing solver flow.
    const consumed = await waitForPlayerPickConsumed(id, {
      timeoutMs: 120000,
      pollMs: 1000,
    });
    if (consumed?.timedOut) {
      console.warn("Timed out waiting for player pick to be consumed", {
        definitionId: id,
      });
    }

    if (
      pickedPlayerArrivedInUnassigned &&
      !window.__autoSbcSolveRunInBackground
    ) {
      await goToUnassignedView();
    }
  } catch (err) {
    console.error("Error fetching or filtering:", err);
  }
};
let openPack = async (pack, repeat = 0, allPacks = false) => {
  const runInBackground = !!window.__autoSbcSolveRunInBackground;
  try {
    // Only manage the loader when an SBC solve is driving this call
    if (window.__autoSbcIsSolveRunActive?.()) {
      hideLoader();
      showLoader();
    }

    await processUnassigned({ suppressNavigation: runInBackground });

    let ulist = await fetchUnassigned();

    if (ulist?.length > 0) {
      if (!runInBackground) {
        await goToUnassignedView();
      }
      return { skipped: true, reason: "unassignedNotEmpty" };
    }

    return await new Promise((resolve, reject) => {
      let settled = false;
      const safeResolve = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const safeReject = (err) => {
        if (settled) return;
        settled = true;
        reject(err);
      };

      try {
        repositories.Store.setDirty();

        pack.open().observe(this, async function (obs, res) {
          try {
            if (!res?.success) {
              try {
                obs?.unobserve?.(this);
              } catch (e) {}

              createSBCTab();

              hideLoader();

              safeReject(res?.status ?? new Error("pack.open failed"));
              return;
            }

            const packPlayers = res.response;
            const items = Array.isArray(packPlayers?.items)
              ? packPlayers.items
              : [];
            await fetchPlayerPrices(items);

            try {
              console.table(
                items
                  .slice()
                  .sort((t, e) => getSBCPrice(e) - getSBCPrice(t))
                  .map((item) => ({
                    name: item?._staticData?.name,
                    cardType:
                      (item?.isSpecial?.()
                        ? ""
                        : services.Localization.localize(
                            "search.cardLevels.cardLevel" + item.getTier(),
                          ) + " ") +
                      services.Localization.localize(
                        "item.raretype" + item.rareflag,
                      ),
                    rating: item?.rating,
                    futggPrice: getPrice(item),
                    sbcPrice: getSBCPrice(item),
                  })),
              );
            } catch (e) {}

            const hasWalkout = items.some((item) =>
              playerPickItemMatchesPackAnimationFilter(item),
            );

            if (hasWalkout) {
              createSbc = false;
              await showPack(pack, packPlayers);
            }

            createSBCTab();

            repeat = repeat - 1;

            if (repeat > 0) {
              await refreshUnassignedPrices(items);

              if (!runInBackground) {
                await goToUnassignedView();
              }
              await openPack(pack, repeat, false);
            } else if (allPacks) {
              const packs = await getPacks();
              const nextPack = packs?.packs?.find((p) => p?.isMyPack);

              if (nextPack) {
                await refreshUnassignedPrices(items);

                if (!runInBackground) {
                  await goToUnassignedView();
                }

                await processUnassigned({
                  force: true,
                  suppressNavigation: runInBackground,
                });

                await openPack(nextPack, 0, true);
              }
            }

            if (!runInBackground) {
              await goToUnassignedView();
            }

            safeResolve(res.response);
          } catch (err) {
            try {
              hideLoader();
            } catch {}
            safeReject(err);
          }
        });
      } catch (err) {
        safeReject(err);
      }
    });
  } catch (err) {
    throw err;
  }
};

let showPack = async (pack, packPlayers) => {
  return new Promise((resolve, reject) => {
    let c = new UTStoreViewController();
    var o = null,
      n = packPlayers.items.filter(function (e) {
        return e.isPlayer();
      });
    if (0 < n.length) {
      var r = new UTItemUtils(),
        s = n.sort(function (t, e) {
          return getSBCPrice(e) - getSBCPrice(t);
        });
      o = s[0];
    } else
      packPlayers.items.forEach(function (e) {
        (!o || o.discardValue < e.discardValue) && (o = e);
      });

    const hasWalkout = (packPlayers?.items || []).some((item) =>
      playerPickItemMatchesPackAnimationFilter(item),
    );

    if (o && hasWalkout) {
      if (getSettings(0, 0, "playSounds")) {
        sound.play();
      }
      var a = new UTPackAnimationViewController();
      (a.initWithPackData(o, pack.assetId),
        a.setAnimationCallback(
          function () {
            (this.dismissViewController(!1, function () {
              a.dealloc();
            }),
              repositories.Store.setDirty());
          }.bind(c),
        ),
        (a.modalDisplayStyle = "fullscreen"),
        c.presentViewController(a, !0));
    }

    resolve();
  });
};
let packCountLabels = {};
