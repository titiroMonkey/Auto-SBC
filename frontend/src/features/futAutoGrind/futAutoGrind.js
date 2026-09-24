// FUTsutoGrind - Auto-grind automation for running favorite SBCs in a loop
let createSbcGrind = false;
let futAutoGrindWakeLockSentinel = null;
let futAutoGrindWakeLockBound = false;
const AUTO_GRIND_SUBMIT_LIMIT_60M = 90;
const AUTO_GRIND_SUBMIT_LIMIT_24H = 2400000;
const AUTO_GRIND_SUBMIT_CHECK_INTERVAL_MS = 60 * 1000;

const autoGrindDelay = (ms) =>
  new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

const getAutoGrindSubmitCounts = () => {
  try {
    const counts = getSbcSubmitTrackerCounts();
    return {
      last60m: Number(counts?.last60m) || 0,
      last24h: Number(counts?.last24h) || 0,
    };
  } catch {
    return { last60m: 0, last24h: 0 };
  }
};

const getAutoGrindSubmitPauseState = () => {
  const counts = getAutoGrindSubmitCounts();
  return {
    ...counts,
    shouldPause:
      counts.last60m >= AUTO_GRIND_SUBMIT_LIMIT_60M ||
      counts.last24h >= AUTO_GRIND_SUBMIT_LIMIT_24H,
  };
};

const waitForAutoGrindSubmitWindow = async (log) => {
  let notifiedPaused = false;

  while (createSbcGrind) {
    const pauseState = getAutoGrindSubmitPauseState();
    if (!pauseState.shouldPause) {
      if (notifiedPaused) {
        showNotification(
          `Auto-grind resumed (60m: ${pauseState.last60m}/${AUTO_GRIND_SUBMIT_LIMIT_60M}, 24h: ${pauseState.last24h}/${AUTO_GRIND_SUBMIT_LIMIT_24H})`,
          UINotificationType.POSITIVE,
        );
        log("submitLimit:resume", pauseState);
      }
      return true;
    }

    if (!notifiedPaused) {
      notifiedPaused = true;
      showNotification(
        `Auto-grind paused: submit limit reached (60m ${pauseState.last60m}/${AUTO_GRIND_SUBMIT_LIMIT_60M}, 24h ${pauseState.last24h}/${AUTO_GRIND_SUBMIT_LIMIT_24H}). Rechecking every minute.`,
        UINotificationType.NEUTRAL,
      );
      log("submitLimit:pause", pauseState);
    } else {
      log("submitLimit:still-paused", pauseState);
    }

    // Use short polling intervals (500ms) instead of one long 60s wait.
    // This allows the stop button to take effect immediately instead of waiting up to 60s.
    const pollInterval = 500;
    const pollCount = AUTO_GRIND_SUBMIT_CHECK_INTERVAL_MS / pollInterval;
    for (let i = 0; i < pollCount; i++) {
      if (!createSbcGrind) {
        return false; // Stop button was clicked
      }
      await autoGrindDelay(pollInterval);
    }
  }

  return false;
};

const acquireFutAutoGrindWakeLock = async () => {
  try {
    if (!createSbcGrind) return;
    if (!navigator?.wakeLock?.request) return;
    if (document.visibilityState !== "visible") return;
    if (futAutoGrindWakeLockSentinel) return;

    futAutoGrindWakeLockSentinel = await navigator.wakeLock.request("screen");
    futAutoGrindWakeLockSentinel?.addEventListener?.("release", () => {
      futAutoGrindWakeLockSentinel = null;
    });
  } catch (err) {
    console.warn("[autoGrind] wake lock request failed", err);
  }
};

const releaseFutAutoGrindWakeLock = async () => {
  try {
    if (futAutoGrindWakeLockSentinel) {
      await futAutoGrindWakeLockSentinel.release();
    }
  } catch (err) {
    console.warn("[autoGrind] wake lock release failed", err);
  } finally {
    futAutoGrindWakeLockSentinel = null;
  }
};

const bindFutAutoGrindWakeLockLifecycle = () => {
  if (futAutoGrindWakeLockBound) return;
  futAutoGrindWakeLockBound = true;

  document.addEventListener("visibilitychange", () => {
    if (!createSbcGrind) return;
    if (document.visibilityState === "visible") {
      acquireFutAutoGrindWakeLock();
    }
  });
};

const futAutoGrind = async () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let cycle = 0;

  const log = (step, data = {}) => {
    // Keep logs consistent + searchable
    console.log(`[autoGrind:${runId}] ${step}`, {
      cycle,
      createSbcGrind,
      ...data,
    });
  };

  const safe = async (step, fn) => {
    const start = performance.now();
    log(`${step}:start`);
    try {
      const result = await fn();
      log(`${step}:ok`, { ms: Math.round(performance.now() - start) });
      return { ok: true, result };
    } catch (err) {
      log(`${step}:ERROR`, { ms: Math.round(performance.now() - start), err });
      return { ok: false, err };
    }
  };

  const processPostSbcRewards = async (contextLabel, sbcId = 0) => {
    let latestUnassigned = [];
    let pickDrainIteration = 0;
    let previousPickCount = null;
    let stagnantPickIterations = 0;

    while (createSbcGrind) {
      pickDrainIteration += 1;

      const unassignedRes = await safe(
        `fetchUnassigned() (${contextLabel}:pickDrain:${pickDrainIteration})`,
        () => fetchUnassigned(),
      );
      latestUnassigned = unassignedRes.ok ? unassignedRes.result : [];
      const pendingPicks = latestUnassigned.filter((item) =>
        item.isPlayerPickItem(),
      );

      log("unassigned:afterSolve", {
        contextLabel,
        pickDrainIteration,
        unassignedCount: latestUnassigned.length,
        pendingPicks: pendingPicks.map((p) => p.definitionId),
        autoConfirmPicks: !!getSettings(sbcId, 0, "autoConfirmPicks"),
      });

      if (!pendingPicks.length) {
        break;
      }

      if (previousPickCount !== null && pendingPicks.length >= previousPickCount) {
        stagnantPickIterations += 1;
      } else {
        stagnantPickIterations = 0;
      }
      previousPickCount = pendingPicks.length;

      if (stagnantPickIterations >= 3) {
        log("picks:break (stagnant)", {
          contextLabel,
          pendingPickCount: pendingPicks.length,
        });
        break;
      }

      for (const pick of pendingPicks) {
        if (!createSbcGrind) {
          log("picks:break (createSbcGrind turned false)", { contextLabel });
          break;
        }
        log("openPick:start", {
          contextLabel,
          pickDrainIteration,
          pickId: pick.definitionId,
        });
        await safe(`openPick(${pick.definitionId})`, () =>
          openPick(pick.definitionId, sbcId, 0),
        );
      }
    }

    const freeCoins = latestUnassigned.filter((item) => item.isFreeCoins());
    if (freeCoins.length) {
      log("freeCoins:redeem", {
        contextLabel,
        count: freeCoins.length,
      });
      for (const coin of freeCoins) {
        await safe(`services.Item.redeem(${coin.definitionId})`, () =>
          new Promise((resolve, reject) => {
            services.Item.redeem(coin).observe(null, function (obs, res) {
              obs?.unobserve?.(null);
              res?.success ? resolve(res) : reject(res);
            });
          }),
        );
      }
    } else {
      log("freeCoins:none", { contextLabel });
    }

    const shouldOpenAllPacks =
      getSettings(0, 0, "autoGrindOpenAllPacks") !== false;

    log("packs:setting", {
      contextLabel,
      autoGrindOpenAllPacks: shouldOpenAllPacks,
    });

    if (!shouldOpenAllPacks) {
      return;
    }

    const [packsRes, unassignedCountRes] = await Promise.all([
      safe(`getPacks() (${contextLabel})`, () => getPacks()),
      safe(`fetchUnassigned() (pre-pack:${contextLabel})`, () => fetchUnassigned()),
    ]);

    const packs = packsRes.ok ? packsRes.result : null;
    const unassignedCount = unassignedCountRes.ok
      ? unassignedCountRes.result
      : [];

    const myPacks = (packs?.packs || []).filter((p) => p?.isMyPack);
    const myPack = myPacks[0];

    log("packs:check", {
      contextLabel,
      ownedPackCount: myPacks.length,
      hasMyPack: !!myPack,
      myPackId: myPack?.id,
      myPackName: myPack?.packName,
      unassignedCount: unassignedCount.length,
    });

    if (!myPack) {
      return;
    }

    let i = services.Localization;
    services.Notification.queue(
      ["Opening Pack:  " + i.localize(myPack.packName)],
      UINotificationType.POSITIVE,
    );

    const openPackRes = await safe(`openPack(allMyPacks:${contextLabel})`, () =>
      openPack(myPack, 0, true),
    );

    if (!openPackRes.ok) {
      log("packs:continueAfterFailure", { contextLabel });
      return;
    }

    if (openPackRes.result?.skipped) {
      log("packs:blocked", {
        contextLabel,
        reason: openPackRes.result.reason,
      });
    }
  };

  try {
    bindFutAutoGrindWakeLockLifecycle();
    await acquireFutAutoGrindWakeLock();

    services.Notification.queue(
      ["Starting auto‐grind for favorites…"],
      UINotificationType.POSITIVE,
    );

    log("entered");

    // loop until user clicks STOP
    while (createSbcGrind) {
      const canContinue = await waitForAutoGrindSubmitWindow(log);
      if (!canContinue) {
        break;
      }

      cycle += 1;
      log("cycle:start");

      const sbcsRes = await safe("sbcSets()", () => sbcSets());
      if (!sbcsRes.ok) {
        log("cycle:stop (failed to fetch sbcSets)");
        break;
      }
      const sbcs = sbcsRes.result;

      // get favourites and run 1 sbc of each continuously, opening packs in between
      const favourites = (sbcs?.sets || [])
        .filter((f) => f.isFavourite && !f.isComplete())
        .map((m) => m.id);

      log("favourites:computed", { count: favourites.length, favourites });

      if (!favourites.length) {
        showNotification("No favorite SBCs found", UINotificationType.NEGATIVE);
        log("cycle:return (no favourites)");
        return;
      }

      for (const fav of favourites) {
        const canContinue = await waitForAutoGrindSubmitWindow(log);
        if (!canContinue) {
          break;
        }

        log("fav:start", {
          fav,
          name: sbcs?.sets?.find((s) => s.id == fav)?.name,
        });

        if (!createSbcGrind) {
          log("fav:break (createSbcGrind turned false before start)");
          break;
        }

        // Fetch storage and club players in parallel (ratingCountUI deferred to end of cycle)
        const [storageRes, playersRes] = await Promise.all([
          safe("getStoragePlayers()", () => getStoragePlayers()),
          safe("fetchPlayers()", () => fetchPlayers()),
        ]);

        const storageNow = storageRes.ok ? storageRes.result : [];
        const players = playersRes.ok ? playersRes.result : [];

        const midCount = storageNow.filter(
          (p) => p.rating > 75 && p.rating < 83,
        ).length;
        const midPlayerCount = players.filter(
          (p) => p.rating > 75 && p.rating < 84,
        ).length;

        log("inventory:counts", {
          storageLen: storageNow.length,
          clubLen: players.length,
          midCountStorage: midCount,
          midCountClub: midPlayerCount,
        });

        let targetSet;

        if (midCount > 0) {
          targetSet = (sbcs?.sets || [])
            .filter((f) => !f.hidden && !f.isComplete())
            .find((f) => /TOTW/i.test(f.name));
          log("targetSet:maybe", {
            reason: "midCount > 0 => /TOTW/",
            found: !!targetSet,
            targetSetId: targetSet?.id,
            targetSetName: targetSet?.name,
          });
        }

        if (targetSet && storageNow.length >= 100) {
          services.Notification.queue(
            [`Running SBC: ${targetSet.name}`],
            UINotificationType.POSITIVE,
          );
          log("solveSBC:targetSet", { setId: targetSet.id });

          const solveRes = await safe("solveSBC(targetSet)", () =>
            solveSBC(targetSet.id, 0, true, 0, false, false, true),
          );

          if (!solveRes.ok) {
            log("fav:continue (solveSBC targetSet errored)");
          } else if (createSbcGrind) {
            await processPostSbcRewards("targetSet", targetSet.id);
          }

          log("fav:continue (after targetSet)");
          continue;
        }

        const favName = sbcs?.sets?.find((f) => f.id == fav)?.name;
        services.Notification.queue(
          [`Running SBC: ${favName}`],
          UINotificationType.POSITIVE,
        );

        log("solveSBC:fav", { fav, favName });

        if (!createSbcGrind) {
          log("fav:break (createSbcGrind turned false before solveSBC)");
          break;
        }

        const solveFavRes = await safe("solveSBC(fav)", () =>
          solveSBC(fav, 0, true, 0, false, false, true),
        );

        if (!createSbcGrind) {
          log("fav:break (createSbcGrind turned false after solveSBC)");
          break;
        }

        if (!solveFavRes.ok) {
          log("fav:continue (solveSBC fav errored)");
          continue;
        }

        if (createSbcGrind) {
          await processPostSbcRewards(`favourite:${fav}`, fav);
        }

        log("fav:end", { fav });
      }

      await safe("ratingCountUI() (end of cycle)", () => ratingCountUI());
      log("cycle:end");
    }

    log("exited (createSbcGrind is false)");
  } catch (err) {
    // IMPORTANT: don't recursively re-call futAutoGrind() here; it hides the real failure and can loop forever.
    console.warn(`[autoGrind:${runId}] fatal error`, err);
    showNotification(
      "Auto-grind crashed; check console logs",
      UINotificationType.NEGATIVE,
    );
    createSbcGrind = false;
  } finally {
    await releaseFutAutoGrindWakeLock();
  }
};
