const buildSolutionSquadFromResults = (results, sbcData, players) => {
  let solutionSquad = [...Array(11)];
  sbcData.brickIndices.forEach((item) => {
    solutionSquad[item] = new UTItemEntity();
  });

  let hasConcepts = false;

  try {
    const parsed = JSON.parse(results);

    parsed
      .sort((a, b) => b.Is_Pos - a.Is_Pos)
      .forEach((item, solverIdx) => {
        let findMap = sbcData.formation.map(
          (currValue, idx) =>
            ((currValue == item.possiblePositions && item.Is_Pos == 1) ||
              item.Is_Pos == 0) &&
            solutionSquad[idx] == undefined,
        );

        if (item.concept) {
          hasConcepts = true;
        }

        const slotIdx = findMap.findIndex((element) => element);
        const matched = players.filter((f) => item.id == f.id);
        const player = matched[0];

        solutionSquad[slotIdx] = player;
      });
  } catch (error) {
    console.log("Error parsing solution results:", error);
    return null;
  }

  sbcData.subs.forEach((item) => {
    solutionSquad.push(players.filter((f) => item == f.definitionId)[0]);
  });

  return { solutionSquad, hasConcepts };
};

const reloadSbcScreen = async (sbcSet, challengeId) => {
  try {
    if (window.__autoSbcSolveRunInBackground) {
      return;
    }

    const navController =
      getCurrentViewController()?.rootController?.getRootNavigationController?.();
    if (!navController || !sbcSet || challengeId == null) {
      return;
    }

    const showSBC = new UTSBCSquadSplitViewController();
    showSBC.initWithSBCSet(sbcSet, challengeId);

    navController.popViewController();
    navController.pushViewController(showSBC);

    // Refresh squad price banners after new screen is pushed
    setTimeout(() => {
      try {
        if (typeof refreshSbcSquadPriceBanners === "function") {
          refreshSbcSquadPriceBanners();
        }
      } catch (err) {
        console.debug(
          "[Auto-SBC] Error refreshing squad price banners after reload:",
          err,
        );
      }
    }, 100);
  } catch (error) {
    console.warn("Failed to reload SBC screen", error);
  }
};

const getCurrentSquadPlayerSlots = () => {
  const controller = getControllerInstance?.();
  const challengeSquadPlayers = controller?._challenge?.squad?._players;
  const activeSquadPlayers = controller?._squad?._players;
  const squadPlayers = Array.isArray(activeSquadPlayers)
    ? activeSquadPlayers
    : Array.isArray(challengeSquadPlayers)
      ? challengeSquadPlayers
      : [];

  return squadPlayers
    .map((slot, slotIndex) => ({
      slot,
      slotIndex,
      item: slot?._item || slot?.item,
    }))
    .filter(({ item }) => item && Number(item?.definitionId) > 0);
};

const isEnabledSetting = (value) =>
  value === true || value === 1 || value === "1" || value === "true";

const INTERIM_SQUAD_APPLY_THROTTLE_MS = 10_000;
let pendingInterimResultPayload = null;
let pendingInterimApplyTimeout = null;
let allowInterimSquadApply = true;
let lastAppliedInterimResults = null;

const keepSolveLoaderVisible = () => {
  try {
    if (
      activeSolveContext &&
      isSolveRunActive(activeSolveContext.solveRunToken)
    ) {
      showLoader(true);
    }
  } catch {}
};

const setSolveLoaderHoldUntilFinal = (enabled) => {
  window.__autoSbcHoldLoaderUntilFinal = !!enabled;
};

const applyInterimSolverSolutionFromLog = async (
  resultPayload,
  forceApply = false,
) => {
  if (!allowInterimSquadApply) {
    return;
  }

  if (!resultPayload || resultPayload.event !== "interim_solution") {
    return;
  }

  if (
    !activeSolveContext ||
    !isSolveRunActive(activeSolveContext.solveRunToken)
  ) {
    return;
  }

  const solutionNumber = Number(resultPayload.solution_number || 0);
  if (
    !Number.isFinite(solutionNumber) ||
    solutionNumber <= lastAppliedInterimSolution
  ) {
    return;
  }

  if (!resultPayload.results) {
    return;
  }

  const { sbcSet, sbcData, players } = activeSolveContext;
  if (!sbcSet || !sbcData || !players) {
    return;
  }

  // Interim apply can trigger view navigation that briefly calls hide paths.
  // Re-assert hold + visibility so the solve loader stays up until final solve result.
  setSolveLoaderHoldUntilFinal(true);
  keepSolveLoaderVisible();

  const now = Date.now();
  const elapsedMs = now - lastInterimSquadApplyAt;
  if (!forceApply && elapsedMs < INTERIM_SQUAD_APPLY_THROTTLE_MS) {
    pendingInterimResultPayload = resultPayload;

    if (!pendingInterimApplyTimeout) {
      const delayMs = INTERIM_SQUAD_APPLY_THROTTLE_MS - elapsedMs;
      pendingInterimApplyTimeout = setTimeout(
        async () => {
          pendingInterimApplyTimeout = null;
          const payloadToApply = pendingInterimResultPayload;
          pendingInterimResultPayload = null;
          if (payloadToApply) {
            keepSolveLoaderVisible();
            await applyInterimSolverSolutionFromLog(payloadToApply, true);
          }
        },
        Math.max(0, delayMs),
      );
    }

    return;
  }

  try {
    const liveSbcSquad = new UTSBCSquadOverviewViewController();
    liveSbcSquad.initWithSBCSet(sbcSet, sbcData.challengeId);
    const { _squad, _challenge } = liveSbcSquad;
    _squad.removeAllItems();

    const parsedSolution = buildSolutionSquadFromResults(
      resultPayload.results,
      sbcData,
      players,
    );
    if (!parsedSolution) {
      return;
    }

    keepSolveLoaderVisible();
    _squad.setPlayers(parsedSolution.solutionSquad, true);
    await loadChallenge(_challenge);
    keepSolveLoaderVisible();
    await reloadSbcScreen(sbcSet, sbcData.challengeId);
    keepSolveLoaderVisible();

    // Navigation push/pop can still complete a tick later; reinforce once more.
    setTimeout(() => {
      try {
        if (
          activeSolveContext &&
          isSolveRunActive(activeSolveContext.solveRunToken)
        ) {
          setSolveLoaderHoldUntilFinal(true);
          keepSolveLoaderVisible();
        }
      } catch {}
    }, 150);

    lastAppliedInterimSolution = solutionNumber;
    lastInterimSquadApplyAt = Date.now();
    lastAppliedInterimResults = resultPayload.results;
  } finally {
    if (activeSolveContext && isSolveRunActive(activeSolveContext.solveRunToken)) {
      setSolveLoaderHoldUntilFinal(true);
      keepSolveLoaderVisible();
    }
  }
};

window.applyInterimSolverSolutionFromLog = applyInterimSolverSolutionFromLog;

const runNextLoginSbc = (runInBackground = true) => {
  if (!Array.isArray(sbcLogin) || sbcLogin.length <= 0) {
    return false;
  }

  const sbcToTry = sbcLogin.shift();
  sbcLogin = sbcLogin.slice();

  services.Notification.queue(
    [sbcToTry[2] + " SBC Started", UINotificationType.POSITIVE],
  );

  if (!runInBackground) {
    goToPacks();
  }

  solveSBC(sbcToTry[0], sbcToTry[1], true, null, false, false, true);
  return true;
};

const getGrantedRewardsForAutoOpen = (sbcData = {}) => {
  const rewards = [];

  for (const packId of sbcData.awards || []) {
    if (packId != null) {
      rewards.push({ type: "pack", packId });
    }
  }

  if (sbcData.finalSBC) {
    for (const reward of sbcData.setAward || []) {
      const item = reward?.item;
      if (item?.isPlayerPickItem?.() && Number(item.definitionId) > 0) {
        rewards.push({
          type: "pick",
          definitionId: Number(item.definitionId),
        });
      }
    }
  }

  return rewards;
};

const autoOpenGrantedRewards = async (sbcData, sbcId, challengeId) => {
  repositories.Store.setDirty();

  for (const reward of getGrantedRewardsForAutoOpen(sbcData)) {
    if (reward.type === "pick") {
      await openPick(reward.definitionId, sbcId, challengeId);
      continue;
    }

    const packs = await getPacks();
    const packToOpen = packs?.packs?.find((pack) => pack.id == reward.packId);

    if (!packToOpen) {
      console.warn("autoOpenPacks could not find reward pack", reward);
      continue;
    }

    await openPack(packToOpen);
  }
};

let solveSBC = async (
  sbcId,
  challengeId,
  autoSubmit = false,
  repeat = null,
  autoOpen = false,
  trynext = false,
  runInBackground = null,
  solveRunToken = null,
) => {
  try {
    const initialRunInBackground =
      runInBackground == null
        ? !!getSettings(sbcId, challengeId || 0, "runInBackground")
        : !!runInBackground;

    if (solveRunToken == null) {
      createSbc = true;
      activeSolveRunToken += 1;
      solveRunToken = activeSolveRunToken;
    }

    throwIfSolveRunCancelled(solveRunToken);

    if (createSbc != true) {
      showNotification("SBC Stopped");
      createSbc = true;
      return;
    }
    let sbcData = await fetchSBCData(sbcId, challengeId);
    throwIfSolveRunCancelled(solveRunToken);
    console.log(
      "Sbc Started",
      sbcData?.sbcName,
      sbcData?.challengeName,
      sbcData,
    );
    ratingCountUI();
    throwIfSolveRunCancelled(solveRunToken);
    counter = new Counter(".numCounter", {
      direction: "rtl",
      delay: 200,
      digits: 3,
    });

    showLoader(true);
    if (sbcData == null) {
      hideLoader();
      if (runNextLoginSbc(initialRunInBackground)) {
        return;
      }
      showNotification("SBC not available", UINotificationType.NEGATIVE);
      cancelActiveSolveRun();
      return;
    }
    addSbcInfo(sbcData.sbcName, sbcData.challengeName);

    await processUnassigned({ suppressNavigation: initialRunInBackground });
    throwIfSolveRunCancelled(solveRunToken);
    // await sendUnassignedtoTeam();
    // await swapDuplicates();
    // await sendDuplicatesToStorage();
    // await discardNonPlayerDupes();
    let players = await fetchPlayers();
    let storage = await getStoragePlayers();
    let unassigned = await fetchUnassigned();

    const currentSquadSlotsBeforeQuick = getCurrentSquadPlayerSlots();

    // Auto-apply quick solution before solve when enabled
    const shouldAutoApplyQuickSolution = isEnabledSetting(
      getSettings(sbcId, sbcData.challengeId, "autoApplyQuickSolutionOnOpen"),
    );
    let quickSolutionResult = null;
    if (
      shouldAutoApplyQuickSolution &&
      typeof autoApplyQuickSolutionOnPageOpen === "function"
    ) {
      try {
        quickSolutionResult = await autoApplyQuickSolutionOnPageOpen({
          force: true,
          // Solve straight from the SBC tab: don't push a squad screen and
          // supply the identifiers so we don't depend on a squad controller.
          suppressNavigation: true,
          setId: sbcId,
          challengeId: sbcData.challengeId,
        });
      } catch (error) {
        console.warn("[Auto-SBC] Pre-solve QuickSolution apply failed", error);
      }
    }

    const currentSquadSlotsAfterQuick = getCurrentSquadPlayerSlots();
    const quickAppliedPlayers = Array.isArray(
      quickSolutionResult?.appliedPlayers,
    )
      ? quickSolutionResult.appliedPlayers
      : [];

    const currentSquadPlayers = shouldAutoApplyQuickSolution
      ? (() => {
          const mergedBySlot = new Map();

          currentSquadSlotsBeforeQuick.forEach(({ slotIndex, item }) => {
            if (Number(item?.id) > 0) {
              mergedBySlot.set(slotIndex, item);
            }
          });

          currentSquadSlotsAfterQuick.forEach(({ slotIndex, item }) => {
            const hasRealId = Number(item?.id) > 0;
            const hasDefinitionId = Number(item?.definitionId) > 0;
            if (!hasRealId && !hasDefinitionId) {
              return;
            }

            const existing = mergedBySlot.get(slotIndex);
            const isBetterThanExisting =
              !existing ||
              Number(item?.rating || 0) > Number(existing?.rating || 0);

            if (isBetterThanExisting) {
              mergedBySlot.set(slotIndex, item);
            }
          });

          const combined = Array.from(mergedBySlot.values());
          // With navigation suppressed the applied squad may not be reflected
          // in the live controller, so include the players the quick solution
          // actually selected (deduped by definitionId).
          const seen = new Set(
            combined
              .map((item) => Number(item?.definitionId))
              .filter((id) => id > 0),
          );
          quickAppliedPlayers.forEach((item) => {
            const defId = Number(item?.definitionId);
            if (defId > 0 && !seen.has(defId)) {
              seen.add(defId);
              combined.push(item);
            }
          });

          return combined;
        })()
      : currentSquadSlotsAfterQuick.map(({ item }) => item);

    if (currentSquadPlayers.length) {
      currentSquadPlayers.forEach((item) => {
        try {
          item.__autoSbcForceIncludeCurrentSolution = true;
          item.__autoSbcCurrentSquadConcept = true;
          item.concept = true;
        } catch {}
      });
      players = players.concat(currentSquadPlayers);
    }

    throwIfSolveRunCancelled(solveRunToken);
    let PriceItems = getPriceItems();
    const configuredConceptBuyMax = Number(
      getSettings(sbcId, sbcData.challengeId, "sbcBuyConceptsMaxPrice"),
    );
    const conceptBuyMaxPrice =
      Number.isFinite(configuredConceptBuyMax) && configuredConceptBuyMax > 0
        ? configuredConceptBuyMax
        : 15000;
    const isConceptLike = (item) => !!item?.concept || Number(item?.owners) === 0;
    const isConceptTradable = (item) => {
      const priceItem = PriceItems?.[item?.definitionId];
      if (priceItem?.isObjective || priceItem?.isSbc) {
        return false;
      }
      const marketPrice = Number(getPrice(item));
      return Number.isFinite(marketPrice) && marketPrice > 0;
    };
    const isConceptWithinBuyMax = (item) => {
      if (!isConceptLike(item)) return true;
      if (item?.__autoSbcForceIncludeCurrentSolution) return true;
      if (item?.__autoSbcCurrentSquadConcept) return true;

      const futggPrice = Number(getPrice(item));
      if (Number.isFinite(futggPrice) && futggPrice > 0) {
        return futggPrice <= conceptBuyMaxPrice;
      }

      // No known market price yet: keep concept eligible instead of dropping all cached concepts.
      return true;
    };

    if (getSettings(sbcId, sbcData.challengeId, "useConcepts")) {
      let availableConceptPlayers = [];
      try {
        // Keep concept player fetch synchronous; only price refresh should be async.
        const loadedConceptPlayers = await getConceptPlayers(999999);
        availableConceptPlayers = Array.isArray(loadedConceptPlayers)
          ? loadedConceptPlayers
          : Array.isArray(conceptPlayers)
            ? conceptPlayers
            : [];

        if (availableConceptPlayers.length) {
          fetchPlayerPrices(availableConceptPlayers, {
            waitForCompletion: false,
            suppressNotification: true,
            throttleProfile: "concept",
          });
        }
      } catch (err) {
        console.warn("[solve] getConceptPlayers failed", err);
      }

      const eligibleConceptPlayers = availableConceptPlayers.filter(
        (f) =>
          !PriceItems?.[f?.definitionId]?.isExtinct &&
          isConceptTradable(f) &&
          isConceptWithinBuyMax(f),
      );

      if (eligibleConceptPlayers.length) {
        players = players.concat(eligibleConceptPlayers);
      } else {
        showNotification(
          "No eligible concept players available for this solve",
          UINotificationType.NEGATIVE,
        );
      }
    }
    showLoader(true);
    let allSbcData = await sbcSets();
    throwIfSolveRunCancelled(solveRunToken);
    let sbcSet = allSbcData.sets.filter((e) => e.id == sbcData.setId)[0];
    let challenges = await getChallenges(sbcSet);
    throwIfSolveRunCancelled(solveRunToken);
    let sbcChallenge = challenges.challenges.filter(
      (i) => i.id == sbcData.challengeId,
    )[0];
    for (let challenge of challenges.challenges.filter(
      (f) => f.status != "COMPLETED",
    )) {
      await loadChallenge(challenge);
      throwIfSolveRunCancelled(solveRunToken);
    }

    // storage = storage.concat(unassigned)
    const storageDefinitionIds = storage.map((item) => item?.definitionId);
    players = players.filter(
      (item) =>
        !!item &&
        (isConceptLike(item) || !storageDefinitionIds.includes(item?.definitionId)),
    );
    players = players.concat(storage);
    players = players.filter((item) => item != undefined);

    const uniquePlayersForPricing = (() => {
      const seenDefinitionIds = new Set();
      return players.filter((item) => {
        const definitionId = Number(item?.definitionId);
        if (!Number.isFinite(definitionId) || definitionId <= 0) {
          return false;
        }
        if (seenDefinitionIds.has(definitionId)) {
          return false;
        }
        seenDefinitionIds.add(definitionId);
        return true;
      });
    })();
    fetchPlayerPrices(uniquePlayersForPricing, {
      waitForCompletion: false,
      suppressNotification: true,
    });
    throwIfSolveRunCancelled(solveRunToken);

    let ratingRange = getSettings(sbcId, sbcData.challengeId, "ratingRange");
    let useDupes = getSettings(sbcId, sbcData.challengeId, "useDupes");

    let duplicateIds = await fetchDuplicateIds();
    throwIfSolveRunCancelled(solveRunToken);
    let storageIds = storage.map((m) => m.id);
    let chemUtil = new UTSquadChemCalculatorUtils();
    chemUtil.chemService = services.Chemistry;
    chemUtil.teamConfigRepo = repositories.TeamConfig;
    let sbcPlayerIds = services.SBC.repository
      .getSets()
      .filter((s) => s.id === sbcId)
      .reduce(function (e, t) {
        t = t.getChallenges().filter((f) => f.id != sbcData.challengeId);
        return (
          0 < t.length &&
            t.forEach(function (t) {
              t.squad &&
                e.push(
                  t.squad._players
                    .filter((f) => f._item.id > 0)
                    .map((m) => m._item.id),
                );
            }),
          e
        );
      }, [])
      .flat();

    players.forEach((item) => {
      item.isStorage = storageIds.includes(item?.id);
      item.isSbcPlayer = sbcPlayerIds.includes(item?.id);
      item.isDuplicateItem =
        duplicateIds.includes(item?.id) || unassigned.includes(item?.id);
      item.profile = chemUtil.getChemProfileForPlayer(item);
      item.normalizeClubId = chemUtil.normalizeClubId(item.teamId);
    });
    let excludeLeagues =
      getSettings(sbcId, sbcData.challengeId, "excludeLeagues") || [];
    let excludeNations =
      getSettings(sbcId, sbcData.challengeId, "excludeNations") || [];
    let excludeRarity =
      getSettings(sbcId, sbcData.challengeId, "excludeRarity") || [];
    let excludeTeams =
      getSettings(sbcId, sbcData.challengeId, "excludeTeams") || [];
    let excludePlayers =
      getSettings(sbcId, sbcData.challengeId, "excludePlayers") || [];
    let excludeSbc =
      getSettings(sbcId, sbcData.challengeId, "excludeSbc") || false;
    let excludeObjective =
      getSettings(sbcId, sbcData.challengeId, "excludeObjective") || false;
    let excludeEvolutions =
      getSettings(sbcId, sbcData.challengeId, "excludeEvolutions") || false;
    let excludeSpecial =
      getSettings(sbcId, sbcData.challengeId, "excludeSpecial") || false;
    let excludeTradable =
      getSettings(sbcId, sbcData.challengeId, "excludeTradable") || false;
    let excludeExtinct =
      getSettings(sbcId, sbcData.challengeId, "excludeExtinct") || false;
    let onlyStorage =
      getSettings(sbcId, sbcData.challengeId, "onlyStorage") || false;
    let maxPlayerPrice =
      Number(getSettings(sbcId, sbcData.challengeId, "maxPlayerPrice")) || 0;
    let excludeSbcSquads =
      getSettings(sbcId, sbcData.challengeId, "excludeSbcSquads") || false;

    let excludeFromSquadIds =
      getSettings(sbcId, sbcData.challengeId, "excludeFromSquadIds") || [];
    let excludeFromSquadPlayerIds = new Set();
    if (excludeFromSquadIds.length) {
      try {
        const userSquads = await getUserSquads();
        for (const squad of userSquads) {
          const squadId = String(
            typeof squad.getId === "function" ? squad.getId() : squad._id,
          );
          if (!excludeFromSquadIds.includes(squadId)) continue;

          const players =
            typeof squad.getPlayers === "function"
              ? squad.getPlayers()
              : squad._players || [];
          players.forEach((p) => {
            if (p?._item?.id > 0) {
              excludeFromSquadPlayerIds.add(p._item.id);
            }
          });
        }
      } catch (err) {
        console.warn("[solve] Failed to resolve excludeFromSquad players", err);
      }
    }

    const pricingByPlayerKey = new Map();
    const getPricingForPlayer = (item) => {
      const itemId = Number(item?.id);
      const definitionId = Number(item?.definitionId);
      const cacheKey =
        Number.isFinite(itemId) && itemId > 0
          ? `id:${itemId}`
          : `def:${definitionId}`;

      if (pricingByPlayerKey.has(cacheKey)) {
        return pricingByPlayerKey.get(cacheKey);
      }

      const sbcPrice = Number(getSBCPrice(item, sbcId, challengeId) || -1);
      const futggPrice = Number(getPrice(item));
      const pricing = {
        sbcPrice,
        futggPrice: Number.isFinite(futggPrice) ? futggPrice : -1,
      };
      pricingByPlayerKey.set(cacheKey, pricing);
      return pricing;
    };

    let backendPlayersInput = players
      .filter(
        (item) =>
          item?.__autoSbcForceIncludeCurrentSolution ||
          (useDupes && (item.isStorage || item.isDuplicateItem)) ||
          ((isConceptLike(item) || item.loans < 0) &&
            getPricingForPlayer(item).sbcPrice < 100000 &&
            item.rating <= ratingRange[1] &&
            item.rating >= ratingRange[0] &&
            !excludePlayers.includes(item.definitionId) &&
            !excludeLeagues.includes(item.leagueId) &&
            !excludeNations.includes(item.nationId) &&
            !excludeRarity.includes(
              services.Localization.localize("item.raretype" + item.rareflag),
            ) &&
            (!item?.isSbcPlayer || !excludeSbcSquads) &&
            !excludeFromSquadPlayerIds.has(item?.id) &&
            !excludeTeams.includes(item.teamId) &&
            !item.isTimeLimited() &&
            !(PriceItems[item.definitionId]?.isSbc && excludeSbc) &&
            !(PriceItems[item.definitionId]?.isObjective && excludeObjective) &&
            !(item?.upgrades && excludeEvolutions) &&
            !(item?.isSpecial() && excludeSpecial) &&
            !(item?.isTradeable() && excludeTradable) &&
            !(PriceItems[item.definitionId]?.isExtinct && excludeExtinct) &&
            isConceptWithinBuyMax(item) &&
            (item?.isStorage || !onlyStorage) &&
            !sbcData.subs.includes(item.definitionId) &&
            (maxPlayerPrice <= 0 ||
              getPricingForPlayer(item).sbcPrice <= maxPlayerPrice)),
      )
      .map((item) => {
        const pricing = getPricingForPlayer(item);
        if (!item.groups.length) {
          item.groups = [0];
        }

        return {
          id: item.id,
          name: item._staticData.name,
          cardType:
            (item.isSpecial()
              ? ""
              : services.Localization.localize(
                  "search.cardLevels.cardLevel" + item.getTier(),
                ) + " ") +
            services.Localization.localize("item.raretype" + item.rareflag),
          assetId: item._metaData?.id,
          definitionId: item.definitionId,
          rating: item.rating,
          teamId: item.teamId,
          leagueId: item.leagueId,
          nationId: item.nationId,
          rarityId: item.rareflag,
          ratingTier: item.getTier(),
          isUntradeable: item.isTradeable(),
          isDuplicate: duplicateIds.includes(item.id),
          isStorage: storageIds.includes(item.id),
          preferredPosition: item.preferredPosition,
          possiblePositions: item.possiblePositions,
          groups: item.groups,
          isFixed: isItemFixed(item),
          concept: isConceptLike(item),
          price: pricing.sbcPrice,
          futggPrice: pricing.futggPrice,
          maxChem: item.profile.maxChem,
          teamChem: item.profile.rules[0],
          leagueChem: item.profile.rules[1],
          nationChem: item.profile.rules[2],
          normalizeClubId: item.normalizeClubId,
          __currentSolutionHint: !!item.__autoSbcForceIncludeCurrentSolution,
        };
      });

    const conceptPlayersSentCount = backendPlayersInput.filter(
      (item) => item?.concept,
    ).length;

    if (conceptPlayersSentCount > 0) {
      const conceptsForBackend = backendPlayersInput.filter((p) => p?.concept);
      const nations = {};
      const leagues = {};
      const ratings = {};
      const rarities = {};
      for (const p of conceptsForBackend) {
        const nation = services.Localization.localize(
          "global.nations.nation" + p.nationId,
        );
        const league = services.Localization.localize(
          "global.leagueFull.league" + p.leagueId,
        );
        nations[nation] = (nations[nation] || 0) + 1;
        leagues[league] = (leagues[league] || 0) + 1;
        ratings[p.rating] = (ratings[p.rating] || 0) + 1;
        rarities[p.cardType] = (rarities[p.cardType] || 0) + 1;
      }
      console.log(
        `[solve] ${conceptPlayersSentCount} concept(s) sent to backend:`,
        { nations, leagues, ratings, rarities },
      );
      
    }

    if (!backendPlayersInput.length) {
      setSolveLoaderHoldUntilFinal(false);
      hideLoader();
      if (getSettings(0, 0, "playSounds")) {
        wompSound.play();
      }
      showNotification(
        "No eligible players available for this SBC with current filters/settings.",
        UINotificationType.NEGATIVE,
      );
      return;
    }

    const input = JSON.stringify({
      clubPlayers: backendPlayersInput,
      sbcData: sbcData,
      maxSolveTime: getSettings(sbcId, sbcData.challengeId, "maxSolveTime"),
    });

    count = getSettings(sbcId, sbcData.challengeId, "maxSolveTime");

    activeSolveContext = {
      solveRunToken,
      sbcId,
      challengeId: sbcData.challengeId,
      sbcSet,
      sbcData,
      players,
    };
    allowInterimSquadApply = true;
    lastAppliedInterimSolution = 0;
    lastInterimSquadApplyAt = 0;
    lastAppliedInterimResults = null;
    pendingInterimResultPayload = null;
    if (pendingInterimApplyTimeout) {
      clearTimeout(pendingInterimApplyTimeout);
      pendingInterimApplyTimeout = null;
    }

    clearInterval(countDownInterval);
    const currentCountDownInterval = setInterval(countDown, 1000);
    countDownInterval = currentCountDownInterval;

    // Reset log index and start polling
    lastLogIndex = 0;
    const currentLogPollInterval = setInterval(pollSolverLogs, 1000);
    logPollInterval = currentLogPollInterval;
    setSolveLoaderHoldUntilFinal(true);
    showLoader(true);
    if (typeof setAutoSbcSolveStatus === "function") {
      setAutoSbcSolveStatus("solving", initialRunInBackground);
    }

    throwIfSolveRunCancelled(solveRunToken);
    let solution = await makePostRequest(apiUrl + "/solve", input);
    throwIfSolveRunCancelled(solveRunToken);
    setSolveLoaderHoldUntilFinal(false);

    const runSolveInBackground =
      runInBackground == null
        ? !!getSettings(sbcId, sbcData.challengeId, "runInBackground")
        : !!runInBackground;

    // Solver finished: disable further interim squad applies and clear queued interim updates.
    allowInterimSquadApply = false;
    pendingInterimResultPayload = null;
    if (pendingInterimApplyTimeout) {
      clearTimeout(pendingInterimApplyTimeout);
      pendingInterimApplyTimeout = null;
    }
    activeSolveContext = null;

    // Stop polling when solve is complete
    clearInterval(currentLogPollInterval);
    clearInterval(currentCountDownInterval);
    pollSolverLogs();
    throwIfSolveRunCancelled(solveRunToken);
    if (solution.status_code != 2 && solution.status_code != 4) {
      setSolveLoaderHoldUntilFinal(false);
      if (typeof setAutoSbcSolveStatus === "function") {
        setAutoSbcSolveStatus(null, false);
      }
      hideLoader();
      if (getSettings(0, 0, "playSounds")) {
        wompSound.play();
      }
      showNotification(solution.status, UINotificationType.NEGATIVE);

      if (runNextLoginSbc(runSolveInBackground)) {
        return;
      }

      return;
    }

    showNotification(
      solution.status,
      solution.status_code != 4
        ? UINotificationType.NEUTRAL
        : UINotificationType.POSITIVE,
    );

    const solverStatusCode = Number(solution.status_code);
    const hasFinalSolveResult =
      solverStatusCode === 2 || solverStatusCode === 4;

    if (typeof setAutoSbcSolveStatus === "function") {
      setAutoSbcSolveStatus(
        solverStatusCode === 4 ? "optimal" : "feasible",
        runSolveInBackground,
      );
    }

    window.sbcSet = sbcSet;
    window.challengeId = sbcData.challengeId;

    const parsedFinalSolution = buildSolutionSquadFromResults(
      solution.results,
      sbcData,
      players,
    );
    if (!parsedFinalSolution) {
      setSolveLoaderHoldUntilFinal(false);
      hideLoader();
      return;
    }
    concepts = parsedFinalSolution.hasConcepts;

    // Skip squad update if the final solution is identical to the last interim apply
    const finalMatchesInterim =
      lastAppliedInterimResults !== null &&
      solution.results === lastAppliedInterimResults;

    let autoSubmitId = getSettings(sbcId, sbcData.challengeId, "autoSubmit");
    const isAutoGrindRunning =
      typeof createSbcGrind !== "undefined" && createSbcGrind === true;
    const autoGrindSubmitMode = getSettings(0, 0, "autoGrindSubmitMode") ?? 4;
    const effectiveAutoSubmitId = isAutoGrindRunning ? autoGrindSubmitMode : autoSubmitId;
    const canAutoSubmitCurrentSolve =
      solution.status_code == effectiveAutoSubmitId ||
      effectiveAutoSubmitId == 1;
    const shouldSkipSquadScreenReload =
      autoSubmit &&
      (runSolveInBackground ||
        (canAutoSubmitCurrentSolve && !concepts));

    let newSbcSquad = new UTSBCSquadOverviewViewController();
    newSbcSquad.initWithSBCSet(sbcSet, sbcData.challengeId);
    let { _squad, _challenge } = newSbcSquad;

    if (!finalMatchesInterim) {
      _squad.removeAllItems();
      _squad.setPlayers(parsedFinalSolution.solutionSquad, true);

      await loadChallenge(_challenge);
      if (!shouldSkipSquadScreenReload) {
        await reloadSbcScreen(sbcSet, sbcData.challengeId);
      }
    }
    let sbcSubmitted = false;

    if (canAutoSubmitCurrentSolve && autoSubmit && !concepts) {
      try {
        await sbcSubmit(_challenge, sbcSet, {
          runInBackground: runSolveInBackground,
        });
        sbcSubmitted = true;
      } catch (error) {
        console.error("Error submitting SBC:", error);
        setSolveLoaderHoldUntilFinal(false);
        hideLoader();
        sbcSubmitted = false;
      }
    }
    {
      if (sbcSubmitted) {
        // Normalize repeat inputs so comparisons behave predictably
        if (repeat == null) {
          const fromSettings = getSettings(
            sbcId,
            sbcData.challengeId,
            "repeatCount",
          );
          repeat = Number(fromSettings);
        } else {
          repeat = Number(repeat);
        }
        if (!Number.isFinite(repeat)) {
          repeat = 0;
        }

        // totalRepeats is just for display; keep it numeric too
        const repeatCountSetting = Number(
          getSettings(sbcId, sbcData.challengeId, "repeatCount"),
        );
        const totalRepeats =
          (Number.isFinite(repeatCountSetting) ? repeatCountSetting : 0) + 1;

        // Packs / navigation AFTER submission
        const autoOpen = !!getSettings(
          sbcId,
          sbcData.challengeId,
          "autoOpenPacks",
        );

        // On the final iteration (no more repeats) restore normal navigation
        // even in background mode so packs and unassigned are processed.
        const isFinalIteration = repeat === 0;

        if (autoOpen) {
          try {
            // Allow openPack to navigate normally on the final background iteration
            if (runSolveInBackground && isFinalIteration) {
              window.__autoSbcSolveRunInBackground = false;
            }
            await autoOpenGrantedRewards(sbcData, sbcId, sbcData.challengeId);
          } catch (err) {
            console.warn("autoOpenPacks openPack error", err);
          }
        } else {
          if (runSolveInBackground && !isFinalIteration) {
            await processUnassigned({ suppressNavigation: true });
          } else {
            goToPacks();
          }
        }

        // Repeat scheduling
        if (repeat !== 0) {
          if (repeat < 0) {
            showNotification(`${Math.abs(repeat)} Completed`);
          } else {
            showNotification(
              `${totalRepeats - repeat} / ${totalRepeats} Completed`,
            );
          }

          const newRepeat = sbcData.finalSBC ? repeat - 1 : repeat;

          setSolveLoaderHoldUntilFinal(false);
          hideLoader();

          solveSBC(
            sbcId,
            0,
            true,
            newRepeat,
            autoOpen,
            trynext,
            runSolveInBackground,
          );
          return;
        }

        if (repeat === 0 && totalRepeats > 0) {
          showNotification(`${totalRepeats} / ${totalRepeats} Completed`);
        }
      } else {
        if (effectiveAutoSubmitId === 0 || !runSolveInBackground || !autoSubmit) {
          let showSBC = new UTSBCSquadSplitViewController();
          showSBC.initWithSBCSet(sbcSet, sbcData.challengeId);

          getCurrentViewController()
            .rootController.getRootNavigationController()
            .popViewController();
          getCurrentViewController()
            .rootController.getRootNavigationController()
            .pushViewController(showSBC);
        }

        services.SBC.saveChallenge(_challenge).observe(
          undefined,
          async function (sender, data) {
            if (!data.success) {
              if (getSettings(0, 0, "playSounds")) {
                wompSound.play();
              }
              showNotification(
                "Failed to save squad.",
                UINotificationType.NEGATIVE,
              );

              if (data.error) {
                if (getSettings(0, 0, "playSounds")) {
                  wompSound.play();
                }
                showNotification(
                  `Error code: ${data.error.code}`,
                  UINotificationType.NEGATIVE,
                );
              }
              if (hasFinalSolveResult) {
                setSolveLoaderHoldUntilFinal(false);
                hideLoader();
              }

              console.warn("saveChallenge failed", data);
              return;
            }
          },
        );

        if (
          hasFinalSolveResult &&
          getSettings(sbcId, sbcData.challengeId, "sbcBuyConcepts")
        ) {
          const waitForPostBuyPoolSync = async (timeoutMs = 15000) => {
            const withTimeout = async (promiseFactory, label) => {
              const timeoutPromise = new Promise((resolve) => {
                setTimeout(() => {
                  console.warn(`[solve] ${label} timed out after ${timeoutMs}ms`);
                  resolve();
                }, timeoutMs);
              });

              try {
                await Promise.race([Promise.resolve().then(promiseFactory), timeoutPromise]);
              } catch (err) {
                console.warn(`[solve] ${label} failed`, err);
              }
            };

            await withTimeout(
              () => processUnassigned({ force: true, suppressNavigation: true }),
              "post-buy processUnassigned",
            );
            await withTimeout(() => fetchUnassigned(), "post-buy fetchUnassigned");
          };

          let qbs = { purchased: 0, total: 0 };
          const quickBuyRunner = window?.autoSbcConsoleApi?.runQuickBuySquad;
          if (typeof quickBuyRunner === "function") {
            qbs = await quickBuyRunner(sbcId, sbcData.challengeId, {
              squadPlayers: parsedFinalSolution?.solutionSquad || [],
              triggerButton: null,
            });
          } else {
            console.warn("runQuickBuySquad unavailable; continuing without quick buy");
          }
          if (qbs?.reason === "stopped") {
            runNextLoginSbc(runSolveInBackground);
            return;
          }
          if (
            qbs &&
            Number.isFinite(qbs.purchased) &&
            Number.isFinite(qbs.total) &&
            qbs.purchased < qbs.total
          ) {
            runNextLoginSbc(runSolveInBackground);
            return;
          }

          if (qbs && Number.isFinite(qbs.purchased) && qbs.purchased > 0) {
            await waitForPostBuyPoolSync();
          }

          if (autoSubmit && canAutoSubmitCurrentSolve) {
            try {
              await sbcSubmit(_challenge, sbcSet, {
                runInBackground: runSolveInBackground,
              });
              sbcSubmitted = true;
            } catch (error) {
              console.error("sbcBuyConcepts submit error", error);
              setSolveLoaderHoldUntilFinal(false);
              hideLoader();
              sbcSubmitted = false;
            }
          }
        } else if (getSettings(sbcId, sbcData.challengeId, "sbcBuyConcepts")) {
        }

        if (sbcSubmitted) {
          const autoOpen = !!getSettings(
            sbcId,
            sbcData.challengeId,
            "autoOpenPacks",
          );

          // Normalize repeat before deciding navigation
          if (repeat == null) {
            const fromSettings = getSettings(
              sbcId,
              sbcData.challengeId,
              "repeatCount",
            );
            repeat = Number(fromSettings);
          } else {
            repeat = Number(repeat);
          }
          if (!Number.isFinite(repeat)) repeat = 0;

          const isFinalIterationHere = repeat === 0;

          if (autoOpen) {
            try {
              if (runSolveInBackground && isFinalIterationHere) {
                window.__autoSbcSolveRunInBackground = false;
              }
              await autoOpenGrantedRewards(sbcData, sbcId, sbcData.challengeId);
            } catch (err) {
              console.warn("autoOpenPacks openPack error", err);
            }
          } else {
            if (runSolveInBackground && !isFinalIterationHere) {
              await processUnassigned({ suppressNavigation: true });
            } else {
              goToPacks();
            }
          }

          // Normalize repeat inputs so comparisons behave predictably
          if (repeat == null) {
            const fromSettings = getSettings(
              sbcId,
              sbcData.challengeId,
              "repeatCount",
            );
            repeat = Number(fromSettings);
          } else {
            repeat = Number(repeat);
          }
          if (!Number.isFinite(repeat)) {
            repeat = 0;
          }

          const repeatCountSetting = Number(
            getSettings(sbcId, sbcData.challengeId, "repeatCount"),
          );
          const totalRepeats =
            (Number.isFinite(repeatCountSetting) ? repeatCountSetting : 0) + 1;

          if (repeat !== 0) {
            if (repeat < 0) {
              showNotification(`${Math.abs(repeat)} Completed`);
            } else {
              showNotification(
                `${totalRepeats - repeat} / ${totalRepeats} Completed`,
              );
            }

            const newRepeat = sbcData.finalSBC ? repeat - 1 : repeat;

            setSolveLoaderHoldUntilFinal(false);
            hideLoader();

            solveSBC(
              sbcId,
              0,
              true,
              newRepeat,
              autoOpen,
              trynext,
              runSolveInBackground,
            );
            return;
          }

          if (repeat === 0 && totalRepeats > 0) {
            showNotification(`${totalRepeats} / ${totalRepeats} Completed`);
          }
        }

        hideLoader();

        if (getSettings(sbcId, sbcData.challengeId, "sbcAllGroup") && trynext) {
          try {

            // Track which challenges in this set have already been tried during this solve cycle
            window.__sbcTried = window.__sbcTried || {};
            const key = String(sbcId);
            const tried = window.__sbcTried[key] || new Set();
            tried.add(sbcData.challengeId);
            window.__sbcTried[key] = tried;

            const all = await sbcSets();
            const setObj = all?.sets?.find((s) => s.id == sbcId);
            if (setObj) {
              const chData = await getChallenges(setObj);
              const uncompleted = (chData?.challenges || []).filter(
                (c) => c.status !== "COMPLETED",
              );

              // Only consider challenges we haven't tried yet in this chain
              const remaining = uncompleted.filter((c) => !tried.has(c.id));

              if (remaining.length > 0) {
                // Try from the "hardest"/last first to preserve prior behavior
                const nextChallenge = remaining[remaining.length - 1];
                services.Notification.queue(
                  [`Trying another challenge: ${nextChallenge.name}`],
                  UINotificationType.NEUTRAL,
                );

                await solveSBC(
                  sbcId,
                  nextChallenge.id,
                  autoSubmit,
                  repeat,
                  autoOpen,
                  trynext,
                  runSolveInBackground,
                );
                return;
              } else {
                window.__sbcTried = {};
              }
            }
          } catch (err) {
            console.warn("Could not try next challenge in set:", err);
          }
        }
      }
    }

    runNextLoginSbc(true);
    setSolveLoaderHoldUntilFinal(false);
    hideLoader();
  } catch (err) {
    activeSolveContext = null;
    setSolveLoaderHoldUntilFinal(false);
    hideLoader();
    console.error("Error in solveSBC:", err);
  }

  //getAppMain().getRootViewController().getPresentedViewController().getCurrentViewController().rootController.getRootNavigationController().pushViewController(currentView);
};
