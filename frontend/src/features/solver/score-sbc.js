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

const createScoreSbcFilter = async (set, challenge) => {
  const settings = Object.fromEntries([
    "ratingRange", "useDupes", "excludePlayers", "excludeLeagues", "excludeNations", "excludeTeams",
    "excludeRarity", "excludeSbc", "excludeObjective", "excludeEvolutions", "excludeSpecial",
    "excludeTradable", "excludeExtinct", "onlyStorage", "maxPlayerPrice", "excludeSbcSquads", "excludeFromSquadIds",
  ].map(key => [key, getSettings(set.id, challenge.id, key)]));
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
    if (item.concept || item.isLoan?.() || Number(item.loans ?? -1) >= 0 || isItemLocked(item) ||
        item.isTimeLimited?.() || !Number.isFinite(cost) || cost < 0) return false;
    if (settings.useDupes && (item.isStorage || item.isDuplicateItem)) return true;
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
  prototype._onSubmissionComplete = function (observable, response) {
    const succeeded = response?.success && response.data && this.viewModel;
    const result = onSubmissionComplete.apply(this, arguments);
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
  prototype._eAutoSelect = async function () {
    const model = this.viewModel;
    if (!model || this.__scoreSbcBusy || model.getActiveTab() === OneClickSBCWorkAreaTab.FAVOURITE) return;
    const tab = model.getActiveTab();
    const challenge = model.getChallenge();
    const set = model.getSet();
    const originalIds = model.getSelectedItemIds().map(String).sort().join(",");
    const submittedScore = challenge.submittedScore;
    const cancelled = () => this.viewModel !== model || model.getActiveTab() !== tab ||
      challenge.submittedScore !== submittedScore || model.getSelectedItemIds().map(String).sort().join(",") !== originalIds;
    this.__scoreSbcBusy = true;
    gClickShield.showShield(EAClickShieldView.Shield.LOADING);
    try {
      const allows = await createScoreSbcFilter(set, challenge);
      const retained = model.getSelectedEntries().filter(entry => model._itemTabMap.get(entry.item.id) !== tab);
      for (const entry of retained) {
        const pricedItem = Object.create(entry.item);
        pricedItem.isStorage = model._itemTabMap.get(entry.item.id) === OneClickSBCWorkAreaTab.STORAGE;
        if (!allows(pricedItem, Number(getSBCPrice(pricedItem, set.id, challenge.id)))) {
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
          if (retainedIds.has(String(item.id)) || item.concept || item.isLoan?.() || Number(item.loans ?? -1) >= 0 ||
              isItemLocked(item) || item.isTimeLimited?.() || !model.isItemSelectable(item)) continue;
          const pricedItem = Object.create(item);
          pricedItem.isStorage = tab === OneClickSBCWorkAreaTab.STORAGE;
          const cost = Number(getSBCPrice(pricedItem, set.id, challenge.id));
          if (allows(pricedItem, cost)) candidates.push({ item, score: Number(item.sbsScore), cost });
        }
        offset += response.items.length;
        if (response.retrievedAll || !response.items.length) break;
        if (!added || offset > 20000) throw new Error("Eligible player pagination did not finish");
      }
      const result = await optimizeScoreSbc(candidates, target, { cancelled });
      if (cancelled()) throw new Error("Selection changed; run Auto-Select again");
      const batch = result.items.slice(0, availableSlots);
      model.deselectCurrentTab();
      for (const item of fetchedItems) {
        model._itemTabMap.set(item.id, tab);
        model._itemScoreMap.set(item.id, item.sbsScore);
        model._itemEntityMap.set(item.id, item);
      }
      for (const item of batch) {
        model._itemTabMap.set(item.id, tab);
        model._itemScoreMap.set(item.id, item.sbsScore);
        model._itemEntityMap.set(item.id, item);
        model.selectItem(item);
      }
      if (target > 0) showScoreSbcSelectedFirst(model, fetchedItems, offset);
      this._refreshCurrentPage();
      const batches = Math.ceil((retained.length + result.items.length) / batchLimit);
      const message = `${result.items.length} optimized cards / ${result.score.toLocaleString()} score / ${Math.round(result.cost).toLocaleString()} SBC cost` +
        (batches > 1 ? ` / ${batches} submission batches required. First batch selected; run Auto-Select again after submitting.` : "") +
        (result.reached ? "" : " / Not enough eligible score to finish.");
      services.Notification.queue([message, batches > 1 || !result.reached ? UINotificationType.WARNING : UINotificationType.POSITIVE]);
    } catch (error) {
      console.warn("[Auto-SBC] Score optimization failed", error);
      services.Notification.queue([error.message || "Score optimization failed", UINotificationType.NEGATIVE]);
    } finally {
      this.__scoreSbcBusy = false;
      gClickShield.hideShield(EAClickShieldView.Shield.LOADING);
    }
  };
};