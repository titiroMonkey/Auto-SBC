// Collection Book — data layer.
//
// Lazily fetches fut.gg "Collections" and their players, caching each result in
// localStorage so a collection's players are only fetched the first time the user
// scrolls it into view. The CLUB is the source of truth for what has been
// collected: ownership + per-player copy counts are derived from
// window.__clubPlayersEntries (populated by setClubPlayersFromItems on every club
// search), and collectionBookUpdateFromClub() is invoked whenever a club search runs.
//
// Network calls go directly to fut.gg via the shared makeGetRequest helper
// (GM_xmlhttpRequest), the same transport the pricing module already uses.

const COLLECTION_BOOK_GAME_YEAR = 27;
const COLLECTION_BOOK_ORIGIN = "https://www.fut.gg";

const COLLECTION_BOOK_LIST_URL = `${COLLECTION_BOOK_ORIGIN}/api/fut/collections/${COLLECTION_BOOK_GAME_YEAR}/`;
const COLLECTION_BOOK_PLAYERS_URL = (slug) =>
  `${COLLECTION_BOOK_ORIGIN}/api/fut/collections/${COLLECTION_BOOK_GAME_YEAR}/${slug}/players/`;

// Cache keys + TTLs.
const COLLECTION_BOOK_LIST_KEY = "collectionBook.list.v1";
const COLLECTION_BOOK_PLAYERS_KEY = (slug) => `collectionBook.players.v1.${slug}`;
const COLLECTION_BOOK_LIST_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const COLLECTION_BOOK_PLAYERS_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// In-flight de-duplication so concurrent scrolls don't double-fetch.
const _collectionBookPlayersInFlight = new Map();
let _collectionBookListInFlight = null;

// --- low level HTTP -------------------------------------------------------

const _collectionBookGetJson = async (url) => {
  // Prefer the GM transport (cross-origin to fut.gg is granted for pricing).
  if (typeof makeGetRequest === "function") {
    const text = await makeGetRequest(url);
    return JSON.parse(text);
  }
  // Fallback for environments where GM_xmlhttpRequest is unavailable.
  const resp = await fetch(url, { headers: { Accept: "application/json" } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
};

// --- cache helpers --------------------------------------------------------

const _collectionBookReadCache = (key, ttlMs) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (ttlMs && Date.now() - Number(parsed.ts || 0) > ttlMs) return null;
    return parsed.data;
  } catch {
    return null;
  }
};

const _collectionBookWriteCache = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch (err) {
    console.warn("[CollectionBook] cache write failed", key, err);
  }
};

// --- slim mappers ---------------------------------------------------------

const _collectionBookSlimPlayer = (p) => {
  const name =
    p?.cardName ||
    p?.nickname ||
    [p?.firstName, p?.lastName].filter(Boolean).join(" ") ||
    String(p?.eaId);
  return {
    eaId: Number(p?.eaId),
    name,
    overall: p?.overall ?? null,
    position: p?.position ?? null,
    positionId: p?.positionId ?? null,
    rarityEaId: p?.rarityEaId ?? null,
    rarityName: p?.rarityName ?? null,
    isIcon: !!p?.isIcon,
    isHero: !!p?.isHero,
    clubEaId: p?.uniqueClubEaId ?? null,
    nationEaId: p?.nation?.eaId ?? null,
    leagueEaId: p?.league?.eaId ?? null,
    cardImageUrl: p?.cardImageUrl || null,
  };
};

// --- collections list -----------------------------------------------------

// Fetch (all pages of) the collections index: name, slug, and full eaId list.
// Cached; call with { force:true } to bypass the cache.
const collectionBookFetchList = async ({ force = false } = {}) => {
  if (!force) {
    const cached = _collectionBookReadCache(
      COLLECTION_BOOK_LIST_KEY,
      COLLECTION_BOOK_LIST_TTL_MS,
    );
    if (cached) return cached;
  }
  if (_collectionBookListInFlight) return _collectionBookListInFlight;

  _collectionBookListInFlight = (async () => {
    const collections = [];
    let page = 1;
    let totalPages = 1;
    try {
      while (page <= totalPages) {
        const url = `${COLLECTION_BOOK_LIST_URL}?page=${page}&page_size=20`;
        const payload = await _collectionBookGetJson(url);
        totalPages = Number(payload?.totalPages || 1);
        for (const item of payload?.data || []) {
          if (!item?.slug) continue;
          collections.push({
            id: item.id,
            name: item.name || item.slug,
            slug: item.slug,
            description: item.description || "",
            total: (item.allPlayerItemEaIds || []).length,
            allPlayerItemEaIds: (item.allPlayerItemEaIds || []).map(Number),
            highlightedPlayerItemEaIds: (
              item.highlightedPlayerItemEaIds || []
            ).map(Number),
          });
        }
        page += 1;
      }
    } catch (err) {
      console.warn("[CollectionBook] list fetch failed", err);
      // Fall back to any stale cache rather than nothing.
      const stale = _collectionBookReadCache(COLLECTION_BOOK_LIST_KEY, 0);
      if (stale) return stale;
      throw err;
    }
    _collectionBookWriteCache(COLLECTION_BOOK_LIST_KEY, collections);
    return collections;
  })();

  try {
    return await _collectionBookListInFlight;
  } finally {
    _collectionBookListInFlight = null;
  }
};

// --- per-collection players (lazy) ---------------------------------------

// Fetch (all pages of) one collection's players. Cached per slug and
// de-duplicated so repeated scroll events resolve to a single network run.
const collectionBookFetchPlayers = async (slug, { force = false } = {}) => {
  if (!slug) return [];
  if (!force) {
    const cached = _collectionBookReadCache(
      COLLECTION_BOOK_PLAYERS_KEY(slug),
      COLLECTION_BOOK_PLAYERS_TTL_MS,
    );
    if (cached) return cached;
  }
  if (_collectionBookPlayersInFlight.has(slug)) {
    return _collectionBookPlayersInFlight.get(slug);
  }

  const run = (async () => {
    const players = [];
    let page = 1;
    let totalPages = 1;
    try {
      while (page <= totalPages) {
        const url = `${COLLECTION_BOOK_PLAYERS_URL(slug)}?page=${page}`;
        const payload = await _collectionBookGetJson(url);
        totalPages = Number(payload?.totalPages || 1);
        for (const p of payload?.data || []) {
          if (p?.eaId == null) continue;
          players.push(_collectionBookSlimPlayer(p));
        }
        page += 1;
      }
    } catch (err) {
      console.warn(`[CollectionBook] players fetch failed (${slug})`, err);
      const stale = _collectionBookReadCache(
        COLLECTION_BOOK_PLAYERS_KEY(slug),
        0,
      );
      if (stale) return stale;
      throw err;
    }
    _collectionBookWriteCache(COLLECTION_BOOK_PLAYERS_KEY(slug), players);
    return players;
  })();

  _collectionBookPlayersInFlight.set(slug, run);
  try {
    return await run;
  } finally {
    _collectionBookPlayersInFlight.delete(slug);
  }
};

// --- background prefetch (fetch-on-init) ---------------------------------

let _collectionBookPrefetchInFlight = null;

// Fetch the collections list, then fetch players for every collection that is
// not already cached (fresh). Mirrors the concept-fetch pattern: runs in the
// background on init and keeps going through all collections until each one has
// been fetched (or a cached copy exists). Safe to call repeatedly — cached and
// in-flight collections are skipped, so it only fills in what is missing.
const collectionBookPrefetchAll = async ({ force = false } = {}) => {
  if (_collectionBookPrefetchInFlight) return _collectionBookPrefetchInFlight;

  _collectionBookPrefetchInFlight = (async () => {
    let list = [];
    try {
      list = await collectionBookFetchList({ force });
    } catch (err) {
      console.warn("[CollectionBook] prefetch: list failed", err);
      return;
    }

    let fetched = 0;
    let skipped = 0;
    for (const col of list) {
      const cached = _collectionBookReadCache(
        COLLECTION_BOOK_PLAYERS_KEY(col.slug),
        force ? 0 : COLLECTION_BOOK_PLAYERS_TTL_MS,
      );
      if (cached && !force) {
        skipped += 1;
        continue;
      }
      try {
        await collectionBookFetchPlayers(col.slug, { force });
        fetched += 1;
        // Let the (optional) open page fill in this section as it arrives.
        if (typeof window.__collectionBookOnSectionFetched === "function") {
          window.__collectionBookOnSectionFetched(col.slug);
        }
      } catch (err) {
        console.warn(
          `[CollectionBook] prefetch: players failed (${col.slug})`,
          err,
        );
      }
    }
    console.log(
      `[CollectionBook] prefetch complete — ${fetched} fetched, ${skipped} cached, ${list.length} total`,
    );
    // All collection players are now loaded — make the Collection Book tab
    // available (it is injected hidden until this point).
    window.__collectionBookAllLoaded = true;
    try {
      document
        .querySelectorAll(".collection-book-tab-deferred")
        .forEach((el) => {
          el.style.display = "";
          el.classList.remove("collection-book-tab-deferred");
        });
    } catch {}
  })();

  try {
    return await _collectionBookPrefetchInFlight;
  } finally {
    _collectionBookPrefetchInFlight = null;
  }
};

// --- club ownership (source of truth) ------------------------------------

// Persisted ownership cache (backend). The club is the live source of truth,
// but a player passes through the unassigned pile (freshly packed / picked)
// before it reaches the club, and can be sent to the transfer list or storage.
// To count a collection player as owned as soon as it is seen — and to keep
// counting duplicates by distinct entity (instance) id — every observed
// {definitionId, entityId} pair is persisted to a backend file. The count per
// definitionId is the number of distinct entity ids recorded for it, so
// multiple entity ids against the same definitionId increment the counter.
const COLLECTION_BOOK_OWNERSHIP_API_URL =
  "http://127.0.0.1:8000/api/collection-book-ownership";

// definitionId(number) -> count(number), hydrated from the backend.
let _collectionBookOwnershipCounts = new Map();

const _collectionBookApplyOwnershipCounts = (counts) => {
  if (!counts || typeof counts !== "object") return;
  const next = new Map();
  for (const [defId, n] of Object.entries(counts)) {
    const id = Number(defId);
    const count = Number(n);
    if (Number.isFinite(id) && id > 0 && Number.isFinite(count) && count > 0) {
      next.set(id, count);
    }
  }
  _collectionBookOwnershipCounts = next;
};

// Load persisted ownership counts from the backend into memory.
const collectionBookFetchOwnership = async () => {
  try {
    const resp = await fetch(COLLECTION_BOOK_OWNERSHIP_API_URL, {
      headers: { Accept: "application/json" },
    });
    if (!resp.ok) return;
    const json = await resp.json();
    _collectionBookApplyOwnershipCounts(json?.counts);
  } catch (err) {
    console.warn("[CollectionBook] ownership fetch failed", err);
  }
};

// Extract {definitionId, entityId} pairs from raw EA items. entityId is the
// unique instance id (item.id), which persists as a player moves between piles.
const _collectionBookOwnershipPairs = (items) => {
  const pairs = [];
  for (const item of items || []) {
    const defId = Number(item?.definitionId);
    const entityId = item?.id;
    if (!Number.isFinite(defId) || defId <= 0) continue;
    if (entityId == null) continue;
    pairs.push({ definitionId: defId, entityId: String(entityId) });
  }
  return pairs;
};

// Record ownership for a batch of EA items (club search / unassigned search),
// then refresh the Collection Book counters with the merged counts. The backend
// dedupes by entity id, so repeated searches never inflate the count.
const collectionBookRecordOwnership = async (items) => {
  try {
    const pairs = _collectionBookOwnershipPairs(items);
    if (!pairs.length) return;
    const resp = await fetch(COLLECTION_BOOK_OWNERSHIP_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairs }),
    });
    if (!resp.ok) return;
    const json = await resp.json();
    _collectionBookApplyOwnershipCounts(json?.counts);
    if (typeof window.__collectionBookOnClubUpdate === "function") {
      window.__collectionBookOnClubUpdate(collectionBookGetOwnedCounts());
    }
  } catch (err) {
    console.warn("[CollectionBook] ownership record failed", err);
  }
};

// Map definitionId -> number of copies owned. Merges the live club-players
// entries (setClubPlayersFromItems) with the persisted backend ownership cache,
// taking the larger count per definitionId so the counter reflects every
// distinct entity id seen across club + unassigned, even before a player lands
// in the club.
const collectionBookGetOwnedCounts = () => {
  const counts = new Map();
  const entries = Array.isArray(window.__clubPlayersEntries)
    ? window.__clubPlayersEntries
    : [];
  for (const entry of entries) {
    const defId = Number(entry?.definitionId);
    if (!Number.isFinite(defId) || defId <= 0) continue;
    counts.set(defId, (counts.get(defId) || 0) + 1);
  }
  if (_collectionBookOwnershipCounts instanceof Map) {
    for (const [defId, cached] of _collectionBookOwnershipCounts.entries()) {
      counts.set(defId, Math.max(counts.get(defId) || 0, cached));
    }
  }
  return counts;
};

// Map definitionId -> copies currently in the *club* (live __clubPlayersEntries
// only, excluding the persisted seen-before cache). Used to colour the copy
// counter green (in club) vs red (seen before but not currently in the club).
const collectionBookGetClubCounts = () => {
  const counts = new Map();
  const entries = Array.isArray(window.__clubPlayersEntries)
    ? window.__clubPlayersEntries
    : [];
  for (const entry of entries) {
    const defId = Number(entry?.definitionId);
    if (!Number.isFinite(defId) || defId <= 0) continue;
    counts.set(defId, (counts.get(defId) || 0) + 1);
  }
  return counts;
};

// Console diagnostic: explain why a given player is / isn't counted as owned.
// Pass an eaId (number) or a name substring. Prints the collection player's
// eaId, whether the club ownership map has that id, and any club entries whose
// name matches — so an eaId<->definitionId mismatch is obvious at a glance.
// Usage:  collectionBookDebugOwnership("Bellerin")  or  collectionBookDebugOwnership(12345)
const collectionBookDebugOwnership = (query) => {
  const counts = collectionBookGetOwnedCounts();
  const entries = Array.isArray(window.__clubPlayersEntries)
    ? window.__clubPlayersEntries
    : [];
  const cached = (typeof collectionBookGetAllCachedPlayers === "function"
    ? collectionBookGetAllCachedPlayers()
    : []) || [];

  const isNum = typeof query === "number" || /^\d+$/.test(String(query || ""));
  const wanted = isNum ? Number(query) : String(query || "").toLowerCase();

  const collectionMatches = cached.filter((p) =>
    isNum
      ? Number(p.eaId) === wanted
      : String(p.name || "").toLowerCase().includes(wanted),
  );
  const clubMatches = entries.filter((e) =>
    isNum
      ? Number(e.definitionId) === wanted
      : String(e.name || "").toLowerCase().includes(wanted),
  );

  console.group(`[CollectionBook] ownership debug: ${query}`);
  console.log(`club entries loaded: ${entries.length}`);
  console.table(
    collectionMatches.map((p) => ({
      name: p.name,
      "collection.eaId": Number(p.eaId),
      "ownedCount(eaId)": counts.get(Number(p.eaId)) || 0,
      countedAsOwned: (counts.get(Number(p.eaId)) || 0) > 0,
    })),
  );
  console.table(
    clubMatches.map((e) => ({
      name: e.name,
      "club.definitionId": Number(e.definitionId),
      "club.assetId": Number(e.assetId),
      rating: e.rating,
    })),
  );
  console.groupEnd();
  return { collectionMatches, clubMatches, counts };
};

// EA concept entities (window.getAutoSbcConceptPlayers) are the EA-native source
// of truth for both market price and face stats. Index them by definitionId so
// a collection player (keyed by eaId == definitionId) can be joined to its real
// EA item. The index is rebuilt whenever the concept count changes.
let _collectionBookConceptIndex = null;
let _collectionBookConceptIndexSize = -1;
const collectionBookGetConceptIndex = () => {
  try {
    const list =
      (typeof window.getAutoSbcConceptPlayers === "function" &&
        window.getAutoSbcConceptPlayers()) ||
      window.autoSbcConceptPlayers ||
      [];
    if (
      _collectionBookConceptIndex &&
      _collectionBookConceptIndexSize === list.length
    ) {
      return _collectionBookConceptIndex;
    }
    const map = new Map();
    for (const item of list) {
      const defId = Number(item?.definitionId);
      if (Number.isFinite(defId) && defId > 0 && !map.has(defId)) {
        map.set(defId, item);
      }
    }
    _collectionBookConceptIndex = map;
    _collectionBookConceptIndexSize = list.length;
    return map;
  } catch {
    return _collectionBookConceptIndex || new Map();
  }
};

// Market price for a collection player, using EA's own data only (no network /
// HTML fetch). Prefers pricing the real EA concept entity via getPrice — which
// returns the cached price if it is there — then falls back to the entity's EA
// market data, then to a direct definitionId lookup in the EA price cache.
// Returns a number, or null when the price is unknown.
// Pull a positive price out of an EA UTValueBandVO (getPriceLimits) regardless
// of the obfuscated getter/field names by scanning its numeric values and
// taking the smallest positive one (the min bid limit).
const collectionBookReadPriceBand = (band) => {
  if (!band || typeof band !== "object") return null;
  const candidates = [];
  try {
    if (typeof band.getMinValue === "function") candidates.push(band.getMinValue());
    if (typeof band.getStartValue === "function") candidates.push(band.getStartValue());
  } catch {}
  for (const value of Object.values(band)) {
    if (typeof value === "number") candidates.push(value);
  }
  const positives = candidates
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  return positives.length ? Math.min(...positives) : null;
};

const collectionBookGetPrice = (player) => {
  const defId = Number(player?.eaId);
  if (!Number.isFinite(defId) || defId <= 0) return null;
  try {
    const concept = collectionBookGetConceptIndex().get(defId);
    if (concept) {
      if (typeof getPrice === "function") {
        const p = getPrice(concept);
        if (Number.isFinite(Number(p)) && Number(p) > 0) return Number(p);
      }
      // EA-native market value: getMarketAverage()/_marketAverage (defaults to
      // -1 when unknown).
      const marketAverage =
        typeof concept.getMarketAverage === "function"
          ? Number(concept.getMarketAverage())
          : Number(concept._marketAverage ?? concept.marketAverage);
      if (Number.isFinite(marketAverage) && marketAverage > 0) {
        return marketAverage;
      }
      // EA-native price limits band (getPriceLimits()/_itemPriceLimits).
      const band =
        (typeof concept.getPriceLimits === "function" &&
          concept.getPriceLimits()) ||
        concept._itemPriceLimits ||
        concept.itemPriceLimits ||
        null;
      const bandPrice = collectionBookReadPriceBand(band);
      if (bandPrice != null) return bandPrice;
    }
    if (typeof getPrice === "function") {
      const p = getPrice({ definitionId: defId, concept: true });
      if (Number.isFinite(Number(p)) && Number(p) > 0) return Number(p);
    }
    if (typeof getPriceItems === "function") {
      const items = getPriceItems() || {};
      const entry = items[defId] || items[String(defId)];
      const p = entry?.price;
      if (Number.isFinite(Number(p)) && Number(p) > 0) return Number(p);
    }
  } catch {}
  return null;
};

// Players whose price we've already asked fut.gg for, so a section re-render
// doesn't re-queue the same definitionIds.
const _collectionBookPriceRequested = new Set();

// For any collection players missing an EA price, fetch a fut.gg price so the
// card doesn't show 0. Prefers the real concept entity (correct search type),
// otherwise falls back to a concept-like stub keyed by definitionId. Runs the
// shared fetchPlayerPrices pipeline (which populates the EA price cache that
// collectionBookGetPrice reads). Returns the number of players queued.
const collectionBookFetchMissingPrices = async (players) => {
  if (typeof fetchPlayerPrices !== "function") return 0;
  const index = collectionBookGetConceptIndex();
  const toFetch = [];
  for (const p of players || []) {
    const defId = Number(p?.eaId);
    if (!Number.isFinite(defId) || defId <= 0) continue;
    if (_collectionBookPriceRequested.has(defId)) continue;
    if (collectionBookGetPrice(p) != null) continue;
    _collectionBookPriceRequested.add(defId);
    const concept = index.get(defId);
    toFetch.push(concept || { definitionId: defId, concept: true });
  }
  if (!toFetch.length) return 0;
  try {
    await fetchPlayerPrices(toFetch, {
      throttleProfile: "concept",
      suppressNotification: true,
      waitForCompletion: true,
    });
  } catch (err) {
    console.warn("[CollectionBook] fut.gg price fetch failed", err);
  }
  return toFetch.length;
};

// EA-native face stats (6 values, FUT card order) for a collection player,
// sourced from the matching concept entity. Returns [] when unavailable so the
// caller can fall back to a stat-less card.
const collectionBookGetFaceStats = (eaId) => {
  const defId = Number(eaId);
  if (!Number.isFinite(defId) || defId <= 0) return [];
  try {
    const concept = collectionBookGetConceptIndex().get(defId);
    if (!concept) return [];
    const attrs =
      (typeof concept.getAttributes === "function" && concept.getAttributes()) ||
      concept.attributes ||
      concept.attributeArray ||
      [];
    if (Array.isArray(attrs) && attrs.length >= 6) {
      return attrs.slice(0, 6).map((v) => Number(v) || 0);
    }
  } catch {}
  return [];
};

// Return a REAL EA item entity for a collection player (keyed by
// eaId == definitionId), so cards render with the game's own rating + face
// stats instead of the fut.gg metadata (which frequently has overall == null,
// producing 0-rating / 0-stat concept cards). Preference order:
//   1. the live club item (owned copy) from the EA club repo,
//   2. the concept-pool entity (EA-native, already indexed by definitionId).
// Returns null when neither is available so the caller can fall back to the
// synthetic payload path.
const collectionBookGetItemEntity = (eaId) => {
  const defId = Number(eaId);
  if (!Number.isFinite(defId) || defId <= 0) return null;

  // 1. Live club item — the actual owned card, full stats + correct rating.
  try {
    const collection =
      services?.Item?.itemDao?.itemRepo?.club?.items?._collection;
    if (collection && typeof collection === "object") {
      for (const key of Object.keys(collection)) {
        const item = collection[key];
        if (item && Number(item.definitionId) === defId) {
          return item;
        }
      }
    }
  } catch {}

  // 2. Concept-pool entity — EA-native item with real face stats.
  try {
    const concept = collectionBookGetConceptIndex().get(defId);
    if (concept) return concept;
  } catch {}

  return null;
};


// Every collection player, de-duplicated by eaId, gathered from the cached
// per-collection player lists (populated by the prefetch). Used to build the
// rarity batches. Returns [] until at least one collection has been cached.
const collectionBookGetAllCachedPlayers = () => {
  const list = _collectionBookReadCache(COLLECTION_BOOK_LIST_KEY, 0) || [];
  const byEaId = new Map();
  for (const col of list) {
    const players = _collectionBookReadCache(
      COLLECTION_BOOK_PLAYERS_KEY(col.slug),
      0,
    );
    if (!Array.isArray(players)) continue;
    for (const p of players) {
      const id = Number(p?.eaId);
      if (!Number.isFinite(id) || id <= 0 || byEaId.has(id)) continue;
      byEaId.set(id, p);
    }
  }
  return Array.from(byEaId.values());
};

// Synthetic "batches" grouping every collected player by rarity type, so the
// book can be viewed one rarity at a time in addition to the fut.gg collections.
// Each batch mirrors the collection shape ({ slug, name, total, players }) with
// an isRarityBatch flag and a bundled players list (no network fetch needed).
const collectionBookBuildRarityBatches = () => {
  const players = collectionBookGetAllCachedPlayers();
  const groups = new Map();
  for (const p of players) {
    const rid = p?.rarityEaId == null ? "unknown" : p.rarityEaId;
    const key = `rarity:${rid}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        slug: key,
        name: p?.rarityName || `Rarity ${rid}`,
        rarityEaId: rid,
        players: [],
      };
      groups.set(key, g);
    }
    g.players.push(p);
  }
  const batches = Array.from(groups.values()).map((g) => ({
    slug: g.slug,
    name: g.name,
    rarityEaId: g.rarityEaId,
    total: g.players.length,
    players: g.players,
    isRarityBatch: true,
  }));
  batches.sort((a, b) => b.total - a.total);
  return batches;
};

// Given a collection's players, compute per-player ownership + collection totals
// using the club as the source of truth.
const collectionBookComputeProgress = (players, ownedCounts) => {
  const counts = ownedCounts || collectionBookGetOwnedCounts();
  const clubCounts = collectionBookGetClubCounts();
  let owned = 0;
  const rows = (players || []).map((p) => {
    const copies = counts.get(Number(p.eaId)) || 0;
    // In the club right now vs merely seen before (persisted ownership cache).
    // Both render colourful (not concept); the counter colour distinguishes them.
    const inClub = (clubCounts.get(Number(p.eaId)) || 0) > 0;
    if (copies > 0) owned += 1;
    return {
      player: p,
      owned: copies > 0,
      inClub,
      copies,
      price: collectionBookGetPrice(p),
    };
  });
  // Sort each batch by price descending (unknown prices sink to the bottom).
  rows.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
  return { rows, owned, total: rows.length };
};

// --- new-player detection + notifications --------------------------------

// Persisted baseline of collection-player defIds already seen as owned, so we
// only notify when something NEW appears (not on the first club sync).
const COLLECTION_BOOK_SEEN_KEY = "collectionBook.ownedSeen.v1";

const _collectionBookReadSeen = () => {
  try {
    const raw = localStorage.getItem(COLLECTION_BOOK_SEEN_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(Number)) : null;
  } catch {
    return null;
  }
};

const _collectionBookWriteSeen = (set) => {
  try {
    localStorage.setItem(COLLECTION_BOOK_SEEN_KEY, JSON.stringify([...set]));
  } catch {}
};

// Diff the currently-owned collection players against the persisted baseline.
// Returns [{ eaId, collection }] for players collected since the last sync.
// On the very first run it silently seeds the baseline (returns []).
const collectionBookDetectNewlyCollected = () => {
  // Membership + collection name come from the list cache (stale is fine —
  // collection membership is stable).
  const memberToCollection = _collectionBookMemberToCollection();
  if (!memberToCollection.size) return [];

  const counts = collectionBookGetOwnedCounts();
  const ownedMembers = [];
  for (const defId of counts.keys()) {
    if (memberToCollection.has(defId)) ownedMembers.push(defId);
  }

  const seen = _collectionBookReadSeen();
  if (!seen) {
    // First run: establish the baseline silently, don't notify.
    _collectionBookWriteSeen(new Set(ownedMembers));
    return [];
  }

  const newly = ownedMembers.filter((id) => !seen.has(id));
  if (newly.length) {
    for (const id of newly) seen.add(id);
    _collectionBookWriteSeen(seen);
  }
  return newly.map((id) => ({
    eaId: id,
    collection: memberToCollection.get(id),
  }));
};

// Build defId -> collection name from the (stale-ok) list cache. Collection
// membership is stable, so a stale list is fine.
const _collectionBookMemberToCollection = () => {
  const map = new Map();
  const list = _collectionBookReadCache(COLLECTION_BOOK_LIST_KEY, 0);
  if (!Array.isArray(list)) return map;
  for (const c of list) {
    for (const id of c.allPlayerItemEaIds || []) {
      const defId = Number(id);
      if (!map.has(defId)) map.set(defId, c.name);
    }
  }
  return map;
};

// Detect newly collected Collection Book players from an arbitrary set of item
// definitionIds (e.g. items just pulled in the unassigned fetch after a pack
// open), not just those already in the club. Updates the persisted baseline so
// the same player isn't re-notified when it later lands in the club. Skips
// entirely until the baseline exists (the club detection seeds it), to avoid a
// flood on the very first run.
const collectionBookDetectNewFromIds = (defIds) => {
  const memberToCollection = _collectionBookMemberToCollection();
  if (!memberToCollection.size) return [];

  const seen = _collectionBookReadSeen();
  if (!seen) return []; // baseline is established by collectionBookDetectNewlyCollected

  const newly = [];
  for (const raw of defIds || []) {
    const defId = Number(raw);
    if (
      Number.isFinite(defId) &&
      memberToCollection.has(defId) &&
      !seen.has(defId)
    ) {
      seen.add(defId);
      newly.push(defId);
    }
  }
  if (!newly.length) return [];
  _collectionBookWriteSeen(seen);
  return newly.map((id) => ({
    eaId: id,
    collection: memberToCollection.get(id),
  }));
};

// Scan a list of EA items (e.g. the unassigned fetch result) for newly
// collected Collection Book players and notify. Safe no-op when nothing new.
const collectionBookScanItems = (items) => {
  try {
    const defIds = (items || [])
      .map((it) =>
        Number(
          it?.definitionId ?? it?.resourceId ?? it?._staticData?.id ?? NaN,
        ),
      )
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!defIds.length) return;
    const newly = collectionBookDetectNewFromIds(defIds);
    if (newly.length) collectionBookNotifyNewlyCollected(newly);
  } catch (err) {
    console.warn("[CollectionBook] item scan failed", err);
  }
};

// Resolve player display names for a set of eaIds from any cached players list.
const _collectionBookResolveNames = (ids) => {
  const want = new Set(ids.map(Number));
  const names = new Map();
  const list = _collectionBookReadCache(COLLECTION_BOOK_LIST_KEY, 0) || [];
  for (const c of list) {
    if (!want.size) break;
    const players = _collectionBookReadCache(
      COLLECTION_BOOK_PLAYERS_KEY(c.slug),
      0,
    );
    if (!Array.isArray(players)) continue;
    for (const p of players) {
      const id = Number(p.eaId);
      if (want.has(id)) {
        names.set(id, p.name || String(id));
        want.delete(id);
      }
    }
  }
  return names;
};

// Show an EA in-app notification for newly collected Collection Book players.
const collectionBookNotifyNewlyCollected = (newly) => {
  if (!newly?.length || typeof showNotification !== "function") return;
  const type =
    (typeof UINotificationType !== "undefined" && UINotificationType.POSITIVE) ||
    0;
  if (newly.length <= 3) {
    const names = _collectionBookResolveNames(newly.map((n) => n.eaId));
    for (const n of newly) {
      const nm = names.get(Number(n.eaId)) || `#${n.eaId}`;
      const where = n.collection ? ` (${n.collection})` : "";
      showNotification(`Collection Book: ${nm} collected!${where}`, type);
    }
  } else {
    showNotification(
      `Collection Book: ${newly.length} new players collected!`,
      type,
    );
  }
};

// Invoked whenever a club search runs. Recomputes progress from the club,
// notifies about any newly collected players, and asks the (optional)
// Collection Book view to refresh its counters/styling.
const collectionBookUpdateFromClub = () => {
  try {
    const newly = collectionBookDetectNewlyCollected();
    if (newly.length) collectionBookNotifyNewlyCollected(newly);
    if (typeof window.__collectionBookOnClubUpdate === "function") {
      window.__collectionBookOnClubUpdate(collectionBookGetOwnedCounts());
    }
  } catch (err) {
    console.warn("[CollectionBook] club update failed", err);
  }
};

try {
  window.collectionBookFetchList = collectionBookFetchList;
  window.collectionBookFetchPlayers = collectionBookFetchPlayers;
  window.collectionBookPrefetchAll = collectionBookPrefetchAll;
  window.collectionBookGetOwnedCounts = collectionBookGetOwnedCounts;
  window.collectionBookDebugOwnership = collectionBookDebugOwnership;
  window.collectionBookFetchOwnership = collectionBookFetchOwnership;
  window.collectionBookRecordOwnership = collectionBookRecordOwnership;
  window.collectionBookGetPrice = collectionBookGetPrice;
  window.collectionBookFetchMissingPrices = collectionBookFetchMissingPrices;
  window.collectionBookGetConceptIndex = collectionBookGetConceptIndex;
  window.collectionBookGetFaceStats = collectionBookGetFaceStats;
  window.collectionBookGetItemEntity = collectionBookGetItemEntity;
  window.collectionBookGetAllCachedPlayers = collectionBookGetAllCachedPlayers;
  window.collectionBookBuildRarityBatches = collectionBookBuildRarityBatches;
  window.collectionBookComputeProgress = collectionBookComputeProgress;
  window.collectionBookDetectNewlyCollected = collectionBookDetectNewlyCollected;
  window.collectionBookDetectNewFromIds = collectionBookDetectNewFromIds;
  window.collectionBookScanItems = collectionBookScanItems;
  window.collectionBookUpdateFromClub = collectionBookUpdateFromClub;
} catch {}
