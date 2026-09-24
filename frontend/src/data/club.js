const DEFAULT_SEARCH_BATCH_SIZE = 91;
const MILLIS_IN_SECOND = 1000;
const wait = async (maxWaitTime = 2) => {
  const factor = Math.random();
  await new Promise((resolve) =>
    setTimeout(resolve, factor * maxWaitTime * MILLIS_IN_SECOND),
  );
};

async function fetchPlayers(options = {}) {
  const currentPlayersLength = Array.isArray(globalThis.players)
    ? globalThis.players.length
    : 0;
  const shouldShowProgress = currentPlayersLength === 0;

  // First load: force one search fetch to hydrate player state.
  // After this, callers can rely on club repo fast path.
  if (currentPlayersLength === 0) {
    const players = await fetchClub({
      ...options,
      showProgress: true,
    });

    if (Array.isArray(players) && players.length) {
      if (typeof setClubPlayersFromItems === "function") {
        setClubPlayersFromItems(players);
      }
    }

    return players;
  }

  // Fast path: pull directly from the internal club repo collection (object keyed by id).
  // This avoids a paginated network search when the data is already in memory.
  try {
    const collection =
      services?.Item?.itemDao?.itemRepo?.club?.items?._collection;
    if (collection && typeof collection === "object") {
      const items = Object.entries(collection)
        .filter(([key]) => key !== "undefined")
        .map(([, item]) => item)
        .filter(
          (item) =>
            item != null &&
            typeof item.isPlayer === "function" &&
            item.isPlayer(),
        );

      if (items.length > 0) {
        if (typeof setClubPlayersFromItems === "function") {
          setClubPlayersFromItems(items);
        }
        return items;
      }
    }
  } catch (err) {
    console.warn(
      "[fetchPlayers] club repo collection read failed, falling back to search",
      err,
    );
  }

  // Fallback: paginated search via the Club service.
  const players = await fetchClub({
    ...options,
    showProgress: shouldShowProgress,
  });

  if (Array.isArray(players) && players.length) {
    if (typeof setClubPlayersFromItems === "function") {
      setClubPlayersFromItems(players);
    }
  }

  return players;
}

async function forceFreshFetchPlayersFromClub(options = {}) {
  const players = await fetchClub({
    ...options,
    type:
      typeof options?.type !== "undefined"
        ? options.type
        : typeof SearchType !== "undefined"
          ? SearchType.PLAYER
          : undefined,
    showProgress: options?.showProgress !== false,
  });

  if (Array.isArray(players) && players.length) {
    if (typeof setClubPlayersFromItems === "function") {
      setClubPlayersFromItems(players);
    }
    globalThis.players = players;
  }

  return players;
}

try {
  globalThis.forceFreshFetchPlayersFromClub = forceFreshFetchPlayersFromClub;
} catch {}

// Invalidate EA's in-memory club caches so the next search re-pulls the latest
// players from the server. Mirrors what EA does internally:
//   - repositories.Item.getClub().reset()      -> clears the club item collection
//   - services.Club.clubDao.resetStatsCache()  -> invalidates the club stats cache
//   - repositories.Item.setDirty(PURCHASED)    -> marks the unassigned pile dirty
function dirtyClubCache() {
  // Clear the cached club item collection (UTItemPileRepository.reset()).
  try {
    const club =
      repositories?.Item?.getClub?.() ??
      services?.Item?.itemDao?.itemRepo?.club;
    if (club && typeof club.reset === "function") {
      club.reset();
    }
  } catch (err) {
    console.warn("[dirtyClubCache] club repo reset failed", err);
  }

  // Invalidate the club stats cache so getStats() re-queries the server.
  try {
    if (typeof services?.Club?.clubDao?.resetStatsCache === "function") {
      services.Club.clubDao.resetStatsCache();
    }
  } catch (err) {
    console.warn("[dirtyClubCache] resetStatsCache failed", err);
  }

  // Mark the unassigned (PURCHASED) pile dirty so freshly earned/unopened
  // players are reloaded on the next fetch.
  try {
    if (
      typeof repositories?.Item?.setDirty === "function" &&
      typeof ItemPile !== "undefined"
    ) {
      repositories.Item.setDirty(ItemPile.PURCHASED);
    }
  } catch (err) {
    console.warn("[dirtyClubCache] setDirty(PURCHASED) failed", err);
  }
}

// Console helper: dirty EA's club caches, then re-fetch the club with the very
// latest players from the server and update the local player state.
// Usage in console:  await refreshClubPlayers()
async function refreshClubPlayers(options = {}) {
  dirtyClubCache();

  const players = await fetchClub({
    ...options,
    type:
      typeof options?.type !== "undefined"
        ? options.type
        : typeof SearchType !== "undefined"
          ? SearchType.PLAYER
          : undefined,
    showProgress: options?.showProgress !== false,
  });

  if (Array.isArray(players) && players.length) {
    if (typeof setClubPlayersFromItems === "function") {
      setClubPlayersFromItems(players);
    }
    globalThis.players = players;
  }

  console.log(
    `[refreshClubPlayers] reloaded ${Array.isArray(players) ? players.length : 0} club players`,
  );

  return players;
}

try {
  globalThis.dirtyClubCache = dirtyClubCache;
  globalThis.refreshClubPlayers = refreshClubPlayers;
} catch {}

async function fetchConsumables(options = {}) {
  if (typeof SearchType === "undefined" || !SearchType) {
    console.warn("[sbc] SearchType not available; cannot fetch consumables.");
    return [];
  }

  const rawValues = Object.values(SearchType);
  const numericValues = rawValues.filter((v) => typeof v === "number");

  const unique = (arr) => Array.from(new Set(arr));

  const isAnyOrPlayer = (val) => {
    const normalized = String(val).trim().toUpperCase();
    return normalized === "ANY" || normalized === "PLAYER";
  };

  // Handle TS-style numeric enums with reverse mappings.
  const types = numericValues.length
    ? unique(numericValues).filter((n) => !isAnyOrPlayer(SearchType[n] ?? n))
    : unique(
        rawValues.filter((v) => typeof v === "string").map((v) => v.trim()),
      ).filter((v) => !isAnyOrPlayer(v));

  let all = [];
  for (const type of types) {
    try {
      const items = await fetchClub({ ...options, type });
      if (Array.isArray(items) && items.length) all = all.concat(items);
    } catch (err) {
      console.warn("[sbc] fetchConsumables failed for type", type, err);
    }

    // Be gentle with rate limits when iterating many types.
    await wait(1);
  }

  // Dedupe by id (preferred) else definitionId/owners.
  const seen = new Map();
  for (const it of all) {
    const hasId = typeof it?.id === "number" || typeof it?.id === "string";
    const key = hasId
      ? `id:${it.id}`
      : `def:${it?.definitionId}:${it?.owners ?? ""}`;
    if (!seen.has(key)) seen.set(key, it);
  }
  return Array.from(seen.values());
}
function fetchClub({
  count = Infinity,
  level,
  rarities,
  sort,
  sortBy,
  sortOrder,
  type,
  showProgress = false,
} = {}) {
  return new Promise((resolve) => {
    services.Club.clubDao.resetStatsCache();
    let offset = 0;
    const batchSize = DEFAULT_SEARCH_BATCH_SIZE;
    let result = [];
    let estimatedTotal = Number.isFinite(count) ? count : 0;

    let progressBarId, containerId;
    if (showProgress) {
      progressBarId = "club-players-progress-bar";
      containerId = "club-players-progress-container";
      if (typeof createProgressBar === "function") {
        createProgressBar(progressBarId, containerId, "Fetching Club Players");
      }
    }

    const fetchClubInner = () => {
      searchClub({
        count: batchSize,
        level,
        rarities,
        offset,
        sort,
        sortBy,
        sortOrder,
        type,
      }).observe(undefined, async (sender, response) => {
        result = [...response.response.items];

        // Update progress based on items loaded
        if (showProgress && typeof updateProgressBar === "function") {
          const loadedCount = Number.isFinite(result.length)
            ? result.length
            : 0;
          const dynamicFallbackTotal = Math.max(
            loadedCount + batchSize,
            batchSize,
          );
          const denominator = Math.max(
            estimatedTotal || 0,
            dynamicFallbackTotal,
          );
          const progress = Math.min(95, (loadedCount / denominator) * 100);
          updateProgressBar(progressBarId, progress);
        }

        if (
          result.length < count &&
          Math.floor(response.status / 100) === 2 &&
          !response.response.retrievedAll
        ) {
          offset += batchSize;

          fetchClubInner();
          return;
        }
        // TODO: Handle statusCodes
        if (count) {
          result = result.slice(0, count);
        }

        // Complete progress bar
        if (showProgress && typeof updateProgressBar === "function") {
          updateProgressBar(progressBarId, 100);
        }
        if (showProgress && typeof removeProgressBar === "function") {
          removeProgressBar(containerId);
        }

        resolve(result);
      });
    };

    if (
      showProgress &&
      count === Infinity &&
      typeof services?.Club?.getStats === "function"
    ) {
      let started = false;
      const startOnce = () => {
        if (started) return;
        started = true;
        fetchClubInner();
      };

      try {
        services.Club.getStats().observe(undefined, (sender, response) => {
          let observer = sender;
          try {
            const stats = response?.response?.stats;
            const playersStat = Array.isArray(stats)
              ? stats.find((entry) =>
                  String(entry?.type || "")
                    .toLowerCase()
                    .includes("player"),
                )
              : null;
            const playersCount = Number(playersStat?.count);
            if (Number.isFinite(playersCount) && playersCount > 0) {
              estimatedTotal = playersCount;
            }
          } catch (err) {
            console.warn("[sbc] failed reading club stats for progress", err);
          }
          startOnce();
          try {
            observer?.unobserve?.();
          } catch {}
        });

        setTimeout(startOnce, 250);
      } catch (err) {
        console.warn(
          "[sbc] getStats observe failed; using fallback progress",
          err,
        );
        startOnce();
      }
      return;
    }

    fetchClubInner();
  });
}

const searchClub = ({
  count,
  level,
  rarities,
  offset,
  sort,
  sortBy,
  sortOrder,
  type,
}) => {
  const searchCriteria = new UTBucketedItemSearchViewModel().searchCriteria;
  if (count) {
    searchCriteria.count = count;
  }
  if (level) {
    searchCriteria.level = level;
  }
  // Backward compatibility: legacy callers may pass sort as sortBy.
  const resolvedSortBy =
    typeof sortBy !== "undefined" && sortBy !== null ? sortBy : sort;

  if (typeof resolvedSortBy !== "undefined" && resolvedSortBy !== null) {
    searchCriteria.sortBy = resolvedSortBy;
    searchCriteria._sort = resolvedSortBy;
  }
  if (typeof sortOrder !== "undefined" && sortOrder !== null) {
    searchCriteria.sort = sortOrder;
    searchCriteria._sortOrder = sortOrder;
  }
  if (rarities) {
    searchCriteria.rarities = rarities;
  }
  if (offset) {
    searchCriteria.offset = offset;
  }
  if (type) {
    searchCriteria._type = type;
  }

  return services.Club.search(searchCriteria);
};
