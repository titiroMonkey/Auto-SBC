const futGalleryUsableSetPlayers = players => players.filter(player =>
  ![player, player?.entity].some(item => futGalleryIsLoan(item) || futGalleryIsTimeLimited(item)));

const futGalleryPruneTimedLoanPlans = (plans, candidates) => {
  const concepts = window.getAutoSbcConceptPlayers?.() || window.autoSbcConceptPlayers || [];
  const entries = window.__clubPlayersEntries || [];
  const excludedIds = new Set();
  for (const entry of entries) {
    const entity = entry.itemAttributes || entry;
    if (futGalleryIsLoan(entity) || futGalleryIsTimeLimited(entity) || futGalleryIsLoan(entry) || futGalleryIsTimeLimited(entry)) {
      excludedIds.add(Number(entry.definitionId ?? entity.definitionId));
    }
  }
  for (const item of concepts) {
    if (futGalleryIsLoan(item) || futGalleryIsTimeLimited(item)) excludedIds.add(Number(item.definitionId));
  }
  const validIds = new Set(candidates.map(player => Number(player.eaId)));
  let changed = false;
  for (const plan of Object.values(plans)) {
    if (!Array.isArray(plan?.ids)) continue;
    const ids = plan.ids.filter(id => !excludedIds.has(Number(id)) || validIds.has(Number(id)));
    if (ids.length !== plan.ids.length) { plan.ids = ids; changed = true; }
  }
  return changed;
};

const futGalleryIsSetComplete = entry => !entry.error && entry.item.requiredCards > 0 &&
  (Array.isArray(entry.players)
    ? entry.players.length === entry.item.requiredCards && entry.players.every(player => player.available)
    : entry.filled === entry.item.requiredCards);

const futGallerySetBadge = (entry) => {
  const graded = futGalleryIsSetComplete(entry) && !!entry.outcome.grade;
  return { graded, text: graded ? entry.outcome.grade : `${entry.filled}/${entry.item.requiredCards}` };
};

const futGallerySetRewardCandidates = (item, tags, candidates) => {
  const requirement = futGalleryEligibility(item, tags);
  return requirement.matches ? futGalleryUsableSetPlayers(candidates).filter(requirement.matches) : [];
};

const futGalleryCreateGemIcon = () => {
  const icon = document.createElement("span");
  icon.className = "ut-one-click-sbc-work-area-item-view--score-icon fg-gem-icon";
  icon.setAttribute("aria-hidden", "true");
  return icon;
};

const futGallerySetSidebarSummary = (item, tags, candidates, lineupIds = null) => {
  const requirement = futGalleryEligibility(item, tags);
  const eligibleCandidates = futGalleryUsableSetPlayers(candidates).filter(player => player.score !== null && requirement.matches?.(player));
  const players = lineupIds
    ? eligibleCandidates.filter(player => lineupIds.includes(player.eaId)).slice(0, item.requiredCards)
    : eligibleCandidates.filter(player => player.available).sort((left, right) => right.score - left.score).slice(0, item.requiredCards);
  const outcome = futGalleryEvaluate(item, tags, players);
  const complete = !requirement.error && item.requiredCards > 0 && players.length === item.requiredCards;
  return {
    complete,
    grade: complete ? outcome.grade : null,
    gems: complete ? Math.max(0, Number(outcome.totalScore) || 0) : 0,
    tokens: complete ? Math.max(0, Number(outcome.tokens) || 0) : 0,
  };
};

const futGalleryOverviewEntries = (summaries, sort, completedOnly, ascending = sort === "name", hideCompleted = false) => summaries
  .filter(entry => !completedOnly || futGalleryIsSetComplete(entry))
  .filter(entry => !hideCompleted || !futGalleryIsSetComplete(entry))
  .sort((left, right) => {
    if (sort === "coins") {
      const leftKnown = Number.isFinite(left.coinsToComplete);
      const rightKnown = Number.isFinite(right.coinsToComplete);
      return Number(rightKnown) - Number(leftKnown) ||
        (leftKnown && rightKnown ? (left.coinsToComplete - right.coinsToComplete) * (ascending ? 1 : -1) : 0) ||
        left.item.name.localeCompare(right.item.name);
    }
    const completion = entry => entry.item.requiredCards > 0 ? Math.min(entry.filled / entry.item.requiredCards, 1) : 0;
    const difference = sort === "completion" ? completion(left) - completion(right)
      : sort === "gems" ? left.outcome.totalScore - right.outcome.totalScore
      : left.item.name.localeCompare(right.item.name);
    return difference * (ascending ? 1 : -1) || left.item.name.localeCompare(right.item.name);
  });

const futGalleryOverviewStats = (summaries, candidates) => {
  const completed = summaries.filter(futGalleryIsSetComplete);
  const gradeCounts = ["D", "C", "B", "A", "S"].map(name => ({
    name,
    count: completed.filter(entry => entry.outcome.grade === name).length,
  }));
  return {
    completedSets: completed.length,
    totalSets: summaries.length,
    gradeCounts,
    completedItems: completed.reduce((total, entry) => total + entry.item.requiredCards, 0),
    gems: completed.reduce((total, entry) => total + Number(entry.outcome.totalScore || 0), 0),
    tokens: completed.reduce((total, entry) => total + Number(entry.outcome.tokens || 0), 0),
    seenPlayers: candidates.filter(player => player.seen && !player.inClub).length,
    firstOwnedPlayers: candidates.filter(player => player.firstOwner).length,
  };
};

const futGalleryPlayerPrice = player => {
  if (typeof futGalleryPrice === "function") return futGalleryPrice(player);
  if (Number.isFinite(Number(player?.variantPrice)) && Number(player.variantPrice) > 0) return Number(player.variantPrice);
  if (player?.isVariantItem) return NaN;
  return typeof getPrice === "function" ? Number(getPrice(player?.entity)) : NaN;
};

const futGallerySortPlayers = (players, type, ascending, price = futGalleryPlayerPrice) => players
  .map(player => ({ player, value: type === "price" ? Number(price(player)) : player[type] }))
  .sort((left, right) => {
    const valid = value => Number.isFinite(value) && (type !== "price" || value > 0);
    const leftValid = valid(left.value), rightValid = valid(right.value);
    return Number(rightValid) - Number(leftValid)
      || (leftValid && rightValid ? (left.value - right.value) * (ascending ? 1 : -1) : 0)
      || left.player.name.localeCompare(right.player.name) || left.player.eaId - right.player.eaId;
  }).map(entry => entry.player);

const futGalleryPurchaseCost = (players, purchasedIds = new Set(), price = futGalleryPlayerPrice) => {
  const missing = [...new Map(players.filter(player => !player.available && !purchasedIds.has(player.eaId)).map(player => [player.eaId, player])).values()];
  let total = 0;
  let unpriced = 0;
  for (const player of missing) {
    const value = Number(price(player));
    if (Number.isFinite(value) && value > 0) total += value;
    else unpriced++;
  }
  return { total, unpriced, count: missing.length };
};

const futGalleryCompletionCost = (entry, candidates, matches, price = futGalleryPlayerPrice) => {
  if (entry.error || !matches || entry.item.requiredCards <= 0) return null;
  const players = [...entry.players];
  const selectedIds = new Set(players.map(player => player.eaId));
  const remaining = candidates.filter(player => !selectedIds.has(player.eaId) && matches(player) && player.score !== null)
    .map(player => ({ player, cost: player.available ? 0 : Number(price(player)) }))
    .filter(value => Number.isFinite(value.cost) && (value.player.available || value.cost > 0))
    .sort((left, right) => left.cost - right.cost);
  players.push(...remaining.slice(0, Math.max(0, entry.item.requiredCards - players.length)).map(value => value.player));
  if (players.length !== entry.item.requiredCards) return null;
  const purchase = futGalleryPurchaseCost(players, new Set(), price);
  return purchase.unpriced ? null : purchase.total;
};

const futGalleryGetTierProgress = tag => {
  const tiers = [...(tag.tiers || [])].sort((left, right) => left.minItems - right.minItems);
  const maxItems = Math.max(1, tiers.at(-1)?.minItems || 1);
  const currentTierIndex = tiers.map(tier => tier.minItems <= tag.count).lastIndexOf(true);
  const nextTier = tiers.find(tier => tier.minItems > tag.count) || null;
  return {
    tiers,
    maxItems,
    fillPercent: Math.min(100, Math.max(0, Number(tag.count) || 0) / maxItems * 100),
    currentTierIndex,
    remaining: nextTier ? Math.max(0, nextTier.minItems - tag.count) : 0,
  };
};

const futGalleryShowBonuses = (root, outcome, players, trigger) => {
  root.querySelector(".fg-bonus-dialog")?.remove();
  const dialog = document.createElement("dialog"); dialog.className = "fg-bonus-dialog";
  dialog.setAttribute("aria-labelledby", "fg-bonus-title");
  dialog.innerHTML = `<header class="fg-dialog-header"><div><h2 id="fg-bonus-title">Bonus tags</h2><p class="fg-muted"></p></div><button type="button" aria-label="Close bonus tags" title="Close">&#215;</button></header><div class="fg-tag-grid"></div>`;
  const number = value => Number(value).toLocaleString();
  dialog.querySelector("p").textContent = `${outcome.bonuses.filter(tag => tag.paid).length} / ${outcome.bonuses.length} paid tags / ${number(outcome.baseScore)} base Gems + ${number(outcome.bonusScore)} bonus Gems = ${number(outcome.totalScore)} total Gems`;
  const byId = new Map(players.map(player => [player.eaId, player]));
  for (const tag of outcome.bonuses) {
    const row = document.createElement("article"); row.className = `fg-tag-detail${tag.paid ? " active" : ""}`;
    const heading = document.createElement("h3"); heading.textContent = tag.name;
    const count = document.createElement("span"); count.className = "fg-muted";
    count.textContent = `${tag.count} matching / ${tag.percent}%${tag.nextTier ? ` / ${tag.nextTier.minItems - tag.count} more for ${tag.nextTier.bonus}%` : " / Highest tier"}`;
    const tierProgress = futGalleryGetTierProgress(tag);
    const progress = document.createElement("div"); progress.className = "fg-tier-progress";
    progress.setAttribute("role", "progressbar");
    progress.setAttribute("aria-label", `${tag.name} matching players toward bonus tiers`);
    progress.setAttribute("aria-valuemin", "0");
    progress.setAttribute("aria-valuemax", String(tierProgress.maxItems));
    progress.setAttribute("aria-valuenow", String(Math.min(tag.count, tierProgress.maxItems)));
    const nextDescription = tag.nextTier ? `, ${tierProgress.remaining} more for ${tag.nextTier.bonus}%` : ", highest tier reached";
    progress.setAttribute("aria-valuetext", `${tag.count} matching, ${tag.percent}%${nextDescription}`);
    const fill = document.createElement("span"); fill.className = "fg-tier-progress-fill";
    fill.style.width = `${tierProgress.fillPercent}%`; progress.append(fill);
    const tierLabels = document.createElement("div"); tierLabels.className = "fg-tier-labels";
    tierProgress.tiers.forEach((tier, index) => {
      const reached = tag.count >= tier.minItems;
      const marker = document.createElement("span");
      marker.className = `fg-tier-marker${reached ? " reached" : ""}${index === tierProgress.currentTierIndex ? " current" : ""}`;
      marker.style.left = `${tier.minItems / tierProgress.maxItems * 100}%`;
      marker.setAttribute("aria-hidden", "true"); progress.append(marker);
      const label = document.createElement("span");
      label.className = `fg-tier-label${reached ? " reached" : ""}${index === tierProgress.currentTierIndex ? " current" : ""}`;
      if (index === 0) label.classList.add("first");
      if (index === tierProgress.tiers.length - 1) label.classList.add("last");
      label.style.left = `${tier.minItems / tierProgress.maxItems * 100}%`;
      label.textContent = `${tier.minItems}+ / ${tier.bonus}%`;
      tierLabels.append(label);
    });
    const calculation = document.createElement("strong");
    calculation.textContent = `floor(${number(tag.matchedScore)} Gems x ${tag.percent} / 100) = ${number(tag.bonus)} Gems${tag.bonus > 0 && !tag.paid ? " / Not paid (10-tag limit)" : ""}`;
    const names = document.createElement("p"); names.className = "fg-muted";
    names.textContent = tag.matchedIds.map(id => byId.get(id)?.name || String(id)).join(", ") || "No matching players";
    row.append(heading, count, progress, tierLabels, calculation, names); dialog.querySelector(".fg-tag-grid").append(row);
  }
  const close = () => dialog.close();
  dialog.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
  }, true);
  dialog.querySelector("button").onclick = close;
  dialog.onclick = event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close(); } };
  dialog.onclose = () => { dialog.remove(); if (trigger?.isConnected) trigger.focus(); };
  root.append(dialog); dialog.showModal();
};

const futGalleryEnsureStyles = () => {
  if (document.getElementById("fut-gallery-styles")) return;
  const style = document.createElement("style");
  style.id = "fut-gallery-styles";
  style.textContent = `
    #FutGalleryPanel { --fg-bg:#171a1c; --fg-panel:#202426; --fg-line:#3b4245; --fg-muted:#aeb9bc; --fg-accent:#b7f36b; color:#f5f7f8; background:var(--fg-bg); display:flex; flex-direction:column; height:100%; min-height:0; padding:0; overflow:hidden; font-family:inherit; font-size:14px; line-height:1.45; container-type:inline-size; }
    #FutGalleryPanel * { box-sizing:border-box; letter-spacing:0; }
    #FutGalleryPanel [hidden] { display:none !important; }
    #FutGalleryPanel h1,#FutGalleryPanel h2,#FutGalleryPanel h3,#FutGalleryPanel p { margin:0; color:inherit; }
    #FutGalleryPanel h1 { font-size:26px; line-height:1.2; } #FutGalleryPanel h2 { font-size:23px; line-height:1.25; } #FutGalleryPanel h3 { font-size:16px; }
    #FutGalleryPanel button,#FutGalleryPanel input,#FutGalleryPanel select { font:inherit; border-radius:4px; min-height:38px; max-width:100%; }
    #FutGalleryPanel button { cursor:pointer; background:#303638; border:1px solid var(--fg-line); color:#f5f7f8; padding:8px 12px; line-height:1.25; }
    #FutGalleryPanel button:hover { border-color:var(--fg-accent); } #FutGalleryPanel button:disabled { opacity:.45; cursor:default; }
    #FutGalleryPanel :focus-visible { outline:2px solid var(--fg-accent); outline-offset:3px; }
    #FutGalleryPanel input,#FutGalleryPanel select { width:100%; background:#151819; color:#f5f7f8; border:1px solid #596164; padding:8px 10px; }
    #FutGalleryPanel .fg-header { padding:22px 24px; display:flex; align-items:center; justify-content:space-between; gap:16px; border-bottom:1px solid var(--fg-line); background:linear-gradient(100deg,#242b26,#202426 60%); }
    #FutGalleryPanel .fg-header-title { display:flex; align-items:center; gap:12px; min-width:0; } #FutGalleryPanel .fg-header-title img { width:32px; height:40px; object-fit:contain; }
    #FutGalleryPanel .fg-header-title h2 { flex:none; }
    #FutGalleryPanel .fg-header-category { color:var(--fg-accent); font-size:11px; font-weight:700; text-transform:uppercase; }
    #FutGalleryPanel .fg-header-rewards { display:grid; gap:2px; padding-left:14px; border-left:1px solid var(--fg-line); font-size:12px; white-space:nowrap; }
    #FutGalleryPanel .fg-muted { color:var(--fg-muted); font-size:12px; } #FutGalleryPanel .fg-accent { color:var(--fg-accent); }
    #FutGalleryPanel .fg-layout { display:grid; grid-template-columns:250px minmax(0,1fr); min-height:calc(100% - 85px); }
    #FutGalleryPanel .fg-rail { border-right:1px solid var(--fg-line); padding:16px 12px; min-width:0; background:#1b1f21; }
    #FutGalleryPanel .fg-filters { display:grid; gap:8px; padding:0 4px 14px; }
    #FutGalleryPanel .fg-set-list { display:grid; gap:4px; max-height:calc(100vh - 290px); overflow:auto; }
    #FutGalleryPanel .fg-set { display:block; text-align:left; width:100%; padding:12px; background:transparent; border:1px solid transparent; border-left:3px solid transparent; }
    #FutGalleryPanel .fg-set[aria-pressed=true] { background:#30392b; border-left-color:var(--fg-accent); }
    #FutGalleryPanel .fg-set strong { display:block; font-size:14px; overflow-wrap:anywhere; } #FutGalleryPanel .fg-set span { display:block; margin-top:4px; color:var(--fg-muted); font-size:12px; }
    #FutGalleryPanel .fg-set .fg-set-grade { display:inline-grid; vertical-align:middle; width:20px; height:22px; margin:0 0 0 6px; font-size:10px !important; }
    #FutGalleryPanel .fg-workspace { padding:24px; min-width:0; }
    #FutGalleryPanel .fg-navigation { display:flex; flex-wrap:wrap; gap:6px; padding:12px 24px; border-bottom:1px solid var(--fg-line); }
    #FutGalleryPanel .fg-navigation button[aria-pressed=true] { background:var(--fg-accent); color:#17200e; }
    #FutGalleryPanel .fg-browser { padding:24px; }
    #FutGalleryPanel .fg-browser-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(250px,100%),1fr)); gap:12px; }
    #FutGalleryPanel .fg-browser-item { display:flex; flex-direction:column; gap:10px; text-align:left; padding:16px; min-width:0; position:relative; }
    #FutGalleryPanel .fg-browser-item > .fg-icons { padding-right:48px; flex-wrap:wrap; }
    #FutGalleryPanel .fg-remaining { position:absolute; top:12px; right:12px; width:42px; height:42px; border-radius:50%; display:grid; place-items:center; background:#171a1c; border:1px solid var(--fg-line); color:var(--fg-muted); font-size:11px; font-weight:700; font-variant-numeric:tabular-nums; }
    #FutGalleryPanel .fg-browser-item strong { font-size:16px; overflow-wrap:anywhere; }
    #FutGalleryPanel .fg-browser-item .fg-completion-cost { display:block; font-size:20px; line-height:1.25; font-variant-numeric:tabular-nums; }
    #FutGalleryPanel .fg-completion-cost.affordable { color:var(--fg-accent); }
    #FutGalleryPanel .fg-completion-cost.over-budget { color:#f5ce70; }
    #FutGalleryPanel .fg-hide-completed { display:flex; align-items:center; gap:6px; font-size:12px; }
    #FutGalleryPanel .fg-hide-completed input { width:16px; height:16px; min-height:0; accent-color:var(--fg-accent); }
    #FutGalleryPanel .fg-icons { display:flex; gap:8px; align-items:center; min-height:42px; margin-bottom:6px; }
    #FutGalleryPanel .fg-icons img { width:36px; height:42px; object-fit:contain; }
    #FutGalleryPanel .fg-browser progress { width:100%; height:8px; accent-color:var(--fg-accent); }
    #FutGalleryPanel .fg-stats-page { display:grid; gap:20px; width:min(100%,1050px); padding:22px; border:1px solid var(--fg-line); border-top:2px solid var(--fg-accent); background:linear-gradient(145deg,#202827,#171a1c 76%); }
    #FutGalleryPanel .fg-stats-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; padding-bottom:14px; border-bottom:1px solid var(--fg-line); }
    #FutGalleryPanel .fg-stats-heading > div > span { color:var(--fg-accent); font-size:10px; font-weight:700; }
    #FutGalleryPanel .fg-stats-heading h2 { margin-top:3px; font-size:22px; }
    #FutGalleryPanel .fg-stats-count { color:var(--fg-accent); font-size:15px; font-variant-numeric:tabular-nums; }
    #FutGalleryPanel .fg-grade-summary { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:8px; padding:0 0 18px; border-bottom:1px solid var(--fg-line); }
    #FutGalleryPanel .fg-grade-total { display:grid; justify-items:center; gap:4px; min-width:0; }
    #FutGalleryPanel .fg-grade-total .fg-grade-icon { width:30px; height:34px; font-size:13px !important; }
    #FutGalleryPanel .fg-grade-total strong { color:#f5f7f8; font-size:12px; font-variant-numeric:tabular-nums; }
    #FutGalleryPanel .fg-overview-stats { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); column-gap:24px; }
    #FutGalleryPanel .fg-overview-stat { display:grid; align-content:start; gap:5px; min-width:0; padding:14px 0; border-bottom:1px solid var(--fg-line); }
    #FutGalleryPanel .fg-overview-stat span { color:var(--fg-muted); font-size:11px; line-height:1.35; overflow-wrap:anywhere; }
    #FutGalleryPanel .fg-overview-stat strong { color:#f5f7f8; font-size:23px; font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
    #FutGalleryPanel .fg-overview-stat[data-stat="completed-sets"] strong,#FutGalleryPanel .fg-overview-stat[data-stat="tokens"] strong { color:var(--fg-accent); }
    #FutGalleryPanel .fg-browser-main { min-width:0; }
    #FutGalleryPanel .fg-browser-search { max-width:320px; }
    .fg-autocomplete-modal { width:100%; min-height:0; padding:24px; overflow:auto; color:#f5f7f8; background:#171a1c; font-family:inherit; font-size:14px; line-height:1.45; }
    .fg-autocomplete-modal h2 { margin:0 0 14px; color:#f5f7f8; font-size:21px; line-height:1.2; }
    .fg-autocomplete-modal form { display:grid; gap:14px; }
    .fg-autocomplete-modal,.fg-autocomplete-modal * { box-sizing:border-box; }
    .fg-autocomplete-modal label { display:grid; gap:8px; color:#c8d0d2; font-size:13px; font-weight:700; }
    .fg-autocomplete-modal input[type="number"] { display:block; width:100%; min-width:0; min-height:44px; padding:10px 12px; border:1px solid #596164; border-radius:4px; background:#111517; color:#f5f7f8; font:inherit; font-size:16px; font-variant-numeric:tabular-nums; color-scheme:dark; }
    .fg-autocomplete-modal input:focus-visible { outline:2px solid #b7f36b; outline-offset:2px; }
    .fg-reward-modal { max-height:calc(100vh - 48px); }
    .fg-reward-modal [data-result]:empty { display:none; }
    .fg-reward-modal .fg-planner-log { margin:0; min-height:18px; color:#c8d0d2; font-size:12px; overflow-wrap:anywhere; }
    .fg-reward-modal [data-result] { margin-top:20px; border-top:1px solid #3b4245; }
    .fg-reward-modal [data-result] section + section { border-top:1px solid #3b4245; }
    .fg-reward-modal [data-result] h3 { margin:0 0 6px; font-size:14px; color:#f5f7f8; overflow-wrap:anywhere; }
    .fg-reward-modal [data-result] p { margin:0; color:#aeb9bc; font-size:13px; overflow-wrap:anywhere; }
    .fg-reward-modal .fg-autocomplete-actions { flex-wrap:wrap; padding-top:8px; border-top:1px solid #3b4245; }
    .fg-reward-background-progress { display:grid; gap:7px; padding:10px 16px; border-bottom:1px solid var(--fg-line); background:#202827; }
    .fg-reward-background-progress > div { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .fg-reward-background-progress strong { min-width:0; overflow-wrap:anywhere; }
    .fg-reward-background-progress p { margin:0; color:var(--fg-muted); font-size:12px; overflow-wrap:anywhere; }
    .fg-reward-background-progress progress { display:block; width:100%; height:8px; accent-color:var(--fg-accent); }
    @media (max-width:480px) { .fg-reward-modal { padding:18px; } .fg-reward-modal .fg-autocomplete-actions button { flex:1 1 100px; min-width:0; } }
    .fg-autocomplete-progress { display:grid; gap:7px; }
    .fg-autocomplete-progress progress { display:block; width:100%; height:8px; border:0; border-radius:8px; overflow:hidden; background:#303638; accent-color:#b7f36b; }
    .fg-autocomplete-progress progress::-webkit-progress-bar { border-radius:8px; background:#303638; }
    .fg-autocomplete-progress progress::-webkit-progress-value { border-radius:8px; background:#b7f36b; transition:width .2s ease; }
    .fg-autocomplete-progress progress::-moz-progress-bar { border-radius:8px; background:#b7f36b; }
    .fg-autocomplete-modal [role="status"] { min-height:18px; margin:0; color:#aeb9bc; font-size:12px; }
    .fg-autocomplete-choice { display:grid; gap:6px; }
    .fg-autocomplete-choice-label { color:#c8d0d2; font-size:12px; font-weight:700; }
    .fg-autocomplete-segmented { display:flex; width:100%; gap:4px; padding:4px; border:1px solid #3b4245; border-radius:5px; background:#111517; }
    .fg-autocomplete-segmented button { flex:1; min-width:0; min-height:38px; padding:7px 10px; border:1px solid transparent; border-radius:3px; color:#c8d0d2; background:transparent; font:inherit; font-size:12px; font-weight:700; white-space:nowrap; cursor:pointer; }
    .fg-autocomplete-segmented button[aria-pressed="true"] { border-color:#b7f36b; color:#17200e; background:#b7f36b; }
    .fg-autocomplete-segmented button:focus-visible,.fg-autocomplete-actions button:focus-visible { outline:2px solid #b7f36b; outline-offset:2px; }
    .fg-autocomplete-segmented button:disabled { opacity:.5; cursor:default; }
    .fg-autocomplete-actions { display:flex; gap:8px; padding-top:2px; }
    .fg-autocomplete-actions button { min-width:88px; min-height:38px; padding:8px 14px; border:1px solid #465054; border-radius:4px; color:#f5f7f8; background:#303638; font:inherit; font-size:13px; font-weight:700; cursor:pointer; }
    .fg-autocomplete-actions button[type="submit"] { border-color:#b7f36b; color:#17200e; background:#b7f36b; }
    .fg-autocomplete-actions button:hover:not(:disabled) { filter:brightness(1.08); }
    .fg-autocomplete-actions button:disabled { opacity:.5; cursor:default; }
    #FutGalleryPanel .fg-rung[aria-pressed=true] { outline:2px solid var(--fg-accent); }
    #FutGalleryPanel .fg-set-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:20px; }
    #FutGalleryPanel .fg-description { color:var(--fg-muted); margin-top:8px; max-width:650px; font-size:13px; }
    #FutGalleryPanel .fg-category-label { color:var(--fg-accent); font-size:11px; text-transform:uppercase; font-weight:700; margin-bottom:6px; }
    #FutGalleryPanel .fg-score-band { display:grid; grid-template-columns:100px repeat(3,minmax(0,1fr)); padding:18px 0; border-top:1px solid var(--fg-line); border-bottom:1px solid var(--fg-line); gap:16px; align-items:center; }
    #FutGalleryPanel .fg-projected-grade { display:flex; flex-direction:column; align-items:flex-start; gap:5px; }
    #FutGalleryPanel .fg-stat strong { display:block; font-size:24px; font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
    #FutGalleryPanel .fg-stat span { color:var(--fg-muted); font-size:12px; }
    #FutGalleryPanel .fg-ladder { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:6px; margin:18px 0 10px; }
    #FutGalleryPanel .fg-rung { padding:10px 8px; background:#242a2c; border-top:3px solid #596164; }
    #FutGalleryPanel .fg-rung.reached { background:#293823; border-color:var(--fg-accent); } #FutGalleryPanel .fg-rung strong { display:block; font-size:18px; }
    #FutGalleryPanel .fg-rung span { display:block; font-size:12px; font-variant-numeric:tabular-nums; } #FutGalleryPanel .fg-rung small { color:var(--fg-muted); font-size:11px; }
    #FutGalleryPanel .fg-rung { display:flex; align-items:center; gap:9px; text-align:left; }
    #FutGalleryPanel .fg-grade-icon { --fg-medal:#b9c8ce; --fg-medal-face:#303e45; position:relative; isolation:isolate; display:grid; place-items:center; flex:none; width:38px; height:42px; padding:0; clip-path:polygon(14% 0,86% 0,100% 14%,100% 70%,50% 100%,0 70%,0 14%); background:var(--fg-medal); color:#f5f7f8; font-size:17px !important; font-weight:900; line-height:1; text-shadow:0 1px 2px #000a; }
    #FutGalleryPanel .fg-grade-icon::before { content:""; position:absolute; inset:2px; z-index:-1; clip-path:polygon(14% 0,86% 0,100% 14%,100% 70%,50% 100%,0 70%,0 14%); background:linear-gradient(145deg,var(--fg-medal-face),#171a1c 75%); }
    #FutGalleryPanel .fg-grade-icon[data-grade="D"] { --fg-medal:#c88b52; --fg-medal-face:#684426; }
    #FutGalleryPanel .fg-grade-icon[data-grade="C"] { --fg-medal:#80d4ad; --fg-medal-face:#285343; }
    #FutGalleryPanel .fg-grade-icon[data-grade="B"] { --fg-medal:#85caff; --fg-medal-face:#284c69; }
    #FutGalleryPanel .fg-grade-icon[data-grade="A"] { --fg-medal:#f5ce70; --fg-medal-face:#655027; }
    #FutGalleryPanel .fg-grade-icon[data-grade="S"] { --fg-medal:#b7f36b; --fg-medal-face:#48652e; }
    #FutGalleryPanel .fg-remaining.fg-grade-icon { position:absolute; top:12px; right:12px; border:0; border-radius:0; }
    #FutGalleryPanel .fg-rung > .fg-grade-icon { display:grid; }
    #FutGalleryPanel .fg-rung-copy { min-width:0; }
    #FutGalleryPanel .fg-rung-copy strong { font-size:14px; }
    #FutGalleryPanel .fg-rung-copy span { font-size:12px; }
    #FutGalleryPanel .fg-rung-copy small { font-size:10px; }
    #FutGalleryPanel .fg-status { min-height:24px; color:var(--fg-muted); font-size:12px; margin:8px 0 20px; }
    #FutGalleryPanel .fg-toolbar { display:flex; align-items:center; flex-wrap:wrap; gap:10px; margin:20px 0 16px; }
    #FutGalleryPanel .fg-toolbar h3 { margin-right:auto; } #FutGalleryPanel .fg-primary { background:var(--fg-accent); border-color:var(--fg-accent); color:#17200e; font-weight:700; }
    #FutGalleryPanel .fg-mode { display:flex; gap:0; } #FutGalleryPanel .fg-mode button { border-radius:0; font-size:12px; } #FutGalleryPanel .fg-mode button[aria-pressed=true] { background:#dbe4e6; color:#172024; }
    #FutGalleryPanel .fg-lineup { display:grid; grid-template-columns:repeat(auto-fill,minmax(146px,1fr)); gap:10px; }
    #FutGalleryPanel .fg-player { display:flex; flex-direction:column; border:1px solid var(--fg-line); border-radius:6px; overflow:hidden; background:#24292b; min-width:0; position:relative; }
    #FutGalleryPanel .fg-player.is-tag-match { border-color:var(--fg-accent); box-shadow:0 0 0 1px #b7f36b88,0 0 12px #b7f36b44; }
    #FutGalleryPanel .fg-player.is-tag-dimmed { opacity:.28; filter:saturate(.45); }
    #FutGalleryPanel .fg-player.is-tag-match,#FutGalleryPanel .fg-player.is-tag-dimmed { transition:opacity .12s ease,filter .12s ease,border-color .12s ease,box-shadow .12s ease; }
    #FutGalleryPanel .fg-player.pristine { border-color:#d9f88c; box-shadow:0 0 12px #b7f36b8c, inset 0 0 0 1px #b7f36b66; }
    #FutGalleryPanel .fg-player.pristine .fg-player-media::after { content:"PRISTINE"; position:absolute; left:7px; top:7px; z-index:1; padding:2px 6px; border:1px solid #e6ffc0; border-radius:2px; background:linear-gradient(110deg,#263a1d,#536d31); color:#f2ffd8; font-family:Georgia,serif; font-size:9px; font-style:italic; font-weight:700; letter-spacing:1px; text-shadow:0 0 7px #d7ff86; box-shadow:0 0 10px #b7f36bba; }
    #FutGalleryPanel .fg-player.pristine .fg-player-media > .fg-native { filter:drop-shadow(0 0 7px #b7f36b); }
    #FutGalleryPanel .fg-player-media { height:200px; display:flex; justify-content:center; align-items:center; overflow:hidden; position:relative; background:radial-gradient(ellipse at bottom,#414630 0,#24292b 70%); }
    #FutGalleryPanel .fg-player-media > .fg-native { width:144px; height:200px; transform:none; pointer-events:none; flex-shrink:0; }
    #FutGalleryPanel .fg-native .ut-item-player-state-indicator-view.loan { display:none !important; }
    #FutGalleryPanel .fg-player-media img { width:100%; height:100%; object-fit:contain; } #FutGalleryPanel .fg-fallback-rating { position:absolute; top:8px; left:8px; font-size:22px; font-weight:700; }
    #FutGalleryPanel .fg-player-info { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; min-width:0; padding:10px; text-align:center; }
    #FutGalleryPanel .fg-player-info strong { display:block; max-width:100%; font-size:12px; white-space:nowrap; text-overflow:ellipsis; overflow:hidden; text-align:center; }
    #FutGalleryPanel .fg-player-info .fg-gems { display:inline-flex; align-items:center; justify-content:center; gap:4px; color:#e9d48a; font-size:16px; font-variant-numeric:tabular-nums; margin:4px 0; }
    #FutGalleryPanel .fg-gem-icon { display:inline-block; flex:none; width:16px; height:16px; margin:0; background-size:contain; }
    #FutGalleryPanel .fg-gems-bonus { display:inline-block; margin-left:5px; color:var(--fg-accent); font-size:11px; opacity:0; transform:translateY(2px); transition:opacity .12s ease,transform .12s ease; }
    #FutGalleryPanel .fg-player:hover .fg-gems-bonus,#FutGalleryPanel .fg-player:focus-within .fg-gems-bonus { opacity:1; transform:translateY(0); }
    #FutGalleryPanel .fg-bonus-chips { display:flex; flex-wrap:wrap; align-items:center; gap:5px; }
    #FutGalleryPanel .fg-bonus-chip { padding:3px 7px; border:1px solid #62794a; border-radius:3px; color:#d8efb7; background:#293622; font-size:10px; line-height:1.35; }
    #FutGalleryPanel .fg-bonus-chip strong { margin-left:4px; color:var(--fg-accent); font-size:10px; }
    #FutGalleryPanel .fg-bonus-chip.is-dimmed { opacity:.4; }
    #FutGalleryPanel .fg-bonus-chip.is-focused { border-color:var(--fg-accent); background:#35452a; }
    #FutGalleryPanel .fg-bonus-player-list { display:flex; flex-wrap:wrap; gap:6px; width:100%; color:var(--fg-muted); font-size:11px; }
    #FutGalleryPanel .fg-bonus-player-list[hidden] { display:none; }
    #FutGalleryPanel .fg-bonus-player-share { padding:3px 6px; border-radius:3px; background:#22292b; }
    #FutGalleryPanel .fg-bonus-player-share strong { margin-left:4px; color:var(--fg-accent); }
    #FutGalleryPanel .fg-player-action { position:absolute; top:6px; right:6px; width:30px; min-height:30px; padding:0; z-index:1; font-size:20px; background:#171a1ceb; }
    #FutGalleryPanel .fg-slot { height:285px; border:1px dashed #535d60; border-radius:6px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:#7f8b90; }
    #FutGalleryPanel .fg-slot strong { font-size:28px; font-weight:400; } #FutGalleryPanel .fg-slot span { font-size:12px; }
    #FutGalleryPanel .fg-bonuses { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:0 20px; margin-top:12px; }
    #FutGalleryPanel .fg-bonus { padding:10px 0; border-bottom:1px solid var(--fg-line); display:flex; justify-content:space-between; gap:8px; font-size:12px; } #FutGalleryPanel .fg-bonus strong { color:var(--fg-accent); }
    #FutGalleryPanel .fg-bonus-dialog { position:fixed; inset:0; margin:auto; width:min(1100px,calc(100vw - 24px)); max-width:calc(100vw - 24px); max-height:calc(100dvh - 32px); padding:20px; border:1px solid var(--fg-line); border-radius:6px; background:var(--fg-bg); color:#f5f7f8; overflow:auto; }
    #FutGalleryPanel .fg-bonus-dialog::backdrop { background:#000a; }
    #FutGalleryPanel .fg-dialog-header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:18px; }
    #FutGalleryPanel .fg-dialog-header button { flex:none; width:38px; height:38px; padding:0; font-size:24px; }
    #FutGalleryPanel .fg-tag-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr)); gap:10px; }
    #FutGalleryPanel .fg-tag-detail { display:flex; flex-direction:column; gap:7px; padding:14px; border:1px solid var(--fg-line); border-radius:4px; min-width:0; overflow-wrap:anywhere; }
    #FutGalleryPanel .fg-tag-detail.active { border-color:#658548; background:#242d23; }
    #FutGalleryPanel .fg-tag-detail strong { font-size:13px; font-variant-numeric:tabular-nums; color:var(--fg-accent); }
    #FutGalleryPanel .fg-tier-progress { position:relative; height:8px; margin:7px 5px 2px; border-radius:5px; background:#343b3d; }
    #FutGalleryPanel .fg-tier-progress-fill { display:block; height:100%; border-radius:5px; background:#758779; }
    #FutGalleryPanel .fg-tier-marker { position:absolute; top:50%; width:12px; height:12px; transform:translate(-50%,-50%); border:2px solid #778184; border-radius:50%; background:#202526; }
    #FutGalleryPanel .fg-tier-marker.reached { border-color:#9bc56a; background:#9bc56a; }
    #FutGalleryPanel .fg-tier-marker.current { width:16px; height:16px; border-color:#d5ff91; box-shadow:0 0 0 2px #d5ff9140; }
    #FutGalleryPanel .fg-tier-labels { position:relative; height:17px; margin:0 5px 4px; }
    #FutGalleryPanel .fg-tier-label { position:absolute; transform:translateX(-50%); white-space:nowrap; color:var(--fg-muted); font-size:10px; font-variant-numeric:tabular-nums; }
    #FutGalleryPanel .fg-tier-label.first { transform:none; }
    #FutGalleryPanel .fg-tier-label.last { transform:translateX(-100%); }
    #FutGalleryPanel .fg-tier-label.current { color:var(--fg-accent); font-weight:700; }
    #FutGalleryPanel .fg-pool { margin-top:28px; padding-top:4px; border-top:1px solid var(--fg-line); } #FutGalleryPanel .fg-player-search { max-width:240px; }
    #FutGalleryPanel .fg-empty { padding:28px 12px; color:var(--fg-muted); text-align:center; } #FutGalleryPanel .fg-error { color:#ffd099; }
    #FutGalleryPanel .fg-load-sentinel { height:1px; } #FutGalleryPanel .fg-summary { text-align:right; }
    #FutGalleryPanel .fg-player-sort { width:120px; }
    #FutGalleryPanel .fg-sort-direction { width:38px; height:38px; padding:0; flex:none; font-size:22px; }
    @container (max-width:850px) { #FutGalleryPanel .fg-layout { grid-template-columns:200px minmax(0,1fr); } #FutGalleryPanel .fg-workspace { padding:18px; } #FutGalleryPanel .fg-score-band { grid-template-columns:65px repeat(3,minmax(0,1fr)); gap:8px; } #FutGalleryPanel .fg-stat strong { font-size:19px; } }
    @container (max-width:620px) { #FutGalleryPanel .fg-header { padding:16px; flex-wrap:wrap; } #FutGalleryPanel .fg-layout { display:block; } #FutGalleryPanel .fg-rail { border-right:0; border-bottom:1px solid var(--fg-line); padding:12px; } #FutGalleryPanel .fg-filters { grid-template-columns:1fr 1fr; padding:0 0 10px; } #FutGalleryPanel .fg-set-list { display:flex; overflow-x:auto; max-height:none; gap:6px; } #FutGalleryPanel .fg-set { min-width:150px; width:150px; flex-shrink:0; padding:8px; } #FutGalleryPanel .fg-workspace { padding:16px 12px; } #FutGalleryPanel .fg-set-heading { display:block; } #FutGalleryPanel .fg-summary { text-align:left; margin-top:8px; } #FutGalleryPanel .fg-score-band { grid-template-columns:50px repeat(3,minmax(0,1fr)); gap:6px; } #FutGalleryPanel .fg-stat strong { font-size:17px; } #FutGalleryPanel .fg-grade { font-size:36px; } #FutGalleryPanel .fg-rung { padding:8px 4px; } #FutGalleryPanel .fg-rung span { font-size:10px; } #FutGalleryPanel .fg-rung small { font-size:10px; } #FutGalleryPanel .fg-lineup { grid-template-columns:repeat(auto-fill,minmax(125px,1fr)); } #FutGalleryPanel .fg-toolbar { gap:8px; } #FutGalleryPanel .fg-player-search { max-width:none; } }
  `;
  style.textContent += `
    #FutGalleryPanel .fg-header { flex:none; }
    #FutGalleryPanel .fg-header-title { min-width:0; }
    #FutGalleryPanel .fg-header-title h2 { font-size:18px; overflow-wrap:anywhere; }
    #FutGalleryPanel .fg-header-title .fg-icons { margin:0; flex:none; }
    #FutGalleryPanel .fg-layout { flex:1; min-height:0; overflow:hidden; }
    #FutGalleryPanel .fg-rail,#FutGalleryPanel .fg-workspace { min-height:0; overflow:auto; overscroll-behavior:contain; }
    #FutGalleryPanel .fg-set-list { max-height:none; overflow:visible; }
    #FutGalleryPanel .fg-requirements { flex:none; padding:10px 20px; border-top:1px solid var(--fg-line); background:var(--fg-bg); font-size:12px; overflow-wrap:anywhere; }
    #FutGalleryPanel .fg-browser { flex:1; min-height:0; overflow:auto; }
    @container (max-width:620px) { #FutGalleryPanel .fg-layout { display:grid; grid-template-columns:minmax(0,1fr); grid-template-rows:minmax(100px,25%) minmax(0,1fr); } #FutGalleryPanel .fg-set-list { overflow-x:auto; } }
    #FutGalleryPanel .fg-score-band { grid-template-columns:repeat(auto-fit,minmax(min(130px,100%),1fr)); }
    #FutGalleryPanel .fg-stat { min-width:0; }
    #FutGalleryPanel .fg-purchase-detail { display:block; }
    #FutGalleryPanel .fg-header { position:sticky; top:0; z-index:3; padding:10px 20px; gap:16px; flex-wrap:wrap; }
    #FutGalleryPanel .fg-header .fg-navigation,#FutGalleryPanel .fg-browser-main > .fg-toolbar > .fg-navigation { padding:0; border:0; margin-right:auto; flex-shrink:0; }
    #FutGalleryPanel .fg-header .fg-navigation { margin-right:0; }
    #FutGalleryPanel .fg-header [data-summary] { margin-left:auto; }
    #FutGalleryPanel .fg-header [data-summary] { font-size:11px; }
    #FutGalleryPanel .fg-browser { padding:0 20px; display:grid; grid-template-columns:minmax(0,1fr); align-items:start; }
    #FutGalleryPanel .fg-browser-grid { align-content:start; }
    #FutGalleryPanel .fg-browser-main > .fg-toolbar { position:sticky; top:0; z-index:3; background:var(--fg-bg); padding:12px 0; border-bottom:1px solid var(--fg-line); margin:0 0 12px; gap:8px; }
    #FutGalleryPanel .fg-browser-search { max-width:260px; width:220px; flex:0 1 220px; }
    #FutGalleryPanel .fg-browser-main > .fg-status { min-height:0; margin:4px 0 12px; }
    #CollectionBookPanel .collection-book-card > * { pointer-events:none; }
    #FutGalleryPanel .fg-player-media[role=button] { cursor:pointer; }
    #FutGalleryPanel .fg-player-media[role=button] > * { pointer-events:none; }
    @container (max-width:620px) { #FutGalleryPanel .fg-browser { display:block; padding:16px 12px; } #FutGalleryPanel .fg-stats-page { padding:14px; } #FutGalleryPanel .fg-overview-stats { grid-template-columns:repeat(2,minmax(0,1fr)); column-gap:14px; } #FutGalleryPanel .fg-grade-summary { gap:3px; } }
    @container (max-width:620px) { #FutGalleryPanel .fg-lineup { grid-template-columns:repeat(auto-fill,minmax(min(146px,100%),1fr)); } }
  `;
  document.head.appendChild(style);
};

const futGalleryCreateNativeItem = (player, { concept = !player?.available } = {}) => {
  const source = player?.entity || player;
  if (!source || typeof UTItemEntity !== "function") return null;
  const item = new UTItemEntity(source);
  const sourceStatic = source.getStaticData?.() || source._staticData || {};
  const existingName = value => value && value !== "---" ? value : "";
  let staticData = sourceStatic;
  const hasDisplayName = existingName(staticData.name) || existingName(staticData.knownAs);
  if (!hasDisplayName && typeof UTStaticPlayerItemDataDTO === "function") {
    staticData = new UTStaticPlayerItemDataDTO();
    staticData.generateNameData(
      existingName(sourceStatic.firstName),
      existingName(sourceStatic.lastName),
      existingName(sourceStatic.knownAs) || existingName(player?.name),
    );
  }
  item.setStaticData?.(staticData);
  item.authenticity = source.authenticity;
  item.cosmetics = source.cosmetics;
  item._hyperCosmeticDTOs = source._hyperCosmeticDTOs || {};
  item.holographicType = source.holographicType || null;
  if (!(Number(source.loans) >= 0) || source.loans == null) {
    item.loans = -1;
    item.limitedUseType = Number(source.limitedUseType) > 1 ? source.limitedUseType : globalThis.LimitedUseType?.NONE ?? 0;
    item.endTime = source.endTime ?? -1;
  }
  item.concept = concept;
  return item;
};

const futGalleryOpenPlayerDetails = (root, player) => {
  const owner = root.__galleryController;
  if (!owner) return;
  const controller = new UTItemDetailsNavigationController();
  const item = futGalleryCreateNativeItem(player);
  if (!item) return;
  root.__galleryCloseDetails?.({ keepPanelOpen: true });
  controller.initWithIterator(new EAIterator([item]));
  controller.enableSwiping(false);
  owner.addChildViewController(controller);
  owner.hideRightPanel(false);
  owner.setRightController(controller);
  controller.setNavigationStyle(UTNavigationBarView.Style.SECONDARY);
  const panelRoot = controller.getView()?.getRootElement?.();
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "×";
  closeButton.title = "Close player details";
  closeButton.setAttribute("aria-label", "Close player details");
  closeButton.style.cssText = "position:absolute;top:8px;right:8px;z-index:10;width:32px;height:32px;padding:0;border:0;border-radius:4px;background:#303638;color:#fff;font-size:22px;line-height:1;cursor:pointer";
  panelRoot?.appendChild(closeButton);
  const onOutsidePointerDown = event => {
    const path = event.composedPath?.() || [];
    if (path.includes(panelRoot) || panelRoot?.contains?.(event.target)) return;
    if (event.target?.closest?.(".fg-player-media") || path.some(node => node?.classList?.contains?.("fg-player-media"))) return;
    if (!root.contains?.(event.target) && !path.includes(root)) return;
    root.__galleryCloseDetails?.();
  };
  root.__galleryCloseDetails = ({ keepPanelOpen = false } = {}) => {
    root.__galleryCloseDetails = null;
    document.removeEventListener("pointerdown", onOutsidePointerDown, true);
    closeButton.remove();
    if (!keepPanelOpen) owner.hideRightPanel(true);
    owner.removeRightController();
    owner.leftController?.getView().addClass(enums.UILayout.LEFT);
    owner.removeChildViewController(controller);
    controller.dealloc();
  };
  closeButton.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    root.__galleryCloseDetails?.();
  });
  document.addEventListener("pointerdown", onOutsidePointerDown, true);
};

const futGalleryAutoComplete = async (item, tags, candidates, source, grade, options = {}) => {
  const requirement = futGalleryEligibility(item, tags);
  if (!requirement.matches) throw new Error(requirement.error || "Unsupported set requirements");
  const pool = candidates.filter(requirement.matches).filter(player => source !== "club" || player.available);
  const target = item.grades.find(value => value.name === grade)?.threshold;
  if (!Number.isFinite(target)) throw new Error("Unknown Gallery grade");

  const clubPool = pool.filter(player => player.available);
  const clubResult = await futGalleryOptimize(item, tags, clubPool, {
    ...options,
    target: null,
  });
  if (!clubResult || options.cancelled?.()) return null;
  const clubOutcome = futGalleryEvaluate(item, tags, clubResult.players);
  const clubPlan = {
    ...clubResult,
    reached: clubOutcome.complete && clubOutcome.totalScore >= target,
    grade: clubOutcome.grade,
    cost: 0,
    missing: [],
    unpriced: 0,
    usedConcepts: false,
  };
  if (clubPlan.reached || source === "club") return clubPlan;

  const conceptPlan = await futGalleryCheapest(item, tags, pool, grade, options);
  if (!conceptPlan) return null;
  const outcome = futGalleryEvaluate(item, tags, conceptPlan.players);
  return { ...conceptPlan, grade: outcome.grade || grade, usedConcepts: conceptPlan.missing.length > 0 };
};

const futGalleryShowAutoComplete = (root, grades, run, stop) => {
  const owner = root.__galleryController;
  if (!owner) return;
  root.__galleryCloseAutoComplete?.();
  const ModalView = function () { EAView.call(this); };
  JSUtils.inherits(ModalView, EAView);
  ModalView.prototype._generate = function () {
    this.__root = document.createElement("section");
    this.__root.className = "ut-content fg-autocomplete-modal";
    this.__root.setAttribute("role", "dialog");
    this.__root.setAttribute("aria-label", "Auto complete all");
    this.__root.innerHTML = `<h2>Auto complete all</h2><form><div class="fg-autocomplete-progress"><progress max="1" value="0" aria-label="Sets calculated"></progress><p role="status" aria-live="polite">Ready</p></div><div class="fg-autocomplete-choice"><span class="fg-autocomplete-choice-label">Players</span><input type="hidden" name="source" value="club"><div class="fg-autocomplete-segmented" role="group" aria-label="Players"><button type="button" data-source="club" aria-pressed="true">Club</button><button type="button" data-source="concepts" aria-pressed="false">Club + concepts</button></div></div><div class="fg-autocomplete-choice"><span class="fg-autocomplete-choice-label">Target grade</span><input type="hidden" name="grade"><div class="fg-autocomplete-segmented" data-grade-options role="group" aria-label="Target grade"></div></div><div class="fg-autocomplete-actions"><button type="submit">Start</button><button type="button" data-close>Close</button></div></form>`;
    this._generated = true;
  };
  const controller = new EAViewController();
  controller._getViewInstanceFromData = () => new ModalView();
  controller.init();
  controller.modalDisplayStyle = "form";
  controller.modalDisplayDimensions = { width: "480px", height: "auto", maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100vh - 32px)" };
  controller.modalCanDismissFromShield = false;
  const view = controller.getView().getRootElement();
  const form = view.querySelector("form");
  const gradeInput = form.elements.grade;
  const gradeOptions = view.querySelector("[data-grade-options]");
  for (const grade of grades) {
    const option = document.createElement("button"); option.type = "button"; option.dataset.grade = grade; option.textContent = grade; option.setAttribute("aria-pressed", "false"); gradeOptions.append(option);
  }
  gradeInput.value = grades.includes("S") ? "S" : grades[grades.length - 1];
  const updatePressed = (group, attribute, value) => group.querySelectorAll("button").forEach(button => button.setAttribute("aria-pressed", String(button.dataset[attribute] === value)));
  updatePressed(gradeOptions, "grade", gradeInput.value);
  view.querySelectorAll("[data-source]").forEach(button => { button.onclick = () => { form.elements.source.value = button.dataset.source; updatePressed(view.querySelector('[aria-label="Players"]'), "source", button.dataset.source); }; });
  gradeOptions.querySelectorAll("[data-grade]").forEach(button => { button.onclick = () => { gradeInput.value = button.dataset.grade; updatePressed(gradeOptions, "grade", button.dataset.grade); }; });
  const close = view.querySelector("[data-close]");
  let running = false;
  let closed = false;
  controller.viewWillDisappear = function () {
    EAViewController.prototype.viewWillDisappear.call(this);
    if (!closed) {
      closed = true; if (running) stop(); root.__galleryCloseAutoComplete = null;
    }
  };
  root.__galleryCloseAutoComplete = () => {
    if (closed) return;
    closed = true; if (running) stop(); root.__galleryCloseAutoComplete = null;
    owner.dismissViewController(false, () => controller.dealloc());
  };
  close.onclick = () => { if (running) stop(); else root.__galleryCloseAutoComplete?.(); };
  form.onsubmit = async event => {
    event.preventDefault();
    if (running) return;
    running = true; close.textContent = "Stop";
    form.querySelectorAll(".fg-autocomplete-segmented button,button[type=submit]").forEach(control => { control.disabled = true; });
    const update = (completed, total, text) => {
      if (closed) return;
      const progress = view.querySelector("progress"); progress.max = Math.max(1, total); progress.value = completed;
      view.querySelector('[role="status"]').textContent = text;
    };
    try { await run(form.elements.source.value, gradeInput.value, update); }
    catch (error) { update(0, 1, `Calculation failed: ${error.message}`); }
    finally {
      running = false;
      if (!closed) {
        close.textContent = "Close";
        form.querySelectorAll(".fg-autocomplete-segmented button,button[type=submit]").forEach(control => { control.disabled = false; });
      }
    }
  };
  owner.presentViewController(controller, true);
};

const futGalleryRewardJobs = new Map();
const futGalleryShowRewardPlan = (root, currency, catalogue, candidates, save, currentSolutions = {}) => {
  const owner = root.__galleryController;
  if (!owner) return;
  const existingJob = futGalleryRewardJobs.get(currency);
  if (existingJob) { existingJob.show(owner, save); return; }
  root.__galleryCloseRewardPlan?.();
  const title = currency === "gems" ? "Maximise gems" : "Maximise tokens";
  const ModalView = function () { EAView.call(this); };
  JSUtils.inherits(ModalView, EAView);
  ModalView.prototype._generate = function () {
    this.__root = document.createElement("section");
    this.__root.className = "ut-content fg-autocomplete-modal";
    this.__root.setAttribute("role", "dialog");
    this.__root.setAttribute("aria-label", title);
    this.__root.classList.add("fg-reward-modal");
    this.__root.innerHTML = `<h2></h2><form><label>Coin budget<input name="budget" type="number" min="0" step="1" placeholder="Enter coin budget" required></label><div class="fg-autocomplete-progress"><progress max="1" value="0" aria-label="Sets calculated"></progress><p role="status" aria-live="polite">Ready</p></div><div class="fg-autocomplete-actions"><button type="submit">Calculate</button><button type="button" data-save disabled>Save lineups</button><button type="button" data-close>Close</button></div></form><div data-result></div>`;
    this._generated = true;
  };
  const controller = new EAViewController();
  controller._getViewInstanceFromData = () => new ModalView();
  controller.init();
  controller.modalDisplayStyle = "form";
  controller.modalDisplayDimensions = { width: "600px", height: "auto", maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100vh - 32px)" };
  controller.modalCanDismissFromShield = false;
  const view = controller.getView().getRootElement();
  view.querySelector("h2").textContent = title;
  const form = view.querySelector("form");
  const coins = globalThis.services?.User?.getUser?.()?.coins;
  const balance = Number(coins?.amount ?? coins);
  if (Number.isFinite(balance) && balance >= 0) form.elements.budget.value = balance;
  const status = view.querySelector('[role="status"]');
  const progress = view.querySelector("progress");
  const logLine = document.createElement("p");
  logLine.className = "fg-planner-log";
  logLine.setAttribute("role", "log");
  logLine.setAttribute("aria-live", "polite");
  status.after(logLine);
  const results = view.querySelector("[data-result]");
  const backgroundProgress = document.createElement("section");
  backgroundProgress.className = "fg-reward-background-progress";
  backgroundProgress.hidden = true;
  backgroundProgress.innerHTML = `<div><strong></strong><button type="button">Open</button></div><progress max="1" value="0" aria-label="Sets calculated"></progress><p role="status" aria-live="polite"></p>`;
  root.prepend(backgroundProgress);
  const backgroundTitle = backgroundProgress.querySelector("strong");
  const backgroundProgressBar = backgroundProgress.querySelector("progress");
  const backgroundStatus = backgroundProgress.querySelector('[role="status"]');
  const close = view.querySelector("[data-close]");
  const saveButton = view.querySelector("[data-save]");
  let closed = false;
  let running = false;
  let stopped = false;
  let result = null;
  let background = false;
  const updateBackgroundProgress = message => {
    if (!background) return;
    backgroundTitle.textContent = `${title} calculation`;
    backgroundStatus.textContent = message || status.textContent;
    backgroundProgressBar.max = progress.max;
    backgroundProgressBar.value = progress.value;
  };
  let modalOwner = owner;
  let savePlans = save;
  const job = {
    show(nextOwner, nextSave) {
      if (!background || closed) return;
      modalOwner = nextOwner;
      savePlans = nextSave;
      background = false;
      backgroundProgress.hidden = true;
      modalOwner.presentViewController(controller, false);
    },
  };
  const minimise = () => {
    if (background || closed) return;
    background = true;
    backgroundProgress.hidden = false;
    updateBackgroundProgress(status.textContent);
    modalOwner.dismissViewController(false);
  };
  const backgroundButton = document.createElement("button");
  backgroundButton.type = "button";
  backgroundButton.textContent = "Run in background";
  backgroundButton.onclick = minimise;
  view.querySelector(".fg-autocomplete-actions").append(backgroundButton);
  backgroundProgress.querySelector("button").onclick = () => job.show(modalOwner, savePlans);
  root.__galleryCloseRewardPlan = () => {
    if (background) return;
    if (closed) return;
    closed = true; stopped = true; root.__galleryCloseRewardPlan = null;
    futGalleryRewardJobs.delete(currency);
    backgroundProgress.remove();
    modalOwner.dismissViewController(false, () => controller.dealloc());
  };
  controller.viewWillDisappear = function () {
    EAViewController.prototype.viewWillDisappear.call(this);
    if (background) return;
    closed = true; stopped = true; root.__galleryCloseRewardPlan = null;
    futGalleryRewardJobs.delete(currency);
    backgroundProgress.remove();
  };
  close.onclick = () => { if (running) { stopped = true; status.textContent = "Stopping..."; } else root.__galleryCloseRewardPlan?.(); };
  saveButton.onclick = () => { if (result) { savePlans(result); status.textContent = "Recommended lineups saved"; } };
  form.onsubmit = async event => {
    event.preventDefault();
    if (running) return;
    running = true; stopped = false; result = null;
    futGalleryRewardJobs.set(currency, job);
    results.replaceChildren(); saveButton.disabled = true; close.textContent = "Stop";
    form.querySelector('[type="submit"]').disabled = true;
    const format = value => Number(value || 0).toLocaleString();
    progress.max = Math.max(1, catalogue.sets.length);
    progress.value = 0;
    status.textContent = "Preparing cached player prices...";
    const startedAt = Date.now();
    let stage = "Preparing players";
    const updateLog = () => {
      if (!closed) logLine.textContent = `${stage} | ${Math.floor((Date.now() - startedAt) / 1000)}s elapsed`;
    };
    updateLog();
    const logTimer = setInterval(updateLog, 1000);
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      const pool = candidates.map(player => ({ ...player, available: player.available === true, firstOwner: player.available === true && player.firstOwner }));
      result = await futGalleryPlanRewards(catalogue.sets, catalogue.tags, pool, currency, Number(form.elements.budget.value), {
        currentSolutions,
        portfolioSolver: async payload => {
          const response = await fetch(apiUrl + "/api/gallery/optimise", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload), signal: AbortSignal.timeout(60000),
          });
          if (!response.ok) throw new Error(`Gallery backend: HTTP ${response.status}`);
          return response.json();
        },
        cancelled: () => stopped || closed,
        progress: (completed, total, name) => {
          if (closed) return;
          progress.max = Math.max(1, total); progress.value = completed;
          status.textContent = `${completed} / ${total}: ${name}`;
          stage = name;
          updateLog();
          updateBackgroundProgress(status.textContent);
        },
      });
      if (closed) return;
      if (!result) { status.textContent = "Calculation stopped"; return; }
      status.textContent = `${format(result.reward)} ${currency} from ${result.sets.length} complete sets | ${format(result.cost)} coins | ${format(result.remaining)} remaining. ${result.choiceCount} alternatives across ${result.evaluatedSets} sets. CP-SAT ${result.solverStatus}; ${result.exhaustive ? "exhaustive candidate search" : "bounded candidate search, not a global optimality proof"}.`;
      progress.value = progress.max;
      updateBackgroundProgress(status.textContent);
      if (!result.reward) results.textContent = "No complete sets found within this budget.";
      for (const choice of result.sets) {
        const section = document.createElement("section"); section.style.padding = "12px 0";
        const heading = document.createElement("h3"); heading.textContent = `${choice.set.name} | Grade ${choice.grade} | ${format(choice.reward)} ${currency}`;
        const list = document.createElement("p");
        list.textContent = [...choice.purchases.values()].map(({ player, cost }) => `${player.name || player.eaId}: ${format(cost)} coins`).join(", ") || "All players in club";
        section.append(heading, list); results.append(section);
      }
      saveButton.disabled = !result.sets.length;
    } catch (error) { if (!closed) { status.textContent = `Calculation failed: ${error.message}`; updateBackgroundProgress(status.textContent); } }
    finally {
      clearInterval(logTimer);
      running = false;
      if (!closed) {
        logLine.textContent = `${stopped ? "Stopped" : result ? "Finished" : "Failed"} | ${Math.floor((Date.now() - startedAt) / 1000)}s elapsed`;
        close.textContent = "Close";
        form.querySelector('[type="submit"]').disabled = false;
        if (background && typeof showNotification === "function") {
          showNotification(`${title}: ${stopped ? "stopped" : result ? `${format(result.reward)} ${currency}; reopen ${title} for results` : "failed"}`, UINotificationType.POSITIVE);
        }
      }
    }
  };
  owner.presentViewController(controller, false);
};

const futGalleryMountPage = async root => {
  root.__galleryDispose?.();
  futGalleryEnsureStyles();
  const lifecycle = new AbortController();
  const on = (target, event, handler) => target.addEventListener(event, handler, { signal: lifecycle.signal });
  let views = [];
  let generation = 0;
  let disposed = false;
  let poolObserver = null;
  const destroyViews = () => { poolObserver?.disconnect(); poolObserver = null; views.forEach(view => view.destroy?.()); views = []; };
  root.__galleryDispose = () => { disposed = true; generation++; lifecycle.abort(); root.__galleryCloseAutoComplete?.(); root.__galleryCloseRewardPlan?.(); root.__galleryCloseDetails?.(); root.querySelector(".fg-bonus-dialog")?.remove(); destroyViews(); };
  const number = value => Number(value || 0).toLocaleString();
  root.innerHTML = `<header class="fg-header"><div class="fg-header-title" data-set-identity hidden></div><div class="fg-summary fg-muted" data-summary>Loading requirements...</div></header><div class="fg-layout"><aside class="fg-rail" aria-label="Gallery sets"><div class="fg-filters"><input aria-label="Search sets" placeholder="Search sets"><select aria-label="Set category"><option value="">All categories</option></select></div><div class="fg-set-list"></div></aside><main class="fg-workspace"><div class="fg-empty" role="status">Loading Gallery...</div></main></div><footer class="fg-requirements" aria-label="Set requirements" hidden></footer>`;
  const workspace = root.querySelector(".fg-workspace");
  const layout = root.querySelector(".fg-layout");
  const navigation = document.createElement("nav"); navigation.className = "fg-navigation"; navigation.setAttribute("aria-label", "Gallery views");
  navigation.innerHTML = `<button type="button" data-page="overview">Overview</button><button type="button" data-page="sets">Sets</button><button type="button" data-page="categories">Categories</button>`;
  root.querySelector("[data-summary]").before(navigation);
  const browser = document.createElement("section"); browser.className = "fg-browser"; layout.before(browser);
  let catalogue;
  try { catalogue = await futGalleryLoadCatalogue(); } catch (error) {
    if (disposed) return;
    workspace.innerHTML = `<div class="fg-empty fg-error" role="alert">Gallery requirements could not be loaded.<br><button type="button">Retry</button></div>`;
    root.querySelector("[data-summary]").textContent = "Connection unavailable";
    on(workspace.querySelector("button"), "click", () => futGalleryMountPage(root));
    return;
  }
  if (disposed) return;
  if (typeof fetchTransferList === "function") {
    try { await fetchTransferList(); }
    catch (error) { console.warn("[Gallery] Transfer-list seen refresh failed", error); }
  }
  if (disposed) return;
  let candidates = futGalleryGetCandidates();
  const enrichVariantPrices = async () => {
    const currentCandidates = candidates;
    const currentSet = set;
    if (page === "lineup") {
      const requirement = futGalleryEligibility(currentSet, catalogue.tags);
      await futGalleryEnrichMarketPrices(currentCandidates, {
        matches: requirement.matches,
        cancelled: () => disposed || candidates !== currentCandidates || set !== currentSet,
      });
      if (disposed || candidates !== currentCandidates || set !== currentSet) return;
    }
    const enriched = await futGalleryEnrichVariantPrices(currentCandidates, {
      cancelled: () => disposed || candidates !== currentCandidates || set !== currentSet,
    });
    if (!disposed && candidates === currentCandidates && set === currentSet) {
      const knownIds = new Set(currentCandidates.map(player => Number(player.eaId)));
      candidates = [...currentCandidates, ...enriched.filter(player => !knownIds.has(Number(player.eaId)))];
      renderSets();
      renderWorkspace();
      renderBrowser();
    }
  };
  let set = catalogue.sets[0];
  let mode = "club";
  let selected = [];
  let resultLabel = "";
  let busy = false;
  let buying = false;
  let refreshingPrices = false;
  let purchaseAction = "club";
  const purchasedIds = new Set();
  let playerQuery = "";
  let playerSort = "score";
  let playerSortAscending = false;
  let visibleLimit = 36;
  let page = "overview";
  let overviewSort = "gems";
  let overviewSortAscending = false;
  let overviewCompletedOnly = false;
  let hideCompletedSets = false;
  let browserQuery = "";
  let batchRunning = false;
  let batchGeneration = 0;
  let batchStatus = "";
  let targetGrade = null;
  let plans = {};
  try { plans = JSON.parse(localStorage.getItem("futGallery.lineups.v1") || "{}"); if (!plans || typeof plans !== "object" || Array.isArray(plans)) plans = {}; } catch {}
  if (futGalleryPruneTimedLoanPlans(plans, candidates)) {
    try { localStorage.setItem("futGallery.lineups.v1", JSON.stringify(plans)); } catch {}
  }
  const savePlan = (item, players, optimal, completion = null) => {
    plans[item.id] = { ids: players.map(player => player.eaId), optimal, completion };
    try { localStorage.setItem("futGallery.lineups.v1", JSON.stringify(plans)); } catch {}
  };
  const icons = item => {
    const group = document.createElement("div"); group.className = "fg-icons";
    for (const url of futGalleryIconUrls(item)) {
      const image = document.createElement("img"); image.src = url; image.alt = ""; image.loading = "lazy"; image.onerror = () => { image.hidden = true; }; group.append(image);
    }
    return group;
  };
  const openSet = item => {
    if (buying || refreshingPrices || batchRunning) return;
    root.__galleryCloseDetails?.();
    generation++; busy = false; set = item; targetGrade = null;
    const savedPlan = plans[item.id];
    const ids = new Set(savedPlan?.ids || []);
    const requirement = futGalleryEligibility(item, catalogue.tags);
    candidates = futGalleryUsableSetPlayers(candidates);
    selected = candidates.filter(player => ids.has(player.eaId) && requirement.matches?.(player)).slice(0, item.requiredCards);
    if (selected.length !== ids.size) savePlan(item, selected, savedPlan?.optimal ?? false, savedPlan?.completion ?? null);
    resultLabel = selected.length ? "Saved lineup" : ""; playerQuery = ""; visibleLimit = 36;
    page = "lineup"; renderSets(); renderWorkspace(); renderBrowser();
    enrichVariantPrices();
  };
  const renderBrowser = () => {
    layout.hidden = page !== "lineup";
    browser.hidden = page === "lineup";
    const header = root.querySelector(".fg-header");
    header.hidden = page !== "lineup";
    root.querySelector(".fg-requirements").hidden = page !== "lineup" || !set;
    if (page === "lineup") header.prepend(navigation);
    navigation.querySelectorAll("[data-page]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.page === (page === "lineup" ? "overview" : page)));
      button.disabled = buying || refreshingPrices;
    });
    if (page === "lineup") return;
    const summaries = catalogue.sets.map(item => {
      const requirement = futGalleryEligibility(item, catalogue.tags);
      const pool = requirement.matches ? candidates.filter(requirement.matches).filter(player => player.available) : [];
      const ids = plans[item.id]?.ids;
      const players = ids ? candidates.filter(player => ids.includes(player.eaId) && requirement.matches?.(player)).slice(0, item.requiredCards) : [...pool].sort((left, right) => (right.score || 0) - (left.score || 0)).slice(0, item.requiredCards);
      const entry = { item, pool, players, filled: players.length, outcome: futGalleryEvaluate(item, catalogue.tags, players), planned: !!ids, error: requirement.error };
      if (page === "sets") entry.coinsToComplete = futGalleryCompletionCost(entry, candidates, requirement.matches);
      return entry;
    });
    browser.innerHTML = `<div class="fg-browser-main"><div class="fg-toolbar"><input class="fg-browser-search" aria-label="Search Gallery" placeholder="Search Gallery"><button type="button" data-complete-all>${batchRunning ? "Stop" : "Auto complete all"}</button></div><p class="fg-status" role="status" aria-live="polite"></p>${page === "overview" ? `<section class="fg-stats-page" aria-label="Gallery statistics"><div class="fg-stats-heading"><div><span>CLUB COLLECTION</span><h2>Gallery stats</h2></div><strong class="fg-stats-count"></strong></div><div class="fg-grade-summary" aria-label="Completed sets by grade"></div><div class="fg-overview-stats"></div></section>` : ""}<div class="fg-browser-grid"></div></div>`;
    browser.setAttribute("aria-label", page === "categories" ? "Categories" : page === "sets" ? "Sets" : "Gallery overview");
    browser.querySelector(".fg-toolbar").prepend(navigation);
    browser.querySelector("input").value = browserQuery;
    if (page === "overview" || page === "sets") {
      const controls = document.createElement("div");
      controls.innerHTML = `<select class="fg-player-sort" data-overview-sort aria-label="Sort sets"><option value="completion">% completed</option><option value="gems">Gems</option><option value="name">Alphabetical</option></select><button type="button" class="fg-sort-direction" data-overview-direction></button><div class="fg-mode" role="group" aria-label="Filter overview"${page === "sets" ? " hidden" : ""}><button type="button" data-overview-filter="all">All</button><button type="button" data-overview-filter="completed" title="All required slots filled with owned or previously seen players">Completed</button></div>`;
      const sortSelect = controls.querySelector("[data-overview-sort]"); sortSelect.value = overviewSort;
      if (page === "sets") {
        const option = document.createElement("option"); option.value = "coins"; option.textContent = "Coins to complete"; sortSelect.append(option);
        sortSelect.value = overviewSort;
        const toggle = document.createElement("label"); toggle.className = "fg-hide-completed";
        const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = hideCompletedSets;
        checkbox.onchange = () => { hideCompletedSets = checkbox.checked; renderBrowser(); };
        toggle.append(checkbox, document.createTextNode("Hide completed")); controls.append(toggle);
      }
      sortSelect.onchange = () => { overviewSort = sortSelect.value; if (overviewSort === "coins") overviewSortAscending = true; renderBrowser(); };
      const direction = controls.querySelector("[data-overview-direction]");
      direction.innerHTML = overviewSortAscending ? "&#8593;" : "&#8595;";
      direction.title = `${overviewSortAscending ? "Ascending" : "Descending"}; switch to ${overviewSortAscending ? "descending" : "ascending"}`;
      direction.setAttribute("aria-label", direction.title);
      direction.onclick = () => { overviewSortAscending = !overviewSortAscending; renderBrowser(); };
      controls.querySelectorAll("[data-overview-filter]").forEach(button => {
        button.setAttribute("aria-pressed", String((button.dataset.overviewFilter === "completed") === overviewCompletedOnly));
        button.onclick = () => { overviewCompletedOnly = button.dataset.overviewFilter === "completed"; renderBrowser(); };
      });
      browser.querySelector("[data-complete-all]").before(...controls.children);
    }
    if (page === "overview") {
      for (const currency of ["gems", "tokens"]) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = currency === "gems" ? "Maximise Gems" : "Maximise Tokens";
        button.title = `Find the most ${currency} rewards across all sets within your coin balance`;
        button.disabled = buying || batchRunning;
        button.onclick = () => futGalleryShowRewardPlan(root, currency, catalogue, candidates, result => {
          result.sets.forEach(choice => savePlan(choice.set, choice.players, false));
          renderBrowser();
        }, plans);
        browser.querySelector(".fg-toolbar").append(button);
      }
    }
    if (page === "overview") {
      const stats = futGalleryOverviewStats(summaries, candidates);
      browser.querySelector(".fg-stats-count").textContent = `${stats.completedSets} / ${stats.totalSets} complete`;
      browser.querySelector(".fg-grade-summary").innerHTML = stats.gradeCounts.map(({ name, count }) =>
        `<div class="fg-grade-total" title="${name} grade completed sets"><span class="fg-grade-icon" data-grade="${name}" aria-hidden="true">${name}</span><strong>${number(count)}</strong></div>`).join("");
      browser.querySelector(".fg-overview-stats").innerHTML = [
        ["completed-items", "Completed items", number(stats.completedItems)],
        ["gems", "Gems from completed sets", number(stats.gems)],
        ["tokens", "Tokens from completed sets", number(stats.tokens)],
        ["seen", "Seen players", number(stats.seenPlayers)],
        ["first-owned", "First-owned players", number(stats.firstOwnedPlayers)],
      ].map(([key, label, value]) => `<div class="fg-overview-stat" data-stat="${key}"><span>${label}</span><strong>${value}</strong></div>`).join("");
    }
    browser.querySelector(".fg-status").textContent = batchStatus || "Projected from club and seen players / Unplanned sets use highest base gem values";
    const renderGrid = () => {
      const grid = browser.querySelector(".fg-browser-grid"); grid.replaceChildren();
      const query = browser.querySelector("input").value.toLowerCase();
      const entries = page === "categories" ? futGalleryCategories(catalogue)
        : futGalleryOverviewEntries(summaries, overviewSort, page === "overview" && overviewCompletedOnly, overviewSortAscending, page === "sets" && hideCompletedSets);
      const coins = globalThis.services?.User?.getUser?.()?.coins;
      const balance = coins == null ? NaN : Number(coins?.amount ?? coins);
      for (const entry of entries) {
        const item = entry.item || entry;
        if (!item.name.toLowerCase().includes(query)) continue;
        const button = document.createElement("button"); button.type = "button"; button.className = "fg-browser-item"; button.disabled = buying || refreshingPrices || batchRunning;
        button.append(icons(item));
        const title = document.createElement("strong"); title.textContent = item.name; button.append(title);
        const detail = document.createElement("span"); detail.className = "fg-muted";
        if (page === "categories") {
          const children = summaries.filter(value => value.item.categorySlug === item.slug);
          detail.textContent = `${children.length} sets / ${children.filter(value => value.outcome.grade === "S").length} projected S / ${number(item.totalTokens)} tokens`;
          button.onclick = () => { category.value = item.name; browserQuery = ""; page = "sets"; renderBrowser(); };
        } else {
          if (page === "sets" && category.value && item.category !== category.value) continue;
          if (page === "sets") {
            const cost = document.createElement("strong"); cost.className = "fg-completion-cost";
            const known = Number.isFinite(entry.coinsToComplete);
            cost.textContent = known ? `${number(entry.coinsToComplete)} coins to complete` : "Cost unavailable";
            cost.title = "Estimated cost to fill remaining slots using cached prices; not a target-grade guarantee.";
            if (known && Number.isFinite(balance)) cost.classList.add(entry.coinsToComplete <= balance ? "affordable" : "over-budget");
            button.append(cost);
            const budget = document.createElement("span"); budget.className = "fg-muted";
            budget.textContent = known && Number.isFinite(balance)
              ? entry.coinsToComplete <= balance ? `${number(balance - entry.coinsToComplete)} coins left after purchase` : `${number(entry.coinsToComplete - balance)} more coins needed`
              : "Price or balance unavailable";
            button.append(budget);
          }
          detail.textContent = entry.error || `${entry.outcome.grade || "Ungraded"} / ${number(entry.outcome.totalScore)} Gems`;
          const completion = plans[item.id]?.completion;
          if (completion) {
            const cost = document.createElement("span"); cost.className = "fg-muted";
            cost.textContent = completion.reached
              ? `Grade ${completion.grade}: ~${number(completion.cost)} coins / ${completion.missing} to buy`
              : `Grade ${completion.grade}: ${completion.error || "No priced solution found"}`;
            cost.title = "Estimated from cached prices; no purchases made";
            button.append(cost);
          }
          const count = document.createElement("span"); count.className = "fg-muted";
          count.dataset.playerCount = "";
          count.textContent = `${entry.filled}/${item.requiredCards}`;
          count.title = "Players in the projected lineup, including planned concept purchases.";
          button.append(count);
          const badgeState = futGallerySetBadge(entry);
          const badge = document.createElement("span"); badge.className = `fg-remaining${badgeState.graded ? " fg-grade-icon" : ""}`;
          badge.textContent = badgeState.text;
          if (badgeState.graded) badge.dataset.grade = badgeState.text;
          badge.title = badgeState.graded ? `Projected grade ${badgeState.text}` : `${badgeState.text} projected lineup players`;
          badge.setAttribute("aria-label", badge.title);
          button.append(badge);
          const progress = document.createElement("progress"); progress.max = Math.max(...item.grades.map(grade => grade.threshold), 1); progress.value = entry.outcome.totalScore; progress.setAttribute("aria-label", `${item.name} Gems toward S`); button.append(progress);
          button.onclick = () => openSet(item);
        }
        button.append(detail); grid.append(button);
      }
      if (!grid.children.length) { const empty = document.createElement("p"); empty.className = "fg-empty"; empty.textContent = "No matching sets or categories"; grid.append(empty); }
    };
    browser.querySelector("input").oninput = event => { browserQuery = event.target.value; renderGrid(); };
    renderGrid();
    browser.querySelector("[data-complete-all]").onclick = () => {
      const stop = () => { batchGeneration++; batchRunning = false; batchStatus = "Stopped"; if (!disposed) renderBrowser(); };
      if (batchRunning) { stop(); return; }
      const grades = [...new Set(catalogue.sets.flatMap(item => item.grades.map(grade => grade.name)))];
      futGalleryShowAutoComplete(root, grades, async (source, grade, update) => {
      const run = ++batchGeneration; batchRunning = true;
      let completed = 0;
      try {
        for (const item of catalogue.sets) {
          if (disposed || run !== batchGeneration) { update(completed, catalogue.sets.length, "Stopped"); return; }
          batchStatus = `${completed} / ${catalogue.sets.length} calculated: ${item.name}`; renderBrowser();
          update(completed, catalogue.sets.length, batchStatus);
          try {
            const result = await futGalleryAutoComplete(item, catalogue.tags, candidates, source, grade, { maxChecks: 10000, cancelled: () => disposed || run !== batchGeneration });
            if (!result || disposed || run !== batchGeneration) { update(completed, catalogue.sets.length, "Stopped"); return; }
            savePlan(item, result.players, result.optimal, { source, grade: result.grade || grade, reached: result.reached, cost: result.cost, missing: result.missing.length });
          } catch (error) {
            savePlan(item, [], false, { source, grade, reached: false, error: error.message });
          }
          completed++;
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        batchStatus = `${completed} sets calculated / Lineups saved / No purchases or rewards claimed`;
        update(completed, catalogue.sets.length, batchStatus);
      } catch (error) { batchStatus = `Calculation failed: ${error.message}`; }
      finally { if (run === batchGeneration) { batchRunning = false; if (!disposed) renderBrowser(); } }
      }, stop);
    };
  };
  navigation.querySelectorAll("[data-page]").forEach(button => {
    button.onclick = () => { generation++; busy = false; page = button.dataset.page; if (page !== "sets") { category.value = ""; if (overviewSort === "coins") overviewSort = "gems"; } renderBrowser(); };
  });
  const search = root.querySelector('[aria-label="Search sets"]');
  const category = root.querySelector('[aria-label="Set category"]');
  for (const name of new Set(catalogue.sets.map(item => item.category))) {
    const option = document.createElement("option"); option.textContent = name; option.value = name; category.appendChild(option);
  }
  const eligible = () => {
    const requirement = futGalleryEligibility(set, catalogue.tags);
    return { ...requirement, players: requirement.matches ? candidates.filter(requirement.matches).filter(player => mode !== "club" || player.available) : [] };
  };
  const renderSets = () => {
    const list = root.querySelector(".fg-set-list"); list.replaceChildren();
    const filtered = catalogue.sets.filter(item => (!category.value || item.category === category.value) && item.name.toLowerCase().includes(search.value.toLowerCase()));
    for (const item of filtered) {
      const button = document.createElement("button"); button.type = "button"; button.className = "fg-set";
      button.setAttribute("aria-pressed", String(item.id === set?.id));
      const displayedIds = item.id === set?.id && page === "lineup" ? selected.map(player => player.eaId) : plans[item.id]?.ids ?? null;
      const summary = futGallerySetSidebarSummary(item, catalogue.tags, candidates, displayedIds);
      const title = document.createElement("strong"); title.textContent = item.name;
      if (summary.grade) {
        const badge = document.createElement("span"); badge.className = "fg-grade-icon fg-set-grade";
        badge.dataset.grade = summary.grade; badge.textContent = summary.grade;
        badge.title = `Achieved ${summary.grade} grade`;
        title.append(badge);
      }
      const rewards = `${number(summary.tokens)} tokens${summary.complete ? ` / ${number(summary.gems)} gems` : ""}`;
      const subtitle = document.createElement("span"); subtitle.textContent = `${item.requiredCards} players / ${rewards}`;
      button.append(title, subtitle);
      button.prepend(icons(item));
      button.disabled = buying;
      button.onclick = () => openSet(item);
      list.appendChild(button);
    }
    if (!filtered.length) list.innerHTML = `<div class="fg-empty">No matching sets</div>`;
  };
  const playerTile = (player, picked, lineupOutcome = null, lineupPlayers = [], bonusInteraction = null) => {
    const tile = document.createElement("article"); tile.className = `fg-player${player.holographicType === "pristine" ? " pristine" : ""}`;
    tile.dataset.playerId = String(player.eaId);
    if (player.holographicType === "pristine") tile.dataset.variant = "pristine";
    tile.innerHTML = `<div class="fg-player-media"></div><div class="fg-player-info"><strong></strong><div class="fg-gems"></div></div><button type="button" class="fg-player-action"></button>`;
    const playerName = tile.querySelector("strong");
    playerName.textContent = player.name;
    playerName.title = player.name;
    const gems = tile.querySelector(".fg-gems");
    if (player.score === null) {
      gems.textContent = "Gem value unavailable";
    } else {
      gems.setAttribute("aria-label", `${number(player.score)} Gems`);
      gems.append(futGalleryCreateGemIcon(), document.createTextNode(number(player.score)));
      const contribution = picked && lineupOutcome
        ? futGalleryPlayerTagBonus(lineupOutcome, lineupPlayers, player.eaId)
        : { total: 0, tags: [] };
      if (contribution.total > 0) {
        const bonus = document.createElement("span"); bonus.className = "fg-gems-bonus";
        bonus.textContent = `+${number(contribution.total)} gems`;
        bonus.title = contribution.tags.map(tag => `${tag.name}: +${number(tag.bonus)} Gems`).join(" / ");
        bonus.setAttribute("aria-label", `Tag bonus +${number(contribution.total)} Gems`);
        gems.append(bonus);
      }
    }
    if (picked && bonusInteraction) {
      tile.addEventListener("mouseenter", () => bonusInteraction.player(player));
      tile.addEventListener("mouseleave", bonusInteraction.clear);
      tile.addEventListener("focusin", () => bonusInteraction.player(player));
      tile.addEventListener("focusout", event => {
        if (!tile.contains(event.relatedTarget)) bonusInteraction.clear();
      });
    }
    const media = tile.querySelector(".fg-player-media");
    media.tabIndex = 0;
    media.setAttribute("role", "button");
    media.setAttribute("aria-label", `View ${player.name}`);
    media.addEventListener("click", event => {
      event.preventDefault(); event.stopImmediatePropagation();
      futGalleryOpenPlayerDetails(root, player);
    }, true);
    media.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault(); event.stopImmediatePropagation();
      futGalleryOpenPlayerDetails(root, player);
    }, true);
    try {
      const copy = futGalleryCreateNativeItem(player);
      if (!copy) throw new Error("EA player item is unavailable");
      const view = UTItemViewFactory.createLargeItem(copy);
      view.init?.(); view.render(copy);
      view._bottomLeftStatusIndicator?.reset?.();
      const element = view.getRootElement(); element.classList.add("fg-native"); media.appendChild(element); views.push(view); tile.__galleryView = view;
      playerName.remove();
    } catch {
      const image = document.createElement("img"); image.alt = ""; image.loading = "lazy";
      image.src = globalThis.AssetLocationUtils?.getPortraitUri?.(player.entity) || "";
      image.onerror = () => { image.remove(); };
      media.appendChild(image);
      const rating = document.createElement("span"); rating.className = "fg-fallback-rating"; rating.textContent = `${player.rating} ${player.positions[0] || ""}`; media.appendChild(rating);
    }
    const action = tile.querySelector("button"); action.textContent = picked ? "-" : "+";
    action.title = `${picked ? "Remove" : "Add"} ${player.name}`; action.setAttribute("aria-label", action.title);
    action.disabled = busy || buying || refreshingPrices || (!picked && (selected.length >= set.requiredCards || player.score === null));
    action.onclick = () => { selected = picked ? selected.filter(item => item.eaId !== player.eaId) : [...selected, player]; resultLabel = "Manual selection"; renderWorkspace(); };
    return tile;
  };
  const renderWorkspace = () => {
    if (disposed) return;
    const scrollTop = workspace.scrollTop;
    destroyViews();
    const identity = root.querySelector("[data-set-identity]");
    const requirements = root.querySelector(".fg-requirements");
    identity.replaceChildren();
    identity.hidden = page !== "lineup" || !set;
    requirements.hidden = page !== "lineup" || !set;
    if (set) {
      const heading = document.createElement("h2");
      heading.textContent = set.name;
      const categoryLabel = document.createElement("span");
      categoryLabel.className = "fg-header-category";
      categoryLabel.textContent = set.category;
      const rewards = document.createElement("div");
      rewards.className = "fg-header-rewards";
      rewards.innerHTML = `<strong class="fg-accent" data-set-rewards></strong><span class="fg-muted">Projected tokens</span>`;
      const setIcons = [icons(set)];
      if (set.categorySlug === "leagues" && set.clubEaId) setIcons.push(icons(set, { leagueOnly: true }));
      identity.replaceChildren(...setIcons, heading, categoryLabel, rewards);
      requirements.textContent = `${set.description || ""} | Set ID: ${set.id} | Category ID: ${set.categoryId ?? "unknown"} | Club EA ID: ${set.clubEaId ?? "not supplied"} | League requirement: ${set.categorySlug === "leagues" ? set.name : "not supplied by FUT.GG"} | ${set.requiredCards} players | ${set.grades.map(grade => `${grade.name}: ${number(grade.threshold)} Gems`).join(" | ")}`;
    }
    root.querySelector("[data-summary]").textContent = `${number(candidates.filter(player => player.inClub).length)} club / ${number(candidates.filter(player => player.seen && !player.inClub).length)} seen before / ${number(candidates.length)} indexed${catalogue.stale ? " / Cached requirements" : ""}`;
    if (!set) { workspace.innerHTML = `<div class="fg-empty">No Gallery sets available</div>`; return; }
    const pool = eligible();
    const rewardCandidates = futGallerySetRewardCandidates(set, catalogue.tags, candidates);
    const outcome = futGalleryEvaluate(set, catalogue.tags, selected);
    workspace.innerHTML = `<section class="fg-score-band" aria-label="Lineup Gems"><div class="fg-projected-grade"><div class="fg-grade-icon" data-projected-grade></div><div class="fg-muted">${outcome.complete ? "Projected grade" : "Incomplete"}</div></div><div class="fg-stat"><strong>${number(outcome.baseScore)}</strong><span>Base Gems</span></div><div class="fg-stat"><strong>+${number(outcome.bonusScore)}</strong><span>Tag bonus Gems</span></div><div class="fg-stat"><strong class="fg-accent">${number(outcome.totalScore)}</strong><span>Total Gems</span></div></section><div class="fg-ladder" aria-label="Grade thresholds"></div><div class="fg-status" role="status" aria-live="polite"></div>
      <div class="fg-toolbar"><h3>Your lineup <span class="fg-muted">${selected.length} / ${set.requiredCards}</span></h3><div class="fg-mode" role="group" aria-label="Player source"><button type="button" data-mode="club" aria-pressed="${mode === "club"}">Club + seen</button><button type="button" data-mode="all" aria-pressed="${mode === "all"}">All concepts</button></div><button type="button" class="fg-primary" data-solve>${busy ? "Stop search" : "Find best lineup"}</button><button type="button" data-max-reward="gems">Max Gems</button><button type="button" data-max-reward="tokens">Max Tokens</button><button type="button" data-reset title="Clear lineup" aria-label="Clear lineup">Reset</button></div><div class="fg-lineup" data-lineup></div>
      <div class="fg-toolbar"><button type="button" data-bonus-tags>Bonus tags (${outcome.bonuses.filter(tag => tag.paid).length} / ${outcome.bonuses.length})</button><div class="fg-bonus-chips" aria-label="Active bonus tags"></div><span class="fg-muted">+${number(outcome.bonusScore)} Gems</span><div class="fg-bonus-player-list" data-bonus-player-list aria-live="polite" hidden></div></div>
      <section class="fg-pool"><div class="fg-toolbar"><h3>Eligible players <span class="fg-muted">${pool.players.length}</span></h3><input class="fg-player-search" aria-label="Search eligible players" placeholder="Search players"><select class="fg-player-sort" aria-label="Sort eligible players"><option value="price">Price</option><option value="rating">Rating</option><option value="score">Gems</option></select><button type="button" class="fg-sort-direction"></button></div><div class="fg-lineup" data-candidates></div><div class="fg-load-sentinel" aria-hidden="true"></div></section>`;
    const projectedGrade = workspace.querySelector("[data-projected-grade]");
    projectedGrade.textContent = outcome.grade || "-";
    if (outcome.grade) projectedGrade.dataset.grade = outcome.grade;
    projectedGrade.setAttribute(
      "aria-label",
      outcome.complete ? `Projected grade ${outcome.grade}` : "Incomplete grade",
    );
    const purchase = futGalleryPurchaseCost(selected, purchasedIds);
    const costMetric = document.createElement("div"); costMetric.className = "fg-stat";
    costMetric.dataset.purchaseCost = "";
    costMetric.innerHTML = `<strong class="fg-accent"></strong><span>Concept purchase cost</span><span class="fg-purchase-detail"></span>`;
    costMetric.querySelector("strong").textContent = purchase.unpriced === purchase.count && purchase.unpriced > 0 ? "Unknown" : `${number(purchase.total)}${purchase.unpriced ? "+" : ""} coins`;
    costMetric.querySelector(".fg-purchase-detail").textContent = `${purchase.count} to buy${purchase.unpriced ? ` / ${purchase.unpriced} unpriced` : ""}`;
    costMetric.title = "Estimated from cached market prices; owned and previously seen players cost zero.";
    workspace.querySelector(".fg-score-band").append(costMetric);
    root.querySelector("[data-set-rewards]").textContent = `${number(outcome.tokens)} / ${number(set.totalTokens)} tokens`;
    const bonusChips = workspace.querySelector(".fg-bonus-chips");
    for (const tag of outcome.bonuses.filter(value => value.paid && value.bonus > 0)) {
      const chip = document.createElement("span"); chip.className = "fg-bonus-chip";
      chip.append(document.createTextNode(tag.name));
      const value = document.createElement("strong"); value.textContent = `+${number(tag.bonus)}`;
      chip.append(value); chip.dataset.tagId = String(tag.id); chip.title = `${tag.name}: +${number(tag.bonus)} Gems`;
      bonusChips.append(chip);
    }
    const bonusPlayerList = workspace.querySelector("[data-bonus-player-list]");
    const resetBonusHover = () => {
      bonusPlayerList.replaceChildren(); bonusPlayerList.hidden = true;
      workspace.querySelectorAll("[data-lineup] .fg-player").forEach(tile => tile.classList.remove("is-tag-match", "is-tag-dimmed"));
      bonusChips.querySelectorAll(".fg-bonus-chip").forEach(chip => {
        const tag = outcome.bonuses.find(value => String(value.id) === chip.dataset.tagId);
        chip.classList.remove("is-focused", "is-dimmed");
        chip.querySelector("strong").textContent = `+${number(tag?.bonus || 0)}`;
        chip.title = `${tag?.name || "Bonus tag"}: +${number(tag?.bonus || 0)} Gems`;
      });
    };
    const showPlayerBonus = player => {
      bonusPlayerList.replaceChildren(); bonusPlayerList.hidden = true;
      for (const chip of bonusChips.querySelectorAll(".fg-bonus-chip")) {
        const tag = outcome.bonuses.find(value => String(value.id) === chip.dataset.tagId);
        const share = futGalleryTagBonusShares(tag, selected).find(value => value.playerId === player.eaId);
        chip.classList.toggle("is-dimmed", !share);
        chip.classList.toggle("is-focused", !!share);
        chip.querySelector("strong").textContent = `+${number(share?.bonus || 0)}`;
        chip.title = `${tag?.name || "Bonus tag"}: ${player.name} +${number(share?.bonus || 0)} Gems`;
      }
    };
    const showTagPlayers = tag => {
      resetBonusHover();
      const chip = [...bonusChips.querySelectorAll(".fg-bonus-chip")].find(value => value.dataset.tagId === String(tag.id));
      chip?.classList.add("is-focused");
      const shares = futGalleryTagBonusShares(tag, selected);
      const contributingIds = new Set(shares.map(share => String(share.playerId)));
      workspace.querySelectorAll("[data-lineup] .fg-player").forEach(tile => {
        const contributes = contributingIds.has(tile.dataset.playerId);
        tile.classList.toggle("is-tag-match", contributes);
        tile.classList.toggle("is-tag-dimmed", !contributes);
      });
      for (const share of shares) {
        const entry = document.createElement("span"); entry.className = "fg-bonus-player-share";
        entry.append(document.createTextNode(share.name || String(share.playerId)));
        const value = document.createElement("strong"); value.textContent = `+${number(share.bonus)}`;
        entry.append(value); bonusPlayerList.append(entry);
      }
      bonusPlayerList.hidden = !shares.length;
      bonusPlayerList.setAttribute("aria-label", `${tag.name} bonus by player`);
    };
    bonusChips.querySelectorAll(".fg-bonus-chip").forEach(chip => {
      const tag = outcome.bonuses.find(value => String(value.id) === chip.dataset.tagId);
      chip.addEventListener("mouseenter", () => showTagPlayers(tag));
      chip.addEventListener("focus", () => showTagPlayers(tag));
      chip.addEventListener("blur", resetBonusHover);
    });
    bonusChips.parentElement.addEventListener("mouseleave", resetBonusHover);
    const status = workspace.querySelector(".fg-status");
    const missingScores = pool.players.filter(player => player.score === null).length;
    status.textContent = pool.error || (busy ? "Searching player combinations..." : [resultLabel, `${pool.players.length} eligible${missingScores ? ` / ${missingScores} missing gem values` : ""}`, selected.length < set.requiredCards ? `${set.requiredCards - selected.length} slots remaining` : outcome.next ? `${number(outcome.next.threshold - outcome.totalScore)} Gems to grade ${outcome.next.name}` : "Highest grade reached"].filter(Boolean).join(" / "));
    status.classList.toggle("fg-error", !!pool.error || !!missingScores);
    for (const grade of set.grades) {
      const rung = document.createElement("button"); rung.type = "button"; rung.className = `fg-rung${outcome.complete && outcome.totalScore >= grade.threshold ? " reached" : ""}`;
      rung.disabled = busy || buying || refreshingPrices; rung.title = `Find cheapest lineup for grade ${grade.name}`; rung.setAttribute("aria-pressed", String(targetGrade === grade.name));
      rung.onclick = async () => {
        const requirement = futGalleryEligibility(set, catalogue.tags);
        if (!requirement.matches || busy || buying || refreshingPrices) return;
        const run = ++generation; busy = true; targetGrade = grade.name; renderWorkspace();
        try {
          const result = await futGalleryCheapest(set, catalogue.tags, candidates.filter(requirement.matches), grade.name, { cancelled: () => disposed || run !== generation });
          if (!result || disposed || run !== generation) return;
          if (result.reached) {
            selected = result.players; mode = "all"; savePlan(set, selected, result.optimal);
            resultLabel = `${result.optimal ? "Cheapest priced lineup" : "Lowest cost found"} for ${grade.name}: ${number(result.cost)} coins / ${result.missing.length} to buy`;
          } else resultLabel = `${result.optimal ? "Cannot reach" : "No solution found for"} ${grade.name} with priced players`;
          if (result.unpriced) resultLabel += ` / ${result.unpriced} unpriced players excluded`;
        } catch (error) { resultLabel = `Search failed: ${error.message}`; }
        finally { if (!disposed && run === generation) { busy = false; renderWorkspace(); } }
      };
      const rewards = (grade.rewards || []).filter(reward => reward.type === "event_token_1").reduce((sum, reward) => sum + reward.count * reward.value, 0);
      rung.innerHTML = `<strong class="fg-grade-icon" aria-hidden="true"></strong><div class="fg-rung-copy"><strong></strong><span>${number(grade.threshold)}</span><small>+${number(rewards)} tokens</small></div>`;
      const gradeIcon = rung.querySelector(".fg-grade-icon");
      gradeIcon.textContent = grade.name;
      gradeIcon.dataset.grade = grade.name;
      const gradeName = rung.querySelector(".fg-rung-copy strong");
      gradeName.textContent = `${grade.name} grade`;
      workspace.querySelector(".fg-ladder").appendChild(rung);
    }
    const lineup = workspace.querySelector("[data-lineup]");
    const bonusInteraction = { player: showPlayerBonus, clear: resetBonusHover };
    selected.forEach(player => lineup.appendChild(playerTile(player, true, outcome, selected, bonusInteraction)));
    for (let index = selected.length; index < set.requiredCards; index++) {
      const slot = document.createElement("div"); slot.className = "fg-slot"; slot.innerHTML = `<strong>+</strong><span>Slot ${index + 1}</span>`; lineup.appendChild(slot);
    }
    const bonusButton = workspace.querySelector("[data-bonus-tags]");
    bonusButton.onclick = () => futGalleryShowBonuses(root, outcome, selected, bonusButton);
    const playerSearch = workspace.querySelector(".fg-player-search"); playerSearch.value = playerQuery;
    const sortSelect = workspace.querySelector(".fg-player-sort"); sortSelect.value = playerSort;
    const directionButton = workspace.querySelector(".fg-sort-direction");
    const updateDirection = () => {
      directionButton.innerHTML = playerSortAscending ? "&#8593;" : "&#8595;";
      directionButton.title = `${playerSortAscending ? "Ascending" : "Descending"}; switch to ${playerSortAscending ? "descending" : "ascending"}`;
      directionButton.setAttribute("aria-label", directionButton.title);
    };
    updateDirection();
    const renderPool = () => {
      poolObserver?.disconnect();
      const grid = workspace.querySelector("[data-candidates]");
      for (const tile of grid.children) {
        if (!tile.__galleryView) continue;
        tile.__galleryView.destroy?.();
        views = views.filter(view => view !== tile.__galleryView);
      }
      grid.replaceChildren();
      const ids = new Set(selected.map(player => player.eaId));
      const remaining = futGallerySortPlayers(pool.players.filter(player => !ids.has(player.eaId) && player.name.toLowerCase().includes(playerQuery.toLowerCase())), playerSort, playerSortAscending);
      let rendered = 0;
      const sentinel = workspace.querySelector(".fg-load-sentinel");
      const appendPlayers = () => {
        remaining.slice(rendered, visibleLimit).forEach(player => grid.appendChild(playerTile(player, false)));
        rendered = Math.min(visibleLimit, remaining.length);
        sentinel.hidden = rendered >= remaining.length;
        if (sentinel.hidden) poolObserver?.disconnect();
      };
      appendPlayers();
      if (!remaining.length) { const empty = document.createElement("div"); empty.className = "fg-empty"; empty.textContent = pool.error || (!candidates.length ? "Club and concepts are still loading." : "No matching players"); grid.appendChild(empty); }
      if (!sentinel.hidden) {
        poolObserver = new IntersectionObserver(entries => {
          if (disposed || !sentinel.isConnected || !entries.some(entry => entry.isIntersecting)) return;
          poolObserver.unobserve(sentinel);
          visibleLimit += 36; appendPlayers();
          if (!sentinel.hidden) poolObserver.observe(sentinel);
        }, { root, rootMargin: "300px 0px" });
        poolObserver.observe(sentinel);
      }
    };
    playerSearch.oninput = () => { playerQuery = playerSearch.value; visibleLimit = 36; renderPool(); };
    sortSelect.onchange = () => { playerSort = sortSelect.value; visibleLimit = 36; renderPool(); };
    directionButton.onclick = () => { playerSortAscending = !playerSortAscending; updateDirection(); visibleLimit = 36; renderPool(); };
    renderPool();
    workspace.querySelectorAll("[data-mode]").forEach(button => { button.disabled = busy || buying || refreshingPrices; button.onclick = () => { mode = button.dataset.mode; selected = []; resultLabel = ""; renderWorkspace(); }; });
    workspace.querySelector("[data-reset]").disabled = busy || buying || refreshingPrices || !selected.length;
    workspace.querySelector("[data-reset]").onclick = () => { selected = []; resultLabel = ""; renderWorkspace(); };
    workspace.querySelectorAll("[data-max-reward]").forEach(button => {
      button.disabled = busy || buying || refreshingPrices || !!pool.error || !rewardCandidates.some(player => player.score !== null);
      button.onclick = async () => {
        if (busy || buying || refreshingPrices) return;
        const currency = button.dataset.maxReward;
        const label = currency === "gems" ? "Max Gems" : "Max Tokens";
        const balanceValue = globalThis.services?.User?.getUser?.()?.coins;
        const balance = Number(balanceValue?.amount ?? balanceValue);
        if (!Number.isFinite(balance) || balance < 0) { resultLabel = `${label}: coin balance unavailable`; renderWorkspace(); return; }
        const run = ++generation; busy = true; renderWorkspace();
        let best = null;
        try {
          const consider = (plan, outcome) => {
            const reward = futGalleryRewardAmount(set, outcome, currency);
            if (reward <= 0) return;
            const choice = { plan, reward, grade: outcome.grade };
            if (!best || choice.reward > best.reward ||
                (choice.reward === best.reward && choice.plan.cost < best.plan.cost) ||
                (choice.reward === best.reward && choice.plan.cost === best.plan.cost && choice.plan.players.reduce((sum, player) => sum + player.score, 0) > best.plan.players.reduce((sum, player) => sum + player.score, 0))) best = choice;
          };
          const selectedIds = new Set(selected.map(player => player.eaId));
          const selectedIsEligible = selected.length === set.requiredCards && selectedIds.size === set.requiredCards &&
            selected.every(player => rewardCandidates.some(candidate => candidate.eaId === player.eaId));
          if (selectedIsEligible) {
            const outcome = futGalleryEvaluate(set, catalogue.tags, selected);
            const cost = futGalleryPurchaseCost(selected, purchasedIds);
            if (outcome.complete && cost.unpriced === 0 && cost.total <= balance) {
              consider({ players: selected, cost: cost.total }, outcome);
            }
          }
          if (currency === "gems") {
            const plan = await futGalleryMaxScoreWithinBudget(set, catalogue.tags, rewardCandidates, balance, {
              cancelled: () => run !== generation || disposed,
            });
            if (!plan || run !== generation || disposed) return;
            if (plan.reached) consider(plan, futGalleryEvaluate(set, catalogue.tags, plan.players));
          } else {
            for (const grade of set.grades) {
              if (run !== generation || disposed) return;
              const plan = await futGalleryCheapest(set, catalogue.tags, rewardCandidates, grade.name, {
                cancelled: () => run !== generation || disposed,
              });
              if (!plan || run !== generation || disposed) return;
              const outcome = futGalleryEvaluate(set, catalogue.tags, plan.players);
              if (!outcome.complete || outcome.totalScore < grade.threshold || plan.cost > balance) continue;
              consider(plan, outcome);
            }
          }
          if (run !== generation || disposed) return;
          if (best) {
            selected = best.plan.players;
            resultLabel = `${label}: ${number(best.reward)} ${currency}${best.grade ? ` at grade ${best.grade}` : " from complete score"} / ${number(best.plan.cost)} coins of ${number(balance)}`;
            savePlan(set, selected, best.plan.optimal);
          } else resultLabel = `${label}: 0 ${currency} / no complete set fits ${number(balance)} coins`;
        } catch (error) { resultLabel = `${label} failed: ${error.message}`; }
        finally { if (!disposed && run === generation) { busy = false; renderWorkspace(); } }
      };
    });
    const solve = workspace.querySelector("[data-solve]"); solve.disabled = !busy && (!pool.players.some(player => player.score !== null) || !!pool.error);
    if (buying || refreshingPrices) solve.disabled = true;
    const missing = selected.filter(player => !player.available && !purchasedIds.has(player.eaId));
    const buy = document.createElement("button");
    buy.type = "button";
    buy.dataset.buyLineup = "";
    buy.textContent = buying ? "Buying..." : `Buy All (${missing.length})`;
    buy.title = "Buy lineup concepts";
    buy.disabled = busy || buying || refreshingPrices || !missing.length || typeof window.autoSbcConsoleApi?.runQuickBuySquad !== "function";
    solve.after(buy);
    const refreshPrices = document.createElement("button");
    refreshPrices.type = "button";
    refreshPrices.dataset.refreshConceptPrices = "";
    refreshPrices.textContent = refreshingPrices ? "Refreshing..." : "Refresh Prices";
    refreshPrices.title = "Refresh concept prices for the current lineup";
    refreshPrices.disabled = busy || buying || refreshingPrices || !selected.some(player => !player.inClub);
    buy.after(refreshPrices);
    const afterBuy = document.createElement("select");
    afterBuy.setAttribute("aria-label", "After Gallery purchase");
    afterBuy.title = "Choose what to do with each purchased concept";
    afterBuy.style.maxWidth = "100%";
    afterBuy.style.width = "245px";
    afterBuy.style.flex = "0 1 245px";
    for (const [value, label] of [["club", "Send to club"], ["market", "List on market"], ["markup10", "List 10% above bought price"]]) {
      const option = document.createElement("option");
      option.value = value; option.textContent = label;
      afterBuy.appendChild(option);
    }
    afterBuy.value = purchaseAction;
    afterBuy.disabled = busy || buying || refreshingPrices;
    afterBuy.onchange = () => { purchaseAction = afterBuy.value; };
    refreshPrices.after(afterBuy);
    refreshPrices.onclick = async () => {
      if (busy || buying || refreshingPrices) return;
      refreshingPrices = true;
      renderWorkspace();
      try {
        const count = await futGalleryRefreshConceptPrices(selected);
        resultLabel = count ? `Refreshed prices for ${count} lineup concepts` : "No concept prices to refresh";
      } catch (error) { resultLabel = `Price refresh failed: ${error.message}`; }
      finally {
        refreshingPrices = false;
        if (!disposed) { renderSets(); renderWorkspace(); }
      }
    };
    buy.onclick = async () => {
      if (busy || buying || refreshingPrices) return;
      const current = new Map(futGalleryGetCandidates().map(player => [player.eaId, player]));
      const squadPlayers = Array.from(new Map(selected.map(player => [player.eaId, current.get(player.eaId) || player])).values())
        .filter(player => !player.available && !purchasedIds.has(player.eaId))
        .map(player => futGalleryCreateNativeItem(player, { concept: true }))
        .filter(Boolean);
      if (!squadPlayers.length) { refresh(); return; }
      buying = true; renderSets(); renderWorkspace();
      try {
        const playerPrices = {};
        for (const player of selected.filter(value => !value.available && !purchasedIds.has(value.eaId))) {
          const pricedPlayer = current.get(player.eaId) || player;
          if (pricedPlayer.isVariantItem) {
            const priceData = await futGalleryFetchVariantPriceData(player.itemDefinitionId || player.eaId, {
              holographicType: player.holographicType,
              force: true,
            });
            if (priceData?.price > 0) {
              pricedPlayer.variantPrice = priceData.price;
              pricedPlayer.price = priceData.price;
            }
          }
          const definitionId = Number(pricedPlayer.itemDefinitionId || pricedPlayer.eaId);
          const price = Number(futGalleryPrice(pricedPlayer));
          if (definitionId > 0 && Number.isFinite(price) && price > 0) playerPrices[definitionId] = price;
        }
        const result = await window.autoSbcConsoleApi.runQuickBuySquad(0, 0, {
          galleryLineup: true,
          galleryPurchaseAction: purchaseAction,
          playerPrices,
          squadPlayers,
          cancelled: () => disposed,
          onPurchased: item => purchasedIds.add(Number(item.definitionId)),
        });
        resultLabel = `${result.reason === "stopped" ? "Buying stopped" : "Buy All"}: ${result.purchased || 0}/${result.total || squadPlayers.length} purchased`;
      } catch (error) { resultLabel = `Buy All failed: ${error.message}`; }
      finally {
        buying = false;
        if (!disposed) {
          candidates = futGalleryGetCandidates();
          const fresh = new Map(candidates.map(player => [player.eaId, player]));
          selected = selected.map(player => fresh.get(player.eaId) || player);
          renderSets(); renderWorkspace();
        }
      }
    };
    solve.onclick = async () => {
      if (busy) { generation++; busy = false; resultLabel = "Search stopped"; renderWorkspace(); return; }
      const run = ++generation; busy = true; renderWorkspace();
      try {
        const result = await futGalleryOptimize(set, catalogue.tags, pool.players, { cancelled: () => run !== generation || disposed });
        if (!result || run !== generation || disposed) return;
        selected = result.players; resultLabel = result.optimal ? "Best possible for this pool" : "Best found / bonus-aware search";
        savePlan(set, selected, result.optimal);
      } catch (error) { resultLabel = `Search failed: ${error.message}`; }
      if (run === generation && !disposed) { busy = false; renderWorkspace(); }
    };
    workspace.scrollTop = scrollTop;
  };
  const refresh = event => {
    if (event?.detail?.manual) {
      batchGeneration++;
      batchRunning = false;
      batchStatus = "";
    }
    generation++; busy = false; candidates = futGalleryGetCandidates();
    const fresh = new Map(candidates.map(player => [player.eaId, player])); selected = selected.map(player => fresh.get(player.eaId)).filter(Boolean); resultLabel = ""; renderSets(); renderWorkspace(); renderBrowser();
    enrichVariantPrices();
  };
  on(search, "input", renderSets); on(category, "change", renderSets);
  on(window, "autosbc:concepts-ready", refresh); on(window, "autosbc:club-players-ready", refresh);
  on(window, "autosbc:ownership-ready", refresh);
  on(window, "autosbc:gallery-sets-ready", async () => { catalogue = await futGalleryLoadCatalogue(); if (disposed) return; set = catalogue.sets.find(item => item.id === set?.id) || catalogue.sets[0]; renderSets(); refresh(); });
  renderSets(); renderWorkspace(); renderBrowser();
  enrichVariantPrices();
  collectionBookFetchOwnership();
};