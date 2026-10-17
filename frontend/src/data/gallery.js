const FUT_GALLERY_CATALOGUE_KEY = "futGallery.catalogue.v2";
let futGalleryCatalogueRequest = null;
const futGalleryVariantPriceCache = new Map();
const futGalleryVariantPriceRequests = new Map();
const futGalleryFetchVariantPriceData = async (variantEaId, { holographicType = null, force = false } = {}) => {
  const id = Number(variantEaId);
  if (!id || typeof fetchFutggSignedJson !== "function") return null;
  const cacheKey = `${id}:${holographicType || "standard"}`;
  const cached = futGalleryVariantPriceCache.get(cacheKey);
  if (!force && cached && Date.now() - cached.timestamp < 5 * 60 * 1000) return cached;
  if (futGalleryVariantPriceRequests.has(cacheKey)) return futGalleryVariantPriceRequests.get(cacheKey);

  const request = (async () => {
    try {
      const response = (await fetchFutggSignedJson(`/api/fut/player-prices/27/${id}/`))?.data;
      const price = Number(response?.currentPrice?.price ?? response?.price ?? response?.currentDbPrice);
      const maxPrice = Number(response?.priceRange?.maxPrice);
      const result = {
        price: Number.isFinite(price) && price > 0 ? price : null,
        maxPrice: Number.isFinite(maxPrice) && maxPrice > 0 ? maxPrice : null,
        timestamp: Date.now(),
      };
      if (result.price == null && result.maxPrice == null) return null;
      futGalleryVariantPriceCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.warn("[Gallery] FUT.GG item price lookup failed", { id, holographicType, error: String(error) });
      return null;
    } finally {
      futGalleryVariantPriceRequests.delete(cacheKey);
    }
  })();
  futGalleryVariantPriceRequests.set(cacheKey, request);
  return request;
};

const futGalleryFetchVariantPrice = async (variantEaId, options = {}) =>
  (await futGalleryFetchVariantPriceData(variantEaId, options))?.price ?? null;

const futGalleryIsVariantItem = (entity, definitionId) => {
  const assetId = Number(entity?.databaseId || entity?._metaData?.id || entity?.assetId || 0);
  const hasHyperCosmetics = Object.keys(entity?._hyperCosmeticDTOs || {}).length > 0;
  return !!entity?.authenticity || !!entity?.holographicType || hasHyperCosmetics || (assetId > 0 && assetId !== Number(definitionId));
};

const futGalleryPrice = player => {
  const priceEntry = typeof getPriceItems === "function"
    ? getPriceItems()?.[player?.eaId] || getPriceItems()?.[String(player?.eaId)]
    : null;
  if (priceEntry?.isExtinct) {
    const extinctMax = Number(player?.extinctMaxPrice ?? player?.entity?._itemPriceLimits?.maximum ?? priceEntry.priceLimitMax);
    return Number.isFinite(extinctMax) && extinctMax > 0 ? extinctMax : NaN;
  }
  if (player?.variantPrice != null && Number.isFinite(Number(player.variantPrice))) return Number(player.variantPrice);
  if (player?.isVariantItem) return NaN;
  const price = typeof getPrice === "function" ? Number(getPrice(player?.entity)) : NaN;
  return Number.isFinite(price) && price > 0 ? price : null;
};

const futGalleryEnrichMarketPrices = async (players, { matches = null, cancelled = () => false } = {}) => {
  const fetchMissingPrices = globalThis.window?.collectionBookFetchMissingPrices;
  if (typeof fetchMissingPrices !== "function" || cancelled()) return players;
  const missing = players.filter(player => {
    const price = Number(futGalleryPrice(player));
    return !player.available && (!matches || matches(player)) && (!Number.isFinite(price) || price <= 0);
  });
  if (missing.length) await fetchMissingPrices(missing);
  return players;
};

// EA concept search already supplies variant entities with their own definition
// IDs and shared base asset IDs. Keep the enrichment hook async for callers.
const futGalleryAddPristineVariants = async players => players;

const futGalleryEnrichVariantPrices = async (players, { cancelled = () => false, force = false, concurrency = 4 } = {}) => {
  players = await futGalleryAddPristineVariants(players, { cancelled });
  if (typeof ensureExtinctPlayerMaxPrice === "function") {
    await Promise.all((players || []).filter(player => {
      const prices = typeof getPriceItems === "function" ? getPriceItems() || {} : {};
      return Boolean((prices[player.eaId] || prices[String(player.eaId)])?.isExtinct);
    }).map(async player => {
      const price = await ensureExtinctPlayerMaxPrice(player.entity);
      if (price != null) {
        player.extinctMaxPrice = price;
        player.price = price;
        player.purchaseCost = player.available ? 0 : price;
        player.variantPriceResolved = true;
      }
    }));
  }
  const targets = [...new Map((players || [])
    .filter(player => player?.isVariantItem && !player.extinctMaxPrice && (force || !player.variantPriceResolved))
    .map(player => [Number(player.eaId), player]))
    .values()];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), targets.length) }, async () => {
    while (cursor < targets.length && !cancelled()) {
      const player = targets[cursor++];
      const priceData = await futGalleryFetchVariantPriceData(player.itemDefinitionId || player.eaId, {
        holographicType: player.holographicType,
        force,
      });
      player.variantPriceResolved = true;
      if (priceData && !cancelled()) {
        player.variantPrice = priceData.price;
        player.maxPrice = priceData.maxPrice;
        player.price = priceData.price;
        player.purchaseCost = player.available ? 0 : priceData.price;
      }
    }
  });
  await Promise.all(workers);
  return players;
};

const futGalleryRefreshConceptPrices = async players => {
  const concepts = window.getAutoSbcConceptPlayers?.() || window.autoSbcConceptPlayers || [];
  const conceptsById = new Map(concepts.map(player => [Number(player.definitionId), player]));
  const targets = [...new Map((players || [])
    .filter(player => !player.inClub)
    .map(player => [Number(player.eaId), player]))
    .values()];
  const variants = targets.filter(player => player.isVariantItem);
  const standardEntities = targets
    .filter(player => !player.isVariantItem)
    .map(player => conceptsById.get(Number(player.eaId)) || player.entity)
    .filter(Boolean);

  if (standardEntities.length) {
    if (typeof fetchPlayerPrices !== "function") throw new Error("Concept price refresh is unavailable");
    await fetchPlayerPrices(standardEntities, {
      force: true,
      throttleProfile: "concept",
      waitForCompletion: true,
      suppressNotification: true,
    });
  }
  if (variants.length) await futGalleryEnrichVariantPrices(variants, { force: true });
  return targets.length;
};

const futGalleryLoadCatalogue = async ({ force = false } = {}) => {
  const cached = _collectionBookReadCache(FUT_GALLERY_CATALOGUE_KEY, 0);
  if (!force && cached?.sets?.length && cached?.categories?.length) return cached;
  if (futGalleryCatalogueRequest) return futGalleryCatalogueRequest;
  futGalleryCatalogueRequest = (async () => {
    try {
      const [catalogue, hub] = await Promise.all([
        _collectionBookGetJson(`${COLLECTION_BOOK_ORIGIN}/api/fut/gallery/fc27/`),
        _collectionBookGetJson(`${COLLECTION_BOOK_ORIGIN}/api/fut/gallery/fc27/hub/`),
      ]);
      const summaries = new Map((hub.data?.categories || []).flatMap(category => category.sets).map(set => [set.id, set]));
      const data = {
        capturedAt: catalogue.data.capturedAt,
        tags: catalogue.data.tags,
        categories: catalogue.data.categories.map(({ sets, ...category }) => category),
        sets: catalogue.data.categories.flatMap(category => category.sets.map(set => ({
          ...summaries.get(set.id), ...set, category: category.name, categorySlug: category.slug,
        }))),
      };
      _collectionBookWriteCache(FUT_GALLERY_CATALOGUE_KEY, data);
      window.dispatchEvent(new CustomEvent("autosbc:gallery-sets-ready"));
      return data;
    } catch (error) {
      if (cached?.sets?.length) return { ...cached, stale: true };
      throw error;
    } finally {
      futGalleryCatalogueRequest = null;
    }
  })();
  return futGalleryCatalogueRequest;
};

const futGalleryNormalizeLabel = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const futGalleryCategories = catalogue => {
  const categories = catalogue.categories || [...new Map(catalogue.sets.map(set => [set.categorySlug, { slug: set.categorySlug, name: set.category }])).values()];
  return categories.map(category => {
    const sets = catalogue.sets.filter(set => set.categorySlug === category.slug);
    return { ...category, sets, totalTokens: sets.reduce((total, set) => total + Number(set.totalTokens || 0), 0) };
  });
};

const futGalleryIconUrls = (item, { leagueOnly = false } = {}) => {
  const assets = globalThis.AssetLocationUtils;
  if (!assets) return [];
  if (item.clubEaId && !leagueOnly) return [assets.getBadgeImageUri(Number(item.clubEaId))];
  const leagueIds = { "premier-league": [13, 2216], laliga: [53, 2222], bundesliga: [19, 2218], "ligue-1": [16, 2219], "serie-a": [31], leagues: [13, 53, 19] };
  if (item.categorySlug === "leagues") {
    const target = futGalleryNormalizeLabel(item.name === "Frauen-Bundesliga" ? "GPFBL" : item.name);
    const league = globalThis.factories?.DataProvider?.getLeagueDP?.().find(value => futGalleryNormalizeLabel(String(value.label).replace(/\s*\([^)]*\)\s*$/, "")) === target);
    return league ? [assets.getLeagueImageUri(Number(league.id))] : [];
  }
  if (leagueIds[item.slug]) return leagueIds[item.slug].map(id => assets.getLeagueImageUri(id));
  const rarity = { totw: 3, heroes: 22, "squad-foundations": 87, "starter-set": 1, "season-1": 72, holographics: 3, rarities: 3 }[item.slug];
  return rarity === undefined ? [] : [assets.getShellUri(0, 1, rarity, 3)];
};
const futGalleryQuality = rating => rating >= 75 ? "gold" : rating >= 65 ? "silver" : "bronze";
const futGalleryIsLoan = item => typeof item?.isLoan === "function" ? item.isLoan() : Number(item?.loans ?? -1) >= 0;
const futGalleryIsTimeLimited = item => (typeof item?.isTimeLimited === "function" ? item.isTimeLimited() : item?.isTimeLimited === true)
  || Number(item?.limitedUseType) > 1;

const futGalleryGetCandidates = () => {
  const concepts = window.getAutoSbcConceptPlayers?.() || window.autoSbcConceptPlayers || [];
  const seenCounts = typeof collectionBookGetOwnedCounts === "function" ? collectionBookGetOwnedCounts() : new Map();
  const entities = new Map(concepts.filter(item => !futGalleryIsLoan(item) && !futGalleryIsTimeLimited(item))
    .map(item => [Number(item.definitionId), { entity: item, inClub: false }]));
  const entries = window.__clubPlayersEntries || [];
  const liveItems = globalThis.services?.Item?.itemDao?.itemRepo?.club?.items?._collection || {};
  const live = new Map(Object.values(liveItems).filter(item => item.isPlayer?.() && !futGalleryIsTimeLimited(item))
    .map(item => [Number(item.id), item]));
  for (const entry of entries) {
    const entity = live.get(Number(entry.id)) || entry.itemAttributes || entry;
    if (futGalleryIsLoan(entity) || futGalleryIsTimeLimited(entity) || futGalleryIsTimeLimited(entry)) continue;
    const previous = entities.get(Number(entry.definitionId));
    if (previous?.inClub && previous.entity.owners === 1) continue;
    entities.set(Number(entry.definitionId), { entity, entry, inClub: true, concept: previous?.entity });
  }
  const chemistry = typeof UTSquadChemCalculatorUtils === "function" ? new UTSquadChemCalculatorUtils() : null;
  if (chemistry) {
    chemistry.chemService = globalThis.services?.Chemistry;
    chemistry.teamConfigRepo = globalThis.repositories?.TeamConfig;
  }
  const positions = globalThis.PlayerPosition || {};
  return [...entities].flatMap(([eaId, source]) => {
    const { entity, entry, inClub, concept } = source;
    if (!eaId || futGalleryIsLoan(entity) || futGalleryIsTimeLimited(entity)) return [];
    const field = (name, fallback) => entity[name] ?? concept?.[name] ?? entry?.[name] ?? fallback;
    const teamId = Number(field("teamId", 0));
    const score = Number(entity.sbsScore || entity.gradingScore || concept?.sbsScore || 0);
    const hyper = entity._hyperCosmeticDTOs || concept?._hyperCosmeticDTOs || {};
    const rawPositions = field("possiblePositions", field("_basePossiblePositions", []));
    const rating = Number(field("rating", 0));
    const rareflag = Number(field("rareflag", field("_rareflag", 0)));
    const itemDefinitionId = Number(entity.definitionId || eaId);
    const assetId = Number(entity.databaseId || entity._metaData?.id || entity.assetId || eaId);
    const holographicType = entity.holographicType || null;
    const isVariantItem = futGalleryIsVariantItem(entity, itemDefinitionId);
    const staticData = entity._staticData || concept?._staticData || {};
    const name = entry?.name || entity.getFullName?.() || staticData.name || [staticData.firstName, staticData.lastName].filter(Boolean).join(" ") || String(eaId);
    const manualSeen = typeof collectionBookGetManualSeen === "function" ? collectionBookGetManualSeen(eaId) : null;
    return [{
      eaId, entity, name, rating, score: score > 0 ? score : null, inClub,
      assetId, itemDefinitionId, isVariantItem, holographicType,
      variantPrice: null, variantPriceResolved: !isVariantItem,
      price: isVariantItem ? null : (typeof getPrice === "function" ? Number(getPrice(entity)) : null),
      purchaseCost: inClub ? 0 : null,
      seen: (seenCounts.get(eaId) || 0) > 0,
      available: manualSeen ? manualSeen !== "unseen" : inClub || (seenCounts.get(eaId) || 0) > 0,
      firstOwner: manualSeen ? manualSeen === "firstOwner" : inClub && (typeof collectionBookIsFirstOwner === "function"
        ? collectionBookIsFirstOwner(entity?.id ?? entry?.id, entity.owners ?? entry?.owners)
        : Number(entity.owners ?? entry?.owners) === 1),
      teamId, clubId: teamId,
      gender: field("gender", globalThis.GrammaticalGender?.NEUTER ?? 2),
      eligibilityClubId: chemistry?.teamConfigRepo ? chemistry.normalizeClubId(teamId) : teamId,
      leagueId: Number(field("leagueId", 0)), nationId: Number(field("nationId", field("nation", 0))),
      playerId: Number(entity.databaseId || entity._metaData?.id || concept?.databaseId || entry?.assetId || eaId),
      rarityId: rareflag, rarityName: globalThis.services?.Localization?.localize?.(`item.raretype${rareflag}`) || "",
      holographic: holographicType === "pristine" || Object.values(hyper).some(value => value?.type === 1 && [0, 1].includes(value.subtype)),
      positions: rawPositions.map(position => typeof position === "number" ? positions[position] : position).filter(Boolean),
      weakFoot: Number(entity.getWeakFoot?.() ?? field("_weakFoot", 0)),
      skillMoves: Number(entity.getSkillMoves?.() ?? field("_skillMoves", 0)),
    }];
  });
};

const futGalleryEligibility = (set, tags) => {
  if (set.clubEaId) {
    const description = String(set.description || "");
    const requiresWomen = /\bwomen(?:['\u2019]?s)?\b/i.test(description);
    const requiresMen = /\bmen(?:['\u2019]?s)?\b/i.test(description);
    const gender = requiresWomen && !requiresMen ? (globalThis.GrammaticalGender?.FEMININE ?? 1)
      : requiresMen && !requiresWomen ? (globalThis.GrammaticalGender?.MASCULINE ?? 0) : null;
    return { matches: player => (player.eligibilityClubId ?? player.clubId) === Number(set.clubEaId)
      && (gender === null || Number(player.gender ?? player.entity?.gender) === gender) };
  }
  if (set.categorySlug === "leagues") {
    const leagues = globalThis.factories?.DataProvider?.getLeagueDP?.() || [];
    const target = futGalleryNormalizeLabel(set.name === "Frauen-Bundesliga" ? "GPFBL" : set.name);
    const league = leagues.find(value => futGalleryNormalizeLabel(String(value.label).replace(/\s*\([^)]*\)\s*$/, "")) === target);
    return league ? { matches: player => player.leagueId === Number(league.id) } : { error: "League requirement could not be matched to EA data." };
  }
  const tagNames = { totw: "TOTW", heroes: "Heroic", holographics: "Holographic" };
  const tag = tags.find(value => value.name === tagNames[set.slug]);
  if (tag) return { matches: player => futGalleryMatchRule(tag.rules[0], player) };
  if (set.slug === "starter-set") return { matches: player => [0, 1].includes(player.rarityId) };
  const rarityNames = { "season-1": ["Ones to Watch", "Destined for Glory", "Future Stars"], "squad-foundations": ["Squad Foundations"] };
  if (rarityNames[set.slug]) {
    const names = rarityNames[set.slug].map(futGalleryNormalizeLabel);
    return { matches: player => names.includes(futGalleryNormalizeLabel(player.rarityName)) };
  }
  return { error: "This set's eligibility rule is not supported yet." };
};

const futGalleryMatchRule = (rule, player) => {
  const values = rule.values.map(String);
  switch (rule.attribute) {
    case "LEVEL": return values.includes(futGalleryQuality(player.rating));
    case "RARE": return values.includes(String(player.rarityId));
    case "HYPER_COSMETIC_TYPE": return player.holographic;
    case "FIRST_OWNED": return player.firstOwner;
    case "POSSIBLE_POSITIONS": return player.positions.some(position => values.includes(position));
    case "WEAK_FOOT": return player.weakFoot >= Number(values[0]);
    case "SKILL_MOVES": return player.skillMoves >= Number(values[0]) + 1;
    default: return false;
  }
};

const futGalleryEvaluateTag = (tag, players) => {
  const rule = tag.rules.length === 1 ? tag.rules[0] : null;
  let matched = [];
  if (rule && ["COUNT", "COUNT_ANY", "MIN_COUNT"].includes(rule.type)) {
    matched = players.filter(player => futGalleryMatchRule(rule, player));
  } else if (rule && ["COUNT_DIFF", "MAX_COUNT_ALL_SAME"].includes(rule.type)) {
    const key = { NATION: "nationId", CLUB: "clubId", LEAGUEID: "leagueId", BASE_DEF_ID: "playerId" }[rule.attribute];
    const groups = new Map();
    for (const player of players) {
      if (!key || !player[key]) continue;
      if (!groups.has(player[key])) groups.set(player[key], []);
      groups.get(player[key]).push(player);
    }
    const sum = group => group.reduce((total, player) => total + (player.score || 0), 0);
    matched = rule.type === "COUNT_DIFF"
      ? [...groups.values()].map(group => group.reduce((best, player) => player.score > best.score ? player : best))
      : [...groups.values()].sort((left, right) => right.length - left.length || sum(right) - sum(left))[0] || [];
  }
  const tier = [...tag.tiers].sort((left, right) => left.minItems - right.minItems)
    .filter(value => matched.length >= value.minItems).at(-1);
  const matchedScore = matched.reduce((total, player) => total + (player.score || 0), 0);
  const nextTier = [...tag.tiers].sort((left, right) => left.minItems - right.minItems).find(value => value.minItems > matched.length) || null;
  return { id: tag.id, name: tag.name, count: matched.length, percent: tier?.bonus || 0, matchedScore, tiers: [...tag.tiers], nextTier,
    matchedIds: matched.map(player => player.eaId), bonus: Math.floor(matchedScore * (tier?.bonus || 0) / 100) };
};

const futGalleryEvaluate = (set, tags, players) => {
  const bonuses = tags.map(tag => futGalleryEvaluateTag(tag, players)).sort((left, right) => right.bonus - left.bonus).map((tag, index) => ({ ...tag, paid: index < 10 && tag.bonus > 0 }));
  const baseScore = players.reduce((total, player) => total + (player.score || 0), 0);
  const bonusScore = bonuses.filter(tag => tag.paid).reduce((total, tag) => total + tag.bonus, 0);
  const totalScore = baseScore + bonusScore;
  const complete = players.length === set.requiredCards && players.every(player => player.score !== null);
  const grades = [...set.grades].sort((left, right) => left.threshold - right.threshold);
  const reached = complete ? grades.filter(grade => totalScore >= grade.threshold) : [];
  const next = grades.find(grade => totalScore < grade.threshold);
  const tokens = reached.flatMap(grade => grade.rewards || []).filter(reward => reward.type === "event_token_1").reduce((total, reward) => total + reward.value * reward.count, 0);
  return { baseScore, bonusScore, totalScore, bonuses, complete, grade: reached.at(-1)?.name || null, next, tokens };
};

const futGalleryTagBonusShares = (tag, players) => {
  const shares = [];
  let accumulatedScore = 0;
  for (const matchedId of tag.matchedIds || []) {
    const player = players.find(value => value.eaId === matchedId);
    if (!player) continue;
    const nextScore = accumulatedScore + Number(player.score || 0);
    const bonus = Math.floor(nextScore * tag.percent / 100) - Math.floor(accumulatedScore * tag.percent / 100);
    if (bonus > 0) shares.push({ playerId: matchedId, name: player.name, bonus });
    accumulatedScore = nextScore;
  }
  return shares;
};

const futGalleryPlayerTagBonus = (outcome, players, targetId) => {
  const tags = outcome.bonuses.filter(value => value.paid && value.percent > 0).flatMap(tag =>
    futGalleryTagBonusShares(tag, players)
      .filter(share => share.playerId === targetId)
      .map(share => ({ name: tag.name, bonus: share.bonus })),
  );
  return { total: tags.reduce((sum, tag) => sum + tag.bonus, 0), tags };
};

const futGalleryOptimize = async (set, tags, candidates, { cancelled = () => false, maxChecks = 60000, target = null, maxCost = null } = {}) => {
  const pool = [...new Map(candidates.filter(player => player.score !== null && (target === null || !player.isVariantItem || Number(player.variantPrice) > 0)).map(player => [player.eaId, player])).values()].sort((left, right) => right.score - left.score || left.eaId - right.eaId);
  const size = Math.min(set.requiredCards, pool.length);
  const evaluate = players => {
    const result = futGalleryEvaluate(set, tags, players);
    const cost = players.reduce((total, player) => total + (player.available ? 0 : Number(player.isVariantItem ? player.variantPrice : player.purchaseCost || 0)), 0);
    return { score: result.totalScore, feasible: result.complete && (target === null || result.totalScore >= target) && (maxCost === null || cost <= maxCost), cost };
  };
  const compare = (left, right) => maxCost !== null
    ? Number(left.feasible) - Number(right.feasible) || left.score - right.score || right.cost - left.cost
    : target === null ? left.score - right.score
      : Number(left.feasible) - Number(right.feasible) || (left.feasible ? right.cost - left.cost || left.score - right.score : left.score - right.score || right.cost - left.cost);
  if (cancelled()) return null;
  let best = pool.slice(0, size);
  let bestScore = evaluate(best);
  let combinations = 1;
  for (let index = 1; index <= size; index++) {
    combinations = combinations * (pool.length - size + index) / index;
    if (combinations > 25000) break;
  }
  const yieldControl = () => new Promise(resolve => setTimeout(resolve, 0));
  let checks = 0;
  if (combinations <= 25000) {
    const indexes = Array.from({ length: size }, (_, index) => index);
    if (size) do {
      const selected = indexes.map(index => pool[index]);
      const score = evaluate(selected);
      if (compare(score, bestScore) > 0) { best = selected; bestScore = score; }
      if (++checks % 200 === 0) { await yieldControl(); if (cancelled()) return null; }
      let cursor = size - 1;
      while (cursor >= 0 && indexes[cursor] === pool.length - size + cursor) cursor--;
      if (cursor < 0) break;
      indexes[cursor]++;
      for (let index = cursor + 1; index < size; index++) indexes[index] = indexes[index - 1] + 1;
    } while (true);
    return { players: best, optimal: true, checks };
  }
  const seeds = [best];
  if (target !== null || maxCost !== null) {
    seeds.push([...pool].sort((left, right) => left.purchaseCost - right.purchaseCost || right.score - left.score).slice(0, size));
    seeds.push([...pool].sort((left, right) => right.score / (right.purchaseCost + 1) - left.score / (left.purchaseCost + 1)).slice(0, size));
  }
  for (const tag of tags) {
    const rule = tag.rules[0];
    if (!rule) continue;
    const key = { NATION: "nationId", CLUB: "clubId", LEAGUEID: "leagueId", BASE_DEF_ID: "playerId" }[rule.attribute];
    const grouped = new Map();
    if (key) for (const player of pool) {
      if (!player[key]) continue;
      if (!grouped.has(player[key])) grouped.set(player[key], []);
      if (grouped.get(player[key]).length < size) grouped.get(player[key]).push(player);
    }
    const groups = key ? [...grouped].sort((left, right) =>
      right[1].reduce((total, player) => total + player.score, 0) - left[1].reduce((total, player) => total + player.score, 0)
    ).slice(0, 8).map(([group]) => group) : [null];
    for (const group of groups) {
      const preferred = pool.filter(player => key ? player[key] === group : futGalleryMatchRule(rule, player));
      if (!preferred.length) continue;
      const ids = new Set(preferred.map(player => player.eaId));
      seeds.push([...preferred, ...pool.filter(player => !ids.has(player.eaId))].slice(0, size));
    }
  }
  const starts = seeds.map(players => ({ players, score: evaluate(players) })).sort((left, right) => compare(right.score, left.score)).slice(0, 5);
  if (starts[0] && compare(starts[0].score, bestScore) > 0) { best = starts[0].players; bestScore = starts[0].score; }
  for (const start of starts) {
    let selected = start.players;
    let score = start.score;
    for (let pass = 0; pass < 6; pass++) {
      let improvement = null;
      const ids = new Set(selected.map(player => player.eaId));
      for (const player of pool) {
        if (ids.has(player.eaId)) continue;
        for (let slot = 0; slot < size; slot++) {
          const proposal = selected.slice();
          proposal[slot] = player;
          const value = evaluate(proposal);
          if (compare(value, score) > 0) { improvement = proposal; score = value; }
          if (compare(value, bestScore) > 0) { best = proposal; bestScore = value; }
          if (++checks % 200 === 0) { await yieldControl(); if (cancelled()) return null; }
          if (checks >= maxChecks) return { players: best, optimal: false, checks };
        }
      }
      if (!improvement) break;
      selected = improvement;
    }
    if (compare(score, bestScore) > 0) { best = selected; bestScore = score; }
  }
  return { players: best, optimal: false, checks };
};

const futGalleryCheapest = async (set, tags, candidates, grade, options = {}) => {
  const target = set.grades.find(value => value.name === grade)?.threshold;
  if (!Number.isFinite(target)) throw new Error("Unknown Gallery grade");
  let unpriced = 0;
  const pool = candidates.flatMap(player => {
    if (player.score === null) return [];
    if (player.available) return [{ ...player, purchaseCost: 0 }];
    const price = Number(options.price ? options.price(player) : futGalleryPrice(player));
    if (!Number.isFinite(price) || price <= 0) { unpriced++; return []; }
    return [{ ...player, purchaseCost: price, firstOwner: false }];
  });
  const result = await futGalleryOptimize(set, tags, pool, { ...options, target });
  if (!result || options.cancelled?.()) return null;
  const outcome = futGalleryEvaluate(set, tags, result.players);
  return { ...result, reached: outcome.complete && outcome.totalScore >= target, grade, unpriced,
    cost: result.players.reduce((total, player) => total + player.purchaseCost, 0),
    missing: result.players.filter(player => player.purchaseCost > 0) };
};

const futGalleryMaxScoreWithinBudget = async (set, tags, candidates, budget, options = {}) => {
  let unpriced = 0;
  const pool = candidates.flatMap(player => {
    if (player.score === null) return [];
    if (player.available) return [{ ...player, purchaseCost: 0 }];
    const price = Number(options.price ? options.price(player) : futGalleryPrice(player));
    if (!Number.isFinite(price) || price <= 0) { unpriced++; return []; }
    return [{ ...player, purchaseCost: Math.ceil(price), firstOwner: false }];
  });
  const result = await futGalleryOptimize(set, tags, pool, { ...options, target: null, maxCost: budget });
  if (!result || options.cancelled?.()) return null;
  const outcome = futGalleryEvaluate(set, tags, result.players);
  const cost = result.players.reduce((total, player) => total + Number(player.purchaseCost || 0), 0);
  return { ...result, reached: outcome.complete && cost <= budget, grade: outcome.grade, unpriced, cost,
    missing: result.players.filter(player => player.purchaseCost > 0) };
};

const futGalleryRewardAmount = (set, outcome, currency) => {
  if (!outcome.complete) return 0;
  if (currency === "gems") return Math.max(0, Number(outcome.totalScore) || 0);
  const types = ["event_token_1"];
  return set.grades.filter(grade => outcome.totalScore >= grade.threshold)
    .flatMap(grade => grade.rewards || [])
    .filter(reward => types.includes(reward.type))
    .reduce((total, reward) => total + Math.max(0, Number(reward.value) || 0) * Math.max(0, Number(reward.count) || 0), 0);
};

const futGalleryPlanRewards = async (sets, tags, candidates, currency, budget, options = {}) => {
  if (!["tokens", "gems"].includes(currency)) throw new Error("Unknown reward currency");
  if (!Number.isFinite(budget) || budget < 0) throw new Error("Coin balance unavailable");
  const price = options.price || futGalleryPrice;
  const solve = options.solve || futGalleryCheapest;
  const beamWidth = Math.max(1, options.beamWidth || 200);
  const portfolioChoices = [];
  let states = [{ reward: 0, cost: 0, purchases: new Map(), sets: [] }];
  let skipped = 0;
  let optimal = true;
  let exhaustiveCandidates = true;
  for (let index = 0; index < sets.length; index++) {
    if (options.cancelled?.()) return null;
    const set = sets[index];
    options.progress?.(index, sets.length, `Checking ${set.name}`);
    const requirement = futGalleryEligibility(set, tags);
    const choices = [];
    const signatures = new Set();
    const addChoice = players => {
      if (players.length !== set.requiredCards || new Set(players.map(player => player.eaId)).size !== set.requiredCards) return;
      const outcome = futGalleryEvaluate(set, tags, players);
      const reward = futGalleryRewardAmount(set, outcome, currency);
      if (!reward) return;
      const signature = players.map(player => player.eaId).sort((first, second) => first - second).join(",");
      if (signatures.has(signature)) return;
      const purchases = new Map();
      for (const player of players.filter(player => !player.available)) {
        const cost = Number(price(player));
        if (!(cost > 0) || !Number.isFinite(cost)) return;
        purchases.set(player.eaId, { player, cost: Math.ceil(cost) });
      }
      signatures.add(signature);
      choices.push({ set, grade: outcome.grade, reward, players, purchases });
    };
    if (requirement.matches && (currency === "gems" || set.grades.some(grade => futGalleryRewardAmount(set, { complete: true, totalScore: grade.threshold }, currency) > 0))) {
      const pool = candidates.filter(requirement.matches).filter(player => player.score !== null)
        .map(player => player.available ? player : { ...player, firstOwner: false });
      const current = options.currentSolutions?.[set.id];
      const savedSolutions = Array.isArray(current) ? current : current ? [current, ...(current.solutions || [])] : [];
      for (const saved of savedSolutions) {
        const ids = new Set(saved.ids || saved.playerIds || []);
        addChoice(pool.filter(player => ids.has(player.eaId)));
      }
      let combinations = 1;
      for (let count = 1; count <= set.requiredCards; count++) {
        combinations = combinations * (pool.length - set.requiredCards + count) / count;
        if (combinations > 1000) break;
      }
      const exhaustive = pool.length >= set.requiredCards && combinations <= 1000;
      if (exhaustive) {
        options.progress?.(index, sets.length, `${set.name}: evaluating ${Math.round(combinations)} complete lineups`);
        const visit = (start, players) => {
          if (players.length === set.requiredCards) { addChoice(players); return; }
          for (let cursor = start; cursor <= pool.length - (set.requiredCards - players.length); cursor++) {
            visit(cursor + 1, [...players, pool[cursor]]);
          }
        };
        visit(0, []);
      } else if (pool.length >= set.requiredCards) {
        optimal = false;
        exhaustiveCandidates = false;
      }
      if (currency === "gems" && !exhaustive) {
        options.progress?.(index, sets.length, `${set.name}: maximising score within budget`);
        const result = await futGalleryMaxScoreWithinBudget(set, tags, pool, budget, { price, maxChecks: 3000, cancelled: options.cancelled });
        if (options.cancelled?.()) return null;
        if (result?.reached) {
          optimal = optimal && result.optimal;
          addChoice(result.players);
        }
      }
      for (const grade of currency === "tokens" ? set.grades : []) {
        const possible = futGalleryRewardAmount(set, { complete: true, totalScore: grade.threshold }, currency);
        if (!possible || exhaustive) continue;
        options.progress?.(index, sets.length, `${set.name}: calculating grade ${grade.name}`);
        const result = await solve(set, tags, pool, grade.name, { price, maxChecks: 3000, cancelled: options.cancelled });
        if (options.cancelled?.()) return null;
        if (!result?.reached) continue;
        optimal = optimal && result.optimal;
        addChoice(result.players);
        const sharedPrice = player => {
          const overlaps = sets.filter(other => futGalleryEligibility(other, tags).matches?.(player)).length;
          return Math.max(1, Math.ceil(Number(price(player)) / Math.max(1, overlaps)));
        };
        const shared = await solve(set, tags, pool, grade.name, { price: sharedPrice, maxChecks: 3000, cancelled: options.cancelled });
        if (options.cancelled?.()) return null;
        if (shared?.reached) addChoice(shared.players);
        for (const excluded of (result.missing || []).slice(0, 3)) {
          const alternative = await solve(set, tags, pool.filter(player => player.eaId !== excluded.eaId), grade.name,
            { price, maxChecks: 3000, cancelled: options.cancelled });
          if (options.cancelled?.()) return null;
          if (alternative?.reached) addChoice(alternative.players);
        }
      }
    }
    if (!choices.length) skipped++;
    portfolioChoices.push(...choices);
    if (options.portfolioSolver) {
      options.progress?.(index + 1, sets.length, `${set.name}: ${choices.length} valid alternatives`);
      await new Promise(resolve => setTimeout(resolve, 0));
      continue;
    }
    const expanded = states.slice();
    for (const state of states) for (const choice of choices) {
      const purchases = new Map(state.purchases);
      let cost = state.cost;
      for (const [id, purchase] of choice.purchases) {
        if (!purchases.has(id)) { purchases.set(id, purchase); cost += purchase.cost; }
      }
      if (cost <= budget) expanded.push({ reward: state.reward + choice.reward, cost, purchases, sets: [...state.sets, choice] });
    }
    expanded.sort((first, second) => second.reward - first.reward || first.cost - second.cost);
    if (expanded.length > beamWidth) optimal = false;
    states = expanded.slice(0, beamWidth);
    options.progress?.(index + 1, sets.length, set.name);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  if (options.portfolioSolver) {
    options.progress?.(sets.length, sets.length, "Optimising reward portfolio with OR-Tools CP-SAT");
    const solution = await options.portfolioSolver({
      currency, budget: Math.floor(budget),
      choices: portfolioChoices.map(choice => ({
        setId: choice.set.id, grade: choice.grade, reward: choice.reward,
        requiredCards: choice.set.requiredCards, playerIds: choice.players.map(player => player.eaId),
        purchases: [...choice.purchases.values()].map(({ player, cost }) => ({ eaId: player.eaId, cost: Math.ceil(cost) })),
      })),
    });
    if (options.cancelled?.()) return null;
    if (!["OPTIMAL", "FEASIBLE"].includes(solution?.status)) throw new Error(`Gallery solver returned ${solution?.status || "no result"}`);
    const chosen = solution.selectedIndexes.map(index => portfolioChoices[index]);
    const purchases = new Map(chosen.flatMap(choice => [...choice.purchases]));
    return { reward: solution.reward, cost: solution.cost, sets: chosen, purchases: [...purchases.values()],
      budget, remaining: budget - solution.cost, currency, skipped, optimal: solution.optimal,
      solverStatus: solution.status, scope: solution.scope,
      exhaustive: exhaustiveCandidates, choiceCount: portfolioChoices.length, evaluatedSets: sets.length };
  }
  const best = states[0];
  return { ...best, purchases: [...best.purchases.values()], budget, remaining: budget - best.cost, currency, skipped, optimal };
};
