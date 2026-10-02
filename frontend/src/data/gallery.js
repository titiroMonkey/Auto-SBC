const FUT_GALLERY_CATALOGUE_KEY = "futGallery.catalogue.v2";
let futGalleryCatalogueRequest = null;
const futGalleryVariantPriceCache = new Map();
const futGalleryVariantPriceRequests = new Map();
const futGalleryFetchVariantPrice = async (variantEaId, { holographicType = null, force = false } = {}) => {
  const id = Number(variantEaId);
  if (!id || typeof fetchFutggSignedJson !== "function") return null;
  const cacheKey = `${id}:${holographicType || "standard"}`;
  const cached = futGalleryVariantPriceCache.get(cacheKey);
  if (!force && cached && Date.now() - cached.timestamp < 5 * 60 * 1000) return cached.price;
  if (futGalleryVariantPriceRequests.has(cacheKey)) return futGalleryVariantPriceRequests.get(cacheKey);

  const request = (async () => {
    try {
      const response = (await fetchFutggSignedJson(`/api/fut/player-prices/27/${id}/`))?.data;
      const price = Number(response?.currentPrice?.price ?? response?.price ?? response?.currentDbPrice);
      if (!Number.isFinite(price) || price <= 0) return null;
      futGalleryVariantPriceCache.set(cacheKey, { price, timestamp: Date.now() });
      return price;
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

const futGalleryIsVariantItem = (entity, definitionId) => {
  const assetId = Number(entity?.databaseId || entity?._metaData?.id || entity?.assetId || 0);
  const hasHyperCosmetics = Object.keys(entity?._hyperCosmeticDTOs || {}).length > 0;
  return !!entity?.authenticity || !!entity?.holographicType || hasHyperCosmetics || (assetId > 0 && assetId !== Number(definitionId));
};

const futGalleryPrice = player => {
  if (player?.variantPrice != null && Number.isFinite(Number(player.variantPrice))) return Number(player.variantPrice);
  if (player?.isVariantItem) return NaN;
  const price = typeof getPrice === "function" ? Number(getPrice(player?.entity)) : NaN;
  return Number.isFinite(price) && price > 0 ? price : null;
};

const futGalleryAddPristineVariants = async (players, { cancelled = () => false } = {}) => {
  if (typeof fetchFutggSignedJson !== "function" || typeof searchEaConceptEntitiesByDefIds !== "function") return players;
  const definitions = [];
  const ids = [...new Set((players || []).map(player => Number(player.eaId)).filter(Boolean))];
  for (let offset = 0; offset < ids.length && !cancelled(); offset += 40) {
    const slugs = ids.slice(offset, offset + 40).map(id => `27-${id}`).join(",");
    try {
      const response = await fetchFutggSignedJson(`/api/fut/players/v2/definition-data/?game=27&slugs=${encodeURIComponent(slugs)}`);
      definitions.push(...(Array.isArray(response?.data) ? response.data : []));
    } catch (error) {
      console.warn("[Gallery] FUT.GG variant discovery failed", String(error));
    }
  }
  if (cancelled()) return players;

  const existing = new Set((players || []).map(player => Number(player.eaId)));
  const byId = new Map((players || []).map(player => [Number(player.eaId), player]));
  const missing = [...new Map(definitions.flatMap(definition => (definition.itemVariants || [])
    .filter(variant => variant.holographicType === "pristine" && !existing.has(Number(variant.eaId)))
    .map(variant => [Number(variant.eaId), { eaId: Number(variant.eaId), baseEaId: Number(definition.standardItemEaId || definition.basePlayerEaId), holographicType: variant.holographicType }]))).values()]
    .filter(variant => variant.eaId && byId.has(variant.baseEaId));
  if (!missing.length || cancelled()) return players;

  const entities = await searchEaConceptEntitiesByDefIds(missing.map(variant => variant.eaId));
  if (cancelled()) return players;
  const entityById = new Map((entities || []).map(entity => [Number(entity.resourceId || entity.definitionId || entity.eaId || entity.id), entity]));
  const additions = missing.flatMap(variant => {
    const entity = entityById.get(variant.eaId);
    const base = byId.get(variant.baseEaId);
    if (!entity || !base) return [];
    entity.holographicType = variant.holographicType;
    entity._hyperCosmeticDTOs = entity._hyperCosmeticDTOs || {};
    const staticData = entity._staticData || base.entity?._staticData || {};
    return [{
      ...base,
      eaId: variant.eaId,
      entity,
      name: entity.getFullName?.() || staticData.name || base.name,
      assetId: Number(entity.databaseId || entity._metaData?.id || base.assetId),
      itemDefinitionId: variant.eaId,
      isVariantItem: true,
      holographicType: variant.holographicType,
      holographic: true,
      variantPrice: null,
      variantPriceResolved: false,
      price: null,
      purchaseCost: null,
      inClub: false,
      seen: false,
      available: false,
      firstOwner: false,
    }];
  });
  return [...players, ...additions];
};

const futGalleryEnrichVariantPrices = async (players, { cancelled = () => false, force = false, concurrency = 4 } = {}) => {
  players = await futGalleryAddPristineVariants(players, { cancelled });
  const targets = [...new Map((players || [])
    .filter(player => player?.isVariantItem && (force || !player.variantPriceResolved))
    .map(player => [Number(player.eaId), player]))
    .values()];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), targets.length) }, async () => {
    while (cursor < targets.length && !cancelled()) {
      const player = targets[cursor++];
      const price = await futGalleryFetchVariantPrice(player.itemDefinitionId || player.eaId, {
        holographicType: player.holographicType,
        force,
      });
      player.variantPriceResolved = true;
      if (price != null && !cancelled()) {
        player.variantPrice = price;
        player.price = price;
        player.purchaseCost = player.available ? 0 : price;
      }
    }
  });
  await Promise.all(workers);
  return players;
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

const futGalleryIconUrls = item => {
  const assets = globalThis.AssetLocationUtils;
  if (!assets) return [];
  if (item.clubEaId) return [assets.getBadgeImageUri(Number(item.clubEaId))];
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

const futGalleryGetCandidates = () => {
  const concepts = window.getAutoSbcConceptPlayers?.() || window.autoSbcConceptPlayers || [];
  const seenCounts = typeof collectionBookGetOwnedCounts === "function" ? collectionBookGetOwnedCounts() : new Map();
  const firstOwnerCounts = typeof collectionBookGetFirstOwnerCounts === "function" ? collectionBookGetFirstOwnerCounts() : new Map();
  const entities = new Map(concepts.map(item => [Number(item.definitionId), { entity: item, inClub: false }]));
  const entries = window.__clubPlayersEntries || [];
  const liveItems = globalThis.services?.Item?.itemDao?.itemRepo?.club?.items?._collection || {};
  const live = new Map(Object.values(liveItems).filter(item => item.isPlayer?.()).map(item => [Number(item.id), item]));
  for (const entry of entries) {
    const entity = live.get(Number(entry.id)) || entry.itemAttributes || entry;
    if (futGalleryIsLoan(entity)) continue;
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
    if (!eaId || futGalleryIsLoan(entity)) return [];
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
    return [{
      eaId, entity, name, rating, score: score > 0 ? score : null, inClub,
      assetId, itemDefinitionId, isVariantItem, holographicType,
      variantPrice: null, variantPriceResolved: !isVariantItem,
      price: isVariantItem ? null : (typeof getPrice === "function" ? Number(getPrice(entity)) : null),
      purchaseCost: inClub ? 0 : null,
      seen: (seenCounts.get(eaId) || 0) > 0,
      available: inClub || (seenCounts.get(eaId) || 0) > 0,
      firstOwner: (inClub && Number(entity.owners ?? entry?.owners) === 1) || (firstOwnerCounts.get(eaId) || 0) > 0,
      teamId, clubId: teamId,
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
  if (set.clubEaId) return { matches: player => (player.eligibilityClubId ?? player.clubId) === Number(set.clubEaId) };
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
  const tier = [...tag.tiers].sort((left, right) => left.minItems - right.minItems).filter(value => matched.length >= value.minItems).at(-1);
  const matchedScore = matched.reduce((total, player) => total + (player.score || 0), 0);
  const nextTier = [...tag.tiers].sort((left, right) => left.minItems - right.minItems).find(value => value.minItems > matched.length) || null;
  return { id: tag.id, name: tag.name, count: matched.length, percent: tier?.bonus || 0, matchedScore, nextTier,
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

const futGalleryOptimize = async (set, tags, candidates, { cancelled = () => false, maxChecks = 60000, target = null } = {}) => {
  const pool = [...new Map(candidates.filter(player => player.score !== null && (target === null || !player.isVariantItem || Number(player.variantPrice) > 0)).map(player => [player.eaId, player])).values()].sort((left, right) => right.score - left.score || left.eaId - right.eaId);
  const size = Math.min(set.requiredCards, pool.length);
  const evaluate = players => {
    const result = futGalleryEvaluate(set, tags, players);
    return { score: result.totalScore, feasible: result.complete && result.totalScore >= target, cost: players.reduce((total, player) => total + (player.available ? 0 : Number(player.isVariantItem ? player.variantPrice : player.purchaseCost || 0)), 0) };
  };
  const compare = (left, right) => target === null ? left.score - right.score
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
  if (target !== null) {
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
