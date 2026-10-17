const optimizeScoreSbc = async (candidates, target, options = {}) => {
  if (!Number.isSafeInteger(target) || target < 0) {
    throw new Error("Invalid score target");
  }
  if (!target) return { items: [], score: 0, cost: 0, reached: true };
  const groups = new Map();
  const ids = new Set();
  for (const candidate of candidates) {
    if (ids.has(String(candidate.item.id)) || !Number.isSafeInteger(candidate.score) || candidate.score <= 0 ||
        !Number.isFinite(candidate.cost) || candidate.cost < 0) continue;
    ids.add(String(candidate.item.id));
    const score = Math.min(target, candidate.score);
    if (!groups.has(score)) groups.set(score, []);
    groups.get(score).push(candidate);
  }
  const pool = [...groups.entries()].flatMap(([score, group]) => group.sort((left, right) => left.cost - right.cost || left.score - right.score).slice(0, Math.ceil(target / score)));
  const states = new Map();
  states.set(0, { cost: 0, score: 0, count: 0, previous: null, candidate: null });
  let operations = 0;
  for (const candidate of pool) {
      for (const [score, previous] of [...states]) {
        if (score === target) continue;
        if (++operations > 10000000) throw new Error("Score optimization is too large for a local search");
        if (operations % 20000 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
          if (options.cancelled?.()) throw new Error("Score optimization cancelled");
        }
        const nextScore = Math.min(target, score + candidate.score);
        const cost = previous.cost + candidate.cost;
        const actualScore = previous.score + candidate.score;
        const count = previous.count + 1;
        const existing = states.get(nextScore);
        if (!existing || cost < existing.cost || (cost === existing.cost && (actualScore < existing.score ||
            (actualScore === existing.score && count < existing.count)))) {
          states.set(nextScore, { cost, score: actualScore, count, previous, candidate });
        }
      }
  }
  let best = states.get(0);
  let bestScore = 0;
    for (const [score, state] of states) {
      if (score > bestScore || (score === bestScore && (state.cost < best.cost ||
          (state.cost === best.cost && (state.score < best.score ||
            (state.score === best.score && state.count < best.count)))))) {
        best = state;
        bestScore = score;
      }
    }
  const items = [];
  for (let node = best; node.candidate; node = node.previous) items.push(node.candidate.item);
  return { items, score: best.score, cost: best.cost, reached: bestScore === target };
};

const createScoreSbcRequirementFilter = challenge => {
  const checks = [];
  for (const requirement of challenge.eligibilityRequirements || []) {
    const pairs = requirement.kvPairs?._collection || {};
    const entries = Object.entries(pairs);
    const attribute = entries.find(([key]) => (globalThis.SBCEligibilityKey?.[key] || key) === "PLAYER_ATTRIBUTE");
    if (attribute) {
      const limit = entries.find(([key]) => (globalThis.SBCEligibilityKey?.[key] || key) === "ACADEMY_PLAYER_SLOTTING");
      const extra = entries.find(([key]) => (globalThis.SBCEligibilityKey?.[key] || key) === "ADDITIONAL_TARGET_VALUE");
      const values = [...(limit?.[1] || []), ...(extra?.[1] || [])].map(Number);
      if (Number(attribute[1]?.[0]) !== globalThis.AcademyEligibilityAttribute?.OVR) {
        throw new Error(`Unsupported score SBC player attribute: ${attribute[1]?.[0]}`);
      }
      const scope = globalThis.AcademyEligibilityScope?.[requirement.scope] || requirement.scope;
      const requiredValues = scope === "BETWEEN" ? 2 : 1;
      if (values.length !== requiredValues || values.some(value => !Number.isFinite(value))) throw new Error("Invalid score SBC OVR requirement");
      if (!["MIN", "MAX", "EXACT", "BETWEEN"].includes(scope)) throw new Error(`Unsupported score SBC OVR scope: ${scope}`);
      checks.push(item => {
        const rating = Number(item.rating);
        if (!Number.isFinite(rating)) return false;
        if (scope === "MAX") return rating <= values[0];
        if (scope === "MIN") return rating >= values[0];
        if (scope === "EXACT") return rating === values[0];
        return rating >= values[0] && rating <= values[1];
      });
      continue;
    }
    for (const [rawKey, rawValues] of entries) {
      const key = globalThis.SBCEligibilityKey?.[rawKey] || rawKey;
      const values = (Array.isArray(rawValues) ? rawValues : [rawValues]).map(Number);
      if (!values.length || values.some(value => !Number.isFinite(value))) throw new Error(`Invalid score SBC requirement: ${key}`);
      const includes = value => values.includes(Number(value));
      switch (key) {
        case "PLAYER_MAX_OVR": checks.push(item => Number(item.rating) <= values[0]); break;
        case "PLAYER_MIN_OVR": checks.push(item => Number(item.rating) >= values[0]); break;
        case "PLAYER_EXACT_OVR": checks.push(item => includes(item.rating)); break;
        case "CLUB_ID": checks.push(item => includes(item.teamId)); break;
        case "LEAGUE_ID": checks.push(item => includes(item.leagueId)); break;
        case "NATION_ID": checks.push(item => includes(item.nationId)); break;
        case "PLAYER_RARITY": checks.push(item => includes(item.rareflag)); break;
        case "PLAYER_RARITY_GROUP": checks.push(item => values.some(value => (item.groups || []).includes(value))); break;
        case "PLAYER_LEVEL": checks.push(item => includes(item.getTier?.())); break;
        case "PLAYER_QUALITY": {
          const scope = globalThis.SBCEligibilityScope?.[requirement.scope] || requirement.scope;
          checks.push(item => scope === "LOWER" ? Number(item.getTier?.()) <= values[0] : Number(item.getTier?.()) >= values[0]);
          break;
        }
        default: throw new Error(`Unsupported score SBC player requirement: ${key}`);
      }
    }
  }
  return item => checks.every(check => check(item));
};

const scoreSbcSettingsScope = (set, challenge) => ({
  sbc: set.name || set.id,
  challenge: challenge.name || (set.name ? "global" : challenge.id),
});
const getScoreSbcSetting = (set, challenge, key) => {
  const scope = scoreSbcSettingsScope(set, challenge);
  return getSettings(scope.sbc, scope.challenge, key);
};
const getScoreSbcPrice = (item, set, challenge) => {
  const scope = scoreSbcSettingsScope(set, challenge);
  return getSBCPrice(item, scope.sbc, scope.challenge);
};

const createScoreSbcFilter = async (set, challenge) => {
  const meetsRequirements = createScoreSbcRequirementFilter(challenge);
  const settings = Object.fromEntries([
    "ratingRange", "useDupes", "excludePlayers", "excludeLeagues", "excludeNations", "excludeTeams",
    "excludeRarity", "excludeSbc", "excludeObjective", "excludeEvolutions", "excludeSpecial",
    "excludeTradable", "excludeExtinct", "onlyStorage", "useConcepts", "maxPlayerPrice", "excludeSbcSquads", "excludeFromSquadIds",
  ].map(key => [key, getScoreSbcSetting(set, challenge, key)]));
  const contains = (values, value) => (values || []).some(entry => String(entry) === String(value));
  const protectedIds = new Set();
  const sbcIds = new Set();
  if (settings.excludeFromSquadIds?.length) {
    const squads = await getUserSquads();
    if (!Array.isArray(squads)) throw new Error("Could not load protected squads");
    for (const squad of squads) {
      if (!contains(settings.excludeFromSquadIds, squad.getId?.() ?? squad._id)) continue;
      for (const slot of squad.getPlayers?.() ?? squad._players ?? []) {
        const item = slot?._item ?? slot?.item;
        if (item?.id > 0) protectedIds.add(String(item.id));
      }
    }
  }
  if (settings.excludeSbcSquads) {
    const response = await getChallenges(set);
    if (!Array.isArray(response?.challenges)) throw new Error("Could not load protected SBC squads");
    for (const other of response.challenges) {
      if (String(other.id) === String(challenge.id) || other.status === "COMPLETED" || other.type === "ONE_CLICK_CHALLENGE") continue;
      await loadChallenge(other);
      if (!other.squad) throw new Error("Could not load protected SBC squad");
      for (const slot of other.squad.getPlayers?.() ?? other.squad._players ?? []) {
        const item = slot?._item ?? slot?.item;
        if (item?.id > 0) sbcIds.add(String(item.id));
      }
    }
  }
  return (item, cost) => {
    if ((item.concept && (!settings.useConcepts || settings.onlyStorage)) || item.isLoan?.() || Number(item.loans ?? -1) >= 0 || isItemLocked(item) ||
        item.isTimeLimited?.() || !Number.isFinite(cost) || cost < 0) return false;
      if (!meetsRequirements(item)) return false;
      const priceCap = Number(settings.maxPlayerPrice);
      const marketPrice = typeof getPrice === "function" ? Number(getPrice(item)) : cost;
      if (priceCap > 0 && (!Number.isFinite(marketPrice) || marketPrice <= 0 || marketPrice > priceCap)) return false;
      if (settings.onlyStorage && !item.isStorage) return false;
    if (!item.concept && settings.useDupes && (item.isStorage || item.isDuplicateItem)) return true;
    const range = settings.ratingRange || [40, 99];
    const price = getPriceItems()?.[item.definitionId];
    return cost < 100000 && item.rating >= range[0] && item.rating <= range[1] &&
      !contains(settings.excludePlayers, item.definitionId) && !contains(settings.excludeLeagues, item.leagueId) &&
      !contains(settings.excludeNations, item.nationId) && !contains(settings.excludeTeams, item.teamId) &&
      !contains(settings.excludeRarity, services.Localization.localize("item.raretype" + item.rareflag)) &&
      !protectedIds.has(String(item.id)) && !sbcIds.has(String(item.id)) &&
      !(settings.excludeSbc && price?.isSbc) && !(settings.excludeObjective && price?.isObjective) &&
      !(settings.excludeExtinct && price?.isExtinct) && !(settings.excludeEvolutions && item.upgrades) &&
      !(settings.excludeSpecial && item.isSpecial?.()) && !(settings.excludeTradable && item.isTradeable?.()) &&
      (!settings.onlyStorage || !!item.isStorage) &&
      (!(Number(settings.maxPlayerPrice) > 0) || cost <= Number(settings.maxPlayerPrice));
  };
};

const scoreSbcMarketConcept = item => {
  const concept = Object.create(item);
  concept.concept = true;
  concept.tradable = true;
  return concept;
};

const scoreSbcExtraCandidates = async (set, challenge, tab, allows, cancelled) => {
  const candidates = [];
  const storage = tab !== OneClickSBCWorkAreaTab.STORAGE && typeof getStoragePlayers === "function"
    ? await getStoragePlayers() : [];
  for (const item of storage || []) {
    const pricedItem = Object.create(item);
    pricedItem.isStorage = true;
    const cost = Number(getScoreSbcPrice(pricedItem, set, challenge));
    if (!item.concept && allows(pricedItem, cost)) candidates.push({ item, score: Number(item.sbsScore), cost, tab: OneClickSBCWorkAreaTab.STORAGE });
  }
  if (getScoreSbcSetting(set, challenge, "useConcepts") && !getScoreSbcSetting(set, challenge, "onlyStorage")) {
    const concepts = await getConceptPlayers();
    if (cancelled()) throw new Error("Selection changed; run Auto-Select again");
    for (const item of concepts || []) {
      const concept = scoreSbcMarketConcept(item);
      const cost = Number(getScoreSbcPrice(concept, set, challenge));
      if (allows(concept, cost)) candidates.push({ item: concept, score: Number(item.sbsScore), cost });
    }
  }
  return candidates;
};

const scoreSbcFilterExtraConceptDefinitions = (candidates, purchasedDefinitions, availableDefinitions) => {
  const seenConceptDefinitions = new Set();
  return candidates.filter(candidate => {
    if (!candidate.item.concept) return true;
    const definitionId = String(candidate.item.definitionId);
    if (purchasedDefinitions.has(definitionId) || availableDefinitions.has(definitionId) || seenConceptDefinitions.has(definitionId)) return false;
    seenConceptDefinitions.add(definitionId);
    return true;
  });
};

const clearScoreSbcConceptPreview = controller => {
  controller.__scoreConceptGrid?.dealloc();
  controller.__scoreConceptGrid = null;
  controller.__scoreConceptPreview?.remove();
  controller.__scoreConceptPreview = null;
};

const renderScoreSbcConceptPreview = controller => {
  clearScoreSbcConceptPreview(controller);
  const plan = controller.__scoreConceptPlan;
  const root = controller.getView?.().getRootElement?.();
  const body = root?.querySelector(".ut-one-click-sbc-work-area-view--body");
  if (!body || !plan?.items.length || typeof UTOneClickSBCItemGridView !== "function") return;
  const section = document.createElement("section");
  section.setAttribute("aria-label", "Selected concepts to buy");
  section.style.cssText = "flex:0 0 auto;padding:12px 0;border-bottom:1px solid #46545d;";
  const heading = document.createElement("div");
  const ownedScore = controller.viewModel.getSelectedEntries().reduce((total, entry) => total + Number(entry.item.sbsScore || 0), 0);
  const conceptScore = plan.items.reduce((total, item) => total + Number(item.sbsScore || 0), 0);
  heading.textContent = `Selected concepts (${plan.items.length}) / To buy / Projected score ${Number(plan.challenge.submittedScore || 0) + ownedScore + conceptScore}/${plan.challenge.scoreRequirement}`;
  heading.style.cssText = "padding:0 12px 10px;font-weight:700;color:#b7f36b;";
  const grid = new UTOneClickSBCItemGridView();
  grid.init();
  grid.setItems(plan.items.map(item => ({ item: scoreSbcMarketConcept(item), isSelected: true, isInSquad: false })));
  for (const tile of grid._itemTileViews || []) tile._playerView?._bottomRightStatusIndicator?.reset();
  const gridRoot = grid.getRootElement();
  gridRoot.style.cssText = "height:auto;min-height:0;pointer-events:none;";
  section.append(heading, gridRoot);
  body.prepend(section);
  controller.__scoreConceptGrid = grid;
  controller.__scoreConceptPreview = section;
};

const stageScoreSbcPurchasedItem = (controller, model, plan, concept, result) => {
  if (result.postPurchaseError) throw new Error(result.postPurchaseError);
  const purchased = result.purchasedItem;
  if (!purchased || !(Number(purchased.id) > 0) || String(purchased.definitionId) !== String(concept.definitionId)) {
    throw new Error("Bought player could not be identified in the club; purchase queue stopped");
  }
  if (controller.viewModel !== model) return;
  const item = Object.create(purchased);
  item.concept = false;
  item.isStorage = false;
  model.__scorePurchasedDefinitions ??= new Set();
  model.__scorePurchasedDefinitions.add(String(item.definitionId));
  controller.__scorePurchasedDefinitions = model.__scorePurchasedDefinitions;
  model._itemTabMap.set(item.id, OneClickSBCWorkAreaTab.CLUB);
  model._itemScoreMap.set(item.id, Number(item.sbsScore));
  model._itemEntityMap.set(item.id, item);
  plan.items = plan.items.filter(entry => String(entry.definitionId) !== String(concept.definitionId));
  const clubState = model._tabStates?.get?.(OneClickSBCWorkAreaTab.CLUB) || model._tabStates?.[OneClickSBCWorkAreaTab.CLUB] ||
    (model.getActiveTab() === OneClickSBCWorkAreaTab.CLUB ? model._currentState() : null);
  if (clubState) {
    clubState.items = [item, ...(clubState.items || []).filter(entry => String(entry.id) !== String(item.id))];
    clubState.currentPage = 0;
  }
  if (model.getSelectedItemIds().length < model.getSelectionLimit()) {
    if (model.selectItem(item) === false) throw new Error("Bought player is in club but could not be selected");
  } else {
    services.Notification.queue(["Bought player sent to club; selection batch is full", UINotificationType.WARNING]);
  }
  plan.selectedIds = model.getSelectedItemIds().map(String).sort().join(",");
  if (model.getActiveTab() !== OneClickSBCWorkAreaTab.CLUB && typeof model.setActiveTab === "function") {
    model.setActiveTab(OneClickSBCWorkAreaTab.CLUB, () => controller._refreshCurrentPage());
    controller.getView().setActiveTab(OneClickSBCWorkAreaTab.CLUB);
  } else controller._refreshCurrentPage();
  updateScoreSbcBuyButton(controller);
};

let scoreSbcRun = null;
const stopScoreSbcRun = () => {
  if (scoreSbcRun) scoreSbcRun.stopped = true;
};
const scoreSbcPackCounts = packs => {
  const counts = new Map();
  for (const pack of packs?.packs || []) {
    if (pack.isMyPack) counts.set(String(pack.id), (counts.get(String(pack.id)) || 0) + 1);
  }
  return counts;
};
const startScoreSbcRun = (set, challenge) => {
  const mode = Number(getScoreSbcSetting(set, challenge, "autoSubmit"));
  if (![1, 4].includes(mode)) return null;
  if (scoreSbcRun && !scoreSbcRun.stopped) {
    if (String(scoreSbcRun.set.id) !== String(set.id) || String(scoreSbcRun.challengeId) !== String(challenge.id)) stopScoreSbcRun();
    else return scoreSbcRun;
  }
  const repeats = Number(getScoreSbcSetting(set, challenge, "repeatCount"));
  scoreSbcRun = { set, challenge, challengeId: challenge.id, remaining: repeats === -1 ? Infinity : Math.max(1, (Number.isFinite(repeats) ? Math.floor(repeats) : 0) + 1), completed: 0, stopped: false };
  return scoreSbcRun;
};
const finishScoreSbcRun = async (run, data) => {
  if (!run || run.stopped || !data.challengeCompleted) { if (run) run.stopped = true; return; }
  run.completed++;
  run.remaining--;
  const openRewards = !!getScoreSbcSetting(run.set, run.challenge || { id: run.challengeId }, "autoOpenPacks");
  for (let index = 0; index < 2; index++) {
    const popup = globalThis.gPopupClickShield?.currentController;
    if (!popup || typeof UTGameRewardsViewController === "undefined" || !(popup instanceof UTGameRewardsViewController)) break;
    await new Promise(resolve => {
      const observer = {};
      popup.onExit.observe(observer, sender => { sender?.unobserve?.(observer); resolve(); });
      if (openRewards && !run.stopped) popup.onButtonTapped();
    });
  }
  if (run.stopped) return;
  if (openRewards && run.packCounts) {
    repositories.Store.setDirty();
    const inventory = await getPacks();
    const counts = scoreSbcPackCounts(inventory);
    for (const [id, count] of counts) {
      const received = count - (run.packCounts.get(id) || 0);
      for (let copy = 0; copy < received; copy++) {
        if (run.stopped) return;
        const packs = await getPacks();
        const pack = packs?.packs?.find(item => item.isMyPack && String(item.id) === id);
        if (!pack) throw new Error("Reward pack unavailable; score loop stopped");
        await openPack(pack);
      }
    }
  }
  if (run.stopped || run.remaining <= 0) { run.stopped = true; return; }
  if (![1, 4].includes(Number(getScoreSbcSetting(run.set, run.challenge || { id: run.challengeId }, "autoSubmit")))) { run.stopped = true; return; }
  await openScoreSbcFromSidebar(run.set, run.challengeId);
};

const reviewScoreSbcSelection = controller => {
  const model = controller.viewModel;
  if (!model || controller.__scoreConceptPlan?.items.length || !model.getSelectedItemIds().length) return;
  const set = model.getSet();
  const challenge = model.getChallenge();
  const score = model.getSelectedEntries().reduce((total, entry) => total + Number(entry.item.sbsScore || 0), 0);
  const mode = Number(getScoreSbcSetting(set, challenge, "autoSubmit"));
  const complete = Number(challenge.submittedScore || 0) + score >= challenge.scoreRequirement;
  model.__scoreAutoSubmit = complete && (mode === 1 || (mode === 4 && controller.__scoreOptimalPlan === true))
    ? { ids: model.getSelectedItemIds().map(String).sort().join(","), submittedScore: challenge.submittedScore, optimal: controller.__scoreOptimalPlan === true } : null;
  const delegate = controller.workAreaDelegate;
  const requirements = delegate?.requirementsController;
  controller.__scoreReviewOpening = true;
  if (requirements && typeof delegate.reviewSelection === "function") delegate.reviewSelection(requirements, requirements.viewModel);
  else if (typeof controller._eReviewTap === "function") controller._eReviewTap();
  else controller._openReviewScreen?.();
};

const updateScoreSbcBuyButton = controller => {
  renderScoreSbcConceptPreview(controller);
  const root = controller.getView?.().getRootElement?.();
  const actions = root?.querySelector(".ut-one-click-sbc-work-area-view--toolbar-actions");
  if (!actions || typeof UTStandardButtonControl !== "function") return;
  if (controller.viewModel?.__scoreRun && !controller.viewModel.__scoreRun.stopped && !controller.__scoreStopButton) {
    const stop = new UTStandardButtonControl(); stop.init(); stop.setText("Stop Loop");
    stop.setInteractionState(true); stop.addTarget(controller, stopScoreSbcRun, EventType.TAP);
    actions.appendChild(stop.getRootElement()); controller.__scoreStopButton = stop;
  }
  if (!controller.__scoreBuyButton) {
    const button = new UTStandardButtonControl();
    button.init();
    actions.appendChild(button.getRootElement());
    controller.__scoreBuyAction = async () => {
      const model = controller.viewModel;
      const plan = controller.__scoreConceptPlan;
      if (!model || !plan?.items.length || controller.__scoreBuyBusy || controller.__scoreSbcBusy) return;
      if (!getScoreSbcSetting(plan.set, plan.challenge, "useConcepts")) return;
      const changed = () => model.__scoreRun?.stopped || controller.viewModel !== model || controller.__scoreConceptPlan !== plan || !root.isConnected ||
        model.getChallenge().submittedScore !== plan.submittedScore || model.getSelectedItemIds().map(String).sort().join(",") !== plan.selectedIds;
      if (changed()) {
        controller.__scoreConceptPlan = null;
        updateScoreSbcBuyButton(controller);
        services.Notification.queue(["Selection changed; run Auto-Select before buying concepts", UINotificationType.NEGATIVE]);
        return;
      }
      controller.__scoreBuyBusy = true;
      updateScoreSbcBuyButton(controller);
      let replaceFailed = false;
      try {
        const result = await window.autoSbcConsoleApi.runQuickBuySquad(plan.set.id, plan.challenge.id, {
          squadPlayers: plan.items.slice(),
          scoreSbcLineup: true,
          replaceFailedConcept: true,
          settingsScope: scoreSbcSettingsScope(plan.set, plan.challenge),
          galleryPurchaseAction: "club",
          cancelled: changed,
          validateItem: async item => {
            const allows = await createScoreSbcFilter(plan.set, model.getChallenge());
            return allows(item, Number(getScoreSbcPrice(item, plan.set, plan.challenge)));
          },
          onPurchased: async (concept, result) => {
            if (!root.isConnected) return;
            stageScoreSbcPurchasedItem(controller, model, plan, concept, result);
          },
        });
        if (result?.reason === "conceptBuyFailed" && !changed() &&
            ["noListing", "priceAboveThreshold", "priceAboveBaseline", "listingChanged", "bidFailed", "noCachedPrice", "excludedBySettings"].includes(result.failure?.reason)) {
          controller.__scorePriceRefreshAttempts = (controller.__scorePriceRefreshAttempts || 0) + 1;
          if (controller.__scorePriceRefreshAttempts <= 10) {
            const listing = await fetchLivePlayerPrice(result.failedConcept, { suppressNotification: true });
            const livePrice = Number(listing?._auction?.buyNowPrice);
            replaceFailed = Number.isFinite(livePrice) && livePrice > 0 && !changed();
          }
        }
        if (!replaceFailed && (result?.reason === "stopped" || plan.items.length)) {
          if (model.__scoreRun) model.__scoreRun.stopped = true;
        }
        if (!plan.items.length && result?.reason !== "stopped" && !model.__scoreRun?.stopped) {
          controller.__scoreConceptPlan = null;
          controller.__scoreReviewAfterBuy = true;
        }
      } catch (error) {
        if (model.__scoreRun) model.__scoreRun.stopped = true;
        services.Notification.queue([error.message || "Concept purchase failed", UINotificationType.NEGATIVE]);
      } finally {
        controller.__scoreBuyBusy = false;
        updateScoreSbcBuyButton(controller);
      }
      if (replaceFailed && controller.viewModel === model && root.isConnected) {
        controller.__scoreReplacingConcept = true;
        try { await controller._eAutoSelect(); }
        finally { controller.__scoreReplacingConcept = false; }
        if (controller.__scoreConceptPlan?.items.length && !model.__scoreRun?.stopped) await controller.__scoreBuyAction();
        return;
      }
      if (controller.__scoreReviewAfterBuy) {
        controller.__scoreReviewAfterBuy = false;
        if (controller.viewModel === model && root.isConnected) reviewScoreSbcSelection(controller);
      }
    };
    button.addTarget(controller, controller.__scoreBuyAction, EventType.TAP);
    controller.__scoreBuyButton = button;
  }
  const count = controller.__scoreConceptPlan?.items.length || 0;
  controller.__scoreBuyButton.setText(controller.__scoreBuyBusy ? "Buying concepts..." : `Buy Concepts (${count})`);
  controller.__scoreBuyButton.setInteractionState(count > 0 && !controller.__scoreBuyBusy && !controller.__scoreSbcBusy);
};

let scoreSbcOpening = false;
const openScoreSbcFromSidebar = async (set, challengeId = 0) => {
  const response = await getChallenges(set);
  if (!Array.isArray(response?.challenges)) throw new Error("Could not load SBC challenges");
  const challenge = response.challenges.find(entry => challengeId
    ? String(entry.id) === String(challengeId)
    : entry.status !== "COMPLETED");
  if (challenge?.type !== "ONE_CLICK_CHALLENGE") return false;
  if (scoreSbcOpening) return true;
  scoreSbcOpening = true;
  try {
    await processUnassigned({ suppressNavigation: true });
    const navigation = getCurrentViewController()?.rootController?.getRootNavigationController?.();
    if (!navigation) throw new Error("SBC navigation unavailable");
    installScoreSbcAutoSelect();
    await new Promise((resolve, reject) => {
      UTOneClickSBCController.enterChallenge(navigation, challenge, resolve,
        () => reject(new Error("Could not start score SBC")));
    });
    const phone = isPhone();
    const controller = phone
      ? new UTOneClickSBCWorkAreaViewController()
      : new UTOneClickSBCWorkAreaSplitViewController();
    controller.initWithSBCSet(set, challenge.id);
    navigation.pushViewController(controller);
    document.getElementById("hoverNav")?.remove();
    document.getElementById("challengeNav")?.remove();
    await (phone ? controller : controller.workAreaController)._eAutoSelect();
    return true;
  } finally {
    scoreSbcOpening = false;
  }
};

const showScoreSbcSelectedFirst = (model, items, serverOffset) => {
  const selected = [];
  const remaining = [];
  const ids = new Set();
  for (const item of items) {
    if (ids.has(String(item.id))) continue;
    ids.add(String(item.id));
    (model.isItemSelected(item) ? selected : remaining).push(item);
  }
  const state = model._currentState();
  state.items = selected.concat(remaining);
  state.currentPage = 0;
  state.serverOffset = serverOffset;
  state.retrievedAll = true;
};

const installScoreSbcSubmitRefresh = () => {
  if (typeof UTOneClickSBCReviewViewController === "undefined") return;
  const prototype = UTOneClickSBCReviewViewController.prototype;
  if (prototype.__autoSbcSubmitRefresh || typeof prototype._onSubmissionComplete !== "function") return;
  const onSubmissionComplete = prototype._onSubmissionComplete;
      const back = prototype._eBack;
      if (typeof back === "function") prototype._eBack = function () {
        if (this.viewModel?.__scoreRun) this.viewModel.__scoreRun.stopped = true;
        return back.apply(this, arguments);
      };
  const viewDidAppear = prototype.viewDidAppear;
  if (typeof viewDidAppear === "function") prototype.viewDidAppear = function () {
    const result = viewDidAppear.apply(this, arguments);
    const model = this.viewModel;
    const intent = model?.__scoreAutoSubmit;
    if (intent) {
      model.__scoreAutoSubmit = null;
      void (async () => {
        const set = model.getSet();
        const challenge = model.getChallenge();
        const allows = await createScoreSbcFilter(set, challenge);
        const entries = model.getSelectedEntries();
        const mode = Number(getScoreSbcSetting(set, challenge, "autoSubmit"));
        const run = model.__scoreRun;
        if (run && getScoreSbcSetting(set, challenge, "autoOpenPacks")) run.packCounts = scoreSbcPackCounts(await getPacks());
        if (this.viewModel !== model || this.submitRequest || !entries.length ||
          run?.stopped ||
            challenge.submittedScore !== intent.submittedScore ||
            model.getSelectedItemIds().map(String).sort().join(",") !== intent.ids ||
            !(mode === 1 || (mode === 4 && intent.optimal)) ||
            entries.some(entry => entry.item.concept || !allows(entry.item, Number(getScoreSbcPrice(entry.item, set, challenge)))) ||
            Number(challenge.submittedScore || 0) + entries.reduce((total, entry) => total + Number(entry.item.sbsScore || 0), 0) < challenge.scoreRequirement ||
            model.getSelectedInSquadCount?.() > 0) return;
        this.submitSelection();
      })().catch(error => {
        if (model.__scoreRun) model.__scoreRun.stopped = true;
        console.warn("Score auto-submit validation failed", error);
      });
    }
    return result;
  };
  prototype._onSubmissionComplete = function (observable, response) {
    const succeeded = response?.success && response.data && this.viewModel;
    const run = this.viewModel?.__scoreRun;
    const result = onSubmissionComplete.apply(this, arguments);
    if (run) {
      if (!succeeded) run.stopped = true;
      else void finishScoreSbcRun(run, response.data).catch(error => {
        run.stopped = true;
        console.warn("Score SBC loop stopped", error);
        services.Notification.queue([error.message || "Score SBC loop stopped", UINotificationType.NEGATIVE]);
      });
    }
    if (succeeded) {
      void Promise.resolve().then(() => createSBCTab()).catch(error => {
        console.warn("Score SBC tab refresh failed", error);
      });
    }
    return result;
  };
  prototype.__autoSbcSubmitRefresh = true;
};

const installScoreSbcAutoSelect = () => {
  if (typeof UTOneClickSBCWorkAreaViewController === "undefined") return;
  const prototype = UTOneClickSBCWorkAreaViewController.prototype;
  if (prototype.__autoSbcCostSelect) return;
  prototype.__autoSbcCostSelect = true;
  prototype.__autoSbcReviewAfterAutoSelect = true;
  const viewDidAppear = prototype.viewDidAppear;
  if (typeof viewDidAppear === "function") prototype.viewDidAppear = function () {
    const result = viewDidAppear.apply(this, arguments);
    updateScoreSbcBuyButton(this);
    return result;
  };
  const viewWillDisappear = prototype.viewWillDisappear;
  if (typeof viewWillDisappear === "function") prototype.viewWillDisappear = function () {
    if (!this.__scoreReviewOpening && this.viewModel?.__scoreRun) this.viewModel.__scoreRun.stopped = true;
    this.__scoreReviewOpening = false;
    clearScoreSbcConceptPreview(this);
    return viewWillDisappear.apply(this, arguments);
  };
  prototype._eAutoSelect = async function () {
    let shouldReviewSelection = false;
    const model = this.viewModel;
    if (!model || this.__scoreSbcBusy || this.__scoreBuyBusy || model.getActiveTab() === OneClickSBCWorkAreaTab.FAVOURITE) return;
    const tab = model.getActiveTab();
    const challenge = model.getChallenge();
    const set = model.getSet();
    model.__scoreRun = startScoreSbcRun(set, challenge);
    const originalIds = model.getSelectedItemIds().map(String).sort().join(",");
    const submittedScore = challenge.submittedScore;
    const cancelled = () => model.__scoreRun?.stopped || this.viewModel !== model || model.getActiveTab() !== tab ||
      challenge.submittedScore !== submittedScore || model.getSelectedItemIds().map(String).sort().join(",") !== originalIds;
    this.__scoreSbcBusy = true;
    model.__scoreAutoSubmit = null;
    this.__scoreOptimalPlan = false;
    this.__scoreConceptPlan = null;
    updateScoreSbcBuyButton(this);
    gClickShield.showShield(EAClickShieldView.Shield.LOADING);
    try {
      const allows = await createScoreSbcFilter(set, challenge);
      const replacing = this.__scoreReplacingConcept === true;
      if (!replacing) this.__scorePriceRefreshAttempts = 0;
      model.__scorePurchasedDefinitions ??= new Set();
      this.__scorePurchasedDefinitions = model.__scorePurchasedDefinitions;
      const retained = model.getSelectedEntries().filter(entry => replacing || model._itemTabMap.get(entry.item.id) !== tab);
      for (const entry of retained) {
        const pricedItem = Object.create(entry.item);
        pricedItem.isStorage = model._itemTabMap.get(entry.item.id) === OneClickSBCWorkAreaTab.STORAGE;
        if (!allows(pricedItem, Number(getScoreSbcPrice(pricedItem, set, challenge)))) {
          throw new Error("A selection in another tab is excluded by SBC settings. Remove it before Auto-Select.");
        }
      }
      const retainedIds = new Set(retained.map(entry => String(entry.item.id)));
      const batchLimit = model.getSelectionLimit();
      const availableSlots = batchLimit - retained.length;
      const target = Math.max(0, challenge.scoreRequirement - submittedScore - retained.reduce((sum, entry) => sum + entry.item.sbsScore, 0));
      if (availableSlots <= 0) throw new Error("Batch is full with selections from another tab");
      const candidates = [];
      const fetchedItems = [];
      const fetchedIds = new Set();
      if (tab === OneClickSBCWorkAreaTab.CLUB && typeof dirtyClubCache === "function") dirtyClubCache();
      let offset = 0;
      while (target > 0) {
        const criteria = model._buildCriteria();
        criteria.offset = offset;
        criteria.count = batchLimit;
        const response = await new Promise((resolve, reject) => {
          const observer = {};
          const request = services.Club.search(criteria);
          const timer = setTimeout(() => {
            request.unobserve(observer);
            reject(new Error("Eligible player search timed out"));
          }, 30000);
          request.observe(observer, (observable, result) => {
            clearTimeout(timer);
            observable.unobserve(observer);
            if (!result.success || !Array.isArray(result.response?.items)) reject(new Error("Could not load eligible players"));
            else resolve(result.response);
          });
        });
        if (cancelled()) throw new Error("Selection changed; run Auto-Select again");
        let added = 0;
        for (const item of response.items) {
          if (fetchedIds.has(String(item.id))) continue;
          fetchedIds.add(String(item.id));
          fetchedItems.push(item);
          added++;
          if (retainedIds.has(String(item.id)) || model.__scorePurchasedDefinitions.has(String(item.definitionId)) || item.concept || item.isLoan?.() || Number(item.loans ?? -1) >= 0 ||
              isItemLocked(item) || item.isTimeLimited?.() || !model.isItemSelectable(item)) continue;
          const pricedItem = Object.create(item);
          pricedItem.isStorage = tab === OneClickSBCWorkAreaTab.STORAGE;
          const cost = Number(getScoreSbcPrice(pricedItem, set, challenge));
          if (allows(pricedItem, cost)) candidates.push({ item, score: Number(item.sbsScore), cost });
        }
        offset += response.items.length;
        if (response.retrievedAll || !response.items.length) break;
        if (!added || offset > 20000) throw new Error("Eligible player pagination did not finish");
      }
      const extra = target > 0 ? await scoreSbcExtraCandidates(set, challenge, tab, allows, cancelled) : [];
      const itemTabs = new Map(fetchedItems.map(item => [String(item.id), tab]));
      const availableDefinitions = new Set(candidates.map(candidate => String(candidate.item.definitionId)));
      for (const candidate of scoreSbcFilterExtraConceptDefinitions(extra, model.__scorePurchasedDefinitions, availableDefinitions)) {
        const definitionId = String(candidate.item.definitionId);
        if (retainedIds.has(String(candidate.item.id)) || fetchedIds.has(String(candidate.item.id))) continue;
        fetchedIds.add(String(candidate.item.id));
        candidates.push(candidate);
        if (!candidate.item.concept) {
          fetchedItems.push(candidate.item);
          itemTabs.set(String(candidate.item.id), candidate.tab);
        }
      }
      const result = await optimizeScoreSbc(candidates, target, { cancelled });
      if (cancelled()) throw new Error("Selection changed; run Auto-Select again");
      const concepts = result.items.filter(item => item.concept);
      this.__scoreOptimalPlan = result.reached;
      this.__scoreConceptPlan = concepts.length ? { items: concepts, set, challenge } : null;
      const batch = result.items.filter(item => !item.concept).slice(0, availableSlots);
      model.deselectCurrentTab();
      if (replacing) for (const entry of retained) model.selectItem(entry.item);
      for (const item of fetchedItems) {
        model._itemTabMap.set(item.id, itemTabs.get(String(item.id)) || tab);
        model._itemScoreMap.set(item.id, item.sbsScore);
        model._itemEntityMap.set(item.id, item);
      }
      for (const item of batch) {
        model._itemTabMap.set(item.id, itemTabs.get(String(item.id)) || tab);
        model._itemScoreMap.set(item.id, item.sbsScore);
        model._itemEntityMap.set(item.id, item);
        model.selectItem(item);
      }
      if (this.__scoreConceptPlan) {
        this.__scoreConceptPlan.selectedIds = model.getSelectedItemIds().map(String).sort().join(",");
        this.__scoreConceptPlan.submittedScore = submittedScore;
      }
      if (target > 0) showScoreSbcSelectedFirst(model, fetchedItems.filter(item => itemTabs.get(String(item.id)) === tab), offset);
      this._refreshCurrentPage();
      const batches = Math.ceil((retained.length + result.items.length) / batchLimit);
      if ((!result.reached || batches > 1) && model.__scoreRun) model.__scoreRun.stopped = true;
      const message = `${result.items.length} optimized cards / ${result.score.toLocaleString()} score / ${Math.round(result.cost).toLocaleString()} SBC cost` +
        (concepts.length ? ` / ${concepts.length} concepts to buy before submission.` : "") +
        (batches > 1 ? ` / ${batches} submission batches required. First batch selected; run Auto-Select again after submitting.` : "") +
        (result.reached ? "" : " / Not enough eligible score to finish.");
      services.Notification.queue([message, batches > 1 || !result.reached ? UINotificationType.WARNING : UINotificationType.POSITIVE]);
      shouldReviewSelection = batch.length > 0 && !concepts.length;
    } catch (error) {
      if (model.__scoreRun) model.__scoreRun.stopped = true;
      console.warn("[Auto-SBC] Score optimization failed", error);
      services.Notification.queue([error.message || "Score optimization failed", UINotificationType.NEGATIVE]);
    } finally {
      this.__scoreSbcBusy = false;
      updateScoreSbcBuyButton(this);
      gClickShield.hideShield(EAClickShieldView.Shield.LOADING);
    }
    if (!this.__scoreReplacingConcept && this.__scoreConceptPlan?.items.length && getScoreSbcSetting(set, challenge, "sbcBuyConcepts")) {
      await this.__scoreBuyAction?.();
    } else if (shouldReviewSelection) reviewScoreSbcSelection(this);
  };
};